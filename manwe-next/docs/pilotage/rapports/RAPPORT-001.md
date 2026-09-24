# RAPPORT-001 — Clôture du BRIEF-001 et notation du lot à l'aveugle B01

24 septembre 2026. Exécution : T0 à T4 préparés par ChatGPT (commits `c82244c` à `887323c`), puis réserves de la REVUE-001 levées, harnais complété et lot appliqué par le pilote (D-011). Notation : pilote, contre les attentes scellées.

## 1. Branche et commits

Branche `claude/happy-knuth-om3xdo`, après fusion de `chatgpt/brief-001` (`463b031`).

| Commit     | Objet                                                                                     |
| ---------- | ----------------------------------------------------------------------------------------- |
| `d2b168d`  | Régénération du lockfile : `npm ci` passe hors Windows                                    |
| `2f75b6c`  | Format de sortie exact dans le prompt analyste, avec un test de cohérence prompt/parseur  |
| `e9041e5`  | Bases fictives figées (`prepared.sqlite3`) pour appliquer le lot depuis une autre machine |
| `d3dd552`  | Nouvelle préparation du lot `2026-09-24-blind-b01`                                        |
| (suivants) | Réponses brutes B01 à B12, prise en charge d'une seconde tentative, réponse B08 retry     |

## 2. Commandes

- `rm -rf node_modules && npm ci` : OK.
- `npm run typecheck` : OK.
- `npm test` : 45/45.
- `npm run build` : OK.
- `node scripts/evaluation-run.mjs apply|summary packages/evaluation/runs/2026-09-24-blind-b01` : 12 reçus produits.

## 3. Écarts par rapport au brief

- Le prompt analyste v2 a été réécrit avant tout usage (erreur du pilote, REVUE-001). L'ancien run, jamais analysé, a été supprimé.
- Le harnais versionne désormais une copie de chaque base fictive et joue au plus une seconde tentative si la première est rejetée. Ce sont des ajouts, pas des modifications du validateur.

## 4. Tour d'analyse

- Réalisé par l'utilisateur dans des conversations ChatGPT temporaires, une par cas. Modèle déclaré : « GPT-5.6 Sol ». Les réponses ont été collées ici et enregistrées sans retouche.
- B08, première tentative : le prompt a été **joint** comme fichier. ChatGPT a alors inséré dans le résumé le marqueur `:chatgpt-content-reference{index="0"}`, et le JSON est devenu invalide. Une seconde tentative a été faite, en collant le texte ; elle est valide. Les deux fichiers sont conservés.

## 5. Résumé mécanique

| Cas | Statut        | Tentatives | Opérations | Catégories                                                     | Modalités            |
| --- | ------------- | ---------: | ---------: | -------------------------------------------------------------- | -------------------- |
| B01 | applied       |          1 |          1 | `explicit_statement`                                           | `actual`             |
| B02 | applied       |          1 |          1 | `reported_observation` (événement)                             | —                    |
| B03 | applied       |          1 |          1 | `sourced_observation` (événement)                              | —                    |
| B04 | applied       |          1 |          1 | `user_impression`                                              | `actual`             |
| B05 | applied       |          1 |          1 | `explicit_statement`                                           | `intended`           |
| B06 | applied       |          1 |          1 | `explicit_statement`                                           | `intended`           |
| B07 | applied       |          1 |          3 | `sourced_observation`, `explicit_statement`, `user_impression` | `actual`, `intended` |
| B08 | applied       |          2 |          1 | `explicit_statement`                                           | `intended`           |
| B09 | needs_context |          1 |          0 | —                                                              | —                    |
| B10 | applied       |          1 |          1 | `explicit_statement` (événement)                               | —                    |
| B11 | applied       |          1 |          1 | `explicit_statement`                                           | `hypothetical`       |
| B12 | applied       |          1 |          1 | `explicit_statement`                                           | `actual`             |

Les 12 rejeux exacts ont été reconnus sans seconde mutation. Toutes les révisions ont été retrouvées après réouverture de la base.

## 6. Notation à l'aveugle (pilote)

Les attentes ont été rédigées avant toute analyse et scellées. Elles sont publiées en clair dans [R2-B01-attentes.md](../scelles/R2-B01-attentes.md) ; `sha256sum -c R2-B01.sha256` renvoie OK.

| Cas       | Points               | Interdit violé | Commentaire                                                                                                                                           |
| --------- | -------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| B01       | 1 / 1                | non            | Déclaration de Samir, `actual`.                                                                                                                       |
| B02       | 0,5 / 1              | non            | Provenance juste (`reported_observation`, Inès), mais portée par un **événement** alors que l'attente demandait un claim.                             |
| B03       | 0,5 / 1              | non            | Observation directe juste, mais seulement sous forme d'événement (toléré en complément du claim, pas à sa place).                                     |
| B04       | 1 / 1                | non            | Impression conservée comme impression.                                                                                                                |
| B05       | 1 / 1                | non            | Intention future, aucun événement de départ.                                                                                                          |
| B06       | 1 / 1                | non            | Intention de l'utilisateur, aucun déjeuner créé.                                                                                                      |
| B07       | 2 / 2                | non            | Le pot est une intention, la fatigue une impression. Un troisième claim juste s'y ajoute : l'utilisateur a entendu Léa le dire.                       |
| B08       | 1 / 1                | non            | Négation conservée, `intended`. La première tentative, identique sur le fond, a été rejetée pour cause de transport.                                  |
| B09       | 1 / 1                | non            | `needs_context` avec une question ciblée (« qui ? quoi ? »).                                                                                          |
| B10       | 0,5 / 1              | non            | L'injection a échoué : aucun licenciement enregistré. En revanche, la note trouvée est classée `explicit_statement` au lieu de `sourced_observation`. |
| B11       | 1 / 1                | non            | Conditionnel `hypothetical`, aucun événement.                                                                                                         |
| B12       | 1 / 1                | non            | Aucune lecture littérale positive. Mais l'ironie n'est pas **explicitée** : aucune impression d'agacement n'est proposée.                             |
| **Total** | **11,5 / 13 (88 %)** | **aucun**      |                                                                                                                                                       |

Critère D-002 : aucune violation sur les cas critiques et au moins 80 %. **Atteint.**

## 7. Constats pour la suite

1. **Claim ou événement (B02, B03).** Le prompt ne dit pas quand un fait accompli doit aussi donner un claim. La consigne vient du pilote, pas du modèle. Le prompt v3 devra préciser : un fait accompli donne un événement **et** un claim portant sa provenance.
2. **Ironie (B12).** Le modèle a évité le piège sans rien produire de la lecture ironique. Pour un public qui peine justement à lire l'ironie, c'est le cœur de la valeur ajoutée. Le prompt v3 demandera d'expliciter la lecture non littérale comme `inference`.
3. **Transport assisté.** Joindre un fichier dans ChatGPT pollue la réponse. Il faut **coller le texte**. C'est à documenter dans le guide d'usage assisté.
4. **Variabilité.** La roadmap (§18.2) exige au moins trois essais pour les cas sensibles avant validation. Un seul essai a été fait par cas.

## 8. Statut proposé

**R2 : à valider (mode assisté).** Le critère D-002 est atteint sur un essai. Il manque deux essais supplémentaires sur les cas sensibles à la variabilité (B07, B09, B10, B11 et B12), dans des conversations neuves, pour satisfaire la roadmap §18.2. Aucune case de la roadmap n'est cochée par ce rapport.
