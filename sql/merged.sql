-- Start with core setup (types, extensions, common functions)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'game_status') THEN
    CREATE TYPE game_status AS ENUM ('waiting', 'in_progress', 'completed');
  END IF;
END $$;

DO $$ BEGIN
  CREATE TYPE turn_action_outcome AS ENUM ('bust', 'bank', 'continue');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TYPE turn_score_result AS (
  score INTEGER,
  valid_dice INTEGER[]
);

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create realtime subscriptions
DROP PUBLICATION IF EXISTS supabase_realtime;
CREATE PUBLICATION supabase_realtime;

-- Create updated_at timestamp trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS trigger AS $$
BEGIN
  new.updated_at = now();
  return new;
END;
$$ LANGUAGE plpgsql;

-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique,
  avatar_name text default 'default',
  has_changed_username boolean default false,
  total_games int default 0,
  games_won int default 0,
  highest_score int default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Set up RLS for profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view any profile"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Create game rooms table
CREATE TABLE IF NOT EXISTS public.game_rooms (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  created_by uuid references public.profiles(id),
  status game_status default 'waiting'::game_status not null,
  max_players int default 4,
  current_players int default 0,
  winner_id uuid references public.profiles(id),
  invite_code char(6) unique not null,
  ended_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Set up RLS for game rooms
ALTER TABLE public.game_rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Game rooms are viewable by authenticated users"
  ON public.game_rooms FOR SELECT
  USING (true);

CREATE POLICY "Users can create game rooms"
  ON public.game_rooms FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE TRIGGER update_game_rooms_updated_at
  BEFORE UPDATE ON public.game_rooms
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.game_rooms;

-- Create game players table
CREATE TABLE IF NOT EXISTS public.game_players (
  id uuid default gen_random_uuid() primary key,
  game_id uuid references public.game_rooms(id) on delete cascade,
  user_id uuid references auth.users(id) not null,
  player_order int not null,
  score int default 0 not null,
  is_active boolean default true not null,
  joined_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(game_id, user_id),
  unique(game_id, player_order)
);

ALTER TABLE public.game_players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Game players are viewable by authenticated users"
  ON public.game_players FOR SELECT
  USING (true);

CREATE POLICY "Room creators can add players"
  ON public.game_players FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM game_rooms
      WHERE id = game_id
      AND created_by = auth.uid()
    )
  );

CREATE POLICY "Players can join rooms that are waiting and not full"
  ON public.game_players FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM game_rooms
      WHERE id = game_id
      AND status = 'waiting'
      AND current_players < max_players
      AND created_by != auth.uid()
    )
    AND
    NOT EXISTS (
      SELECT 1 FROM game_players
      WHERE game_id = game_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Players can update their own status in a game"
  ON public.game_players FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER PUBLICATION supabase_realtime ADD TABLE public.game_players;

-- Create game turns and actions tables first (moved up)
CREATE TABLE IF NOT EXISTS public.game_turns (
  id uuid default gen_random_uuid() primary key,
  game_id uuid references public.game_rooms(id) on delete cascade not null,
  player_id uuid references public.game_players(id) not null,
  turn_number int not null,
  started_at timestamp with time zone default timezone('utc'::text, now()) not null,
  ended_at timestamp with time zone,
  score_gained int default 0 not null,
  is_farkle boolean default false not null,
  unique(game_id, turn_number)
);

CREATE TABLE IF NOT EXISTS public.turn_actions (
  id uuid default gen_random_uuid() primary key,
  turn_id uuid references public.game_turns(id) on delete cascade not null,
  action_number int not null,
  dice_values int[] not null,
  kept_dice int[] default array[]::int[] not null,
  score int default 0 not null,
  outcome turn_action_outcome,
  available_dice int,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(turn_id, action_number)
);

ALTER TABLE public.game_turns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.turn_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Turns are viewable by authenticated users"
  ON public.game_turns FOR SELECT
  USING (true);

CREATE POLICY "Turn actions are viewable by authenticated users"
  ON public.turn_actions FOR SELECT
  USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.game_turns;
ALTER PUBLICATION supabase_realtime ADD TABLE public.turn_actions;

-- Now create game states table (moved down, after game_turns)
CREATE TABLE IF NOT EXISTS public.game_states (
  game_id uuid references public.game_rooms(id) on delete cascade primary key,
  current_turn_number int not null,
  current_player_id uuid references public.game_players(id) not null,
  current_turn uuid references public.game_turns(id),
  last_updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

ALTER TABLE public.game_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Game states are viewable by authenticated users"
  ON public.game_states FOR SELECT
  USING (true);

CREATE POLICY "Players can update game state"
  ON public.game_states FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM game_players
      WHERE game_id = game_states.game_id
      AND user_id = auth.uid()
      AND is_active = true
    )
  );

