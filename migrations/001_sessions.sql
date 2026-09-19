-- Anonymous sessions: one row per browser cookie. Only the SHA-256 hash of the
-- cookie token is stored, so a database leak does not expose live sessions.
CREATE TABLE sessions (
  id BIGSERIAL PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  nickname TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
