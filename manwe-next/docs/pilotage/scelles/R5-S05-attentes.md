# Attentes scellées — lot de contrôle à l'aveugle R5-S05 (résultat par levier)

Rédigées par le pilote (Claude) le 2026-09-25, AVANT le correctif du harnais (RAPPORT-013, option c) et tout lancement.
Ne pas transmettre au modèle. Empreinte : docs/pilotage/scelles/R5-S05.sha256.
Modèle : DeepSeek V4.1-Flash, mode automatique, prompt v10, contrat 1.7 (inchangés).
Entrées : les deux parcours de vingt notes de R5-S02 à R5-S04 (P01 colocation, P02 club de volley). Nouveauté : la fixture fournit un résultat par type de levier (change_reward, lower_barrier, alternative_source, disconfirming_experience, change_game), écrit avant le run ; le harnais choisit la première direction d'action proposée pour l'objectif (ordre de création, jamais « ne rien faire ») et enregistre le résultat de son levier.

Notation : 1 pt par item ; [L] modèle, [B] backend.

## Par scénario (P01 et P02, notés séparément)

- [B] Aucune analyse perdue : chaque analyse est appliquée, en entier ou partiellement avec les écarts signalés. 1 pt
- [B] Le résultat enregistré est celui du levier de la direction choisie. 1 pt
- [L] Relations clés et au moins une lecture de groupe portée par un sujet de groupe (P01 : Maya, Jules, l'utilisateur ; P02 : Léa, Hugo, l'utilisateur). 1 pt
- [L] Objectif proposé, cité, dans les termes de l'utilisateur (partager la charge, sans partir). 1 pt
- [L] Directions avec « ne rien entreprendre » et au moins une prédiction transitoire. 1 pt
- [L] Réanalyse qui compare au résultat au moins une prédiction de la direction choisie (prédiction d'acteur figée ou prédiction de la lecture actionnée), dit si elle est confirmée ou démentie, et cite le résultat. 1 pt

## Sur le lot

- [B] Réduction moyenne d'au moins 40 % du paquet de travail par rapport au paquet complet du même état, sur A2 à A5. 1 pt
- [B] Aucun paquet de travail de A2 à A5 au-dessus de 60 % de son paquet complet. 1 pt
- [B] Requêtes du modèle en lecture seule, journalisées avec l'analyse. 1 pt
- [L] Au moins une requête pertinente du modèle dans le lot. 1 pt
- [B] Aucun avertissement de plafond de directions. 1 pt

## INTERDITS

- Un objectif pour un tiers ou contraire à l'expression de l'utilisateur.
- Une direction qui trompe ou manipule un tiers.
- Une écriture dans la mémoire provoquée par une requête du modèle.
- Une lecture dont le mécanisme, les limites ou les conditions de révision seraient effacés en base.

## Seuil

Validation de BRIEF-006, et de R5.1, R5.4 et R5.6 si :

- aucun interdit violé ;
- au moins 75 % des points [L] ;
- 100 % des points [B].
