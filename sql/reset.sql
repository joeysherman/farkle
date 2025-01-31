-- Drop all tables
DROP TABLE IF EXISTS public.game_history CASCADE;
DROP TABLE IF EXISTS public.turn_actions CASCADE;
DROP TABLE IF EXISTS public.game_turns CASCADE;
DROP TABLE IF EXISTS public.game_states CASCADE;
DROP TABLE IF EXISTS public.game_players CASCADE;
DROP TABLE IF EXISTS public.game_rooms CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Drop all functions
DROP FUNCTION IF EXISTS end_game(UUID);
DROP FUNCTION IF EXISTS end_turn(UUID, INTEGER, BOOLEAN);
DROP FUNCTION IF EXISTS check_farkle(INTEGER[]);
DROP FUNCTION IF EXISTS validate_dice_selection(INTEGER[], INTEGER[]);
DROP FUNCTION IF EXISTS process_turn_action(UUID, INTEGER[], turn_action_outcome) CASCADE;
DROP FUNCTION IF EXISTS process_turn_action(UUID, turn_action_outcome) CASCADE;  -- Drop both overloads
DROP FUNCTION IF EXISTS perform_roll(UUID, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS get_available_dice(UUID);
DROP FUNCTION IF EXISTS calculate_turn_score(INTEGER[]);
DROP FUNCTION IF EXISTS roll_dice(INTEGER);
DROP FUNCTION IF EXISTS start_game(UUID);
DROP FUNCTION IF EXISTS leave_game(UUID) CASCADE;
DROP FUNCTION IF EXISTS join_game(UUID, TEXT);
DROP FUNCTION IF EXISTS create_room(TEXT);
DROP FUNCTION IF EXISTS generate_invite_code();
DROP FUNCTION IF EXISTS update_updated_at_column();
DROP FUNCTION IF EXISTS test_calculate_turn_score();
DROP FUNCTION IF EXISTS run_all_tests();

-- Drop types (after functions that depend on them)
DROP TYPE IF EXISTS turn_score_result;
DROP TYPE IF EXISTS turn_action_outcome;
DROP TYPE IF EXISTS game_status;

-- Drop publication
DROP PUBLICATION IF EXISTS supabase_realtime;

-- Run the merged SQL to recreate everything

