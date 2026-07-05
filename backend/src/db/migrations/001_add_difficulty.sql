-- Run this in your Supabase SQL editor to add difficulty to existing databases.
-- New installs: this is already included in schema.sql.

ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS difficulty TEXT
  CHECK (difficulty IN ('easy', 'medium', 'hard'));
