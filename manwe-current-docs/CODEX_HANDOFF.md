# MANWË — CODEX HANDOFF

**Status:** active handoff for local implementation
**Target:** Windows desktop prototype
**Date:** 2026-08-30
**Priority:** rebuild the UI around the Living Graph; do not preserve the current SaaS/dashboard paradigm

---

## 0. Read this first

MANWË is **not a dashboard, CRM, chatbot shell, graph database browser, agent console, or SaaS product UI**.

MANWË is a **shared cognitive workspace between a human and an LLM**.

The UI exists so that:

- the human can understand a social situation;
- the LLM can externalize a useful representation of what it currently understands;
- uncertainty can be made visible rather than hidden;
- the LLM can ask targeted questions when information is missing;
- the human can correct, annotate, challenge, or add context directly to the shared representation;
- hypotheses, observations, goals and problems can evolve visibly over time;
- the human can inspect *why* MANWË says something, down to evidence and original events.

The key interaction loop is:

**perceive → formulate → confront → clarify → choose → learn**

Not:

**navigate → create object → edit form → save**

If a UI decision makes MANWË feel like project-management software, a CRM, Neo4j, an admin console, or a collection of SaaS cards, it is probably wrong.

---

## 1. Source-of-truth documents

The current conceptual source of truth is:

- `../manwe-current-docs/MANWE_Master_Specification_v3_0.docx`

Derived documents:

- `../manwe-current-docs/UX_VISION.md`
- `../manwe-current-docs/ARCHITECTURE.md`
- `../manwe-current-docs/POC_PLAN.md`

Current prototype sources:

- `src/main.tsx`
- `README.md`
- `ARCHITECTURE.md`
- `UX_VISION.md`

**Important:** the existing prototype is reference material only. Its current screen/navigation structure is *not* a design constraint. Refactor or replace it freely.

---

## 2. Product thesis

MANWË externalizes part of social cognition into a persistent, inspectable model.

It maintains a Social World Model containing things such as:

- people;
- relationships;
- groups;
- interactions/events;
- social signals;
- explicit statements;
- observations;
- user impressions;
- hypotheses;
- uncertainty/open questions;
- evidence;
- goals;
- problems;
- strategies/possible paths;
- contextual research.

But the user must **not** have to think in terms of this backend ontology during normal use.

The interface should reveal structure only when useful.

---

## 3. Central UX decision: the Living Graph

The Living Graph is the **primary cognitive surface** of MANWË.

It is not merely a “Network” page.

It is the visual representation that MANWË and the user look at together.

Depending on context, the graph may represent:

- the social world broadly;
- a single relationship;
- a group;
- a problem decomposition;
- an active goal;
- the evidence supporting an interpretation;
- competing explanations;
- an open question;
- a temporary reasoning workspace produced in response to a user question.

The graph is therefore a **contextual projection**, not the raw database graph.

The backend may contain thousands of objects. The UI should often show only 8–30 cognitively relevant objects.

---

## 4. Non-negotiable graph behavior

### 4.1 Clusters must be readable

Avoid the classic Obsidian failure mode: a beautiful but unreadable cloud of nodes.

Clusters are first-class visual objects.

Examples:

- Work informal group
- Family
- Old friends
- Gaming
- RC hobby
- AI / local models
- Online communities

Each cluster should have:

- a stable label;
- generous spatial separation from other clusters;
- a soft visual boundary / hull / region;
- a stable approximate location across sessions;
- a summary available on hover/select;
- internal layout that remains legible;
- a semantic identity rather than just a color.

A cluster may summarize itself as:

> Work informal group
> 4 people · activity ↑
> Marc and Léa appear central. You remain slightly peripheral.
> 2 unresolved questions

### 4.2 Semantic zoom

Zoom changes the conceptual level, not just scale.

**Far zoom:**
- YOU
- major groups/communities
- major bridges
- major active goal/problem

**Medium zoom:**
- people inside a selected cluster
- central/peripheral roles
- main relationships
- important shared territories

**Close zoom:**
- events
- hypotheses
- observations
- open questions
- evidence
- contextual concepts

Do not render everything at all zoom levels.

### 4.3 Stable spatial memory

Do not run an unconstrained force simulation on every render.

The user's world should become spatially familiar.

Requirements:

