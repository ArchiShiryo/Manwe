# Couche ontologique de MANWË

Note de pilotage du 25 septembre 2026, rédigée à partir d'une discussion avec l'utilisateur. Décisions associées : D-012 à D-018 de [PILOTAGE.md](./PILOTAGE.md).

## Question posée

Faut-il une couche ontologique « à la Palantir » pour rendre la donnée actionnable, ou l'architecture en contient-elle déjà une ?

## Réponse

**MANWË en contient déjà le cœur. Il lui manque en revanche la partie qui rend la donnée actionnable et prédictive.**

L'Ontologie de Palantir repose sur trois éléments :

- des types d'objets métier ;
- des liens typés entre ces objets ;
- des actions typées, contrôlées et traçables.

Tout passe par cette couche, jamais directement par la base.

| Palantir           | Ce qui existe dans MANWË                                                                                          |
| ------------------ | ----------------------------------------------------------------------------------------------------------------- |
| Types d'objets     | Source, Événement, Épisode, Personne, Claim, Hypothèse, Question, Objectif, Annotation                            |
| Liens typés        | Citation exacte d'une source ; preuve pour ou contre ; sujet d'une hypothèse ; alternative ; cible d'une question |
| Actions contrôlées | Opérations du contrat cognitif : typées, validées à blanc, appliquées tout ou rien, idempotentes, versionnées     |
| Traçabilité        | Plus stricte : toute affirmation remonte à un extrait exact de la source                                          |

Le principe fondateur est donc déjà respecté : le modèle ne touche jamais la base, il propose des actions que le système valide.

## Ce qui manque, par ordre d'importance

### 1. La relation, objet à part entière (D-012)

La spécification maître (§11, RelationshipModel) fait de la relation un objet autonome : rôles, valeur mutuelle, boucles d'interaction, ruptures et réparations, trajectoire. La reconstruction ne l'a jamais créé. Aujourd'hui, une relation n'existe que comme ensemble de sujets d'une hypothèse.

Les analyses du lot R3-S01 le montrent : le modèle parle constamment de « la dyade », mais n'a aucun objet où la ranger.

Cible :

- un objet `Relation` (dyade, puis lien de groupe), avec sa propre révision ;
- des hypothèses dont le sujet peut être une relation ;
- une trajectoire datée ;
- des indicateurs calculés (voir point 3).

### 2. Participants et rôles (D-013)

Les rôles sont souples, et cette souplesse est prise en compte en les rangeant à deux niveaux :

- **Rôle dans un épisode** : extrait du texte comme les autres informations, avec sa citation (« Lucas m'a demandé… » donne Lucas demandeur et l'utilisateur aidant). L'utilisateur peut le corriger d'un geste. Vocabulaire de départ, extensible : initiateur, destinataire, demandeur, aidant, répondant, observateur.
- **Rôle dans une relation** (« Lucas est le demandeur, l'utilisateur l'aidant ») : ce n'est jamais une donnée stockée, c'est une **hypothèse** D2 agrégée à partir des rôles des épisodes. Elle peut évoluer et elle est réfutable. Un rôle ponctuel ne fige rien ; c'est la répétition qui fait le schéma.
- **Timing** : il n'est pas exigé. Les dates des épisodes suffisent pour savoir qui initie et à quelle fréquence. Un délai explicite (« deux jours pour répondre ») est conservé lorsqu'il est dit. Les horodatages précis viendront automatiquement avec les imports de conversations (R9).

### 3. Indicateurs relationnels calculés

Ce sont les « fonctions » de l'ontologie, calculées de façon déterministe à partir des rôles et des dates :

- part des initiatives ;
- réciprocité des demandes et de l'aide ;
- fréquence des contacts ;
- délais explicites ;
- contre-exemples.

Ils fournissent au modèle des ancrages chiffrés pour trancher au lieu de tout garder ouvert. Ils ne sont jamais des preuves à eux seuls : ils résument des épisodes qui restent citables.

### 4. Registre ontologique unique (D-014)

Aujourd'hui, les types sont écrits en dur à trois endroits : le SQL, le TypeScript et le prompt. Un registre déclaratif unique décrira les types, les propriétés, les liens et les actions permises par tâche. Le prompt, la documentation du paquet de contexte, les contrôles et le futur graphe R4 en découleront. Un test échouera si l'un d'eux diverge.

### 5. Actions dans le monde réel (D-016)

Pour Palantir, « actionnable » signifie qu'une action change quelque chose hors de la base. MANWË ajoutera les objets suivants :

- **Objectif**
- **Piste** : au moins deux, jamais une réponse unique.
- **Action proposée** : validée par l'utilisateur avant toute exécution.
- **Résultat observé**

Ces objets ferment la boucle : on anticipe, on agit, on observe, puis on compare la prédiction à la réalité et on révise.

Aucune action n'est exécutée sans consentement explicite. L'envoi de messages reste une fonction future (roadmap §20).

### 6. Modèle stratégique des acteurs (D-017)

Chaque acteur, qu'il s'agisse d'une personne, de l'utilisateur, d'une relation ou d'un groupe, reçoit des objets déclarés :

- ce qu'il optimise, avec ses valeurs sacrées ;
- les croyances sous lesquelles son comportement est optimal ;
- la barrière qui le maintient dans son équilibre ;
- les leviers ;
- les prédictions de réponse à une perturbation.

Ce sont des hypothèses comme les autres. C'est la couche qui rend l'ontologie prédictive, et elle sert la finalité de MANWË : trouver un chemin (D-018). Voir [MODELE-STRATEGIQUE.md](./MODELE-STRATEGIQUE.md).

## Ce que nous ne faisons pas

Importer Palantir ou un équivalent d'entreprise : c'est coûteux, pensé pour des organisations, et inadapté à une application personnelle local-first. Nous adoptons le **schéma**, pas le produit.

## Calendrier

| Étape | Contenu                                                          | Jalon        |
| ----- | ---------------------------------------------------------------- | ------------ |
| 1     | Prompt v4 et moteur (D-015), puis relation, rôles et indicateurs | Avant R4     |
| 2     | Registre ontologique unique, dont découle le graphe              | R4           |
| 3     | Objectifs, pistes, actions, résultats                            | R5, puis R10 |
