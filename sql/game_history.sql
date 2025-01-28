-- Create game history table
CREATE TABLE IF NOT EXISTS public.game_history (
  id uuid default uuid_generate_v4() primary key,
  game_room_id uuid references public.game_rooms(id) on delete cascade,
  winner_id uuid references public.profiles(id),
  final_scores jsonb not null,
  duration interval,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Set up Row Level Security (RLS)
ALTER TABLE public.game_history ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Anyone can view game history"
  ON public.game_history FOR SELECT
  USING (true);

COMMENT ON TABLE public.game_history IS 'Completed game records'; 