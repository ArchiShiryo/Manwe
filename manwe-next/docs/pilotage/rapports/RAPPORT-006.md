# RAPPORT-006 — Lot de contrôle R4-S02 : relations, rôles et indicateurs validés

25 septembre 2026. Notation par le pilote contre les attentes scellées avant le lancement. L'empreinte `ac719f6b…08aa5` est vérifiée ; les attentes sont dans [R4-S02-attentes.md](../scelles/R4-S02-attentes.md). Modèle : DeepSeek V4.1-Flash, prompt v5, contrat 1.4, seconde tentative informée (D-021). Run : `packages/evaluation/runs/2026-09-25-deepseek-flash-r4-s02`.

## Exécution

4 analyses sur 4 appliquées. Q02-A2 est passée à la seconde tentative informée de l'erreur (D-021), alors qu'au lot R4-S01 le scénario équivalent avait été perdu.

## Notes

| Scénario         | [L]       | [B]     | Interdits | Commentaire                                                                                                                                                                                                                                            |
| ---------------- | --------- | ------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Q01 Chloé        | 6/6       | 1/1     | —         | 8 rôles justes, dont le refus de Chloé. Indicateurs : 3 demandes contre 1, 3 aides contre 0. D2 sur la relation, plausible. Part de l'utilisateur (« caretaker ») et alternatives (surcharge de Chloé)                                                 |
| Q02 Hamid        | 4/4       | 2/2     | —         | Initiatives 3 contre 1, avec un contre-exemple. Le contexte (travail de nuit) crée une seule source pour deux annotations ; il est cité en `explicit_statement`. La lecture « partage stable des rôles » devient plausible, l'asymétrie est contredite |
| Q03 Sarah et Tom | 4/4       | —       | —         | Relation Sarah–Tom sans l'utilisateur : boucle raillerie–retrait avec son alternative (norme du groupe). L'utilisateur est observateur. Question sur le retrait de Tom avec d'autres personnes                                                         |
| **Total**        | **14/14** | **3/3** | aucun     |                                                                                                                                                                                                                                                        |

## Décision

**R4.0a à R4.0c sont validés en mode automatique** : relation comme objet, rôles d'épisode cités, indicateurs relationnels.

## Réserve et suite

- **Réserve.** Le modèle continue de tirer des lectures sur l'utilisateur à partir de gestes ordinaires (Q02 : « suit de près la symétrie des efforts »). Ce n'était pas un point noté, mais c'est à surveiller.
- **Suite.**
  - Afficher les relations et leurs indicateurs dans l'interface.
  - Lecture stratégique de la relation (R4.0e) : déjà produite par le modèle dans le champ `mechanism` ; reste à la formaliser.
  - Registre ontologique (R4.0d), puis graphe R4.
