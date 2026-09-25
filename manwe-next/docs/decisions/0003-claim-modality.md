# ADR 0003 — Modalité orthogonale des claims

Date : 24 septembre 2026. Statut : décision actée par le pilote (D-001).

## Contexte

La provenance répond à « comment cette information est-elle arrivée dans
MANWË ? ». Elle ne suffit pas à dire si le contenu décrit un fait, une intention
future ou une situation seulement supposée. Par exemple, une personne peut
déclarer aussi bien un état présent qu'un projet ou un conditionnel. Traiter ces
trois contenus comme des faits ferait perdre une distinction essentielle à la
prothèse de cognition sociale.

## Décision

Chaque `Claim` porte désormais deux axes indépendants :

- `category` conserve la provenance : déclaration explicite, observation
  directe, observation rapportée, impression utilisateur ou inférence ;
- `modality` décrit le statut modal du contenu : `actual` pour un fait ou un
  état, y compris une absence ou une négation ; `intended` pour une intention ou
  un projet futur, y compris négatif ; `hypothetical` pour un conditionnel ou
  une supposition.

Un `Event` ne reçoit pas cet axe. Il représente toujours un fait accompli et ne
peut donc jamais être créé à partir d'une intention ou d'une hypothèse.

Le contrat cognitif passe à la version `1.1`. Toute opération `propose_claim`
doit fournir `modality`. Une proposition `1.0` n'est pas importable et est
rejetée avec le code `unsupported_schema_version`.

## Conséquences

- Le stockage ajoute une colonne obligatoire à `claims`, contrainte aux trois
  valeurs autorisées.
- Le validateur refuse une modalité absente ou inconnue, ainsi que toute
  modalité ajoutée à `propose_event`.
- L'interface affiche la provenance et la modalité côte à côte, sans ajouter de
  symbole à la grammaire épistémique.
- Les décisions futures peuvent filtrer un claim par provenance et modalité
  sans transformer une intention ou un conditionnel en événement.

## Compatibilité

Les claims créés avant la migration deviennent `actual`, car l'ancien schéma ne
permettait pas d'exprimer une autre modalité. Les paquets et réponses `1.0`
archivés restent lisibles comme documents de preuve ; ils ne sont volontairement
pas réimportables dans le validateur `1.1`.
