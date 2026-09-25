# DEMO-R5-7 · Démonstration utilisateur dans l'application

Statut : **brouillon à relire par l'utilisateur** avant tout commit. Aucune donnée personnelle réelle ne figure ici.

## Contexte

| Élément        | Valeur                                                                                                     |
| -------------- | ---------------------------------------------------------------------------------------------------------- |
| Date           | 25 septembre 2026                                                                                          |
| Version testée | `567f12e` (« R5-S05 validé »), branche `claude/happy-knuth-om3xdo`                                         |
| Environnement  | Windows 11, Node v24.11.0, 105 tests sur 105 et `typecheck` propres avant la démo                          |
| Modèle         | `deepseek-flash` (prompt `analyst-v10`), en analyse automatique                                            |
| Base           | `manwe-next/.qa/demo-r5-7.sqlite3` (locale, ignorée par git, non versionnée)                               |
| Notes saisies  | 8                                                                                                          |
| Analyses       | 5 demandes : 3 réponses reçues (dont 1 appliquée), 1 échec fournisseur, 1 demande assistée jamais utilisée |
| Durée          | environ 1 h de session au total ; 297 s d'inférence cumulées (117 s, 94 s, 86 s)                           |
| Groupe utilisé | Réel : cercle familial et amical de l'utilisateur (à confirmer par lui). Aucun détail identifiant.         |

**La démonstration est incomplète.** Elle s'est arrêtée à la demande de l'utilisateur après l'application de l'extraction. Les étapes « interpréter », « Pourquoi », correction d'une preuve, réponse à une question, contexte, réanalyse, écran Intentions, réanalyse finale et redémarrage n'ont **pas** été jouées. Les constats ci-dessous ne disent donc rien de la qualité des lectures, des directions ni de la comparaison entre prédiction et résultat.

## Déroulé

1. **Installation.** `npm ci`, `npm test` (105/105) et `typecheck` passent. Deux obstacles d'environnement, sans rapport avec le produit : le dépôt était refusé par git (« dubious ownership ») et le code R5 n'était pas encore récupéré. Le service et l'interface démarrent bien sur les ports 5181 et 5180.
2. **Espace vide.** À l'ouverture, l'interface est en mode « Démonstration » et affiche des relations et une mémoire d'exemple, ce qui a fait croire à l'utilisateur que la base n'était pas vide. Il faut cliquer sur la pastille en haut à droite pour passer sur la « Mémoire locale ». L'utilisateur a saisi 8 notes et a d'emblée jugé la saisie non interactive.
3. **Analyse automatique.** L'analyse se lance depuis le bas de l'écran Mémoire. Il n'y avait pas de signe de vie visible pendant les 90 à 120 s de calcul, et un rechargement de la page a fait perdre le suivi (les deux premières réponses, prêtes, sont restées orphelines dans la base). Une analyse a échoué avec « Erreur inattendue du fournisseur ». La troisième a abouti et l'utilisateur l'a **appliquée** : 9 événements, 27 affirmations et 8 rôles proposés, aucune opération rejetée, 3 personnes créées dans la base.
4. **Exploration du graphe.** Le graphe et l'écran des personnes ne montrent pas les proches cités dans les notes (famille élargie, conjointes de proches). L'idée d'un graphe qui se reconfigure selon le nœud sélectionné a plu. Les vues multiples, sans vue d'ensemble, ont été jugées incohérentes.
5. **Étapes non jouées.** Correction, question, contexte, réanalyse, Intentions, réanalyse finale, comparaison prédiction/résultat : non jouées.
6. **Fermeture et relance.** Non jouée. Seul un rechargement de page a été observé : l'état des analyses n'y survit pas.

## Constats

### Interface et parcours

