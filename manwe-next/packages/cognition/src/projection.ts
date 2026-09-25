// Projections du graphe vivant (R4.1, R4.2). Fonctions pures : à partir d'un
// instantané de la mémoire et d'un focus, elles produisent les nœuds et les
// liens à afficher, avec des identifiants métier et la révision canonique.
// Aucune branche propre à un scénario : tout vient des données.

import type {
  Claim,
  Hypothesis,
  RelationMember,
  WorkspaceSnapshot,
} from "../../domain/src/memory.ts";
import type { LINK_TYPES } from "./ontology.ts";

export type FocusContext = {
  kind: "person" | "self" | "relation" | "hypothesis" | "question";
  id: string;
};

/** Statut visuel commun (maquettes « Monde ») : trait plein, pointillé, double, inconnu. */
export type EpistemicStyle =
  | "observed"
  | "reported"
  | "impression"
  | "inferred"
  | "unknown";

export type GraphNode = {
  id: string;
  kind:
    | "self"
    | "person"
    | "relation"
    | "hypothesis"
    | "claim"
    | "event"
    | "question";
  label: string;
  style: EpistemicStyle;
  meta: Record<string, string | number | boolean | null>;
};

export type GraphEdge = {
  id: string;
  from: string;
  to: string;
  kind: keyof typeof LINK_TYPES;
  style: EpistemicStyle;
};

export type GraphProjection = {
  focus: FocusContext;
  revision: number;
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** Des objets utiles ont été omis pour respecter les limites d'affichage. */
  truncated: boolean;
};

/** Règle des maquettes : au plus 7 relations par schéma. */
export const MAX_RELATIONS = 7;
export const MAX_HYPOTHESES = 5;
export const MAX_EVIDENCE = 8;
export const MAX_EVENTS = 10;

const nodeId = (kind: GraphNode["kind"], id: string) =>
  kind === "self" ? "self" : `${kind}:${id}`;

export function claimStyle(category: Claim["category"]): EpistemicStyle {
  if (category === "inference") return "inferred";
  if (category === "user_impression") return "impression";
  if (category === "reported_observation") return "reported";
  return "observed";
}

/** Lectures classées d'abord (rang), puis plausibles, puis par confiance. */
export function rankHypotheses(hypotheses: Hypothesis[]) {
  const confidence = { high: 0, moderate: 1, low: 2 } as const;
  return hypotheses
    .filter((item) => item.status !== "superseded")
    .sort(
      (left, right) =>
        (left.rank ?? 99) - (right.rank ?? 99) ||
        Number(right.status === "plausible") -
          Number(left.status === "plausible") ||
        confidence[left.confidence] - confidence[right.confidence] ||
        left.id.localeCompare(right.id),
    );
}

class Builder {
  readonly nodes = new Map<string, GraphNode>();
  readonly edges = new Map<string, GraphEdge>();
  truncated = false;
  private readonly snapshot: WorkspaceSnapshot;

  constructor(snapshot: WorkspaceSnapshot) {
    this.snapshot = snapshot;
  }

  member(member: RelationMember): string {
    if (member.kind === "self") {
      this.nodes.set("self", {
        id: "self",
        kind: "self",
        label: "Vous",
        style: "observed",
        meta: {},
      });
      return "self";
    }
    const person = this.snapshot.persons.find(
      (item) => item.id === member.personId,
    );
    const id = nodeId("person", member.personId);
    this.nodes.set(id, {
      id,
      kind: "person",
      label: person?.displayName ?? "personne inconnue",
      style: person ? "observed" : "unknown",
      meta: { resolution: person?.resolutionStatus ?? null },
    });
    return id;
  }

  relation(relationId: string): string | null {
    const relation = this.snapshot.relations.find(
      (item) => item.id === relationId,
    );
    if (!relation) return null;
    const id = nodeId("relation", relation.id);
    const labels = relation.members.map((member) => this.member(member));
    this.nodes.set(id, {
      id,
      kind: "relation",
      label: labels.map((key) => this.nodes.get(key)?.label ?? key).join(" – "),
      style: "observed",
      meta: {
        episodes: relation.indicators.episodes,
        counterexamples: relation.indicators.counterexamples,
        episodesPer30Days: relation.indicators.episodesPer30Days,
      },
    });
    for (const key of labels) this.edge(key, id, "member_of", "observed");
    return id;
  }

