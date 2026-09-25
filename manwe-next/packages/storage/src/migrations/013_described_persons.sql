BEGIN IMMEDIATE;

-- D-030 : toute personne citée existe, même décrite sans nom (« la femme
-- d'un ami »). La description et le rattachement à une autre personne
-- (« conjointe de Paul ») se gardent ; l'identité se met à jour ensuite
-- (renommer, rattacher), les anciens noms restent pour la résolution.
ALTER TABLE persons ADD COLUMN description TEXT;
ALTER TABLE persons ADD COLUMN related_person_id TEXT REFERENCES persons(id);
ALTER TABLE persons ADD COLUMN relation_label TEXT;

CREATE TABLE person_former_names (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  person_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  replaced_at TEXT NOT NULL
);
CREATE INDEX idx_person_former_names ON person_former_names(workspace_id, person_id);

INSERT INTO schema_migrations(version, applied_at) VALUES (13, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));

COMMIT;