| N°  | Étape       | Constat                                                                                                                                                                                                                                      | Gravité            | Correction proposée                                                                                                                                                                          |
| --- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Espace vide | Le mode « Démonstration » est le mode par défaut et affiche des données d'exemple sans avertissement. L'utilisateur a cru que sa base contenait déjà des relations.                                                                          | bloquant           | Ouvrir sur l'espace réel. Signaler clairement tout mode de démonstration.                                                                                                                    |
| 2   | Saisie      | La saisie n'est pas interactive. Elle attend des notes libres sans guider sur ce qu'il faut consigner. Les notes se sont révélées incomplètes. Pour une personne en difficulté sociale, l'auto-évaluation est trop difficile.                | bloquant           | Entretien mené par l'IA : elle voit la base, repère les creux (milieux, personnes, périodes absents) et pose la question suivante. Vue d'ensemble de la couverture de la vie de la personne. |
| 3   | Saisie      | Vision exprimée : écrire ses notes en regardant le graphe, ou dans une section dédiée où l'on raconte sa vie. Un chat activable où l'agent voit l'ensemble et pose des questions, comme un psychologue, pour mieux cartographier et creuser. | bloquant (produit) | Concevoir la saisie comme un dialogue avec le graphe visible. À traiter dans une session UX dédiée.                                                                                          |
| 4   | Analyse     | Le lancement est tout en bas de l'écran Mémoire, après un long défilement.                                                                                                                                                                   | gênant             | Placer l'action d'analyse en haut, toujours visible.                                                                                                                                         |
| 5   | Analyse     | Le choix « Extraire les faits » ou « Interpréter » est exposé. L'utilisateur ne sait pas quoi choisir.                                                                                                                                       | bloquant (UX)      | MANWË choisit seul l'étape, et demande des faits quand il en manque.                                                                                                                         |
| 6   | Analyse     | La case « J'accepte la transmission » est dans l'écran de saisie.                                                                                                                                                                            | gênant             | La déplacer au premier démarrage ou à la saisie de la clé API, une seule fois.                                                                                                               |
| 7   | Analyse     | L'analyse assistée est proposée après un échec, alors qu'elle n'a plus de sens.                                                                                                                                                              | gênant             | La retirer et ne garder que l'automatique.                                                                                                                                                   |
| 8   | Analyse     | Aucun retour visuel fiable pendant 90 à 120 s. Trop de texte, pas assez de visuels.                                                                                                                                                          | bloquant           | Barre de chargement avec temps écoulé et étape. Réduire le texte au profit de visuels.                                                                                                       |
| 9   | Analyse     | Un rechargement de la page fait perdre le suivi et l'aperçu en attente. L'écran repropose de relancer. Les réponses prêtes restent orphelines dans la base.                                                                                  | bloquant           | Lire l'état depuis le service à chaque ouverture et proposer les analyses en attente. Aucun état gardé seulement dans la page.                                                               |
| 10  | Relecture   | Le bouton « Appliquer cette proposition » est introuvable sans explication, et la validation manuelle de chaque analyse alourdit le parcours.                                                                                                | gênant             | Voir la question ouverte 1.                                                                                                                                                                  |
| 11  | Analyse     | Deux analyses ont pu être lancées à quelques minutes d'écart sur la même révision, sans avertissement.                                                                                                                                       | gênant             | Désactiver le lancement pendant une analyse en cours, ou avertir.                                                                                                                            |
| 12  | Graphe      | Aucune vue globale. Plusieurs onglets séparés, dont une carte de « plans de bâtiments sans cohérence ». L'idée de la vue qui se reconfigure selon le nœud sélectionné est jugée bonne.                                                       | bloquant           | Un seul graphe global, avec zoom par niveaux ou par sélection.                                                                                                                               |
| 13  | Parcours    | L'ensemble est laborieux et contre-intuitif. L'interface expose la mécanique interne au lieu de suivre l'intention de l'utilisateur, et manque de permanence.                                                                                | bloquant           | Session de conception UX : parcours guidé de bout en bout et état persistant.                                                                                                                |

### Qualité des analyses

