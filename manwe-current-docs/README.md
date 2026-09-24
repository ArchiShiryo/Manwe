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
