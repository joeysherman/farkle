

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pgsodium";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgjwt" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."game_status" AS ENUM (
    'waiting',
    'in_progress',
    'completed'
);


ALTER TYPE "public"."game_status" OWNER TO "postgres";


CREATE TYPE "public"."turn_action_outcome" AS ENUM (
    'bust',
    'bank',
    'continue'
);


ALTER TYPE "public"."turn_action_outcome" OWNER TO "postgres";


CREATE TYPE "public"."turn_score_result" AS (
	"score" integer,
	"valid_dice" integer[]
);


ALTER TYPE "public"."turn_score_result" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_turn_score"("selected_dice" integer[]) RETURNS "public"."turn_score_result"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
DECLARE
  result turn_score_result;
  dice_counts INTEGER[];
  valid_dice INTEGER[] := ARRAY[]::INTEGER[];
  i INTEGER;
  j INTEGER;
  pair_count INTEGER := 0;
  has_straight BOOLEAN := false;
  base_score INTEGER;
BEGIN
  -- Initialize result
  result.score := 0;
  result.valid_dice := ARRAY[]::INTEGER[];
  
  -- Initialize counts array
  dice_counts := array_fill(0, array[6]);
  
  -- Count occurrences of each die value
  FOR i IN 1..array_length(selected_dice, 1) LOOP
    dice_counts[selected_dice[i]] := dice_counts[selected_dice[i]] + 1;
  END LOOP;

  -- Check for straight (1-6)
  IF array_length(selected_dice, 1) = 6 THEN
    has_straight := true;
    FOR i IN 1..6 LOOP
      IF dice_counts[i] != 1 THEN
        has_straight := false;
        EXIT;
      END IF;
    END LOOP;

    IF has_straight THEN
      result.score := 1000;
      result.valid_dice := selected_dice;
      RETURN result;
    END IF;
  END IF;

  -- Check for three pairs
  IF array_length(selected_dice, 1) = 6 THEN
    pair_count := 0;
    FOR i IN 1..6 LOOP
      IF dice_counts[i] = 2 THEN
        pair_count := pair_count + 1;
      END IF;
    END LOOP;

    IF pair_count = 3 THEN
      result.score := 750;
      result.valid_dice := selected_dice;
      RETURN result;
    END IF;
  END IF;
  
  -- Handle multiples (3 or more of a kind)
  FOR i IN 1..6 LOOP
    IF dice_counts[i] >= 3 THEN
      -- Calculate base score for three of a kind
      IF i = 1 THEN
        base_score := 1000;
      ELSE
        base_score := i * 100;
      END IF;
      
      -- Add base score for initial three dice
      result.score := base_score;
      
      -- Add base score for each additional die
      IF dice_counts[i] > 3 THEN
        result.score := result.score + (base_score * (dice_counts[i] - 3));
      END IF;
      
      -- Add these dice to valid_dice array
      FOR j IN 1..dice_counts[i] LOOP
        result.valid_dice := array_append(result.valid_dice, i);
      END LOOP;
      
      -- Set count to 0 so we don't count these dice again
      dice_counts[i] := 0;
    END IF;
  END LOOP;
  
  -- Score remaining individual 1s and 5s
  FOR i IN 1..dice_counts[1] LOOP
    result.score := result.score + 100;
    result.valid_dice := array_append(result.valid_dice, 1);
  END LOOP;
  
  FOR i IN 1..dice_counts[5] LOOP
    result.score := result.score + 50;
    result.valid_dice := array_append(result.valid_dice, 5);
  END LOOP;
  
  RETURN result;
END;
$$;


