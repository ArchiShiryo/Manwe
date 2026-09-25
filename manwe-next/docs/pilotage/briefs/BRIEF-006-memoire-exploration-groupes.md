# BRIEF-006 — Mémoire de travail, exploration libre, groupes

26 septembre 2026. Il découle du [RAPPORT-011](../rapports/RAPPORT-011.md) et des décisions D-023 à D-026, prises avec l'utilisateur. Les attentes du lot R5-S03 ont été scellées avant le code.

## Périmètre

1. **Mémoire de travail (D-026).** Le paquet `working`, par défaut, garde tout l'état du modèle du monde. En revanche :
   - les notes déjà analysées n'y figurent plus en texte ;
   - les faits et les rôles ne recopient plus leurs citations ;
   - les champs nuls sont omis.

   Le paquet `full` sert à la relecture complète. Une citation reste valide pour toute note de l'espace, dont l'empreinte est vérifiée.

2. **Exploration libre (D-023).**
   - Cinq requêtes en lecture seule : `search_notes`, `get_note`, `get_person`, `get_relation`, `get_hypothesis`, décrites dans `packages/cognition/src/memoryTools.ts`.
   - Elles sont journalisées (migration 012). Un objet servi devient citable et référençable dans la proposition.
   - Le client DeepSeek enchaîne les tours de requêtes ; il est partagé par l'application et par le harnais.
3. **Groupes (D-025).** Le sujet `{ "group": [...] }` réunit de 3 à 8 membres ; il est stocké comme une relation à plusieurs membres.
4. **Application partielle (D-025).**
   - Une opération mal citée est écartée, avec les opérations qui en dépendent.
   - Les écarts sont visibles dans l'aperçu et dans le résultat.
   - Au-delà de 20 % d'opérations écartées, la réponse est rejetée en entier (migration 011).
5. **Directions sans plafond (D-024).**
6. **Contrat 1.7 et prompt v9** : règles M1 à M3, R2b et O1 révisée.

## Brides restantes

Elles sont toutes listées dans PILOTAGE.md, section « Brides à lever » :

- le nombre de tours de requêtes (12) ;
- le budget quotidien ;
- une seule seconde tentative ;
- un seul objectif proposé par réponse.

## Validation

Lot R5-S03 : les deux parcours de vingt notes de R5-S02 sont rejoués. Seuil : aucun interdit, au moins 75 % des points [L], 100 % des points [B].
