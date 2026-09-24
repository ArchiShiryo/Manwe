# Évaluation assistée Sol — 14 septembre 2026

Statut : **trois propositions acceptées par le harnais, preuve assistée non
aveugle**.

## Périmètre

Sol a analysé trois `ContextPacket` fictifs isolés : négation, conditionnel et
propos rapporté. Les attentes ne figurent pas dans les paquets. Les propositions
brutes, paquets et reçus synthétiques sont conservés dans ce dossier.

Il ne s'agit ni d'un appel DeepSeek, ni d'un fournisseur automatique, ni d'une
évaluation indépendante : Sol construit aussi le produit et connaît le corpus.
Les identifiants de transport ont été régénérés après expiration des premiers
paquets ; le contenu sémantique des réponses n'a pas été retouché.

## Résultats

| Cas             | Proposition                                                    | Résultat applicatif           | Révision | Rejeu exact            |
| --------------- | -------------------------------------------------------------- | ----------------------------- | -------- | ---------------------- |
| Négation        | claim d'absence d'invitation, catégorie `reported_observation` | appliqué, une citation exacte | 1 → 2    | reconnu, aucun doublon |
| Conditionnel    | aucun fait accompli                                            | `no_change`                   | 1 → 1    | reconnu                |
| Propos rapporté | claim attribué à Léa, catégorie `reported_observation`         | appliqué, une citation exacte | 1 → 2    | reconnu, aucun doublon |

Chaque base a été fermée puis rouverte avant le contrôle de persistance. Les
trois réponses ont passé le parseur strict, le contrôle de contexte et les
citations sans correction sémantique après génération.

## Conclusion bornée

Cette série établit que le parcours manuel Sol peut transporter et appliquer de
véritables propositions sur ces trois cas. Elle ne valide pas R2 dans son
ensemble : l'ingestion JSON/CSV, les ambiguïtés d'identité, la métrologie et les
cas limite de taille/expiration restent à compléter. `IA-A` demeure non validé
tant qu'un fournisseur automatique et DeepSeek ne sont pas réellement raccordés.
