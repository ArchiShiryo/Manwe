# Contrat cognitif v1

Date : 14 septembre 2026. Version du contrat : `1.1`.

Ce document fixe la frontière entre la mémoire et le LLM. Le sous-ensemble R2
`propose_event` / `propose_claim` est maintenant exécutable : types, validation
stricte, `ContextPacket`, conservation des réponses, aperçu, confirmation et
application transactionnelle. Les autres opérations de ce contrat restent la
cible de R3 à R5.

Le transport assisté est disponible dans la vue Mémoire. Trois sorties réelles
de Sol ont été importées dans une preuve versionnée sur des données fictives ;
elles sont assistées et non aveugles. R2 reste « en cours » pendant l'extension
de la couverture des catégories et jusqu'au contexte hypothèse/contre-preuve de
R3. L'ingestion, les ambiguïtés d'identité et la métrologie assistée sont
désormais implémentées.

> **Changements 1.1 — modalité des claims.** La provenance (`category`) et la
> modalité (`actual`, `intended`, `hypothetical`) sont maintenant deux axes
> indépendants. `propose_claim` exige la modalité. Un événement reste toujours
> un fait accompli et n'en porte pas. Les archives `1.0` restent lisibles comme
> documents, mais une proposition `1.0` n'est plus réimportable.

## 1. Responsabilités

Le backend est seul responsable de la capture, des identifiants canoniques,
de la provenance, de la révision et de l'application transactionnelle. Le modèle
propose des candidats et une courte justification sourcée ; il n'écrit jamais
directement la mémoire ni les projections.

Le transport `sol-assisted` comporte quatre opérations métier :

1. `analysis.prepare` appelle `memory.get_context`, enregistre une demande et
   remet un `ContextPacket` figé.
2. `analysis.receive` reçoit un `CognitiveProposal`, vérifie sa forme et sa
   correspondance avec la demande, puis conserve un aperçu ou un motif de rejet.
3. `analysis.apply` revérifie les invariants et la révision, puis applique une
   proposition explicitement confirmée. En test fictif, le client de test peut
   confirmer ; en usage personnel, l'utilisateur dispose d'un aperçu.
4. `analysis.cancel` rend une demande non applicable, même si une réponse arrive
   ensuite. La capture source n'est jamais supprimée.

Une commande de correction utilisateur est distincte de ces opérations. Les
imports Sol ne peuvent ni créer une annotation au nom de l'utilisateur ni
effacer une annotation existante.

## 2. Objets minimaux de la mémoire

Champs communs : `id`, `workspaceId`, `createdAt`, `updatedAt`, `revision`.
Identifiants opaques alloués par le backend ; horodatages ISO 8601 avec fuseau.

