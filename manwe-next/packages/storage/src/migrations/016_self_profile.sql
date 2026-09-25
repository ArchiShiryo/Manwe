BEGIN IMMEDIATE;

-- D-032 : profil de l'utilisateur, construit par l'entretien, jamais par un
-- formulaire. Chaque valeur vient de ses propres mots (source citable) ; un
-- champ absent reste « inconnu ».
CREATE TABLE self_profile (
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  field TEXT NOT NULL CHECK (field IN ('age', 'situation', 'foyer', 'energie', 'poids', 'souhait')),
  value TEXT NOT NULL,
  source_id TEXT NOT NULL REFERENCES sources(id),
  quote TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (workspace_id, field)
);

INSERT INTO schema_migrations(version, applied_at) VALUES (16, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));

COMMIT;
