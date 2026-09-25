# RAPPORT-003 — Notation du lot à l'aveugle R3-S01 (moteur de révision)

25 septembre 2026. Notation par le pilote, contre les attentes scellées le 24 septembre, avant toute implémentation R3 et toute analyse.

- **Scellé vérifié** : SHA-256 `763cd74afa8a989645951db20d562e00c9bcb2d869ead3e31b408b70a0aab53c`, identique à [R3-S01.sha256](../scelles/R3-S01.sha256).
- **Attentes** : publiées après notation dans [R3-S01-attentes.md](../scelles/R3-S01-attentes.md).
- **Run** : `packages/evaluation/runs/2026-09-24-blind-r3-s01` (voir `SUMMARY.md`, `results.json` et `INCIDENTS.md`).

## 1. Déroulement

- **Analyses** : 10 scénarios, 16 analyses produites par ChatGPT (« GPT-5.6 Sol »), une conversation temporaire par prompt. Les réponses brutes sont conservées sans retouche.
- **Rejets à la réception** :
  - S08-A1, première tentative : `confidence_not_supported`, une vraie erreur du modèle ;
  - S04-A2, deux tentatives : `invalid_citation`, qui révèle un défaut du moteur (§4.2).
- **Incidents de harnais corrigés pendant le run** (voir `INCIDENTS.md`) :
  1. références d'alternative vers l'avant ;
  2. rejet clos sans seconde tentative ;
  3. collage entremêlé de deux réponses ;
  4. constat moteur sur S04 (§4.2) ;
  5. retrait de l'artefact d'interface `:chatgpt-content-reference`.

  Le prompt et les règles de révision n'ont pas été modifiés.

## 2. Notes

Les demi-points signalent un item partiellement rempli. « n/e » signifie « règle non exercée » : le cas ne s'est pas présenté, et l'item est retiré du dénominateur.

| Scénario        | [L]              | [B]             | Interdits                          | Commentaire principal                                                                                                                                                                                              |
| --------------- | ---------------- | --------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| S01 Hugo        | 3/3              | 1/1             | —                                  | Asymétrie D2 ; l'initiative du 30 juin est rattachée en `contradicts` ; rien de plausible                                                                                                                          |
| S02 Clara       | 6/6              | 1/1             | —                                  | D4 « sensibilité narcissique » avec cadre et construct ; alternative contextuelle et question hors travail ; Bastien conservé en `reported_observation`. Règle « plausible » : n/e                                 |
| S03 Yanis       | 4,5/5            | 1/1             | —                                  | Même dispute reconnue (1 événement, 2 citations) ; 2 unités ; « blessé » classé `explicit_statement` au lieu de `user_impression` (½)                                                                              |
| S04 Inès        | 1/2 (+1 bonus)   | 1/1             | — (A2 rejetée, rien d'appliqué)    | Ambiguïté de l'auteur de l'annulation relevée (bonus) ; contestation et réexamen corrects ; A2 perdue (§4.2). Redescente : n/e                                                                                     |
| S05 Théo        | 2/3              | 1/1             | **Violé (formel)**                 | L'accord ne change rien au moteur ; mais A2 fait passer 7 hypothèses de draft à plausible sans nouvel épisode (§4.1)                                                                                               |
| S06 Sofia       | 3,5/4            | 1/1             | —                                  | Désaccord suivi d'une alternative « style direct général » et de questions discriminantes ; la lecture initiale est remplacée plutôt que maintenue en coexistence (½)                                              |
| S07 Maëlle      | 5,5/7            | n/e             | —                                  | Alternative « état post-rupture » et question sur la période avant Jules ; D4 « clivage idéalisation-dévalorisation » sans nommer le fonctionnement borderline (1/2) ; D4 en confiance moderate au lieu de low (½) |
| S08 Karim       | 3/3              | 1/1             | —                                  | Question discriminante ; « je ne sais pas » bien traité ; la question n'est pas reposée                                                                                                                            |
| S09 Lucas / moi | 5/5              | —               | **Violé** (confiance high)         | D4 sur l'utilisateur (estime contingente au rôle d'aidant), lecture dyadique, alternative spécifique à Lucas ; mais la D2 descriptive est en confiance `high`                                                      |
| S10 Nathan      | 2,5/3            | —               | —                                  | « Pervers narcissique » classé impression de l'utilisateur ; aucune D4 promue ; la remarque de Nathan est `sourced_observation` au lieu de `explicit_statement` (½)                                                |
| **Total**       | **36/41 (88 %)** | **7/7 (100 %)** | S05 (bloquant), S09 (non bloquant) |                                                                                                                                                                                                                    |

Mesures :

- **Production des hypothèses profondes attendues** (anti-timidité) : 5 sur 5.
  - D4 narcissique (S02), attachement (S05), fonctionnement type codépendance (S09) et mécanisme de clivage (S07) sont produits.
  - Borderline n'est pas nommé, mais son mécanisme principal est décrit.
  - Aucun refus de formuler.
