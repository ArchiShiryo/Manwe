BEGIN IMMEDIATE;

-- D-025 : une réponse peut être appliquée partiellement. Les opérations
-- écartées (citation fausse, ou dépendante d'une opération écartée) sont
-- conservées ici, visibles dans l'aperçu et le résultat d'application.
ALTER TABLE analysis_responses ADD COLUMN dropped_json TEXT;

INSERT INTO schema_migrations(version, applied_at) VALUES (11, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));

COMMIT;
