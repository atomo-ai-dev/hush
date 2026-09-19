-- Moderation: reports from distinct sessions; content with enough reports is hidden.
ALTER TABLE posts ADD COLUMN hidden_at TIMESTAMPTZ;
ALTER TABLE comments ADD COLUMN hidden_at TIMESTAMPTZ;

DROP INDEX posts_created_at_idx;
CREATE INDEX posts_visible_created_at_idx ON posts (created_at DESC, id DESC)
  WHERE hidden_at IS NULL;

CREATE TABLE reports (
  id BIGSERIAL PRIMARY KEY,
  target_type TEXT NOT NULL CHECK (target_type IN ('post', 'comment')),
  target_id BIGINT NOT NULL,
  session_id BIGINT NOT NULL REFERENCES sessions (id) ON DELETE CASCADE,
  reason TEXT CHECK (reason IS NULL OR char_length(reason) <= 200),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (target_type, target_id, session_id)
);
