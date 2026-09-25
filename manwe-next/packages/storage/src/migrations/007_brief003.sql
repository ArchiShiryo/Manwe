BEGIN IMMEDIATE;

-- BRIEF-003 (RAPPORT-003) :
-- - une annotation de correction, de contexte ou de désaccord devient une
--   source citable ;
-- - une hypothèse porte son rang parmi les lectures d'un même sujet et sa
--   formulation mécaniste (D-015, D-017, D-019).
ALTER TABLE annotations ADD COLUMN source_id TEXT REFERENCES sources(id);
ALTER TABLE hypotheses ADD COLUMN rank INTEGER;
ALTER TABLE hypotheses ADD COLUMN mechanism_json TEXT;

INSERT INTO schema_migrations(version, applied_at)
VALUES (7, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));

COMMIT;
