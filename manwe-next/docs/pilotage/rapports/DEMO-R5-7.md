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

## Troisième session · parcours complet rejoué sur un groupe fictif (version `52dcd1e` + correctifs de transport)

Objectif : jouer les étapes 3 à 6 du déroulé, restées non jouées. **Ce n'est pas la démonstration de l'utilisateur** : elle a été conduite par l'assistant, par l'interface de programmation du service (mêmes routes que l'interface), sur une colocation **fictive** de 12 notes (quatre colocataires, un propriétaire, un voisin inconnu), dans un espace séparé. Elle valide la chaîne technique et le comportement de l'agent, pas la lisibilité à l'écran ni l'accueil par l'utilisateur.

### Déroulé

1. **Saisie et consentement** : 12 notes, consentement de transmission accordé pour cet espace de test. L'agent lance seul l'extraction, puis l'interprétation : 7 personnes, 10 relations, 36 affirmations, 12 hypothèses, 2 questions et 1 objectif proposé, en 3 min 30, sans rejet ni analyse périmée.
2. **Corrections** : correction d'une preuve, réponse à une question, contexte sur une lecture. L'agent réanalyse seul (2 min 20). La lecture concernée passe de « brouillon » à « plausible », la question est marquée répondue, une nouvelle question apparaît, la preuve corrigée est marquée contestée.
3. **Intentions** : reformulation de l'objectif proposé (il devient confirmé). L'agent propose 5 directions avec des prédictions par acteur. Choix d'une direction avec l'attente de l'utilisateur, puis saisie d'un résultat sans verdict (les verdicts sont facultatifs).
4. **Réanalyse finale** (4 min) : quatre faits du résultat sont extraits, **mais aucune lecture n'est révisée** et aucune ne cite le résultat.
5. **Redémarrage** : le service est arrêté puis relancé. L'état est **strictement identique** (révision 24, tout le contenu égal).

### Constats

| N° | Étape | Constat | Gravité | Correction proposée |
| --- | --- | --- | --- | --- |
| 29 | Analyse | Sur les analyses longues, la connexion au fournisseur était coupée vers 120 s (« terminated »), sans relance. Le graphe restait vide. | bloquant | **Corrigé en local** (commit `e418e94`) : réponse lue en flux, connexion coupée relancée, motif du refus affiché. À intégrer. |
| 30 | Analyse | En flux, les appels d'outils du modèle étaient rejoués sans leur champ `type`, et le fournisseur répondait 422. Régression de ma première correction, trouvée et corrigée avec un test. | bloquant | Corrigé avec le point 29. |
| 31 | Fond | Le fond WebGL se fige quand le système demande de réduire les animations, sans réglage ni avertissement. | confort | **Corrigé en local** : bouton « Fond animé / Fixe » mémorisé. Le style reste à recaler sur les maquettes. |
| 32 | Réanalyse finale | La comparaison entre prédiction et résultat n'apparaît pas : sans verdicts saisis, la réanalyse extrait les faits du résultat mais ne révise aucune hypothèse et ne dit pas ce qui était juste dans la prédiction. Les prédictions (Nora vient, Théo en retard, Basile absent) n'ont jamais été jugées. | bloquant (étape 5 du déroulé) | Faire produire les verdicts par l'agent (avec l'utilisateur en validation), ou rendre la comparaison visible même sans verdicts. |
| 33 | Extraction | Doublon de personne : « Camille » et « Camille, la petite amie de Théo » coexistent, sans ambiguïté signalée. | gênant | Détecter les noms qui se recouvrent et proposer la fusion. Lié aux constats 14 et 15. |
| 34 | Interprétation | 12 notes donnent 12 hypothèses, dont plusieurs de profondeur D5 (norme du groupe) ou sur l'intériorité de l'utilisateur (« ne dit rien parce que cela ne le dérange pas »). Marquées « brouillon » ou de faible confiance, mais hardies pour si peu de faits. Conforme au mode capacité maximale (D-006). | à trancher | Question ouverte : où placer le seuil entre profondeur et prudence pour un public vulnérable. |
| 35 | Graphe | Autour de « Vous », le graphe est tronqué (19 nœuds, « schéma allégé »). Il ne donne toujours pas de vue d'ensemble (constat 12). | gênant | Vue globale avec zoom. |
| 36 | Couverture | La couverture est à 58 % après 12 notes, avec « Vous » à 2 sur 8 champs connus. Le profil de l'utilisateur reste largement vide. | gênant | À relier à l'entretien guidé (constats 2, 22 et 23). |

### Ce qui a fonctionné

- L'enchaînement autonome extraction, interprétation, réanalyse, exploration, sans intervention : 5 analyses appliquées, **0 rejet, 0 périmée**.
- Les corrections sont prises en compte et se lisent dans les hypothèses et les questions.
- Les 5 directions sont concrètes, avec des prédictions par acteur et par horizon.
- Reprise après redémarrage : état identique.

