 -- Migration 003: Fix ambiguous game_id reference in perform_roll function

-- Update the perform_roll function to fix ambiguous game_id references
CREATE OR REPLACE FUNCTION perform_roll(game_id UUID, num_dice INTEGER DEFAULT 6)
RETURNS INTEGER[] AS $$
DECLARE
  current_game_state game_states;
  current_player game_players;
  current_turn game_turns;
  roll_results INTEGER[];
BEGIN
  -- Get current game state
  SELECT * INTO current_game_state
  FROM game_states
  WHERE game_states.game_id = perform_roll.game_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Game state not found';
  END IF;

  -- Get current player
  SELECT * INTO current_player
  FROM game_players
  WHERE id = current_game_state.current_player_id;

  -- Verify it's the user's turn
  IF current_player.user_id != auth.uid() THEN
    RAISE EXCEPTION 'Not your turn';
  END IF;

  -- Verify game is in progress
  IF NOT EXISTS (
    SELECT 1 FROM game_rooms
    WHERE id = perform_roll.game_id
    AND status = 'in_progress'
  ) THEN
    RAISE EXCEPTION 'Game is not in progress';
  END IF;

  -- Verify number of dice is valid
  IF num_dice > current_game_state.available_dice THEN
    RAISE EXCEPTION 'Not enough dice available. Available: %', current_game_state.available_dice;
  END IF;

  -- Get or create current turn
  SELECT * INTO current_turn
  FROM game_turns
  WHERE game_turns.game_id = perform_roll.game_id
  AND turn_number = current_game_state.current_turn_number;

  IF NOT FOUND THEN
    -- Create new turn
    INSERT INTO game_turns (
      game_id,
      player_id,
      turn_number,
      started_at
    ) VALUES (
      perform_roll.game_id,
      current_player.id,
      current_game_state.current_turn_number,
      now()
    )
    RETURNING * INTO current_turn;
  END IF;

  -- Perform the roll
  roll_results := roll_dice(num_dice);

  -- Record the roll in turn_actions
  INSERT INTO turn_actions (
    turn_id,
    action_number,
    dice_values,
    created_at
  ) VALUES (
    current_turn.id,
    COALESCE((
      SELECT MAX(action_number) + 1
      FROM turn_actions
      WHERE turn_id = current_turn.id
    ), 1),
    roll_results,
    now()
  );

  -- Update available dice count
  UPDATE game_states
  SET available_dice = available_dice - num_dice
  WHERE game_id = perform_roll.game_id;

  RETURN roll_results;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;