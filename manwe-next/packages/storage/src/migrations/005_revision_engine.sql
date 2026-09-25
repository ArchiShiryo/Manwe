BEGIN IMMEDIATE;

-- Hypothèses : profondeur D1 à D5, cadre et construct, confiance qualitative
-- plafonnée par les preuves, drapeau « à réexaminer » distinct du statut.
CREATE TABLE hypotheses_v2 (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  statement TEXT NOT NULL,
  depth TEXT NOT NULL DEFAULT 'D1' CHECK (depth IN ('D1', 'D2', 'D3', 'D4', 'D5')),
  framework TEXT,
  construct TEXT,
  confidence TEXT NOT NULL DEFAULT 'low' CHECK (confidence IN ('low', 'moderate', 'high')),
  status TEXT NOT NULL CHECK (status IN ('draft', 'plausible', 'contradicted', 'superseded')),
  needs_review INTEGER NOT NULL DEFAULT 0 CHECK (needs_review IN (0, 1)),
  review_reason TEXT CHECK (review_reason IS NULL OR review_reason IN ('correction', 'context', 'disagreement', 'answer')),
  review_since_revision INTEGER,
  limits TEXT,
  revision_conditions TEXT,
  valid_from TEXT,
  valid_to TEXT,
  alternative_to TEXT REFERENCES hypotheses_v2(id) ON DELETE SET NULL,
  created_revision INTEGER NOT NULL DEFAULT 0,
  row_version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT INTO hypotheses_v2(id, workspace_id, statement, status, needs_review, row_version, created_at, updated_at)
SELECT
  id,
  workspace_id,
  statement,
  CASE status WHEN 'review' THEN 'draft' ELSE status END,
  CASE status WHEN 'review' THEN 1 ELSE 0 END,
  row_version,
  created_at,
  updated_at
FROM hypotheses;

DROP TABLE hypotheses;
ALTER TABLE hypotheses_v2 RENAME TO hypotheses;

-- Sujets : une personne connue, ou l'utilisateur lui-même (SelfModel).
CREATE TABLE hypothesis_subjects (
  hypothesis_id TEXT NOT NULL REFERENCES hypotheses(id) ON DELETE CASCADE,
  subject_kind TEXT NOT NULL CHECK (subject_kind IN ('person', 'self')),
  person_id TEXT REFERENCES persons(id) ON DELETE RESTRICT,
  CHECK ((subject_kind = 'person') = (person_id IS NOT NULL)),
  UNIQUE (hypothesis_id, subject_kind, person_id)
);

-- Preuves : uniquement des claims ; jamais supprimées, seulement dépassées.
CREATE TABLE hypothesis_evidence (
  hypothesis_id TEXT NOT NULL REFERENCES hypotheses(id) ON DELETE CASCADE,
  claim_id TEXT NOT NULL REFERENCES claims(id) ON DELETE RESTRICT,
  stance TEXT NOT NULL CHECK (stance IN ('supports', 'contradicts')),
  added_revision INTEGER NOT NULL,
  superseded_revision INTEGER,
  PRIMARY KEY (hypothesis_id, claim_id)
);

-- Correction factuelle de l'utilisateur : le claim cesse de compter.
ALTER TABLE claims ADD COLUMN contested_revision INTEGER;

CREATE TABLE open_questions_v2 (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open', 'answered', 'unknown', 'dismissed')),
  targets_json TEXT NOT NULL DEFAULT '[]',
  discriminating_info TEXT,
  why_now TEXT,
  normalized_text TEXT NOT NULL DEFAULT '',
  answer_source_id TEXT REFERENCES sources(id) ON DELETE RESTRICT,
  row_version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT INTO open_questions_v2(id, workspace_id, question, status, normalized_text, row_version, created_at, updated_at)
SELECT id, workspace_id, question, status, lower(question), row_version, created_at, updated_at
FROM open_questions;

DROP TABLE open_questions;
ALTER TABLE open_questions_v2 RENAME TO open_questions;

CREATE TABLE revisions_v5 (
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL,
  command_type TEXT NOT NULL CHECK (command_type IN ('capture', 'import', 'identity.resolve', 'annotate', 'goal.update', 'analysis.apply', 'question.answer')),
  changed_refs_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (workspace_id, revision)
);

INSERT INTO revisions_v5(workspace_id, revision, command_type, changed_refs_json, created_at)
SELECT workspace_id, revision, command_type, changed_refs_json, created_at FROM revisions;

DROP TABLE revisions;
ALTER TABLE revisions_v5 RENAME TO revisions;

CREATE INDEX idx_hypothesis_evidence_claim ON hypothesis_evidence(claim_id);
CREATE INDEX idx_hypotheses_workspace ON hypotheses(workspace_id, status, updated_at DESC);
CREATE INDEX idx_open_questions_workspace ON open_questions(workspace_id, status, updated_at DESC);

INSERT INTO schema_migrations(version, applied_at)
VALUES (5, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));

COMMIT;
