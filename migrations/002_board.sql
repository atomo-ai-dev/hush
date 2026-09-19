-- Board: posts, comments and one-like-per-session.
CREATE TABLE posts (
  id BIGSERIAL PRIMARY KEY,
  session_id BIGINT NOT NULL REFERENCES sessions (id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 100),
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 5000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX posts_created_at_idx ON posts (created_at DESC, id DESC);
CREATE INDEX posts_session_created_idx ON posts (session_id, created_at);

CREATE TABLE comments (
  id BIGSERIAL PRIMARY KEY,
  post_id BIGINT NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
  session_id BIGINT NOT NULL REFERENCES sessions (id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX comments_post_idx ON comments (post_id, created_at, id);
CREATE INDEX comments_session_created_idx ON comments (session_id, created_at);

CREATE TABLE post_likes (
  post_id BIGINT NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
  session_id BIGINT NOT NULL REFERENCES sessions (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, session_id)
);
