# RAPPORT-011 — Parcours complet, objectif émergent, rejeu sur un autre groupe (lot R5-S02)

25 septembre 2026. Les attentes ont été scellées avant le code de R5.4 ([R5-S02-attentes.md](../scelles/R5-S02-attentes.md), empreinte vérifiée : `582b3b30…d58f`).

Run : `packages/evaluation/runs/2026-09-25-deepseek-flash-r5-s02`. Modèle DeepSeek V4.1-Flash en mode automatique, prompt v8, contrat 1.6. Le lot a coûté 14 appels et 915 327 jetons ; les paquets de vingt notes sont plus lourds.

Deux scénarios de vingt notes et trois personnes, joués en parallèle :

- **P01**, colocation : Maya, Jules et Karim ;
- **P02**, club de volley : Léa, Hugo et Samir. P02 rejoue la même dynamique avec d'autres noms et d'autres mots.

## Notation

| Critère                                                                    | P01                                                                                                                                         | P02                                                                                                                                                         |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [B] Trois personnes, sans doublon ni invention                             | 1/1                                                                                                                                         | 1/1                                                                                                                                                         |
| [L] Relations clés et rôle de groupe                                       | 1/1 : asymétrie avec Maya, reprise silencieuse avec Jules, l'utilisateur « absorbe » les tâches (D2), reconnaissance contre délégation (D3) | 1/1 : initiative de Léa, compensation d'Hugo, lecture D5 du club (« la charge se concentre sur celui qui ne la refuse pas »), dyade Léa–Hugo, rôle de Samir |
| [L] R5.4 : objectif proposé, cité, dans les termes de l'utilisateur        | **0/1** : l'analyse A3 a été perdue, donc objectif de secours                                                                               | 1/1 : « Que l'équipe s'organise sans que tout repose sur lui, sans quitter le club », avec deux citations et le problème formulé                            |
| [B] R5.4 : proposition non confirmée avant adoption, puis courante         | **0/1** : non exercé, faute de proposition                                                                                                  | (non prévu pour P02, mais vérifié : proposition en attente, adoptée à l'étape `adopt`, puis visée par les directions)                                       |
| [L] Directions : deux au plus, « ne rien entreprendre », phase transitoire | 1/1 : Jules « teste si tu vas compenser », inconfort de l'utilisateur devant la tâche laissée                                               | 1/1                                                                                                                                                         |
| [L] Réanalyse qui compare la prédiction au résultat                        | **0/1** : l'analyse A5 a été perdue                                                                                                         | 1/1 : « confirme la barrière […] mais démentit la prédiction "la répartition ne changera pas" » ; lectures affaiblies ou renforcées selon le résultat       |
| [B] R5.6 : même lot, même version, parcours complet                        | —                                                                                                                                           | 1/1                                                                                                                                                         |
| **Total**                                                                  | 2/4 [L], 1/2 [B]                                                                                                                            | 4/4 [L], 2/2 [B]                                                                                                                                            |

**Lot : 6/8 [L] (75 %), 3/4 [B] (75 %), aucun interdit violé.** Tous les objectifs portent sur ce que l'utilisateur veut, sans rupture ni objectif pour un tiers, et aucune direction ne trompe personne.

**Décision.** Le lot n'est **pas validé** : le seuil exige 100 % des points [B]. Le parcours complet (R5.1), l'objectif émergent (R5.4) et le rejeu (R5.6) sont démontrés de bout en bout sur P02, mais P01 a échoué pour des raisons de format. Un lot R5-S03, avec de nouvelles attentes scellées, doit suivre les correctifs ci-dessous.

## Pourquoi P01 a échoué

Trois analyses sur cinq ont été rejetées deux fois chacune. Aucun rejet ne porte sur le sens :

| Analyse | 1re tentative                                                                                                              | Seconde tentative                     |
| ------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| A2      | relation à trois membres (Maya, Jules, l'utilisateur) : le modèle veut lire le groupe, le contrat n'accepte que des dyades | citation mal recopiée                 |
| A3      | citation mal recopiée                                                                                                      | `rationale` de plus de 800 caractères |
| A5      | citation mal recopiée                                                                                                      | JSON invalide                         |

La citation fautive est toujours la même phrase : « tu t'en **occupes** ? » devient « occu**q**ues » ou « occu**v**es ». Dans chaque cas, **une seule citation sur 29 à 53** fausse toute la réponse. Le texte cité est corrompu, pas seulement les positions : on ne peut pas le réparer sans rapprochement approximatif, ce qui trahirait l'exactitude des citations.

Les paquets de vingt notes rendent les réponses longues (jusqu'à 53 citations), et le risque d'une faute de recopie grandit avec elles.

## Correctifs faits après notation

Le moteur n'a pas été modifié pendant le run.

- **Message d'erreur actionnable.** `citation_mismatch` nomme maintenant l'opération fautive, la citation reçue et le texte exact de la source. La seconde tentative informée (D-021) peut ainsi corriger précisément.
- **Limite de `rationale`** portée de 800 à 1 500 caractères.
- Tests : `tests/directions.test.mjs` (RAPPORT-011).

## Décisions proposées à l'utilisateur (D-025)

1. **Application partielle.**
   - Proposition : écarter seulement une opération dont une citation est fausse, avec un avertissement, au lieu de rejeter toute la réponse ; les opérations qui en dépendent (`proposalKey`) sont écartées avec elle.
   - Pour : une faute de recopie ne coûte plus toute une analyse.
   - Contre : l'analyse appliquée devient incomplète sans que le modèle le sache.
   - Alternative : garder le rejet complet, et compter sur le message actionnable et la seconde tentative.
2. **Sujets de groupe.**
   - Proposition : accepter un sujet `{ "group": [membres…] }` de trois membres ou plus, pour les lectures de colocation, d'équipe ou de famille (D5).
   - Aujourd'hui, le modèle contourne l'obstacle en listant plusieurs sujets (P02), ou échoue (P01).
3. **Taille des paquets.**
   - Proposition : limiter le nombre de sources citables par analyse (par exemple les douze plus récentes, plus celles des lectures en cours).
   - Pour : des réponses plus courtes, donc moins de fautes de recopie.
   - Contre : une vue moins large.

## Limites

- **Un seul tirage.** La perte de P01 peut être en partie aléatoire : P02, de même taille, n'a eu qu'une erreur, corrigée à la seconde tentative.
- **Adoption mécanique.** Le harnais adopte l'objectif proposé à la place de l'utilisateur ; dans l'interface, l'adoption est un geste explicite (`scripts/ui-check-goal.mjs`).
