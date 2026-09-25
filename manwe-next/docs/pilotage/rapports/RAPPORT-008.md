# RAPPORT-008 — Clôture de R4 : graphe vivant, preuves, synthèse et resynchronisation

25 septembre 2026. Travail autonome de nuit, sur la branche `claude/happy-knuth-om3xdo`. Aucun appel à DeepSeek : rien de ce qui est envoyé au modèle n'a changé. Le prompt `analyst-v6.md` est resté identique octet pour octet, et le paquet de contexte n'a pas changé.

## Livré

| Point | Ce qui existe                                                                                                                                                                                                        | Preuve                                                                    |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| R4.0d | `vocabulary.ts`, source unique des valeurs ; `analyst-v6.md` = rendu exact de `analyst.template.md` ; les liens du graphe respectent `LINK_TYPES` ; les contraintes CHECK du stockage correspondent aux vocabulaires | `tests/ontology.test.mjs` (échec vérifié sur un lien volontairement faux) |
| R4.3  | Graphe du mode personnel (`WorldGraph.tsx`) avec la sémiologie des thèmes : plein, tirets, pointillé, double trait qui tremble selon la confiance, gris « ? »                                                        | `tests/graph-layout.test.mjs`, captures                                   |
| R4.4  | Positions ancrées d'une révision à l'autre ; zoom sémantique Essentiel / Détails sans déplacement ; transitions ; sélection conservée                                                                                | `tests/graph-layout.test.mjs`                                             |
| R4.5  | « Pourquoi ? » : extrait exact, épisode et date de chaque élément ; « Corriger », « Contester » et « Ajouter du contexte » créent des annotations citables                                                           | `tests/graph-evidence.test.mjs`, contrôle navigateur                      |
| R4.6  | Synthèse déterministe, sans phrase générée, calculée sur le même instantané que le graphe et datée par sa révision ; mention « recalcul en cours » quand elle est en retard                                          | `tests/synthesis.test.mjs`                                                |
| R4.7  | `GET /api/status` ; vérification de la révision toutes les 4 s, au retour du focus et du réseau ; état de reconnexion ; mode réel des analyses affiché en texte                                                      | `tests/sync-labels.test.mjs`, `scripts/ui-check-sync.mjs`                 |
| R4.8  | axe-core (WCAG 2 A/AA) sans violation ; contrastes calculés ; clavier (Tab, Entrée, Échap) ; aucun contenu réservé au survol                                                                                         | audit décrit dans la ROADMAP                                              |

## Critère de passage de R4

Deux contrôles navigateur reproductibles, sur des copies des données réelles du lot R4-S02 :

1. **Changer de personne ne laisse aucun texte du scénario précédent.** `node scripts/ui-check-r4.mjs`, scénario Q03 : on passe de Sarah à Tom. Les deux lectures propres à Sarah ne restent ni dans le graphe, ni dans la fiche, ni dans la synthèse.
2. **Une correction est visible de façon cohérente dans toutes les surfaces.** Même script : un élément corrigé depuis le graphe apparaît comme tel sur le nœud, dans « Pourquoi ? » et dans la page Mémoire, et il sort des faits établis de la synthèse. Le contrôle a révélé deux défauts, corrigés avant la clôture :
   - la liste « Propositions appliquées » n'indiquait pas la correction ;
   - un libellé tutoyait (« contesté par toi ») alors que l'application vouvoie.
     Les trois surfaces partagent désormais la constante `CORRECTED_LABEL`.
3. **Un événement manqué ne désynchronise pas le graphe.** `node scripts/ui-check-sync.mjs` :
   - une écriture depuis un autre onglet apparaît sans recharger la page (révision 05 → 06) ;
   - la coupure du service est affichée ;
   - une écriture faite pendant la coupure est récupérée à la reconnexion (révision 07, graphe et synthèse compris).

**Décision proposée.** R4 est validé : tous les points sont cochés et le critère de passage est vérifié. 88 tests passent, la vérification des types aussi.

## Limites et alternatives

- **Démonstration.** Elle garde son graphe fixe. Seul le mode personnel utilise les projections.
- **Thèmes.** Les couleurs viennent de la palette actuelle de l'application. Les thèmes de l'utilisateur (Collage, Jewel case, gravure claire, Cendre) ne sont pas encore appliqués. Deux options :
  - des jetons CSS par thème, avec un sélecteur ;
  - choisir d'abord un thème par défaut avec l'utilisateur.
- **Resynchronisation.** Elle interroge le service toutes les 4 s. Une alternative serait un flux d'événements du service (SSE), plus économe mais plus complexe. L'interrogation suffit pour une application locale.
- **Disposition.** Les anneaux sont déterministes. Au-delà de 7 relations et 5 lectures, le schéma est allégé et il faut recentrer. Un placement par forces est écarté : il déplace les nœuds sans raison (R4.4).
- **Contrôles navigateur.** Ils exigent Playwright et Chromium, présents dans l'environnement cloud mais pas déclarés comme dépendances du projet.
