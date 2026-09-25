# BRIEF-007 — Le lieu : visualiseur, conversation, journal, agent autonome

25 septembre 2026. Suite de la démonstration R5.7 ([DEMO-R5-7](../rapports/DEMO-R5-7.md)) et des décisions D-028 à D-031.

## Principe : un lieu, pas un parcours

MANWË n'est pas une suite d'étapes à franchir (saisir, analyser, relire, appliquer, recommencer). C'est un **lieu où l'on demeure et où l'on se livre**. L'utilisateur y revient, parle, écrit ; MANWË écoute, range, comprend et montre, sans lui demander de piloter la mécanique.

Trois surfaces, dans un même lieu :

1. **Le visualiseur, au centre.**
   - Un seul graphe global de son monde, toujours présent.
   - Sélectionner une personne, une relation ou un groupe reconfigure la vue autour d'elle ; un zoom par niveaux donne la vue d'ensemble.
   - Il n'y a plus d'onglets de graphes séparés.
2. **La conversation.**
   - L'utilisateur tape ce qu'il veut, ou répond à l'agent. L'agent voit toute la mémoire, repère les creux (milieux de vie, personnes, périodes absents, lectures sans preuve) et pose **une question à la fois**.
   - Il n'interrompt jamais : il parle quand on lui parle ou quand on ouvre la conversation.
   - Chaque message de l'utilisateur devient une note, donc une source citable.
3. **Le journal.**
   - Pour qui a beaucoup à raconter : des entrées libres qui s'accumulent, sans passer par le chat.
   - Elles deviennent des notes, comme les messages.

## L'agent analyse seul (D-028)

- Aucune étape à choisir : l'agent décide.
  - De nouvelles notes lancent une analyse d'extraction et d'interprétation.
  - Un résultat d'action lance une révision.
  - Un objectif sans direction lance une exploration.
- Pas de confirmation : une analyse valide est **appliquée d'elle-même**. Les garde-fous épistémiques restent dans le moteur :
  - statut « brouillon » à la création ;
  - plafonds de confiance ;
  - citations exactes ;
  - application partielle.
- Restent des gestes de l'utilisateur, parce qu'ils l'engagent :
  - adopter ou reformuler un objectif ;
  - choisir une direction ;
  - corriger ou contester une lecture.
- Le travail de l'agent est visible sans être intrusif : une ligne d'activité (ce qu'il fait, depuis combien de temps) et un journal des changements.
- Une analyse en cours ou prête survit à un rechargement ; deux analyses ne se lancent pas sur la même révision.
- Deux tentatives informées au lieu d'une (D-031). Une erreur du fournisseur est journalisée avec sa cause, sans la clé.
- Consentement à la transmission : une seule fois, au premier lancement de l'analyse automatique.

## Les personnes (D-030)

- **Toute personne citée existe dans la mémoire**, même sans nom : « la femme d'un ami » est une identité claire, décrite par sa relation. Elle apparaît dans le graphe.
- Son identité se met à jour **rétrospectivement** :
  - la nommer (« la femme d'un ami » s'appelle Julie) ;
  - la rattacher (l'ami, c'est Paul) ;
  - fusionner deux fiches qui désignent la même personne.

  Tout ce qui la référence suit, puisque tout passe par son identifiant stable. L'ancienne description reste comme alias.

## Lots

| Lot                | Contenu                                                                                                                                                                                                                                                                                 |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1 · moteur        | Application automatique ; ordonnanceur de l'agent (quelle tâche, quand) ; deux tentatives ; opération `propose_person` (personne décrite, citée, rattachée éventuellement à une autre) permise dès l'extraction ; renommer et fusionner une personne ; cause des erreurs du fournisseur |
| P2 · conversation  | Service de conversation : l'agent lit la mémoire (outils D-023) et propose la question suivante ; les messages deviennent des notes ; l'analyse suit d'elle-même                                                                                                                        |
| P3 · lieu          | Visualiseur central et global ; panneau de conversation ; journal ; ouverture sur la mémoire réelle (la démonstration devient un mode signalé) ; ligne d'activité ; retrait de l'analyse assistée et des boutons d'analyse                                                              |
| P4 · démonstration | R5.7 rejouée dans le lieu, de bout en bout, par l'utilisateur                                                                                                                                                                                                                           |

## Critères de passage

1. Une note ou un message produit, sans aucun clic de plus, une analyse appliquée et visible dans le graphe.
2. Toute personne citée dans les notes de la démonstration, nommée ou décrite (« la femme d'un ami »), apparaît dans le graphe. La nommer ensuite met à jour toutes les vues.
3. La conversation pose une question à la fois, fondée sur un creux réel de la mémoire, et cite ce qui la motive.
4. Un rechargement ne perd ni analyse en cours ni analyse prête.
5. Aucun écran n'expose le choix d'une tâche d'analyse ni une confirmation d'application.
6. Tests et contrôles navigateur existants verts, ou adaptés quand ils testaient une confirmation supprimée par D-028.
