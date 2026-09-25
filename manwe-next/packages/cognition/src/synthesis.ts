// Synthèse structurée d'une projection (R4.6). Fonction pure et déterministe :
// aucun texte n'est généré, tout est repris des objets de la projection avec
// leurs identifiants. Elle porte la révision dont elle est issue, pour qu'une
// synthèse ancienne ne soit jamais présentée comme celle d'une révision plus
// récente (ROADMAP §6).
import type { Hypothesis, WorkspaceSnapshot } from "../../domain/src/memory.ts";
import type { GraphProjection } from "./projection.ts";
import { rankHypotheses } from "./projection.ts";

export const MAX_FACTS = 6;
export const MAX_READINGS = 3;

export type SynthesisFact = {
  claimId: string;
  text: string;
  category: string;
  quote: string | null;
};

export type SynthesisReading = {
  hypothesisId: string;
  statement: string;
  depth: string;
  status: string;
  confidence: string;
  rank: number | null;
  supports: number;
  contradicts: number;
  alternative: string | null;
};

export type Synthesis = {
  revision: number;
  /** Faits cités et non contestés (observés, rapportés, impressions déclarées). */
  facts: SynthesisFact[];
  /** Lectures principales, dans l'ordre de classement. */
  readings: SynthesisReading[];
  /** Éléments qui contredisent une lecture affichée. */
  counterexamples: SynthesisFact[];
  openQuestions: { questionId: string; question: string }[];
  /**
   * R5.2 : la situation active tient en deux lectures concurrentes au plus
   * (la principale et son alternative directe) et une question qui les
   * départage.
   */
  situation: {
    principal: SynthesisReading | null;
    competitor: SynthesisReading | null;
    question: { questionId: string; question: string } | null;
  };
  relation: {
    episodes: number;
    counterexamples: number;
    episodesPer30Days: number | null;
  } | null;
  truncated: boolean;
};

const idOf = (nodeId: string, kind: string) =>
  nodeId.startsWith(`${kind}:`) ? nodeId.slice(kind.length + 1) : null;

