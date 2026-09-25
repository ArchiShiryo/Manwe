# Incidents du run R3-S01

Ce journal liste les corrections du harnais et du moteur faites pendant l'évaluation à l'aveugle. Le prompt et les règles de révision n'ont pas changé. Aucune réponse brute n'a été retouchée.

## 1. Référence d'alternative vers l'avant (commit a1388fa)

- **Symptôme.** S01 et S03 ont été rejetées avec `unknown_proposal_key`. Une hypothèse désignait comme alternative, via `alternativeTo`, une autre hypothèse proposée plus loin dans la même réponse.
- **Cause.** Un défaut du moteur : il résolvait les clés en un seul passage. Le contrat autorise pourtant ces références.
- **Correction.** Ces liens sont résolus après toutes les créations (`context.links`).
- **Reprise.** S01 et S03 ont été remises à leur état préparé, puis leurs réponses brutes, inchangées, ont été rejouées.

## 2. Rejet clos sans seconde tentative (25 septembre 2026)

- **Symptôme.** Quand la première réponse d'une analyse était rejetée et qu'aucune `proposal.retry.raw.json` n'existait encore, `advance` fermait l'étape et passait à la suite. S08-A1 et S04-A2 ont été touchées :
  - S08 a préparé S08-A2 sans la seconde tentative de S08-A1 ;
  - S04 a été déclaré terminé.
- **Correction.** Une analyse rejetée à la première tentative reste en attente. Le reçu regroupe les deux essais. La commande `rewind` ramène une étape close à tort par l'ancien comportement.
- **Reprise.**
  - S08-A1 a été ramenée en arrière, puis sa seconde tentative a été appliquée. S08-A2 a été régénérée : l'ancien prompt S08-A2 n'est plus valable.
  - S04-A2 a été ramenée en arrière. Elle attend sa seconde tentative (premier rejet : `invalid_citation`, une claim envoyée avec `"citations": []`).

## 3. Réponses collées entremêlées (25 septembre 2026)

- **Symptôme.** Au tour 3, les réponses S04-A2 (seconde tentative) et S08-A2 ont été collées ensemble : S08-A2 se trouvait au milieu de S04-A2, juste après `"payload": {` de l'opération `q2`.
- **Traitement.** Les deux réponses ont été séparées à leurs limites exactes, sans rien modifier d'autre : S08-A2 va de son accolade ouvrante à son accolade fermante, et S04-A2 est ce qui reste de part et d'autre. Le collage d'origine est conservé hors du dépôt. S04-A2 reconstituée est un JSON valide, ce qui confirme la découpe.
- **S08-A2.** Rejetée (`invalid_json`). Son résumé contient un artefact de l'interface ChatGPT, `:chatgpt-content-reference{index="0"}`, dont les guillemets ne sont pas échappés. La seconde tentative est demandée.

## 4. Constat moteur : une correction n'est pas citable (S04-A2)

- **Symptôme.** Les deux tentatives de S04-A2 sont rejetées pour `invalid_citation`. Les deux fois, le modèle propose une claim « l'utilisateur a annulé le week-end » avec `"citations": []`.
- **Cause.** Un défaut du moteur, pas une erreur du modèle. La correction factuelle de l'utilisateur (« c'est moi qui ai annulé le week-end à la mer, pas Inès ») n'existe que comme annotation. Elle ne figure pas parmi les `sources` du paquet, donc aucune citation exacte n'est possible. À l'inverse, une réponse à une question crée bien une source et un événement.
- **Décision.** Le moteur n'est pas modifié pendant le run. S04-A2 est notée comme rejetée, avec cette cause. La correction est reportée à BRIEF-003 : une correction factuelle créera une source citable, comme une réponse.

## 5. Artefact d'interface ChatGPT : correction du harnais (25 septembre 2026)

- **Symptôme.** La seconde tentative de S08-A2, obtenue dans une conversation neuve avec le texte collé, contient à nouveau `:chatgpt-content-reference{index="0"}` à la fin de son résumé. L'artefact est donc systématique ; il ne dépend pas du modèle.
- **Correction.** Le harnais retire ce seul marqueur, connu, avant de lire la réponse. Les fichiers bruts restent intacts, et le reçu indique `"normalized": ["chatgpt-content-reference"]`. Un test couvre ce cas.
- **Reprise.** Les tentatives sont lues dans l'ordre : la première réponse de S08-A2, désormais lisible, a été appliquée. La seconde tentative reste archivée sans avoir été utilisée.
