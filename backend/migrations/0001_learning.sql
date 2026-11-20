-- Sophie learning data (milestone 2: sync across devices).
-- NOT applied yet: milestone 1 keeps all learning data on the phone.
-- Apply with: npx wrangler d1 migrations apply sophie-learning --remote
-- Mirrors mobile/src/features/learning/types.ts.

CREATE TABLE IF NOT EXISTS learners (
  id TEXT PRIMARY KEY,                -- server-side id (hashed device id until accounts exist)
  first_name TEXT,
  level TEXT CHECK (level IN ('intermediate', 'upper-intermediate', 'advanced')),
  correction_style TEXT NOT NULL DEFAULT 'balanced' CHECK (correction_style IN ('relaxed', 'balanced', 'detailed')),
  focus TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  started_at INTEGER NOT NULL,
  ended_at INTEGER NOT NULL,
  duration_sec INTEGER NOT NULL,
  end_reason TEXT,
  review_json TEXT                    -- CoachReport, once reviewed
);
CREATE INDEX IF NOT EXISTS idx_sessions_learner ON sessions(learner_id, started_at DESC);

CREATE TABLE IF NOT EXISTS mistakes (
  learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  key TEXT NOT NULL,                  -- normalised suggestion
  original TEXT NOT NULL,
  suggestion TEXT NOT NULL,
  explanation TEXT NOT NULL,
  category TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 1,
  first_seen_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  PRIMARY KEY (learner_id, key)
);

CREATE TABLE IF NOT EXISTS expressions (
  id TEXT PRIMARY KEY,
  learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  phrase TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('idiom', 'phrasal-verb', 'collocation', 'expression')),
  meaning TEXT NOT NULL,
  example TEXT NOT NULL,
  synonyms_json TEXT NOT NULL DEFAULT '[]',
  origin TEXT NOT NULL CHECK (origin IN ('starter', 'conversation')),
  session_id TEXT,
  practised INTEGER NOT NULL DEFAULT 0,
  saved_at INTEGER NOT NULL,
  UNIQUE (learner_id, phrase)
);

-- Transcripts are deliberately not stored server-side.
