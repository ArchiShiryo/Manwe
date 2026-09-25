BEGIN IMMEDIATE;

-- BRIEF-005 (D-016, D-017) : directions reliées aux leviers du modèle, et
-- boucle d'action. Une direction est une proposition ; l'action est le choix
-- de l'utilisateur, avec son attente figée avant l'essai. Le résultat passe
-- par une annotation citable (type context) sur la lecture actionnée.
CREATE TABLE directions (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  goal_id TEXT REFERENCES goals(id),
  title TEXT NOT NULL,
  action_text TEXT NOT NULL,
  lever_kind TEXT NOT NULL CHECK (lever_kind IN ('change_reward', 'lower_barrier', 'alternative_source', 'disconfirming_experience', 'change_game', 'do_nothing')),
  lever_hypothesis_id TEXT REFERENCES hypotheses(id),
  mechanism_key TEXT,
  conditions TEXT NOT NULL,
  effort TEXT NOT NULL CHECK (effort IN ('low', 'moderate', 'high')),
  limits TEXT NOT NULL,
  signals_json TEXT NOT NULL,
  learns_if_fails TEXT NOT NULL,
  predictions_json TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('proposed', 'chosen', 'dismissed', 'superseded')),
  response_id TEXT,
  created_revision INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_directions_goal ON directions(workspace_id, goal_id, status);

CREATE TABLE actions (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  direction_id TEXT NOT NULL REFERENCES directions(id),
  status TEXT NOT NULL CHECK (status IN ('planned', 'done', 'abandoned')),
  -- Prédictions figées au moment du choix, plus l'attente propre de l'utilisateur.
  expectation_json TEXT NOT NULL,
  expectation_recorded_at TEXT NOT NULL,
  chosen_revision INTEGER NOT NULL,
  outcome_text TEXT,
  outcome_annotation_id TEXT REFERENCES annotations(id),
  outcome_recorded_at TEXT,
  verdicts_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (outcome_recorded_at IS NULL OR outcome_recorded_at >= expectation_recorded_at)
);
CREATE INDEX idx_actions_direction ON actions(workspace_id, direction_id);

-- Les choix et résultats d'action sont des commandes révisées.
CREATE TABLE revisions_v9 (
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL,
  command_type TEXT NOT NULL CHECK (command_type IN ('capture', 'import', 'identity.resolve', 'annotate', 'goal.update', 'analysis.apply', 'question.answer', 'action.choose', 'action.outcome')),
  changed_refs_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (workspace_id, revision)
);

INSERT INTO revisions_v9(workspace_id, revision, command_type, changed_refs_json, created_at)
SELECT workspace_id, revision, command_type, changed_refs_json, created_at FROM revisions;

DROP TABLE revisions;
ALTER TABLE revisions_v9 RENAME TO revisions;

INSERT INTO schema_migrations(version, applied_at) VALUES (9, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));

COMMIT;
