-- Drop all existing functions
DROP FUNCTION IF EXISTS check_player_count CASCADE;
DROP FUNCTION IF EXISTS generate_dice_roll CASCADE;
DROP FUNCTION IF EXISTS handle_new_user CASCADE;
DROP FUNCTION IF EXISTS initialize_game_state CASCADE;
DROP FUNCTION IF EXISTS invalidate_room_invitation CASCADE;
DROP FUNCTION IF EXISTS start_game_timer CASCADE;
DROP FUNCTION IF EXISTS stop_game_timer CASCADE;
DROP FUNCTION IF EXISTS vote_to_start_game CASCADE;
DROP FUNCTION IF EXISTS advance_turn CASCADE;
DROP FUNCTION IF EXISTS calculate_turn_score CASCADE;
DROP FUNCTION IF EXISTS check_farkle CASCADE;
DROP FUNCTION IF EXISTS create_room CASCADE;
DROP FUNCTION IF EXISTS end_game CASCADE;
DROP FUNCTION IF EXISTS generate_invite_code CASCADE;
DROP FUNCTION IF EXISTS join_game CASCADE;
DROP FUNCTION IF EXISTS leave_game CASCADE;
DROP FUNCTION IF EXISTS perform_roll CASCADE;
DROP FUNCTION IF EXISTS roll_dice CASCADE;
DROP FUNCTION IF EXISTS start_game CASCADE;
DROP FUNCTION IF EXISTS update_room_player_count CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column CASCADE;
DROP FUNCTION IF EXISTS validate_dice_selection CASCADE;

-- Drop all tables (in correct order due to dependencies)
DROP TABLE IF EXISTS turn_actions CASCADE;
DROP TABLE IF EXISTS game_turns CASCADE;
DROP TABLE IF EXISTS game_states CASCADE;
DROP TABLE IF EXISTS game_players CASCADE;
DROP TABLE IF EXISTS game_history CASCADE;
DROP TABLE IF EXISTS game_rooms CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- Drop custom types
DROP TYPE IF EXISTS game_status CASCADE;

-- Drop publications
DROP PUBLICATION IF EXISTS supabase_realtime;

-- Drop extensions (commented out as they might be needed by other apps)
-- DROP EXTENSION IF EXISTS "uuid-ossp" CASCADE; 