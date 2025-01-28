-- Create game turns table
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

-- Create turn action outcome enum
DO $$ BEGIN
  CREATE TYPE turn_action_outcome AS ENUM ('bust', 'bank', 'continue');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create turn actions table
CREATE TABLE IF NOT EXISTS public.turn_actions (
  id uuid default gen_random_uuid() primary key,
  turn_id uuid references public.game_turns(id) on delete cascade not null,
  action_number int not null,
  dice_values int[] not null,
  kept_dice int[] default array[]::int[] not null,
  score int default 0 not null,
  outcome turn_action_outcome,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(turn_id, action_number)
);

-- Set up Row Level Security (RLS)
ALTER TABLE public.game_turns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.turn_actions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Turns are viewable by authenticated users"
  ON public.game_turns FOR SELECT
  USING (true);

CREATE POLICY "Turn actions are viewable by authenticated users"
  ON public.turn_actions FOR SELECT
  USING (true);

-- Add to realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_turns;
ALTER PUBLICATION supabase_realtime ADD TABLE public.turn_actions;

-- Function to roll dice
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

-- Enum for turn action outcomes
CREATE TYPE turn_action_outcome AS ENUM ('bust', 'bank', 'continue');

-- Modify perform_roll to be simpler
CREATE OR REPLACE FUNCTION perform_roll(p_game_id UUID, p_num_dice INTEGER DEFAULT 6)
RETURNS INTEGER[] AS $$
DECLARE
  v_game_state game_states;
  v_player game_players;
  v_turn game_turns;
  v_roll_results INTEGER[];
  v_initial_score INTEGER;
BEGIN
  -- Get current game state
  SELECT gs.* INTO v_game_state
  FROM game_states gs
  WHERE gs.game_id = p_game_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Game state not found';
  END IF;

  -- Get current player
  SELECT gp.* INTO v_player
  FROM game_players gp
  WHERE gp.id = v_game_state.current_player_id;

  -- Verify it's the user's turn
  IF v_player.user_id != auth.uid() THEN
    RAISE EXCEPTION 'Not your turn';
  END IF;

  -- Verify game is in progress
  IF NOT EXISTS (
    SELECT 1 FROM game_rooms gr
    WHERE gr.id = p_game_id
    AND gr.status = 'in_progress'
  ) THEN
    RAISE EXCEPTION 'Game is not in progress';
  END IF;

  -- Verify number of dice is valid
  IF p_num_dice > v_game_state.available_dice THEN
    RAISE EXCEPTION 'Not enough dice available. Available: %', v_game_state.available_dice;
  END IF;

  -- Get or create current turn
  SELECT gt.* INTO v_turn
  FROM game_turns gt
  WHERE gt.game_id = p_game_id
  AND gt.turn_number = v_game_state.current_turn_number;

  IF NOT FOUND THEN
    -- Create new turn
    INSERT INTO game_turns (
      game_id,
      player_id,
      turn_number,
      started_at
    ) VALUES (
      p_game_id,
      v_player.id,
      v_game_state.current_turn_number,
      now()
    )
    RETURNING * INTO v_turn;
  END IF;

  -- Perform the roll
  v_roll_results := roll_dice(p_num_dice);

  -- Calculate initial possible score for this roll
  v_initial_score := calculate_turn_score(v_roll_results);

  -- Record the roll in turn_actions
  INSERT INTO turn_actions (
    turn_id,
    action_number,
    dice_values,
    score,
    created_at
  ) VALUES (
    v_turn.id,
    COALESCE((
      SELECT MAX(ta.action_number) + 1
      FROM turn_actions ta
      WHERE ta.turn_id = v_turn.id
    ), 1),
    v_roll_results,
    v_initial_score,
    now()
  );

  -- Update game state with potential score
  UPDATE game_states
  SET available_dice = v_game_state.available_dice - p_num_dice
  WHERE game_id = p_game_id;

  RETURN v_roll_results;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to process a turn action decision
CREATE OR REPLACE FUNCTION process_turn_action(
  p_game_id UUID,
  p_kept_dice INTEGER[],
  p_outcome turn_action_outcome
) RETURNS void AS $$
DECLARE
  v_game_state game_states;
  v_player game_players;
  v_turn game_turns;
  v_latest_action turn_actions;
  v_action_score INTEGER;
BEGIN
  -- Get current game state
  SELECT gs.* INTO v_game_state
  FROM game_states gs
  WHERE gs.game_id = p_game_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Game state not found';
  END IF;

  -- Get current player
  SELECT gp.* INTO v_player
  FROM game_players gp
  WHERE gp.id = v_game_state.current_player_id;

  -- Verify it's the user's turn
  IF v_player.user_id != auth.uid() THEN
    RAISE EXCEPTION 'Not your turn';
  END IF;

  -- Get current turn
  SELECT gt.* INTO v_turn
  FROM game_turns gt
  WHERE gt.game_id = p_game_id
  AND gt.turn_number = v_game_state.current_turn_number;

  -- Get latest action
  SELECT ta.* INTO v_latest_action
  FROM turn_actions ta
  WHERE ta.turn_id = v_turn.id
  ORDER BY ta.action_number DESC
  LIMIT 1;

  -- Validate kept dice against rolled dice
  IF NOT validate_dice_selection(v_latest_action.dice_values, p_kept_dice) THEN
    RAISE EXCEPTION 'Invalid dice selection';
  END IF;

  -- Calculate score for kept dice
  v_action_score := calculate_turn_score(p_kept_dice);

  -- Update the turn action with kept dice and score
  UPDATE turn_actions
  SET kept_dice = p_kept_dice,
      score = v_action_score
  WHERE id = v_latest_action.id;

  -- Handle the outcome
  CASE p_outcome
    WHEN 'bust' THEN
      PERFORM end_turn(p_game_id, 0, true);
    WHEN 'bank' THEN
      -- Sum up all scores from this turn's actions
      SELECT COALESCE(SUM(score), 0) + v_action_score
      INTO v_action_score
      FROM turn_actions
      WHERE turn_id = v_turn.id;
      PERFORM end_turn(p_game_id, v_action_score, false);
    WHEN 'continue' THEN
      -- Calculate remaining dice for next roll
      UPDATE game_states
      SET available_dice = 
        CASE 
          WHEN v_game_state.available_dice - array_length(p_kept_dice, 1) = 0 THEN 6
          ELSE v_game_state.available_dice - array_length(p_kept_dice, 1)
        END
      WHERE game_id = p_game_id;
  END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to end a turn
