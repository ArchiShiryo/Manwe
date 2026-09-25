BEGIN IMMEDIATE;

-- R5.4 : un problème et un objectif peuvent émerger de la conversation. Une
-- proposition de l'analyse reste non confirmée tant que l'utilisateur ne l'a
-- pas adoptée ou reformulée ; un objectif confirmé n'est jamais remplacé.
ALTER TABLE goals ADD COLUMN problem TEXT;
ALTER TABLE goals ADD COLUMN origin TEXT NOT NULL DEFAULT 'user' CHECK (origin IN ('user', 'analysis'));
ALTER TABLE goals ADD COLUMN citations_json TEXT;
ALTER TABLE goals ADD COLUMN dismissed_at TEXT;

INSERT INTO schema_migrations(version, applied_at) VALUES (10, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));

COMMIT;
