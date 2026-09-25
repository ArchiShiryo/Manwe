# BRIEF-005 — Directions reliées aux leviers, boucle d'action

25 septembre 2026. Rédigé et réalisé par le pilote (D-011), la nuit, pendant l'absence de l'utilisateur. Il s'appuie sur D-016 (boucle d'action), D-017 (lecture stratégique), D-018 (finalité) et D-019 (psychodynamique fine), et sur [MODELE-STRATEGIQUE.md](../MODELE-STRATEGIQUE.md). Les choix marqués « à confirmer » sont regroupés dans **D-024**.

Lot de contrôle : **R5-S01**, attentes scellées avant tout code (`scelles/R5-S01.sha256`).

## Objectif

Passer de la lecture à l'action. Pour un objectif de l'utilisateur, MANWË propose :

- au plus deux directions d'action ;
- l'option de ne rien entreprendre.

Chaque direction nomme le levier qu'elle actionne dans le modèle et prédit la réponse des acteurs, phase transitoire comprise. L'utilisateur choisit une direction ; la prédiction est figée avant l'essai ; le résultat est comparé à la prédiction et fait réviser les lectures (D-016).

## Périmètre

1. **Contrat 1.5, opération `propose_direction`** (tâche nouvelle `orient`, permise aussi en `explore`).
   - `goal` : objectif visé (référence ou `null`) ; `title` ; `action` : geste concret, petit pas.
   - `lever` : `kind` parmi :
     - `change_reward` : changer ce qui est récompensé ;
     - `lower_barrier` : abaisser la barrière ;
     - `alternative_source` : offrir une autre source du même gain ;
     - `disconfirming_experience` : une expérience qui dément une croyance ;
     - `change_game` : changer de jeu ou de cadre ;
     - `do_nothing` : ne rien entreprendre.
   - `lever` porte aussi `hypothesis`, la lecture actionnée (obligatoire, sauf pour `do_nothing`), et `mechanismKey`, facultatif.
   - `conditions`, `effort` (`low`, `moderate` ou `high`), `limits`, `signals` (1 à 5), `learnsIfFails`.
   - `predictions` (1 à 5) : `{ actor, response, phase }`, avec `phase` = `immediate`, `transitional` ou `equilibrium`, et `horizonDays` facultatif.
2. **Règles du moteur**, déterministes :
   - **Lecture actionnée.** Elle doit exister (ou être proposée dans la même réponse) et ne pas être remplacée ni contredite. Sinon, la réponse est rejetée.
   - **Directions en trop.** Plus de deux directions d'action pour un même objectif dans une réponse : les suivantes sont écartées, avec l'avertissement `too_many_directions`.
   - **« Ne rien entreprendre » absent.** Avertissement `do_nothing_missing` ; l'interface affiche quand même cette option, sans prédiction.
   - **Prédictions.** Au moins une par direction.
3. **Boucle d'action**, sans modèle de langage :
   - `POST /api/actions`, l'utilisateur choisit une direction : l'action copie les prédictions, c'est l'attente, datée avant tout résultat ; l'utilisateur peut y ajouter sa propre attente ;
   - `POST /api/actions/:id/outcome` : le résultat, texte libre, devient une source et une note citables, comme une annotation ; la lecture actionnée est signalée à réexaminer (motif `outcome`) ; des verdicts facultatifs sont possibles par prédiction (`confirmed`, `refuted`, `unclear`) ;
   - le paquet contient `actions` : direction, prédictions, résultat et verdicts. Le modèle peut ainsi comparer la prédiction à la réalité à la réanalyse.
4. **Prompt v7**, rendu depuis le gabarit :
   - mission d'orientation ;
   - leviers du modèle stratégique ;
   - phase transitoire (sortir d'un minimum local passe par une aggravation) ;
   - préférence pour abaisser la barrière et pour les actions qui apprennent même en cas d'échec ;
   - interdiction de tromper ou manipuler un tiers ;
   - à la réanalyse, comparer chaque prédiction au résultat.
5. **Interface** : directions par objectif ; choix avec confirmation ; saisie du résultat ; comparaison entre prédiction et résultat.
6. **Harnais** : étapes `goal`, `choose` et `outcome`.

## Choix à confirmer (D-024)

- **« Ne rien entreprendre » est une direction du modèle, avec sa prédiction.**
  - Raison : la prédiction du statu quo est une information précieuse.
  - Alternative : une carte fixe dans l'interface, sans prédiction.
  - Retenu : les deux. Le modèle la propose ; à défaut, l'interface l'affiche quand même.
- **Plafond de deux directions d'action**, comme R5.2 pour les hypothèses.
  - Alternative : aucun plafond, avec un tri par effort.
- **Verdicts facultatifs.**
  - Raison : ne pas imposer une notation à l'utilisateur ; la comparaison se fait à la réanalyse, et elle est sourcée.
  - Alternative : verdicts obligatoires pour mesurer la calibration dès maintenant.
- **Pas de « chemin » multi-étapes.**
  - Une direction est un pas ; un chemin est la suite des pas choisis, visible dans l'historique des actions.
  - Alternative : un objet `path` explicite, reporté.

## Validation

Lot R5-S01 (4 scénarios), joué automatiquement avec DeepSeek V4.1-Flash. Seuil :

- aucun interdit violé ;
- au moins 75 % des points [L] ;
- 100 % des points [B] exercés.