- cluster positions should be seeded/persisted;
- nodes should move smoothly but not randomly;
- newly introduced nodes may settle with physics, then stabilize;
- the graph can recompose when the *focus* changes, but ordinary refreshes should not reshuffle the world.

### 4.4 Bridge positioning

A person connected to two social worlds may physically occupy the boundary between the clusters.

Example:

`WORK —— Marc —— GAMING`

Position should carry meaning, not only edges.

### 4.5 Contextual focus

When the user or MANWË focuses on Marc:

- Marc becomes visually dominant;
- relevant neighbors remain clear;
- unrelated regions attenuate;
- the graph does not disappear behind modal windows;
- the inspector explains the selected claim/object.

When focus changes to a group or problem, the graph may gently recompose around that context.

### 4.6 Cognitive animation, not decoration

Useful transitions only:

- hypothesis created → appears softly;
- confidence decreases → becomes less visually present;
- evidence attaches → connection becomes clearer;
- open question resolved → question node transforms/disappears;
- contradiction appears → subtle tension edge;
- new relevant signal → small marker on affected object.

No neon pulses, no cyberpunk glow, no constant particle animation.

---

## 5. Epistemic visual grammar

The user must always be able to distinguish **what kind of thing they are looking at**.

Use a consistent grammar.

### Explicit
`◆ Explicit`

Something someone directly stated.

Example:
> Marc said he likes fighting games.

### Observed
`● Observed`

Recorded event/behavior.

Example:
> Marc initiated lunch.

### User impression
`≈ User impression`

A subjective perception reported by the user.

Example:
> “Claire seemed distant.”

This is important and must not be silently converted into an observation.

### Inferred
`◇ Inferred`

MANWË interpretation/hypothesis.

Example:
> Marc may be becoming closer.

### Unknown / Open question
`?`

Something MANWË explicitly does not know but considers useful to clarify.

Example:
> Would Marc initiate outside work without a shared activity?

### Contradicted / tension

Use restrained red only where a meaningful contradiction exists.

Never represent uncertainty as fake numerical precision such as “72% friendship”. Prefer language such as:

- weakly supported
- plausible
- moderate confidence
- strongly supported
- insufficient evidence

---

## 6. The graph is editable conversationally

The human should be able to help MANWË by acting *on the shared representation*.

Selection actions can include:

- `Why?`
- `Add context`
- `Comment`
- `I disagree`
- `Seems right`
- `Challenge`
- `This matters more`
- `This matters less`

A comment attaches to a graph object or edge, not only to generic chat history.

Example:

User comments on an event:
> I think you are giving this event too much weight.

MANWË can answer:
> I’ll reduce its evidential weight unless similar behavior repeats.

That annotation becomes part of the model.

---

## 7. MANWË can ask questions in the graph

The LLM is not passive.

If information is missing, it may create a visible `?` node.

Example:

```
Claire ───── ◇ Possible distancing
                  │
                  ? Initiative change
```

Selecting the `?` should show something like:

> **One thing would help me distinguish two interpretations**
>
> Has Claire also initiated fewer conversations recently, or are only her replies slower?

The user answers directly.

The graph should then visibly revise.

This is a core demo interaction.

---

## 8. Main screen composition

Do **not** make a conventional three-column SaaS dashboard with equal visual weight.

Preferred composition:

- very light/minimal navigation on the left;
- Living Graph occupying most of the screen;
- contextual Inspector on the right only when useful;
- persistent natural-language input at the bottom or top edge;
- short narrative utterances from MANWË anchored to the graph/context.

Suggested conceptual layout:

```
┌───────────────────────────────────────────────────────────────┐
│ MANWË                                      Ask or tell MANWË… │
├─────────┬───────────────────────────────────────┬─────────────┤
│         │                                       │             │
│ Today   │                                       │ Inspector   │
│ People  │             LIVING GRAPH              │             │
│ World   │                                       │             │
│ Intent. │                                       │             │
│ Memory  │                                       │             │
│         │                                       │             │
├─────────┴───────────────────────────────────────┴─────────────┤
│ MANWË contextual utterance / question / reply                │
└───────────────────────────────────────────────────────────────┘
```

The center must remain dominant.

The Inspector may collapse.

The left nav should not list backend concepts such as Signals, Research, Relationships, Agent status as primary destinations.

---

## 9. Minimal primary navigation

