# Reprise du projet MANWË

Ce document permet à une nouvelle instance (Claude ou autre) de reprendre le pilotage **sans l'historique des conversations**. Tenu à jour à chaque étape importante. Dernière mise à jour : 25 septembre 2026.

## 1. Le projet en cinq phrases

1. MANWË est une **prothèse de cognition sociale** personnelle et locale. Elle modélise le monde dans lequel évolue l'individu (personnes, relations, groupes, lui-même), prédit, identifie les leviers et trace un chemin. Le diagnostic n'est pas le but (D-018).
2. L'utilisateur, propriétaire du projet, en est le premier utilisateur. Le projet est **confidentiel** (D-005) : c'est son « cadeau aux neuro-atypiques », qui ne doivent pas être traités comme des personnes handicapées.
3. **Mode développement à capacité maximale** (D-006, D-010) : le système produit tout ce qu'il peut inférer, y compris les lectures profondes (attachement, psychodynamique, borderline, narcissique, codépendance). On émondera plus tard, pas pendant le développement.
4. **Discipline épistémique** : tout est sourcé par une citation exacte. Observé, rapporté, impression, déclaration et inférence restent distincts. Chaque lecture profonde a de vraies alternatives. L'accord de l'utilisateur n'est jamais une preuve.
5. **Principes centraux** :
   - le joueur est rationnel, c'est le jeu qui ne l'est pas : chaque comportement est un minimum local d'un coût (D-017, [MODELE-STRATEGIQUE.md](./MODELE-STRATEGIQUE.md)) ;
   - la psychodynamique fine, faite de formulations mécanistes plutôt que d'étiquettes, est ce qui permet d'agir (D-019).

## 2. Rôles et façon de travailler

- **Utilisateur** : propriétaire et décideur. Il écrit en français et attend des points d'étape clairs (« où on en est »). Quand il **discute**, on discute : on n'écrit rien dans le dépôt sans son accord explicite. Quand il dit « met à jour » ou « vas-y », on agit.
- **Pilote** : Claude. Il conçoit, code (D-011), évalue et documente. Toutes les décisions sont consignées dans [PILOTAGE.md](./PILOTAGE.md) (D-001 et suivantes).
- **Modèle analyste** : DeepSeek V4.1-Flash via l'API, en mode automatique (D-020). ChatGPT (« GPT-5.6 Sol ») a servi en mode assisté jusqu'à R3-S01.
- **Branche de travail** : `claude/happy-knuth-om3xdo`, dépôt privé `archishiryo/manwe`. Pas de pull request sans demande.
- Les messages de commit sont en anglais. La documentation est en français.

## 3. Où en est le projet

| Jalon                   | État                                                                                                                                                                    |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R0, R1                  | Faits : mémoire locale SQLite, journal, recherche                                                                                                                       |
| R2                      | Validé en mode assisté ([RAPPORT-001](./rapports/RAPPORT-001.md))                                                                                                       |
| R4.0a-c, relations      | Livré, non validé : [RAPPORT-005](./rapports/RAPPORT-005.md)                                                                                                            |
| R3, moteur de révision  | **Validé en mode automatique** (DeepSeek V4.1-Flash, prompt v4, contrat 1.3) : [RAPPORT-004](./rapports/RAPPORT-004.md), après [RAPPORT-003](./rapports/RAPPORT-003.md) |
| IA-A, raccordement auto | En cours : évaluations automatiques DeepSeek opérationnelles (D-020) ; intégration dans l'application à faire                                                           |
| R4 et suivants          | À faire                                                                                                                                                                 |