### Données techniques de la troisième session

- **Jetons** : 493 913 au total (38 086 extraction, 103 485 interprétation, 151 224 première réanalyse, 141 237 exploration, 59 881 réanalyse finale). La réanalyse est l'étape la plus coûteuse.
- **Inférence** : 77 s, 125 s, 108 s, 67 s et 93 s, soit 470 s cumulées.
- **Rejets et périmées** : aucun.

### Limites de cette session

- Conduite par l'assistant, sur des données fictives : aucun retour d'usage, aucune lecture d'écran.
- Les notes ont été saisies par le journal ; la conversation avec l'agent n'a pas été testée.
- Objectif : seule la reformulation a été jouée (ni l'adoption telle quelle ni l'écart).
- Verdicts : non testés (facultatifs).

### Questions ouvertes supplémentaires pour le pilote

1. **Boucle d'action** : l'agent doit-il juger lui-même les prédictions à partir du résultat, ou l'utilisateur les note-t-il ? Sans l'un ou l'autre, la comparaison n'existe pas.
2. **Intégration** : reprendre les commits de transport et de fond (branche locale `claude/fix-provider-coupure`), avec leurs tests.
3. **Nouvelle démonstration par l'utilisateur** : la rejouer sur la version actuelle, avec ses propres notes, pour juger l'accueil et la lisibilité.

## Quatrième passe · conversation, adoption d'objectif et verdicts (espace fictif, mêmes conditions)

