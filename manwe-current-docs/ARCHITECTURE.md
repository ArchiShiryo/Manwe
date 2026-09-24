# MANWË — Technical Architecture v3.0

## Principle
The backend ontology can be technical; the UI cannot be. PostgreSQL is canonical state. The Living Graph is a contextual projection for human–LLM collaboration.

## Stack
- Windows desktop: Tauri + React + TypeScript
- personal local-first backend
- PostgreSQL + pgvector
- Obsidian/Markdown human-readable projection
- DeepSeek Harness / Cordis runtime
- frontier APIs and/or local models
- WebSocket agent event stream
- MCP / APIs
- Playwright future browser source adapter

## Cognitive objects
Person · Relationship · Group · Interaction/Event · Claim · Evidence · UserImpression · Hypothesis · OpenQuestion · HumanAnnotation · Goal · Problem · Strategy/Path · ContextFinding.

## GraphProjection
The graph is generated from a `FocusContext`. It selects a limited explanatory subgraph and carries epistemic state, freshness, salience and provenance. The LLM may emit graph deltas: focus, add/remove/attenuate, question opened/resolved, hypothesis revised.

## Evidence contract
Every inspectable claim can resolve to evidence and original events/sources. Supporting and contradicting evidence are distinct. Hypothesis confidence remains separate from intervention threshold.

## Agent-to-UI events
`focus.changed`, `graph.projection.updated`, `graph.delta`, `hypothesis.revised`, `question.opened`, `question.resolved`, `evidence.attached`, `annotation.incorporated`, `goal.relevance.changed`, `problem.reframed`, `counselor.suggestion`, `research.completed`.

## UI composition
Light navigation | Living Workspace | Contextual Inspector, plus persistent natural-language input.

## Core UI components
LivingGraph · CognitiveNode · OpenQuestionNode · EpistemicBadge · ObjectInspector · EvidenceTrail · HumanAnnotationComposer · NarrativeSynthesis · GoalDirection · ProblemDecomposition · FreshnessIndicator.

## Local-first
Canonical personal state stays under user control. No external sync is implicit. Sensitive raw data, interpretations and model-bound projections are distinct so routing/policy can decide what may leave the local backend.