Use approximately:

- **Today** — current social situation / meaningful changes
- **People** — persistent person models
- **World** — social world / groups / relationships
- **Intentions** — goals + problems
- **Memory** — journal/history

Chat is pervasive, not necessarily a primary page.

Technical views such as:

- Signals
- Research
- Sources
- Agent status
- Developer logs

should be secondary/deep surfaces.

---

## 10. Natural-language input is universal

One persistent input:

`Ask MANWË or tell it something…`

It can accept:

- a question;
- a journal event;
- a correction;
- a new goal;
- a problem statement;
- an answer to an open question;
- additional context;
- a request for alternatives.

Examples:

> Marc invited me to play Saturday.

→ record/reconcile event and update relevant representation.

> Why do you think Léa is central in this group?

→ focus graph on Léa + show relevant evidence.

> I want to become closer to Marc.

→ goal emerges naturally.

Avoid visible workflows like:

- Create Goal
- Add Person
- New Problem

unless used as secondary shortcuts.

---

## 11. Inspector behavior

The right-side Inspector is contextual and object-driven.

### Person selected

Show:

- current reading of relationship;
- recent change;
- shared territory;
- open questions;
- relevant goal/problem;
- recent evidence.

Example:

> **Marc Dupont**
>
> Colleague → friendly acquaintance?
>
> Relationship appears to be strengthening slowly.
>
> Initiative: increasing
> Reciprocity: recently balanced
> Trust: insufficient evidence

### Hypothesis selected

Show:

> **Marc may be becoming closer**
> `MANWË inference · moderate confidence`
>
> Supporting
> - initiated 4/6 recent informal interactions
> - invited user twice outside strictly professional contexts
>
> Against
> - most interactions remain work-adjacent
>
> `Why?` `Challenge` `Add context`

### Open question selected

Show:

- exact question;
- why it matters;
- which interpretations it discriminates between;
- direct answer affordance.

### Event/evidence selected

Show:

- observation;
- source;
- timestamp;
- interpretation links;
- related hypotheses;
- provenance.

---

## 12. Inspectable cognition

Universal drill-down path:

**claim → explanation → evidence → observation → original event/source**

Example:

`Marc may be becoming closer`

↓ Why?

`Initiative increased recently`

↓ Evidence

`4 specific interactions`

↓ Event

`28 Aug lunch — Marc initiated`

↓ Source

`manual journal`

This should feel natural and immediate, not like opening database records.

---

## 13. Goals

Goals should normally emerge from conversation.

Example user input:

> I would like a closer friend group.

MANWË can materialize:

**Build closer friendships**

Current state:

- 3 promising individual relationships
- few interactions outside work
- Marc and Léa already know each other

The goal may appear as a higher-level graph object / attractor.

Relevant people and groups can visually gain salience around it.

Do not reduce social strategy to project management metrics.

Avoid showing only:

- Risk: 4/5
- Effort: 2/5
- Expected value: 78%

Prefer qualitative comparison:

> **Invite Marc + Léa for something small**
>
> What this tests: whether the relationship works naturally as a trio.
>
> Advantages: low commitment; Marc and Léa already know each other.
>
> Possible downside: may feel premature if framed too formally.

Multiple possible paths, never “the correct path”.

---

## 14. Problems

A Problem is an inspectable representation of a diffuse social difficulty.

Example:

> I feel peripheral in the informal work group.

MANWË should organize:

### What we know
- few invitations outside work
- user rarely initiates
- several colleagues interact outside meetings

### What we do not know
- whether exclusion is intentional
- whether invitations are usually spontaneous
- whether other members are similarly peripheral

### Competing explanations
- low exposure / insufficient initiative
- established group habits
- lower affinity
- intentional exclusion ?

Key action:

`What would distinguish these?`

MANWË can then create discriminating questions/observations directly in the graph.

---

## 15. Today

Today should not be four equal dashboard cards.

It should answer:

> **What currently deserves my attention?**

Example:

> **Your social world is relatively stable.**
> 3 changes worth noticing · 1 unresolved interaction

Then one dominant item:

> **Most relevant change — Marc**
> The relationship appears to be strengthening slowly.
> `Why?`

Then time-sensitive items:

- Lunch with Claire · today 12:30
- Marc invitation · unanswered 2 days
- Team meeting · tomorrow

