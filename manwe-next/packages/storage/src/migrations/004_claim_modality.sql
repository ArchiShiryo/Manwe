BEGIN IMMEDIATE;

ALTER TABLE claims
ADD COLUMN modality TEXT NOT NULL DEFAULT 'actual'
CHECK (modality IN ('actual', 'intended', 'hypothetical'));

INSERT INTO schema_migrations(version, applied_at)
VALUES (4, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));

COMMIT;