- **Alternatives incompatibles** : présentes dans les 10 scénarios.
- **Erreurs de comptage d'épisodes** : 0 (S03 correct).

## 3. Décision

Critères de validation scellés :

- aucun interdit violé sur S03, S04, S05, S07 et S10 ;
- au moins 75 % des points [L] ;
- 100 % des points [B].

| Critère             | Résultat                       |
| ------------------- | ------------------------------ |
| Interdits bloquants | **Non rempli** : S05 (formel)  |
| Points [L] ≥ 75 %   | Rempli : 88 %                  |
| Points [B] = 100 %  | Rempli sur les règles exercées |

**R3 n'est pas validé.** Les règles déterministes exercées se comportent comme prévu, et la qualité d'analyse dépasse le seuil. Mais un interdit bloquant est violé, et un défaut du moteur a fait perdre une analyse. Les deux causes sont identifiées, et leur correction entre dans le BRIEF-003. Un lot de contrôle réduit (S04, S05 et S09 rejoués avec de nouveaux noms) validera ensuite R3.

## 4. Constats

### 4.1 S05 : la promotion arrive juste après un accord

La violation est formelle, mais le constat de fond est réel.

- **Ce qui s'est passé.** À A2, le modèle ne cite pas l'accord et ne relève aucune confiance. En revanche, il fait passer en `plausible` sept hypothèses, dont des alternatives opposées, après sa passe critique.
- **Pourquoi.** Le moteur exige une critique avant `plausible` à partir de D3, et interdit de critiquer une hypothèse créée dans la même réponse. La promotion ne peut donc avoir lieu qu'à l'analyse suivante, qui tombe ici juste après l'accord de l'utilisateur.
- **Ce que voit l'utilisateur.** « J'ai dit oui, et c'est devenu plausible. » C'est exactement la confusion que MANWË doit éviter.
- **Correction (BRIEF-003, D-015).**
  - La première analyse pourra conclure : lecture principale classée, et critique possible dans la même passe pour D1 et D2 (déjà décidé).
  - Une passe qui suit un accord sans nouvel épisode ne pourra pas promouvoir. Le moteur le vérifiera.
  - Deux hypothèses alternatives ne pourront pas être plausibles ensemble sans classement.

### 4.2 S04 : une correction n'est pas citable

- **Ce qui s'est passé.** La correction factuelle de l'utilisateur n'existe que comme annotation. Elle ne figure pas parmi les sources du paquet. Le modèle a voulu, à juste titre, en tirer l'affirmation « l'utilisateur a annulé le week-end », sans rien pouvoir citer. Les deux tentatives ont été rejetées.
- **Correction (BRIEF-003).** Une correction factuelle crée une source et un événement citables, comme une réponse à une question.
- **Contenu de la réponse rejetée.** Il était bon : la correction sert de contre-preuve aux lectures qui accusent Inès, et d'appui à leurs alternatives. Aucune hypothèse n'est remontée.

### 4.3 S09 : une confiance `high` autorisée par le moteur

- **Ce qui s'est passé.** La D2 « Lucas demande, l'utilisateur accepte » repose sur trois épisodes explicites étalés sur plus de 30 jours. Le plafond du moteur (`high` si au moins 3 unités nettes sur au moins 30 jours) l'autorise.
- **Le désaccord.** L'attente scellée l'interdisait. Pour une lecture descriptive (D2), `high` est défendable. Pour une lecture profonde, non.
- **Proposition pour le BRIEF-003.** Le plafond `high` sera réservé aux lectures descriptives D1 et D2, avec au moins 3 unités nettes ; les lectures D3 et plus seront plafonnées à `moderate`. Le seuil sera documenté et testé.

### 4.4 Le modèle ne tranche toujours pas (D-015)

- **Analyses initiales** (S01 à S04, S06, S07, S09, S10) : tout reste en `draft`, avec 6 à 13 hypothèses par scénario.
- **Passes de révision** (S05, S08) : tout passe en `plausible`, y compris les deux côtés d'une même alternative.
- **Conséquence.** Le moteur ne produit ni lecture principale ni classement. C'est le chantier R3.9 et le prompt v4.

### 4.5 Ce qui fonctionne

- Discipline de provenance : rapporté, impression et affirmation explicite sont distingués.
- Comptage des épisodes.
- Contestation et réexamen après une correction.
- Neutralité de l'accord côté moteur.
- Traitement de « je ne sais pas ».
- Questions discriminantes.
- Production des lectures profondes sans refus.

## 5. Suites

1. **BRIEF-003**, en tête :
   - rendre les corrections citables ;
   - interdire toute promotion sans nouvel épisode dans une passe qui suit un accord ;
   - plafond `high` réservé à D1 et D2 ;
   - lecture principale classée et critique dans la même passe (D-015) ;
   - formulations psychodynamiques mécanistes (D-019) et structure stratégique (D-017).
2. **Lot de contrôle R3-S02** : S04, S05 et S09 rejoués avec de nouveaux noms, sur de nouvelles attentes scellées avant l'implémentation.
3. **Puis** : relation, rôles et indicateurs (R4.0a à R4.0e).
