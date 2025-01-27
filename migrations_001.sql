 -- Migration 001: Allow single-player games and update game start logic

-- Modify game_rooms table to set default max_players to 1
ALTER TABLE public.game_rooms ALTER COLUMN max_players SET DEFAULT 1;

-- Update the start_game function to allow single player
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
  AND current_players > 0;  -- Changed from >= 2 to > 0 to allow single player

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

-- Update the join_game function to prevent joining if game is in progress
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

  -- Update current_players count
  UPDATE game_rooms
  SET current_players = current_players + 1
  WHERE id = room_id;

  RETURN new_player;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;