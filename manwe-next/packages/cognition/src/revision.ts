// Règles déterministes du moteur de révision (R3, décisions D-006 à D-009).
// Fonctions pures : aucune dépendance au stockage ni à Node.

export type HypothesisDepth = "D1" | "D2" | "D3" | "D4" | "D5";
export type HypothesisStatus =
  | "draft"
  | "plausible"
  | "contradicted"
  | "superseded";
export type Confidence = "low" | "moderate" | "high";
export type EvidenceStance = "supports" | "contradicts";

/** Une preuve telle que le stockage la décrit pour les règles. */
export type EvidenceFact = {
  claimId: string;
  stance: EvidenceStance;
  /** Une inférence n'est jamais un ancrage direct (D-007). */
  category: string;
  /** Claim contesté par une correction factuelle de l'utilisateur (D-008). */
  contested: boolean;
  /** Épisode, sinon empreinte de la source : deux copies comptent une fois. */
  unitKey: string;
  /** Date de l'événement source (ISO 8601), si connue. */
  occurredAt: string | null;
};

export type IndependentUnit = {
  key: string;
  anchored: boolean;
  dates: string[];
  claimIds: string[];
};

export type EvidenceSummary = {
  supports: IndependentUnit[];
  contradicts: IndependentUnit[];
  anchoredSupports: number;
  anchoredContradicts: number;
  /** Ancrages favorables diminués des ancrages contraires. */
  netSupport: number;
  /** Étendue en jours entre le premier et le dernier ancrage favorable. */
  supportSpanDays: number;
};

export const PLAUSIBLE_MIN_UNITS: Record<HypothesisDepth, number> = {
  D1: 1,
  D2: 2,
  D3: 2,
  D4: 3,
  D5: 3,
};
/** Spécification §4.4 : un pattern profond doit survivre à un état transitoire. */
export const DEEP_PATTERN_MIN_SPAN_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
const DEPTH_ORDER: HypothesisDepth[] = ["D1", "D2", "D3", "D4", "D5"];
const CONFIDENCE_ORDER: Confidence[] = ["low", "moderate", "high"];

export function depthAtLeast(depth: HypothesisDepth, minimum: HypothesisDepth) {
  return DEPTH_ORDER.indexOf(depth) >= DEPTH_ORDER.indexOf(minimum);
}

export function confidenceAtMost(value: Confidence, ceiling: Confidence) {
  return CONFIDENCE_ORDER.indexOf(value) <= CONFIDENCE_ORDER.indexOf(ceiling);
}

function isAnchor(fact: EvidenceFact) {
  return fact.category !== "inference" && !fact.contested;
}

function groupUnits(facts: EvidenceFact[]): IndependentUnit[] {
  const units = new Map<string, IndependentUnit>();
  for (const fact of facts) {
    const unit = units.get(fact.unitKey) ?? {
      key: fact.unitKey,
      anchored: false,
      dates: [],
      claimIds: [],
    };
    unit.claimIds.push(fact.claimId);
    if (isAnchor(fact)) {
      unit.anchored = true;
      if (fact.occurredAt && Number.isFinite(Date.parse(fact.occurredAt)))
        unit.dates.push(fact.occurredAt);
    }
    units.set(fact.unitKey, unit);
  }
  return [...units.values()];
}

/** Regroupe les preuves en unités indépendantes, de chaque côté (D-007). */
export function independentUnits(evidence: EvidenceFact[]): EvidenceSummary {
  const supports = groupUnits(evidence.filter((e) => e.stance === "supports"));
  const contradicts = groupUnits(
    evidence.filter((e) => e.stance === "contradicts"),
  );
  const anchoredSupports = supports.filter((unit) => unit.anchored).length;
  const anchoredContradicts = contradicts.filter(
    (unit) => unit.anchored,
  ).length;
  const times = supports
    .filter((unit) => unit.anchored)
    .flatMap((unit) => unit.dates.map((date) => Date.parse(date)));
  const supportSpanDays = times.length
    ? (Math.max(...times) - Math.min(...times)) / DAY_MS
    : 0;
  return {
    supports,
    contradicts,
    anchoredSupports,
    anchoredContradicts,
    netSupport: anchoredSupports - anchoredContradicts,
    supportSpanDays,
  };
}

