-- Migration 008: Add end_game function

-- Create function to end game
CREATE OR REPLACE FUNCTION end_game(p_game_id UUID)
RETURNS void AS $$
BEGIN
  -- Verify user is room creator
  IF NOT EXISTS (
    SELECT 1 FROM game_rooms
    WHERE id = p_game_id
    AND created_by = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Only room creator can end the game';
  END IF;

  -- Update room status to completed
  UPDATE game_rooms
  SET 
    status = 'completed',
    ended_at = now()
  WHERE id = p_game_id
  AND status = 'in_progress';

  -- Record game history
  INSERT INTO game_history (
    game_room_id,
    winner_id,
    final_scores,
    duration
  )
  SELECT 
    p_game_id,
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM game_players 
        WHERE game_id = p_game_id 
        AND score >= 10000
      ) THEN (
        SELECT player_id 
        FROM game_players 
        WHERE game_id = p_game_id 
        ORDER BY score DESC 
        LIMIT 1
      )
      ELSE NULL 
    END,
    (
      SELECT jsonb_object_agg(gp.user_id, gp.score)
      FROM game_players gp
      WHERE gp.game_id = p_game_id
    ),
    age(now(), gr.created_at)
  FROM game_rooms gr
  WHERE gr.id = p_game_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 