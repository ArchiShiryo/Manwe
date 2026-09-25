# RAPPORT-014 — Résultat par levier, parcours complet validé (lot R5-S05)

25 septembre 2026. Les attentes ont été scellées avant le correctif du harnais ([R5-S05-attentes.md](../scelles/R5-S05-attentes.md), empreinte vérifiée : `5719a66f…20d9`).

Run : `packages/evaluation/runs/2026-09-25-deepseek-flash-r5-s05`. Modèle DeepSeek V4.1-Flash en mode automatique, prompt v10, contrat 1.7 (inchangés depuis R5-S04). Le lot a coûté 15 appels et 857 059 jetons.

Les entrées sont les deux parcours de vingt notes (P01 colocation, P02 club de volley). La fixture fournit un résultat par type de levier, écrit avant le run. Le harnais choisit la première direction d'action proposée et enregistre le résultat de son levier (RAPPORT-013, option c).

## Notation

| Critère                                                                      | P01                                                                                                                                                                                                                                                                                                                  | P02                                                                                                                                                                                                                                                                                                                                                     |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [B] Aucune analyse perdue                                                    | 1/1 : quatre analyses sur cinq appliquées à la seconde tentative                                                                                                                                                                                                                                                     | 1/1 : A1 appliquée à la seconde tentative, les quatre autres au premier essai                                                                                                                                                                                                                                                                           |
| [B] Résultat du levier de la direction choisie                               | 1/1 : `change_game`, « Sortir une échéance collective de sa propre boucle » ; résultat : le tableau de tâches nominatif                                                                                                                                                                                              | 1/1 : `alternative_source`, « Répondre à Samir et reprendre une sortie » ; résultat : la sortie ciné avec Samir                                                                                                                                                                                                                                         |
| [L] Relations clés et lecture de groupe                                      | 1/1 : quatre lectures sur le groupe Jules + Maya + utilisateur, dont « l'utilisateur tient la fonction de régulateur et le groupe récompense cette place », avec son alternative (« la répartition suit simplement la disponibilité ») ; lectures sur Maya et sur Jules                                              | 1/1 : deux lectures D5 concurrentes sur le groupe du club (« un porteur de charge » ou « une division stable des rôles ») ; lectures sur Léa, Hugo et Samir                                                                                                                                                                                             |
| [L] Objectif proposé, cité, dans ses termes                                  | 1/1 : « Faire tourner la colocation sans être le seul à tout gérer, en gardant la vie commune avec Jules et Maya »                                                                                                                                                                                                   | 1/1 : « Que la charge du club ne repose plus sur lui seul, tout en restant au club »                                                                                                                                                                                                                                                                    |
| [L] Directions : « ne rien entreprendre » et phase transitoire               | 1/1 : cinq directions                                                                                                                                                                                                                                                                                                | 1/1 : cinq directions                                                                                                                                                                                                                                                                                                                                   |
| [L] Réanalyse qui compare une prédiction de la direction choisie au résultat | 1/1 : « Comparaison prédiction/résultat : l'utilisateur installe bien le cadre et Jules ne bouge pas la première semaine (prédiction tenue), mais la deuxième semaine chacun fait sa part sans relance, ce qui dément la suspension durable de la coordination entre Jules et Maya » ; cinq faits citent le résultat | 1/1 : « la prédiction "un lien avec Samir qui ne passe plus uniquement par l'organisation" est confirmée (« On a parlé d'autre chose que du club ») […] mais la clause "ses propositions amicales sont refusées au profit des tâches" est démentie » ; le modèle relève aussi que Léa reprend la tâche, ce qui dément « le groupe ne redistribue rien » |

| Critère sur le lot                                         | Note                                                                                                                                      |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| [B] Réduction moyenne d'au moins 40 % sur A2–A5, même état | 1/1 : **49,6 %** (P01 : 45,4 %, 50,5 %, 53,3 %, 51,7 % ; P02 : 43,5 %, 49,0 %, 52,2 %, 51,2 %)                                            |
| [B] Aucun paquet de travail au-dessus de 60 % du complet   | 1/1 : 56,5 % au plus (P02-A2)                                                                                                             |
| [B] Requêtes en lecture seule, journalisées                | 1/1 : 11 requêtes `get_hypothesis` dans `analysis_queries` ; 29 révisions par scénario ; mécanismes conservés en base (12 et 11 lectures) |
| [L] Au moins une requête pertinente                        | 1/1 : en A4, le modèle ouvre les lectures sur lesquelles il appuie ses leviers (6 en P01, 5 en P02)                                       |
| [B] Aucun avertissement de plafond de directions           | 1/1                                                                                                                                       |

**Lot : 9/9 [L] (100 %), 8/8 [B] (100 %), aucun interdit violé.**

**Décision : lot validé.** Sont validés :

- le **BRIEF-006** (mémoire de travail, exploration libre, sujets de groupe, application partielle, directions sans plafond) ;
- **R5.1**, le parcours de trois personnes et vingt événements depuis un espace vide ;
- **R5.4**, l'objectif émergent ;
- **R5.6**, le rejeu sur un autre groupe sans modifier le code, le contrat ni le prompt.

## Observations

- **Le modèle corrige ses lectures par le résultat.** En P02, le résultat confirme une prédiction de la direction et en dément une autre. Le modèle remarque aussi un effet que la direction ne visait pas : Léa reprend la tâche. Il en tire une contre-preuve à la lecture de groupe « le groupe ne redistribue rien ». C'est le raisonnement attendu du modèle stratégique (D-017).
- **Des rejets de premier essai plus nombreux.** Cinq analyses sur dix passent à la seconde tentative, contre deux en R5-S04. Les causes :
  - une opération inconnue et une opération non autorisée en A1 et A2 : le modèle anticipe un objectif ou une direction trop tôt ;
  - une référence absente du paquet ;
  - un champ inconnu dans une référence ;
  - une lecture D5 sans alternative.

  La seconde tentative informée (D-021) les corrige toutes. Le parcours reste donc sensible à cette tentative unique, déjà listée parmi les brides à lever. Si ces rejets persistent, deux pistes :
  - dire dans le paquet, à chaque tâche, quelles opérations sont permises (`allowedOperations` y est déjà ; il faudrait le rappeler dans le prompt) ;
  - autoriser deux tentatives informées au lieu d'une.

- **Coût.** Environ 57 000 jetons par appel, sous R5-S04 (70 000) : les paquets restent moitié plus légers que le paquet complet.

## Suite

R5.7 : démonstration à l'utilisateur, dans l'application, sur un espace vide. Il faudra noter les incompréhensions et les corrections nécessaires.
