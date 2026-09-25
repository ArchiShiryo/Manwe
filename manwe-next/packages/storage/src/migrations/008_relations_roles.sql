BEGIN IMMEDIATE;

-- BRIEF-004 (D-012, D-013) : la relation devient un objet ; les rôles tenus
-- dans chaque épisode sont extraits avec citation. Le rôle dans une relation
-- n'est jamais stocké : c'est une hypothèse, calculée ou formulée.
CREATE TABLE relations (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  -- Clé canonique des membres triés (« person:<id>|self ») : une dyade n'existe qu'une fois.
  member_key TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (workspace_id, member_key)
);

CREATE TABLE relation_members (
  relation_id TEXT NOT NULL REFERENCES relations(id) ON DELETE CASCADE,
  member_kind TEXT NOT NULL CHECK (member_kind IN ('person', 'self')),
  person_id TEXT REFERENCES persons(id),
  UNIQUE (relation_id, member_kind, person_id)
);

CREATE TABLE hypothesis_relations (
  hypothesis_id TEXT NOT NULL REFERENCES hypotheses(id) ON DELETE CASCADE,
  relation_id TEXT NOT NULL REFERENCES relations(id) ON DELETE CASCADE,
  PRIMARY KEY (hypothesis_id, relation_id)
);

CREATE TABLE event_roles (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  subject_kind TEXT NOT NULL CHECK (subject_kind IN ('person', 'self')),
  person_id TEXT REFERENCES persons(id),
  role TEXT NOT NULL CHECK (role IN ('initiator', 'recipient', 'requester', 'helper', 'responder', 'observer')),
  -- Issue de la demande : acceptée, refusée ou inconnue (pour requester/responder).
  outcome TEXT CHECK (outcome IN ('accepted', 'declined', 'unknown')),
  citations_json TEXT NOT NULL,
  created_revision INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_event_roles_event ON event_roles(event_id);
CREATE INDEX idx_event_roles_person ON event_roles(person_id);

INSERT INTO schema_migrations(version, applied_at)
VALUES (8, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));

COMMIT;
