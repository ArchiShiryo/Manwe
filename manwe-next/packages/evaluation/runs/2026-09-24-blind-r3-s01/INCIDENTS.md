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
