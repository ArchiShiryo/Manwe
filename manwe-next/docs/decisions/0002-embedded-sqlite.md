# ADR 0002 — SQLite embarqué pour la première mémoire locale

Date : 14 septembre 2026. Statut : accepté pour R1. Cette décision remplace la
cible PostgreSQL du premier socle décrite dans l'ADR 0001 ; elle ne change pas
le contrat cognitif ni la possibilité d'une migration ultérieure.

## Constat vérifié

Le poste de réalisation dispose de Node.js 24.11.0 et npm 11.6.1. Il ne dispose
ni de PostgreSQL (`postgres`, `pg_ctl`, `psql`), ni de Docker/Podman, ni de la
chaîne Rust nécessaire à Tauri. Aucun service PostgreSQL n'est installé.

Le module `node:sqlite` a en revanche été exécuté avec succès sur ce poste :
SQLite 3.50.4, création, fermeture et réouverture d'une base sur disque. Il est
encore signalé expérimental par Node 24 ; ce risque est visible dans les tests.

## Décision

R1 utilise une base SQLite locale, ouverte uniquement par le service compagnon
Node lié à `127.0.0.1`. Le fichier personnel par défaut est :

```text
%LOCALAPPDATA%\ManweNext\memory.sqlite3
```

Le frontend ne connaît ni chemin de base ni SQL. Il passe par l'API métier. Les
migrations SQL, commandes transactionnelles, reçus d'idempotence et révisions
restent dans `packages/storage`; le contrat du domaine n'importe pas SQLite.

La base active le journal WAL, les clés étrangères, un délai d'attente de cinq
secondes et des transactions `BEGIN IMMEDIATE` pour les écritures. Les sources
brutes ne sont jamais remplacées par une correction : une annotation est
ajoutée dans la même transaction que sa révision.

## Sauvegarde et restauration

`npm run backup` crée une copie cohérente par `VACUUM INTO` dans
`%LOCALAPPDATA%\ManweNext\backups`. Le code refuse d'écraser un fichier existant.
Le test d'intégration ouvre la copie comme une base distincte et y retrouve la
révision et la source attendues. Une restauration manuelle doit être faite
service arrêté, après conservation du fichier actif ; aucune restauration
automatique destructive n'est fournie dans ce lot.

## Coût et seuils de réexamen

- `node:sqlite` peut changer tant que Node le marque expérimental. La version
  majeure Node reste donc un prérequis explicite et les tests d'intégration sont
  obligatoires avant mise à jour.
- SQLite convient à un seul utilisateur et un service local. Synchronisation,
  accès multi-processus soutenu ou serveur partagé imposeront un nouvel ADR.
- Le SQL PostgreSQL n'est pas supposé compatible. Une migration future devra
  exporter les objets du domaine, réimporter dans le nouveau stockage et
  comparer identifiants, sources, révisions et hashes.
- Chiffrement au repos, installation signée et shell Tauri restent ouverts pour
  R6. Ce choix rend R1 utilisable ; il ne prétend pas les valider.

## Alternatives écartées pour ce lot

- Installer PostgreSQL globalement : dépendance opératoire disproportionnée et
  non disponible sur le poste au moment de l'essai.
- Embarquer PostgreSQL sans runtime prouvé : distribution Windows et cycle de
  vie non démontrés.
- Continuer avec `localStorage` : insuffisant pour une mémoire canonique,
  transactionnelle et sauvegardable.

Références : [rapport R0](../milestones/R0-FEASIBILITY.md),
[contrat cognitif v1](../contracts/COGNITION_V1.md).
