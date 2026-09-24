# API locale de mémoire v1

Origine par défaut : `http://127.0.0.1:5181`. L'API n'écoute que la boucle locale
et n'accepte par défaut que l'UI `http://127.0.0.1:5180`.

| Méthode | Route                                     | Fonction                                         |
| ------- | ----------------------------------------- | ------------------------------------------------ |
| `GET`   | `/api/health`                             | état public minimal du service                   |
| `POST`  | `/api/session`                            | ouvre une session locale protégée par cookie     |
| `GET`   | `/api/workspace`                          | projection canonique de l'espace                 |
| `GET`   | `/api/search?q=…`                         | recherche par texte, personne, contexte et dates |
| `POST`  | `/api/captures`                           | conserve une source et une note non classée      |
| `POST`  | `/api/imports`                            | importe atomiquement des événements JSON ou CSV  |
| `POST`  | `/api/identities/ambiguities/:id/resolve` | relie un événement au candidat choisi            |
| `POST`  | `/api/annotations`                        | ajoute une correction ou une nuance              |
| `POST`  | `/api/goals`                              | crée ou reformule une intention utilisateur      |
| `POST`  | `/api/analyses`                           | prépare et conserve un `ContextPacket`           |
| `GET`   | `/api/analyses/:id`                       | relit demande, état et tentatives                |
| `POST`  | `/api/analyses/:id/responses`             | valide et conserve une proposition brute         |
| `POST`  | `/api/analyses/:id/apply`                 | applique une réponse explicitement confirmée     |
| `POST`  | `/api/analyses/:id/cancel`                | annule une demande encore ouverte                |

Les corps d'écriture suivent les types de
`packages/domain/src/memory.ts`. Chaque commande porte une `idempotencyKey` ; la
même commande peut être rejouée, tandis qu'une autre commande réutilisant cette
clé reçoit un conflit. Les erreurs ont la forme
`{"error":{"code":"…","message":"…"}}`.

La recherche accepte `q`, `personId`, `context`, `from`, `to` et `limit`. Chaque
résultat contient l'événement, sa source littérale exacte et ses participants
confirmés. Les bornes de date recouvrent aussi les événements en intervalle.

## Import JSON et CSV

`POST /api/imports` reçoit `idempotencyKey`, `format`, `content` et, en option,
`sourceName`, `sourceSystem` et `importedAt`. La limite est de 1 Mio et 500
événements. Le document JSON est une liste d'événements ou
`{"events":[...]}`. Chaque événement accepte `text`, `title`, les trois dates,
`temporalPrecision`, `context`, `sensitivity`, `category` et `participants`.

Un participant JSON est un nom ou `{ "name": "Marc", "identityKey":
"contact-42" }`. Une clé externe résout une identité dans le `sourceSystem` ; un
nom seul crée ou retrouve un candidat. Si plusieurs personnes portent ce nom,
MANWË conserve une ambiguïté ouverte sans relier silencieusement l'événement.
La route de résolution exige `idempotencyKey`, `ambiguityId` et un `personId`
présent dans la liste des candidats.

Le CSV utilise virgule, point-virgule ou tabulation et exige l'en-tête `text`.
Les autres en-têtes portent les mêmes noms que le JSON ; `participants` sépare
les noms par `|`. Les guillemets CSV doublés sont pris en charge. Une erreur de
ligne annule l'import entier. Le hash du fichier déduplique sa réimportation,
même avec une nouvelle clé de commande.

L'import cognitif accepte au plus 1 Mio et 100 opérations ; l'UI requiert un
collage manuel et une confirmation séparée. Ses aperçus distinguent l'attente
manuelle mesurable de la durée d'inférence, de l'usage et du coût indisponibles
(`null`) en mode assisté. Le flux SSE de projection reste à faire. L'API n'est
pas destinée à être exposée sur le réseau local.
