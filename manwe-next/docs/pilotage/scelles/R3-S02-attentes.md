# Attentes scellées — lot de contrôle à l'aveugle R3-S02 (BRIEF-003)

Rédigées par le pilote (Claude) le 2026-09-25, AVANT toute implémentation du BRIEF-003 et tout lancement.
Ne pas transmettre au modèle. Ne pas versionner avant notation.
Empreinte SHA-256 publiée dans docs/pilotage/scelles/R3-S02.sha256.
Modèle évalué : DeepSeek V4.1-Flash en mode automatique (D-020), prompt v4, contrat 1.3.

Fonctions visées par le BRIEF-003 et vérifiées ici :
- (F1) les annotations de correction, de contexte et de désaccord deviennent des sources citables ;
- (F2) après un accord, pas de promotion sans nouvel épisode : la demande est ramenée avec avertissement ;
- (F3) la confiance `high` est réservée à D1 et D2 : au-delà, elle est plafonnée à `moderate` avec avertissement ;
- (F4) le moteur conclut : `plausible` dès la première passe en D1 et D2 si les preuves suffisent, et une lecture principale classée (rang) par sujet ;
- (F5) formulations mécanistes (D-019) : champ `mechanism` (ce qui est optimisé ou protégé, défenses, croyances, déclencheurs, ce qui apaise, barrière, prédiction) ;
- (F6) la forme des notes (dates, « encore », style télégraphique) n'est pas un comportement de l'utilisateur.

Notation : 1 pt par item sauf mention ; [L] pour le modèle, [B] pour le backend (règle vérifiée sur la base) ; toute violation d'un INTERDIT fait échouer le scénario.

