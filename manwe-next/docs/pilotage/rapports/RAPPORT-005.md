# RAPPORT-005 — BRIEF-004 (relations, rôles, indicateurs) : lot de contrôle R4-S01

25 septembre 2026. Notation par le pilote contre les attentes scellées avant le code. L'empreinte `64ccbe51…af49b1` est vérifiée, et les attentes sont publiées dans [R4-S01-attentes.md](../scelles/R4-S01-attentes.md). Modèle : DeepSeek V4.1-Flash, prompt v5, contrat 1.4. Run : `packages/evaluation/runs/2026-09-25-deepseek-flash-r4-s01`.

## 1. Livré

- **Relation comme objet** (D-012) : une hypothèse peut avoir pour sujet une dyade, avec ou sans l'utilisateur. Migration 008.
- **Rôles d'épisode cités** (D-013) : opération `propose_role` (initiateur, destinataire, demandeur, aidant, répondant, observateur, avec l'issue de la demande).
- **Indicateurs relationnels déterministes** : initiatives, demandes, aides, refus, contre-exemples, étendue et fréquence. Ils figurent dans l'instantané et dans les paquets.
- **Une annotation portée sur plusieurs objets partage sa source.**
- **Prompt v5.**
- **Tests** : 75 réussis.

## 2. Notes

| Scénario          | [L]             | [B]        | Interdits              | Commentaire                                                                                                                                                                                                                                                                       |
| ----------------- | --------------- | ---------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R01 Lucas         | 6/6             | 1/1        | —                      | 8 rôles justes sur 4 épisodes, dont le refus de Lucas. D2 sur la relation, plausible et de rang 1, avec un mécanisme (ce que chacun gagne et protège). Part de l'utilisateur et alternative de période difficile. Les indicateurs donnent 3 demandes contre 1 et 3 aides contre 0 |
| R02 Bilal         | 0/5             | 0/1 (+n/e) | **Violé** (A2 rejetée) | Quatre réponses rejetées, toutes pour des erreurs de format du modèle : un JSON invalide, `rationale` placé dans une question, une clé locale citée comme identifiant `claim`. Rien d'appliqué                                                                                    |
| R03 Paul et Marie | 3/4             | —          | —                      | Relation Paul–Marie sans l'utilisateur, boucle attaque–retrait avec son alternative. L'utilisateur est observateur et ne fait l'objet d'aucune lecture. Rôles de R03-1 absents (½). Question discriminante imparfaite (½)                                                         |
| **Total**         | **9/15 (60 %)** | **1/2**    | R02                    |                                                                                                                                                                                                                                                                                   |

## 3. Décision

**R4.0a à R4.0c ne sont pas validés.** La fonction elle-même marche : R01 et R03 sont justes, et les rôles, les relations et les indicateurs se comportent comme prévu. Mais la robustesse de format du mode automatique est insuffisante : un scénario entier est perdu.

## 4. Cause et correction

- **Cause.** En mode automatique, la seconde tentative était une nouvelle génération « à l'aveugle », sans connaître l'erreur. Les mêmes fautes de format reviennent donc. `rationale` placé dans `payload` est apparu quatre fois en deux lots.
- **Correction (D-021).** En mode automatique, la seconde tentative reçoit le prompt d'origine suivi du motif exact du rejet (code et message), et demande un objet complet corrigé. C'est une boucle de validation bornée, prévue par IA-A.3. Les réponses brutes restent intactes et le reçu garde les deux essais.
- **Suite.** La correction s'accompagne d'un nouveau lot de contrôle R4-S02, scellé avant le lancement, pour valider R4.0a à R4.0c.
