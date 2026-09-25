BEGIN IMMEDIATE;

-- D-031 : réglages de l'espace, dont le consentement à la transmission des
-- notes au fournisseur, donné une seule fois. Sans lui, l'agent ne part pas.
CREATE TABLE workspace_settings (
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (workspace_id, key)
);

INSERT INTO schema_migrations(version, applied_at) VALUES (15, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));

COMMIT;
