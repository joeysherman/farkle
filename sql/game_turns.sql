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

-- Create turn actions table
CREATE TABLE IF NOT EXISTS public.turn_actions (
  id uuid default gen_random_uuid() primary key,
  turn_id uuid references public.game_turns(id) on delete cascade not null,
  action_number int not null,
  dice_values int[] not null,
  kept_dice int[] default array[]::int[] not null,
  score int default 0 not null,
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

-- Function to perform a roll
CREATE OR REPLACE FUNCTION perform_roll(p_game_id UUID, p_num_dice INTEGER DEFAULT 6)
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
  WHERE gs.game_id = p_game_id;

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
    WHERE gr.id = p_game_id
    AND gr.status = 'in_progress'
  ) THEN
    RAISE EXCEPTION 'Game is not in progress';
  END IF;

  -- Verify number of dice is valid
  IF p_num_dice > v_game_state.available_dice THEN
    RAISE EXCEPTION 'Not enough dice available. Available: %', v_game_state.available_dice;
  END IF;

  -- Get or create current turn with explicit game_id reference
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
  SET available_dice = gs.available_dice - p_num_dice
  WHERE gs.game_id = p_game_id;

  RETURN v_roll_results;
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