export type HypothesisFacts = {
  depth: HypothesisDepth;
  /** Une hypothèse alternative non dépassée est liée à celle-ci. */
  hasActiveAlternative: boolean;
  /** Au moins une passe critique a été enregistrée (R3.4). */
  critiqued?: boolean;
  /** Passes critiques non encore traitées par une révision. */
  openCritiques?: number;
};

export type StatusCheck = { allowed: boolean; reason: string | null };

/** Dit si un statut est permis par les preuves (T2). */
export function checkStatus(
  status: HypothesisStatus,
  hypothesis: HypothesisFacts,
  summary: EvidenceSummary,
): StatusCheck {
  if (status === "draft" || status === "superseded")
    return { allowed: true, reason: null };
  if (status === "contradicted") {
    if (summary.anchoredContradicts === 0)
      return { allowed: false, reason: "Aucune contre-preuve ancrée." };
    if (summary.anchoredContradicts < summary.anchoredSupports)
      return {
        allowed: false,
        reason: "Les ancrages favorables restent plus nombreux.",
      };
    return { allowed: true, reason: null };
  }
  const minimum = PLAUSIBLE_MIN_UNITS[hypothesis.depth];
  if (summary.netSupport < minimum)
    return {
      allowed: false,
      reason: `${hypothesis.depth} exige ${minimum} épisode(s) indépendant(s) ancré(s) net(s) ; ${summary.netSupport} disponible(s).`,
    };
  if (depthAtLeast(hypothesis.depth, "D3") && !hypothesis.hasActiveAlternative)
    return {
      allowed: false,
      reason: "Une alternative incompatible active est exigée dès D3.",
    };
  if (
    depthAtLeast(hypothesis.depth, "D3") &&
    (!hypothesis.critiqued || (hypothesis.openCritiques ?? 0) > 0)
  )
    return {
      allowed: false,
      reason:
        "Dès D3, une passe critique distincte, puis traitée par une révision, est exigée avant consolidation.",
    };
  if (
    hypothesis.depth === "D4" &&
    summary.supportSpanDays < DEEP_PATTERN_MIN_SPAN_DAYS
  )
    return {
      allowed: false,
      reason: `D4 exige des ancrages étalés sur au moins ${DEEP_PATTERN_MIN_SPAN_DAYS} jours.`,
    };
  return { allowed: true, reason: null };
}

/** Plafond de confiance qualitative permis par les preuves (T2). */
export function maxConfidence(summary: EvidenceSummary): Confidence {
  if (
    summary.netSupport >= 3 &&
    summary.supportSpanDays >= DEEP_PATTERN_MIN_SPAN_DAYS
  )
    return "high";
  if (summary.netSupport >= 2) return "moderate";
  return "low";
}

/** Hypothèses dont au moins une preuve cite un claim modifié ou annoté. */
export function dependentHypotheses(
  changedClaimIds: Iterable<string>,
  links: { hypothesisId: string; claimId: string }[],
): string[] {
  const changed = new Set(changedClaimIds);
  return [
    ...new Set(
      links
        .filter((link) => changed.has(link.claimId))
        .map((link) => link.hypothesisId),
    ),
  ].sort();
}

/** Texte comparable : casse, accents, ponctuation et espaces neutralisés. */
export function normalizeQuestion(text: string) {
  return text
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export type QuestionFootprint = { normalizedText: string; targets: string[] };

function sameTargets(left: string[], right: string[]) {
  const a = [...new Set(left)].sort();
  const b = [...new Set(right)].sort();
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

/** Une question déjà posée à l'identique, quel que soit son statut, n'est pas reposée. */
export function isDuplicateQuestion(
  candidate: { text: string; targets: string[] },
  existing: QuestionFootprint[],
) {
  const normalized = normalizeQuestion(candidate.text);
  return existing.some(
    (question) =>
      question.normalizedText === normalized &&
      sameTargets(question.targets, candidate.targets),
  );
}

/** Un désaccord est traité par une alternative, une contre-preuve ou l'abandon. */
export function disagreementAddressed(input: {
  hasActiveAlternative: boolean;
  addsContradiction: boolean;
  newStatus: HypothesisStatus;
}) {
  return (
    input.hasActiveAlternative ||
    input.addsContradiction ||
    input.newStatus === "superseded"
  );
}