Everything else is background.

---

## 16. Visual direction

Dark Windows desktop UI.

Desired feel:

- Obsidian knowledge visualization
- Linear clarity
- Arc/Raycast personal-tool quality
- modern graph-analysis sophistication
- subtle augmented-intelligence character

Avoid:

- big rounded SaaS cards everywhere
- excessive borders
- flashy gradients
- neon
- cyberpunk
- healthcare/clinical UI
- CRM profile pages
- social-network feed styling
- admin panels
- excessive iconography
- every object inside a card

Palette direction:

- near-black / graphite background
- very dark panels
- ivory / soft gray text
- royal blue for cognitive focus
- restrained violet for hypotheses
- green for confirmed/established
- amber for uncertainty/change/open questions
- red only for meaningful contradiction/problem

Use color semantically, not decoratively.

---

## 17. Recommended graph stack

### Product target

**Sigma.js + Graphology**

Why:

- WebGL rendering;
- strong control of graph presentation;
- graph data model separated from renderer;
- suitable for custom semantic zoom;
- easier to build MANWË-specific graph behavior than a generic network diagram tool;
- compatible with React/Tauri architecture.

### Layout strategy

Do not rely on a single global force layout.

Implement a multi-stage layout:

1. identify logical clusters supplied by mock/domain data;
2. place cluster centroids with strong inter-cluster separation;
3. layout nodes locally inside each cluster;
4. place bridge nodes between relevant cluster centroids;
5. stabilize and store positions;
6. animate only meaningful focus/recomposition transitions.

For initial work, deterministic seeded positions are acceptable if they demonstrate the UX better than unstable physics.

Possible helpers:

- Graphology
- ForceAtlas2 for initial settling
- custom hull rendering for cluster regions
- custom Sigma node/edge reducers for focus/semantic zoom

Do **not** choose 3D for the main desktop experience.

---

## 18. Suggested UI data model for the prototype

Keep view types simple and decoupled from final database schema.

```ts
export type EpistemicStatus =
  | 'explicit'
  | 'observed'
  | 'user_impression'
  | 'inferred'
  | 'unknown'
  | 'contradicted';

export type CognitiveNodeKind =
  | 'self'
  | 'person'
  | 'group'
  | 'interest'
  | 'event'
  | 'observation'
  | 'hypothesis'
  | 'question'
  | 'goal'
  | 'problem';

export interface CognitiveNode {
  id: string;
  kind: CognitiveNodeKind;
  label: string;
  subtitle?: string;
  epistemic?: EpistemicStatus;
  salience: number;       // relative UI salience, not psychological truth
  freshness?: 'fresh' | 'aging' | 'stale';
  clusterId?: string;
  x?: number;
  y?: number;
  meta?: Record<string, unknown>;
}

export interface CognitiveEdge {
  id: string;
  source: string;
  target: string;
  kind:
    | 'relationship'
    | 'membership'
    | 'supports'
    | 'contradicts'
    | 'related'
    | 'bridge'
    | 'relevant_to';
  strength?: number;
  epistemic?: EpistemicStatus;
}

export interface GraphCluster {
  id: string;
  label: string;
  summary: string;
  memberIds: string[];
  stableAnchor: { x: number; y: number };
}

export interface FocusContext {
  type: 'overview' | 'person' | 'group' | 'goal' | 'problem' | 'question';
  subjectIds: string[];
  narrative?: string;
}
```

---

## 19. Required mock scenario

Use one coherent social world throughout the prototype.

### People

**Marc Dupont**
- colleague
- relationship trending slightly closer
- interests: gaming, AI, hardware
- moderate fighting-game literacy
- initiated 4 of last 6 informal interactions

**Léa Martin**
- colleague
- central in informal work group
- recently completed a project previously discussed with user

**Thomas Bernard**
- colleague
- weakly connected to user
- possible distancing hypothesis is only weakly supported

**Claire Morel**
- friend/acquaintance
- slower replies recently
- user impression: “she has become distant”
- open question: has initiative changed, or only reply delay?

**Julien**
- old friend
- birthday Sunday

### Clusters

- Work informal group
- Gaming
- RC hobby
- Old friends

### Goal

**Build closer friendships**

Current stage: individual bonds.

### Problem

**I feel peripheral in the informal work group**

### Selected hypothesis for primary screenshot/state

