# RAPPORT-012 — Mémoire de travail, exploration libre, groupes (lot R5-S03)

25 septembre 2026. Les attentes ont été scellées avant le code du BRIEF-006 ([R5-S03-attentes.md](../scelles/R5-S03-attentes.md), empreinte vérifiée : `698a8753…25ee`).

Run : `packages/evaluation/runs/2026-09-26-deepseek-flash-r5-s03`. Modèle DeepSeek V4.1-Flash en mode automatique, prompt v9, contrat 1.7. Le lot a coûté 11 appels et 732 991 jetons, contre 14 appels et 915 327 jetons pour R5-S02.

Les entrées sont les deux parcours de vingt notes de R5-S02, rejoués tels quels : P01, la colocation (Maya, Jules, Karim), et P02, le club de volley (Léa, Hugo, Samir).

## Notation

| Critère                                                               | P01                                                                                                                                                      | P02                                                                                                                                                                               |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [B] Aucune analyse perdue                                             | 1/1 : cinq analyses appliquées au premier essai                                                                                                          | 1/1 : A5 rejetée une fois (`reference` avec des champs inconnus `claim`, `stance`), puis appliquée à la seconde tentative (D-021)                                                 |
| [L] Relations clés et lecture de groupe, avec sujet de groupe         | 1/1 : trois lectures sur le sujet Maya + Jules + utilisateur, dont « la coloc récompense l'utilisateur-pourvoyeur » ; les dyades avec Maya et avec Jules | 1/1 : trois lectures D5 sur le noyau du club (Léa, Hugo, Samir, utilisateur) ; les dyades avec Léa et avec Hugo                                                                   |
| [L] Objectif proposé, cité, dans les termes de l'utilisateur          | 1/1 : « Que la coloc tourne sans qu'il soit le seul à tout gérer, tout en continuant à vivre avec Maya et Jules », avec la citation intégrale            | 1/1 : « Que l'équipe prenne une part de l'organisation, sans quitter le club »                                                                                                    |
| [L] Directions avec « ne rien entreprendre » et une phase transitoire | 1/1 : six directions, dont « Ne rien entreprendre »                                                                                                      | 1/1 : six directions, dont « Ne rien entreprendre »                                                                                                                               |
| [L] Réanalyse qui compare la prédiction au résultat et le cite        | 1/1 : « Sa prédiction "sans relance, la répartition revient à l'état antérieur" est démentie la deuxième semaine » ; cinq faits citent le résultat       | 1/1 : « "Aucun mécanisme de redistribution" est démenti au moins une fois » ; « la prédiction "de nouveaux désistements logistiques" se vérifie » ; cinq faits citent le résultat |

| Critère sur le lot                                                                  | Note                                                                                                                                                                                                                          |
| ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [B] Mémoire de travail : paquets A2–A5 réduits d'au moins 40 % par rapport à R5-S02 | **0/1 : réduction de 23,4 %** (somme des huit paquets). Détail : P01 51 %, 22 %, 2 %, −4 % ; P02 12 %, 28 %, 34 %, 29 %. Le texte des notes analysées n'est plus envoyé (premier volet tenu), mais la moyenne manque le seuil |
| [B] Requêtes servies en lecture seule et journalisées                               | 1/1 : six requêtes journalisées dans `analysis_queries` avec l'analyse P02-A4 ; aucune révision de la mémoire hors des propositions appliquées                                                                                |
| [L] Au moins une requête pertinente                                                 | 1/1 : en P02-A4 (exploration des directions), le modèle ouvre six notes : l'expression de l'objectif, le repas accepté, la salle préparée seul, le refus des plannings par Hugo, l'agacement de Léa, la remarque de Samir     |
| [B] Aucun avertissement de plafond de directions                                    | 1/1                                                                                                                                                                                                                           |

**Lot : 9/9 [L] (100 %), 3/4 [B] (75 %), aucun interdit violé.** Les objectifs portent sur l'utilisateur et gardent le lien (« sans partir », « sans quitter le club »). Aucune direction ne trompe un tiers.

