-- Migration 002: Add dice rolling functionality

-- Function to roll dice and return an array of random numbers
CREATE OR REPLACE FUNCTION roll_dice(num_dice INTEGER DEFAULT 6)
RETURNS INTEGER[] AS $$
DECLARE
  roll_results INTEGER[];
  current_game_state game_states;
BEGIN
  -- Validate number of dice
  IF num_dice < 1 OR num_dice > 6 THEN
    RAISE EXCEPTION 'Number of dice must be between 1 and 6';
  END IF;

  -- Generate random rolls
  SELECT array_agg(floor(random() * 6 + 1)::integer)
  INTO roll_results
  FROM generate_series(1, num_dice);

  RETURN roll_results;
END;
$$ LANGUAGE plpgsql;

-- Function to perform a turn roll with validation
CREATE OR REPLACE FUNCTION perform_roll(game_id UUID, num_dice INTEGER DEFAULT 6)
RETURNS INTEGER[] AS $$
DECLARE
  current_game_state game_states;
  current_player game_players;
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
    WHERE id = game_id
    AND status = 'in_progress'
  ) THEN
    RAISE EXCEPTION 'Game is not in progress';
  END IF;

  -- Verify number of dice is valid
  IF num_dice > current_game_state.available_dice THEN
    RAISE EXCEPTION 'Not enough dice available. Available: %', current_game_state.available_dice;
  END IF;

  -- Perform the roll
  roll_results := roll_dice(num_dice);

  -- Record the roll in turn_actions
  INSERT INTO turn_actions (
    turn_id,
    action_number,
    dice_values,
    created_at
  )
  SELECT
    id,
    COALESCE((
      SELECT MAX(action_number) + 1
      FROM turn_actions
      WHERE turn_id = game_turns.id
    ), 1),
    roll_results,
    now()
  FROM game_turns
  WHERE game_id = perform_roll.game_id
  AND turn_number = current_game_state.current_turn_number;

  -- Update available dice count
  UPDATE game_states
  SET available_dice = available_dice - num_dice
  WHERE game_id = perform_roll.game_id;

  RETURN roll_results;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 