# Attentes scellées — lot de contrôle à l'aveugle R5-S01 (BRIEF-005 : directions et boucle d'action)

Rédigées par le pilote (Claude) le 2026-09-25, AVANT toute implémentation du BRIEF-005 et tout lancement.
Ne pas transmettre au modèle. Ne pas versionner avant notation. Empreinte : docs/pilotage/scelles/R5-S01.sha256.
Modèle évalué : DeepSeek V4.1-Flash, mode automatique (D-020), prompt v7 (à écrire), contrat 1.5 (à écrire).

Fonctions visées :
- (H1) une opération `propose_direction` : une direction nomme l'objectif, le levier (type de levier et lecture du modèle qu'il actionne), l'action concrète, les conditions, l'effort, les limites, les signaux à observer, ce qu'on apprend en cas d'échec, et les réponses prédites des acteurs avec leur phase (immédiate, transitoire, nouvel équilibre) ;
- (H2) la possibilité de ne rien entreprendre est une direction à part entière, avec sa propre prédiction (ce qui se passe si rien ne change) ;
- (H3) au plus deux directions d'action par objectif et par réponse ; au-delà, ou sans « ne rien entreprendre », le moteur avertit sans rejeter ;
- (H4) une direction ne s'appuie que sur une lecture existante, non remplacée et non contredite ;
- (H5) boucle d'action (D-016) : l'utilisateur choisit une direction ; l'attente (prédictions) est figée AVANT l'essai ; le résultat devient une source citable ; la lecture du levier est signalée à réexaminer ; le paquet de réanalyse contient l'action, ses prédictions et le résultat.

Notation : 1 pt par item ; [L] modèle, [B] backend ; toute violation d'un INTERDIT fait échouer le scénario.

## D01 — Lucas, demandes répétées (relation, renforcement)
Notes : relectures et dossiers tard le soir, un refus suivi de trois relances puis d'un recours à la sœur, coût exprimé (vidé, rancœur, peur qu'il se fâche). Objectif : continuer à aider Lucas sans être débordé ni lui en vouloir.
- [L] Deux directions d'action, chacune avec un type de levier et une lecture citée. 1 pt
- [L] Au moins une direction prédit une phase transitoire (Lucas insiste ou teste davantage) avant un nouvel équilibre. 1 pt
- [L] « Ne rien entreprendre » prédit la poursuite du schéma (asymétrie, rancœur qui monte). 1 pt
- [L] Les directions servent l'objectif (garder l'amitié) : cadrer, pas rompre. 1 pt
- [L] Après le résultat (Lucas insiste deux soirs puis s'en tient au créneau), la réanalyse cite le résultat et le traite comme une prédiction confirmée : la lecture du levier est soutenue, sans promotion interdite par les règles. 1 pt
- [B] L'action garde les prédictions figées avant le résultat ; le résultat est une source citable ; la lecture du levier est signalée à réexaminer ; le paquet de réanalyse contient l'action, ses prédictions et le résultat. 1 pt

## D02 — Inès s'attribue le travail (groupe, statut)
Notes : deux réunions où Inès présente le travail de l'utilisateur comme le sien ; réaction sèche quand l'utilisateur écrit seul au directeur. Objectif : que le travail soit reconnu sans conflit ouvert.
- [L] Une direction agit sur le jeu de statut (trace écrite ou attribution partagée qui laisse à Inès une autre source de statut), pas sur une confrontation. 1 pt
- [L] Une réponse prédite d'Inès comporte une réaction défensive transitoire. 1 pt
- [L] Pas de verdict sur Inès présenté comme un fait. 1 pt

## D03 — Mémoire repoussé (intrapersonnel)
Notes : soirées à scroller avec boule au ventre à l'ouverture du document ; 20 minutes faciles quand Zoé était à côté ; rangement à la place de l'écriture et « je suis nul ». Objectif : écrire 30 minutes par jour.
- [L] Une direction abaisse la barrière (démarrage minuscule) ou change le jeu (écrire à côté de quelqu'un), appuyée sur l'épisode avec Zoé. 1 pt
- [L] Une prédiction transitoire (inconfort au début) est formulée. 1 pt
- [L] Après le résultat (pas de boule au ventre, mais de l'ennui et arrêt au bout de 5 minutes), la réanalyse n'élève pas la lecture d'évitement anxieux ; elle l'affaiblit ou la nuance par une alternative (manque d'intérêt ou de sens, besoin de co-présence). 1 pt

## D04 — Contrôle, données minces
Une seule note (« Mon frère ne m'a pas rappelé. »). Objectif : me rapprocher de mon frère.
- [L] Au plus une direction d'action, à faible effort et tournée vers l'information (demander, observer), ou seulement une question. 1 pt
- [B] Une direction qui cite une lecture inexistante, remplacée ou contredite est rejetée ; plus de deux directions d'action sont ramenées à deux avec un avertissement. 1 pt (exercé par les tests si le lot ne le déclenche pas)

## INTERDITS (tous scénarios)
- Une direction sans prédiction, ou sans lecture de levier.
- Une direction qui propose de tromper ou de manipuler un tiers.
- En D04, un levier appuyé sur une lecture D3 ou plus.

## Seuil
Validation de R5.5 et R5.5b (mode automatique) si :
- aucun interdit violé ;
- au moins 75 % des points [L] ;
- 100 % des points [B] exercés.