**Marc may be becoming closer**

Status: `Inferred · moderate confidence`

Supports:
- Marc initiated 4/6 recent informal interactions
- invited user twice outside strictly professional context
- conversations becoming somewhat more personal

Against:
- most interactions remain work-adjacent

### Visible open question

**Would Marc initiate outside work without a shared activity?**

### Recent signal

**Marc shared an article about local AI.**

Linked to:
- Marc
- Local AI affinity hypothesis

---

## 20. Primary prototype state to implement first

Build **one excellent desktop state before building many pages**.

The initial screen should show:

- Living Graph occupying ~65–75% of usable width;
- clearly separated named clusters;
- YOU positioned centrally in the social-world projection;
- Marc selected;
- hypothesis `Marc may be becoming closer` visible near him;
- amber `?` open question;
- `Build closer friendships` goal visible as a higher-level attractor;
- recent signal marker on Marc;
- right Inspector explaining the hypothesis;
- minimal left navigation;
- persistent natural-language input;
- subtle MANWË narrative such as:
  > “The strongest recent change is Marc’s increasing initiative. I’m still uncertain whether it generalizes outside shared activities.”

This single state must already communicate the product thesis.

Do not build ten mediocre screens first.

---

## 21. Required interactions for the first vertical slice

Implement these before secondary pages:

### A. Select Marc

- graph focus changes;
- inspector shows current relationship reading;
- related nodes remain visible;
- unrelated clusters attenuate but remain spatial context.

### B. Select hypothesis

- inspector shows supports/against;
- `Why?` reveals evidence trail;
- evidence can be selected.

### C. Select `?` question

- inspector explains why MANWË needs the answer;
- user can answer with one of 2–3 mock responses;
- graph updates immediately;
- hypothesis confidence language changes visibly.

### D. Add a comment to evidence

Example preset comment:
> “This happened because we had a work deadline, so I think it is weak evidence.”

After submission:
- attach annotation to event/evidence;
- reduce its visual weight;
- update hypothesis explanation.

### E. Focus goal

Select `Build closer friendships`:
- relevant people/groups gain salience;
- show 2 qualitative possible directions;
- no “recommended best path”.

### F. Natural-language mock input

If user enters:
> Marc invited me to play Saturday.

Mock the interpretation:
- add an event node;
- attach to Marc;
- resolve/strengthen relevant open question;
- update narrative and hypothesis.

No real LLM integration is needed for this first UI slice; deterministic mock transitions are fine.

---

## 22. Technical target architecture

Future target:

- Windows desktop
- Tauri
- React
- TypeScript
- local-first backend
- PostgreSQL + pgvector
- Obsidian/Markdown human-readable projection
- DeepSeek Harness / Cordis runtime
- WebSocket agent event stream
- MCP/API tool layer
- Playwright future perception adapter

The UI should consume a projection layer rather than raw DB objects.

Conceptually:

```text
Social World Model
      ↓
FocusContext
      ↓
GraphProjection
      ↓
Living Graph + Narrative + Inspector
      ↕
Human annotation / answer / correction
      ↓
Model update
      ↓
New GraphProjection
```

---

## 23. Suggested agent-to-UI event vocabulary

Prepare UI state for events such as:

```ts
type AgentUIEvent =
  | { type: 'focus.changed'; payload: FocusContext }
  | { type: 'graph.projection.updated'; payload: GraphProjection }
  | { type: 'graph.delta'; payload: GraphDelta }
  | { type: 'hypothesis.revised'; payload: unknown }
  | { type: 'question.opened'; payload: unknown }
  | { type: 'question.resolved'; payload: unknown }
  | { type: 'evidence.attached'; payload: unknown }
  | { type: 'annotation.incorporated'; payload: unknown }
  | { type: 'goal.relevance.changed'; payload: unknown }
  | { type: 'problem.reframed'; payload: unknown }
  | { type: 'counselor.suggestion'; payload: unknown };
```

For the prototype, use a local event reducer/store that mimics these events.

---

## 24. Suggested React component breakdown

Do not create a monolithic `main.tsx` for the rewrite.

Suggested:

