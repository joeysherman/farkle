-- Test functions for game_turns.sql
-- These tests verify the scoring and game mechanics functions

-- Test function for calculate_turn_score
CREATE OR REPLACE FUNCTION test_calculate_turn_score()
RETURNS SETOF text AS $$
BEGIN
  -- Test single 1s and 5s
  ASSERT calculate_turn_score(ARRAY[1]) = 100, 'Single 1 should score 100';
  ASSERT calculate_turn_score(ARRAY[5]) = 50, 'Single 5 should score 50';
  ASSERT calculate_turn_score(ARRAY[1, 5]) = 150, 'One 1 and one 5 should score 150';
  
  -- Test three of a kind
  ASSERT calculate_turn_score(ARRAY[1, 1, 1]) = 1000, 'Three 1s should score 1000';
  ASSERT calculate_turn_score(ARRAY[2, 2, 2]) = 200, 'Three 2s should score 200';
  ASSERT calculate_turn_score(ARRAY[3, 3, 3]) = 300, 'Three 3s should score 300';
  ASSERT calculate_turn_score(ARRAY[4, 4, 4]) = 400, 'Three 4s should score 400';
  ASSERT calculate_turn_score(ARRAY[5, 5, 5]) = 500, 'Three 5s should score 500';
  ASSERT calculate_turn_score(ARRAY[6, 6, 6]) = 600, 'Three 6s should score 600';
  
  -- Test combinations
  ASSERT calculate_turn_score(ARRAY[1, 1, 1, 5]) = 1050, 'Three 1s and a 5 should score 1050';
  ASSERT calculate_turn_score(ARRAY[5, 5, 5, 1]) = 600, 'Three 5s and a 1 should score 600';
  ASSERT calculate_turn_score(ARRAY[2, 2, 2, 1, 5]) = 350, 'Three 2s with 1 and 5 should score 350';
  
  -- Test non-scoring dice
  ASSERT calculate_turn_score(ARRAY[2]) = 0, 'Single 2 should score 0';
  ASSERT calculate_turn_score(ARRAY[3, 4, 6]) = 0, 'Non-scoring combination should score 0';
  
  RETURN NEXT 'All calculate_turn_score tests passed!';
END;
$$ LANGUAGE plpgsql;

-- Function to run all tests
CREATE OR REPLACE FUNCTION run_all_tests()
RETURNS SETOF text AS $$
BEGIN
  RETURN QUERY SELECT * FROM test_calculate_turn_score();
END;
$$ LANGUAGE plpgsql; 