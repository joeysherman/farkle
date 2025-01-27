-- Create custom type for game status if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'game_status') THEN
    CREATE TYPE game_status AS ENUM ('waiting', 'in_progress', 'completed');
  END IF;
END $$;

-- Create extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Step 1: Create profiles table to extend Supabase auth users
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

-- Set up Row Level Security (RLS) for profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view any profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;

CREATE POLICY "Users can view any profile"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Step 2: Create game rooms table
CREATE TABLE IF NOT EXISTS public.game_rooms (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  created_by uuid references public.profiles(id),
  status game_status default 'waiting'::game_status not null,
  max_players int default 4,
  current_players int default 1,
  winner_id uuid references public.profiles(id),
  ended_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Set up RLS for game rooms
ALTER TABLE public.game_rooms ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Game rooms are viewable by authenticated users" ON public.game_rooms;
DROP POLICY IF EXISTS "Users can create game rooms" ON public.game_rooms;

CREATE POLICY "Game rooms are viewable by authenticated users"
  ON public.game_rooms FOR SELECT
  USING (true);

CREATE POLICY "Users can create game rooms"
  ON public.game_rooms FOR INSERT
  WITH CHECK (auth.uid() = created_by);

-- Step 3: Create game participants table
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

-- Set up RLS for game players
ALTER TABLE public.game_players ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Game players are viewable by authenticated users" ON public.game_players;
DROP POLICY IF EXISTS "Players can join games" ON public.game_players;
DROP POLICY IF EXISTS "Players can join rooms that are waiting and not full" ON public.game_players;
DROP POLICY IF EXISTS "Players can update their own status in a game" ON public.game_players;

CREATE POLICY "Game players are viewable by authenticated users"
  ON public.game_players FOR SELECT
  USING (true);

CREATE POLICY "Players can join rooms that are waiting and not full"
  ON public.game_players FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM game_rooms
      WHERE id = game_id
      AND status = 'waiting'
      AND current_players < max_players
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

-- Step 4: Create game turns table
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

-- Create turn actions table if not exists
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

-- Create game states table if not exists
CREATE TABLE IF NOT EXISTS public.game_states (
  game_id uuid references public.game_rooms(id) on delete cascade primary key,
  current_turn_number int not null,
  current_player_id uuid references public.game_players(id) not null,
  last_updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  available_dice int default 6 not null,
  current_turn_score int default 0 not null,
  check (available_dice >= 0 and available_dice <= 6)
);

-- Set up RLS for game states
ALTER TABLE public.game_states ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Game states are viewable by authenticated users" ON public.game_states;
DROP POLICY IF EXISTS "Players can update game state" ON public.game_states;

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

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS update_room_player_count_trigger ON public.game_players;

-- Recreate the trigger function
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

-- Create the trigger
CREATE TRIGGER update_room_player_count_trigger
AFTER INSERT OR DELETE ON game_players
FOR EACH ROW
EXECUTE FUNCTION update_room_player_count();

-- Step 5: Create game history table
CREATE TABLE public.game_history (
  id uuid default uuid_generate_v4() primary key,
  game_room_id uuid references public.game_rooms(id) on delete cascade,
  winner_id uuid references public.profiles(id),
  final_scores jsonb not null,
  duration interval,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Set up RLS for game history
alter table public.game_history enable row level security;

create policy "Anyone can view game history"
  on public.game_history for select
  using (true);

-- Step 6: Create function to generate dice roll
create or replace function generate_dice_roll(num_dice integer)
returns integer[] as $$
declare
  roll integer[];
begin
  select array_agg(floor(random() * 6 + 1)::integer)
  into roll
  from generate_series(1, num_dice);
  return roll;
end;
$$ language plpgsql volatile;

-- Step 7: Create function to validate dice selection
create or replace function validate_dice_selection(
  roll integer[],
  selection integer[]
) returns boolean as $$
declare
  valid boolean;
begin
  -- Basic validation that selected dice exist in the roll
  -- TODO: Add more complex validation based on Farkle rules
  select bool_and(s = any(roll))
  into valid
  from unnest(selection) s;
  return valid;
end;
$$ language plpgsql immutable;

-- Step 8: Create function to calculate turn score
create or replace function calculate_turn_score(selected_dice integer[])
returns integer as $$
declare
  score integer := 0;
  dice_counts integer[];
  i integer;
begin
  -- Initialize counts array
  dice_counts := array_fill(0, array[6]);
  
  -- Count occurrences of each die value
  for i in 1..array_length(selected_dice, 1) loop
    dice_counts[selected_dice[i]] := dice_counts[selected_dice[i]] + 1;
  end loop;
  
  -- Score individual 1s and 5s
  score := score + (dice_counts[1] * 100);
  score := score + (dice_counts[5] * 50);
  
  -- Score three of a kind
  for i in 1..6 loop
    if dice_counts[i] >= 3 then
      if i = 1 then
        score := score + 1000;
      else
        score := score + (i * 100);
      end if;
      -- Subtract the individual scoring for 1s and 5s that were counted in three of a kind
      if i = 1 then
        score := score - 300;  -- Subtract 3 * 100
      elsif i = 5 then
        score := score - 150;  -- Subtract 3 * 50
      end if;
    end if;
  end loop;
  
  return score;
end;
$$ language plpgsql immutable;

-- Step 9: Create function to check for Farkle
create or replace function check_farkle(roll integer[])
returns boolean as $$
declare
  dice_counts integer[];
  i integer;
  has_scoring_dice boolean := false;
begin
  -- Initialize counts array
  dice_counts := array_fill(0, array[6]);
  
  -- Count occurrences of each die value
  for i in 1..array_length(roll, 1) loop
    dice_counts[roll[i]] := dice_counts[roll[i]] + 1;
  end loop;
  
  -- Check for any scoring combinations
  -- 1s and 5s
  if dice_counts[1] > 0 or dice_counts[5] > 0 then
    return false;
  end if;
  
  -- Check for three of a kind
  for i in 1..6 loop
    if dice_counts[i] >= 3 then
      return false;
    end if;
  end loop;
  
  -- If we get here, no scoring combinations were found
  return true;
end;
$$ language plpgsql immutable;

-- Step 10: Create realtime subscriptions
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime;
COMMIT;

ALTER PUBLICATION supabase_realtime ADD TABLE public.game_rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_players;
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_turns;
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_states;

-- Step 11: Create triggers for updated_at timestamps
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_profiles_updated_at
  before update on public.profiles
  for each row
  execute function update_updated_at_column();

create trigger update_game_rooms_updated_at
  before update on public.game_rooms
  for each row
  execute function update_updated_at_column();

-- Comments for documentation
comment on table public.profiles is 'Player profiles extending Supabase auth';
comment on table public.game_rooms is 'Active game rooms';
comment on table public.game_players is 'Players participating in game rooms';
comment on table public.game_turns is 'Individual turns within a game';
comment on table public.game_history is 'Completed game records';

-- Add function to handle player joining
CREATE OR REPLACE FUNCTION join_game(room_id UUID)
RETURNS game_players AS $$
DECLARE
  new_player game_players;
  next_order INTEGER;
BEGIN
  -- Get the next player order
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

  -- Start game if room is full
  UPDATE game_rooms
  SET status = 'in_progress'
  WHERE id = room_id
  AND current_players = max_players;

  RETURN new_player;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add function to leave game
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

-- Add function to start game
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
  AND current_players >= 2;  -- Require at least 2 players

  -- Initialize game state if not exists
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

-- Function to initialize game state
CREATE OR REPLACE FUNCTION initialize_game_state(room_id UUID)
RETURNS void AS $$
BEGIN
  -- Get the first player in order
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
    id,
    6,
    0
  FROM game_players
  WHERE game_id = room_id
  ORDER BY player_order ASC
  LIMIT 1;

  -- Update room status to in_progress
  UPDATE game_rooms
  SET status = 'in_progress'
  WHERE id = room_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to advance to next player's turn
CREATE OR REPLACE FUNCTION advance_turn(room_id UUID)
RETURNS void AS $$
DECLARE
  next_player_id UUID;
BEGIN
  -- Get the next player in order
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

  -- Update game state
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