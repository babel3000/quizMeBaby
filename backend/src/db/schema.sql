-- Run this in your Supabase SQL editor

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('general', 'music', 'video', 'image')),
  icon TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  text TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('multiple_choice', 'music', 'video', 'image')),
  media_url TEXT,
  correct_answer TEXT NOT NULL,
  options JSONB,
  points INT DEFAULT 1000,
  time_limit INT DEFAULT 30,
  difficulty TEXT CHECK (difficulty IN ('easy', 'medium', 'hard')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE question_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
  locale TEXT NOT NULL,
  text TEXT NOT NULL,
  correct_answer TEXT NOT NULL,
  options JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (question_id, locale)
);

CREATE TABLE game_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(6) UNIQUE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('lobby', 'active', 'finished')) DEFAULT 'lobby',
  current_question_index INT DEFAULT -1,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ
);

CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES game_sessions(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL,
  socket_id TEXT,
  score INT DEFAULT 0,
  is_host BOOLEAN DEFAULT FALSE,
  joined_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES game_sessions(id) ON DELETE CASCADE,
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  question_id UUID REFERENCES questions(id),
  answer TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL,
  points_awarded INT DEFAULT 0,
  time_taken FLOAT,
  answered_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed categories
INSERT INTO categories (name, type, icon) VALUES
  ('General Knowledge', 'general', '🧠'),
  ('Music', 'music', '🎵'),
  ('Movies & TV', 'general', '🎬'),
  ('Science', 'general', '🔬'),
  ('Sports', 'general', '⚽'),
  ('Video Round', 'video', '📺'),
  ('Picture Round', 'image', '🖼️');

-- Seed sample questions
INSERT INTO questions (category_id, text, type, correct_answer, options, points, time_limit)
SELECT c.id, q.text, q.type::TEXT, q.correct_answer, q.options::JSONB, q.points, q.time_limit
FROM categories c, (VALUES
  ('General Knowledge', 'What is the capital of France?', 'multiple_choice', 'Paris', '["Paris","London","Berlin","Madrid"]', 1000, 20),
  ('General Knowledge', 'How many sides does a hexagon have?', 'multiple_choice', '6', '["5","6","7","8"]', 1000, 15),
  ('General Knowledge', 'What year did World War II end?', 'multiple_choice', '1945', '["1943","1944","1945","1946"]', 1000, 20),
  ('General Knowledge', 'Who painted the Mona Lisa?', 'multiple_choice', 'Leonardo da Vinci', '["Michelangelo","Leonardo da Vinci","Raphael","Donatello"]', 1000, 20),
  ('Movies & TV', 'In which film does the character Jack Sparrow appear?', 'multiple_choice', 'Pirates of the Caribbean', '["Pirates of the Caribbean","Treasure Island","The Goonies","Hook"]', 1000, 20),
  ('Science', 'What is the chemical symbol for gold?', 'multiple_choice', 'Au', '["Go","Gd","Au","Ag"]', 1000, 15),
  ('Sports', 'How many players are on a football (soccer) team?', 'multiple_choice', '11', '["9","10","11","12"]', 1000, 15)
) AS q(category_name, text, type, correct_answer, options, points, time_limit)
WHERE c.name = q.category_name;