| Objet                | Champs spécifiques indispensables                                                                                                                                |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Source`             | `kind`, `content`, `contentHash`, `recordedAt`, `narratedAt` nullable, `sensitivity`                                                                             |
| `Person`             | nom déclaré, alias sourcés, état de résolution de l'identité                                                                                                     |
| `Episode`            | intervalle temporel et précision, contexte ; regroupement justifié des événements                                                                                |
| `Event`              | participants résolus ou candidats, `episodeId`, `occurredAt`/intervalle/précision, références source ; aucun événement accompli extrait d'un simple conditionnel |
| `Claim`              | texte, catégorie de provenance, modalité, sujets, contexte, période, références source, statut de connaissance                                                   |
| `Hypothesis`         | énoncé, claims/épisodes favorables et contraires, alternatives, limites, conditions de révision, statut                                                          |
| `HumanAnnotation`    | cible typée, texte, type `factual_correction` / `context` / `disagreement` / `agreement`, auteur utilisateur                                                     |
| `OpenQuestion`       | question, hypothèses concernées, intérêt de la réponse, statut ; une absence de réponse ne confirme rien                                                         |
| `Goal` / `Direction` | formulation, contexte, critères/conditions/limites, objets concernés ; goal proposé distinct d'un goal confirmé par l'utilisateur                                |

Catégories `Claim` : `explicit_statement`, `sourced_observation`,
`reported_observation`, `user_impression`, `inference`. Statut de connaissance
séparé : `unresolved`, `supported`, `contradicted`, `superseded`. Le statut ne
transforme jamais une inférence ou une impression en observation.

Modalités `Claim`, orthogonales à la provenance : `actual` décrit un fait ou un
état présent, y compris une absence ou une négation ; `intended` décrit une
intention ou un projet futur, y compris une intention négative ;
`hypothetical` décrit un conditionnel ou une supposition. Une déclaration
explicite peut donc être `actual`, `intended` ou `hypothetical` sans changer de
catégorie de provenance. `Event` ne porte pas de modalité : il représente
uniquement un fait accompli.

Les formes détaillées des entités seront matérialisées en types et schémas avant
les migrations. Les références sont typées (`kind`, `id`) ; une référence à une
autre workspace est toujours invalide. Pas de propriété générique permettant
au modèle d'envoyer du SQL, un JSON Patch arbitraire ou une mutation de source.

## 3. `ContextPacket` produit par le backend

Champs obligatoires :

- `schemaVersion`: `"1.1"`.
- `requestId`, `workspaceId`, `baseRevision`, `createdAt`, `expiresAt`.
- `mode`: `"assisted"` pour Sol ; `providerId`: `"sol-assisted"`.
- `task`: `"extract"`, `"interpret"`, `"revise"` ou `"explore"`.
- `promptVersion`, `contextHash`, `focus` (références typées).
- `sources`: extraits autorisés, avec `sourceId`, `contentHash`, `text`,
  `spanStart`, `spanEnd`. Les bornes sont des offsets UTF-16, début inclus et fin
  exclue, dans le texte source exact enregistré, sans normalisation silencieuse.
- `entities`, `episodes`, `claims`, `hypotheses`, `annotations`, `questions`,
  `goals` : objets pertinents avec leurs identifiants et versions.
- `coverage`: périmètre inclus, omissions et éventuelles troncatures explicites.
- `allowedOperations`, `limits` : opérations autorisées pour cette demande et
  limites de taille/nombre. L'absence d'une information doit rester visible.

`contextHash` est calculé par le backend sur la sérialisation canonique du paquet
hors ce champ, avec tri récursif des clés, ordre des tableaux conservé et UTF-8.
Algorithme : SHA-256. Les types et tests figent la sérialisation. Le paquet
original est conservé ; une empreinte renvoyée par le modèle n'est pas une
preuve d'identité ou d'authenticité.

Seules les données sélectionnées pour cette analyse sont partagées avec Sol.
Les secrets, critères de test attendus et données privées sans rapport ne font
pas partie du paquet. Les textes source sont des données non fiables, jamais
des instructions à exécuter. Si le contexte est insuffisant, le modèle demande
une clarification au lieu de consulter librement fichiers, base ou réseau.

## 4. `CognitiveProposal` produit par Sol

Champs obligatoires :

- `schemaVersion`, `requestId`, `workspaceId`, `baseRevision`, `contextHash` :
  correspondent exactement à la demande.
- `modelDeclaration`: nom déclaré du modèle et de son rôle ; l'identifiant
  technique reste `null` s'il n'est pas connu. Le backend enregistre séparément
  ce qui est vérifiable ; il ne fait pas confiance à cette déclaration pour
  autoriser l'application.
- `outcome`: `"proposed"`, `"no_change"` ou `"needs_context"`.
- `operations`: liste de propositions typées, chacune avec une `key` locale
  unique, un `kind`, un `payload` et une courte `rationale` sourcée.
- `clarifications`: informations manquantes, références concernées et question
  ciblée ; une liste vide est autorisée.
- `summary`: brève synthèse fondée sur les opérations et références, sans
  nouvelles affirmations indépendantes. Ne pas demander un raisonnement interne
  détaillé ; conserver seulement les justifications utiles à l'inspection.

Opérations autorisables selon la tâche :

| `kind`               | `payload` minimal                                                                                   | Restriction                                                                  |
| -------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `propose_event`      | participants ou candidats, temps/précision, contexte, épisode existant ou candidat, extraits source | Fait accompli uniquement ; aucune modalité ni fusion silencieuse d'identité  |
| `propose_claim`      | texte, catégorie, modalité, sujets, période, références source                                      | Une extraction reste sourcée ; provenance et modalité restent indépendantes  |
| `propose_hypothesis` | énoncé, preuves favorables/contraires, alternatives, limites, conditions de révision                | Au plus deux hypothèses pour le focus du PoC ; zéro est un résultat valide   |
| `revise_hypothesis`  | cible existante, version attendue, nouvelle lecture/statut, références et motif                     | Historique préservé ; aucune modification des sources ni des annotations     |
| `propose_question`   | question, cibles, information discriminante, raison de la poser                                     | Au plus une question active pertinente au focus ; ne pas forcer une question |
| `propose_goal`       | formulation candidate, contexte, sources utilisateur                                                | Ne remplace pas une intention confirmée sans choix utilisateur               |
| `propose_direction`  | goal ciblé, possibilité, conditions, effort, limites, signaux à observer                            | Au plus deux pistes ; aucune action sur des personnes ou services externes   |

Une nouvelle entité porte une clé locale, jamais un identifiant canonique choisi
par Sol. Une référence intra-proposition utilise `{ "proposalKey": "..." }` ;
une référence existante utilise `{ "kind": "claim", "id": "..." }`, par
exemple. Le backend alloue les identifiants et retourne la correspondance après
commit. Rejeter clés inconnues, doublons, cycles de dépendance et auto-preuves.

Les citations référencent `sourceId`, `contentHash`, `spanStart`, `spanEnd` et
`quote`. Le backend vérifie l'égalité exacte entre `quote` et la tranche source,
ainsi que l'appartenance au contexte autorisé. Les références à des claims ou
épisodes doivent pouvoir être remontées à de telles sources, sans cercle.

`no_change` et `needs_context` imposent `operations: []`. Une réponse vide n'est
pas un `no_change` valide. Les opérations inconnues ou champs non prévus sont
rejetés par le schéma runtime. Limites initiales à tester : 1 Mio par proposition
et 100 opérations maximum ; elles figurent dans la demande et peuvent être
abaissées, jamais augmentées par la réponse.

## 5. Validation, révisions et résultat d'application

Ordre obligatoire, à tester indépendamment du modèle :

1. Limites d'entrée, JSON strict, version et schéma.
2. Demande connue dans le bon espace, non annulée/expirée, empreinte et mode
   cohérents. Le mode enregistré provient de la demande, pas d'un champ auto-déclaré.
3. Références, extraits exacts, catégories, opérations autorisées, identités et
   épisodes ; si ambiguïté non résolue, conserver des candidats ou demander du
   contexte, ne pas inventer une résolution.
4. Dépendances, doublons et boucles de preuves. Une justification éloquente ou
   une validation JSON ne démontre pas la vérité de l'interprétation.
5. Aperçu et confirmation de la proposition complète. Pour modifier son contenu,
   créer une nouvelle réponse traçable ; une réponse retouchée ne compte pas
   comme sortie LLM brute dans les évaluations.
6. Dans la transaction, verrouiller la demande et vérifier à nouveau
   `baseRevision === currentRevision`, puis appliquer tout ou rien. La révision
   canonique augmente une seule fois pour les changements d'un même lot.

Un changement de la mémoire depuis l'export provoque `stale_revision`, même si
la réponse a été prévalidée. Préparer un nouveau paquet ; ne pas changer son
numéro de révision à la main pour forcer l'import. Une correction utilisateur
marque immédiatement les lectures dépendantes « à réexaminer » ; leur ancienne
synthèse est identifiable jusqu'à la réponse suivante.

Une demande peut recevoir plusieurs tentatives avant application ; chaque
réponse a une empreinte et un identifiant attribués par le backend. Une seule
réponse peut être appliquée par demande. Réimporter exactement la même réponse
renvoie le même résultat, même après d'autres révisions ; présenter une réponse
différente à une demande déjà appliquée renvoie `already_resolved`. Le contrôle
d'idempotence est effectué avant le rejet pour révision obsolète et confirmé
dans la transaction. L'application d'un `no_change` clôt la demande sans
incrémenter la révision de mémoire. `needs_context` ne l'applique pas : la demande
est close avec ce résultat et une nouvelle demande est nécessaire après réponse.

Le reçu `ApplicationResult` expose `requestId`, `responseId`, `status`,
`baseRevision`, `resultRevision`, `createdIds`, `changedIds`, `warnings` et
`errors` structurées. Statuts de demande visibles : `awaiting_response`,
`ready_for_review`, `needs_context`, `applied`, `no_change`, `rejected`, `stale`,
`cancelled`, `expired`. Le journal des analyses est distinct de la révision de
mémoire afin que préparer une demande ne rende pas son propre contexte obsolète.

## 6. Traçabilité et mesure

Conserver, hors dépôt pour les données privées, demande, réponse brute, version
du validateur, résultat et confirmation. Dans `ModelRun`, distinguer
`providerId`, `transportMode`, `declaredModel`, `verifiedModel` nullable,
`preparedAt`, `receivedAt`, `appliedAt`, `inferenceDurationMs` nullable,
`usage` nullable et `cost` nullable. En mode assisté, l'intervalle préparation /
réception est un temps de cycle incluant une attente humaine, pas une latence
modèle. Aucune métrique inconnue n'est inventée.

## 7. Critères d'acceptation du contrat

- Proposition valide : application et références résolubles après redémarrage.
- Même réponse importée deux fois : même reçu, aucune seconde mutation.
- Deux réponses concurrentes : une seule appliquée, l'autre refusée explicitement.
- Annotation après export : réponse obsolète, correction conservée.
- Demande annulée ou expirée : aucune application tardive.
- Source inexistante, citation altérée, mauvais espace ou hash modifié : rejet.
- Opération interdite ou erreur en milieu de transaction : aucune mutation partielle.
- Une négation ou un conditionnel : aucune invitation positive extraite.
- Accord utilisateur et autocritique du modèle : aucun nouvel épisode probant.
- Sol absent ou indisponible : source conservée, attente explicite et annulable.
- Réponse `needs_context` : aucune hypothèse ajoutée pour masquer l'absence de données.
- Le futur fournisseur automatique passe les mêmes tests sans modifier le domaine.

Références : [ADR 0001](../decisions/0001-sol-assisted-cognition.md),
[handoff de réalisation](../HANDOFF_SOL.md), [roadmap](../../../ROADMAP.md).
