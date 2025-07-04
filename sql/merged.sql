-- Start with core setup (types, extensions, common functions)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'game_status') THEN
    CREATE TYPE game_status AS ENUM (
      'settings',
      'waiting',
      'in_progress',
      'rebuttal',
      'completed'
    );
  END IF;
END $$;

DO $$ BEGIN
  CREATE TYPE turn_action_outcome AS ENUM ('bust', 'bank', 'continue');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
CREATE TYPE turn_score_result AS (
  score INTEGER,
  valid_dice INTEGER[]
);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

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
  onboarding_step int default 1,
  onboarding_completed boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  fcm_token text
);

-- Function to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, username, avatar_name, onboarding_completed)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', 'User_' || substr(NEW.id::text, 1, 4)),
    'default',
    false
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically create profile on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

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
  status game_status default 'settings'::game_status not null,
  settings_step int default 1,
  max_players int default 4,
  current_players int default 0,
  winner_id uuid references public.profiles(id),
  invite_code char(6) unique not null,
  table_model text default 'boxing_ring' check (table_model in ('boxing_ring', 'coliseum', 'poker_table')),
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
  is_joined boolean default false not null,
  joined_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(game_id, user_id),
  unique(game_id, player_order)
);

-- Create bot player type
DO $$ BEGIN
  CREATE TYPE bot_difficulty AS ENUM ('easy', 'medium', 'hard');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create bot players table
CREATE TABLE IF NOT EXISTS public.bot_players (
  id uuid default gen_random_uuid() primary key,
  game_id uuid references public.game_rooms(id) on delete cascade,
  player_id uuid references public.game_players(id) on delete cascade,
  difficulty bot_difficulty default 'medium' not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Set up RLS for bot players
ALTER TABLE public.bot_players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Bot players are viewable by authenticated users"
  ON public.bot_players FOR SELECT
  USING (true);

CREATE POLICY "Room creators can add bot players"
  ON public.bot_players FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM game_rooms
      WHERE id = game_id
      AND created_by = auth.uid()
    )
  );

