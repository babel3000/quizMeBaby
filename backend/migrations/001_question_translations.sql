-- Run this in the Supabase SQL editor before using the translate-questions script.

CREATE TABLE IF NOT EXISTS question_translations (
  id             uuid         DEFAULT gen_random_uuid() PRIMARY KEY,
  question_id    uuid         NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  locale         text         NOT NULL,
  text           text         NOT NULL,
  correct_answer text         NOT NULL,
  options        jsonb        NOT NULL,
  created_at     timestamptz  DEFAULT now(),
  UNIQUE(question_id, locale)
);

CREATE INDEX IF NOT EXISTS idx_qt_question_id ON question_translations(question_id);
CREATE INDEX IF NOT EXISTS idx_qt_locale      ON question_translations(locale);