| N°  | Étape          | Constat                                                                                                                                                                                                                                                                                                                                                              | Gravité                    | Correction proposée                                                                                            |
| --- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 14  | Extraction     | Des personnes citées dans les notes (famille élargie, conjointes de proches) n'apparaissent ni dans le graphe ni dans les personnes. Seules 3 personnes existent dans la base, pour 9 événements et 27 affirmations. **Piste à confirmer** : la tâche « extraire » ne permet que `propose_event`, `propose_claim` et `propose_role`, et aucune création de personne. | bloquant                   | Toute personne ou tout groupe cité doit apparaître, même non caractérisé (« inconnu », trait gris avec « ? »). |
| 15  | Extraction     | Identifiant de personne : rien ne permet de nommer plus tard un « inconnu » ni de propager rétroactivement un nom mis à jour.                                                                                                                                                                                                                                        | bloquant pour l'usage réel | Identifiant interne stable, nom d'affichage modifiable et propagé. À placer dans l'ontologie et la roadmap.    |
| 16  | Extraction     | Une opération a été écartée : citation non recopiée à l'identique de la source. Défaut déjà connu (cinq rejets sur dix en R5-S05).                                                                                                                                                                                                                                   | gênant                     | Lever la limite d'une seule tentative, ou valider la citation côté service.                                    |
| 17  | Extraction     | Le modèle se déclare « claude-sonnet-4-5 » alors que le modèle vérifié est `deepseek-flash`.                                                                                                                                                                                                                                                                         | confort                    | Ne pas afficher une déclaration non vérifiée.                                                                  |
| 18  | Interprétation | Non testée : aucune lecture, hypothèse ni question n'a été produite.                                                                                                                                                                                                                                                                                                 | —                          | À jouer lors d'une prochaine démonstration.                                                                    |

### Technique

| N°  | Étape   | Constat                                                                                                                                | Gravité | Correction proposée                                                  |
| --- | ------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------- | -------------------------------------------------------------------- |
| 19  | Analyse | « Erreur inattendue du fournisseur » après environ 60 s, sans cause ni détail. Message par défaut du code, qui masque la vraie erreur. | gênant  | Journaliser la cause réelle (sans la clé) et proposer « Réessayer ». |
| 20  | Analyse | Extraction de 8 notes : 86 à 117 s par analyse.                                                                                        | gênant  | À surveiller. Un retour visuel suffit à le rendre supportable.       |
| 21  | Analyse | La demande assistée a été créée sans usage (12:47) et reste « en attente ».                                                            | confort | Disparaît avec le retrait de l'analyse assistée.                     |

## Ce qui a convaincu l'utilisateur

- L'idée d'un graphe qui se **reconfigure selon le nœud sélectionné**.
- L'analyse automatique elle-même, **quand elle aboutit** : trois passes sur quatre ont produit une proposition exploitable, sans rejet du validateur, et l'application de la troisième s'est déroulée sans difficulté.

## Questions ouvertes pour le pilote

1. **Validation manuelle** : garder « Appliquer / Écarter » pour chaque analyse, ou ne l'exiger que pour les étapes qui changent l'objectif ? Elle protège la discipline épistémique, mais elle est lourde pour l'utilisateur cible.
2. **Entretien guidé** : faut-il l'inscrire à R6, ou créer un jalon à part ? Il conditionne la qualité de tout le reste.
3. **Saisie dans le graphe** : est-ce la saisie principale, avec un chat activable façon entretien ? Quelle place pour le seuil d'intervention (D-004) ?
4. **Personnes non caractérisées** : accepter une entité « inconnue » de premier rang dans l'ontologie, avec un identifiant stable et un nom modifiable rétroactivement ?
5. **Consentement** : où le placer (démarrage ou saisie de la clé) ?
6. **Une seule tentative** : lever la limite pour les rejets de citation, comme le suggérait R5-S05 ?
7. **Session UX dédiée** : faut-il l'ouvrir avant de poursuivre R5.7 ? Le résultat de cette démonstration suggère que oui.

## Données techniques

