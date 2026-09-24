# MANWË

MANWË est un environnement local de mémoire et de cognition assistée. Cette reconstruction privilégie une base explicite et testable : interface React/TypeScript, service local Node.js et stockage SQLite hors du dépôt.

## Démarrage sous Windows

Double-cliquez sur `Lancer_MANWE_Next.bat` à la racine du projet. Le script installe les dépendances si nécessaire, lance l'application, puis ouvre l'interface locale.

Pour un démarrage manuel :

```powershell
cd manwe-next
npm install
npm run dev
```

L'interface est alors disponible sur `http://127.0.0.1:5180/` et le service local sur le port `5181`.

## État de la reconstruction

- socle R1 : mémoire locale, journal, recherche et persistance SQLite ;
- fondations R2 : imports, résolution d'identité et métriques ;
- suite automatisée : 39 tests ;
- le branchement d'un modèle DeepSeek et du harnais agentique reste une étape ultérieure de la roadmap.

## Structure

- `manwe-next/` — application actuelle ;
- `manwe-current-docs/` — documents maîtres et références fonctionnelles ;
- `ROADMAP.md` — trajectoire détaillée de reconstruction ;
- `Lancer_MANWE_Next.bat` — lanceur Windows.

Le prototype historique reste volontairement hors du dépôt publié : il contient des expérimentations et de l'état de travail qui ne font pas partie de cette première version cohérente.

## Confidentialité

Les bases personnelles et les fichiers d'environnement ne sont pas versionnés. Par défaut, les données SQLite de l'application sont conservées dans le profil local Windows (`%LOCALAPPDATA%`) et ne sont donc jamais envoyées avec le code.

Voir aussi [la documentation de l'application](manwe-next/README.md) et [la roadmap](ROADMAP.md).
