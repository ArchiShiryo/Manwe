BEGIN IMMEDIATE;

CREATE TABLE analysis_requests (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  base_revision INTEGER NOT NULL CHECK (base_revision >= 0),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('demo-fixture', 'assisted', 'automatic')),
  provider_id TEXT NOT NULL,
  task TEXT NOT NULL CHECK (task IN ('extract', 'interpret', 'revise', 'explore')),
  prompt_version TEXT NOT NULL,
  context_hash TEXT NOT NULL,
  context_json TEXT NOT NULL,
  allowed_operations_json TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('awaiting_response', 'ready_for_review', 'needs_context', 'applied', 'no_change', 'rejected', 'stale', 'cancelled', 'expired')),
  resolved_response_id TEXT,
  cancelled_at TEXT
);

CREATE TABLE analysis_responses (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  request_id TEXT NOT NULL REFERENCES analysis_requests(id) ON DELETE CASCADE,
  response_hash TEXT NOT NULL,
  raw_json TEXT NOT NULL,
  normalized_json TEXT,
  outcome TEXT,
  declared_model TEXT,
  verified_model TEXT,
  received_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('ready_for_review', 'needs_context', 'rejected', 'applied', 'no_change', 'stale')),
  rejection_code TEXT,
  rejection_message TEXT,
  application_result_json TEXT,
  applied_at TEXT,
  UNIQUE (request_id, response_hash)
);

CREATE TABLE revisions_v2 (
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL,
  command_type TEXT NOT NULL CHECK (command_type IN ('capture', 'annotate', 'goal.update', 'analysis.apply')),
  changed_refs_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (workspace_id, revision)
);

INSERT INTO revisions_v2(workspace_id, revision, command_type, changed_refs_json, created_at)
SELECT workspace_id, revision, command_type, changed_refs_json, created_at FROM revisions;

DROP TABLE revisions;
ALTER TABLE revisions_v2 RENAME TO revisions;

CREATE INDEX idx_analysis_requests_workspace_status ON analysis_requests(workspace_id, status, created_at DESC);
CREATE INDEX idx_analysis_responses_request ON analysis_responses(request_id, received_at DESC);

INSERT INTO schema_migrations(version, applied_at)
VALUES (2, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));

COMMIT;