CREATE OR REPLACE FUNCTION end_turn(
  p_game_id UUID,
  p_final_score INTEGER,
  p_is_farkle BOOLEAN
) RETURNS void AS $$
DECLARE
  v_turn game_turns;
  v_next_player_id UUID;
  v_pending_actions INTEGER;
BEGIN
  -- Check if all actions have outcomes before ending turn
  SELECT COUNT(*)
  INTO v_pending_actions
  FROM turn_actions ta
  JOIN game_turns gt ON ta.turn_id = gt.id
  WHERE gt.game_id = p_game_id
  AND gt.ended_at IS NULL
  AND ta.outcome IS NULL;

  IF v_pending_actions > 0 THEN
    RAISE EXCEPTION 'Cannot end turn with pending actions. All actions must have an outcome.';
  END IF;

  -- Update the current turn
  UPDATE game_turns gt
  SET ended_at = now(),
      score_gained = p_final_score,
      is_farkle = p_is_farkle
  WHERE gt.game_id = p_game_id
  AND gt.ended_at IS NULL
  RETURNING * INTO v_turn;

  -- If banking (not farkle), update player's score
  IF NOT p_is_farkle THEN
    UPDATE game_players
    SET score = score + p_final_score
    WHERE id = v_turn.player_id;
  END IF;

  -- Get next player in turn order
  SELECT gp.id INTO v_next_player_id
  FROM game_players gp
  WHERE gp.game_id = p_game_id
  AND gp.turn_order > (
    SELECT turn_order
    FROM game_players
    WHERE id = v_turn.player_id
  )
  ORDER BY gp.turn_order
  LIMIT 1;

  -- If no next player, wrap around to first player
  IF v_next_player_id IS NULL THEN
    SELECT gp.id INTO v_next_player_id
    FROM game_players gp
    WHERE gp.game_id = p_game_id
    ORDER BY gp.turn_order
    LIMIT 1;
  END IF;

  -- Update game state for next turn
  UPDATE game_states
  SET current_player_id = v_next_player_id,
      current_turn_number = v_turn.turn_number + 1,
      available_dice = 6
  WHERE game_id = p_game_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to validate dice selection
CREATE OR REPLACE FUNCTION validate_dice_selection(
  roll INTEGER[],
  selection INTEGER[]
) RETURNS boolean AS $$
DECLARE
  valid boolean;
BEGIN
  -- Basic validation that selected dice exist in the roll
  SELECT bool_and(s = any(roll))
  INTO valid
  FROM unnest(selection) s;
  RETURN valid;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to calculate turn score
CREATE OR REPLACE FUNCTION calculate_turn_score(selected_dice INTEGER[])
RETURNS INTEGER AS $$
DECLARE
  score INTEGER := 0;
  dice_counts INTEGER[];
  i INTEGER;
BEGIN
  -- Initialize counts array
  dice_counts := array_fill(0, array[6]);
  
  -- Count occurrences of each die value
  FOR i IN 1..array_length(selected_dice, 1) LOOP
    dice_counts[selected_dice[i]] := dice_counts[selected_dice[i]] + 1;
  END LOOP;
  
  -- Score individual 1s and 5s
  score := score + (dice_counts[1] * 100);
  score := score + (dice_counts[5] * 50);
  
  -- Score three of a kind
  FOR i IN 1..6 LOOP
    IF dice_counts[i] >= 3 THEN
      IF i = 1 THEN
        score := score + 1000;
      ELSE
        score := score + (i * 100);
      END IF;
      -- Subtract the individual scoring for 1s and 5s that were counted in three of a kind
      IF i = 1 THEN
        score := score - 300;  -- Subtract 3 * 100
      ELSIF i = 5 THEN
        score := score - 150;  -- Subtract 3 * 50
      END IF;
    END IF;
  END LOOP;
  
  RETURN score;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to check for Farkle
CREATE OR REPLACE FUNCTION check_farkle(roll INTEGER[])
RETURNS boolean AS $$
DECLARE
  dice_counts INTEGER[];
  i INTEGER;
  has_scoring_dice boolean := false;
BEGIN
  -- Initialize counts array
  dice_counts := array_fill(0, array[6]);
  
  -- Count occurrences of each die value
  FOR i IN 1..array_length(roll, 1) LOOP
    dice_counts[roll[i]] := dice_counts[roll[i]] + 1;
  END LOOP;
  
  -- Check for any scoring combinations
  -- 1s and 5s
  IF dice_counts[1] > 0 OR dice_counts[5] > 0 THEN
    RETURN false;
  END IF;
  
  -- Check for three of a kind
  FOR i IN 1..6 LOOP
    IF dice_counts[i] >= 3 THEN
      RETURN false;
    END IF;
  END LOOP;
  
  -- If we get here, no scoring combinations were found
  RETURN true;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON TABLE public.game_turns IS 'Individual turns within a game';
COMMENT ON TABLE public.turn_actions IS 'Actions taken within a turn'; 