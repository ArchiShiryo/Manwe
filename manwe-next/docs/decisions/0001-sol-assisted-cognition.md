# ADR 0001 — Sol comme LLM assisté pendant la réalisation

Date : 14 septembre 2026. Statut : décision de construction acceptée par la
demande utilisateur ; implémentation à réaliser. Remplace la priorité DeepSeek
de la roadmap 1.0, sans remplacer la vision produit.

Mise à jour : le point 3 ci-dessous est remplacé pour R1 par
[l'ADR 0002 — SQLite embarqué](./0002-embedded-sqlite.md), après inventaire des
prérequis réels du poste. Les autres décisions restent actives.

## Décision

Sol reprend la construction de `manwe-next` et produit temporairement les
analyses cognitives. Ces deux activités restent séparées :

- **Construction** : code, migrations, interfaces, tests et documentation.
- **Analyse** : lecture d'un paquet de contexte MANWË et remise d'une proposition
  JSON. Aucun changement de code, de fixture ou de ligne de base pour fabriquer
  le résultat attendu pendant ce tour d'analyse.

Le mode initial est un échange assisté de fichiers JSON. MANWË prépare une
demande ; Sol produit une réponse nouvelle ; le backend importe, prévisualise,
valide et applique les changements. Il n'existe pas de connexion automatique à
cette conversation. Aucune installation de fournisseur, délégation de tâche,
modification du modèle sélectionné ni activité en arrière-plan n'est déclenchée
par cette décision.

## Modes explicitement distincts

| Mode           | Origine de la réponse                                    | Ce qu'il permet de vérifier                                                 |
| -------------- | -------------------------------------------------------- | --------------------------------------------------------------------------- |
| `demo-fixture` | Scénario fixe ou réponse de test rejouée                 | UI, contrat et transitions déterministes ; aucune preuve d'analyse nouvelle |
| `sol-assisted` | Analyse nouvelle de Sol, transmise explicitement en JSON | Cognition assistée, provenance, validation et application métier            |
| `automatic`    | Fournisseur raccordé à l'application, DeepSeek prévu     | Appels, outils, erreurs réseau, quotas et parcours sans transfert manuel    |

Le domaine ne contient aucune branche du type « si fournisseur = Sol, accepter
la réponse ». Le transport change ; les invariants restent les mêmes. Un modèle
déclaré dans un fichier est une déclaration, pas une identité authentifiée.

## Socle maintenu et choix précisés

1. React/TypeScript et l'UI actuelle sont conservés. `demo.ts` reste isolé ; les
   données personnelles démarrent dans un espace vide, jamais avec Marc injecté.
2. Un backend local TypeScript/Node possède l'état canonique. Le frontend ne
   contourne pas ses commandes pour appliquer une proposition.
3. PostgreSQL reste la cible. R0 doit prouver installation personnelle, cycle de
   vie et récupération avant les migrations R1. Si ce choix échoue, documenter
   l'obstacle et l'alternative proposée ; ne pas passer silencieusement à SQLite
   ou à `localStorage`.
4. Tauri reste la cible Windows. Un essai borné de lancement/arrêt du service et
   du stockage est requis à R0, l'empaquetage complet à R6. DeepSeek ne fait plus
   partie de l'essai bloquant R0.
5. Transport UI/backend : API JSON liée à `127.0.0.1` et flux SSE comportant une
   révision. Les noms de routes et le port backend sont documentés par Sol à R0.
   Authentification locale de session, contrôles d'origine/hôte, limites d'entrée
   et absence de secrets dans le frontend sont prévus dès le premier service
   inscriptible ; R6 en vérifie le durcissement.
6. Transport cognitif assisté : fichiers JSON versionnés, sans chemin de fichier
   à exécuter ni code libre dans une proposition. Le même service métier gère
   l'import via UI ou CLI locale ; ces surfaces ne dupliquent pas le validateur.
7. Sources, identité, épisodes, propositions et annotations ont des identifiants
   stables. Une seule transaction applique les changements acceptés. Une
   réponse basée sur une ancienne révision est rejetée, pas fusionnée à l'aveugle.

Les données runtime, exports, réponses privées et sauvegardes sont stockés hors
du dépôt, dans un répertoire personnel configurable (cible Windows :
`%LOCALAPPDATA%\ManweNext`). Le corpus fictif et ses preuves expurgées peuvent
être versionnés. Aucun export de données personnelles vers la tâche de Sol
n'est automatique : le contenu et le périmètre partagé sont explicites.

## Conséquences sur la livraison

- R1 reste réalisable sans modèle et sans API externe.
- R2 à R5 deviennent des jalons vérifiables en **mode assisté** ; leurs rapports
  nomment ce mode. L'absence de clé DeepSeek ne les bloque plus.
- Le contrôle transverse **IA-A** conserve les tests du fournisseur automatique
  et du harnais. Il est obligatoire avant la validation de l'alpha R6.
- Un PoC R5 peut être utilisé pour un essai accompagné ; il n'est pas annoncé
  comme un assistant autonome utilisable sans transfert d'analyse.
- Les durées manuelles ne sont pas des latences modèle ; les coûts inconnus ne
  sont pas affichés comme zéro. Le rôle provisoire de Sol n'implique pas la
  gratuité des ressources consommées par sa tâche.
- Sol peut critiquer ses propositions, mais son autocritique ne constitue ni
  une preuve supplémentaire ni une évaluation indépendante.

## Reprise et évolution

Sol peut choisir les détails réversibles d'implémentation compatibles avec ces
décisions et consigner les résultats sans attendre Astra à chaque étape. Un
changement de stockage, de shell Windows, de frontière de confiance ou de mode
automatique est un arbitrage explicite avant d'être implémenté.

Le raccordement DeepSeek réutilisera le contrat et les corpus. Un autre moteur
automatique est possible après décision, mais il ne doit pas être présenté
comme DeepSeek. Aucune migration de la mémoire ne doit être nécessaire au seul
motif du changement de fournisseur.

Références : [roadmap 1.1](../../../ROADMAP.md),
[contrat cognitif v1](../contracts/COGNITION_V1.md),
[handoff Sol](../HANDOFF_SOL.md).