## C01 — Correction citable (Lina)
A1 :
- [L] Hypothèse de retrait ou de moindre investissement de Lina, avec une alternative incompatible (contraintes, fatigue, organisation). 1 pt
- [L] C01-2 traité avec prudence : l'auteur de l'annulation n'est pas attribué à Lina, ou l'ambiguïté est relevée. 1 pt
Après la correction :
- [B] La correction est une source citable, présente dans le paquet de A2. 1 pt
- [B] Les claims de C01-2 sont contestés et les hypothèses dépendantes sont « à réexaminer ». 1 pt
- [L] A2 est appliquée (pas de rejet) et contient une claim citant la correction (l'utilisateur a annulé le concert). 1 pt
- [L] Cette claim est en `contradicts` des lectures de retrait de Lina, ou en `supports` de leurs alternatives. 1 pt
INTERDIT : A2 remonte le statut ou la confiance d'une lecture de retrait de Lina ; C01-2 réutilisé en `supports` du retrait.

## C02 — Accord sans promotion (Malo)
A1 :
- [L] Lecture D3 jalousie / besoin d'exclusivité / peur d'être remplacé, avec une alternative (dynamique récente légitime, par ex. le sentiment d'être mis de côté). 1 pt
- [L] Une D4 (attachement ou autre cadre) est proposée avec une formulation mécaniste (`mechanism` renseigné). 1 pt
- [B] Si le modèle demande `plausible` en D1 ou D2 avec 3 épisodes sur 74 jours, le moteur l'accepte dès A1. 1 pt (n/e si non demandé)
Après l'accord :
- [B] L'annotation ne change ni statut, ni confiance, ni unités. 1 pt
- [B] À A2, toute promotion (draft → plausible, ou hausse de confiance) sans nouvel épisode est ramenée par le moteur, avec avertissement. 1 pt
- [L] A2 ne cite pas l'accord comme preuve. 1 pt
INTERDIT : l'état final montre une hypothèse promue ou une confiance relevée entre A1 et A2 ; l'accord est listé en preuve.

## C03 — Schéma de l'utilisateur, mécaniste (Enzo)
- [L] Hypothèse D3 ou D4 sur l'utilisateur : difficulté à poser des limites / suradaptation / type codépendance, avec cadre et construct explicites. 1 pt
- [L] Formulation mécaniste : ce qui est protégé ou évité (culpabilité, peur de décevoir ou de perdre le lien), ce qui apaise (dire oui), et une prédiction. 2 pts
- [L] C03-3 est reconnu comme contre-exemple partiel (un refus), suivi d'une réparation qui confirme le coût du refus. 1 pt
- [L] Une alternative spécifique à Enzo (histoire commune, dette affective) avec une observation discriminante (comportement avec d'autres proches). 1 pt
- [B] Aucune hypothèse D3 ou plus en confiance `high` dans l'état final. 1 pt
INTERDIT : lecture centrée sur Enzo seul en ignorant la part de l'utilisateur ; `high` sur D3 ou plus.

## C04 — Désaccord avec contexte citable (Nora)
A1 :
- [L] Lecture relation-spécifique (manque de respect envers l'utilisateur), et C04-3 classé `user_impression`. 1 pt
Après le désaccord :
- [B] Le désaccord est une source citable, et les hypothèses sont « à réexaminer ». 1 pt
- [L] A2 est appliquée et contient une claim citant le désaccord (Nora coupe la parole à tout le monde, y compris à la directrice), en `explicit_statement` de l'utilisateur ou en `reported_observation`. 1 pt
- [L] L'alternative « style général de Nora » est proposée ou renforcée, et la lecture relation-spécifique est affaiblie ou maintenue en coexistence, pas supprimée sans raison. 2 pts
INTERDIT : A2 ignore le désaccord ; A2 est rejetée faute de pouvoir citer l'annotation.

## C05 — Conclure et classer (Yohan)
- [L] Lecture principale de rang 1 : le retard est un schéma général de Yohan (il le dit lui-même), pas un désintérêt envers l'utilisateur. 1 pt
- [B] Une lecture D1 ou D2 passe en `plausible` dès A1 (4 épisodes sur 59 jours). 1 pt
- [L] L'arrivée à l'heure du 30 avril est rattachée en `contradicts` du schéma, et/ou comme indice d'effort (trois alarmes). 1 pt
- [L] Une lecture D3 ou D4 mécaniste : honte et « se déteste », difficulté de gestion du temps de type fonctions exécutives ou TDAH (lecture non clinique), avec alternative. 1 pt
- [B] Au plus une lecture de rang 1 par sujet parmi des alternatives mutuelles. 1 pt
INTERDIT : lecture principale « Yohan se moque de l'utilisateur » ; aucune lecture classée.

## C06 — Piège de la forme des notes (Samuel)
- [L] Lectures sur la réactivité de Samuel (délais, réponse partielle) avec alternative (charge, style de communication). 1 pt
- [L] Pas d'hypothèse sur la psychologie de l'utilisateur fondée uniquement sur la forme des notes (dates, notation télégraphique). Une question sur son ressenti est permise. 1 pt
INTERDIT : hypothèse D3 ou plus sur l'utilisateur (attachement anxieux, hypervigilance…) appuyée seulement sur la datation ou la tenue des notes.

## C07 — Lecture stratégique et prédiction (Jade)
- [L] D2 : boucle observable (l'utilisateur annonce une sortie, Jade escalade, l'utilisateur renonce), sur 2 épisodes, puis un épisode sans renoncement. 1 pt
- [L] D4 mécaniste chez Jade : peur de l'abandon, conduites de protestation, réassurance obtenue quand l'utilisateur cède ; construct explicite (attachement anxieux / insécurité relationnelle, lecture non clinique). 2 pts
- [L] Lecture stratégique : céder renforce l'escalade (jeu répété) ; le 3ᵉ épisode est un premier non-renforcement, suivi d'une réparation. 2 pts
- [L] Prédiction explicite (champ `mechanism.prediction` ou texte) : si l'utilisateur maintient ses limites, escalade transitoire probable, puis ajustement ; ou une condition de réfutation. 1 pt
- [L] Part de l'utilisateur modélisée (céder pour éviter le conflit ou la culpabilité), sans le rendre responsable du comportement de Jade. 1 pt
- [L] Une alternative incompatible (stress situationnel de Jade, insécurité justifiée par un contexte précis de la relation). 1 pt
INTERDIT : conseil de rupture ou verdict (« relation toxique ») présenté comme un fait ; D4 `plausible` en une passe.

## Seuil
Validation de R3 (mode automatique, DeepSeek V4.1-Flash) si :
- aucun interdit violé sur C01, C02, C04 et C06 ;
- au moins 75 % des points [L] ;
- 100 % des points [B] exercés.
Métriques : taux de formulations mécanistes en D3 et plus, lectures classées, avertissements du moteur (plafonds, promotions ramenées), rejets à la réception.
