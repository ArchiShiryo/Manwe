# RAPPORT-009 — Parcours IA-A.5 dans l'application (fournisseur automatique)

25 septembre 2026. Attentes scellées avant l'écriture du script et avant tout appel ([IA-A5-attentes.md](../scelles/IA-A5-attentes.md), empreinte vérifiée : `ca5dab9b…2540`).

Run : `packages/evaluation/runs/2026-09-25-deepseek-flash-ia-a5`, script `scripts/ia-a5-parcours.mjs`. Le parcours passe par le code de l'application (`AutomaticAnalyses`, `createDeepSeekCall`). Il utilise DeepSeek V4.1-Flash, le prompt v6 et le contrat 1.4, et archive les réponses brutes sans les retoucher. Un essai à blanc avec un fournisseur simulé a d'abord validé la mécanique, sans aucun jeton dépensé.

## Déroulé

| Étape                                                         | Résultat                                                                                                                  |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Notes Q01 (Chloé, fictif)                                     | 4 notes conservées                                                                                                        |
| A1 « interpret »                                              | Validée à la 1re tentative, 85 s, 26 450 jetons ; appliquée (révision 5)                                                  |
| Contexte de l'utilisateur sur la lecture de rang 1 (relation) | Source citable créée ; lecture signalée à réexaminer                                                                      |
| A2 « revise »                                                 | Validée à la 1re tentative, 99 s, 37 126 jetons ; appliquée (révision 7)                                                  |
| Redémarrage                                                   | Même révision et mêmes hypothèses (identifiants, statuts, confiances, rangs) ; graphe (10 nœuds) et synthèse reconstruits |

## Notation

| Critère                                                                                                                                                                                                                        | Résultat  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- |
| [B] Deux analyses validées et appliquées, sans intervention entre l'envoi et la validation                                                                                                                                     | 1/1       |
| [B] Le contexte devient une source citable ; la lecture visée est à réexaminer                                                                                                                                                 | 1/1       |
| [B] Redémarrage identique ; graphe et synthèse reconstruits                                                                                                                                                                    | 1/1       |
| [B] Usage, durée d'inférence et modèle servi enregistrés ; budget respecté (63 576 jetons sur 2 millions)                                                                                                                      | 1/1       |
| [L] La lecture d'asymétrie n'est pas promue : elle passe de plausible, confiance modérée, rang 1 à brouillon, confiance faible, rang 2. L'alternative contextuelle (période de contraintes de Chloé) monte à plausible, rang 1 | 1/1       |
| [L] La réanalyse cite le contexte : deux claims (aide au déménagement, divorce) et un épisode avec un rôle d'aidante pour Chloé ; deux critiques `ignored_evidence` ; une question sur le coût ressenti du refus               | 1/1       |
| Interdits : aucune promotion de l'asymétrie ; aucun verdict sur Chloé (« profite », « égoïste », « toxique », « manipule » : absents des réponses brutes)                                                                      | respectés |

**Décision.** Le parcours IA-A.5 est validé dans l'application : 4/4 [B], 2/2 [L], aucun interdit violé.

## Limites

- **IA-A.5 n'est pas entièrement coché.** La ROADMAP demande aussi de rejouer le corpus critique et les cas R3/R5 avant R6. Le corpus critique a été rejoué par le harnais (R3-S02, R4-S02, R4-S03), qui compose le prompt de la même façon ; le test `automatic-provider` vérifie que l'application reproduit cette composition. Les cas R5 n'existent pas encore.
- **Un seul scénario, un seul tirage.** Ce parcours prouve la chaîne de bout en bout, pas la stabilité statistique des lectures.
- **Confirmation simulée.** Le script confirme l'application à la place de l'utilisateur. Dans l'interface, la confirmation reste un geste explicite (contrôlé par `scripts/ui-check-automatic.mjs`).