- **Jetons consommés** (calculés depuis la base, l'écran de statut n'étant pas consultable hors session) : 119 644 au total, soit 45 795, 38 639 et 35 210 pour les trois réponses (environ 12 600 en entrée et 22 600 à 33 200 en sortie chacune). Aucun coût rapporté par le fournisseur.
- **Temps d'inférence** : 117 s, 94 s et 86 s.
- **Analyses rejetées** : aucune par le validateur (`rejection_code` vide sur les trois réponses). Une opération écartée par le validateur de citations (`citation_mismatch`) sur la première réponse.
- **Échec fournisseur** : une analyse, `provider_error`, message « Erreur inattendue du fournisseur », après environ 60 s. Cause réelle non conservée.
- **État final de la base** : révision 9, 3 personnes, 17 événements, 27 affirmations, 0 relation, 0 hypothèse, 0 question ouverte, 0 objectif.

## Suite proposée

Ouvrir une session de conception UX (constats 1 à 13), puis corriger l'extraction pour que toute personne citée apparaisse (constats 14 et 15), et rejouer la démonstration complète, y compris les étapes 5 et 6 non jouées.

## Seconde session · version `408be22` (thème Jewel case, agent autonome, conversation, écran du lieu)

Même jour, même utilisateur, nouvelle base vide (`demo-lieu.sqlite3`, ignorée par git). 110 tests sur 110 et `typecheck` propres avant le lancement. Session arrêtée à la demande de l'utilisateur : « ça n'a rien donné ». **Aucune des étapes 3 à 6 du déroulé n'a pu être jouée.**

### Ce qui s'est passé

- **Interface** : l'utilisateur la juge « déjà plus agréable » que la première version (thème sombre, majuscules, étiquettes rouges, encadré de consentement en tête d'écran). L'écran du lieu est le lieu de la conversation et du graphe.
- **Conversation** : 45 échanges, 22 notes enregistrées, 22 révisions. L'agent mène un entretien et résume ce qu'il entend, mais quand l'utilisateur lui demande de modéliser (« tu peux modéliser ? », puis « bah vas y »), il annonce « ton aperçu arrive » puis pose une nouvelle question au lieu de construire. L'utilisateur relève : « tu es censé modéliser le monde dans l'UI ».
- **Graphe** : resté vide. La base finale contient 0 personne, 0 affirmation, 0 relation, 0 lecture, 0 hypothèse.
- **Analyses** : 8 demandes, toutes de type « interpréter » et aucune d'« extraire ». 4 réponses reçues, dont 3 périmées (`stale`) et 1 rejetée (`subject_not_in_sources`). 5 demandes annulées (à la main ou après échec). Aucune appliquée.

### Constats complémentaires

| N°  | Étape        | Constat                                                                                                                                                                                                                                                                                                        | Gravité            | Correction proposée                                                                                                                                   |
| --- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| 22  | Ouverture    | Le système ne demande rien sur l'utilisateur (âge, sexe, humeur, situation, histoire), alors qu'il doit d'abord bien le connaître. Chaque acteur, l'utilisateur compris, se modélise pour lui-même ; aucun ne se lit à partir d'un autre.                                                                      | bloquant           | Profil de départ facultatif construit par l'entretien, avec statut « inconnu » tant qu'un champ est vide. Sensible pour un public vulnérable (D-004). |
| 23  | Agent        | L'agent n'a pas d'objectif propre. Il devrait être piloté par l'objectif de cartographier, pour pouvoir guider, et pour tous les acteurs (utilisateur, proches, groupes).                                                                                                                                      | bloquant (produit) | Plan de couverture explicite et visible, mis à jour par l'agent, d'où viennent ses questions et ses analyses.                                         |
| 24  | Agent        | L'IA doit être « driven », pas passive : elle cherche l'information qui améliore le plus la carte, avec respect du rythme et du consentement de la personne.                                                                                                                                                   | bloquant (produit) | Voir 23. À arbitrer avec la discipline épistémique (questions non suggestives).                                                                       |
| 25  | Analyse      | Le plan automatique de l'agent (`agentPlan`, `sqliteStore.ts`) déclenche « interpréter » dès que de nouvelles notes arrivent, sans jamais planifier « extraire ». Les événements, rôles et personnes ne sont donc jamais créés et le graphe reste vide. Une analyse est rejetée avec `subject_not_in_sources`. | bloquant           | Planifier l'extraction avant l'interprétation. MANWË choisit seul l'étape (constat 5).                                                                |
| 26  | Conversation | L'agent promet un aperçu qui ne vient pas et pose une question de plus quand l'utilisateur demande explicitement de modéliser. Une personne est citée par un prénom dont l'origine est incertaine.                                                                                                             | bloquant           | Donner au chat la commande « modéliser maintenant ». Ne citer que ce qui figure dans les notes.                                                       |
| 27  | Analyse      | Course de vitesse : une analyse dure 75 à 117 s et chaque échange crée une révision. Trois analyses sur quatre reçues sont périmées, ce qui gaspille environ 150 000 jetons.                                                                                                                                   | bloquant           | Appliquer les opérations sans conflit sur la révision courante, mettre les notes en file pendant le calcul, ou relancer sur la révision courante.     |
| 28  | Analyse      | Une erreur du domaine (`stale_revision`, « La mémoire a changé depuis la préparation de cette analyse ») s'affiche sous « Erreur inattendue du fournisseur ».                                                                                                                                                  | gênant             | Distinguer les erreurs du domaine de celles du fournisseur.                                                                                           |