  hypothesis(hypothesis: Hypothesis): string {
    const id = nodeId("hypothesis", hypothesis.id);
    this.nodes.set(id, {
      id,
      kind: "hypothesis",
      label: hypothesis.statement,
      style: "inferred",
      meta: {
        depth: hypothesis.depth,
        status: hypothesis.status,
        confidence: hypothesis.confidence,
        rank: hypothesis.rank,
        needsReview: hypothesis.needsReview,
      },
    });
    for (const subject of hypothesis.subjects) {
      const target =
        subject.kind === "relation"
          ? this.relation(subject.relationId)
          : this.member(subject);
      if (target) this.edge(id, target, "about", "inferred");
    }
    return id;
  }

  claim(claim: Claim): string {
    const id = nodeId("claim", claim.id);
    this.nodes.set(id, {
      id,
      kind: "claim",
      label: claim.text,
      style: claimStyle(claim.category),
      meta: {
        category: claim.category,
        contested: claim.contestedRevision !== null,
      },
    });
    return id;
  }

  event(eventId: string): string | null {
    const event = this.snapshot.events.find((item) => item.id === eventId);
    if (!event) return null;
    const id = nodeId("event", event.id);
    this.nodes.set(id, {
      id,
      kind: "event",
      label: event.title,
      style: "observed",
      meta: { occurredStart: event.occurredStart, sourceId: event.sourceId },
    });
    return id;
  }

  edge(
    from: string,
    to: string,
    kind: GraphEdge["kind"],
    style: EpistemicStyle,
  ) {
    const id = `${kind}:${from}->${to}`;
    this.edges.set(id, { id, from, to, kind, style });
  }

  limit<T>(items: T[], maximum: number): T[] {
    if (items.length > maximum) this.truncated = true;
    return items.slice(0, maximum);
  }

  result(focus: FocusContext): GraphProjection {
    return {
      focus,
      revision: this.snapshot.workspace.revision,
      nodes: [...this.nodes.values()],
      edges: [...this.edges.values()],
      truncated: this.truncated,
    };
  }
}

const memberKeyOf = (member: RelationMember) =>
  member.kind === "self" ? "self" : `person:${member.personId}`;

function subjectTouches(hypothesis: Hypothesis, key: string) {
  return hypothesis.subjects.some((subject) =>
    subject.kind === "relation"
      ? subject.members.some((member) => memberKeyOf(member) === key)
      : memberKeyOf(subject) === key,
  );
}

/** Personne (ou l'utilisateur) : ses relations et ses lectures principales. */
function projectMember(snapshot: WorkspaceSnapshot, focus: FocusContext) {
  const builder = new Builder(snapshot);
  const key = focus.kind === "self" ? "self" : `person:${focus.id}`;
  builder.member(
    focus.kind === "self"
      ? { kind: "self" }
      : { kind: "person", personId: focus.id },
  );
  const relations = snapshot.relations
    .filter((relation) =>
      relation.members.some((member) => memberKeyOf(member) === key),
    )
    .sort(
      (left, right) => right.indicators.episodes - left.indicators.episodes,
    );
  for (const relation of builder.limit(relations, MAX_RELATIONS))
    builder.relation(relation.id);
  const hypotheses = rankHypotheses(
    snapshot.hypotheses.filter((item) => subjectTouches(item, key)),
  );
  for (const hypothesis of builder.limit(hypotheses, MAX_HYPOTHESES))
    builder.hypothesis(hypothesis);
  return builder.result(focus);
}

