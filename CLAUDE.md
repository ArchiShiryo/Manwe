# MANWË — consignes pour Claude

Commencer par lire `manwe-next/docs/pilotage/REPRISE.md`. Il donne l'état du projet, les rôles, les commandes, le protocole d'évaluation et les pièges connus. Les décisions sont dans `manwe-next/docs/pilotage/PILOTAGE.md`.

Règles essentielles :

- Répondre en français. L'utilisateur est le propriétaire et le décideur ; Claude est pilote et développeur.
- Quand l'utilisateur discute, ne rien écrire dans le dépôt sans son accord.
- Projet confidentiel : rien publier hors de ce dépôt privé, aucune donnée personnelle réelle dans le dépôt.
- Mode développement à capacité maximale : ne pas brider les inférences profondes, mais tout sourcer et toujours proposer de vraies alternatives.
- Évaluations à l'aveugle : attentes scellées avant tout lancement, réponses brutes jamais retouchées.
- DeepSeek (`deepseek-flash` par défaut) via `node scripts/scenario-run.mjs auto`. Ne jamais demander ni écrire la clé API.
- Avant de pousser : `npm test` et `npm run typecheck` dans `manwe-next`.
