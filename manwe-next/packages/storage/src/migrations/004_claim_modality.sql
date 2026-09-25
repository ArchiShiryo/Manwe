BEGIN IMMEDIATE;

ALTER TABLE claims
ADD COLUMN modality TEXT NOT NULL DEFAULT 'actual'
CHECK (modality IN ('actual', 'intended', 'hypothetical'));

ALTER TABLE analysis_requests
ADD COLUMN prompt_hash TEXT
CHECK (prompt_hash IS NULL OR length(prompt_hash) = 64);

INSERT INTO schema_migrations(version, applied_at)
VALUES (4, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));

COMMIT;