/** Relation : ses membres, ses épisodes avec rôles, et les lectures qui la visent. */
function projectRelation(snapshot: WorkspaceSnapshot, focus: FocusContext) {
  const builder = new Builder(snapshot);
  const relationNode = builder.relation(focus.id);
  const relation = snapshot.relations.find((item) => item.id === focus.id);
  if (!relation || !relationNode) return builder.result(focus);
  const keys = new Set(relation.members.map(memberKeyOf));
  const eventIds = [
    ...new Set(
      snapshot.roles
        .filter((role) => keys.has(memberKeyOf(role.subject)))
        .map((role) => role.eventId),
    ),
  ]
    .map((id) => snapshot.events.find((event) => event.id === id))
    .filter((event) => event !== undefined)
    .sort((left, right) =>
      String(right.occurredStart ?? "").localeCompare(
        String(left.occurredStart ?? ""),
      ),
    );
  for (const event of builder.limit(eventIds, MAX_EVENTS)) {
    const eventNode = builder.event(event.id);
    if (!eventNode) continue;
    for (const role of snapshot.roles.filter(
      (item) =>
        item.eventId === event.id && keys.has(memberKeyOf(item.subject)),
    ))
      builder.edge(
        builder.member(role.subject),
        eventNode,
        "plays_role",
        "observed",
      );
  }
  const hypotheses = rankHypotheses(
    snapshot.hypotheses.filter((item) =>
      item.subjects.some(
        (subject) =>
          subject.kind === "relation" && subject.relationId === relation.id,
      ),
    ),
  );
  for (const hypothesis of builder.limit(hypotheses, MAX_HYPOTHESES))
    builder.hypothesis(hypothesis);
  return builder.result(focus);
}

/** Hypothèse : ses sujets, ses preuves pour et contre, leurs épisodes, son alternative, ses questions. */
function projectHypothesis(snapshot: WorkspaceSnapshot, focus: FocusContext) {
  const builder = new Builder(snapshot);
  const hypothesis = snapshot.hypotheses.find((item) => item.id === focus.id);
  if (!hypothesis) return builder.result(focus);
  const hypothesisNode = builder.hypothesis(hypothesis);
  const evidence = hypothesis.evidence.filter(
    (item) => item.supersededRevision === null,
  );
  for (const item of builder.limit(evidence, MAX_EVIDENCE)) {
    const claim = snapshot.claims.find((entry) => entry.id === item.claimId);
    if (!claim) continue;
    const claimNode = builder.claim(claim);
    builder.edge(
      claimNode,
      hypothesisNode,
      item.stance,
      claimStyle(claim.category),
    );
    for (const citation of claim.citations) {
      const event = snapshot.events.find(
        (entry) => entry.sourceId === citation.sourceId,
      );
      const eventNode = event ? builder.event(event.id) : null;
      if (eventNode) builder.edge(claimNode, eventNode, "cites", "observed");
    }
  }
  const alternative = snapshot.hypotheses.find(
    (item) =>
      item.id !== hypothesis.id &&
      (item.id === hypothesis.alternativeTo ||
        item.alternativeTo === hypothesis.id),
  );
  if (alternative)
    builder.edge(
      hypothesisNode,
      builder.hypothesis(alternative),
      "alternative_to",
      "inferred",
    );
  for (const question of snapshot.questions.filter(
    (item) =>
      item.status === "open" &&
      item.targets.some(
        (target) => target.kind === "hypothesis" && target.id === hypothesis.id,
      ),
  )) {
    const id = `question:${question.id}`;
    builder.nodes.set(id, {
      id,
      kind: "question",
      label: question.question,
      style: "unknown",
      meta: { status: question.status },
    });
    builder.edge(id, hypothesisNode, "targets", "unknown");
  }
  return builder.result(focus);
}

/** Question : les hypothèses qu'elle départage et leurs sujets. */
function projectQuestion(snapshot: WorkspaceSnapshot, focus: FocusContext) {
  const builder = new Builder(snapshot);
  const question = snapshot.questions.find((item) => item.id === focus.id);
  if (!question) return builder.result(focus);
  const id = `question:${question.id}`;
  builder.nodes.set(id, {
    id,
    kind: "question",
    label: question.question,
    style: "unknown",
    meta: { status: question.status },
  });
  for (const target of question.targets) {
    const hypothesis = snapshot.hypotheses.find(
      (item) => item.id === target.id,
    );
    if (hypothesis)
      builder.edge(id, builder.hypothesis(hypothesis), "targets", "unknown");
  }
  return builder.result(focus);
}

export function projectGraph(
  snapshot: WorkspaceSnapshot,
  focus: FocusContext,
): GraphProjection {
  if (focus.kind === "relation") return projectRelation(snapshot, focus);
  if (focus.kind === "hypothesis") return projectHypothesis(snapshot, focus);
  if (focus.kind === "question") return projectQuestion(snapshot, focus);
  return projectMember(snapshot, focus);
}
