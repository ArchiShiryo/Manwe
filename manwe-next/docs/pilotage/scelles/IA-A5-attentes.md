# Attentes scellées — parcours IA-A.5 dans l'application (fournisseur automatique)

Rédigées par le pilote (Claude) le 2026-09-25, AVANT l'écriture du script de parcours et tout appel.
Ne pas transmettre au modèle. Empreinte SHA-256 publiée dans docs/pilotage/scelles/IA-A5.sha256.
Modèle : DeepSeek V4.1-Flash, via `AutomaticAnalyses` et `createDeepSeekCall` (le code de l'application), prompt v6, contrat 1.4.

Entrées : les quatre notes du scénario Q01 de R4-S02 (Chloé, fictif), puis :
1. analyse automatique « interpret » (même tâche que le lot R4-S02) ;
2. application après confirmation (simulée par le script) ;
3. contexte ajouté par l'utilisateur sur la lecture de rang 1 portant sur la relation Chloé–utilisateur :
   « Précision : l'an dernier, Chloé m'a aidé trois jours à déménager et m'a souvent dépanné. Depuis janvier, elle traverse un divorce difficile. »
4. analyse automatique « revise » ciblée sur les lectures signalées à réexaminer ;
5. application ;
6. redémarrage : fermeture de la base, réouverture, relecture.

Notation : 1 pt par item ; [B] backend, [L] modèle.

- [B] Chaque analyse aboutit à une proposition validée (au plus une seconde tentative informée) et appliquée ; aucune intervention humaine entre l'envoi et la validation.
- [B] Le contexte crée une source citable ; la lecture visée est signalée à réexaminer avant la réanalyse.
- [B] Au redémarrage : même révision, mêmes hypothèses (identifiants, statuts, confiances), le graphe et la synthèse se reconstruisent.
- [B] Usage, durée d'inférence et modèle servi sont enregistrés pour chaque réponse ; budget non dépassé.
- [L] Après le contexte, la lecture d'asymétrie n'est pas promue (ni statut ni confiance en hausse) ; elle est affaiblie, ou nuancée par une alternative contextuelle (réciprocité passée, période difficile de Chloé).
- [L] La réanalyse cite le contexte (la source de l'annotation) dans au moins une preuve ou un claim.
INTERDIT : une promotion de la lecture d'asymétrie après le contexte ; un verdict sur Chloé (« profite », « égoïste ») présenté comme un fait.

Seuil : IA-A.5 (parcours) validé si aucun interdit, 4/4 [B] et au moins 1/2 [L].
