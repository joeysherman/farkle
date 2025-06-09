-- Drop all triggers
DROP TRIGGER IF EXISTS update_game_rooms_updated_at ON public.game_rooms;
DROP TRIGGER IF EXISTS maintain_current_players ON public.game_players;
DROP TRIGGER IF EXISTS update_friends_updated_at ON public.friends;
DROP TRIGGER IF EXISTS update_friend_invites_updated_at ON public.friend_invites;
DROP TRIGGER IF EXISTS update_game_invites_updated_at ON public.game_invites;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Drop all tables
DROP TABLE IF EXISTS public.game_history CASCADE;
DROP TABLE IF EXISTS public.turn_actions CASCADE;
DROP TABLE IF EXISTS public.game_turns CASCADE;
DROP TABLE IF EXISTS public.game_states CASCADE;
DROP TABLE IF EXISTS public.game_players CASCADE;
DROP TABLE IF EXISTS public.game_invites CASCADE;
DROP TABLE IF EXISTS public.game_rooms CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.friends CASCADE;
DROP TABLE IF EXISTS public.friend_invites CASCADE;
DROP TABLE IF EXISTS public.bot_players CASCADE;

-- Drop all functions
DROP FUNCTION IF EXISTS end_game(UUID);
DROP FUNCTION IF EXISTS end_turn(UUID, INTEGER);
DROP FUNCTION IF EXISTS check_farkle(INTEGER[]);
DROP FUNCTION IF EXISTS validate_dice_selection(INTEGER[], INTEGER[]);
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
DROP FUNCTION IF EXISTS remove_first_occurrence(INTEGER[], INTEGER[]);
DROP FUNCTION IF EXISTS select_dice(UUID, INTEGER[]);
DROP FUNCTION IF EXISTS update_current_players();
DROP FUNCTION IF EXISTS update_room_settings(UUID, TEXT);
DROP FUNCTION IF EXISTS send_friend_invite(UUID);
DROP FUNCTION IF EXISTS accept_friend_invite(UUID);
DROP FUNCTION IF EXISTS reject_friend_invite(UUID);
DROP FUNCTION IF EXISTS remove_friend(UUID);
DROP FUNCTION IF EXISTS block_user(UUID);
DROP FUNCTION IF EXISTS unblock_user(UUID);
DROP FUNCTION IF EXISTS send_game_invite(UUID, UUID);
DROP FUNCTION IF EXISTS respond_to_game_invite(UUID, BOOLEAN);


DROP FUNCTION IF EXISTS add_bot_player(UUID, bot_difficulty);
DROP FUNCTION IF EXISTS score_options(INTEGER[]);
DROP FUNCTION IF EXISTS farkle_probability(INTEGER);
DROP FUNCTION IF EXISTS should_bank(INTEGER, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS get_bot_risk_limit(bot_difficulty);
DROP FUNCTION IF EXISTS bot_play_turn(UUID);
DROP FUNCTION IF EXISTS handle_bot_turns();
DROP FUNCTION IF EXISTS cron_play_bot_turns();
DROP FUNCTION IF EXISTS handle_new_user();

DROP FUNCTION IF EXISTS make_bot_decision(INTEGER[], INTEGER, INTEGER, INTEGER, INTEGER, UUID, UUID);
DROP FUNCTION IF EXISTS test_bot_decisions();
DROP FUNCTION IF EXISTS test_bot_strategy_scenarios();
DROP FUNCTION IF EXISTS run_bot_tests();

-- Drop types (after functions that depend on them)
DROP TYPE IF EXISTS turn_score_result CASCADE;
DROP TYPE IF EXISTS turn_action_outcome CASCADE;
DROP TYPE IF EXISTS game_status CASCADE;
DROP TYPE IF EXISTS friend_status CASCADE;
DROP TYPE IF EXISTS game_invite_status CASCADE;
DROP TYPE IF EXISTS bot_difficulty CASCADE;

-- Drop publication
DROP PUBLICATION IF EXISTS supabase_realtime;

-- Delete all auth.users
DELETE FROM auth.users;

-- Remove all cron jobs
SELECT cron.unschedule('play-bot-turns');

-- Run the merged SQL to recreate everything


