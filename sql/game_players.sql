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

-- Set up Row Level Security (RLS)
ALTER TABLE public.game_players ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
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

-- Add to realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_players;

-- Create trigger to update player count
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

-- Function to join a game
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
  -- Get room details and validate invite code
  SELECT status, current_players, max_players, invite_code
  INTO room_status, room_players, room_max_players, valid_code
  FROM game_rooms
  WHERE id = room_id;

  -- Validate room state and invite code
  IF room_status != 'waiting' THEN
    RAISE EXCEPTION 'Game is not in waiting state';
  END IF;

  IF room_players >= room_max_players THEN
    RAISE EXCEPTION 'Game room is full';
  END IF;

  IF valid_code != code THEN
    RAISE EXCEPTION 'Invalid invite code';
  END IF;

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
    COALESCE(auth.uid(), gen_random_uuid()),
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

COMMENT ON TABLE public.game_players IS 'Players participating in game rooms'; 