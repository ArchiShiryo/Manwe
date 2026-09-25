# Run DeepSeek V4.1-Flash sur le corpus R3-S01

25 septembre 2026. Même corpus, même moteur et même prompt (analyst-v3) que le run assisté `2026-09-24-blind-r3-s01` (« GPT-5.6 Sol »). Exécution entièrement automatique (`scenario-run.mjs auto`, effort `high`, 10 scénarios en parallèle, environ 4 minutes).

Les attentes R3-S01 étaient déjà publiées au moment du run. Le modèle ne les a jamais reçues, mais ce run sert de **comparaison**, pas de validation.

## Réception

- S02-A1 : rejetée deux fois (`unknown_field`, un champ `rationale` placé dans le `payload` d'une question). C'est une erreur de format du modèle.
- S04-A2 : rejetée deux fois (`operation_not_allowed`). S06-A2 : rejetée deux fois (`invalid_citation`). Même cause que RAPPORT-003 §4.2 : une annotation (correction, désaccord) n'est pas citable, et le modèle veut en tirer une affirmation.
- Tous les autres appels sont appliqués.

## Première lecture, comparée à Sol

- **Plus direct sur les constructs** : « traits de personnalité limite » (S07, en confiance low, avec l'alternative de deuil), « traits narcissiques » (S02, avec les alternatives d'hypervigilance au rejet et de norme organisationnelle), « attachement anxieux » (S05, S09). Il n'y a aucune timidité.
- **Confiances plus prudentes** : pas de `high` sur S09.
- **Tendance à psychologiser l'utilisateur** à partir du simple fait qu'il date et consigne ses notes (S01, S04, S06, S08, S10). Le modèle attribue au dispositif de test une signification personnelle. À corriger dans le prompt v4 : la forme des notes n'est pas un comportement de l'utilisateur.
- **S05** : même promotion en `plausible` juste après l'accord qu'avec Sol. Le constat moteur de RAPPORT-003 §4.1 est confirmé.
- **S10** : il retourne la question vers les défenses de l'utilisateur (« classer l'autre pervers narcissique préserve l'estime de soi »). C'est audacieux et cohérent avec le mode capacité maximale, mais cela ne repose que sur un seul épisode ; toutes ces lectures restent en draft/low.