Compléments aux limites de la troisième passe. Toujours conduite par l'assistant, par l'interface de programmation, sur un personnage fictif (un développeur de 27 ans, seul dans une ville nouvelle, un frère, une cheffe d'équipe, un collègue), cette fois **par la conversation**. Tests automatiques avant la passe : 113 sur 113, `typecheck` propre.

### Ce qui a été joué

- **Conversation** : 5 messages. L'agent répond en 4 à 18 s, reformule et pose à chaque fois une seule question sur un épisode précis. À « tu peux modéliser ce que je t'ai dit ? », il lance l'analyse et explique où regarder (**le constat 26 est corrigé**). Extraction puis interprétation : 3 personnes, 1 relation, 5 hypothèses, 1 objectif proposé, en 3 min 40.
- **Profil de l'utilisateur** tiré de ses seuls mots : âge, situation, cadre de vie, ce qui pèse, personnes qui comptent, soit 5 champs sur 8 connus. Couverture globale à 57 %. L'agent nomme donc l'utilisateur et le décrit sans formulaire (**constats 22 et 36 en partie levés**).
- **Objectif** : adoption tel quel (il devient confirmé, texte inchangé) et reformulation.
- **Directions** : 4 propositions, dont « Ne rien changer ». Choix d'une direction d'action et saisie d'un résultat **avec verdicts** (confirmé, réfuté, incertain, aucun) : ils sont enregistrés tels quels. La réanalyse (1 min 55) produit 3 hypothèses qui citent le résultat. **Sans verdicts (troisième passe), aucune** : le constat 32 se précise ainsi. La comparaison n'existe que si des verdicts sont saisis.

### Constats complémentaires

| N° | Étape | Constat | Gravité | Correction proposée |
| --- | --- | --- | --- | --- |
| 32 (précisé) | Réanalyse finale | Avec verdicts saisis, la comparaison alimente 3 lectures ; sans verdicts, aucune. Or les verdicts sont facultatifs et demandent un effort à l'utilisateur. | bloquant | Faire proposer les verdicts par l'agent, l'utilisateur validant ou corrigeant. |
| 37 | Agent | Après un échec `stale_revision` (mon test avait écrit deux fois l'objectif en quelques secondes), l'agent reste inactif avec l'exploration « en attente » plus de 3 minutes, sans relance. La relance dépend d'un clic ou d'une nouvelle écriture. | gênant | Relancer seul après un échec périmé, avec un plafond de reprises. Afficher clairement l'état « bloqué ». |
| 38 | Objectif | Créer un objectif sans identifiant remplace l'objectif confirmé (un seul objectif actif). Un objectif confirmé ne peut pas être écarté (409 voulu : « se reformule, ne s'écarte pas »). | à trancher | Confirmer que c'est voulu et le dire dans l'interface. L'écart d'un objectif **proposé** n'a pas été joué. |
| 39 | Conversation | Toutes les réponses commencent par « Merci Ilan. », et l'agent passe du vouvoiement au tutoiement en cours d'échange. | confort | Varier les ouvertures, fixer le registre dès le début. |
| 40 | Direction | « Ne rien changer » est une direction à part entière : elle n'accepte aucun résultat (`outcome_without_target`). | à trancher | Le dire dans l'interface plutôt que par une erreur. |

### Ce qui n'a pas été joué

- L'écart d'un objectif proposé (non confirmé).
- La lecture à l'écran : interface, clics, messages d'attente. Tout est passé par l'interface de programmation.
- Toute expérience de l'utilisateur lui-même.

## Cinquième passe · écart d'un objectif et lecture à l'écran (espace fictif)

Compléments à la quatrième passe, sur un troisième personnage fictif (une infirmière de nuit, une amie proche, un collègue, une mère). Lecture faite dans le navigateur intégré, écrans **Mon monde, Personnes, Intentions et Mémoire**, à 1440 × 900. Les captures contiennent des données fictives et ne sont pas versionnées.

### Écart d'un objectif proposé

- Les cinq premières notes ne font proposer **aucun objectif**, malgré un souhait explicite dans la dernière (variabilité : les passes précédentes en proposaient un). Une sixième note plus nette (« ce que je veux vraiment… ») en fait proposer un.
- L'écart fonctionne : l'objectif est marqué écarté, aucune direction n'est générée, l'agent ne relance rien.

### Ce que montre l'écran

- **Mon monde** : bandeau de statut (« à jour · dernière lecture il y a 1 min 28 · 7 ajouts, 8 mises à jour »), un objectif et une carte de couverture (43 %), **un seul graphe** centré sur « Vous » avec un bouton par personne, et sous le graphe la synthèse : la « situation », faite de deux lectures concurrentes et d'une question. Le clic sur une lecture recentre le graphe sur ses preuves.
- **« Pourquoi ? »** : liste des soutiens, chacun avec la phrase exacte de la note et son titre. Lisible et sourcé. Boutons « Contester » et « Ajouter du contexte » à côté.
- **Intentions** : sans objectif, un état vide sobre (« Aucune direction formulée ») avec un champ pour formuler une intention.
- **Personnes** : liste courte avec la relation de chacun et « Modifier » (renommage).
- **Mémoire** : journal des notes, avec un titre généré pour chacune.

### Constats

| N° | Étape | Constat | Gravité | Correction proposée |
| --- | --- | --- | --- | --- |
| 41 | Mon monde | Deux « objectifs » différents cohabitent : le bandeau du haut (« Cartographier le monde social de la personne… », avec « Changer ») est la mission de l'agent ; l'écran Intentions porte le but de l'utilisateur. Rien ne les distingue. | gênant | Nommer la mission de l'agent autrement (« ce que fait MANWË ») et réserver « objectif » à l'utilisateur. |
| 42 | Mon monde | Le détail d'une lecture (« Pourquoi ? », « Contester », « Ajouter du contexte ») s'ouvre tout en bas de la page, sous la synthèse. Il faut défiler : le graphe et le détail ne sont jamais visibles ensemble. Les étiquettes du graphe sont petites et tronquées (« … »). | gênant | Panneau latéral pour le détail, étiquettes lisibles au survol ou au clic. |
| 43 | Mon monde | L'utilisateur est « Vous » dans le graphe mais « Maëlle » dans le texte des lectures. | confort | Une seule désignation, choisie par l'utilisateur. |
| 44 | Intentions | Le texte de l'état vide dit « Soi pourra plus tard proposer des pistes », probablement une coquille. | confort | Corriger la formulation. |
| 45 | Interprétation | Un souhait exprimé sans détour dans une note ne suffit pas toujours à faire proposer un objectif. | gênant | À examiner avec les règles de proposition d'objectif du prompt. |
| 46 | Mon monde | Le graphe est tronqué sur les schémas plus riches (« 7 relations et 5 lectures au plus »), donc la vue d'ensemble demandée (constat 12) n'est pas encore là. La synthèse reste de la prose dense : le constat 8 (« trop de texte, pas assez de visuels ») demeure. | gênant | Vue globale avec zoom, indicateurs visuels plutôt que phrases. |

### Ce qui fonctionne bien à l'écran

- Une seule surface pour le graphe, la synthèse, la conversation et l'ajout de notes : le constat 12 (onglets multiples) est nettement atténué.
- Les preuves citent la phrase exacte : la discipline épistémique du projet est visible.
- La situation (deux lectures concurrentes et une question) donne un point d'entrée clair.
- Les écrans vides et les écrans courts sont sobres.

### Appréciation d'ensemble (assistant, pas utilisateur)

Nettement plus lisible que la première version : une seule surface, un fil qui va de la note à la lecture puis à sa preuve. Il reste deux frottements majeurs pour un public en difficulté : trop de texte en prose, et un détail relégué en bas de page. Cette appréciation ne remplace pas le ressenti de l'utilisateur, qui doit refaire la démonstration sur ses propres notes.
