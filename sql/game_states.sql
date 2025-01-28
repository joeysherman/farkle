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

-- Set up Row Level Security (RLS)
ALTER TABLE public.game_states ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
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

-- Add to realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_states;

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

-- Function to advance turn
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