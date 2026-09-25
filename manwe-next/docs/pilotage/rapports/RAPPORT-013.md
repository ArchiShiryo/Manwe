# RAPPORT-013 — Mémoire de travail allégée (lot R5-S04)

25 septembre 2026. Les attentes ont été scellées avant les correctifs de RAPPORT-012 ([R5-S04-attentes.md](../scelles/R5-S04-attentes.md), empreinte vérifiée : `2ac14953…d556`).

Run : `packages/evaluation/runs/2026-09-25-deepseek-flash-r5-s04`. Modèle DeepSeek V4.1-Flash en mode automatique, prompt v10, contrat 1.7. Le lot a coûté 12 appels et 840 715 jetons.

Les entrées sont les mêmes que pour R5-S02 et R5-S03. Seule la règle de choix du harnais a changé : il choisit la direction dont le titre ou l'action contient un mot du résultat, écrit avant le run.

## Notation

| Critère                                                        | P01                                                                                                                                                                                                                                  | P02                                                                                                                                                                                                                                       |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [B] Aucune analyse perdue                                      | 1/1 : A3 rejetée une fois (`reference` avec un champ `claim`), puis appliquée à la seconde tentative                                                                                                                                 | 1/1 : A3 rejetée une fois (JSON invalide), puis appliquée à la seconde tentative                                                                                                                                                          |
| [L] Relations clés et lecture de groupe                        | 1/1 : six lectures sur le sujet Jules + Maya + utilisateur, dont « celui qui nomme un problème se retrouve chargé de le résoudre » et ses alternatives (norme d'abstention, absence d'attribution nominative)                        | 1/1 : quatre lectures sur le groupe du club, dont la lecture D5 « le groupe récompense la disponibilité » face à « le club manque simplement de bénévoles »                                                                               |
| [L] Objectif proposé, cité, dans les termes de l'utilisateur   | 1/1 : « Que la gestion de la coloc ne repose plus sur toi seul, sans quitter la colocation » ; une seconde proposition reste en attente, non adoptée                                                                                 | 1/1 : « Que l'équipe s'organise sans que tout repose sur lui, tout en restant au club »                                                                                                                                                   |
| [L] Directions : « ne rien entreprendre » et phase transitoire | 1/1 : cinq directions, cinq leviers différents                                                                                                                                                                                       | 1/1 : six directions, six leviers différents                                                                                                                                                                                              |
| [L] Réanalyse qui compare la prédiction au résultat et le cite | 1/1 : « La prédiction "toute nouvelle tentative de répartition retombe sur l'utilisateur" est démentie par la deuxième semaine du tableau »                                                                                          | 1/1 : « Le résultat de l'action ne mentionne ni Samir ni sortie : la prédiction de la lecture […] n'a pas été mise à l'épreuve par cet épisode » ; la lecture de groupe est démentie                                                      |
| [B] Direction choisie cohérente avec le résultat               | **0/1** : la règle a choisi « Une micro-demande à Maya », à cause du mot « tâche » dans l'action. Le résultat raconte un tableau de tâches. La direction cohérente existait : « Poser la répartition comme une question nominative » | **0/1** : la règle a choisi « Retrouver Samir hors du club », à cause de « match » dans « sans échéance de match ». Le résultat raconte un match confié à chacun. La direction cohérente existait : « Une tâche, une personne, une date » |

| Critère sur le lot                                                | Note                                                                                                                                                                                       |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [B] Réduction moyenne d'au moins 40 % sur A2–A5, sur un même état | 1/1 : **48,7 %**. P01 : 41,3 %, 47,2 %, 52,1 %, 50,3 % ; P02 : 43,8 %, 49,8 %, 53,0 %, 52,5 %                                                                                              |
| [B] Aucun paquet de travail au-dessus de 60 % du complet          | 1/1 : 58,7 % au plus (P01-A2)                                                                                                                                                              |
| [B] Requêtes en lecture seule, journalisées                       | 1/1 : 19 requêtes dans `analysis_queries` ; 29 révisions par scénario, toutes issues des captures et des propositions appliquées ; mécanismes conservés en base (6 et 11 lectures)         |
| [L] Au moins une requête pertinente                               | 1/1 : en A4, avant de proposer les directions, le modèle ouvre les lectures (10 en P01, 8 en P02) et la fiche de Samir. C'est l'usage visé : lire le mécanisme avant d'y appuyer un levier |
| [B] Aucun avertissement de plafond de directions                  | 1/1                                                                                                                                                                                        |

**Lot : 9/9 [L] (100 %), 6/8 [B] (75 %), aucun interdit violé.** Aucune lecture n'a perdu son mécanisme en base, et aucune requête n'a écrit.

**Décision : le lot n'est pas validé**, car le seuil exige 100 % des points [B].

Les deux points manquants viennent du **harnais**, pas du moteur ni du modèle :

- la règle de choix par mots-clés a été appliquée comme écrite ;
- mais elle est trop lâche : un mot courant (« tâche », « match ») suffit ;
- elle a donc choisi une direction sans rapport avec le résultat.

Tout ce que visait le BRIEF-006 est démontré :

- aucune analyse perdue ;
- réduction des paquets de 48,7 % ;
- exploration libre ;
- sujets de groupe ;
- pas de plafond de directions.

## Observations

- **Le modèle lit avant d'agir.** Dès que le détail des lectures n'est plus dans le paquet, le modèle va le chercher, et exactement au bon moment (A4, les directions). En R5-S03, alors que tout était dans le paquet, il n'avait fait qu'une série de requêtes. La mémoire de travail a donc créé l'usage des requêtes, au lieu de le brider.
- **Le modèle résiste à l'incohérence du harnais.** En P02, il refuse de tenir la lecture sur Samir pour confirmée par un résultat qui ne la concerne pas. Il révise en revanche la lecture de groupe que le résultat dément vraiment. C'est la conduite attendue.
- **Rejets récurrents de format.** C'est la deuxième fois qu'une référence reçoit un champ `claim` (ou `claim` et `stance` en R5-S03) : le modèle veut dire qu'un fait soutient ou contredit une lecture à l'endroit même où il la cite. La seconde tentative corrige à chaque fois, mais le besoin est réel. On pourrait l'accepter dans le contrat (1.8) ou le dire plus clairement dans le prompt.
- **Coût.** Environ 70 000 jetons par appel, contre 66 000 en R5-S03 : les requêtes ajoutent un tour en A4, mais les paquets pèsent moitié moins.

## Correctif proposé pour le choix de direction (non fait)

Trois options :

1. **Choix par l'humain.** Le pilote choisit la direction avant d'écrire le résultat, ou le résultat est écrit après le choix. C'est le plus réaliste, mais le choix n'est plus aveugle.
2. **Règle plus stricte, scellée.** Levier imposé (`lower_barrier` ou `change_game`) et au moins deux mots-clés distinctifs du résultat (« nominati », « chacun sa », « une personne »), sinon « aucun choix » et une étape notée comme non exercée.
3. **Résultat conditionnel.** La fixture fournit un résultat par levier ; le harnais enregistre celui du levier choisi. C'est cohérent par construction, mais le scénario est plus lourd à écrire.

Recommandation : l'option 3, qui garde le protocole aveugle et rend le lot indépendant du hasard du choix.
