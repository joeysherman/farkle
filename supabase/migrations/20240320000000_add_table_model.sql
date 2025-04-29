-- Add table_model column to game_rooms table
ALTER TABLE game_rooms
ADD COLUMN table_model text CHECK (table_model IN ('boxing_ring', 'coliseum'));

-- Set default value for existing rows
UPDATE game_rooms
SET table_model = 'boxing_ring'
WHERE table_model IS NULL; 