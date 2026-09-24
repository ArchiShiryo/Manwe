# R1 — Mémoire canonique locale

Date : 14 septembre 2026. Statut : validé pour le périmètre R1.

## Résultat utilisable

L'espace personnel démarre vide et reste distinct de la démo. Il permet de
conserver un récit littéral avec date d'enregistrement, date du récit, date ou
intervalle de l'événement et contexte ; de retrouver la source exacte ;
d'ajouter une correction sans réécrire cette source ; et de conserver une
intention utilisateur.

Le service Node possède l'état canonique dans SQLite. Identifiants opaques,
transactions, clés d'idempotence et révisions sont contrôlés côté backend.
La recherche filtre texte, contexte, dates et personne liée. Une sauvegarde
cohérente se restaure dans une base séparée.

## Preuves

- migration `001_initial.sql` pour personnes, alias, sources, épisodes,
  événements, participants, claims, annotations, hypothèses, questions,
  intentions, révisions et reçus ;
- corpus `r1-reference.json` : vingt récits, cinq épisodes de référence,
  ambiguïtés, contradictions et erreurs interdites ;
- test : vingt événements et vingt sources après redémarrage ; réimport des
  mêmes commandes sans doublon ni nouvelle révision ;
- tests : correction persistante, échec atomique, recherche structurée,
  sauvegarde/restauration et séparation de l'espace personnel ;
- navigateur : capture et annotation retrouvées après rechargement sur une base
  QA, ensuite supprimée ; base personnelle livrée vide.

Commandes réussies : `npm run typecheck`, `npm test`, `npm run build` et
`npm audit --audit-level=high`.

## Limites transférées aux jalons suivants

Les personnes et épisodes ne sont pas extraits automatiquement en R1. Le
chiffrement, le shell Windows empaqueté et la synchronisation ne font pas partie
de ce jalon. `node:sqlite` reste expérimental dans Node 24 et impose le contrôle
documenté dans l'ADR 0002.