-- Add to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.bot_players;

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
  scoring_dice int[] default array[]::int[] not null,
  selected_dice int[] default array[]::int[] not null,
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
      AND is_joined = true
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
  -- generate a random 6-digit code
  code := lpad(floor(random() * 1000000)::text, 6, '0');
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
    invite_code,
    table_model
  ) VALUES (
    p_name,
    auth.uid(),
    'settings',
    4,
    v_invite_code,
    'boxing_ring'
  ) RETURNING id INTO v_room_id;

  -- Add the creator as the first player
  INSERT INTO game_players (
    game_id,
    user_id,
    player_order,
    score,
    is_active,
    is_joined
  ) VALUES (
    v_room_id,
    auth.uid(),
    1,
    0,
    true,
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
  -- and game status as settings
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
  -- and the invite code is correct
  -- and the room is not full
  -- and the status is "waiting" or "settings"

  IF NOT EXISTS (
    SELECT 1 FROM game_rooms
    WHERE id = room_id
    AND (status = 'waiting' OR status = 'settings')
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
    is_joined,
    score
  )
  VALUES (
    room_id,
    auth.uid(),
    next_order,
    true,
    true,
    0
  )
  RETURNING * INTO new_player;

  RETURN new_player;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to remove the first occurrence of a value in an array
CREATE OR REPLACE FUNCTION remove_first_occurrence(p_kept_dice INTEGER[], v_kept_dice INTEGER[])
RETURNS INTEGER[] AS $$
DECLARE
    result_dice INTEGER[] := v_kept_dice;
    value INTEGER;
    index INTEGER;
BEGIN

    -- Iterate over each value in p_kept_dice
    FOREACH value IN ARRAY p_kept_dice LOOP
        -- Find the index of the first occurrence of the value in result_dice
        index := array_position(result_dice, value);
        
        -- If the value is found, remove it
        IF index IS NOT NULL THEN
            result_dice := result_dice[1:index-1] || result_dice[index+1:array_length(result_dice, 1)];
        ELSE
            -- Raise an exception if the value is not found
            RAISE EXCEPTION 'Value % not found in array', value;
        END IF;
    END LOOP;
    
    RETURN result_dice;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to leave a game
CREATE OR REPLACE FUNCTION leave_game(room_id UUID)
RETURNS void AS $$
BEGIN
  -- Set player as inactive
  UPDATE game_players
  SET is_active = false,
    is_joined = false
  WHERE game_id = room_id
  AND user_id = auth.uid();

  -- If all players are inactive, mark game as completed
  UPDATE game_rooms
  SET status = 'completed'
  WHERE id = room_id
  AND NOT EXISTS (
    SELECT 1 FROM game_players
    WHERE game_id = room_id
    AND is_joined = true
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
  AND status IN ('waiting')
  AND current_players > 0;  -- Allow single player games

  -- Update all game_invites for this game to cancelled
  UPDATE game_invites
  SET status = 'cancelled'
  WHERE game_id = room_id;

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
  SELECT array_agg(floor(random() * 6 + 1)::INTEGER)
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
    WHEN array_length(v_latest_action.scoring_dice, 1) = array_length(v_latest_action.dice_values, 1) THEN 6
    -- Otherwise return remaining dice
    ELSE array_length(v_latest_action.dice_values, 1) - array_length(v_latest_action.scoring_dice, 1)
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
  v_bot_player bot_players;
BEGIN
  -- Get current game state
  SELECT gs.* INTO v_game_state
  FROM game_states gs
  WHERE gs.game_id = p_game_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Game state not found';
  END IF;

  -- Verify game is in progress
  IF NOT EXISTS (
    SELECT 1 FROM game_rooms gr
    WHERE gr.id = p_game_id
    AND gr.status = 'in_progress'
  ) THEN
    RAISE EXCEPTION 'Game is not in progress';
  END IF;

  -- Get current player
  SELECT gp.* INTO v_player
  FROM game_players gp
  WHERE gp.id = v_game_state.current_player_id;

  -- Verify it's the user's turn
  IF v_player.user_id != auth.uid() THEN
      -- check if the player is a bot
      -- find the bot_players record where the player_id is v_player.id
    SELECT bp.* INTO v_bot_player
    FROM bot_players bp
    WHERE bp.player_id = v_player.id; 

    -- if v_bot_player is null, raise an exception
    IF v_bot_player IS NULL THEN
      RAISE EXCEPTION 'Not the bots turn';
    END IF;
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
    scoring_dice,
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


-- Function to select dice 
-- first argument is the turn_action_id
-- second argument is the selected_dice
-- find the turn_action with the given turn_action_id
-- update the selected_dice with the given selected_dice
CREATE OR REPLACE FUNCTION select_dice(turn_action_id UUID, dice INTEGER[])
RETURNS JSONB AS $$
DECLARE
  v_turn_action turn_actions;
  v_dice_values INTEGER[];
  v_scoring_dice INTEGER[];
  
  c_selected_dice INTEGER[];
  c_dice_length INTEGER;
  c_index INTEGER;
  c_value INTEGER;

  c_new_score_result turn_score_result;
  c_new_score INTEGER;
  c_new_valid_dice INTEGER[];
  
  c_new_available_dice INTEGER;
BEGIN
  -- Find the turn_action with the given turn_action_id
  SELECT ta.* INTO v_turn_action
  FROM turn_actions ta
  WHERE ta.id = turn_action_id;

  -- get the dice_values from the previous turn_action
  v_dice_values := v_turn_action.dice_values;

  -- get length of dice array
  c_dice_length := array_length(dice, 1);

  -- for each value in the dice array, get value from dice_values array at the index
  -- and add the value to the c_selected_dice array

  v_scoring_dice := v_turn_action.scoring_dice;


  -- if the length of the dice array is greater than 0
  if c_dice_length > 0 then
  FOR i IN 1..c_dice_length LOOP
    -- get the index to get
    c_index := dice[i];
    -- add 1 to the index because the dice_values array is 1-based
    c_index := c_index + 1;
    -- if the index is greater than the length of the dice_values array, raise an exception
    IF c_index > array_length(v_dice_values, 1) THEN
      RAISE EXCEPTION 'Invalid dice value';
    END IF;
    -- get the value from the dice_values array at the index
    c_value := v_dice_values[c_index];
    -- add the value to the c_selected_dice array
    c_selected_dice := array_append(c_selected_dice, c_value);
  END LOOP;

  -- calculate the new score_result using the new c_selected_dice 
  c_new_score_result := calculate_turn_score(c_selected_dice);

  c_new_score := c_new_score_result.score;
  c_new_valid_dice := c_new_score_result.valid_dice;

  -- calculate the new available_dice using
  -- dice_values length - new_valid_dice length
  c_new_available_dice := array_length(v_dice_values, 1) - array_length(c_new_valid_dice, 1);

  -- if c_new_available_dice is less than 0, raise an exception
  IF c_new_available_dice < 0 THEN
    RAISE EXCEPTION 'Cannot have negative available dice';
  END IF;
  

  -- update the current turn_action with the 
  -- score, available_dice, and selected_dice
  UPDATE turn_actions
  SET score = c_new_score,
      available_dice = c_new_available_dice,
      selected_dice = dice
  WHERE id = turn_action_id;


  -- Return debug information along with the result
  RETURN jsonb_build_object(
    'new_score', c_new_score,
    'new_valid_dice', c_new_valid_dice,
    'c_selected_dice', c_selected_dice,
    'c_new_score_result', c_new_score_result,
    'c_new_available_dice', c_new_available_dice
  );
  end if;

  -- if dice length is 0
  -- calculate the new_turn_score using the scoring_dice
  -- calculate the new avalable_dice using the scoring_dice length

  c_new_score_result := calculate_turn_score(v_scoring_dice);
  c_new_available_dice := array_length(v_dice_values, 1) - array_length(v_scoring_dice, 1);

  c_new_score := c_new_score_result.score;
  -- if c_new_available_dice is less than 0, raise an exception
  IF c_new_available_dice < 0 THEN
    RAISE EXCEPTION 'Cannot have negative available dice';
  END IF;

  -- update the current turn_action with the 
  -- score, available_dice, and selected_dice
  UPDATE turn_actions
  SET score = c_new_score,
      available_dice = c_new_available_dice,
      selected_dice = dice
  WHERE id = turn_action_id;
  
  RETURN jsonb_build_object(
    'new_score', c_new_score,
    'new_valid_dice', c_new_valid_dice,
    'c_selected_dice', c_selected_dice,
    'c_new_score_result', c_new_score_result,
    'c_new_available_dice', c_new_available_dice
  );
  

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Function to process turn action

CREATE OR REPLACE FUNCTION process_turn_action(
  p_game_id UUID,
  p_outcome turn_action_outcome
) RETURNS JSONB AS $$
DECLARE
  v_game_state game_states;
  v_game_room game_rooms;
  v_player game_players;
  v_turn game_turns;
  v_latest_action turn_actions;

  v_score_result turn_score_result;

  v_remaining_dice INTEGER;
  v_kept_dice INTEGER[];
  v_roll_results INTEGER[];
  v_dice_values INTEGER[];
  v_selected_dice INTEGER[];

  v_roll_score INTEGER;

  c_new_score_result turn_score_result;
BEGIN
  -- Get current game state
  SELECT gs.* INTO v_game_state
  FROM game_states gs
  WHERE gs.game_id = p_game_id;

  -- if the v_game_state is not found, raise an exception
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Game state not found';
  END IF;

  SELECT gr.* INTO v_game_room
  FROM game_rooms gr
  WHERE gr.id = p_game_id;

  -- if the v_game_room is not found, raise an exception
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Game room not found';
  END IF;

  -- Get current player
  SELECT gp.* INTO v_player
  FROM game_players gp
  WHERE gp.id = v_game_state.current_player_id;

  -- if the v_player is not found, raise an exception
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Player not found';
  END IF;

  -- Get current turn
  SELECT gt.* INTO v_turn
  FROM game_turns gt
  WHERE gt.game_id = p_game_id
  AND gt.turn_number = v_game_state.current_turn_number;

  -- if the v_turn is not found, raise an exception
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Turn not found';
  END IF;

  -- Get latest action
  SELECT ta.* INTO v_latest_action
  FROM turn_actions ta
  WHERE ta.turn_id = v_turn.id
  ORDER BY ta.action_number DESC
  LIMIT 1;

  -- if the v_latest_action is not found, raise an exception
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Latest action not found';
  END IF;

  -- perform the turn action depending on the outcome
  -- Use CASE as an expression
  IF p_outcome = 'bust' THEN
    -- bust: set outcome to bust
    UPDATE turn_actions
    SET outcome = 'bust'
    WHERE id = v_latest_action.id;

    -- Call end_turn with 0 score for bust
    PERFORM end_turn(p_game_id, 0);

  ELSIF p_outcome = 'bank' THEN
    -- bank: set outcome to bank
    UPDATE turn_actions
    SET outcome = 'bank'
    WHERE id = v_latest_action.id;

    -- if the score of the latest turn_action is 0, we cannot bank
    IF v_latest_action.score = 0 THEN
      RAISE EXCEPTION 'Cannot bank with 0 score from previous turn';
    END IF;

    -- Sum up all scores from this turn's actions
    SELECT COALESCE(SUM(score), 0)
    INTO v_score_result.score
    FROM turn_actions
    WHERE turn_id = v_turn.id;

    -- Call end_turn with the calculated score
    PERFORM end_turn(p_game_id, v_score_result.score);

  ELSIF p_outcome = 'continue' THEN
    -- get the available dice from the latest turn_action
    v_remaining_dice := v_latest_action.available_dice;
    v_roll_score := v_latest_action.score;

    -- if the remaining dice is 0, and the v_roll_score is 0, raise an exception
    IF v_remaining_dice = 0 AND v_roll_score = 0 THEN
      RAISE EXCEPTION 'Cannot continue with 0 available dice and 0 score';
    END IF;

    -- if the remaining dice is 0, and the v_roll_score is not 0, raise an exception
    -- then roll all 6 dice
    IF v_remaining_dice = 0 AND v_roll_score > 0 THEN
      v_remaining_dice := 6;
      v_roll_results := roll_dice(6);
      v_score_result := calculate_turn_score(v_roll_results);
    ELSIF v_remaining_dice > 0 AND v_roll_score > 0 THEN
      v_roll_results := roll_dice(v_remaining_dice);
      v_score_result := calculate_turn_score(v_roll_results);
    END IF;

    -- set outcome to continue on the previous turn_action
    UPDATE turn_actions
    SET outcome = 'continue',
        kept_dice = v_latest_action.selected_dice
    WHERE id = v_latest_action.id;

    INSERT INTO turn_actions (
      turn_id,
      action_number,
      dice_values,
      scoring_dice,
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

    RETURN to_json(c_new_score_result);
  END IF;

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
  v_next_player_user_id UUID;
  v_pending_actions INTEGER;
  v_new_turn_id UUID;
  v_current_score INTEGER;
  v_winner_id UUID;
  v_winner_user_id UUID;
  v_game_room game_rooms;
  v_is_player_active BOOLEAN;
  v_is_player_joined BOOLEAN;
  v_room_name TEXT;
  v_last_notification_time TIMESTAMP WITH TIME ZONE;
  v_notification_cooldown INTERVAL := '5 minutes'::INTERVAL;
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
  
  -- get the current score of the player
  SELECT score INTO v_current_score
  FROM game_players
  WHERE id = v_turn.player_id;

  -- if the v_current_score + p_final_score is over 10000
  -- set the status of the game to rebuttal
  -- and update the game room with the winner
  IF v_current_score + p_final_score >= 10000 THEN
    UPDATE game_rooms
    SET status = 'rebuttal'
    WHERE id = p_game_id;

    -- update the game room as the winner
      SELECT id, user_id INTO v_winner_id, v_winner_user_id
    FROM game_players
    WHERE game_id = p_game_id
    ORDER BY score DESC
    LIMIT 1;

    UPDATE game_rooms
    SET winner_id = v_winner_user_id
    WHERE id = p_game_id;
    
  END IF;

  -- get the game_room
  SELECT gr.* INTO v_game_room
  FROM game_rooms gr
  WHERE gr.id = p_game_id;

  -- if the v_game_room is not found, raise an exception
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Game room not found';
  END IF;

  -- if the v_game_room.status is rebuttal
  -- then if the next player is the same as the winner, end the game
  IF v_game_room.status = 'rebuttal' THEN
     SELECT id, user_id INTO v_winner_id, v_winner_user_id
    FROM game_players
    WHERE game_id = p_game_id
    ORDER BY score DESC
    LIMIT 1;
    IF v_next_player_id = v_winner_id THEN
      PERFORM end_game(p_game_id);
    END IF;
  END IF;

  -- update the score of the player
  UPDATE game_players
  SET score = v_current_score + p_final_score
  WHERE id = v_turn.player_id;
  
  -- Get next player in turn order (using player_order instead of turn_order)
  SELECT gp.id, gp.user_id INTO v_next_player_id, v_next_player_user_id
  FROM game_players gp
  WHERE gp.game_id = p_game_id
  AND gp.player_order > (
    SELECT player_order
    FROM game_players
    WHERE id = v_turn.player_id
  )
  ORDER BY gp.player_order
  LIMIT 1;

  -- if the v_next_player_id is not found, wrap around to first player
  IF v_next_player_id IS NULL THEN
    SELECT gp.id, gp.user_id INTO v_next_player_id, v_next_player_user_id
    FROM game_players gp
    WHERE gp.game_id = p_game_id
    ORDER BY gp.player_order
    LIMIT 1;
  END IF;

  -- Get the room name for the notification
  SELECT name INTO v_room_name
  FROM game_rooms
  WHERE id = p_game_id;

  -- Check if the next player is present in the game room using the presence channel
  -- We'll use a function to check if the user is in the presence channel for this room
  -- This is a more reliable way to check presence than using is_active
  
  -- Check if the player is in the presence channel for this room
  -- Note: This is a simplified approach. In a real implementation, you would need to
  -- query the presence channel directly, which might require a different approach
  -- or a separate function that can access the presence channel data
  
  -- For now, we'll use a placeholder approach that assumes the player is not present
  -- In a real implementation, you would replace this with actual presence channel checking
  
  v_is_player_active := false;
  v_is_player_joined := false;
  -- check if the player is_active and is_joined
  SELECT is_active, is_joined INTO v_is_player_active, v_is_player_joined
  FROM game_players
  WHERE user_id = v_next_player_user_id;
  
  -- if the player is not is_active and is_joined, then we can create a new notification
  IF NOT v_is_player_active AND v_is_player_joined THEN
       -- Insert a notification for the player with additional context
    INSERT INTO notifications (
      user_id,
      body
    ) VALUES (
      v_next_player_user_id,
      'It''s your turn in game room: ' || v_room_name
    );
  END IF;
  IF v_is_player_active THEN
       -- Insert a notification for the player with additional context
    INSERT INTO notifications (
      user_id,
      body
    ) VALUES (
      v_next_player_user_id,
      'User is active!: ' || v_room_name
    );
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
  ELSIF TG_OP = 'UPDATE' AND OLD.is_joined != NEW.is_joined THEN
    IF NEW.is_joined THEN
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
  AFTER INSERT OR UPDATE OF is_joined ON game_players
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

-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid not null default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  created_at timestamp with time zone not null default now(),
  body text not null
);

-- Create friend_status enum type
DO $$ BEGIN
  CREATE TYPE friend_status AS ENUM ('pending', 'accepted', 'blocked', 'removed', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create game_invite status enum type
DO $$ BEGIN
  CREATE TYPE game_invite_status AS ENUM ('pending', 'accepted', 'declined', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create friends table
CREATE TABLE IF NOT EXISTS public.friends (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  friend_id uuid references auth.users(id) on delete cascade not null,
  status friend_status default 'accepted' not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, friend_id)
);

-- Set up RLS for friends
ALTER TABLE public.friends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own friends"
  ON public.friends FOR SELECT
  USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Users can add friends"
  ON public.friends FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own friend relationships"
  ON public.friends FOR UPDATE
  USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Users can delete their own friend relationships"
  ON public.friends FOR DELETE
  USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- Create friend_invites table
CREATE TABLE IF NOT EXISTS public.friend_invites (
  id uuid default gen_random_uuid() primary key,
  sender_id uuid references auth.users(id) on delete cascade not null,
  receiver_id uuid references auth.users(id) on delete cascade not null,
  status friend_status default 'pending' not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(sender_id, receiver_id)
);

-- Set up RLS for friend_invites
ALTER TABLE public.friend_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own friend invites"
  ON public.friend_invites FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can send friend invites"
  ON public.friend_invites FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can update their own friend invites"
  ON public.friend_invites FOR UPDATE
  USING (auth.uid() = receiver_id);

CREATE POLICY "Users can delete their own friend invites"
  ON public.friend_invites FOR DELETE
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Add triggers for updated_at
CREATE TRIGGER update_friends_updated_at
  BEFORE UPDATE ON public.friends
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_friend_invites_updated_at
  BEFORE UPDATE ON public.friend_invites
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.friends;
ALTER PUBLICATION supabase_realtime ADD TABLE public.friend_invites;

-- Function to send a friend invite
CREATE OR REPLACE FUNCTION send_friend_invite(p_receiver_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_invite_id UUID;
BEGIN
  -- Check if already friends
  IF EXISTS (
    SELECT 1 FROM friends
    WHERE (user_id = auth.uid() AND friend_id = p_receiver_id)
    OR (user_id = p_receiver_id AND friend_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'Already friends with this user';
  END IF;

  -- Check if invite already exists
  SELECT id INTO v_invite_id
  FROM friend_invites
  WHERE sender_id = auth.uid() AND receiver_id = p_receiver_id;

  -- If invite exists, update its status to pending
  IF v_invite_id IS NOT NULL THEN
    UPDATE friend_invites 
    SET status = 'pending', updated_at = NOW()
    WHERE id = v_invite_id;
  ELSE
    -- Create new invite if none exists
    INSERT INTO friend_invites (
      sender_id,
      receiver_id,
      status
    ) VALUES (
      auth.uid(),
      p_receiver_id,
      'pending'
    ) RETURNING id INTO v_invite_id;
  END IF;

  -- Create notification for receiver
  INSERT INTO notifications (
    user_id,
    body
  ) VALUES (
    p_receiver_id,
    'You have a new friend request'
  );

  RETURN v_invite_id;
END;
$$;

-- Function to accept a friend invite
CREATE OR REPLACE FUNCTION accept_friend_invite(p_invite_id UUID)
RETURNS void AS $$
DECLARE
  v_sender_id UUID;
  v_receiver_id UUID;
BEGIN
  -- Get the invite details
  SELECT sender_id, receiver_id INTO v_sender_id, v_receiver_id
  FROM friend_invites
  WHERE id = p_invite_id
  AND receiver_id = auth.uid()
  AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid invite or not authorized';
  END IF;

  -- Update the invite status
  UPDATE friend_invites
  SET status = 'accepted', updated_at = now()
  WHERE id = p_invite_id;

  -- Create friend relationship (bidirectional)
  INSERT INTO friends (user_id, friend_id, status)
  VALUES 
    (v_sender_id, v_receiver_id, 'accepted'),
    (v_receiver_id, v_sender_id, 'accepted');

  -- Create notification for sender
  INSERT INTO notifications (
    user_id,
    body
  ) VALUES (
    v_sender_id,
    'Your friend request was accepted'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to reject a friend invite
CREATE OR REPLACE FUNCTION reject_friend_invite(p_invite_id UUID)
RETURNS void AS $$
DECLARE
  v_sender_id UUID;
BEGIN
  -- Get the sender ID
  SELECT sender_id INTO v_sender_id
  FROM friend_invites
  WHERE id = p_invite_id
  AND receiver_id = auth.uid()
  AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid invite or not authorized';
  END IF;

  -- Change the status to rejected
  UPDATE friend_invites
  SET status = 'rejected'
  WHERE id = p_invite_id;

  -- Create notification for sender
  INSERT INTO notifications (
    user_id,
    body
  ) VALUES (
    v_sender_id,
    'Your friend request was rejected'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to remove a friend
CREATE OR REPLACE FUNCTION remove_friend(p_friend_id UUID)
RETURNS void AS $$
BEGIN
  -- Check if friend exists
  IF NOT EXISTS (
    SELECT 1 FROM friends
    WHERE (user_id = auth.uid() AND friend_id = p_friend_id)
    OR (user_id = p_friend_id AND friend_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'Friend does not exist';
  END IF;
  
  -- Check if the friend is already removed
  IF EXISTS (
    SELECT 1 FROM friends
    WHERE (user_id = auth.uid() AND friend_id = p_friend_id)
    OR (user_id = p_friend_id AND friend_id = auth.uid())
    AND status = 'removed'
  ) THEN
    RAISE EXCEPTION 'Friend is already removed';
  END IF;

  -- Change the friend status to removed
  UPDATE friends
  SET status = 'removed'
  WHERE (user_id = auth.uid() AND friend_id = p_friend_id)
  OR (user_id = p_friend_id AND friend_id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to block a user
CREATE OR REPLACE FUNCTION block_user(p_user_id UUID)
RETURNS void AS $$
BEGIN
  -- Delete any existing friend relationships
  DELETE FROM friends
  WHERE (user_id = auth.uid() AND friend_id = p_user_id)
  OR (user_id = p_user_id AND friend_id = auth.uid());

  -- Delete any existing friend invites
  DELETE FROM friend_invites
  WHERE (sender_id = auth.uid() AND receiver_id = p_user_id)
  OR (sender_id = p_user_id AND receiver_id = auth.uid());

  -- Create blocked relationship (bidirectional)
  INSERT INTO friends (user_id, friend_id, status)
  VALUES 
    (auth.uid(), p_user_id, 'blocked'),
    (p_user_id, auth.uid(), 'blocked');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to unblock a user
CREATE OR REPLACE FUNCTION unblock_user(p_user_id UUID)
RETURNS void AS $$
BEGIN
  -- Delete the blocked relationship (bidirectional)
  DELETE FROM friends
  WHERE (user_id = auth.uid() AND friend_id = p_user_id)
  OR (user_id = p_user_id AND friend_id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update room settings
CREATE OR REPLACE FUNCTION update_room_settings(p_room_id UUID, p_value TEXT)
RETURNS TEXT AS $$
DECLARE
  v_current_step INT;
  v_current_status game_status;
  v_next_status game_status;
BEGIN
  -- Get current settings step and status
   SELECT settings_step, status INTO v_current_step, v_current_status
  FROM game_rooms
  WHERE id = p_room_id;

  -- if the status is not settings, raise an exception
  IF v_current_status != 'settings' THEN
    RAISE EXCEPTION 'Room settings can only be updated during setup';
    RETURN 'Room settings can only be updated during setup';
  END IF;

    -- Verify user is room creator
  IF NOT EXISTS (
    SELECT 1 FROM game_rooms
    WHERE id = p_room_id
    AND created_by = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Only room creator can update settings';
    RETURN 'Only room creator can update settings';
  END IF;


  -- Determine what to do based on the current step
  CASE v_current_step
    WHEN 1 THEN
      -- update the table model
      -- and set the settings step to 2
      UPDATE game_rooms
      SET table_model = p_value, settings_step = 2
      WHERE id = p_room_id;
      RETURN 'Table model updated';
    WHEN 2 THEN
      -- set the settings step to 3
      UPDATE game_rooms
      SET settings_step = 3
      WHERE id = p_room_id;
      RETURN 'Room name updated';
    WHEN 3 THEN
      -- set the status to waiting
      -- set the settings step to -1
      UPDATE game_rooms
      SET status = 'waiting', settings_step = -1
      WHERE id = p_room_id;
      RETURN 'Room settings complete';
    ELSE
      RAISE EXCEPTION 'Invalid step';
      RETURN 'Invalid step';
  END CASE;
      
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create game_invites table
CREATE TABLE IF NOT EXISTS public.game_invites (
  id uuid default gen_random_uuid() primary key,
  game_id uuid references public.game_rooms(id) on delete cascade,
  sender_id uuid references auth.users(id) on delete cascade,
  receiver_id uuid references auth.users(id) on delete cascade,
  status game_invite_status default 'pending' not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(game_id, receiver_id)
);

-- Set up RLS for game_invites
ALTER TABLE public.game_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own game invites"
  ON public.game_invites FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can send game invites"
  ON public.game_invites FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can update their received game invites"
  ON public.game_invites FOR UPDATE
  USING (auth.uid() = receiver_id);

-- Add trigger for updated_at
CREATE TRIGGER update_game_invites_updated_at
  BEFORE UPDATE ON public.game_invites
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_invites;

-- Function to send a game invite
CREATE OR REPLACE FUNCTION send_game_invite(p_game_id UUID, p_receiver_id UUID)
RETURNS UUID AS $$
DECLARE
  v_invite_id UUID;
  v_status game_invite_status;
BEGIN
  -- Check if user is in the game
  IF NOT EXISTS (
    SELECT 1 FROM game_rooms
    WHERE id = p_game_id
    AND created_by = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Only room creator can send invites';
  END IF;

  -- Check if invite already exists for this game and receiver
  IF EXISTS (
    SELECT 1 FROM game_invites
    WHERE game_id = p_game_id
    AND receiver_id = p_receiver_id
  ) THEN
    -- get the status of the invite
    SELECT status INTO v_status
    FROM game_invites
    WHERE game_id = p_game_id
    AND receiver_id = p_receiver_id;

    -- if the status is pending, raise an exception
    IF v_status = 'pending' THEN
      RAISE EXCEPTION 'Invite already sent to this user';
    END IF;
    -- if the status is declined, change it to pending
    IF v_status = 'declined' THEN
      UPDATE game_invites
      SET status = 'pending'
      WHERE game_id = p_game_id
      AND receiver_id = p_receiver_id;
    END IF;
    -- if the status is cancelled, raise an exception
    IF v_status = 'cancelled' THEN
      RAISE EXCEPTION 'Game has already started, cannot send invite';
    END IF;
  ELSE
    -- Create the invite
    INSERT INTO game_invites (
      game_id,
      sender_id,
      receiver_id
    ) VALUES (
      p_game_id,
      auth.uid(),
      p_receiver_id
    ) RETURNING id INTO v_invite_id;

    -- Create notification for receiver
    INSERT INTO notifications (
      user_id,
      body
    ) VALUES (
      p_receiver_id,
      'You have been invited to join a game'
    );
  END IF;

  RETURN v_invite_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to respond to a game invite
CREATE OR REPLACE FUNCTION respond_to_game_invite(p_invite_id UUID, p_accept BOOLEAN)
RETURNS void AS $$
DECLARE
  v_game_id UUID;
  v_sender_id UUID;
BEGIN
  -- Get the invite details
  SELECT game_id, sender_id INTO v_game_id, v_sender_id
  FROM game_invites
  WHERE id = p_invite_id
  AND receiver_id = auth.uid()
  AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid invite or not authorized';
  END IF;

  -- Update the invite status
  UPDATE game_invites
  SET status = CASE WHEN p_accept THEN 'accepted' ELSE 'declined' END
  WHERE id = p_invite_id;

  -- If accepted, join the game
  IF p_accept THEN
    PERFORM join_game(v_game_id, (SELECT invite_code FROM game_rooms WHERE id = v_game_id));
  END IF;

  -- Create notification for sender
  INSERT INTO notifications (
    user_id,
    body
  ) VALUES (
    v_sender_id,
    CASE WHEN p_accept 
      THEN 'Your game invite was accepted'
      ELSE 'Your game invite was declined'
    END
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to add a bot player to a game
CREATE OR REPLACE FUNCTION add_bot_player(p_game_id UUID, p_difficulty bot_difficulty DEFAULT 'medium')
RETURNS UUID AS $$
DECLARE
  v_bot_user_id UUID;
  v_player_id UUID;
  v_bot_player_id UUID;
  v_next_order INT;
BEGIN
  -- Verify user is room creator
  IF NOT EXISTS (
    SELECT 1 FROM game_rooms
    WHERE id = p_game_id
    AND created_by = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Only room creator can add bot players';
  END IF;

  -- Verify room is in settings or waiting state
  IF NOT EXISTS (
    SELECT 1 FROM game_rooms
    WHERE id = p_game_id
    AND (status = 'settings' OR status = 'waiting')
  ) THEN
    RAISE EXCEPTION 'Can only add bot players during setup or waiting state';
  END IF;

  -- Verify room is not full
  IF EXISTS (
    SELECT 1 FROM game_rooms
    WHERE id = p_game_id
    AND current_players >= max_players
  ) THEN
    RAISE EXCEPTION 'Room is full';
  END IF;

  -- Generate a UUID for the bot user
  v_bot_user_id := gen_random_uuid();

  -- Create a bot user
  INSERT INTO auth.users (
    id,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    role
  ) VALUES (
    v_bot_user_id,
    'bot_' || v_bot_user_id || '@bot.farkle.com',
    crypt(gen_random_uuid()::text, gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"is_bot": true}',
    false,
    'authenticated'
  );

  -- Note: Profile is automatically created by the handle_new_user() trigger
  -- Update the auto-created profile with bot-specific settings
  UPDATE profiles 
  SET 
    username = 'Bot_' || substr(v_bot_user_id::text, 1, 4),
    avatar_name = 'default'
  WHERE id = v_bot_user_id;

  -- Get next player order
  SELECT COALESCE(MAX(player_order), 0) + 1
  INTO v_next_order
  FROM game_players
  WHERE game_id = p_game_id;

  -- Add bot as player
  INSERT INTO game_players (
    game_id,
    user_id,
    player_order,
    score,
    is_active,
    is_joined
  ) VALUES (
    p_game_id,
    v_bot_user_id,
    v_next_order,
    0,
    true,
    true
  ) RETURNING id INTO v_player_id;

  -- Create bot player record
  INSERT INTO bot_players (
    game_id,
    player_id,
    difficulty
  ) VALUES (
    p_game_id,
    v_player_id,
    p_difficulty
  ) RETURNING id INTO v_bot_player_id;

  RETURN v_bot_player_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Calculate all possible scoring combinations from a roll
CREATE OR REPLACE FUNCTION score_options(p_dice INTEGER[])
RETURNS TABLE(kept_dice INTEGER[], score INTEGER) AS $$
DECLARE
  i INTEGER;
  j INTEGER;
  k INTEGER;
  temp_dice INTEGER[];
  temp_result turn_score_result;
BEGIN
  -- First check the full set of dice
  temp_result := calculate_turn_score(p_dice);
  IF temp_result.score > 0 THEN
    RETURN QUERY SELECT temp_result.valid_dice, temp_result.score;
  END IF;
  
  -- Check all possible subsets of the dice
  -- This is a simplified approach - a full implementation would check all combinations
  FOR i IN 1..array_length(p_dice, 1) LOOP
    temp_dice := ARRAY[p_dice[i]];
    temp_result := calculate_turn_score(temp_dice);
    IF temp_result.score > 0 THEN
      RETURN QUERY SELECT temp_result.valid_dice, temp_result.score;
    END IF;
  END LOOP;
  
  -- Return empty set if no scoring options
  RETURN;
END;
$$ LANGUAGE plpgsql;

-- Calculate probability of rolling a farkle with given number of dice
CREATE OR REPLACE FUNCTION farkle_probability(p_remaining_dice INTEGER)
RETURNS NUMERIC AS $$
BEGIN
  -- Simplified probabilities based on dice count
  RETURN CASE
    WHEN p_remaining_dice = 1 THEN 0.667  -- 4/6 chance (2,3,4,6 don't score)
    WHEN p_remaining_dice = 2 THEN 0.444  -- ~4/9 chance
    WHEN p_remaining_dice = 3 THEN 0.278  -- ~1/4 chance
    WHEN p_remaining_dice = 4 THEN 0.167  -- ~1/6 chance
    WHEN p_remaining_dice = 5 THEN 0.089  -- ~1/12 chance
    WHEN p_remaining_dice = 6 THEN 0.021  -- ~1/48 chance
    ELSE 1.0  -- Default to 100% if invalid input
  END;
END;
$$ LANGUAGE plpgsql;

-- Decide if bot should bank based on current score and risk
CREATE OR REPLACE FUNCTION should_bank(p_turn_score INTEGER, p_remaining_dice INTEGER, p_risk_limit INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
  v_farkle_probability NUMERIC;
BEGIN
  -- Bot will bank if it has reached its target score for the turn
  
  -- Calculate farkle probability
  v_farkle_probability := farkle_probability(p_remaining_dice);
  
  -- Higher-scoring turns make the bot more conservative
  IF p_turn_score > 500 AND v_farkle_probability > 0.2 THEN
    RETURN TRUE;
  END IF;
  
  -- Very high risk of farkle will cause banking
  IF v_farkle_probability > 0.5 THEN
    RETURN TRUE;
  END IF;
  
  -- Default: continue rolling
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Get risk limit based on bot difficulty
CREATE OR REPLACE FUNCTION get_bot_risk_limit(p_difficulty bot_difficulty)
RETURNS INTEGER AS $$
BEGIN
  RETURN CASE
    WHEN p_difficulty = 'easy' THEN 200     -- Banks early, very conservative
    WHEN p_difficulty = 'medium' THEN 350   -- Reasonable balance
    WHEN p_difficulty = 'hard' THEN 550     -- Pushes for high scores, more aggressive
    ELSE 350                                -- Default to medium
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Main function to handle bot's turn
CREATE OR REPLACE FUNCTION bot_play_turn(p_game_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_current_player_id UUID;
  v_current_turn_id UUID;
  v_bot_player_id UUID;
  v_current_turn game_turns;
  v_latest_action turn_actions;
  v_bot_decision JSONB;
  v_roll_score INTEGER;
  v_selected_dice INTEGER[];
  c_selected_dice INTEGER[];
BEGIN
  -- get the current_player from the game_states table
  SELECT current_player_id, current_turn INTO v_current_player_id, v_current_turn_id
  FROM game_states
  WHERE game_id = p_game_id;

  -- get the bot_player.player_id from the bot_players table
  SELECT player_id INTO v_bot_player_id
  FROM bot_players
  WHERE game_id = p_game_id AND player_id = v_current_player_id;

  -- Only proceed if we found a bot player
  IF v_bot_player_id IS NOT NULL THEN
    -- get the game_turn from the game_turns table
    SELECT * INTO v_current_turn
    FROM game_turns
    WHERE id = v_current_turn_id;

    -- get the latest turn_action from the turn_actions table
    SELECT * INTO v_latest_action
    FROM turn_actions
    WHERE turn_id = v_current_turn_id
    ORDER BY action_number DESC
    LIMIT 1;

    -- Check if we found a turn action
    IF v_latest_action.id IS NOT NULL THEN
      -- if v_latest_action.score is > 0, we need to make a decision
      IF v_latest_action.score > 0 THEN
        -- Calculate total turn score so far
        SELECT COALESCE(SUM(score), 0) INTO v_roll_score
        FROM turn_actions
        WHERE turn_id = v_current_turn_id
        AND outcome IS NOT NULL;
      
        
        IF v_latest_action.selected_dice IS NOT NULL THEN
          v_selected_dice := v_latest_action.selected_dice;
        ELSE
          v_selected_dice := ARRAY[]::INTEGER[];
        END IF;

        -- Get the bot's decision
        v_bot_decision := make_bot_decision(
          v_latest_action.dice_values,
          v_roll_score, -- total turn score so far
          (SELECT score FROM game_players WHERE id = v_current_player_id), -- player's total game score
          10000 -- target score
        );

        c_selected_dice := ARRAY(SELECT jsonb_array_elements_text(v_bot_decision->'selected_dice'))::INTEGER[];

        -- Debug check for dice selection values
        -- RETURN jsonb_build_object(
        --   'debug_check', true,
        --   'v_selected_dice', v_selected_dice,
        --   'v_selected_dice_length', array_length(v_selected_dice, 1),
        --   'v_latest_action_selected_dice', v_latest_action.selected_dice,
        --   'v_latest_action_selected_dice_length', array_length(v_latest_action.selected_dice, 1),
        --   'v_latest_action_selected_dice_type', pg_typeof(v_latest_action.selected_dice),
        --   'bot_decision_selected_dice', v_bot_decision->'selected_dice',
        --   'bot_decision_selected_dice_type', pg_typeof(v_bot_decision->'selected_dice'),
        --   'bot_decision_full', v_bot_decision,
        --   'turn_action_id', v_latest_action.id,
        --   'v_latest_action', v_latest_action,
        --   'c_selected_dice', c_selected_dice,
        --   'c_selected_dice_length', array_length(c_selected_dice, 1),
        --   'c_selected_dice_type', pg_typeof(c_selected_dice)
        -- );
        
        
        -- if v_selected_dice is an empty array and v_bot_decision->'selected_dice' is not empty array
        IF array_length(v_selected_dice, 1) IS NULL THEN
          IF array_length(c_selected_dice, 1) IS NOT NULL AND array_length(c_selected_dice, 1) > 0 THEN
            -- Select the dice first, then return the decision
         
            PERFORM select_dice(v_latest_action.id, c_selected_dice);
            RETURN jsonb_build_object(
              'status', 'success',
              'message', 'Bot selected dice #1',
              'action', 'select',
              'selected_dice', v_selected_dice,
              'turn_id', v_current_turn_id,
              'c_selected_dice', c_selected_dice,
              'v_latest_action', v_latest_action,
              'decision', v_bot_decision
            );
            
          END IF;
 
        END IF;

  

        -- Execute the decision using CASE statement (switch-like behavior)
        CASE (v_bot_decision->>'action')
          WHEN 'bank' THEN
            -- Select the dice first, then bank
            PERFORM process_turn_action(p_game_id, 'bank');
            
          WHEN 'continue' THEN
            -- Select the dice first, then continue
            -- IF array_length(v_selected_dice, 1) > 0 THEN
            --   PERFORM select_dice(v_latest_action.id, v_selected_dice);
            --   RETURN jsonb_build_object(
            --     'status', 'success',
            --     'message', 'Bot selected dice #2',
            --     'action', 'select',
            --     'selected_dice', v_selected_dice,
            --     'turn_id', v_current_turn_id,
            --     'decision', v_bot_decision
            --   );
            -- END IF;
            PERFORM process_turn_action(p_game_id, 'continue');
            
          ELSE
            -- Bust case (default)
            PERFORM process_turn_action(p_game_id, 'bust');
        END CASE;

        RETURN jsonb_build_object(
          'status', 'success',
          'message', 'Bot decision executed after case statement',
          'action', v_bot_decision->>'action',
          'v_selected_dice', array_length(v_selected_dice, 1),
          'c_selected_dice', array_length(c_selected_dice, 1),
          'selected_dice', v_selected_dice,
          'reasoning', v_bot_decision->>'reasoning',
          'turn_id', v_current_turn_id,
          'decision', v_bot_decision,
          'v_latest_action', v_latest_action
        );

      ELSE
        -- No scoring dice, must bust
        PERFORM process_turn_action(p_game_id, 'bust');
        RETURN jsonb_build_object(
          'status', 'success',
          'message', 'Bot busted - no scoring dice',
          'action', 'bust',
          'turn_id', v_current_turn_id
        );
      END IF;
    ELSE
      -- No turn action yet, perform initial roll
      PERFORM perform_roll(p_game_id, 6);
      RETURN jsonb_build_object(
        'status', 'success',
        'message', 'Bot performed initial roll',
        'action', 'roll',
        'turn_id', v_current_turn_id
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'status', 'no_action',
    'message', 'Current player is not a bot',
    'current_player_id', v_current_player_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger function to automatically play bot turns
-- CREATE OR REPLACE FUNCTION handle_bot_turns()
-- RETURNS TRIGGER AS $$
-- DECLARE
--   v_bot_id UUID;
--   v_bot_difficulty bot_difficulty;
--   v_risk_limit INTEGER;
--   v_bot_user_id UUID;
-- BEGIN
--   -- Check if the current player is a bot
--   SELECT bp.player_id, bp.difficulty, gp.user_id 
--   INTO v_bot_id, v_bot_difficulty, v_bot_user_id
--   FROM bot_players bp
--   JOIN game_players gp ON bp.player_id = gp.id
--   WHERE gp.id = NEW.current_player_id;
  
--   -- If it's a bot's turn, play automatically
--   IF v_bot_id IS NOT NULL THEN
--     -- Get risk limit based on difficulty
--     v_risk_limit := get_bot_risk_limit(v_bot_difficulty);
    
--     -- Slight delay to make it feel more natural
--     PERFORM pg_sleep(1);
    
--     -- Execute the bot's turn
--     PERFORM bot_play_turn(NEW.game_id, v_bot_user_id, v_risk_limit);
--   END IF;
  
--   RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql;

-- Create trigger to automatically play bot turns
-- CREATE TRIGGER bot_turn_trigger
--   AFTER UPDATE OF current_player_id ON game_states
--   FOR EACH ROW
--   EXECUTE FUNCTION handle_bot_turns(); 

-- Create function to play bot turns when called from pg_cron
CREATE OR REPLACE FUNCTION cron_play_bot_turns()
RETURNS void AS $$
DECLARE
  v_bot_player bot_players;
  v_game_state game_states;
BEGIN
  -- Iterate through each bot player directly from the table
  FOR v_bot_player IN 
    SELECT * FROM bot_players
  LOOP
    -- get the game_states where the current_player_id is the bot_player.player_id
    SELECT * INTO v_game_state
    FROM game_states
    WHERE current_player_id = v_bot_player.player_id;

    -- if the v_game_state.game_id is not NULL
    -- play the turn
    IF v_game_state.game_id IS NOT NULL THEN
      PERFORM bot_play_turn(v_game_state.game_id);
      RETURN;
    END IF;
  END LOOP;

  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule the bot turns function to run every 10 seconds
-- SELECT cron.schedule(
--   'play-bot-turns',  -- job name
--   '*/10 * * * * *', -- schedule (every 10 seconds)
--   'SELECT cron_play_bot_turns();'  -- command
-- );

-- Function to make bot decisions: which dice to keep and whether to bank
CREATE OR REPLACE FUNCTION make_bot_decision(
  p_dice_values INTEGER[],
  p_current_turn_score INTEGER,
  p_player_total_score INTEGER DEFAULT 0,
  p_target_score INTEGER DEFAULT 10000
) RETURNS JSONB AS $$
DECLARE
  v_scoring_options RECORD;
  v_best_score INTEGER := 0;
  v_best_remaining_dice INTEGER := 0;
  v_best_indices INTEGER[] := ARRAY[]::INTEGER[];
  v_best_expected_value NUMERIC := 0;
  v_risk_limit INTEGER;
  v_farkle_prob NUMERIC;
  v_expected_value NUMERIC;
  v_should_bank BOOLEAN := FALSE;
  v_selected_indices INTEGER[] := ARRAY[]::INTEGER[];
  v_temp_dice INTEGER[];
  v_temp_result turn_score_result;
  v_dice_counts INTEGER[6];
  v_has_straight BOOLEAN := FALSE;
  v_has_three_pairs BOOLEAN := FALSE;
  i INTEGER;
  j INTEGER;
BEGIN
  -- Get risk limit based on difficulty
  -- v_risk_limit := get_bot_risk_limit(p_difficulty);
  v_risk_limit := 350;
  
  -- Initialize dice counts for analysis
  v_dice_counts := array_fill(0, array[6]);
  FOR i IN 1..array_length(p_dice_values, 1) LOOP
    v_dice_counts[p_dice_values[i]] := v_dice_counts[p_dice_values[i]] + 1;
  END LOOP;

  -- Check for special combinations (straight, three pairs)
  -- Straight check (1-6)
  IF array_length(p_dice_values, 1) = 6 THEN
    v_has_straight := TRUE;
    FOR i IN 1..6 LOOP
      IF v_dice_counts[i] != 1 THEN
        v_has_straight := FALSE;
        EXIT;
      END IF;
    END LOOP;
    
    -- Three pairs check
    IF NOT v_has_straight THEN
      j := 0;
      FOR i IN 1..6 LOOP
        IF v_dice_counts[i] = 2 THEN
          j := j + 1;
        END IF;
      END LOOP;
      v_has_three_pairs := (j = 3);
    END IF;
  END IF;

  -- If we have special combinations, take them
  IF v_has_straight OR v_has_three_pairs THEN
    FOR i IN 1..array_length(p_dice_values, 1) LOOP
      v_selected_indices := array_append(v_selected_indices, i - 1);
    END LOOP;
    
    v_temp_result := calculate_turn_score(p_dice_values);

    RETURN jsonb_build_object(
      'action', 'continue',
      'selected_dice', v_selected_indices,
      'dice_to_keep', v_selected_indices,
      'v_temp_result', v_temp_result,
      'v_dice_counts', v_dice_counts,
      'v_has_straight', v_has_straight,
      'v_has_three_pairs', v_has_three_pairs,
      'expected_score', v_temp_result.score,
      'reasoning', CASE WHEN v_has_straight THEN 'Taking straight (1000 pts)' ELSE 'Taking three pairs (750 pts)' END
    );
  END IF;

  -- Strategy 1: Identify all possible scoring combinations and their values
  -- Best option tracking is now using individual variables

  -- Strategy: Prefer keeping minimal scoring dice to maximize future rolls
  -- Priority order: Groups of 3+ > Individual 1s > Individual 5s

  -- Check for groups of 3 or more (highest priority)
  FOR i IN 1..6 LOOP
    IF v_dice_counts[i] >= 3 THEN
      -- Keep the group of 3 (or more)
      v_selected_indices := ARRAY[]::INTEGER[];
      FOR j IN 1..array_length(p_dice_values, 1) LOOP
        IF p_dice_values[j] = i AND array_length(v_selected_indices, 1) < v_dice_counts[i] THEN
          v_selected_indices := array_append(v_selected_indices, j - 1);
        END IF;
      END LOOP;
      
      -- Calculate score for this group
      v_temp_dice := ARRAY[]::INTEGER[];
      FOR j IN 1..v_dice_counts[i] LOOP
        v_temp_dice := array_append(v_temp_dice, i);
      END LOOP;
      v_temp_result := calculate_turn_score(v_temp_dice);
      
      -- Calculate expected value (score / dice used ratio)
      v_expected_value := v_temp_result.score::NUMERIC / v_dice_counts[i];
      
      IF v_temp_result.score > v_best_score OR 
         (v_temp_result.score = v_best_score AND v_expected_value > v_best_expected_value) THEN
        v_best_score := v_temp_result.score;
        v_best_remaining_dice := array_length(p_dice_values, 1) - v_dice_counts[i];
        v_best_indices := v_selected_indices;
        v_best_expected_value := v_expected_value;
      END IF;
    END IF;
  END LOOP;

  -- If no groups of 3+, consider individual 1s and 5s
  IF v_best_score = 0 THEN
    -- Strategy: Take minimum scoring dice
    -- Prefer single 1s over 5s (better point ratio)
    IF v_dice_counts[1] > 0 THEN
      -- Take only one 1 if possible, unless we have many
      FOR j IN 1..array_length(p_dice_values, 1) LOOP
        IF p_dice_values[j] = 1 THEN
          v_selected_indices := array_append(v_selected_indices, j - 1);
          -- Take additional 1s if we have 3+ dice remaining and low turn score
          IF array_length(p_dice_values, 1) > 3 AND p_current_turn_score < 300 AND v_dice_counts[1] > 1 THEN
            CONTINUE;
          ELSE
            EXIT;
          END IF;
        END IF;
      END LOOP;
      
      v_best_score := array_length(v_selected_indices, 1) * 100;
      v_best_remaining_dice := array_length(p_dice_values, 1) - array_length(v_selected_indices, 1);
      v_best_indices := v_selected_indices;
    ELSIF v_dice_counts[5] > 0 THEN
      -- Take one 5 if no 1s available
      FOR j IN 1..array_length(p_dice_values, 1) LOOP
        IF p_dice_values[j] = 5 THEN
          v_selected_indices := array_append(v_selected_indices, j - 1);
          EXIT; -- Only take one 5
        END IF;
      END LOOP;
      
      v_best_score := 50;
      v_best_remaining_dice := array_length(p_dice_values, 1) - 1;
      v_best_indices := v_selected_indices;
    END IF;
  END IF;

  -- If no scoring dice found, must bust
  IF v_best_score = 0 THEN
    RETURN jsonb_build_object(
      'action', 'bust',
      'dice_to_keep', ARRAY[]::INTEGER[],
      'reasoning', 'No scoring combinations available'
    );
  END IF;

  -- Banking decision logic
  v_farkle_prob := farkle_probability(v_best_remaining_dice);
  
  -- Banking conditions based on difficulty and game state:
  -- 1. High turn score with high farkle risk
  -- 2. Close to winning
  -- 3. Conservative play based on difficulty
  
  -- Condition 1: Risk vs Reward analysis
  IF (p_current_turn_score + v_best_score) >= v_risk_limit AND v_farkle_prob > 0.3 THEN
    v_should_bank := TRUE;
  END IF;
  
  -- Condition 2: Close to winning (within 500 points)
  IF (p_player_total_score + p_current_turn_score + v_best_score) >= (p_target_score - 500) THEN
    v_should_bank := TRUE;
  END IF;
  
  -- Condition 3: Very high farkle risk
  IF v_farkle_prob > 0.6 THEN
    v_should_bank := TRUE;
  END IF;
  
  -- Condition 4: Excellent turn, don't get greedy
  IF (p_current_turn_score + v_best_score) > 800 AND v_farkle_prob > 0.25 THEN
    v_should_bank := TRUE;
  END IF;

  -- Condition 5: Only 1 die remaining with decent score
  IF v_best_remaining_dice = 1 AND (p_current_turn_score + v_best_score) >= 250 THEN
    v_should_bank := TRUE;
  END IF;

  -- Return decision without executing any actions
  IF v_should_bank THEN
      RETURN jsonb_build_object(
    'action', 'bank',
    'selected_dice', v_best_indices,
    'dice_to_keep', v_best_indices,
    'expected_score', v_best_score,
    'total_turn_score', p_current_turn_score + v_best_score,
    'farkle_probability', v_farkle_prob,
    'v_temp_result', v_temp_result,
    'reasoning', format('Banking with %s points (%s%% farkle risk)', 
                       p_current_turn_score + v_best_score, 
                       round(v_farkle_prob * 100, 1))
  );
  ELSE
    -- Use the strategically calculated v_best_indices instead of overriding with all valid dice
    -- The v_best_indices was already calculated based on optimal strategy above
    RETURN jsonb_build_object(
      'action', 'continue',
      'p_dice_values', p_dice_values,
      'selected_dice', v_best_indices,
      'dice_to_keep', v_best_indices,
      'expected_score', v_best_score,
      'remaining_dice', v_best_remaining_dice,
      'farkle_probability', v_farkle_prob,
      'reasoning', format('Continuing with %s dice (%s%% farkle risk)', 
                         v_best_remaining_dice, 
                         round(v_farkle_prob * 100, 1))
    );
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Test function for bot decision making
CREATE OR REPLACE FUNCTION test_bot_decisions()
RETURNS JSONB AS $$
DECLARE
  test_results JSONB := '{}'::JSONB;
  result JSONB;
  test_cases JSONB[];
  test_case JSONB;
  i INTEGER;
BEGIN
  -- Define test cases with inputs
  test_cases := ARRAY[
    '{"name": "three_of_a_kind", "dice": [3,3,3,1,2,6], "turn_score": 0, "player_score": 1000, "description": "Three 3s with mixed dice"}'::JSONB,
    '{"name": "single_ones_and_fives", "dice": [1,1,5,2,4,6], "turn_score": 0, "player_score": 2000, "description": "Two 1s and one 5 available"}'::JSONB,
    '{"name": "straight_combo", "dice": [1,2,3,4,5,6], "turn_score": 0, "player_score": 3000, "description": "Perfect straight 1-6"}'::JSONB,
    '{"name": "three_pairs", "dice": [2,2,4,4,6,6], "turn_score": 0, "player_score": 4000, "description": "Three pairs combination"}'::JSONB,
    '{"name": "high_risk_continue", "dice": [1,3], "turn_score": 400, "player_score": 5000, "description": "High turn score with risky continue"}'::JSONB,
    '{"name": "conservative_bank", "dice": [5,2], "turn_score": 500, "player_score": 8000, "description": "Should bank with decent score"}'::JSONB,
    '{"name": "farkle_scenario", "dice": [2,3,4,6], "turn_score": 0, "player_score": 1500, "description": "No scoring dice available"}'::JSONB,
    '{"name": "four_of_a_kind", "dice": [1,1,1,1,2,4], "turn_score": 100, "player_score": 6000, "description": "Four 1s for big score"}'::JSONB,
    '{"name": "mixed_scoring_options", "dice": [1,5,5,5,2,3], "turn_score": 200, "player_score": 7000, "description": "Mix of 1s and three 5s"}'::JSONB,
    '{"name": "endgame_conservative", "dice": [1,6], "turn_score": 300, "player_score": 9500, "description": "Close to winning, be conservative"}'::JSONB
  ];

  -- Run each test case
  FOR i IN 1..array_length(test_cases, 1) LOOP
    test_case := test_cases[i];
    
    -- Call make_bot_decision with test case parameters
    result := make_bot_decision(
      ARRAY(SELECT jsonb_array_elements_text(test_case->'dice'))::INTEGER[],
      (test_case->>'turn_score')::INTEGER,
      (test_case->>'player_score')::INTEGER,
      10000
    );
    
    -- Add test result to output
    test_results := test_results || jsonb_build_object(
      test_case->>'name',
      jsonb_build_object(
        'description', test_case->>'description',
        'inputs', jsonb_build_object(
          'dice_values', test_case->'dice',
          'turn_score', test_case->'turn_score',
          'player_score', test_case->'player_score',
          'target_score', 10000
        ),
        'outputs', result,
        'dice_to_keep', result->'dice_to_keep',
        'action', result->>'action',
        'expected_score', result->'expected_score'
      )
    );
  END LOOP;

  RETURN test_results;
END;
$$ LANGUAGE plpgsql;

-- Test function for strategic scenarios
CREATE OR REPLACE FUNCTION test_bot_strategy_scenarios()
RETURNS SETOF text AS $$
DECLARE
  result JSONB;
  dice_selected INTEGER[];
BEGIN
  -- Strategic Test 1: Mixed scoring options - prefer efficiency
  -- Roll: [1,1,5,2,3,4] - should take both 1s for efficiency
  result := make_bot_decision(ARRAY[1,1,5,2,3,4], 0, 6, 1000, 10000);
  dice_selected := ARRAY(SELECT jsonb_array_elements_text(result->'selected_dice'))::INTEGER[];
  
  -- Should take optimal scoring dice
  ASSERT (result->>'action') = 'continue',
    format('Strategy Test 1 failed: Expected continue, got %s', result->>'action');
  
  -- Strategic Test 2: Risk assessment with medium score
  -- Turn score: 500, Roll: [1,6] with 2 dice remaining
  result := make_bot_decision(ARRAY[1,6], 500, 2, 3000, 10000);
  ASSERT (result->>'action') = 'bank',
    format('Strategy Test 2 failed: Should bank with moderate risk, got %s', result->>'action');
  
  -- Strategic Test 3: Aggressive play when behind
  -- Player far behind, should take more risks
  result := make_bot_decision(ARRAY[5,3], 250, 2, 2000, 10000);
  -- Should continue with low farkle risk despite moderate score
  ASSERT (result->>'action') = 'continue',
    format('Strategy Test 3 failed: Should be aggressive when behind, got %s', result->>'action');
  
  -- Strategic Test 4: Conservative play when ahead
  -- Player ahead, should be more conservative
  result := make_bot_decision(ARRAY[1,2], 400, 2, 8000, 10000);
  ASSERT (result->>'action') = 'bank',
    format('Strategy Test 4 failed: Should be conservative when ahead, got %s', result->>'action');
  
  RETURN NEXT 'All strategic scenario tests passed!';
END;
$$ LANGUAGE plpgsql;

-- Function to run all bot tests
CREATE OR REPLACE FUNCTION run_bot_tests()
RETURNS SETOF text AS $$
BEGIN
  RETURN QUERY SELECT * FROM test_bot_decisions();
  RETURN QUERY SELECT * FROM test_bot_strategy_scenarios();
  RETURN NEXT 'All bot tests completed successfully!';
END;
$$ LANGUAGE plpgsql;

-- Create avatars storage bucket (only if it doesn't exist)
INSERT INTO storage.buckets (id, name, public) 
SELECT 'avatars', 'avatars', true
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'avatars');

-- Set up RLS policies for avatars bucket
-- Note: The avatars bucket should be created manually in the Supabase dashboard if it doesn't exist

DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
CREATE POLICY "Avatar images are publicly accessible" ON storage.objects
FOR SELECT USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
CREATE POLICY "Users can upload their own avatar" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'avatars' 
  AND auth.uid() IS NOT NULL
);

DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
CREATE POLICY "Users can update their own avatar" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'avatars' 
  AND auth.uid() IS NOT NULL
);

DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;
CREATE POLICY "Users can delete their own avatar" ON storage.objects
FOR DELETE USING (
  bucket_id = 'avatars' 
  AND auth.uid() IS NOT NULL
); 