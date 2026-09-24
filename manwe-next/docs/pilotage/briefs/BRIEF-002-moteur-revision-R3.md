# BRIEF-002 — Moteur de révision (R3, première partie)

Émis le 24 septembre 2026 par le pilote (Claude). Exécutant : ChatGPT. Relais : utilisateur.

**Pré-requis :** BRIEF-001 livré et accepté par le pilote (contrat 1.1, harnais d'évaluation). Ne commence pas avant la revue REVUE-001. Pars de la branche que le pilote indiquera dans cette revue.

## Pourquoi ce lot compte

Jusqu'ici, MANWË se souvient. Avec R3, il commence à **interpréter**, et cela à toutes les profondeurs : de la surface jusqu'aux formulations psychodynamiques, d'attachement ou de trouble de la personnalité (borderline, narcissique, codépendance…). Nous sommes en développement : le système déduit tout ce qu'il peut déduire. On émondera plus tard, pas maintenant. Sa force tient à ce que chaque déduction reste vérifiable. Une hypothèse doit toujours :

- montrer ce qui l'appuie et ce qui la contredit, jusqu'aux extraits source ;
- compter ses preuves honnêtement (un même épisode ne vaut qu'une fois) ;
- déclarer sa profondeur (D1 à D5) et, le cas échéant, le cadre clinique ou théorique mobilisé ;
- être confrontée à une explication concurrente dès qu'elle touche aux motifs, à l'attachement ou à la personnalité ;
- céder devant une correction de l'utilisateur, sans que son simple accord en fasse un fait.

## Décisions du pilote qui cadrent ce lot

Elles sont inscrites dans [PILOTAGE.md](../PILOTAGE.md), décisions D-006 à D-009. Résumé :

- **D-006 (révisée) — Toutes les profondeurs, avec une exigence de preuve croissante.** Profondeurs de la spécification (§19.0) : `D1` surface, `D2` schéma relationnel, `D3` motifs, besoins, valeurs, attachement, `D4` formulation psychodynamique ou de personnalité (y compris les constructs cliniques : trouble borderline, narcissique, codépendance…), `D5` groupe, champ, planification. **Aucune profondeur n'est refusée.** L'exigence de preuve augmente avec la profondeur (spécification §4.4 à 4.5) :
  - `D3` et plus : une alternative incompatible est obligatoire (divergence forcée) ;
  - `D4` : le statut `plausible` exige au moins 3 épisodes indépendants ancrés et répartis dans le temps. En dessous, l'hypothèse existe, est affichée et utilisée comme **exploratoire** (`draft`), mais ne pilote pas encore le conseil.
- **D-007 — Preuves et indépendance.** Une hypothèse relie des claims existants avec une position `supports` ou `contradicts`. Elle ne cite jamais une autre hypothèse, ce qui empêche les cascades d'inférences par construction. L'unité d'indépendance est l'épisode de l'événement lié à la source du claim. Sans épisode, c'est le `contentHash` de la source : deux copies du même texte comptent une seule fois. Un claim `inference` peut figurer comme preuve, mais ne compte jamais comme **ancrage direct**.
- **D-008 — Effets des annotations humaines.** Ils sont déterministes et appliqués par le backend, pas par le LLM (voir T3).
- **D-009 — Organisation du code.** Les règles de révision sont des **fonctions pures** dans `packages/cognition/src/revision.ts`, testables sans SQLite. `sqliteStore.ts` (environ 1 800 lignes) ne doit pas grossir de plus d'environ 200 lignes : les nouveaux accès SQL vont dans un module séparé `packages/storage/src/hypothesisStore.ts` (ou un nom équivalent), composé par le store.

## Tâches

### T1 — Schéma (migration 005)

1. Reconstruis `hypotheses` : SQLite ne permet pas de modifier une contrainte `CHECK`, il faut donc une table neuve, une copie des données et une bascule dans une seule transaction. Colonnes ajoutées :
   - `depth` (`D1` à `D5`) ;
   - `framework` (texte nullable : cadre mobilisé, par exemple « psychodynamique », « attachement », « DSM-5 / CIM-11 ») et `construct` (texte nullable : par exemple « fonctionnement borderline », « codépendance ») ;
   - `confidence` (`low` | `moderate` | `high`), qualitative et plafonnée par le backend selon les preuves (T2) ;
   - `status` (`draft` | `plausible` | `contradicted` | `superseded`) ;
   - `needs_review` (0/1), `review_reason`, `review_since_revision` ;
   - `limits`, `revision_conditions`, `valid_from`, `valid_to` ;
   - `alternative_to` (id nullable, même espace de travail).
     L'ancien `review` devient `draft` avec `needs_review = 1`.
2. Crée `hypothesis_subjects(hypothesis_id, person_id)`.
3. Crée `hypothesis_evidence(hypothesis_id, claim_id, stance CHECK IN ('supports','contradicts'), added_revision)` avec la clé primaire `(hypothesis_id, claim_id)`. Une preuve n'est jamais supprimée : elle peut seulement être marquée `superseded_revision`.
4. Ajoute `claims.contested_revision` (nullable), renseigné par une correction factuelle (T3).
5. `open_questions` : statuts `open` | `answered` | `unknown` | `dismissed`, plus les colonnes `targets_json`, `discriminating_info`, `why_now`, `normalized_text`, `answer_source_id`.
6. Complète la contrainte des `command_type` de révision avec `question.answer` si le mécanisme actuel l'exige. Vérifie comment `revisions_v3` gère cette contrainte avant de choisir.

Test : une base 004 avec des hypothèses `review` migre sans perte.

### T2 — Règles pures (`revision.ts`)

Fonctions sans effet de bord, chacune avec ses tests unitaires :

- `independentUnits(evidence, lookup)` : les unités d'indépendance favorables et contraires (D-007).
- `directAnchorCount(...)` : le nombre d'unités favorables portées par au moins un claim non `inference` et non contesté.
- `allowedStatus(hypothesis, evidence)` : les statuts autorisés.
  - `plausible` exige au moins 1 unité ancrée pour `D1`, 2 pour `D2` et `D3`, et 3 pour `D4` et `D5`. Pour `D4`, ces unités doivent aussi porter au moins 2 dates distinctes (répartition dans le temps).
  - `D3` et plus : `plausible` exige aussi qu'une alternative active existe.
  - `plausible` est interdit s'il existe une preuve contraire ajoutée après la dernière révision de l'hypothèse et non encore examinée.
  - `contradicted` exige au moins une preuve contraire ancrée.
- `maxConfidence(hypothesis, evidence)` : `low` toujours autorisé ; `moderate` à partir de 2 unités ancrées ; `high` à partir de 3 unités ancrées, sur au moins 2 dates, sans preuve contraire non examinée. Une confiance déclarée au-dessus du plafond est rejetée (`confidence_not_supported`).
- `dependentHypotheses(changedRef, graph)` : les hypothèses dont une preuve dépend d'un claim, d'une source ou d'un événement modifié ou annoté.
- `isDuplicateQuestion(candidate, existing)` : compare le texte normalisé (casse, accents, ponctuation, espaces) et le même ensemble de cibles. Une question `dismissed`, `unknown` ou `answered` ne peut pas être reposée à l'identique.

### T3 — Effets des annotations (D-008)

Au moment de l'annotation, dans **la même transaction** :

| Type sur la cible                                             | Effet                                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `factual_correction` sur un claim, un événement ou une source | Les claims concernés reçoivent `contested_revision`. Un claim contesté ne compte plus comme ancrage. Les hypothèses dépendantes passent `needs_review = 1` (motif : correction). Si l'une d'elles était `plausible` et ne remplit plus la règle, elle redescend à `draft`. |
| `context`                                                     | Les hypothèses dépendantes passent `needs_review = 1` (motif : contexte ajouté). Aucun comptage ne change.                                                                                                                                                                 |
| `disagreement` sur une hypothèse                              | L'hypothèse passe `needs_review = 1` (motif : désaccord). La prochaine révision devra fournir une alternative ou une justification (T4).                                                                                                                                   |
| `agreement`                                                   | Enregistré, et **rien d'autre** : aucune preuve, aucun changement de statut, aucune révision d'hypothèse.                                                                                                                                                                  |

Le LLM ne peut jamais lever une contestation posée par l'utilisateur. Il peut seulement proposer de nouveaux claims tirés de la correction elle-même.

### T4 — Contrat 1.2 : trois nouvelles opérations

Mets à jour le parseur strict, le validateur, l'application transactionnelle, `COGNITION_V1.md` (encadré « Changements 1.2 ») et le prompt analyste. Le prompt analyste devient `analyst-v3.md`, qui ajoute les règles R3. Le pilote relira le texte de ce prompt avant le premier usage. `analyst-v2.md` reste inchangé.

- **`propose_hypothesis`** (tâches `interpret` et `revise`)
  - Payload : `statement`, `depth`, `framework`, `construct`, `confidence`, `subjects` (références de personnes), `evidence` (`[{ claim: ref, stance }]`, au moins 1 `supports`), `limits`, `revisionConditions`, `alternativeTo` (référence existante, `proposalKey` ou `null`), `validFrom`/`validTo`.
  - Règles : aucune limite de nombre côté backend (la vue choisira quoi afficher, R4). À partir de `D3`, une alternative incompatible est **obligatoire** (dans la même proposition ou déjà existante), sinon `alternative_required`. `framework` et `construct` sont obligatoires pour `D4` (`framework_required`). Le statut initial est toujours `draft`, la confiance initiale au plus celle permise par `maxConfidence`.
- **`revise_hypothesis`** (tâche `revise`)
  - Payload : `target`, `expectedRowVersion`, `status`, `addEvidence`, `rationale`.
  - Le backend vérifie `allowedStatus`, sinon `status_not_allowed`. Une version obsolète donne `stale_object`.
  - Appliquer cette opération remet `needs_review = 0`. Si le motif était un désaccord, il faut soit une alternative existante, soit ajouter une preuve contraire, soit passer à `superseded` ; sinon `disagreement_unaddressed`.
  - Aucune preuve n'est retirée, aucune annotation n'est touchée.
- **`propose_question`** (tâches `interpret`, `revise`, `explore`)
  - Payload : `question`, `targets` (au moins 1 hypothèse), `discriminatingInfo`, `whyNow`.
  - Règles : au plus 1 question `open` par ensemble de sujets. Un doublon est rejeté (`duplicate_question`).

`ContextPacket` inclut désormais, pour le focus : les hypothèses avec leurs preuves, leurs comptages (unités, ancrages), `needs_review` et son motif, les annotations, ainsi que les questions ouvertes **et** récemment closes, pour éviter les relances identiques.

### T5 — Réponse aux questions et demande de réanalyse

- Nouvelle commande `answerQuestion` (route `POST /api/questions/:id/answer`), avec trois choix :
  - **Réponse libre** : elle devient une source de type `answer`, capturée comme un récit. Les hypothèses ciblées passent `needs_review` (motif : réponse).
  - **« Je ne sais pas »** : statut `unknown`, aucun autre effet.
  - **« Ne plus poser »** : statut `dismissed`.
- Réanalyse limitée (R3.6) : pour une hypothèse `needs_review`, « Préparer la réanalyse » crée une demande `revise` dont le focus contient **uniquement** cette hypothèse, ses preuves et les annotations qui ont déclenché la réanalyse. Rien n'est lancé automatiquement : l'affichage reste « À réexaminer » jusqu'à l'application d'une réponse validée.

### T6 — Inspecteur (strict minimum, le graphe est prévu pour R4)

Dans l'espace personnel, l'inspecteur d'une hypothèse affiche :

- l'énoncé, la profondeur en clair (« surface », « schéma relationnel », « motifs / attachement », « personnalité / psychodynamique », « groupe / champ »), le cadre et le construct éventuels, la confiance et le statut ; une hypothèse `draft` de profondeur D4 est marquée **« Exploratoire »** ;
- le badge **« À réexaminer »** avec son motif ;
- les preuves **pour** et **contre**, chacune avec son extrait source cliquable et sa catégorie ou modalité ;
- le nombre d'épisodes indépendants et d'ancrages directs ;
- l'alternative, les limites et les conditions de révision ;
- l'**historique** : quelle révision a changé quoi, et à cause de quelle information.

Pour une question : les trois boutons de T5. Tout doit rester accessible au clavier, sans dépendre du survol.

## Tests exigés (critères de passage R3 de la roadmap)

1. Une preuve contraire ajoutée affaiblit : `plausible` n'est plus autorisé, et l'hypothèse passe à réexaminer.
2. Une correction factuelle sur une preuve fait redescendre l'hypothèse ; son effet survit à un redémarrage.
3. « Je suis d'accord » n'ajoute aucune unité de preuve et ne change aucun statut.
4. Une réponse arrivée tardivement (révision de base antérieure à la correction) est rejetée et ne restaure pas la conclusion invalidée.
5. Trois claims tirés d'un même épisode, ou deux copies d'un même message, comptent pour 1 unité.
6. Une hypothèse appuyée seulement sur des inférences ne peut pas devenir `plausible`.
7. Une hypothèse `D4` (par exemple « fonctionnement borderline ») est **acceptée** en `draft` avec 1 épisode, mais `plausible` lui est refusé tant qu'elle n'a pas 3 épisodes indépendants sur 2 dates. Une hypothèse `D3` ou `D4` sans alternative est rejetée. Une confiance `high` avec 1 seul épisode est rejetée.
8. Une question identique à une question `dismissed` est rejetée. « Je ne sais pas » ne change rien d'autre.
9. `revise_hypothesis` qui tente d'ignorer un désaccord est rejeté.
10. Une erreur au milieu de l'application ne laisse aucune mutation partielle, que ce soit pour une hypothèse, ses preuves ou son drapeau de révision.

## Hors périmètre

- La passe critique ciblée (R3.4) et l'évaluation à l'aveugle de R3 : ce sera le BRIEF-003, et le pilote prépare le corpus.
- Le graphe (R4), les objectifs et directions (R5), Tauri, le fournisseur automatique.
- Le modèle d'intervention du conseiller (Counselor) et son seuil d'action : c'est un lot ultérieur. Ce lot produit les hypothèses, il n'agit pas.

## Contraintes

Ce sont celles du BRIEF-001, qui restent valables : pas de case de roadmap cochée, pas de retouche de réponses brutes, idiome existant, aucune donnée réelle. Toute consigne qui te paraît fausse va dans « Questions pour le pilote » : ne l'arbitre pas seul.

## Critères d'acceptation, vérifiés par le pilote

- `npm ci && npm run typecheck && npm test && npm run build` passe.
- Les 10 tests ci-dessus existent, sont nommés et passent.
- `revision.ts` n'importe ni SQLite ni `node:*`.
- `sqliteStore.ts` grossit au plus d'environ 200 lignes.
- Parcours manuel décrit dans le rapport, avec captures d'écran si possible :
  1. créer un claim puis une hypothèse à partir de propositions assistées ;
  2. la contester ;
  3. voir « À réexaminer » ;
  4. redémarrer ;
  5. constater que l'état est intact.

## Rapport attendu

Dépose `docs/pilotage/rapports/RAPPORT-002.md`, au même format que le RAPPORT-001.
