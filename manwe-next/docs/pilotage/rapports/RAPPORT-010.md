# RAPPORT-010 — Directions reliées aux leviers et boucle d'action (lot R5-S01)

25 septembre 2026, nuit. Le [BRIEF-005](../briefs/BRIEF-005-directions-et-boucle-action.md) a été réalisé après le scellement des attentes ([R5-S01-attentes.md](../scelles/R5-S01-attentes.md), empreinte vérifiée : `9b2c1cf3…f438`).

Run : `packages/evaluation/runs/2026-09-25-deepseek-flash-r5-s01`. Modèle DeepSeek V4.1-Flash en mode automatique, prompt v7, contrat 1.5. Le lot a demandé 12 appels, soit 324 461 jetons en environ 4 minutes. La règle de choix du harnais a été écrite avant le run : il retient la première direction d'action proposée.

## Notation

| Scénario                     | [L]              | [B]         | Interdits | Commentaire                                                                                                                                                                                                                                                                                                                                                           |
| ---------------------------- | ---------------- | ----------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D01 Lucas (relation)         | 5/5              | 1/1         | respectés | Voir le détail ci-dessous                                                                                                                                                                                                                                                                                                                                             |
| D02 Inès (statut)            | 3/3              | —           | respectés | Trace d'attribution écrite « en coordination avec Inès », Inès en copie : une autre source de statut lui est laissée. Prédiction transitoire : elle teste la trace en reprenant une dernière fois le possessif à l'oral, ou durcit le contrôle du canal. L'opportunisme reste une lecture D3 en brouillon, avec son alternative ; l'inférence est marquée comme telle |
| D03 Mémoire (intrapersonnel) | 2/3              | —           | respectés | Voir le détail ci-dessous                                                                                                                                                                                                                                                                                                                                             |
| D04 Contrôle, données minces | 1/1              | 1/1 (tests) | respectés | Une seule direction d'action, à faible effort, qui actionne une lecture D2 (jamais D3 ou plus). Son `learnsIfFails` dit comment la réponse du frère départage les deux lectures                                                                                                                                                                                       |
| **Total**                    | **11/12 (92 %)** | **2/2**     | aucun     |                                                                                                                                                                                                                                                                                                                                                                       |

**D01 Lucas (relation)** :

- Deux leviers :
  - `lower_barrier` sur la lecture D3 « céder pour éviter le conflit » ;
  - `change_reward` sur la boucle D2.
- Les prédictions annoncent une relance, puis l'acceptation du créneau, puis un nouvel équilibre.
- « Ne rien entreprendre » prédit la poursuite des sollicitations et un ressentiment qui s'accumule.
- La réanalyse compare explicitement les prédictions au résultat :
  - l'insistance brève puis l'ajustement sont confirmés ;
  - la crainte d'une fâcherie n'est pas vérifiée : le versant « croyance » est affaibli par deux contre-preuves citées ;
  - une nouvelle lecture D2 « cadre négocié » est proposée, avec une question pour la suite.
- Réserve : la relance de Lucas est étiquetée `immediate` et non `transitional`. Son contenu (relancer avant d'accepter) répond pourtant à l'attente ; les limites de la direction le disent aussi (« le coût immédiat augmente avant de retomber »).

**D03 Mémoire (intrapersonnel)** :

- Deux directions :
  - `disconfirming_experience` : cinq minutes seul, sans jugement ;
  - `lower_barrier` : reproduire le cadre qui a marché, à la bibliothèque avec Zoé.
- Inconfort prédit au démarrage, puis tentation d'abandonner (phase transitoire).
- **La réanalyse après le résultat est perdue.** Deux réponses ont été rejetées pour des erreurs de format, et une seule seconde tentative est permise :
  - 1re réponse : un sujet écrit `{"kind":"self"}`, recopié du format du paquet au lieu de `{"self": true}` ;
  - 2e réponse : un `rationale` placé dans le payload d'une critique.

**[B] vérifiés sur D01** :

- l'attente est figée avant le résultat (06:16:00, avant le résultat) ;
- le résultat est une source citable, présente dans le paquet de réanalyse ;
- la lecture actionnée est signalée à réexaminer (motif `context`) ;
- le paquet contient l'action, ses trois prédictions et le résultat.

Les règles de plafond, de « ne rien entreprendre » et de lecture active n'ont pas été déclenchées par le lot, car le modèle les a respectées. Elles sont couvertes par `tests/directions.test.mjs`.

**Décision.** R5.5 et R5.5b sont validés en mode automatique : aucun interdit, 92 % [L], 100 % [B]. La réserve porte sur la perte de format de D03-A3, traitée ci-dessous.

## Correctif après le lot

Le moteur n'a pas été modifié pendant le run. Après notation :

- **Sujet recopié du paquet.** Un sujet `{"kind":"self"}` ou `{"kind":"person","id":…}`, recopié du format du paquet, est désormais accepté et normalisé vers la forme du contrat. Le paquet décrit ainsi les membres ; c'est donc une friction de notre format, pas une erreur de sens.
  - Alternative écartée : changer le format du paquet. Cela change l'entrée du modèle et ne résout rien pour les réponses déjà apprises.
- **Membres d'une relation absents du paquet.** Le test du correctif précédent a révélé que les membres d'une relation sujet d'une lecture n'étaient pas inclus dans le paquet : le modèle ne pouvait donc pas les désigner par `{ person }`. Ils le sont désormais.
- **`rationale` dans le payload.** Il reste refusé. La seconde tentative informée (D-021) le corrige d'habitude ; ici, elle a échoué sur cette erreur. Deux options pour l'utilisateur :
  - tolérer et déplacer `rationale` au niveau de l'opération ;
  - garder la rigueur actuelle.

## Limites

- **Un seul tirage par scénario.** La calibration des prédictions demandera beaucoup d'actions réelles.
- **Choix mécanique dans le harnais.** Il ne dit rien de la direction qu'un utilisateur aurait préférée.
- **Pas encore de chemin multi-étapes** (D-024) : une direction est un pas.