**BRIEF-004 livré** (relation comme objet, rôles d'épisode cités, indicateurs relationnels, contrat 1.4, prompt v5) mais **pas encore validé** : sur le lot R4-S01, R01 et R03 sont justes, mais R02 a été perdu à cause d'erreurs de format du modèle ([RAPPORT-005](./rapports/RAPPORT-005.md)). La correction est faite (D-021 : seconde tentative informée de l'erreur).

**Prochaine étape** : (les relations et leurs indicateurs s'affichent dans l'inspecteur depuis le 25 septembre) R4.0e est validé ; prochain chantier : le registre ontologique (R4.0d) et le graphe R4. La sur-lecture de l'utilisateur est corrigée par le prompt v6 ([RAPPORT-007](./rapports/RAPPORT-007.md)). La pull request [ArchiShiryo/Manwe#1](https://github.com/ArchiShiryo/Manwe/pull/1) attend d'être fusionnée dans `main`.

**Méthode à conserver pour chaque lot** :

1. écrire et sceller les attentes d'un lot de contrôle **avant** de coder ;
2. coder et tester ;
3. jouer le lot avec `scenario-run.mjs auto` ;
4. noter, écrire le rapport et mettre à jour ce document.

## 4. Carte du dépôt

| Chemin                                           | Contenu                                                                                 |
| ------------------------------------------------ | --------------------------------------------------------------------------------------- |
| `ROADMAP.md`                                     | Trajectoire R0 à R11, points d'exécution datés, cases cochées avec preuves              |
| `manwe-next/docs/pilotage/PILOTAGE.md`           | Rôles, protocole d'évaluation à l'aveugle, **registre des décisions**, suivi des briefs |
| `manwe-next/docs/pilotage/ONTOLOGIE.md`          | Couche ontologique (comparaison Palantir), manques                                      |
| `manwe-next/docs/pilotage/MODELE-STRATEGIQUE.md` | Finalité prédictive, lecture stratégique, psychodynamique fine                          |
| `manwe-next/docs/pilotage/briefs/`               | Cahiers des charges des lots de travail                                                 |
| `manwe-next/docs/pilotage/rapports/`             | Rapports de clôture et de notation                                                      |
| `manwe-next/docs/pilotage/scelles/`              | Empreintes SHA-256 des attentes, puis attentes publiées après notation                  |
| `manwe-next/docs/references/palantir/`           | Documentation publique de Palantir (référence pour l'ontologie et la phase téléréalité) |
| `manwe-current-docs/`                            | Spécification maître V3.0 et documents d'origine                                        |
| `manwe-next/packages/domain`                     | Types et commandes du domaine                                                           |
| `manwe-next/packages/storage`                    | SQLite, migrations 001 à 006, `hypothesisStore.ts` (moteur de révision)                 |
| `manwe-next/packages/cognition`                  | Contrat cognitif 1.2, `revision.ts` (règles pures), prompts (`analyst-v3.md`)           |
| `manwe-next/packages/evaluation`                 | Corpus (`fixtures/`) et runs versionnés (`runs/`)                                       |
| `manwe-next/scripts/scenario-run.mjs`            | Harnais multi-étapes : prepare, advance, auto, summary, rewind                          |
| `manwe-next/scripts/lib/deepseek.mjs`            | Client de l'API DeepSeek                                                                |
| `manwe-next/apps/server`, `apps/desktop`         | Service Node local (port 5181) et interface React (port 5180)                           |

## 5. Commandes

```sh
cd manwe-next
npm ci
npm test            # 75 tests au 25 septembre 2026
npm run typecheck
npm run dev         # interface http://127.0.0.1:5180, service :5181

# Évaluation multi-étapes, entièrement automatique avec DeepSeek :
node scripts/scenario-run.mjs prepare packages/evaluation/fixtures/<corpus>.json packages/evaluation/runs/<date>-<nom>
node scripts/scenario-run.mjs auto packages/evaluation/runs/<date>-<nom> [--model deepseek-flash] [--effort high|max] [--concurrency 10]
node scripts/scenario-run.mjs summary packages/evaluation/runs/<date>-<nom>
```

**Accès à DeepSeek** :

- **Dans une session cloud** : l'environnement porte un identifiant « DeepSeek » (type Bearer, site autorisé `api.deepseek.com`). Le proxy de la session ajoute la clé ; le code ne la voit jamais. Le script se relance seul avec `NODE_USE_ENV_PROXY=1` quand un proxy est présent.
- **Ailleurs** : définir `DEEPSEEK_API_KEY`.
- **Jamais de clé dans le dépôt ni dans la conversation.**
- Modèles disponibles : `deepseek-flash` (V4.1-Flash, **par défaut**, préféré par l'utilisateur) et `deepseek-v4-pro`.
- Un lot de 10 scénarios prend environ 4 minutes et environ 340 000 jetons, dont la moitié de raisonnement.

## 6. Protocole d'évaluation à l'aveugle (à respecter strictement)

1. **Écrire les attentes AVANT** d'implémenter ou de lancer quoi que ce soit : points [L] pour l'analyse, [B] pour le backend, interdits. Calculer le SHA-256 et publier seulement l'empreinte dans `scelles/`. Garder le fichier hors du dépôt jusqu'à la notation, et en remettre une copie à l'utilisateur.
2. Le modèle ne reçoit que le paquet de contexte (`PROMPT.txt`), jamais les attentes.
3. Les réponses brutes ne sont **jamais retouchées**. Une seule seconde tentative est permise, et elle doit être une nouvelle génération.
4. On ne modifie ni le moteur ni le prompt pendant un run, sauf un défaut de harnais, documenté dans `INCIDENTS.md` du run.
5. Noter contre les attentes, vérifier l'empreinte, publier les attentes et écrire le rapport. « Validé avec limite » ne peut pas masquer un critère manquant.

## 7. Pièges connus

- TypeScript est exécuté par suppression des types (type stripping) : **pas de propriétés de paramètre** dans les constructeurs.
- `node:sqlite` est encore expérimental : les avertissements sont normaux.
- `npx prettier --write` ne doit jamais toucher `packages/evaluation/runs/` ni `packages/cognition/prompts/` : ils sont protégés par `.prettierignore`.
- L'interface de ChatGPT insère `:chatgpt-content-reference{index="0"}`. Le harnais retire ce marqueur et le signale dans le reçu.
- Les bases de travail des runs sont dans `.qa/` (éphémère). Les copies versionnées `prepared.sqlite3` et `final.sqlite3` permettent de reprendre ailleurs.

## 8. Horizon

- **Test sur des scripts de téléréalité** une fois le système complet (roadmap §18.4) : nombreux acteurs, jeux explicites, prédictions vérifiables par les épisodes suivants.
- **Boucle d'action** (D-016) : objectif, pistes, action validée par l'utilisateur, résultat observé, comparaison entre prédiction et réalité.
- **Modèle stratégique à grande échelle** (groupes, normes, valeurs sacrées) ; simulateur calibré.
