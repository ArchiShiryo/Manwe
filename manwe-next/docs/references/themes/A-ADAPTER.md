# Thèmes d'interface : à adapter

Maquettes et thèmes fournis par l'utilisateur le 25 septembre 2026. Le détail est dans [LISEZMOI.md](./LISEZMOI.md) ; les aperçus fixes sont dans `apercus/`. Une instance future doit les adapter à l'application `apps/desktop`.

Points d'ancrage avec l'existant :

- **Statut épistémique** : trait plein = observé et cité ; pointillé = impression ; double trait qui vibre = inféré (plus il tremble, moins c'est sûr) ; gris avec « ? » = inconnu. Cela correspond aux catégories des claims et aux statuts et confiances des hypothèses.
- **Relations** : les maquettes « Monde » et la fiche de dyade utilisent déjà les indicateurs calculés du BRIEF-004 (épisodes, fréquence sur 30 jours, contre-exemples, qui initie, rôles par épisode), ainsi que les lectures classées (#1, #2) du contrat 1.3.
- **Dynamique interne** (`04-ecrans-personnes-dynamique/manwe-9-dynamique.html`) : c'est la version retenue. Elle s'appuie sur des modèles scientifiques (Kenrick, OPD-2, Gross, CCRT, Miller, Powers), à rapprocher du champ `mechanism` (D-017, D-019).
- **Règles communes** : pas d'arc-en-ciel ni de marque de réussite sur une hypothèse ; 7 relations au plus par schéma.

Les versions animées chargent des polices Google : il faudra les embarquer localement (application locale, projet confidentiel).

## Adaptation faite (25 septembre 2026, D-027)

Le thème **13 · Jewel case** est appliqué à `apps/desktop` : `src/jewel.css` (jetons, typographie, surcouches), `src/JewelField.tsx` (shader des lignes de balayage), `src/jewelTheme.ts` (couleurs de contexte), anneaux et brins de contexte dans `WorldGraph.tsx`, légende « Contextes = couleurs » dans la barre latérale. Les couleurs vertes d'origine de `styles.css` ont été converties vers la palette du boîtier. Les polices sont embarquées (`@fontsource`), sans appel à Google. Les thèmes 12, 14 et 15 ne sont pas intégrés.
