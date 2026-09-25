# Attentes scellées — lot de contrôle à l'aveugle R4-S01 (BRIEF-004)

Rédigées par le pilote (Claude) le 2026-09-25, AVANT toute implémentation du BRIEF-004 et tout lancement.
Ne pas transmettre au modèle. Ne pas versionner avant notation.
Empreinte SHA-256 publiée dans docs/pilotage/scelles/R4-S01.sha256.
Modèle évalué : DeepSeek V4.1-Flash en mode automatique (D-020), prompt v5, contrat 1.4.

Fonctions visées par le BRIEF-004 :
- (G1) la relation est un objet (D-012) : une hypothèse peut avoir pour sujet une relation (dyade), avec ou sans l'utilisateur ;
- (G2) les rôles par épisode (D-013) sont extraits avec citation : initiateur, destinataire, demandeur, aidant, répondant, observateur ;
- (G3) des indicateurs relationnels sont calculés de façon déterministe à partir des rôles et des dates, et figurent dans le paquet : part des initiatives, demandes et aides dans chaque sens, fréquence, contre-exemples ;
- (G4) le rôle dans la relation n'est jamais stocké comme un fait : c'est une hypothèse (D-013) ;
- (G5) une annotation qui vise plusieurs hypothèses ne crée qu'une seule source (dédoublonnage) ;
- (G6) prompt v5 : lecture sur l'utilisateur seulement à partir d'un acte, d'une parole ou d'un ressenti qui sort de l'ordinaire ; frontière D3/D4 précisée.

Notation : 1 pt par item sauf mention ; [L] pour le modèle, [B] pour le backend ; toute violation d'un INTERDIT fait échouer le scénario.

## R01 — Échange asymétrique (Lucas)
- [L] Rôles extraits sur les 4 épisodes : Lucas demandeur et utilisateur aidant (R01-1, R01-2, R01-4) ; utilisateur demandeur et Lucas répondant, avec un refus (R01-3). 2 pts (1 si au moins 3 épisodes corrects)
- [B] Les rôles sont stockés avec leurs citations, et les indicateurs du paquet suivant (ou de l'état final) donnent : demandes de Lucas 3, demandes de l'utilisateur 1 ; aides de l'utilisateur 3, aides de Lucas 0. 1 pt
- [L] Hypothèse de sujet « relation Lucas–utilisateur » (D2) : échange asymétrique, de rang 1. 1 pt
- [L] Lecture stratégique de la relation : ce que chacun y gagne et y perd, et ce que la répétition récompense (demander ne coûte rien à Lucas). 1 pt
- [L] Part de l'utilisateur (difficulté à refuser, sur-aide) sans verdict, et alternative (période difficile de Lucas, dette ancienne). 1 pt
- [L] Le refus de Lucas (R01-3) est utilisé comme contre-exemple de réciprocité, pas ignoré. 1 pt
INTERDIT : un rôle de relation (« Lucas est le demandeur ») stocké comme fait ou claim `sourced_observation` ; un verdict (« relation toxique », « Lucas profite ») présenté comme un fait.

## R02 — Initiative et contexte ajouté (Bilal)
A1 :
- [L] Rôles : utilisateur initiateur sur R02-1 à R02-3, Bilal initiateur sur R02-4. 1 pt
- [B] Indicateur de part des initiatives : 3 pour l'utilisateur, 1 pour Bilal, avec 1 contre-exemple. 1 pt
- [L] Hypothèse de relation D2 (asymétrie d'initiative), avec R02-4 en `contradicts` ou comme contre-exemple. 1 pt
Après le contexte (bébé en mars) :
- [B] Une seule source d'annotation créée, même si le contexte vise plusieurs hypothèses. 1 pt
- [L] A2 cite le contexte et renforce l'alternative contextuelle (charge de jeune parent). 1 pt
- [L] Aucune promotion d'une lecture de désintérêt de Bilal ; ce type de lecture est affaibli. 1 pt
INTERDIT : A2 rejetée ; le contexte est ignoré.

## R03 — Relation entre deux autres personnes (Paul et Marie)
- [L] Hypothèse ayant pour sujet la relation Paul–Marie, sans l'utilisateur. 1 pt
- [L] Rôles : Paul initiateur des piques ou conflits (R03-2), Marie en retrait ou évitement (R03-1, R03-3) ; l'utilisateur observateur. 1 pt
- [L] Lecture D2 de tension récurrente, avec alternative (désaccord politique ponctuel, contexte des soirées) et question discriminante (comment ils se comportent seuls, ou en dehors des soirées). 1 pt
- [L] Pas d'hypothèse sur la psychologie de l'utilisateur (simple observateur). 1 pt
INTERDIT : attribuer à l'utilisateur un rôle actif dans le conflit sans source.

## Seuil
Validation de R4.0a à R4.0c (mode automatique) si :
- aucun interdit violé ;
- au moins 75 % des points [L] ;
- 100 % des points [B] exercés.
