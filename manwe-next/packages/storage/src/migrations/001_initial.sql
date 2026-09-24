PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('user_entry', 'import')),
  content TEXT NOT NULL CHECK (length(content) > 0),
  content_hash TEXT NOT NULL,
  recorded_at TEXT NOT NULL,
  narrated_at TEXT,
  sensitivity TEXT NOT NULL CHECK (sensitivity IN ('personal', 'private', 'restricted')),
  created_at TEXT NOT NULL,
  UNIQUE (workspace_id, content_hash, recorded_at)
);

CREATE TABLE IF NOT EXISTS persons (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  resolution_status TEXT NOT NULL CHECK (resolution_status IN ('resolved', 'candidate', 'ambiguous')),
  row_version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS person_aliases (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  person_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL,
  UNIQUE (workspace_id, person_id, alias, source_id)
);

CREATE TABLE IF NOT EXISTS episodes (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  occurred_start TEXT,
  occurred_end TEXT,
  temporal_precision TEXT NOT NULL CHECK (temporal_precision IN ('exact', 'day', 'approximate', 'interval', 'unknown')),
  context TEXT,
  row_version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  text TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('explicit_statement', 'sourced_observation', 'reported_observation', 'user_impression', 'inference', 'unclassified_note')),
  source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE RESTRICT,
  episode_id TEXT REFERENCES episodes(id) ON DELETE SET NULL,
  occurred_start TEXT,
  occurred_end TEXT,
  temporal_precision TEXT NOT NULL CHECK (temporal_precision IN ('exact', 'day', 'approximate', 'interval', 'unknown')),
  context TEXT,
  row_version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS event_participants (
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  person_id TEXT NOT NULL REFERENCES persons(id) ON DELETE RESTRICT,
  role TEXT,
  PRIMARY KEY (event_id, person_id)
);

CREATE TABLE IF NOT EXISTS claims (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('explicit_statement', 'sourced_observation', 'reported_observation', 'user_impression', 'inference')),
  knowledge_status TEXT NOT NULL CHECK (knowledge_status IN ('unresolved', 'supported', 'contradicted', 'superseded')),
  valid_from TEXT,
  valid_to TEXT,
  row_version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS claim_sources (
  claim_id TEXT NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE RESTRICT,
  span_start INTEGER NOT NULL CHECK (span_start >= 0),
  span_end INTEGER NOT NULL CHECK (span_end >= span_start),
  quote TEXT NOT NULL,
  PRIMARY KEY (claim_id, source_id, span_start, span_end)
);

CREATE TABLE IF NOT EXISTS annotations (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  target_kind TEXT NOT NULL CHECK (target_kind IN ('source', 'event', 'person', 'episode', 'claim', 'hypothesis', 'question', 'goal')),
  target_id TEXT NOT NULL,
  text TEXT NOT NULL,
  annotation_type TEXT NOT NULL CHECK (annotation_type IN ('factual_correction', 'context', 'disagreement', 'agreement')),
  revision INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS hypotheses (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  statement TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'plausible', 'review', 'superseded')),
  row_version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS open_questions (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open', 'answered', 'dismissed')),
  row_version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS goals (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  confirmed_by_user INTEGER NOT NULL CHECK (confirmed_by_user IN (0, 1)),
  row_version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS revisions (
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL,
  command_type TEXT NOT NULL CHECK (command_type IN ('capture', 'annotate', 'goal.update')),
  changed_refs_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (workspace_id, revision)
);

CREATE TABLE IF NOT EXISTS command_receipts (
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  command_type TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  command_hash TEXT NOT NULL,
  result_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (workspace_id, command_type, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_sources_workspace_recorded ON sources(workspace_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_workspace_created ON events(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_annotations_target ON annotations(workspace_id, target_kind, target_id);
CREATE INDEX IF NOT EXISTS idx_goals_workspace ON goals(workspace_id, updated_at DESC);

INSERT OR IGNORE INTO schema_migrations(version, applied_at)
VALUES (1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
