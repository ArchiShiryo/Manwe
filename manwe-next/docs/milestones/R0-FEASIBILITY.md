# R0 — Inventaire et faisabilité du socle local

Contrôle du 14 septembre 2026. Statut : partiel ; le stockage et le transport
local sont arbitrés, mais le shell Tauri et le corpus de référence restent à
faire. Ce rapport n'annonce ni DeepSeek ni harnais agentique fonctionnels.

## Périmètre préservé

La reconstruction reste dans `manwe-next`. L'ancien `manwe-prototype` n'a été
ni nettoyé, ni réinitialisé, ni modifié pendant ce lot. Son état observé avant
travail contient des modifications suivies dans :

- `README.md`, `src/app/App.tsx`, `src/input/ManweInput.tsx`,
  `src/state/useManweStore.ts`, `src/styles/app.css` ;
- des dossiers non suivis `deepseek-runtime/` et `src/agent/` ;
- plusieurs fichiers non suivis aux noms anormaux ou accidentels.

Ces éléments appartiennent au travail existant. Ils ne sont ni une sauvegarde
validée, ni une preuve que DeepSeek fonctionne. Avant toute migration du vieux
prototype, il faudra identifier secrets et données privées, puis faire une
sauvegarde contrôlée séparant code, dépendances et runtime.

`manwe-next` n'était pas un dépôt Git autonome au contrôle. Il possède un
`package-lock.json`, mais l'initialisation et la première référence Git restent
ouvertes afin de ne pas créer de commit implicite au nom de l'utilisateur.

## Environnement réellement disponible

| Élément                                   | Résultat                                              |
| ----------------------------------------- | ----------------------------------------------------- |
| Windows / PowerShell                      | disponible                                            |
| Node.js                                   | 24.11.0                                               |
| npm                                       | 11.6.1                                                |
| Git                                       | disponible                                            |
| `node:sqlite`                             | fonctionne, SQLite 3.50.4, avertissement expérimental |
| PostgreSQL (`psql`, `postgres`, `pg_ctl`) | absent                                                |
| Docker / Podman                           | absents                                               |
| Rust / Cargo                              | absents                                               |
| Tauri                                     | non éprouvé faute de chaîne Rust                      |

L'arbitrage motivé est consigné dans
[ADR 0002](../decisions/0002-embedded-sqlite.md).

## Transport et cycle de vie prouvés

- UI Vite : `http://127.0.0.1:5180`.
- service mémoire : `http://127.0.0.1:5181`.
- le lanceur démarre les deux processus et propage l'arrêt ; `Ctrl+C` ferme le
  groupe de développement ; un lancement complet empaqueté reste à prouver.
- l'API vérifie l'origine et l'hôte, crée un cookie de session `HttpOnly` /
  `SameSite=Strict`, limite le corps à 64 Kio et les écritures à 60/minute.
- les routes d'écriture sont transactionnelles et idempotentes. Le navigateur
  ne reçoit aucun secret ni accès direct au fichier SQLite.

## Preuves exécutées

`npm run typecheck`, `npm test` et `npm run build` réussissent. Les 24 tests couvrent
notamment origine étrangère, session locale, validation sans écriture partielle,
capture littérale, redémarrage, annotation, intention, recherche, idempotence et
restauration d'une sauvegarde dans une base séparée.

Le corpus `packages/evaluation/fixtures/r1-reference.json` fixe vingt sources
fictives, leurs dates ou incertitudes, cinq regroupements d'épisodes, les cas
d'ambiguïté/contradiction et les erreurs interdites. Son test prouve 20 objets
après redémarrage et aucun doublon après réimport des mêmes commandes.

## Ouvert avant clôture de R0

1. initialiser le suivi Git autonome après décision explicite sur la première
   référence ;
2. éprouver une fenêtre Windows empaquetée et son arrêt, puis le choix de shell ;
3. traiter la sauvegarde contrôlée de l'ancien prototype ;
4. rejouer le contrôle après toute mise à jour majeure de Node.
