-- Migration 006: Fix perform_roll function parameter names

-- Drop existing functions first
DROP FUNCTION IF EXISTS perform_roll(UUID, INTEGER);
DROP FUNCTION IF EXISTS roll_dice(INTEGER);

-- Create helper function for rolling dice
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

-- Recreate perform_roll with explicit parameter names
CREATE OR REPLACE FUNCTION perform_roll(game_id UUID, num_dice INTEGER DEFAULT 6)
RETURNS INTEGER[] AS $$
DECLARE
  v_game_state game_states;
  v_player game_players;
  v_turn game_turns;
  v_roll_results INTEGER[];
BEGIN
  -- Get current game state with explicit game_id reference
  SELECT gs.* INTO v_game_state
  FROM game_states gs
  WHERE gs.game_id = game_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Game state not found';
  END IF;

  -- Get current player with explicit id reference
  SELECT gp.* INTO v_player
  FROM game_players gp
  WHERE gp.id = v_game_state.current_player_id;

  -- Verify it's the user's turn
  IF v_player.user_id != auth.uid() THEN
    RAISE EXCEPTION 'Not your turn';
  END IF;

  -- Verify game is in progress with explicit id reference
  IF NOT EXISTS (
    SELECT 1 FROM game_rooms gr
    WHERE gr.id = game_id
    AND gr.status = 'in_progress'
  ) THEN
    RAISE EXCEPTION 'Game is not in progress';
  END IF;

  -- Verify number of dice is valid
  IF num_dice > v_game_state.available_dice THEN
    RAISE EXCEPTION 'Not enough dice available. Available: %', v_game_state.available_dice;
  END IF;

  -- Get or create current turn with explicit game_id reference
  SELECT gt.* INTO v_turn
  FROM game_turns gt
  WHERE gt.game_id = game_id
  AND gt.turn_number = v_game_state.current_turn_number;

  IF NOT FOUND THEN
    -- Create new turn
    INSERT INTO game_turns (
      game_id,
      player_id,
      turn_number,
      started_at
    ) VALUES (
      game_id,
      v_player.id,
      v_game_state.current_turn_number,
      now()
    )
    RETURNING * INTO v_turn;
  END IF;

  -- Perform the roll
  v_roll_results := roll_dice(num_dice);

  -- Record the roll in turn_actions with explicit turn_id reference
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

  -- Update available dice count with explicit game_id reference
  UPDATE game_states gs
  SET available_dice = gs.available_dice - num_dice
  WHERE gs.game_id = game_id;

  RETURN v_roll_results;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 