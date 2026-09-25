# BRIEF-003 — Faire conclure le moteur, rendre les annotations citables

25 septembre 2026. Rédigé et réalisé par le pilote (D-011) à partir du [RAPPORT-003](../rapports/RAPPORT-003.md) et des décisions D-015, D-017 et D-019. Clôture : [RAPPORT-004](../rapports/RAPPORT-004.md).

## Objectif

Corriger les défauts relevés par le lot R3-S01 et faire passer le moteur de l'énumération à la conclusion, sans affaiblir la discipline épistémique.

## Périmètre

1. **F1, annotations citables** : une correction, un contexte ou un désaccord crée une source et une note citables, reprises dans les paquets. L'accord reste non citable.
2. **F2, pas de promotion après un accord** sans nouvel épisode ancré. Le moteur ramène la demande et émet un avertissement.
3. **F3, plafonds avec avertissement** : `high` est réservé à D1 et D2 ; une confiance ou un statut non permis est ramené au lieu de faire rejeter la réponse.
4. **F4, contrat 1.3** : `status` à la création (plausible effectif en D1 et D2), `rank`, `revise.rank` ; `propose_event` permis en révision.
5. **F5, formulation mécaniste** : champ `mechanism` et migration 007.
6. **F6, prompt `analyst-v4`** : mission, lecture stratégique, formulations mécanistes, classement, citation des annotations, forme des notes, placement de `rationale`.
7. **Interface** : rang et mécanisme dans l'inspecteur.

## Validation

Le lot de contrôle R3-S02 (7 scénarios) a été scellé avant le code et joué automatiquement avec DeepSeek V4.1-Flash. Seuil : aucun interdit violé sur C01, C02, C04 et C06, au moins 75 % des points [L], 100 % des points [B] exercés.
