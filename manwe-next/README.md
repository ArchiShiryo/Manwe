# MANWË Next · mémoire locale 0.2

Première tranche fonctionnelle de la reconstruction, indépendante de
`manwe-prototype`. Deux espaces sont explicitement séparés : une démonstration
fictive dans le navigateur et une mémoire personnelle vide, conservée dans une
base SQLite par un service local. **Ni DeepSeek ni le harnais agentique ne sont
encore connectés.**

## Lancer

Double-cliquer sur `Lancer_MANWE_Next.bat`, dans le dossier parent. Le lanceur
vérifie Node.js 24+, installe les dépendances si nécessaire, puis démarre :

- l'interface sur <http://127.0.0.1:5180/> ;
- la mémoire locale sur `http://127.0.0.1:5181/`.

Garder la fenêtre du lanceur ouverte ; `Ctrl+C` arrête les deux processus. Une
instance n'est réutilisée que si l'UI et la mémoire répondent toutes deux. Le
lanceur historique `Lancer_MANWE.bat` et le prototype sur le port 5174 restent
inchangés.

En développement :

```powershell
npm ci
npm run dev
```

Les deux serveurs écoutent uniquement sur la boucle locale. Les dépendances sont
verrouillées dans `package-lock.json`.

## Ce qui fonctionne

- **Espaces distincts** : « Mon espace » bascule entre mémoire personnelle et
  démonstration sans copier de contenu.
- **Mémoire personnelle** : capture littérale, source hachée et immuable,
  intention utilisateur, annotation typée, révisions, transactions et
  idempotence dans SQLite.
- **Reprise** : fermeture et réouverture retrouvent notes, sources, annotations
  et intentions.
- **Service local** : session par cookie, contrôle exact origine/hôte, corps
  limité à 64 Kio, 60 écritures/minute et erreurs structurées.
- **Démo** : graphe, inspecteur sourcé, personnes, mémoire, intentions,
  annotations, question ouverte, recherche et scénario fictif clairement nommé.
- **Saisie** : `Entrée` conserve ; `Maj+Entrée` ajoute une ligne. Aucune personne,
  invitation ou hypothèse n'est extraite silencieusement du texte personnel.
- **Imports** : JSON ou CSV, transaction complète, déduplication du même fichier,
  clés d'identité externes et choix humain lorsque plusieurs personnes portent
  le même nom.
- **Responsive et clavier** : navigation compacte, inspecteur superposé, `Ctrl+K`
  ou `⌘K` pour rechercher, fermeture avec Échap.
- **Analyse Sol assistée** : export d'un `ContextPacket`, import d'une proposition
  brute, aperçu, confirmation explicite, application atomique et rejeu idempotent.

## Persistance et sauvegarde

La mémoire personnelle est stockée par défaut dans :

```text
%LOCALAPPDATA%\ManweNext\memory.sqlite3
```

Pour créer une copie cohérente sans écraser un fichier existant :

```powershell
npm run backup
```

Elle est placée dans `%LOCALAPPDATA%\ManweNext\backups`. La restauration
automatique n'est pas encore exposée : arrêter le service et conserver le
fichier actif avant toute copie manuelle. Un test restaure la copie dans une
base séparée et vérifie sa révision et sa source.

La démo reste dans `localStorage`, clé `manwe-next:ui-demo:v1`, propre à
`http://127.0.0.1:5180`. L'URL `/?qa=1` emploie la clé isolée
`manwe-next:qa:v1`.

## Limites actuelles

Le fichier SQLite n'est pas encore chiffré. Le module `node:sqlite` est encore
marqué expérimental par Node 24. L'UI conserve le texte saisi lorsqu'une requête
échoue. Le shell Tauri, les projections génériques, les arêtes de preuve R3 et
l'évaluation cognitive élargie restent à construire.

Sol est le LLM assisté prévu pour R2 : MANWË exportera un paquet JSON, Sol
proposera une analyse et le même validateur métier l'appliquera après aperçu et
confirmation. Ce parcours manuel est maintenant présent dans la vue Mémoire
pour `propose_event` et `propose_claim`, mais aucune analyse n'est déclenchée
automatiquement et aucune note n'est envoyée à Sol. DeepSeek est
différé au contrôle automatique IA-A, obligatoire avant l'alpha R6.

Trois [essais Sol assistés](packages/evaluation/runs/2026-09-14-assisted/EVALUATION.md)
versionnés couvrent négation, conditionnel et propos rapporté. Ils prouvent le
transport manuel sur ces cas, pas une généralisation en aveugle ni DeepSeek.

## Structure

```text
apps/desktop/src/
  App.tsx                  Composition et séparation démo/personnel
  PersonalSurfaces.tsx     Vues de la mémoire personnelle
  Graph.tsx, Inspector.tsx Vues du scénario fictif
  memoryApi.ts             Client de l'API locale
  usePersonalWorkspace.ts  Projection et commandes personnelles
apps/server/src/
  server.ts                API HTTP liée à la boucle locale
packages/domain/src/
  memory.ts                Contrats de la mémoire canonique
  demo.ts                  Domaine isolé du scénario fictif
packages/cognition/src/
  contract.ts              Paquets, propositions et validation stricte R2
packages/storage/src/
  sqliteStore.ts           Transactions, révisions, recherche, sauvegarde
  migrations/              Schéma SQL versionné
tests/
  *.test.mjs               Domaine, stockage et API
```

## Vérifier

```powershell
npm run typecheck
npm test
npm run build
npm audit
```

`Lancer_MANWE_Next.bat --check` compile et exécute les tests sans ouvrir le
navigateur. Voir aussi [l'API locale](docs/API.md),
[l'ADR SQLite](docs/decisions/0002-embedded-sqlite.md),
[le rapport R0](docs/milestones/R0-FEASIBILITY.md),
[le handoff Sol](docs/HANDOFF_SOL.md) et la [roadmap](../ROADMAP.md).
