-- Server-side error log: unhandled API errors and internal reports via /api/_errors.
CREATE TABLE error_logs (
  id BIGSERIAL PRIMARY KEY,
  source TEXT NOT NULL,
  method TEXT,
  path TEXT,
  message TEXT NOT NULL,
  stack TEXT,
  context JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX error_logs_created_at_idx ON error_logs (created_at DESC);