export function buildSynthesis(
  snapshot: WorkspaceSnapshot,
  projection: GraphProjection,
): Synthesis {
  const hypothesisIds = new Set(
    projection.nodes
      .map((node) => idOf(node.id, "hypothesis"))
      .filter((id): id is string => id !== null),
  );
  const readings = rankHypotheses(
    snapshot.hypotheses.filter((item) => hypothesisIds.has(item.id)),
  );
  const usable = (claimId: string) => {
    const claim = snapshot.claims.find((item) => item.id === claimId);
    if (!claim) return null;
    // « Validée » : citée, non contestée par l'utilisateur, ni contredite ni
    // remplacée, et qui n'est pas elle-même une inférence.
    if (
      claim.contestedRevision !== null ||
      claim.knowledgeStatus === "contradicted" ||
      claim.knowledgeStatus === "superseded" ||
      claim.category === "inference" ||
      claim.citations.length === 0
    )
      return null;
    return {
      claimId: claim.id,
      text: claim.text,
      category: claim.category,
      quote: claim.citations[0]?.quote ?? null,
    };
  };
  const supporting = new Map<string, SynthesisFact>();
  const against = new Map<string, SynthesisFact>();
  for (const hypothesis of readings)
    for (const item of hypothesis.evidence) {
      if (item.supersededRevision !== null) continue;
      const fact = usable(item.claimId);
      if (!fact) continue;
      (item.stance === "contradicts" ? against : supporting).set(
        fact.claimId,
        fact,
      );
    }
  for (const node of projection.nodes) {
    const claimId = idOf(node.id, "claim");
    const fact = claimId ? usable(claimId) : null;
    if (fact && !against.has(fact.claimId)) supporting.set(fact.claimId, fact);
  }
  const byText = (left: SynthesisFact, right: SynthesisFact) =>
    left.text.localeCompare(right.text) ||
    left.claimId.localeCompare(right.claimId);
  const facts = [...supporting.values()]
    .filter((fact) => !against.has(fact.claimId))
    .sort(byText);
  const counterexamples = [...against.values()].sort(byText);
  const openQuestions = snapshot.questions
    .filter(
      (question) =>
        question.status === "open" &&
        question.targets.some(
          (target) =>
            target.kind === "hypothesis" && hypothesisIds.has(target.id),
        ),
    )
    .map((question) => ({
      questionId: question.id,
      question: question.question,
    }))
    .sort((left, right) => left.questionId.localeCompare(right.questionId));
  const relationId =
    projection.focus.kind === "relation" ? projection.focus.id : null;
  const relation = relationId
    ? snapshot.relations.find((item) => item.id === relationId)
    : undefined;
  const describe = (hypothesis: Hypothesis): SynthesisReading => {
    const live = hypothesis.evidence.filter(
      (item) => item.supersededRevision === null,
    );
    const alternative = snapshot.hypotheses.find(
      (item) =>
        item.id !== hypothesis.id &&
        (item.id === hypothesis.alternativeTo ||
          item.alternativeTo === hypothesis.id),
    );
    return {
      hypothesisId: hypothesis.id,
      statement: hypothesis.statement,
      depth: hypothesis.depth,
      status: hypothesis.status,
      confidence: hypothesis.confidence,
      rank: hypothesis.rank,
      supports: live.filter((item) => item.stance === "supports").length,
      contradicts: live.filter((item) => item.stance === "contradicts").length,
      alternative: alternative?.statement ?? null,
    };
  };
  const active = (item: Hypothesis) =>
    item.status !== "superseded" && item.status !== "contradicted";
  const principal = readings.find(active) ?? null;
  const sharesSubject = (left: Hypothesis, right: Hypothesis) =>
    left.subjects.some((a) =>
      right.subjects.some((b) => JSON.stringify(a) === JSON.stringify(b)),
    );
  const competitor = principal
    ? (snapshot.hypotheses.find(
        (item) =>
          item.id !== principal.id &&
          active(item) &&
          (item.id === principal.alternativeTo ||
            item.alternativeTo === principal.id),
      ) ??
      readings.find(
        (item) =>
          item.id !== principal.id &&
          active(item) &&
          sharesSubject(item, principal),
      ) ??
      null)
    : null;
  const situationIds = new Set([principal?.id, competitor?.id].filter(Boolean));
  const situationQuestion =
    snapshot.questions
      .filter(
        (question) =>
          question.status === "open" &&
          question.targets.some(
            (target) =>
              target.kind === "hypothesis" && situationIds.has(target.id),
          ),
      )
      .sort(
        (left, right) =>
          right.createdAt.localeCompare(left.createdAt) ||
          left.id.localeCompare(right.id),
      )[0] ?? null;
  return {
    revision: projection.revision,
    situation: {
      principal: principal ? describe(principal) : null,
      competitor: competitor ? describe(competitor) : null,
      question: situationQuestion
        ? {
            questionId: situationQuestion.id,
            question: situationQuestion.question,
          }
        : null,
    },
    facts: facts.slice(0, MAX_FACTS),
    readings: readings.slice(0, MAX_READINGS).map((hypothesis) => {
      const live = hypothesis.evidence.filter(
        (item) => item.supersededRevision === null,
      );
      const alternative = snapshot.hypotheses.find(
        (item) =>
          item.id !== hypothesis.id &&
          (item.id === hypothesis.alternativeTo ||
            item.alternativeTo === hypothesis.id),
      );
      return {
        hypothesisId: hypothesis.id,
        statement: hypothesis.statement,
        depth: hypothesis.depth,
        status: hypothesis.status,
        confidence: hypothesis.confidence,
        rank: hypothesis.rank,
        supports: live.filter((item) => item.stance === "supports").length,
        contradicts: live.filter((item) => item.stance === "contradicts")
          .length,
        alternative: alternative?.statement ?? null,
      };
    }),
    counterexamples: counterexamples.slice(0, MAX_FACTS),
    openQuestions,
    relation: relation
      ? {
          episodes: relation.indicators.episodes,
          counterexamples: relation.indicators.counterexamples,
          episodesPer30Days: relation.indicators.episodesPer30Days,
        }
      : null,
    truncated:
      facts.length > MAX_FACTS ||
      readings.length > MAX_READINGS ||
      counterexamples.length > MAX_FACTS,
  };
}
