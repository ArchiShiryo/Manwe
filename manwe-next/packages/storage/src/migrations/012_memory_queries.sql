BEGIN IMMEDIATE;

-- D-023 : les requêtes du modèle dans la mémoire, en lecture seule, sont
-- journalisées avec l'analyse ; les objets servis deviennent référençables
-- dans la proposition de cette analyse.
CREATE TABLE analysis_queries (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  request_id TEXT NOT NULL,
  name TEXT NOT NULL,
  args_json TEXT NOT NULL,
  served_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_analysis_queries_request ON analysis_queries(workspace_id, request_id);

INSERT INTO schema_migrations(version, applied_at) VALUES (12, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));

COMMIT;
