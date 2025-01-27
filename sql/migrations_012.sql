-- Migration 012: Fix RLS policies for game_players

-- Drop existing policies
DROP POLICY IF EXISTS "Game players are viewable by authenticated users" ON public.game_players;
DROP POLICY IF EXISTS "Players can join rooms that are waiting and not full" ON public.game_players;
DROP POLICY IF EXISTS "Players can update their own status in a game" ON public.game_players;
DROP POLICY IF EXISTS "Room creators can add players" ON public.game_players;

-- Create new policies
CREATE POLICY "Game players are viewable by authenticated users"
  ON public.game_players FOR SELECT
  USING (true);

-- Allow room creators to insert players
CREATE POLICY "Room creators can add players"
  ON public.game_players FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM game_rooms
      WHERE id = game_id
      AND created_by = auth.uid()
    )
  );

-- Allow players to join rooms
CREATE POLICY "Players can join rooms that are waiting and not full"
  ON public.game_players FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM game_rooms
      WHERE id = game_id
      AND status = 'waiting'
      AND current_players < max_players
      AND created_by != auth.uid()  -- Don't apply this policy for room creators
    )
    AND
    NOT EXISTS (
      SELECT 1 FROM game_players
      WHERE game_id = game_id
      AND user_id = auth.uid()
    )
  );

-- Allow players to update their own status
CREATE POLICY "Players can update their own status in a game"
  ON public.game_players FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid()); 