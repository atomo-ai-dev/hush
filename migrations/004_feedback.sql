-- User bug reports submitted from the "버그 신고" button.
CREATE TABLE feedback (
  id BIGSERIAL PRIMARY KEY,
  session_id BIGINT REFERENCES sessions (id) ON DELETE SET NULL,
  message TEXT NOT NULL CHECK (char_length(message) BETWEEN 1 AND 2000),
  page_url TEXT CHECK (page_url IS NULL OR char_length(page_url) <= 500),
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
