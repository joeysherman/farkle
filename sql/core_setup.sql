-- Create custom type for game status
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'game_status') THEN
    CREATE TYPE game_status AS ENUM ('waiting', 'in_progress', 'completed');
  END IF;
END $$;

-- Create required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create realtime subscriptions
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime;
COMMIT;

-- Create updated_at timestamp trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS trigger AS $$
BEGIN
  new.updated_at = now();
  return new;
END;
$$ LANGUAGE plpgsql; 