**Décision : le lot n'est pas validé**, car le seuil exige 100 % des points [B].

Tout le reste est démontré sur les deux scénarios :

- le parcours complet (R5.1), l'objectif émergent (R5.4) et le rejeu sur un autre groupe (R5.6) ;
- les sujets de groupe et l'exploration libre ;
- l'absence de plafond de directions.

Plus aucune analyse n'est perdue : P01, qui avait perdu trois analyses sur cinq dans R5-S02, passe entièrement.

## Pourquoi la réduction manque le seuil

Composition des paquets, en caractères :

| Paquet          | Notes (texte) | Lectures             | Faits  | Directions | Rôles  |
| --------------- | ------------- | -------------------- | ------ | ---------- | ------ |
| R5-S02 · P01-A5 | 8 528         | 18 613 (8 lectures)  | 13 287 | 6 673      | 6 987  |
| R5-S03 · P01-A5 | 800           | 23 486 (13 lectures) | 13 277 | 11 382     | 5 991  |
| R5-S02 · P02-A5 | 8 310         | 44 938 (17 lectures) | 31 778 | 6 601      | 18 181 |
| R5-S03 · P02-A5 | 700           | 41 499 (19 lectures) | 14 785 | 11 150     | 5 834  |

- **Ce qui a été allégé.** Le texte des notes a presque disparu. Les faits et les rôles sont divisés par deux, à état comparable. Sur un même état (test `working-memory`, P02 de R5-S02), la réduction est de 39,9 %.
- **Ce qui ne l'a pas été.** Les lectures gardent leur énoncé complet, leur mécanisme, leurs limites et leurs conditions de révision. Elles pèsent maintenant le tiers du paquet.
- **Un monde plus riche.** Le modèle a produit plus de lectures (13 et 19 au lieu de 8 et 17) et trois fois plus de directions (6 par objectif, D-024). Or chaque direction transporte toutes ses prédictions.
- **Une comparaison entre deux runs.** Le critère compare deux runs dont les états divergent dès A1. Il mesure donc aussi la richesse du monde, pas seulement la compression. C'est une faiblesse du critère, mais il était scellé tel quel et il est noté tel quel.

## Correctifs proposés (non faits)

1. **Lectures en mémoire de travail.**
   - Garder l'énoncé, la profondeur, le statut, la confiance, le rang et les identifiants des preuves.
   - Servir le mécanisme, les limites et les conditions de révision par `get_hypothesis`. L'outil existe déjà.
2. **Directions non choisies.**
   - Garder le titre, le levier et la direction choisie en entier.
   - Servir le détail des prédictions des autres directions à la demande.
3. **Mesure.** Pour le prochain lot, mesurer la réduction sur un même état : paquet complet contre paquet de travail, à chaque étape du run. On ne compare plus deux runs.

Un lot R5-S04, avec de nouvelles attentes scellées, doit suivre ces correctifs pour valider le BRIEF-006.

## Observations

- **Exploration peu utilisée.** Le modèle a interrogé la mémoire une seule fois sur dix analyses, alors que rien ne le bride. Il ne relit le texte brut que lorsqu'il en a besoin pour ancrer des directions.
- **Incohérence du harnais repérée par le modèle.** Le harnais choisit la première direction proposée, mais le texte du résultat est fixé à l'avance. En P01, la direction choisie était « Se donner une source d'appartenance hors de l'appartement », alors que le résultat raconte un tableau de tâches. En A5, le modèle le relève (« l'arbitrage attendu par la direction choisie n'ayant produit aucune sortie extérieure consignée ») et ne s'appuie pas sur ce décalage. Le harnais devrait choisir la direction dont le levier correspond au résultat, ou écrire le résultat après le choix.
- **Rejet P02-A5.** Le modèle a ajouté des champs `claim` et `stance` à une référence. C'est le signe d'un besoin réel : dire qu'une preuve soutient ou contredit une lecture. Cela aurait dû passer par `revise_hypothesis`. À surveiller.
