BEGIN IMMEDIATE;

-- D-029 / R5.8 : la conversation du lieu. Un message de l'utilisateur est
-- aussi une note (source citable) ; une question de l'agent garde ce qui la
-- motive (le creux de la mémoire visé et les objets cités).
CREATE TABLE conversation_turns (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'agent')),
  text TEXT NOT NULL,
  source_id TEXT REFERENCES sources(id),
  gap TEXT,
  motive_json TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_conversation_turns ON conversation_turns(workspace_id, created_at);

INSERT INTO schema_migrations(version, applied_at) VALUES (14, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));

COMMIT;
