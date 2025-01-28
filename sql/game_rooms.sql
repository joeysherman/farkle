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

-- Set up Row Level Security (RLS)
ALTER TABLE public.game_rooms ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Game rooms are viewable by authenticated users"
  ON public.game_rooms FOR SELECT
  USING (true);

CREATE POLICY "Users can create game rooms"
  ON public.game_rooms FOR INSERT
  WITH CHECK (auth.uid() = created_by);

-- Add updated_at trigger
CREATE TRIGGER update_game_rooms_updated_at
  BEFORE UPDATE ON public.game_rooms
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add to realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_rooms;

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
BEGIN
  -- Generate invite code
  SELECT generate_invite_code() INTO v_invite_code;

  -- Create the room
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
  );

  RETURN v_room_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE public.game_rooms IS 'Active game rooms'; 