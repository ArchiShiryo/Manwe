# RAPPORT-002 — Moteur de révision (BRIEF-002, R3 première partie)

24 septembre 2026. Exécution : pilote (D-011). Branche `claude/happy-knuth-om3xdo`.

## 1. Commits

| Commit    | Objet                                                                                                          |
| --------- | -------------------------------------------------------------------------------------------------------------- |
| `143d4a2` | Migration 005, règles pures `revision.ts`, `hypothesisStore`, contrat 1.2, validation à blanc, aperçu UI       |
| `7597717` | Réponse aux questions (commande et route), 11 tests de bout en bout, `.prettierignore` qui protège les preuves |
| `0f83ec7` | Prompt `analyst-v3`, documentation du contrat 1.2                                                              |
| `3f548ef` | Inspecteur des hypothèses, questions et réanalyse ciblée dans l'interface                                      |

## 2. Contrôles

- `rm -rf node_modules && npm ci` : OK.
- `npm run typecheck` : OK.
- `npm test` : **65/65**. Il y en avait 45 avant ce lot : 9 tests unitaires des règles et 11 tests de bout en bout ont été ajoutés.
- `npm run build` : OK.
- Contrôle de taille : `revision.ts` n'importe ni SQLite ni `node:*`. `sqliteStore.ts` passe de 1 786 à 1 993 lignes (+207, dont la commande `answerQuestion`) ; le reste du moteur est dans `hypothesisStore.ts`.

## 3. Correspondance avec le brief

| Tâche           | Réalisé                                                                                                                                                                                                                                                                                                                                                                                |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T1 Schéma       | Migration 005 : hypothèses D1 à D5 avec cadre, construct, confiance, statut, drapeau « à réexaminer » et motif, limites, conditions de révision et alternative ; `hypothesis_subjects` (personne ou **soi**) ; `hypothesis_evidence` ; `claims.contested_revision` ; questions enrichies ; révision `question.answer`. L'ancien statut `review` devient `draft` avec « à réexaminer ». |
| T2 Règles pures | `independentUnits`, ancrages, `checkStatus`, `maxConfidence`, D4 sur 30 jours, `dependentHypotheses`, `isDuplicateQuestion`, `disagreementAddressed`.                                                                                                                                                                                                                                  |
| T3 Annotations  | Effets déterministes dans la même transaction. Une correction conteste le claim et fait redescendre l'hypothèse. Un ajout de contexte ou un désaccord la met « à réexaminer ». Un accord n'a **aucun** effet.                                                                                                                                                                          |
| T4 Contrat 1.2  | Trois opérations, références `proposalKey`, opérations par défaut selon la tâche, validation à blanc à la réception (l'aperçu montre les refus du moteur), documentation, prompt `analyst-v3`.                                                                                                                                                                                         |
| T5 Questions    | Réponse libre (devient une source, les hypothèses ciblées passent « à réexaminer »), « je ne sais pas », « ne plus poser ». Réanalyse ciblée par une demande `revise`.                                                                                                                                                                                                                 |
| T6 Inspecteur   | Voir la capture [`docs/ui-r3-inspecteur-hypotheses.png`](../../ui-r3-inspecteur-hypotheses.png).                                                                                                                                                                                                                                                                                       |

## 4. Écarts par rapport au brief, avec leur justification

1. **Contre-preuve.** Une contre-preuve n'est ajoutée que par une opération du modèle, qui l'examine au même moment. Le « non examiné » du brief se traduit donc par une règle nette : **plausible** exige un nombre d'ancrages favorables _moins_ les ancrages contraires au moins égal au seuil de la profondeur. Le test R3-1 le vérifie.
2. **Sujets.** Un sujet peut être désigné par une `mention` (le prénom tel qu'il figure dans une source). Il est alors résolu de façon unique vers une personne existante. Sans correspondance, une personne est créée avec le statut `candidate`. Si plusieurs personnes correspondent, la proposition est refusée (`ambiguous_subject`). Une mention absente des sources est refusée (`subject_not_in_sources`). Le sujet `self` sert au modèle de l'utilisateur.
3. **Réponse à une question.** La source d'une réponse garde le type `user_entry` : un nouveau type aurait imposé de reconstruire la table des sources. Le lien passe par `open_questions.answer_source_id`.
4. **`revise_hypothesis`** porte aussi une `confidence`, sinon la confiance ne pourrait jamais monter.
5. **Test 7 du brief.** L'attente « une troisième hypothèse active est rejetée » est inversée par D-010 : le test vérifie désormais qu'elle est **acceptée**.

## 5. Parcours vérifié dans le navigateur

Vérification sur une base fictive, avec l'interface réelle et le service local :

1. Trois épisodes concernant Maëlle.
2. Une hypothèse D4 « traits de personnalité borderline » (cadre DSM-5 / CIM-11, lecture non clinique), marquée **Exploratoire**, et son alternative D1 « crise transitoire après la rupture ».
3. Une question discriminante.
4. Un contexte ajouté sur une preuve : les deux hypothèses passent « à réexaminer · contexte ajouté ».
5. « Je ne sais pas » ferme la question.
6. « Préparer la réanalyse » produit un paquet `revise` qui contient l'hypothèse, son alternative, les trois claims et la question close, pour éviter qu'elle soit reposée.

Aucune erreur en console.

## 6. Incident évité

Un formatage automatique (`prettier --write packages`) a réécrit par erreur les réponses brutes des lots B01 et le prompt `analyst-v2`. Tout a été **restauré avant commit** : aucun diff par rapport à la version commitée. Un fichier `.prettierignore` protège désormais `packages/evaluation/runs/` et `packages/cognition/prompts/`.

## 7. Ce qui reste pour clore R3

- **R3.4, passe critique ciblée** : données ignorées, explication plus simple, généralisation excessive. À faire dans le BRIEF-003.
- **Évaluation à l'aveugle R3-S01** : 10 scénarios dont les attentes sont scellées. Il faut un harnais multi-étapes (captures, analyses, annotations, réponses) avant de faire tourner les analyses.
- Test HTTP de la route `/api/questions/:id/answer` : le comportement est couvert au niveau du stockage, pas de l'API.
