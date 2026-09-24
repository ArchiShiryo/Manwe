BEGIN IMMEDIATE;

-- Passe critique ciblée (R3.4) : données ignorées, explication plus simple,
-- généralisation excessive, alternative non distincte. Une critique n'est
-- jamais une preuve ; elle doit être traitée par une révision ultérieure.
CREATE TABLE hypothesis_critiques (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  hypothesis_id TEXT NOT NULL REFERENCES hypotheses(id) ON DELETE CASCADE,
  findings_json TEXT NOT NULL,
  created_revision INTEGER NOT NULL,
  resolved_revision INTEGER,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_hypothesis_critiques_hypothesis ON hypothesis_critiques(hypothesis_id, resolved_revision);

INSERT INTO schema_migrations(version, applied_at)
VALUES (6, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));

COMMIT;