ALTER FUNCTION "public"."calculate_turn_score"("selected_dice" integer[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_farkle"("roll" integer[]) RETURNS boolean
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
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
$$;


ALTER FUNCTION "public"."check_farkle"("roll" integer[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_room"("p_name" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_room_id UUID;
  v_invite_code CHAR(6);
  v_player_id UUID;
  v_turn_id UUID;
BEGIN
  -- Generate invite code
  SELECT generate_invite_code() INTO v_invite_code;

  -- Create the room
  INSERT INTO game_rooms (
    name,
    created_by,
    status,
    max_players,
    invite_code
  ) VALUES (
    p_name,
    auth.uid(),
    'waiting',
    4,
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
  ) RETURNING id INTO v_player_id;

  -- Create initial turn
  INSERT INTO game_turns (
    game_id,
    player_id,
    turn_number,
    started_at
  ) VALUES (
    v_room_id,
    v_player_id,
    1,
    now()
  ) RETURNING id INTO v_turn_id;

  -- Create game state record with current player as first player
  -- and current turn number as 1
  -- and game status as waiting
  INSERT INTO game_states (
    game_id,
    current_player_id,
    current_turn_number,
    current_turn
  ) VALUES (
    v_room_id,
    v_player_id,
    1,
    v_turn_id
  );

  RETURN v_room_id;
END;
$$;


ALTER FUNCTION "public"."create_room"("p_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."end_game"("p_game_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."end_game"("p_game_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."end_turn"("p_game_id" "uuid", "p_final_score" integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_turn game_turns;
  v_next_player_id UUID;
  v_pending_actions INTEGER;
  v_new_turn_id UUID;
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
      score_gained = p_final_score
  WHERE gt.game_id = p_game_id
  AND gt.ended_at IS NULL
  RETURNING * INTO v_turn;

  -- If banking (not farkle), update player's score
  
    UPDATE game_players
    SET score = score + p_final_score
    WHERE id = v_turn.player_id;
  

  -- Get next player in turn order (using player_order instead of turn_order)
  SELECT gp.id INTO v_next_player_id
  FROM game_players gp
  WHERE gp.game_id = p_game_id
  AND gp.player_order > (
    SELECT player_order
    FROM game_players
    WHERE id = v_turn.player_id
  )
  ORDER BY gp.player_order
  LIMIT 1;

  -- If no next player, wrap around to first player
  IF v_next_player_id IS NULL THEN
    SELECT gp.id INTO v_next_player_id
    FROM game_players gp
    WHERE gp.game_id = p_game_id
    ORDER BY gp.player_order
    LIMIT 1;
  END IF;

  -- Create new turn for next player
  INSERT INTO game_turns (
    game_id,
    player_id,
    turn_number,
    started_at
  ) VALUES (
    p_game_id,
    v_next_player_id,
    v_turn.turn_number + 1,
    now()
  ) RETURNING id INTO v_new_turn_id;

  -- Update game state for next turn
  UPDATE game_states
  SET current_player_id = v_next_player_id,
      current_turn_number = v_turn.turn_number + 1,
      current_turn = v_new_turn_id,
      last_updated_at = now()
  WHERE game_id = p_game_id;
END;
$$;


ALTER FUNCTION "public"."end_turn"("p_game_id" "uuid", "p_final_score" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_invite_code"() RETURNS character
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."generate_invite_code"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_available_dice"("p_turn_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
DECLARE
  v_latest_action turn_actions;
BEGIN
  -- Get the latest action for this turn
  SELECT * INTO v_latest_action
  FROM turn_actions
  WHERE turn_id = p_turn_id
  ORDER BY action_number DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN 6; -- Start of turn, all dice available
  END IF;

  -- If the latest action has no outcome, no dice are available until the action is completed
  IF v_latest_action.outcome IS NULL THEN
    RETURN 0;
  END IF;

  -- Calculate remaining dice based on kept dice
  RETURN CASE
    -- If all dice were kept, give 6 new dice (hot dice)
    WHEN array_length(v_latest_action.kept_dice, 1) = array_length(v_latest_action.dice_values, 1) THEN 6
    -- Otherwise return remaining dice
    ELSE array_length(v_latest_action.dice_values, 1) - array_length(v_latest_action.kept_dice, 1)
  END;
END;
$$;


ALTER FUNCTION "public"."get_available_dice"("p_turn_id" "uuid") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."game_players" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "game_id" "uuid",
    "user_id" "uuid" NOT NULL,
    "player_order" integer NOT NULL,
    "score" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."game_players" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."join_game"("room_id" "uuid", "code" "text") RETURNS "public"."game_players"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  next_order INT;
  new_player game_players;
BEGIN
  -- Verify room exists and is joinable
  IF NOT EXISTS (
    SELECT 1 FROM game_rooms
    WHERE id = room_id
    AND status = 'waiting'
    AND current_players < max_players
    AND invite_code = code
  ) THEN
    RAISE EXCEPTION 'Invalid room or room is full';
  END IF;

  -- Check if user is already in the room
  IF EXISTS (
    SELECT 1 FROM game_players
    WHERE game_id = room_id
    AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Already in room';
  END IF;

  -- Get next player order
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
    auth.uid(),
    next_order,
    true,
    0
  )
  RETURNING * INTO new_player;

  RETURN new_player;
END;
$$;


ALTER FUNCTION "public"."join_game"("room_id" "uuid", "code" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."leave_game"("room_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."leave_game"("room_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."perform_roll"("p_game_id" "uuid", "p_num_dice" integer DEFAULT 6) RETURNS integer[]
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_game_state game_states;
  v_player game_players;
  v_turn game_turns;
  v_roll_results INTEGER[];
  v_score_result turn_score_result;
  v_available_dice INTEGER;
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
  v_roll_results := roll_dice(6);

  -- Calculate initial possible score for this roll
  v_score_result := calculate_turn_score(v_roll_results);

  -- Set available dice based on this roll which is 6 - v_score_result.valid_dice
  v_available_dice := 6 - array_length(v_score_result.valid_dice, 1);

  INSERT INTO turn_actions (
    turn_id,
    action_number,
    dice_values,
    kept_dice,
    score,
    available_dice,
    created_at
  ) VALUES (
    v_turn.id,
    1,
    v_roll_results,
    v_score_result.valid_dice,
    v_score_result.score,
    v_available_dice,
    now()
  );

  RETURN v_roll_results;
END;
$$;


ALTER FUNCTION "public"."perform_roll"("p_game_id" "uuid", "p_num_dice" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_turn_action"("p_game_id" "uuid", "p_outcome" "public"."turn_action_outcome", "p_kept_dice" integer[]) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_game_state game_states;
  v_player game_players;
  v_turn game_turns;
  v_latest_action turn_actions;
  v_score_result turn_score_result;
  v_remaining_dice INTEGER;
  v_kept_dice INTEGER[];
  v_roll_results INTEGER[];
  v_dice_values INTEGER[];

  c_new_kept_dice INTEGER[];
  c_new_available_dice INTEGER;
  c_difference_kept_dice INTEGER[];
  c_difference_kept_dice_length INTEGER;
  c_new_score_result turn_score_result;
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


  -- CASE p_outcome
  CASE p_outcome
    WHEN 'bust' THEN
      -- bust: set outcome to bust
      -- set outcome to bust on the previous turn_action
      UPDATE turn_actions
      SET outcome = 'bust'
      WHERE id = v_latest_action.id;

      PERFORM end_turn(p_game_id, 0);

    WHEN 'bank' THEN
        -- bank: set outcome to bank
      -- set outcome to bank on the previous turn_action
      UPDATE turn_actions
      SET outcome = 'bank'
      WHERE id = v_latest_action.id;

      -- if the score of the latest turn_action is 0, we cannot bank
      if v_latest_action.score = 0 then
        RAISE EXCEPTION 'Cannot bank with 0 score from previous turn';
      end if;

        -- Sum up all scores from this turn's actions
      SELECT COALESCE(SUM(score), 0)
      INTO v_score_result.score
      FROM turn_actions
      WHERE turn_id = v_turn.id;
      
      PERFORM end_turn(p_game_id, v_score_result.score);

    WHEN 'continue' THEN

      -- get the dice_values from the previous turn_action
      v_dice_values := v_latest_action.dice_values;

      -- get the kept_dice from the previous turn_action
      v_kept_dice := v_latest_action.kept_dice;

      -- get the available_dice from the previous turn_action
      v_remaining_dice := v_latest_action.available_dice;

      -- if p_kept_dice is not empty, for each value in the p_kept_dice array
      -- remove the only first occurrence of the value from the v_kept_dice array
      -- if the value is not found, raise an exception
      -- for example, if p_kept_dice is [5] and v_kept_dice is [1, 1, 5, 5]
      -- then v_kept_dice should be [1, 1, 5]

      c_difference_kept_dice := remove_first_occurrence(p_kept_dice, v_kept_dice);

      -- get length of c_difference_kept_dice
      c_difference_kept_dice_length := array_length(c_difference_kept_dice, 1);
    
      -- if c_difference_kept_dice_length is 0, then we kept all bankable dice
      -- if c_difference_kept_dice_length is not 0, then we kept some bankable dice to roll again
      -- add the length of c_difference_kept_dice to v_remaining_dice
      --v_remaining_dice := v_remaining_dice + c_difference_kept_dice_length;

      -- calculate the new score_result using the new p_kept_dice
      c_new_score_result := calculate_turn_score(p_kept_dice);

      -- add the length of c_difference_kept_dice to v_remaining_dice
      v_remaining_dice := v_remaining_dice + c_difference_kept_dice_length;


      -- update the score of the previous turn_action
      UPDATE turn_actions
      SET score = c_new_score_result.score,
          kept_dice = p_kept_dice,
          available_dice = v_remaining_dice
      WHERE id = v_latest_action.id;


      if v_remaining_dice = 0 then
        -- if v_remaining_dice is 0, check if we rolled all bankable dice
        -- if we did, set v_remaining_dice to 6
        -- check if the score is greater than 0
        -- check if the length of the dice_values array is equal to the length of the kept_dice array
        -- if both are true, set v_remaining_dice to 6
        -- otherwise throw an exception
        if v_latest_action.score > 0 and array_length(v_latest_action.dice_values, 1) = array_length(v_latest_action.kept_dice, 1) then
          v_remaining_dice := 6;
        else
          RAISE EXCEPTION 'Cannot continue turn with 0 available dice';
        end if;
      end if;

      v_roll_results := roll_dice(v_remaining_dice);

      v_score_result := calculate_turn_score(v_roll_results);

      -- set outcome to continue on the previous turn_action
      -- v_latest_action should have the id to use.
      UPDATE turn_actions
      SET outcome = 'continue'
      WHERE id = v_latest_action.id;

      INSERT INTO turn_actions (
        turn_id,
        action_number,
        dice_values,
        kept_dice,
        score,
        available_dice,
        created_at
      ) VALUES (
        v_turn.id,
        v_latest_action.action_number + 1,
        v_roll_results,
        v_score_result.valid_dice,
        v_score_result.score,
        v_remaining_dice - array_length(v_score_result.valid_dice, 1),
        now()
      );

      -- return an object with the following properties:

      -- dice_values: v_roll_results
      -- kept_dice: v_score_result.valid_dice
      -- score: v_score_result.score
      -- available_dice: v_remaining_dice - array_length(v_score_result.valid_dice, 1)
      -- c_new_score_result.score
      -- c_new_score_result.valid_dice
      -- c_difference_kept_dice
      -- c_difference_kept_dice_length
      -- v_remaining_dice

      RETURN jsonb_build_object(
        'new_score', c_new_score_result,
        'difference_kept_dice', c_difference_kept_dice,
        'remaining_dice', v_remaining_dice
      );
  END CASE;

  -- Return NULL for non-continue outcomes
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."process_turn_action"("p_game_id" "uuid", "p_outcome" "public"."turn_action_outcome", "p_kept_dice" integer[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."remove_first_occurrence"("p_kept_dice" integer[], "v_kept_dice" integer[]) RETURNS integer[]
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    result_dice INTEGER[] := v_kept_dice;
    value INTEGER;
    index INTEGER;
BEGIN
    -- Iterate over each value in p_kept_dice
    FOREACH value IN ARRAY p_kept_dice LOOP
        -- Find the index of the first occurrence of the value in result_dice
        index := array_position(result_dice, value);
        
        -- If the value is found, remove it
        IF index IS NOT NULL THEN
            result_dice := result_dice[1:index-1] || result_dice[index+1:array_length(result_dice, 1)];
        ELSE
            -- Raise an exception if the value is not found
            RAISE EXCEPTION 'Value % not found in array', value;
        END IF;
    END LOOP;
    
    RETURN result_dice;
END;
$$;


ALTER FUNCTION "public"."remove_first_occurrence"("p_kept_dice" integer[], "v_kept_dice" integer[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."roll_dice"("num_dice" integer) RETURNS integer[]
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  roll INTEGER[];
BEGIN
  SELECT array_agg(floor(random() * 6 + 1)::INTEGER)
  INTO roll
  FROM generate_series(1, num_dice);
  RETURN roll;
END;
$$;


ALTER FUNCTION "public"."roll_dice"("num_dice" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."run_all_tests"() RETURNS SETOF "text"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY SELECT * FROM test_calculate_turn_score();
END;



$$;


ALTER FUNCTION "public"."run_all_tests"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."start_game"("room_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
    current_player_id
  )
  SELECT
    room_id,
    1,
    (SELECT id FROM game_players WHERE game_id = room_id AND player_order = 1)
  WHERE NOT EXISTS (
    SELECT 1 FROM game_states WHERE game_id = room_id
  );
END;
$$;


ALTER FUNCTION "public"."start_game"("room_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."test_calculate_turn_score"() RETURNS SETOF "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  result turn_score_result;
BEGIN
  -- Test single 1s and 5s
  result := calculate_turn_score(ARRAY[1]);
  ASSERT result.score = 100, 'Single 1 should score 100';
  
  result := calculate_turn_score(ARRAY[5]);
  ASSERT result.score = 50, 'Single 5 should score 50';
  
  result := calculate_turn_score(ARRAY[1, 5]);
  ASSERT result.score = 150, 'One 1 and one 5 should score 150';
  
  -- Test three of a kind
  result := calculate_turn_score(ARRAY[1, 1, 1]);
  ASSERT result.score = 1000, 'Three 1s should score 1000';
  
  result := calculate_turn_score(ARRAY[2, 2, 2]);
  ASSERT result.score = 200, 'Three 2s should score 200';
  
  result := calculate_turn_score(ARRAY[3, 3, 3]);
  ASSERT result.score = 300, 'Three 3s should score 300';
  
  result := calculate_turn_score(ARRAY[4, 4, 4]);
  ASSERT result.score = 400, 'Three 4s should score 400';
  
  result := calculate_turn_score(ARRAY[5, 5, 5]);
  ASSERT result.score = 500, 'Three 5s should score 500';
  
  result := calculate_turn_score(ARRAY[6, 6, 6]);
  ASSERT result.score = 600, 'Three 6s should score 600';

  -- Test four of a kind (adds base score once)
  result := calculate_turn_score(ARRAY[1, 1, 1, 1]);
  ASSERT result.score = 2000, 'Four 1s should score 2000';
  
  result := calculate_turn_score(ARRAY[2, 2, 2, 2]);
  ASSERT result.score = 400, 'Four 2s should score 400';
  
  result := calculate_turn_score(ARRAY[3, 3, 3, 3]);
  ASSERT result.score = 600, 'Four 3s should score 600';
  
  result := calculate_turn_score(ARRAY[4, 4, 4, 4]);
  ASSERT result.score = 800, 'Four 4s should score 800';
  
  result := calculate_turn_score(ARRAY[5, 5, 5, 5]);
  ASSERT result.score = 1000, 'Four 5s should score 1000';
  
  result := calculate_turn_score(ARRAY[6, 6, 6, 6]);
  ASSERT result.score = 1200, 'Four 6s should score 1200';

  -- Test five of a kind (adds base score twice)
  result := calculate_turn_score(ARRAY[1, 1, 1, 1, 1]);
  ASSERT result.score = 3000, 'Five 1s should score 3000';
  
  result := calculate_turn_score(ARRAY[2, 2, 2, 2, 2]);
  ASSERT result.score = 600, 'Five 2s should score 600';
  
  result := calculate_turn_score(ARRAY[3, 3, 3, 3, 3]);
  ASSERT result.score = 900, 'Five 3s should score 900';
  
  result := calculate_turn_score(ARRAY[4, 4, 4, 4, 4]);
  ASSERT result.score = 1200, 'Five 4s should score 1200';
  
  result := calculate_turn_score(ARRAY[5, 5, 5, 5, 5]);
  ASSERT result.score = 1500, 'Five 5s should score 1500';
  
  result := calculate_turn_score(ARRAY[6, 6, 6, 6, 6]);
  ASSERT result.score = 1800, 'Five 6s should score 1800';

  -- Test six of a kind (adds base score three times)
  result := calculate_turn_score(ARRAY[1, 1, 1, 1, 1, 1]);
  ASSERT result.score = 4000, 'Six 1s should score 4000';
  
  result := calculate_turn_score(ARRAY[2, 2, 2, 2, 2, 2]);
  ASSERT result.score = 800, 'Six 2s should score 800';
  
  result := calculate_turn_score(ARRAY[3, 3, 3, 3, 3, 3]);
  ASSERT result.score = 1200, 'Six 3s should score 1200';
  
  result := calculate_turn_score(ARRAY[4, 4, 4, 4, 4, 4]);
  ASSERT result.score = 1600, 'Six 4s should score 1600';
  
  result := calculate_turn_score(ARRAY[5, 5, 5, 5, 5, 5]);
  ASSERT result.score = 2000, 'Six 5s should score 2000';
  
  result := calculate_turn_score(ARRAY[6, 6, 6, 6, 6, 6]);
  ASSERT result.score = 2400, 'Six 6s should score 2400';
  
  -- Test straight (1-6)
  result := calculate_turn_score(ARRAY[1, 2, 3, 4, 5, 6]);
  ASSERT result.score = 1000, 'Straight 1-6 should score 1000';
  
  result := calculate_turn_score(ARRAY[6, 5, 4, 3, 2, 1]);
  ASSERT result.score = 1000, 'Straight 6-1 should score 1000';
  
  result := calculate_turn_score(ARRAY[3, 1, 4, 6, 2, 5]);
  ASSERT result.score = 1000, 'Mixed order straight should score 1000';

  -- Test three pairs
  result := calculate_turn_score(ARRAY[2, 2, 3, 3, 4, 4]);
  ASSERT result.score = 750, 'Three pairs should score 750';
  
  result := calculate_turn_score(ARRAY[1, 1, 3, 3, 6, 6]);
  ASSERT result.score = 750, 'Three pairs with 1s should score 750';
  
  result := calculate_turn_score(ARRAY[5, 5, 2, 2, 4, 4]);
  ASSERT result.score = 750, 'Three pairs with 5s should score 750';
  
  -- Test combinations
  result := calculate_turn_score(ARRAY[1, 1, 1, 5]);
  ASSERT result.score = 1050, 'Three 1s and a 5 should score 1050';
  
  result := calculate_turn_score(ARRAY[5, 5, 5, 1]);
  ASSERT result.score = 600, 'Three 5s and a 1 should score 600';
  
  result := calculate_turn_score(ARRAY[2, 2, 2, 1, 5]);
  ASSERT result.score = 350, 'Three 2s with 1 and 5 should score 350';
  
  -- Test non-scoring dice
  result := calculate_turn_score(ARRAY[2]);
  ASSERT result.score = 0, 'Single 2 should score 0';
  
  result := calculate_turn_score(ARRAY[3, 4, 6]);
  ASSERT result.score = 0, 'Non-scoring combination should score 0';
  
  RETURN NEXT 'All calculate_turn_score tests passed!';
END;
$$;


ALTER FUNCTION "public"."test_calculate_turn_score"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_current_players"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE game_rooms
    SET current_players = current_players + 1
    WHERE id = NEW.game_id;
  ELSIF TG_OP = 'UPDATE' AND OLD.is_active != NEW.is_active THEN
    IF NEW.is_active THEN
      UPDATE game_rooms
      SET current_players = current_players + 1
      WHERE id = NEW.game_id;
    ELSE
      UPDATE game_rooms
      SET current_players = current_players - 1
      WHERE id = NEW.game_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_current_players"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  new.updated_at = now();
  return new;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_dice_selection"("roll" integer[], "selection" integer[]) RETURNS boolean
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
DECLARE
  valid boolean;
BEGIN
  -- Basic validation that selected dice exist in the roll
  SELECT bool_and(s = any(roll))
  INTO valid
  FROM unnest(selection) s;
  RETURN valid;
END;
$$;


ALTER FUNCTION "public"."validate_dice_selection"("roll" integer[], "selection" integer[]) OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."game_history" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "game_room_id" "uuid",
    "winner_id" "uuid",
    "final_scores" "jsonb" NOT NULL,
    "duration" interval,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."game_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."game_rooms" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "created_by" "uuid",
    "status" "public"."game_status" DEFAULT 'waiting'::"public"."game_status" NOT NULL,
    "max_players" integer DEFAULT 4,
    "current_players" integer DEFAULT 0,
    "winner_id" "uuid",
    "invite_code" character(6) NOT NULL,
    "ended_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."game_rooms" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."game_states" (
    "game_id" "uuid" NOT NULL,
    "current_turn_number" integer NOT NULL,
    "current_player_id" "uuid" NOT NULL,
    "current_turn" "uuid",
    "last_updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."game_states" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."game_turns" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "game_id" "uuid" NOT NULL,
    "player_id" "uuid" NOT NULL,
    "turn_number" integer NOT NULL,
    "started_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "ended_at" timestamp with time zone,
    "score_gained" integer DEFAULT 0 NOT NULL,
    "is_farkle" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."game_turns" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "username" "text",
    "avatar_name" "text" DEFAULT 'default'::"text",
    "has_changed_username" boolean DEFAULT false,
    "total_games" integer DEFAULT 0,
    "games_won" integer DEFAULT 0,
    "highest_score" integer DEFAULT 0,
    "onboarding_step" "text" DEFAULT 'username'::"text",
    "onboarding_completed" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."turn_actions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "turn_id" "uuid" NOT NULL,
    "action_number" integer NOT NULL,
    "dice_values" integer[] NOT NULL,
    "kept_dice" integer[] DEFAULT ARRAY[]::integer[] NOT NULL,
    "score" integer DEFAULT 0 NOT NULL,
    "outcome" "public"."turn_action_outcome",
    "available_dice" integer,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."turn_actions" OWNER TO "postgres";


ALTER TABLE ONLY "public"."game_history"
    ADD CONSTRAINT "game_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."game_players"
    ADD CONSTRAINT "game_players_game_id_player_order_key" UNIQUE ("game_id", "player_order");



ALTER TABLE ONLY "public"."game_players"
    ADD CONSTRAINT "game_players_game_id_user_id_key" UNIQUE ("game_id", "user_id");



ALTER TABLE ONLY "public"."game_players"
    ADD CONSTRAINT "game_players_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."game_rooms"
    ADD CONSTRAINT "game_rooms_invite_code_key" UNIQUE ("invite_code");



ALTER TABLE ONLY "public"."game_rooms"
    ADD CONSTRAINT "game_rooms_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."game_states"
    ADD CONSTRAINT "game_states_pkey" PRIMARY KEY ("game_id");



ALTER TABLE ONLY "public"."game_turns"
    ADD CONSTRAINT "game_turns_game_id_turn_number_key" UNIQUE ("game_id", "turn_number");



ALTER TABLE ONLY "public"."game_turns"
    ADD CONSTRAINT "game_turns_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_username_key" UNIQUE ("username");



ALTER TABLE ONLY "public"."turn_actions"
    ADD CONSTRAINT "turn_actions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."turn_actions"
    ADD CONSTRAINT "turn_actions_turn_id_action_number_key" UNIQUE ("turn_id", "action_number");



CREATE OR REPLACE TRIGGER "maintain_current_players" AFTER INSERT OR UPDATE OF "is_active" ON "public"."game_players" FOR EACH ROW EXECUTE FUNCTION "public"."update_current_players"();



CREATE OR REPLACE TRIGGER "update_game_rooms_updated_at" BEFORE UPDATE ON "public"."game_rooms" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."game_history"
    ADD CONSTRAINT "game_history_game_room_id_fkey" FOREIGN KEY ("game_room_id") REFERENCES "public"."game_rooms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."game_history"
    ADD CONSTRAINT "game_history_winner_id_fkey" FOREIGN KEY ("winner_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."game_players"
    ADD CONSTRAINT "game_players_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "public"."game_rooms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."game_players"
    ADD CONSTRAINT "game_players_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."game_rooms"
    ADD CONSTRAINT "game_rooms_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."game_rooms"
    ADD CONSTRAINT "game_rooms_winner_id_fkey" FOREIGN KEY ("winner_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."game_states"
    ADD CONSTRAINT "game_states_current_player_id_fkey" FOREIGN KEY ("current_player_id") REFERENCES "public"."game_players"("id");



ALTER TABLE ONLY "public"."game_states"
    ADD CONSTRAINT "game_states_current_turn_fkey" FOREIGN KEY ("current_turn") REFERENCES "public"."game_turns"("id");



ALTER TABLE ONLY "public"."game_states"
    ADD CONSTRAINT "game_states_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "public"."game_rooms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."game_turns"
    ADD CONSTRAINT "game_turns_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "public"."game_rooms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."game_turns"
    ADD CONSTRAINT "game_turns_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "public"."game_players"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."turn_actions"
    ADD CONSTRAINT "turn_actions_turn_id_fkey" FOREIGN KEY ("turn_id") REFERENCES "public"."game_turns"("id") ON DELETE CASCADE;



CREATE POLICY "Anyone can view game history" ON "public"."game_history" FOR SELECT USING (true);



CREATE POLICY "Game players are viewable by authenticated users" ON "public"."game_players" FOR SELECT USING (true);



CREATE POLICY "Game rooms are viewable by authenticated users" ON "public"."game_rooms" FOR SELECT USING (true);



CREATE POLICY "Game states are viewable by authenticated users" ON "public"."game_states" FOR SELECT USING (true);



CREATE POLICY "Players can join rooms that are waiting and not full" ON "public"."game_players" FOR INSERT TO "authenticated" WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."game_rooms"
  WHERE (("game_rooms"."id" = "game_players"."game_id") AND ("game_rooms"."status" = 'waiting'::"public"."game_status") AND ("game_rooms"."current_players" < "game_rooms"."max_players") AND ("game_rooms"."created_by" <> "auth"."uid"())))) AND (NOT (EXISTS ( SELECT 1
   FROM "public"."game_players" "game_players_1"
  WHERE (("game_players_1"."game_id" = "game_players_1"."game_id") AND ("game_players_1"."user_id" = "auth"."uid"())))))));



CREATE POLICY "Players can update game state" ON "public"."game_states" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."game_players"
  WHERE (("game_players"."game_id" = "game_states"."game_id") AND ("game_players"."user_id" = "auth"."uid"()) AND ("game_players"."is_active" = true)))));



CREATE POLICY "Players can update their own status in a game" ON "public"."game_players" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Room creators can add players" ON "public"."game_players" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."game_rooms"
  WHERE (("game_rooms"."id" = "game_players"."game_id") AND ("game_rooms"."created_by" = "auth"."uid"())))));



CREATE POLICY "Turn actions are viewable by authenticated users" ON "public"."turn_actions" FOR SELECT USING (true);



CREATE POLICY "Turns are viewable by authenticated users" ON "public"."game_turns" FOR SELECT USING (true);



CREATE POLICY "Users can create game rooms" ON "public"."game_rooms" FOR INSERT WITH CHECK (("auth"."uid"() = "created_by"));



CREATE POLICY "Users can insert their own profile" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can update their own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view any profile" ON "public"."profiles" FOR SELECT USING (true);



ALTER TABLE "public"."game_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."game_players" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."game_rooms" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."game_states" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."game_turns" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."turn_actions" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."game_players";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."game_rooms";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."game_states";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."game_turns";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."turn_actions";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";




















































































































































































GRANT ALL ON FUNCTION "public"."calculate_turn_score"("selected_dice" integer[]) TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_turn_score"("selected_dice" integer[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_turn_score"("selected_dice" integer[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."check_farkle"("roll" integer[]) TO "anon";
GRANT ALL ON FUNCTION "public"."check_farkle"("roll" integer[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_farkle"("roll" integer[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."create_room"("p_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_room"("p_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_room"("p_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."end_game"("p_game_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."end_game"("p_game_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."end_game"("p_game_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."end_turn"("p_game_id" "uuid", "p_final_score" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."end_turn"("p_game_id" "uuid", "p_final_score" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."end_turn"("p_game_id" "uuid", "p_final_score" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_invite_code"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_invite_code"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_invite_code"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_available_dice"("p_turn_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_available_dice"("p_turn_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_available_dice"("p_turn_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."game_players" TO "anon";
GRANT ALL ON TABLE "public"."game_players" TO "authenticated";
GRANT ALL ON TABLE "public"."game_players" TO "service_role";



GRANT ALL ON FUNCTION "public"."join_game"("room_id" "uuid", "code" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."join_game"("room_id" "uuid", "code" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."join_game"("room_id" "uuid", "code" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."leave_game"("room_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."leave_game"("room_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."leave_game"("room_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."perform_roll"("p_game_id" "uuid", "p_num_dice" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."perform_roll"("p_game_id" "uuid", "p_num_dice" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."perform_roll"("p_game_id" "uuid", "p_num_dice" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."process_turn_action"("p_game_id" "uuid", "p_outcome" "public"."turn_action_outcome", "p_kept_dice" integer[]) TO "anon";
GRANT ALL ON FUNCTION "public"."process_turn_action"("p_game_id" "uuid", "p_outcome" "public"."turn_action_outcome", "p_kept_dice" integer[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_turn_action"("p_game_id" "uuid", "p_outcome" "public"."turn_action_outcome", "p_kept_dice" integer[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."remove_first_occurrence"("p_kept_dice" integer[], "v_kept_dice" integer[]) TO "anon";
GRANT ALL ON FUNCTION "public"."remove_first_occurrence"("p_kept_dice" integer[], "v_kept_dice" integer[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."remove_first_occurrence"("p_kept_dice" integer[], "v_kept_dice" integer[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."roll_dice"("num_dice" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."roll_dice"("num_dice" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."roll_dice"("num_dice" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."run_all_tests"() TO "anon";
GRANT ALL ON FUNCTION "public"."run_all_tests"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."run_all_tests"() TO "service_role";



GRANT ALL ON FUNCTION "public"."start_game"("room_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."start_game"("room_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."start_game"("room_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."test_calculate_turn_score"() TO "anon";
GRANT ALL ON FUNCTION "public"."test_calculate_turn_score"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."test_calculate_turn_score"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_current_players"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_current_players"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_current_players"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_dice_selection"("roll" integer[], "selection" integer[]) TO "anon";
GRANT ALL ON FUNCTION "public"."validate_dice_selection"("roll" integer[], "selection" integer[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_dice_selection"("roll" integer[], "selection" integer[]) TO "service_role";


















GRANT ALL ON TABLE "public"."game_history" TO "anon";
GRANT ALL ON TABLE "public"."game_history" TO "authenticated";
GRANT ALL ON TABLE "public"."game_history" TO "service_role";



GRANT ALL ON TABLE "public"."game_rooms" TO "anon";
GRANT ALL ON TABLE "public"."game_rooms" TO "authenticated";
GRANT ALL ON TABLE "public"."game_rooms" TO "service_role";



GRANT ALL ON TABLE "public"."game_states" TO "anon";
GRANT ALL ON TABLE "public"."game_states" TO "authenticated";
GRANT ALL ON TABLE "public"."game_states" TO "service_role";



GRANT ALL ON TABLE "public"."game_turns" TO "anon";
GRANT ALL ON TABLE "public"."game_turns" TO "authenticated";
GRANT ALL ON TABLE "public"."game_turns" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."turn_actions" TO "anon";
GRANT ALL ON TABLE "public"."turn_actions" TO "authenticated";
GRANT ALL ON TABLE "public"."turn_actions" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "service_role";






























RESET ALL;
