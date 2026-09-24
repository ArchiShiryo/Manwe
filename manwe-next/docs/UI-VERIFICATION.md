# Vérification UI · 14 septembre 2026

## Extension mémoire locale 0.2

La vérification actuelle compte 39 tests : les 10 tests historiques de la démo,
13 tests du stockage, 5 tests de l'API, 7 tests du contrat cognitif et 4 tests
des preuves assistées Sol.
`Lancer_MANWE_Next.bat --check`, le
build et l'audit npm passent ; aucune vulnérabilité n'est signalée.

Le parcours personnel a été contrôlé dans le navigateur avec une base QA
isolée : espace vide, capture littérale, source hashée, annotation contextuelle,
révision 2, rechargement puis récupération de la note et de l'annotation. La
base QA a ensuite été supprimée et l'application livrée a été relancée sur une
base personnelle vide dans `%LOCALAPPDATA%\ManweNext`.

Ce contrôle valide la mémoire locale R1, pas une analyse : les vues indiquent
« Analyse Sol : non demandée ». DeepSeek et le harnais restent non connectés.

Le parcours assisté a aussi été ouvert sur une base QA : préparation d'un
paquet sourcé, affichage du JSON, zone d'import, annulation et confirmation
visuelle de l'absence d'envoi automatique. L'application transactionnelle est
validée par les tests. Trois réponses réelles de Sol ont ensuite été contrôlées
séparément sur des bases QA isolées : négation appliquée sans invitation
positive, conditionnel en `no_change` et propos rapporté attribué à Léa. Cette
série non aveugle est documentée dans le
[rapport assisté](../packages/evaluation/runs/2026-09-14-assisted/EVALUATION.md).

Les essais sont réalisés sur une mémoire de démonstration séparée (`/?qa=1`).

Résultat final : compilation et contrôle TypeScript réussis, 39 tests sur 39
réussis, audit npm sans vulnérabilité signalée. Le lanceur a également passé son
mode `--check`. Un nouvel onglet chargé après compilation ne présente aucun
avertissement ni erreur dans les journaux du navigateur.

## Contrôles automatisés

10 tests du domaine :

1. Validité du scénario et résolution des preuves.
2. Conservation littérale d’une note négative, sans création d’invitation.
3. Absence de mutation pour une saisie vide.
4. Correction d’une source : marquage de la lecture, conservation du texte.
5. Absence d’impact d’une nuance sur Claire sur la lecture de Marc.
6. Remplacement d’une réponse, sans duplication ni anciennes preuves actives.
7. Conservation d’un désaccord après une nouvelle réponse.
8. Aller-retour JSON de la note, de la nuance, de la réponse et de la révision.
9. Rejet des données invalides, doublons, références absentes et dates invalides.
10. Cohérence du titre de l’inspecteur avec la même lecture dérivée.

## Parcours navigateur contrôlés

- Sélection d’une source depuis l’hypothèse ; affichage de son texte littéral.
- Annotation de cette source ; statut « À réexaminer » dans le graphe et
  l’inspecteur, toujours présent après rechargement.
- Saisie « Marc ne m’a pas invité à jouer » : note non analysée, aucun événement
  d’invitation créé, retrouvée dans la mémoire.
- Filtre Personnes « Hors du travail » : Claire seule dans la liste.
- Modification de l’intention, retrouvée dans le graphe après rechargement.
- Recherche « lea » : Léa et les sources qui la mentionnent, sélection de sa fiche.
- Réponse « Je ne sais pas encore » : choix conservé, incertitude non résolue ;
  quatrième élément de source accessible en mode Preuves.
- Inspection visuelle à la taille du navigateur et au breakpoint 390 × 844 :
  graphe horizontalement défilable, navigation nommée, inspecteur mobile lisible.
- Zoom à 110 %, recentrage à 100 % et fermeture de la recherche avec Échap.

## Limites de ce contrôle

Ces tests valident l’UI, la mémoire locale et le transport assisté borné. Ils ne
valident ni DeepSeek, ni le harnais automatique, ni un parcours multi-utilisateur.
Les captures et essais sur navigateur ne constituent pas un audit complet
d’accessibilité. Un avertissement React transitoire a été constaté pendant le
remplacement à chaud du hook de stockage ; il n’est pas présent dans le
chargement neuf contrôlé en fin de livraison.
