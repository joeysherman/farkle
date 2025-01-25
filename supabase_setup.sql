-- Step 1: Create profiles table to extend Supabase auth users
create table public.profiles (
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
alter table public.profiles enable row level security;

create policy "Users can view any profile"
  on public.profiles for select
  using (true);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Step 2: Create game rooms table
create table public.game_rooms (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  created_by uuid references public.profiles(id),
  status text check (status in ('waiting', 'in_progress', 'completed')) default 'waiting',
  max_players int default 4,
  current_turn uuid references public.profiles(id),
  winning_score int default 10000,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Set up RLS for game rooms
alter table public.game_rooms enable row level security;

create policy "Anyone can view game rooms"
  on public.game_rooms for select
  using (true);

create policy "Authenticated users can create game rooms"
  on public.game_rooms for insert
  with check (auth.role() = 'authenticated');

create policy "Only room creator can update room"
  on public.game_rooms for update
  using (auth.uid() = created_by);

-- Step 3: Create game participants table
create table public.game_participants (
  id uuid default uuid_generate_v4() primary key,
  game_room_id uuid references public.game_rooms(id) on delete cascade,
  player_id uuid references public.profiles(id),
  current_score int default 0,
  turn_order int,
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(game_room_id, player_id)
);

-- Set up RLS for game participants
alter table public.game_participants enable row level security;

create policy "Players can view game participants"
  on public.game_participants for select
  using (true);

create policy "Players can join games"
  on public.game_participants for insert
  with check (auth.role() = 'authenticated');

-- Step 4: Create game turns table
create table public.game_turns (
  id uuid default uuid_generate_v4() primary key,
  game_room_id uuid references public.game_rooms(id) on delete cascade,
  player_id uuid references public.profiles(id),
  dice_values integer[] not null,
  selected_dice integer[],
  turn_score int default 0,
  is_farkle boolean default false,
  turn_complete boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Set up RLS for game turns
alter table public.game_turns enable row level security;

create policy "Anyone can view game turns"
  on public.game_turns for select
  using (true);

create policy "Only current player can insert turn"
  on public.game_turns for insert
  using (auth.uid() = player_id);

-- Step 5: Create game history table
create table public.game_history (
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
alter publication supabase_realtime add table game_rooms;
alter publication supabase_realtime add table game_participants;
alter publication supabase_realtime add table game_turns;

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
comment on table public.game_participants is 'Players participating in game rooms';
comment on table public.game_turns is 'Individual turns within a game';
comment on table public.game_history is 'Completed game records'; 