ALTER PUBLICATION supabase_realtime ADD TABLE public.game_states;

-- Create game history table
CREATE TABLE IF NOT EXISTS public.game_history (
  id uuid default uuid_generate_v4() primary key,
  game_room_id uuid references public.game_rooms(id) on delete cascade,
  winner_id uuid references public.profiles(id),
  final_scores jsonb not null,
  duration interval,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

ALTER TABLE public.game_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view game history"
  ON public.game_history FOR SELECT
  USING (true);

-- Function to generate random 6-digit invite code
CREATE OR REPLACE FUNCTION generate_invite_code()
RETURNS char(6) AS $$
DECLARE
  code char(6);
  valid boolean;
BEGIN
  LOOP
    code := lpad(floor(random() * 1000000)::text, 6, '0');
    SELECT NOT EXISTS (
      SELECT 1 FROM game_rooms WHERE invite_code = code
    ) INTO valid;
    EXIT WHEN valid;
  END LOOP;
  RETURN code;
END;
$$ LANGUAGE plpgsql;

-- Function to create a new game room
CREATE OR REPLACE FUNCTION create_room(p_name TEXT)
RETURNS UUID AS $$
DECLARE
  v_room_id UUID;
  v_invite_code CHAR(6);
  v_player_id UUID;
  v_turn_id UUID;
BEGIN
  -- Generate invite code
  SELECT generate_invite_code() INTO v_invite_code;

  -- Create the room
  INSERT INTO game_rooms (
    name,
    created_by,
    status,
    max_players,
    invite_code
  ) VALUES (
    p_name,
    auth.uid(),
    'waiting',
    4,
    v_invite_code
  ) RETURNING id INTO v_room_id;

  -- Add the creator as the first player
  INSERT INTO game_players (
    game_id,
    user_id,
    player_order,
    score,
    is_active
  ) VALUES (
    v_room_id,
    auth.uid(),
    1,
    0,
    true
  ) RETURNING id INTO v_player_id;

  -- Create initial turn
  INSERT INTO game_turns (
    game_id,
    player_id,
    turn_number,
    started_at
  ) VALUES (
    v_room_id,
    v_player_id,
    1,
    now()
  ) RETURNING id INTO v_turn_id;

  -- Create game state record with current player as first player
  -- and current turn number as 1
  -- and game status as waiting
  INSERT INTO game_states (
    game_id,
    current_player_id,
    current_turn_number,
    current_turn
  ) VALUES (
    v_room_id,
    v_player_id,
    1,
    v_turn_id
  );

  RETURN v_room_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to join a game
CREATE OR REPLACE FUNCTION join_game(room_id UUID, code TEXT)
RETURNS game_players AS $$
DECLARE
  next_order INT;
  new_player game_players;
BEGIN
  -- Verify room exists and is joinable
  IF NOT EXISTS (
    SELECT 1 FROM game_rooms
    WHERE id = room_id
    AND status = 'waiting'
    AND current_players < max_players
    AND invite_code = code
  ) THEN
    RAISE EXCEPTION 'Invalid room or room is full';
  END IF;

  -- Check if user is already in the room
  IF EXISTS (
    SELECT 1 FROM game_players
    WHERE game_id = room_id
    AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Already in room';
  END IF;

  -- Get next player order
  SELECT COALESCE(MAX(player_order), 0) + 1
  INTO next_order
  FROM game_players
  WHERE game_id = room_id;

  -- Insert the new player
  INSERT INTO game_players (
    game_id,
    user_id,
    player_order,
    is_active,
    score
  )
  VALUES (
    room_id,
    auth.uid(),
    next_order,
    true,
    0
  )
  RETURNING * INTO new_player;

  RETURN new_player;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to leave a game
CREATE OR REPLACE FUNCTION leave_game(room_id UUID)
RETURNS void AS $$
BEGIN
  -- Set player as inactive
  UPDATE game_players
  SET is_active = false
  WHERE game_id = room_id
  AND user_id = auth.uid();

  -- If all players are inactive, mark game as completed
  UPDATE game_rooms
  SET status = 'completed'
  WHERE id = room_id
  AND NOT EXISTS (
    SELECT 1 FROM game_players
    WHERE game_id = room_id
    AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to start game
CREATE OR REPLACE FUNCTION start_game(room_id UUID)
RETURNS void AS $$
BEGIN
  -- Verify user is room creator
  IF NOT EXISTS (
    SELECT 1 FROM game_rooms
    WHERE id = room_id
    AND created_by = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Only room creator can start the game';
  END IF;

  -- Update room status
  UPDATE game_rooms
  SET status = 'in_progress'
  WHERE id = room_id
  AND status = 'waiting'
  AND current_players > 0;  -- Allow single player games

  -- Initialize game state if not exists
  INSERT INTO game_states (
    game_id,
    current_turn_number,
    current_player_id
  )
  SELECT
    room_id,
    1,
    (SELECT id FROM game_players WHERE game_id = room_id AND player_order = 1)
  WHERE NOT EXISTS (
    SELECT 1 FROM game_states WHERE game_id = room_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to roll dice
CREATE OR REPLACE FUNCTION roll_dice(num_dice INTEGER)
RETURNS INTEGER[] AS $$
DECLARE
  roll INTEGER[];
BEGIN
  SELECT array_agg(floor(random() * 6 + 1)::integer)
  INTO roll
  FROM generate_series(1, num_dice);
  RETURN roll;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate turn score
CREATE OR REPLACE FUNCTION calculate_turn_score(selected_dice INTEGER[])
RETURNS turn_score_result AS $$
DECLARE
  result turn_score_result;
  dice_counts INTEGER[];
  valid_dice INTEGER[] := ARRAY[]::INTEGER[];
  i INTEGER;
  j INTEGER;
  pair_count INTEGER := 0;
  has_straight BOOLEAN := false;
  base_score INTEGER;
BEGIN
  -- Initialize result
  result.score := 0;
  result.valid_dice := ARRAY[]::INTEGER[];
  
  -- Initialize counts array
  dice_counts := array_fill(0, array[6]);
  
  -- Count occurrences of each die value
  FOR i IN 1..array_length(selected_dice, 1) LOOP
    dice_counts[selected_dice[i]] := dice_counts[selected_dice[i]] + 1;
  END LOOP;

  -- Check for straight (1-6)
  IF array_length(selected_dice, 1) = 6 THEN
    has_straight := true;
    FOR i IN 1..6 LOOP
      IF dice_counts[i] != 1 THEN
        has_straight := false;
        EXIT;
      END IF;
    END LOOP;

    IF has_straight THEN
      result.score := 1000;
      result.valid_dice := selected_dice;
      RETURN result;
    END IF;
  END IF;

  -- Check for three pairs
  IF array_length(selected_dice, 1) = 6 THEN
    pair_count := 0;
    FOR i IN 1..6 LOOP
      IF dice_counts[i] = 2 THEN
        pair_count := pair_count + 1;
      END IF;
    END LOOP;

    IF pair_count = 3 THEN
      result.score := 750;
      result.valid_dice := selected_dice;
      RETURN result;
    END IF;
  END IF;
  
  -- Handle multiples (3 or more of a kind)
  FOR i IN 1..6 LOOP
    IF dice_counts[i] >= 3 THEN
      -- Calculate base score for three of a kind
      IF i = 1 THEN
        base_score := 1000;
      ELSE
        base_score := i * 100;
      END IF;
      
      -- Add base score for initial three dice
      result.score := base_score;
      
      -- Add base score for each additional die
      IF dice_counts[i] > 3 THEN
        result.score := result.score + (base_score * (dice_counts[i] - 3));
      END IF;
      
      -- Add these dice to valid_dice array
      FOR j IN 1..dice_counts[i] LOOP
        result.valid_dice := array_append(result.valid_dice, i);
      END LOOP;
      
      -- Set count to 0 so we don't count these dice again
      dice_counts[i] := 0;
    END IF;
  END LOOP;
  
  -- Score remaining individual 1s and 5s
  FOR i IN 1..dice_counts[1] LOOP
    result.score := result.score + 100;
    result.valid_dice := array_append(result.valid_dice, 1);
  END LOOP;
  
  FOR i IN 1..dice_counts[5] LOOP
    result.score := result.score + 50;
    result.valid_dice := array_append(result.valid_dice, 5);
  END LOOP;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to get available dice for current turn
CREATE OR REPLACE FUNCTION get_available_dice(p_turn_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_latest_action turn_actions;
BEGIN
  -- Get the latest action for this turn
  SELECT * INTO v_latest_action
  FROM turn_actions
  WHERE turn_id = p_turn_id
  ORDER BY action_number DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN 6; -- Start of turn, all dice available
  END IF;

  -- If the latest action has no outcome, no dice are available until the action is completed
  IF v_latest_action.outcome IS NULL THEN
    RETURN 0;
  END IF;

  -- Calculate remaining dice based on kept dice
  RETURN CASE
    -- If all dice were kept, give 6 new dice (hot dice)
    WHEN array_length(v_latest_action.kept_dice, 1) = array_length(v_latest_action.dice_values, 1) THEN 6
    -- Otherwise return remaining dice
    ELSE array_length(v_latest_action.dice_values, 1) - array_length(v_latest_action.kept_dice, 1)
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to perform roll
CREATE OR REPLACE FUNCTION perform_roll(p_game_id UUID, p_num_dice INTEGER DEFAULT 6)
RETURNS INTEGER[] AS $$
DECLARE
  v_game_state game_states;
  v_player game_players;
  v_turn game_turns;
  v_roll_results INTEGER[];
  v_score_result turn_score_result;
  v_available_dice INTEGER;
BEGIN
  -- Get current game state
  SELECT gs.* INTO v_game_state
  FROM game_states gs
  WHERE gs.game_id = p_game_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Game state not found';
  END IF;

  -- Get current player
  SELECT gp.* INTO v_player
  FROM game_players gp
  WHERE gp.id = v_game_state.current_player_id;

  -- Verify it's the user's turn
  IF v_player.user_id != auth.uid() THEN
    RAISE EXCEPTION 'Not your turn';
  END IF;

  -- Verify game is in progress
  IF NOT EXISTS (
    SELECT 1 FROM game_rooms gr
    WHERE gr.id = p_game_id
    AND gr.status = 'in_progress'
  ) THEN
    RAISE EXCEPTION 'Game is not in progress';
  END IF;

  -- Get or create current turn
  SELECT gt.* INTO v_turn
  FROM game_turns gt
  WHERE gt.game_id = p_game_id
  AND gt.turn_number = v_game_state.current_turn_number;

  IF NOT FOUND THEN
    -- Create new turn
    INSERT INTO game_turns (
      game_id,
      player_id,
      turn_number,
      started_at
    ) VALUES (
      p_game_id,
      v_player.id,
      v_game_state.current_turn_number,
      now()
    )
    RETURNING * INTO v_turn;
  END IF;

  -- Perform the roll
  v_roll_results := roll_dice(6);

  -- Calculate initial possible score for this roll
  v_score_result := calculate_turn_score(v_roll_results);

  -- Set available dice based on this roll which is 6 - v_score_result.valid_dice
  v_available_dice := 6 - array_length(v_score_result.valid_dice, 1);

  INSERT INTO turn_actions (
    turn_id,
    action_number,
    dice_values,
    kept_dice,
    score,
    available_dice,
    created_at
  ) VALUES (
    v_turn.id,
    1,
    v_roll_results,
    v_score_result.valid_dice,
    v_score_result.score,
    v_available_dice,
    now()
  );

  RETURN v_roll_results;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to process turn action
CREATE OR REPLACE FUNCTION process_turn_action(
  p_game_id UUID,
  p_outcome turn_action_outcome
) RETURNS INTEGER[] AS $$
DECLARE
  v_game_state game_states;
  v_player game_players;
  v_turn game_turns;
  v_latest_action turn_actions;
  v_score_result turn_score_result;
  v_remaining_dice INTEGER;
  v_roll_results INTEGER[];
BEGIN
  -- Get current game state
  SELECT gs.* INTO v_game_state
  FROM game_states gs
  WHERE gs.game_id = p_game_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Game state not found';
  END IF;

  -- Get current player
  SELECT gp.* INTO v_player
  FROM game_players gp
  WHERE gp.id = v_game_state.current_player_id;

  -- Get current turn
  SELECT gt.* INTO v_turn
  FROM game_turns gt
  WHERE gt.game_id = p_game_id
  AND gt.turn_number = v_game_state.current_turn_number;

  -- Get latest action
  SELECT ta.* INTO v_latest_action
  FROM turn_actions ta
  WHERE ta.turn_id = v_turn.id
  ORDER BY ta.action_number DESC
  LIMIT 1;


  -- CASE p_outcome
  CASE p_outcome
    WHEN 'bust' THEN
  -- bust: set outcome to bust
  -- set outcome to bust on the previous turn_action
  UPDATE turn_actions
  SET outcome = 'bust'
  WHERE id = v_latest_action.id;

       PERFORM end_turn(p_game_id, 0);
    WHEN 'bank' THEN
        -- bank: set outcome to bank
      -- set outcome to bank on the previous turn_action
      UPDATE turn_actions
      SET outcome = 'bank'
      WHERE id = v_latest_action.id;

      -- if the score of the latest turn_action is 0, we cannot bank
      if v_latest_action.score = 0 then
        RAISE EXCEPTION 'Cannot bank with 0 score from previous turn';
      end if;

        -- Sum up all scores from this turn's actions
      SELECT COALESCE(SUM(score), 0)
      INTO v_score_result.score
      FROM turn_actions
      WHERE turn_id = v_turn.id;
      
      PERFORM end_turn(p_game_id, v_score_result.score);

    WHEN 'continue' THEN
  -- continue: 
  -- get available dice from v_latest_action.available_dice
  -- roll the amount of available dice
  -- update turn_action with new dice values, kept_dice, and score, and available_dice
    
    v_remaining_dice := v_latest_action.available_dice;
    if v_remaining_dice = 0 then
      -- if v_remaining_dice is 0, check if we rolled all bankable dice
      -- if we did, set v_remaining_dice to 6
      -- check if the score is greater than 0
      -- check if the length of the dice_values array is equal to the length of the kept_dice array
      -- if both are true, set v_remaining_dice to 6
      -- otherwise throw an exception
      if v_latest_action.score > 0 and array_length(v_latest_action.dice_values, 1) = array_length(v_latest_action.kept_dice, 1) then
        v_remaining_dice := 6;
      else
        RAISE EXCEPTION 'Cannot continue turn with 0 available dice';
      end if;
    end if;

    v_roll_results := roll_dice(v_remaining_dice);

    v_score_result := calculate_turn_score(v_roll_results);

  -- set outcome to continue on the previous turn_action
  -- v_latest_action should have the id to use.
  UPDATE turn_actions
  SET outcome = 'continue'
  WHERE id = v_latest_action.id;

  INSERT INTO turn_actions (
    turn_id,
    action_number,
    dice_values,
    kept_dice,
    score,
    available_dice,
    created_at
  ) VALUES (
    v_turn.id,
     v_latest_action.action_number + 1,
    v_roll_results,
    v_score_result.valid_dice,
    v_score_result.score,
    v_remaining_dice - array_length(v_score_result.valid_dice, 1),
    now()
  );
      RETURN v_roll_results;
  END CASE;

  -- Return NULL for non-continue outcomes
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to validate dice selection
CREATE OR REPLACE FUNCTION validate_dice_selection(
  roll INTEGER[],
  selection INTEGER[]
) RETURNS boolean AS $$
DECLARE
  valid boolean;
BEGIN
  -- Basic validation that selected dice exist in the roll
  SELECT bool_and(s = any(roll))
  INTO valid
  FROM unnest(selection) s;
  RETURN valid;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to check for Farkle
CREATE OR REPLACE FUNCTION check_farkle(roll INTEGER[])
RETURNS boolean AS $$
DECLARE
  dice_counts INTEGER[];
  i INTEGER;
  has_scoring_dice boolean := false;
BEGIN
  -- Initialize counts array
  dice_counts := array_fill(0, array[6]);
  
  -- Count occurrences of each die value
  FOR i IN 1..array_length(roll, 1) LOOP
    dice_counts[roll[i]] := dice_counts[roll[i]] + 1;
  END LOOP;
  
  -- Check for any scoring combinations
  -- 1s and 5s
  IF dice_counts[1] > 0 OR dice_counts[5] > 0 THEN
    RETURN false;
  END IF;
  
  -- Check for three of a kind
  FOR i IN 1..6 LOOP
    IF dice_counts[i] >= 3 THEN
      RETURN false;
    END IF;
  END LOOP;
  
  -- If we get here, no scoring combinations were found
  RETURN true;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to end turn (with player_order fix)
CREATE OR REPLACE FUNCTION end_turn(
  p_game_id UUID,
  p_final_score INTEGER
) RETURNS void AS $$
DECLARE
  v_turn game_turns;
  v_next_player_id UUID;
  v_pending_actions INTEGER;
  v_new_turn_id UUID;
BEGIN
  -- Check if all actions have outcomes before ending turn
  SELECT COUNT(*)
  INTO v_pending_actions
  FROM turn_actions ta
  JOIN game_turns gt ON ta.turn_id = gt.id
  WHERE gt.game_id = p_game_id
  AND gt.ended_at IS NULL
  AND ta.outcome IS NULL;

  IF v_pending_actions > 0 THEN
    RAISE EXCEPTION 'Cannot end turn with pending actions. All actions must have an outcome.';
  END IF;

  -- Update the current turn
  UPDATE game_turns gt
  SET ended_at = now(),
      score_gained = p_final_score
  WHERE gt.game_id = p_game_id
  AND gt.ended_at IS NULL
  RETURNING * INTO v_turn;

  -- If banking (not farkle), update player's score
  
    UPDATE game_players
    SET score = score + p_final_score
    WHERE id = v_turn.player_id;
  

  -- Get next player in turn order (using player_order instead of turn_order)
  SELECT gp.id INTO v_next_player_id
  FROM game_players gp
  WHERE gp.game_id = p_game_id
  AND gp.player_order > (
    SELECT player_order
    FROM game_players
    WHERE id = v_turn.player_id
  )
  ORDER BY gp.player_order
  LIMIT 1;

  -- If no next player, wrap around to first player
  IF v_next_player_id IS NULL THEN
    SELECT gp.id INTO v_next_player_id
    FROM game_players gp
    WHERE gp.game_id = p_game_id
    ORDER BY gp.player_order
    LIMIT 1;
  END IF;

  -- Create new turn for next player
  INSERT INTO game_turns (
    game_id,
    player_id,
    turn_number,
    started_at
  ) VALUES (
    p_game_id,
    v_next_player_id,
    v_turn.turn_number + 1,
    now()
  ) RETURNING id INTO v_new_turn_id;

  -- Update game state for next turn
  UPDATE game_states
  SET current_player_id = v_next_player_id,
      current_turn_number = v_turn.turn_number + 1,
      current_turn = v_new_turn_id,
      last_updated_at = now()
  WHERE game_id = p_game_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to end game
CREATE OR REPLACE FUNCTION end_game(p_game_id UUID)
RETURNS void AS $$
DECLARE
  v_winner_id UUID;
  v_winner_user_id UUID;
BEGIN
  -- Verify user is room creator
  IF NOT EXISTS (
    SELECT 1 FROM game_rooms
    WHERE id = p_game_id
    AND created_by = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Only room creator can end the game';
  END IF;

  -- Get the winner's player record and user_id (player with highest score)
  SELECT id, user_id INTO v_winner_id, v_winner_user_id
  FROM game_players
  WHERE game_id = p_game_id
  ORDER BY score DESC
  LIMIT 1;

  -- Update room status to completed
  UPDATE game_rooms
  SET 
    status = 'completed',
    ended_at = now(),
    winner_id = v_winner_user_id  -- Use user_id instead of player id
  WHERE id = p_game_id
  AND status = 'in_progress';

  -- Delete game state since game is over
  DELETE FROM game_states
  WHERE game_id = p_game_id;

  -- Record game history
  INSERT INTO game_history (
    game_room_id,
    winner_id,
    final_scores,
    duration
  )
  SELECT 
    p_game_id,
    v_winner_user_id,
    (
      SELECT jsonb_object_agg(gp.user_id, gp.score)
      FROM game_players gp
      WHERE gp.game_id = p_game_id
    ),
    age(now(), gr.created_at)
  FROM game_rooms gr
  WHERE gr.id = p_game_id;

  -- Set all players to inactive
  UPDATE game_players
  SET is_active = false
  WHERE game_id = p_game_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to maintain current_players count
CREATE OR REPLACE FUNCTION update_current_players()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE game_rooms
    SET current_players = current_players + 1
    WHERE id = NEW.game_id;
  ELSIF TG_OP = 'UPDATE' AND OLD.is_active != NEW.is_active THEN
    IF NEW.is_active THEN
      UPDATE game_rooms
      SET current_players = current_players + 1
      WHERE id = NEW.game_id;
    ELSE
      UPDATE game_rooms
      SET current_players = current_players - 1
      WHERE id = NEW.game_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER maintain_current_players
  AFTER INSERT OR UPDATE OF is_active ON game_players
  FOR EACH ROW
  EXECUTE FUNCTION update_current_players();


-- Test functions for game_turns.sql
-- These tests verify the scoring and game mechanics functions

-- Test function for calculate_turn_score
CREATE OR REPLACE FUNCTION test_calculate_turn_score()
RETURNS SETOF text AS $$
DECLARE
  result turn_score_result;
BEGIN
  -- Test single 1s and 5s
  result := calculate_turn_score(ARRAY[1]);
  ASSERT result.score = 100, 'Single 1 should score 100';
  
  result := calculate_turn_score(ARRAY[5]);
  ASSERT result.score = 50, 'Single 5 should score 50';
  
  result := calculate_turn_score(ARRAY[1, 5]);
  ASSERT result.score = 150, 'One 1 and one 5 should score 150';
  
  -- Test three of a kind
  result := calculate_turn_score(ARRAY[1, 1, 1]);
  ASSERT result.score = 1000, 'Three 1s should score 1000';
  
  result := calculate_turn_score(ARRAY[2, 2, 2]);
  ASSERT result.score = 200, 'Three 2s should score 200';
  
  result := calculate_turn_score(ARRAY[3, 3, 3]);
  ASSERT result.score = 300, 'Three 3s should score 300';
  
  result := calculate_turn_score(ARRAY[4, 4, 4]);
  ASSERT result.score = 400, 'Three 4s should score 400';
  
  result := calculate_turn_score(ARRAY[5, 5, 5]);
  ASSERT result.score = 500, 'Three 5s should score 500';
  
  result := calculate_turn_score(ARRAY[6, 6, 6]);
  ASSERT result.score = 600, 'Three 6s should score 600';

  -- Test four of a kind (adds base score once)
  result := calculate_turn_score(ARRAY[1, 1, 1, 1]);
  ASSERT result.score = 2000, 'Four 1s should score 2000';
  
  result := calculate_turn_score(ARRAY[2, 2, 2, 2]);
  ASSERT result.score = 400, 'Four 2s should score 400';
  
  result := calculate_turn_score(ARRAY[3, 3, 3, 3]);
  ASSERT result.score = 600, 'Four 3s should score 600';
  
  result := calculate_turn_score(ARRAY[4, 4, 4, 4]);
  ASSERT result.score = 800, 'Four 4s should score 800';
  
  result := calculate_turn_score(ARRAY[5, 5, 5, 5]);
  ASSERT result.score = 1000, 'Four 5s should score 1000';
  
  result := calculate_turn_score(ARRAY[6, 6, 6, 6]);
  ASSERT result.score = 1200, 'Four 6s should score 1200';

  -- Test five of a kind (adds base score twice)
  result := calculate_turn_score(ARRAY[1, 1, 1, 1, 1]);
  ASSERT result.score = 3000, 'Five 1s should score 3000';
  
  result := calculate_turn_score(ARRAY[2, 2, 2, 2, 2]);
  ASSERT result.score = 600, 'Five 2s should score 600';
  
  result := calculate_turn_score(ARRAY[3, 3, 3, 3, 3]);
  ASSERT result.score = 900, 'Five 3s should score 900';
  
  result := calculate_turn_score(ARRAY[4, 4, 4, 4, 4]);
  ASSERT result.score = 1200, 'Five 4s should score 1200';
  
  result := calculate_turn_score(ARRAY[5, 5, 5, 5, 5]);
  ASSERT result.score = 1500, 'Five 5s should score 1500';
  
  result := calculate_turn_score(ARRAY[6, 6, 6, 6, 6]);
  ASSERT result.score = 1800, 'Five 6s should score 1800';

  -- Test six of a kind (adds base score three times)
  result := calculate_turn_score(ARRAY[1, 1, 1, 1, 1, 1]);
  ASSERT result.score = 4000, 'Six 1s should score 4000';
  
  result := calculate_turn_score(ARRAY[2, 2, 2, 2, 2, 2]);
  ASSERT result.score = 800, 'Six 2s should score 800';
  
  result := calculate_turn_score(ARRAY[3, 3, 3, 3, 3, 3]);
  ASSERT result.score = 1200, 'Six 3s should score 1200';
  
  result := calculate_turn_score(ARRAY[4, 4, 4, 4, 4, 4]);
  ASSERT result.score = 1600, 'Six 4s should score 1600';
  
  result := calculate_turn_score(ARRAY[5, 5, 5, 5, 5, 5]);
  ASSERT result.score = 2000, 'Six 5s should score 2000';
  
  result := calculate_turn_score(ARRAY[6, 6, 6, 6, 6, 6]);
  ASSERT result.score = 2400, 'Six 6s should score 2400';
  
  -- Test straight (1-6)
  result := calculate_turn_score(ARRAY[1, 2, 3, 4, 5, 6]);
  ASSERT result.score = 1000, 'Straight 1-6 should score 1000';
  
  result := calculate_turn_score(ARRAY[6, 5, 4, 3, 2, 1]);
  ASSERT result.score = 1000, 'Straight 6-1 should score 1000';
  
  result := calculate_turn_score(ARRAY[3, 1, 4, 6, 2, 5]);
  ASSERT result.score = 1000, 'Mixed order straight should score 1000';

  -- Test three pairs
  result := calculate_turn_score(ARRAY[2, 2, 3, 3, 4, 4]);
  ASSERT result.score = 750, 'Three pairs should score 750';
  
  result := calculate_turn_score(ARRAY[1, 1, 3, 3, 6, 6]);
  ASSERT result.score = 750, 'Three pairs with 1s should score 750';
  
  result := calculate_turn_score(ARRAY[5, 5, 2, 2, 4, 4]);
  ASSERT result.score = 750, 'Three pairs with 5s should score 750';
  
  -- Test combinations
  result := calculate_turn_score(ARRAY[1, 1, 1, 5]);
  ASSERT result.score = 1050, 'Three 1s and a 5 should score 1050';
  
  result := calculate_turn_score(ARRAY[5, 5, 5, 1]);
  ASSERT result.score = 600, 'Three 5s and a 1 should score 600';
  
  result := calculate_turn_score(ARRAY[2, 2, 2, 1, 5]);
  ASSERT result.score = 350, 'Three 2s with 1 and 5 should score 350';
  
  -- Test non-scoring dice
  result := calculate_turn_score(ARRAY[2]);
  ASSERT result.score = 0, 'Single 2 should score 0';
  
  result := calculate_turn_score(ARRAY[3, 4, 6]);
  ASSERT result.score = 0, 'Non-scoring combination should score 0';
  
  RETURN NEXT 'All calculate_turn_score tests passed!';
END;
$$ LANGUAGE plpgsql;

-- Function to run all tests
CREATE OR REPLACE FUNCTION run_all_tests()
RETURNS SETOF text AS $$
BEGIN
  RETURN QUERY SELECT * FROM test_calculate_turn_score();
END;
$$ LANGUAGE plpgsql; 