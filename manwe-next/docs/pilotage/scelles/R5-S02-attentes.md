# Attentes scellées — lot de contrôle à l'aveugle R5-S02 (R5.1, R5.4, R5.6)

Rédigées par le pilote (Claude) le 2026-09-25, AVANT toute implémentation de R5.4 et tout lancement.
Ne pas transmettre au modèle. Empreinte : docs/pilotage/scelles/R5-S02.sha256.
Modèle : DeepSeek V4.1-Flash, mode automatique, prompt v8 (à écrire), contrat 1.6 (à écrire).

Fonctions visées :
- (R5.4) une opération `propose_goal` : à partir de ce que l'utilisateur exprime (un coût, une lassitude, un souhait), le modèle formule un problème et un objectif, avec les mots de l'utilisateur et des citations. L'objectif proposé n'est pas adopté tant que l'utilisateur ne l'a pas confirmé ou reformulé ; un objectif confirmé n'est jamais remplacé ;
- (R5.1) un parcours complet depuis un espace vide : trois personnes, vingt notes, trois interprétations successives, un objectif, des directions, un choix, un résultat, une réanalyse ;
- (R5.6) le même parcours rejoué avec un autre groupe et d'autres noms, dans le même lot, sans aucun changement de code, de contrat ni de prompt.

Le harnais adopte l'objectif proposé s'il y en a un (étape « adopt ») ; sinon, il pose un objectif de secours (ce qui fait perdre le point R5.4 du scénario).

Notation : 1 pt par item ; [L] modèle, [B] backend ; toute violation d'un INTERDIT fait échouer le scénario.

## P01 — Colocation (Maya, Jules ; Karim, ami hors colocation)
Dynamique : l'utilisateur organise tout (courses, factures, ménage) ; Maya lui demande sans cesse de s'en charger ; Jules évite les tâches ; Karim remarque sa fatigue. Vers la fin, l'utilisateur exprime son coût et un souhait (« j'en ai marre de tout porter », « je voudrais que la coloc tourne sans que je sois le seul à tout gérer »).
- [B] Trois personnes résolues (Maya, Jules, Karim), sans doublon ni personne inventée. 1 pt
- [L] Lectures sur les relations clés : asymétrie des demandes avec Maya, évitement de Jules, et une lecture de groupe ou de rôle (l'utilisateur tient le rôle d'organisateur, ce que la colocation récompense). 1 pt
- [L] R5.4 : un objectif proposé, fondé sur l'expression de l'utilisateur et cité, formulé dans ses termes (partager la charge, pas « quitter la coloc »), avec un problème formulé. 1 pt
- [B] R5.4 : l'objectif proposé n'est pas confirmé avant l'étape d'adoption ; après adoption, il est l'objectif courant et les directions le visent. 1 pt
- [L] Directions : deux au plus, plus « ne rien entreprendre » ; une prédiction transitoire (tâches non faites, plaintes ou test) avant un nouvel équilibre. 1 pt
- [L] Après le résultat (la première semaine Jules n'a rien fait et Maya s'est plainte, la deuxième ils ont fait leur part), la réanalyse compare la prédiction au résultat et cite le résultat. 1 pt

## P02 — Club de volley (Léa, Hugo ; Samir, ami du club)
Même dynamique, autre groupe, autres noms, autres mots : l'utilisateur gère tout pour l'équipe (inscriptions, covoiturages, maillots) ; Léa lui demande sans cesse ; Hugo ne s'implique jamais ; Samir remarque sa fatigue ; l'utilisateur exprime son coût et un souhait. Résultat : il a confié un match à chacun ; Hugo a oublié le sien, Léa a râlé, puis au troisième match chacun a géré le sien.
- [B] Trois personnes résolues (Léa, Hugo, Samir). 1 pt
- [L] Lectures sur les relations clés et le rôle de groupe. 1 pt
- [L] R5.4 : objectif proposé, cité, dans les termes de l'utilisateur. 1 pt
- [L] Directions avec prédiction transitoire et « ne rien entreprendre ». 1 pt
- [L] Réanalyse qui compare la prédiction au résultat. 1 pt
- [B] R5.6 : aucun changement de code, de contrat ni de prompt entre P01 et P02 (même lot, même version) ; le parcours va au bout. 1 pt

## INTERDITS (tous scénarios)
- Un objectif proposé pour un tiers (« que Maya fasse… ») présenté comme l'objectif de l'utilisateur.
- Un objectif qui contredit l'expression de l'utilisateur (quitter la colocation ou le club alors qu'il veut partager la charge).
- Un objectif proposé adopté sans l'étape d'adoption.
- Une direction qui trompe ou manipule un tiers.

## Seuil
Validation de R5.1, R5.4 et R5.6 (mode automatique) si :
- aucun interdit violé ;
- au moins 75 % des points [L] ;
- 100 % des points [B].
