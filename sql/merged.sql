-- Start with core setup (types, extensions, common functions)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'game_status') THEN
    CREATE TYPE game_status AS ENUM ('waiting', 'in_progress', 'completed');
  END IF;
END $$;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create realtime subscriptions
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
  avatar_url text,
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

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;

-- Create game rooms table
CREATE TABLE IF NOT EXISTS public.game_rooms (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  created_by uuid references public.profiles(id),
  status game_status default 'waiting'::game_status not null,
  max_players int default 4,
  current_players int default 1,
  winner_id uuid references public.profiles(id),
  invite_code char(6) unique not null,
  ended_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

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

-- Create game states table
CREATE TABLE IF NOT EXISTS public.game_states (
  game_id uuid references public.game_rooms(id) on delete cascade primary key,
  current_turn_number int not null,
  current_player_id uuid references public.game_players(id) not null,
  last_updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  available_dice int default 6 not null,
  current_turn_score int default 0 not null,
  check (available_dice >= 0 and available_dice <= 6)
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

-- Create game turns and actions tables
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

-- Create all functions

-- Room management functions
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

CREATE OR REPLACE FUNCTION create_room(p_name TEXT)
RETURNS UUID AS $$
DECLARE
  v_room_id UUID;
  v_invite_code CHAR(6);
BEGIN
  SELECT generate_invite_code() INTO v_invite_code;
  
  INSERT INTO game_rooms (
    name,
    created_by,
    status,
    max_players,
    current_players,
    invite_code
  ) VALUES (
    p_name,
    auth.uid(),
    'waiting',
    4,
    1,
    v_invite_code
  ) RETURNING id INTO v_room_id;

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
  );

  RETURN v_room_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Player management functions
CREATE OR REPLACE FUNCTION join_game(room_id UUID, code char(6))
RETURNS game_players AS $$
DECLARE
  new_player game_players;
  next_order INTEGER;
  room_status game_status;
  room_players INTEGER;
  room_max_players INTEGER;
  valid_code char(6);
BEGIN
  SELECT status, current_players, max_players, invite_code
  INTO room_status, room_players, room_max_players, valid_code
  FROM game_rooms
  WHERE id = room_id;

  IF room_status != 'waiting' THEN
    RAISE EXCEPTION 'Game is not in waiting state';
  END IF;

  IF room_players >= room_max_players THEN
    RAISE EXCEPTION 'Game room is full';
  END IF;

  IF valid_code != code THEN
    RAISE EXCEPTION 'Invalid invite code';
  END IF;

  SELECT COALESCE(MAX(player_order), 0) + 1
  INTO next_order
  FROM game_players
  WHERE game_id = room_id;

  INSERT INTO game_players (
    game_id,
    user_id,
    player_order,
    is_active,
    score
  )
  VALUES (
    room_id,
    COALESCE(auth.uid(), gen_random_uuid()),
    next_order,
    true,
    0
  )
  RETURNING * INTO new_player;

  RETURN new_player;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION leave_game(room_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE game_players
  SET is_active = false
  WHERE game_id = room_id
  AND user_id = auth.uid();

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

-- Game state management functions
CREATE OR REPLACE FUNCTION start_game(room_id UUID)
RETURNS void AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM game_rooms
    WHERE id = room_id
    AND created_by = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Only room creator can start the game';
  END IF;

  UPDATE game_rooms
  SET status = 'in_progress'
  WHERE id = room_id
  AND status = 'waiting'
  AND current_players > 0;

  INSERT INTO game_states (
    game_id,
    current_turn_number,
    current_player_id,
    available_dice,
    current_turn_score
  )
  SELECT
    room_id,
    1,
    (SELECT id FROM game_players WHERE game_id = room_id AND player_order = 1),
    6,
    0
  WHERE NOT EXISTS (
    SELECT 1 FROM game_states WHERE game_id = room_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION advance_turn(room_id UUID)
RETURNS void AS $$
DECLARE
  next_player_id UUID;
BEGIN
  WITH current_player AS (
    SELECT player_order
    FROM game_players
    WHERE id = (
      SELECT current_player_id
      FROM game_states
      WHERE game_id = room_id
    )
  )
  SELECT id INTO next_player_id
  FROM game_players
  WHERE game_id = room_id
  AND is_active = true
  AND (
    CASE 
      WHEN player_order > (SELECT player_order FROM current_player)
        THEN player_order
      ELSE player_order + (
        SELECT MAX(player_order)
        FROM game_players
        WHERE game_id = room_id
      )
    END
  ) = (
    SELECT MIN(
      CASE 
        WHEN player_order > (SELECT player_order FROM current_player)
          THEN player_order
        ELSE player_order + (
          SELECT MAX(player_order)
          FROM game_players
          WHERE game_id = room_id
        )
      END
    )
    FROM game_players
    WHERE game_id = room_id
    AND is_active = true
  );

  UPDATE game_states
  SET
    current_player_id = next_player_id,
    current_turn_number = current_turn_number + 1,
    available_dice = 6,
    current_turn_score = 0,
    last_updated_at = now()
  WHERE game_id = room_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION end_game(p_game_id UUID)
RETURNS void AS $$
DECLARE
  v_winner_id UUID;
  v_winner_user_id UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM game_rooms
    WHERE id = p_game_id
    AND created_by = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Only room creator can end the game';
  END IF;

  SELECT id, user_id INTO v_winner_id, v_winner_user_id
  FROM game_players
  WHERE game_id = p_game_id
  ORDER BY score DESC
  LIMIT 1;

  UPDATE game_rooms
  SET 
    status = 'completed',
    ended_at = now(),
    winner_id = v_winner_user_id
  WHERE id = p_game_id
  AND status = 'in_progress';

  DELETE FROM game_states
  WHERE game_id = p_game_id;

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

  UPDATE game_players
  SET is_active = false
  WHERE game_id = p_game_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Game mechanics functions
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

CREATE OR REPLACE FUNCTION perform_roll(p_game_id UUID, p_num_dice INTEGER DEFAULT 6)
RETURNS INTEGER[] AS $$
DECLARE
  v_game_state game_states;
  v_player game_players;
  v_turn game_turns;
  v_roll_results INTEGER[];
BEGIN
  SELECT gs.* INTO v_game_state
  FROM game_states gs
  WHERE gs.game_id = p_game_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Game state not found';
  END IF;

  SELECT gp.* INTO v_player
  FROM game_players gp
  WHERE gp.id = v_game_state.current_player_id;

  IF v_player.user_id != auth.uid() THEN
    RAISE EXCEPTION 'Not your turn';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM game_rooms gr
    WHERE gr.id = p_game_id
    AND gr.status = 'in_progress'
  ) THEN
    RAISE EXCEPTION 'Game is not in progress';
  END IF;

  IF p_num_dice > v_game_state.available_dice THEN
    RAISE EXCEPTION 'Not enough dice available. Available: %', v_game_state.available_dice;
  END IF;

  SELECT gt.* INTO v_turn
  FROM game_turns gt
  WHERE gt.game_id = p_game_id
  AND gt.turn_number = v_game_state.current_turn_number;

  IF NOT FOUND THEN
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

  v_roll_results := roll_dice(p_num_dice);

  INSERT INTO turn_actions (
    turn_id,
    action_number,
    dice_values,
    created_at
  ) VALUES (
    v_turn.id,
    COALESCE((
      SELECT MAX(ta.action_number) + 1
      FROM turn_actions ta
      WHERE ta.turn_id = v_turn.id
    ), 1),
    v_roll_results,
    now()
  );

  UPDATE game_states gs
  SET available_dice = gs.available_dice - p_num_dice
  WHERE gs.game_id = p_game_id;

  RETURN v_roll_results;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION validate_dice_selection(
  roll INTEGER[],
  selection INTEGER[]
) RETURNS boolean AS $$
DECLARE
  valid boolean;
BEGIN
  SELECT bool_and(s = any(roll))
  INTO valid
  FROM unnest(selection) s;
  RETURN valid;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION calculate_turn_score(selected_dice INTEGER[])
RETURNS INTEGER AS $$
DECLARE
  score INTEGER := 0;
  dice_counts INTEGER[];
  i INTEGER;
BEGIN
  dice_counts := array_fill(0, array[6]);
  
  FOR i IN 1..array_length(selected_dice, 1) LOOP
    dice_counts[selected_dice[i]] := dice_counts[selected_dice[i]] + 1;
  END LOOP;
  
  score := score + (dice_counts[1] * 100);
  score := score + (dice_counts[5] * 50);
  
  FOR i IN 1..6 LOOP
    IF dice_counts[i] >= 3 THEN
      IF i = 1 THEN
        score := score + 1000;
      ELSE
        score := score + (i * 100);
      END IF;
      IF i = 1 THEN
        score := score - 300;
      ELSIF i = 5 THEN
        score := score - 150;
      END IF;
    END IF;
  END LOOP;
  
  RETURN score;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION check_farkle(roll INTEGER[])
RETURNS boolean AS $$
DECLARE
  dice_counts INTEGER[];
  i INTEGER;
  has_scoring_dice boolean := false;
BEGIN
  dice_counts := array_fill(0, array[6]);
  
  FOR i IN 1..array_length(roll, 1) LOOP
    dice_counts[roll[i]] := dice_counts[roll[i]] + 1;
  END LOOP;
  
  IF dice_counts[1] > 0 OR dice_counts[5] > 0 THEN
    RETURN false;
  END IF;
  
  FOR i IN 1..6 LOOP
    IF dice_counts[i] >= 3 THEN
      RETURN false;
    END IF;
  END LOOP;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create player count trigger
CREATE OR REPLACE FUNCTION update_room_player_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE game_rooms
    SET current_players = current_players + 1
    WHERE id = NEW.game_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE game_rooms
    SET current_players = current_players - 1
    WHERE id = OLD.game_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_room_player_count_trigger
AFTER INSERT OR DELETE ON game_players
FOR EACH ROW
EXECUTE FUNCTION update_room_player_count(); 