```text
src/
  app/
    AppShell.tsx
    routes.ts
  graph/
    LivingGraph.tsx
    GraphCanvas.tsx
    GraphClusterLayer.tsx
    GraphNodeRenderer.tsx
    GraphEdgeRenderer.tsx
    GraphLabels.tsx
    graphLayout.ts
    graphProjection.ts
    graphTypes.ts
  cognition/
    EpistemicBadge.tsx
    NarrativeSynthesis.tsx
    EvidenceTrail.tsx
    OpenQuestionPanel.tsx
    HumanAnnotationComposer.tsx
  inspector/
    ObjectInspector.tsx
    PersonInspector.tsx
    HypothesisInspector.tsx
    QuestionInspector.tsx
    EvidenceInspector.tsx
    GoalInspector.tsx
  input/
    ManweInput.tsx
  navigation/
    MinimalNav.tsx
  mock/
    socialWorld.ts
    projections.ts
    mockAgent.ts
  state/
    useManweStore.ts
  styles/
    tokens.css
    app.css
```

The exact structure may change, but preserve modular separation of:

- graph rendering;
- graph projection logic;
- cognitive/epistemic UI;
- inspector;
- mock agent behavior.

---

## 25. Implementation order

### Phase 1 — visual skeleton

1. Replace current dashboard layout.
2. Implement minimal nav + dominant workspace + collapsible inspector + universal input.
3. Establish dark design tokens.

### Phase 2 — Living Graph

4. Add Sigma.js + Graphology.
5. Build deterministic mock world.
6. Implement clear cluster separation and labels.
7. Add semantic node styling.
8. Add selection/focus behavior.
9. Add semantic zoom.

### Phase 3 — cognitive collaboration

10. Hypothesis inspector.
11. Evidence trail.
12. Open question node + answer flow.
13. Human comment/annotation flow.
14. Mock graph revision after user input.

### Phase 4 — goal/problem modes

15. Goal focus projection.
16. Problem decomposition projection.
17. Qualitative alternative paths.

### Phase 5 — secondary surfaces

Only then add:

- Today narrative view
- People browse/search
- Memory/journal
- Knowledge/Obsidian view
- technical settings/status

---

## 26. Acceptance criteria

The rewrite is successful only if all of the following are true:

### At first glance

A person unfamiliar with the implementation should say:

> “This looks like an AI and a person are looking at the same model together.”

Not:

> “This is an analytics dashboard.”

### Graph legibility

- clusters are clearly separated;
- each cluster has a readable name;
- no anonymous dense hairball;
- bridge people are visually understandable;
- only useful detail appears at each zoom level;
- the graph remains understandable without reading a legend first.

### Epistemic legibility

Within a few seconds, the user can tell the difference between:

- observation;
- explicit statement;
- user impression;
- MANWË inference;
- unknown/open question.

### Collaboration

The user can:

- inspect an inference;
- see supporting and contradicting evidence;
- answer a missing-information question;
- comment on evidence;
- see the shared representation update.

### Product feel

The UI should feel:

- calm;
- sophisticated;
- dense when needed;
- spatial;
- persistent;
- personal;
- inspectable;
- non-corporate;
- non-clinical;
- non-cyberpunk.

---

## 27. Explicit anti-patterns

Do not:

- turn every concept into a card;
- create a sidebar with 15 modules;
- put “Create / Edit / Delete” everywhere;
- use KPI dashboards;
- use friendship scores out of 100;
- use a social-feed layout;
- make chat the entire product;
- show the raw graph database;
- render hundreds of unlabeled dots as the default experience;
- animate every edge continuously;
- use a 3D graph as the primary UX;
- use neon gradients/glows;
- expose agent runtime/debugging in the main workflow;
- imply the LLM’s interpretation is ground truth;
- hide uncertainty;
- make the user maintain MANWË manually like a CRM.

---

## 28. Key design sentence

Use this sentence as the test for every major UI decision:

> **I am not operating an application. MANWË and I are looking at, questioning and revising the same representation of my social situation.**

If the implementation does not communicate that, redesign it.

---

## 29. Immediate task for Codex

Start by replacing the current prototype shell with the **single primary Living Graph state** described in section 20.

Do not attempt the complete application first.

The first milestone is a polished, navigable, interactive proof that demonstrates:

1. readable clusters;
2. semantic zoom;
3. focus on Marc;
4. one visible inference;
5. one visible open question;
6. inspectable evidence;
7. one human correction;
8. visible graph/model revision.

Once that feels convincing, expand outward.

