BEGIN IMMEDIATE;

CREATE TABLE import_batches (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  format TEXT NOT NULL CHECK (format IN ('json', 'csv')),
  source_name TEXT,
  source_system TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  imported_at TEXT NOT NULL,
  result_json TEXT NOT NULL,
  UNIQUE (workspace_id, content_hash)
);

CREATE TABLE person_external_keys (
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  person_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  source_system TEXT NOT NULL,
  external_key TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (workspace_id, source_system, external_key)
);

CREATE TABLE identity_ambiguities (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  mention TEXT NOT NULL,
  candidate_person_ids_json TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open', 'resolved', 'dismissed')),
  created_at TEXT NOT NULL,
  resolved_at TEXT
);

ALTER TABLE analysis_responses ADD COLUMN provider_usage_json TEXT;
ALTER TABLE analysis_responses ADD COLUMN provider_cost_json TEXT;
ALTER TABLE analysis_responses ADD COLUMN inference_duration_ms INTEGER CHECK (inference_duration_ms IS NULL OR inference_duration_ms >= 0);
ALTER TABLE analysis_responses ADD COLUMN manual_wait_duration_ms INTEGER CHECK (manual_wait_duration_ms IS NULL OR manual_wait_duration_ms >= 0);

CREATE TABLE revisions_v3 (
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL,
  command_type TEXT NOT NULL CHECK (command_type IN ('capture', 'import', 'identity.resolve', 'annotate', 'goal.update', 'analysis.apply')),
  changed_refs_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (workspace_id, revision)
);

INSERT INTO revisions_v3(workspace_id, revision, command_type, changed_refs_json, created_at)
SELECT workspace_id, revision, command_type, changed_refs_json, created_at FROM revisions;

DROP TABLE revisions;
ALTER TABLE revisions_v3 RENAME TO revisions;

CREATE INDEX idx_import_batches_workspace ON import_batches(workspace_id, imported_at DESC);
CREATE INDEX idx_external_keys_person ON person_external_keys(workspace_id, person_id);
CREATE INDEX idx_identity_ambiguities_workspace ON identity_ambiguities(workspace_id, status, created_at DESC);

INSERT INTO schema_migrations(version, applied_at)
VALUES (3, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));

COMMIT;
