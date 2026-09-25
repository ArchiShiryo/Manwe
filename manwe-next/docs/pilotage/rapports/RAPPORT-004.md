# RAPPORT-004 — BRIEF-003 livré et lot de contrôle R3-S02 : R3 validé

25 septembre 2026. Réalisation et notation par le pilote (D-011). Modèle analyste : DeepSeek V4.1-Flash en mode automatique (D-020).

## 1. Ce qui a été livré (BRIEF-003)

Le brief découle du [RAPPORT-003](./RAPPORT-003.md) et des décisions D-015, D-017 et D-019.

| Fonction | Contenu                                                                                                                                                                                               | Commit    |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| F1       | Une correction, un contexte ou un désaccord crée une source citable et une note, reprises dans les paquets suivants. L'accord n'en crée pas.                                                          | `913ca2d` |
| F2       | Après un accord de l'utilisateur, aucune promotion (statut ou confiance) sans nouvel épisode ancré. La demande est ramenée, avec l'avertissement `promotion_after_agreement`.                         | `913ca2d` |
| F3       | La confiance `high` est réservée à D1 et D2. Une confiance ou un statut non permis est ramené, avec avertissement, au lieu de faire rejeter toute la réponse.                                         | `913ca2d` |
| F4       | Contrat 1.3 : `status` à la création (plausible effectif en D1 et D2), `rank` (1 = lecture principale), `revise.rank`. La tâche `revise` peut proposer des événements.                                | `913ca2d` |
| F5       | Champ `mechanism` : optimise, protège, défenses, croyances, déclencheurs, ce qui apaise, barrière, prédiction. Migration 007.                                                                         | `913ca2d` |
| F6       | Prompt `analyst-v4` : mission prédictive, lecture stratégique, formulations mécanistes, classement, annotations citables, « la forme des notes n'est pas un comportement », placement de `rationale`. | `f645836` |
| UI       | L'inspecteur trie les lectures par rang, signale la lecture principale et affiche le mécanisme et la prédiction.                                                                                      | `f645836` |

Tests : 74 réussis, typecheck et build OK. Nouveaux tests : correction citable, accord sans promotion puis promotion après un nouvel épisode, plausible dès la création en D1 et D2, rang et mécanisme conservés, plafonds avec avertissements.

## 2. Lot de contrôle R3-S02

- **Corpus** : `packages/evaluation/fixtures/r3-blind-s02.json`, 7 scénarios avec de nouveaux prénoms.
- **Attentes** : scellées avant tout code (SHA-256 `621b3566…ade8e`, vérifié), publiées dans [R3-S02-attentes.md](../scelles/R3-S02-attentes.md).
- **Run** : `packages/evaluation/runs/2026-09-25-deepseek-flash-r3-s02`.
- **Exécution** : automatique, 7 scénarios en parallèle, environ 3 min 30. **10 analyses sur 10 appliquées, aucun rejet**.
- **Avertissements du moteur** : 7 confiances ramenées, 1 statut ramené. Aucune tentative de promotion après l'accord.

| Scénario                | [L]                | [B]        | Interdits | Commentaire                                                                                                                                                                                             |
| ----------------------- | ------------------ | ---------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C01 Correction          | 4/4                | 2/2        | —         | L'auteur de l'annulation n'est pas attribué à A1 ; à A2, 3 claims et 1 événement citent la correction, utilisés en `contradicts` des lectures de retrait ; rien n'est promu                             |
| C02 Accord              | 2/3                | 2/2 (+n/e) | —         | D2 plausible dès A1 ; D3 jalousie/place privilégiée mécaniste avec alternatives ; aucune promotion à A2. La D4 mécaniste n'arrive qu'à A2 (0/1)                                                         |
| C03 Utilisateur         | 4,5/5              | 1/1        | —         | Évitement de la culpabilité, réparation après le refus, prédiction ; lecture stratégique côté Enzo (« ses demandes ne lui coûtent rien »). Observation discriminante sur les autres proches absente (½) |
| C04 Désaccord           | 4/4                | 1/1        | —         | Désaccord cité en `explicit_statement` ; alternative « style général de Nora » ; la lecture relation-spécifique redescend de plausible à draft, sans suppression                                        |
| C05 Classer             | 3/3                | 2/2        | —         | D2 « retard transcontextuel » de rang 1, plausible dès A1 ; lecture exécutive/TDAH (non clinique) contre lecture « coût d'entrée » ; un seul rang 1 par paire d'alternatives                            |
| C06 Forme des notes     | 1,5/2              | —          | —         | Pas d'inférence tirée de la datation, mais une D4 « hyperactivation de l'attachement » sur l'utilisateur à partir de deux relances ordinaires (sur-lecture, ½)                                          |
| C07 Lecture stratégique | 7,5/8              | —          | —         | Boucle protestation–retrait–réparation ; « l'annulation obtenue valide le signal » ; prédictions et conditions ; part de l'utilisateur sans le blâmer. Lecture de Jade en D3 au lieu de D4 (1,5/2)      |
| **Total**               | **26,5/29 (91 %)** | **8/8**    | **aucun** |                                                                                                                                                                                                         |

## 3. Décision

| Critère scellé                                | Résultat      |
| --------------------------------------------- | ------------- |
| Aucun interdit violé sur C01, C02, C04 et C06 | Rempli        |
| Points [L] ≥ 75 %                             | Rempli : 91 % |
| Points [B] exercés = 100 %                    | Rempli : 8/8  |

**R3 est validé en mode automatique (DeepSeek V4.1-Flash, prompt v4, contrat 1.3).** R3.9 est coché.

Une règle n'a pas été exercée : le blocage d'une promotion après un accord. Le modèle ne l'a pas tentée. Elle est prouvée par le test moteur dédié.

## 4. Constats et suites

1. **Le modèle conclut désormais.** Il classe ses lectures, passe en plausible dès la première passe en D1 et D2, écrit des formulations mécanistes presque systématiques dès D3, avec des prédictions testables. Les lectures stratégiques (ce que la répétition récompense) apparaissent spontanément (C03, C07).
2. **Il sur-lit encore l'utilisateur.** Il tire des lectures d'attachement de gestes ordinaires (C06), ou fait de sa correction une stratégie (C01). La règle 8 du prompt a supprimé l'inférence tirée de la forme des notes, pas cette tendance. À traiter dans le prompt v5 : une lecture sur l'utilisateur exige un acte, une parole ou un ressenti exprimé **qui sorte de l'ordinaire**, sinon on pose une question.
3. **Doublons de sources d'annotation.** Un désaccord qui vise plusieurs hypothèses crée une source par hypothèse (C04 : 3 sources identiques). Le comptage n'est pas faussé, puisque l'empreinte est identique, mais le paquet est encombré. À dédoublonner.
4. **Profondeur de Jade.** L'attachement est rangé en D3 plutôt qu'en D4. La frontière D3/D4 (motif ou attachement contre structure) reste à préciser dans le prompt.
5. **Suite** : relation, rôles et indicateurs (R4.0a à R4.0e), puis registre ontologique (R4.0d) et graphe R4.
