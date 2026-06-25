-- ============================================================================
-- AI Canvas migration — adds canvas state to projects + agent chat history.
-- Run with:  npm run db:canvas
-- Idempotent (safe to re-run).
-- ============================================================================

-- Canvas state lives directly on the project row as JSONB (fast autosave).
ALTER TABLE projects ADD COLUMN IF NOT EXISTS nodes      JSONB       NOT NULL DEFAULT '[]';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS edges      JSONB       NOT NULL DEFAULT '[]';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Persistent agent (updream) conversation per project.
CREATE TABLE IF NOT EXISTS agent_messages (
  id         SERIAL PRIMARY KEY,
  project_id INTEGER     NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id    TEXT        NOT NULL,                 -- Neon Auth user id
  role       TEXT        NOT NULL,                 -- user | assistant
  content    TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_messages_project ON agent_messages (project_id);