Le constat 19 de la première session (message par défaut qui masque la cause) est de même nature.

### Ce qui a convaincu l'utilisateur

- L'interface de la seconde version est plus agréable.
- L'idée d'une conversation qui pose des questions pour cartographier, dans son principe (la réalisation ne construit pas encore).

### Données techniques de la seconde session

- **Jetons** (calculés depuis la base) : 148 434 pour les 4 réponses reçues (26 902, 35 496, 43 824 et 42 212).
- **Inférence** : 75 s, 105 s, 115 s et 117 s, soit 410 s cumulées.
- **Rejets** : 1 (`subject_not_in_sources`). Périmées : 3. Annulées : 5. Appliquées : 0.
- **État final** : révision 22, 22 notes, 45 échanges, 0 personne, 0 affirmation, 0 relation, 0 lecture.

### Questions ouvertes supplémentaires pour le pilote

1. **Modèle de l'utilisateur et de chaque acteur** : ces exigences (profil de départ, objectifs de l'agent, plan de couverture pour tous) sont-elles déjà dans la spécification et la roadmap ?
2. **Ordre des étapes** : l'agent choisit-il seul entre extraire, interpréter et réviser, et comment gère-t-il l'écriture pendant un calcul ?
3. **Priorité** : corriger l'extraction (25 à 27) avant toute nouvelle démonstration ? Rejouer alors le déroulé complet, dont les étapes 3 à 6 jamais jouées.

### Corrections faites après la seconde session (pilote)

| Constat    | Correction                                                                                                                                                                    |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 25         | L'agent relève d'abord (extraction : personnes, épisodes, rôles, faits), puis interprète.                                                                                     |
| 27         | Une analyse s'applique même si des notes ont été ajoutées pendant le calcul ; seule une autre écriture (correction, analyse, choix) la rend périmée.                          |
| 25 (rejet) | Une opération refusée par le moteur (sujet absent des notes) est écartée seule, avec ses dépendantes, dans la limite de 20 % (D-025) ; la réponse n'est plus rejetée en bloc. |
| 26         | La conversation peut lancer la modélisation (« action » `modeliser`), sait ce qui est déjà construit, ne promet plus d'aperçu et n'invente aucun prénom.                      |
| 28         | Les erreurs du moteur ne s'affichent plus comme des erreurs du fournisseur.                                                                                                   |
| —          | Lanceur Windows (`MANWE.cmd`) : mise à jour depuis git, installation si besoin, lancement et ouverture du navigateur.                                                         |

Les constats 22 à 24 (profil de l'utilisateur, objectif propre de l'agent, plan de couverture) sont des choix de produit, proposés à l'utilisateur.
