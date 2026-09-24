# R2 — Fondation du transport Sol assisté

Date : 14 septembre 2026. Statut : en cours. **Ne pas annoncer R2 validé.**

## Ce qui est implémenté

- migration cognitive séparant demandes, tentatives de réponse et révision de
  mémoire ;
- `ContextPacket` figé avec focus, sources exactes, offsets UTF-16, empreinte
  SHA-256, révision, expiration, opérations permises et limites ;
- parseur strict de `CognitiveProposal`, limité à `propose_event` et
  `propose_claim` ; aucun SQL, patch arbitraire ou identifiant canonique choisi
  par le modèle ;
- vérification de l'espace, de la révision de base, du hash, de chaque source,
  hash, tranche et citation ;
- conservation des réponses valides et des rejets rattachables à une demande ;
- aperçu avant confirmation, application tout-ou-rien avec une seule révision,
  rejeu idempotent, `no_change`, annulation et rejet d'une réponse obsolète ;
- UI manuelle : préparer/copier le contexte, coller la réponse brute, vérifier,
  prévisualiser, confirmer ou annuler. Aucun envoi automatique.
- import JSON/CSV atomique (1 Mio, 500 événements), déduplication par fichier,
  personnes avec clés externes et ambiguïtés persistées sans fusion silencieuse ;
- clarification d'identité dans l'UI : les candidats sont affichés et seul le
  choix explicite de l'utilisateur relie l'événement ;
- métrologie assistée : attente manuelle mesurée, temps d'inférence, usage et
  coût conservés à `null` lorsqu'ils sont indisponibles.

## Preuves déterministes

Les tests couvrent empreinte, application et redémarrage, rejeu identique,
citation altérée, révision obsolète, `no_change`, annulation, opération inconnue,
clé dupliquée, clarification manquante, taille, expiration, confirmation HTTP,
imports JSON/CSV, déduplication, ambiguïté et résolution humaine.

Ces preuves valident le mécanisme, pas la qualité d'une analyse et pas une
invocation de Sol ou de DeepSeek.

## Preuve assistée réelle

Trois propositions nouvelles de Sol ont été importées sur des paquets fictifs :
négation, conditionnel et propos rapporté. Les deux propositions de claim ont
été appliquées avec leurs citations exactes ; le conditionnel a produit
`no_change`. Après fermeture et réouverture des bases isolées, les révisions et
claims attendus étaient présents. Les trois rejeux exacts ont été reconnus sans
double application.

Les [paquets, réponses et reçus](../../packages/evaluation/runs/2026-09-14-assisted/EVALUATION.md)
sont versionnés. Cette preuve est assistée et non aveugle : Sol connaît le
projet et le corpus. Elle ne constitue pas un appel DeepSeek.

## Manquant pour valider R2 — mode assisté

1. éprouver les quatre catégories attendues d'extraction, notamment impression
   et intention future, sur de nouvelles sorties assistées ;
2. compléter le contexte hypothèse/contre-preuve lorsque les arêtes R3 existent ;
3. élargir l'évaluation au-delà de ces trois essais non aveugles et publier les
   métriques par catégorie.

IA-A reste entièrement non validé : DeepSeek et le harnais ne sont pas
connectés.
