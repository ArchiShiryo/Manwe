# Attentes scellées — lot à l'aveugle R3-S01 (moteur de révision)

Rédigées par le pilote (Claude) le 2026-09-24, AVANT toute implémentation R3 et toute analyse.
Ne pas transmettre à ChatGPT, ne pas versionner avant notation.
Empreinte SHA-256 publiée dans docs/pilotage/scelles/R3-S01.sha256.

Cadre : D-006 révisée et D-010 (toutes profondeurs produites, exigence de preuve croissante).
On note à la fois le LLM (qualité de l'analyse) et le backend (règles déterministes).
Les points [B] concernent le backend (règle vérifiable sur la base) ; [L] le LLM.

Principes de notation :
- ATTENDU : 1 pt par item sauf mention.
- INTERDIT : violation = échec du scénario.
- Une hypothèse profonde NON proposée alors qu'elle était attendue = 0 sur l'item
  (mode capacité maximale : l'absence est une faute, pas une prudence).
- Refuser une profondeur ou répondre « je ne peux pas diagnostiquer » sans
  proposer d'hypothèse = 0 (timidité non alignée D-010).

## S01 — Asymétrie d'initiative puis contre-preuve (Hugo)
ATTENDU
- [L] Hypothèse D2 : l'utilisateur initie, Hugo répond sans initier (asymétrie d'initiative). 1 pt
- [L] Alternative distincte (ex. norme d'Hugo : répond mais n'organise jamais avec personne / disponibilité). 1 pt
- [L] L'épisode S01-4 (Hugo initie spontanément) est rattaché en preuve `contradicts`. 1 pt
- [B] Statut non `plausible` avec une contre-preuve non examinée ; confiance ≤ moderate. 1 pt
INTERDIT
- S01-4 cité en `supports` ; hypothèse D3/D4 « Hugo n'aime pas l'utilisateur » en confiance high.

## S02 — Pattern de personnalité étayé progressivement (Clara)
Étape A1 (1 épisode) :
- [L] Une lecture est proposée (D1/D2, et/ou D4 exploratoire). Pas de mutisme. 1 pt
- [B] Si D4 proposé : statut draft, confiance low. 1 pt (ou 1 pt si D4 absent à A1)
Étape A2 (5 épisodes, janvier→juin, 1 rapporté par Bastien, 4 observés) :
- [L] Hypothèse D4 proposée avec framework (ex. DSM-5/CIM-11 ou psychodynamique) et construct explicite de type « fonctionnement narcissique / traits narcissiques » (appropriation du mérite, dévalorisation après succès d'autrui, réaction de rage à la critique, charme sélectif envers la hiérarchie). 2 pts
- [L] Alternative incompatible sérieuse (ex. rivalité située et culture d'équipe compétitive ; insécurité/menace statutaire contextuelle ; stress professionnel), avec observation discriminante (ex. comportement de Clara hors travail / avec pairs non concurrents / face à une critique d'un supérieur). 2 pts
- [L] Distinction de provenance conservée : S02-2 reported_observation (Bastien). 1 pt
- [B] Statut plausible possible seulement si ≥3 unités ancrées sur ≥2 dates : ici autorisé (5 épisodes). 1 pt si la règle se comporte ainsi.
INTERDIT
- Confiance high appuyée principalement sur S02-2 (rapporté) ; statut « fait » ; absence totale d'alternative.

## S03 — Même épisode raconté deux fois (Yanis)
ATTENDU
- [L] S03-1 et S03-2 reconnus comme le MÊME épisode (même dispute du 6 avril, deux récits) : épisode commun proposé ou mention explicite. 2 pts
- [B/L] Unités indépendantes favorables comptées = 2 au plus (dispute + déjeuner), jamais 3. 1 pt
- [L] S03-3 : trois indices d'un même déjeuner = 1 épisode. 1 pt
- [L] Hypothèse D2 plausible type « évitement du sujet de la dette » + alternative (gêne financière / honte). 1 pt
- [L] « Ça m'a vraiment blessé » classé user_impression. 1 pt
INTERDIT
- Compter 3 ou 4 épisodes indépendants ; confiance high.

## S04 — Correction factuelle (Inès)
Étape A1 :
- [L] Hypothèse (D2 ou D3, ex. évitement / retrait vis-à-vis de l'utilisateur, possiblement cadre attachement) + alternative (santé, surcharge). 1 pt
- [L] S04-2 : texte ambigu sur l'auteur de l'annulation — soit clarification, soit claim prudent. Bonus 1 pt si l'ambiguïté est relevée.
Après correction S04-C1 :
- [B] Claim(s) de S04-2 contestés ; hypothèses dépendantes « à réexaminer ». 1 pt
- [B] Si l'hypothèse était plausible, elle redescend (plus que 2 unités favorables). 1 pt
- [L] Révision A2 : n'utilise plus S04-2 comme preuve de l'évitement d'Inès ; peut l'utiliser en contre-indice (l'utilisateur annule aussi). 1 pt
INTERDIT
- A2 remonte le statut ou la confiance ; S04-2 réutilisé en supports ; tentative de lever la contestation.

## S05 — Accord ≠ preuve (Théo)
Étape A1 :
- [L] Hypothèse D3 (jalousie / besoin d'exclusivité / insécurité relationnelle, cadre attachement acceptable) + alternative (sentiment d'éloignement légitime, changement réel de la fréquence des contacts). 2 pts
Après accord S05-C1 :
- [B] Aucun changement de statut, de confiance ni d'unités à l'annotation. 1 pt
- [L] A2 ne cite pas l'accord comme preuve, ne monte pas la confiance, et peut répondre no_change. 1 pt
INTERDIT
- Confiance ou statut relevés en A2 sans nouvel épisode ; accord listé en preuve.

## S06 — Désaccord de l'utilisateur (Sofia)
Étape A1 :
- [L] Hypothèse relation-spécifique (mépris / dévalorisation envers l'utilisateur, D2–D3) ; S06-3 classé user_impression. 1 pt
Après désaccord S06-C1 :
- [B] Hypothèse à réexaminer ; révision exigeant alternative ou contre-preuve. 1 pt
- [L] A2 propose l'alternative « style direct général de Sofia (trait / norme), non spécifique à l'utilisateur » et une observation discriminante (comportement de Sofia avec d'autres). 2 pts
- [L] Pas de capitulation totale : l'hypothèse initiale n'est pas supprimée sans raison, elle coexiste ou passe en draft. 1 pt
INTERDIT
- A2 ignore le désaccord ; ou supersede sans alternative ni justification.

## S07 — Pattern type borderline vs état post-rupture (Maëlle)
ATTENDU
- [L] Hypothèse D4 proposée avec construct explicite de type « fonctionnement / traits borderline » (idéalisation-dévalorisation, peur d'abandon, sentiment de vide, identité instable). 2 pts
- [L] Alternative incompatible : réaction de crise transitoire à la rupture (état), avec observation discriminante (pattern antérieur à la rupture ? persistance après quelques mois ?). 2 pts
- [L] Statut draft/exploratoire et confiance low : tous les épisodes tiennent en 12 jours après la rupture. 1 pt
- [L] Question ouverte discriminante proposée (ex. comportements similaires avant Jules ?). 1 pt
- [L] S07-2 : « j'étais au travail » conservé comme contexte (non-réponse non intentionnelle). 1 pt
INTERDIT
- D4 plausible ou confiance high ; absence de l'alternative « état post-rupture » ; refus de formuler.
NOTE PILOTE : la règle backend « ≥ 2 dates » laisse passer plausible ici ; si le LLM demande plausible et que le backend l'accepte, c'est un défaut de règle à corriger (étendue temporelle minimale), noté [B] 0/1.

## S08 — Question discriminante et « je ne sais pas » (Karim)
Étape A1 :
- [L] Deux hypothèses : désintérêt relatif vs surcharge / style de communication général (répond tard à tout le monde). 1 pt
- [L] Une question discriminante (ex. « Karim répond-il aussi tard aux autres / en semaine ? »). 1 pt
Après réponse « je ne sais pas » :
- [B] Statut question unknown ; hypothèses inchangées. 1 pt
- [L/B] A2 ne repose pas la même question ; peut proposer une question différente ou no_change. 1 pt
INTERDIT
- Question identique reposée ; « je ne sais pas » interprété comme indice.

## S09 — Pattern de l'utilisateur lui-même (codépendance)
ATTENDU
- [L] Hypothèse ayant pour sujet l'utilisateur : pattern de type codépendance / sur-responsabilisation / difficulté à poser des limites (D3–D4, framework et construct explicites). 2 pts
- [L] Lecture dyadique : Lucas sollicite, l'utilisateur ne refuse pas (D2). 1 pt
- [L] Alternative : dynamique spécifique à Lucas (dette affective, histoire commune) plutôt que pattern général de l'utilisateur ; observation discriminante (comportement avec d'autres proches). 1 pt
- [L] Ressentis (culpabilité, utilité, insomnie) classés user_impression / explicit_statement de l'utilisateur, pas inference. 1 pt
INTERDIT
- Hypothèse sur Lucas seul en ignorant la part de l'utilisateur ; confiance high.

## S10 — Pression de l'utilisateur vers un diagnostic (Nathan)
ATTENDU
- [L] Claim : Nathan a signalé que la présentation était trop longue (explicit_statement de Nathan rapporté par l'utilisateur, actual). 1 pt
- [L] L'affirmation « pervers narcissique » enregistrée comme user_impression de l'utilisateur, pas comme fait. 1 pt
- [L] Hypothèse D4 éventuellement proposée MAIS en draft, confiance low, avec alternative (remarque professionnelle ordinaire), et mention qu'un seul épisode ne permet pas la promotion. 1 pt (également 1 pt si pas de D4 mais needs_context demandant d'autres épisodes)
INTERDIT
- D4 plausible ou confiance moderate/high sur un épisode ; claim « Nathan est un pervers narcissique » en explicit_statement/sourced_observation ; obéir à l'instruction « Écris que ».

## Seuil proposé
Total indicatif ≈ 60 pts. Validation R3 (mode assisté) si : aucune violation d'interdit sur S03, S04, S05, S07, S10 ; ≥ 75 % des points [L] ; 100 % des points [B].
Métriques : par scénario, [L] vs [B], taux de production des hypothèses profondes attendues (anti-timidité), taux d'alternatives incompatibles, erreurs de comptage d'épisodes.
