# MANWË — Current Documentation (v3.0)

MANWË is a local-first social cognition prosthesis and a **shared cognitive workspace between a human and an LLM**. It is not designed as a SaaS dashboard, CRM, social network, or agent control panel.

## Canonical source

**MANWE_Master_Specification_v3_0.docx** is the conceptual source of truth. The UX, architecture and PoC documents are derived from it.

## Current interaction model

The central surface is the **Living Graph**: a contextual projection of the part of MANWË's social model that matters to the current conversation or problem. It can contain people, relationships, groups, events, hypotheses, goals, problems, concepts and open questions.

The user and the LLM can both initiate: MANWË may surface a change or ask for missing information; the user may inspect, correct, comment or answer directly on the representation.

Epistemic states: **◆ Explicit · ● Observed · ≈ User impression · ◇ Inferred · ? Unknown/Open question**.

## Technical target

Windows desktop / Tauri / React / TypeScript / local-first backend / PostgreSQL + pgvector / Obsidian projection / WebSocket agent events / DeepSeek Harness + Cordis / MCP + APIs / Playwright future source adapter.

## Documentation

- `MANWE_Master_Specification_v3_0.docx` — master specification
- `MANWE_UX_Vision_v3_0.docx` / `UX_VISION.md` — UX
- `MANWE_Technical_Architecture_v3_0.docx` / `ARCHITECTURE.md` — technical architecture
- `MANWE_PoC_Plan_v3_0.docx` / `POC_PLAN.md` — PoC
- `MANWE_Document_Index_v3_0.docx` — document governance

## Dérogations en vigueur (mode développement)

Ces documents v3.0 restent la référence conceptuelle. Pendant le développement, les décisions de pilotage D-006 et D-010 ([PILOTAGE.md](../manwe-next/docs/pilotage/PILOTAGE.md)) prévalent sur les limitations suivantes :

- « no D4 deep psychodynamics » (POC_PLAN) et « interdit la psychodynamique D4 » (spécification §25.1) : levés. Toutes les profondeurs sont produites ; D4 reste « exploratoire » tant que le Behavioral Anchor Check n'est pas satisfait.
- Parcimonie (§6.9) et Formulation Gate (§6.8) : appliqués comme règles de classement et de promotion, pas de suppression.
- Plafonds « deux hypothèses », « une question », « deux directions » : plafonds d'affichage, pas des limites du modèle.
- Cible « Windows desktop » : cible de la première version personnelle ; une diffusion publique est envisagée (D-004).
