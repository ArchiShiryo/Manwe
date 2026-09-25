# RAPPORT-007 — Prompt v6 : lire l'utilisateur seulement sur un coût exprimé (lot R4-S03)

25 septembre 2026. Attentes scellées avant la modification du prompt ([R4-S03-attentes.md](../scelles/R4-S03-attentes.md)). Run : `packages/evaluation/runs/2026-09-25-deepseek-flash-r4-s03`, DeepSeek V4.1-Flash, 2 analyses sur 2 appliquées (U02 à la seconde tentative informée).

**Changement.** La règle 8 du prompt v6 fonde une lecture D3 ou plus sur l'utilisateur uniquement sur un claim où il exprime lui-même un coût, un ressenti ou une contrainte. Les gestes ordinaires (relancer, proposer, attendre, consigner) donnent lieu à une question.

| Scénario                 | Points | Interdit | Commentaire                                                                                                                                                                                                                |
| ------------------------ | ------ | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| U01 Victor (ordinaire)   | 2/2    | —        | Trois lectures portées par la relation Victor–utilisateur, aucune lecture sur l'utilisateur seul, et une question sur son ressenti                                                                                         |
| U02 Élise (coût exprimé) | 2/2    | —        | Lectures D3 et D4 sur l'utilisateur, appuyées sur la culpabilité et le sommeil perdu, avec mécanisme et alternatives (situation d'Élise, norme du groupe) ; D2 sur la relation, avec le refus comme contre-exemple coûteux |

**Décision.** Le prompt v6 est validé : 4/4, aucun interdit violé. La réserve des RAPPORT-004 et 006 est levée.
