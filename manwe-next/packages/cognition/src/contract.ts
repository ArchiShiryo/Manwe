import { createHash } from "node:crypto";
import {
  DomainError,
  type ClaimModality,
  type EntityRef,
  type InformationCategory,
  type TemporalPrecision,
} from "../../domain/src/memory.ts";

export const COGNITION_SCHEMA_VERSION = "1.4" as const;
export const COGNITION_VALIDATOR_VERSION = "1.2.0" as const;
export const COGNITION_MAX_BYTES = 1024 * 1024;
export const COGNITION_MAX_OPERATIONS = 100;

export type AnalysisMode = "demo-fixture" | "assisted" | "automatic";
export type AnalysisTask = "extract" | "interpret" | "revise" | "explore";
export type AnalysisStatus =
  | "awaiting_response"
  | "ready_for_review"
  | "needs_context"
  | "applied"
  | "no_change"
  | "rejected"
  | "stale"
  | "cancelled"
  | "expired";

export type CognitiveOperationKind =
  | "propose_event"
  | "propose_claim"
  | "propose_hypothesis"
  | "revise_hypothesis"
  | "propose_question"
  | "propose_critique"
  | "propose_role";

export const COGNITIVE_OPERATION_KINDS: CognitiveOperationKind[] = [
  "propose_event",
  "propose_claim",
  "propose_hypothesis",
  "revise_hypothesis",
  "propose_question",
  "propose_critique",
  "propose_role",
];

/** Opérations proposées par défaut selon la tâche (contrat 1.2). */
export const DEFAULT_OPERATIONS: Record<
  AnalysisTask,
  CognitiveOperationKind[]
> = {
  extract: ["propose_event", "propose_claim", "propose_role"],
  interpret: [
    "propose_event",
    "propose_claim",
    "propose_role",
    "propose_hypothesis",
    "propose_question",
    "propose_critique",
  ],
  revise: [
    "propose_event",
    "propose_claim",
    "propose_role",
    "propose_hypothesis",
    "revise_hypothesis",
    "propose_question",
    "propose_critique",
  ],
  explore: ["propose_question"],
};

import {
  CLAIM_CATEGORIES,
  CLAIM_MODALITIES,
  CONFIDENCES,
  CREATION_STATUSES,
  DEPTHS,
  EVIDENCE_STANCES,
  HYPOTHESIS_STATUSES,
  TEMPORAL_PRECISIONS,
  type Confidence,
  type EvidenceStance,
  type HypothesisDepth,
  type HypothesisStatus,
} from "./vocabulary.ts";
import {
  EPISODE_ROLES,
  ROLE_OUTCOMES,
  type EpisodeRole,
  type RoleOutcome,
} from "./relations.ts";

/** Référence à un objet existant, ou à une opération de la même proposition. */
export type LocalRef = { proposalKey: string };
export type TargetRef = EntityRef | LocalRef;

export type MemberInput =
  | { person: EntityRef }
  | { mention: string }
  | { self: true };
/** Un sujet est une personne, l'utilisateur, ou une relation entre deux membres (D-012). */
export type HypothesisSubjectInput = MemberInput | { relation: MemberInput[] };

export type EvidenceInput = {
  claim: TargetRef;
  stance: EvidenceStance;
};

/**
 * Formulation mécaniste d'une lecture (D-017, D-019) : ce que la personne
 * optimise ou protège, comment, et ce que cela prédit. Tous les champs sont
 * facultatifs ; une formulation vide est refusée.
 */
export const MECHANISM_KEYS = [
  "optimizes",
  "protects",
  "defenses",
  "beliefs",
  "triggers",
  "soothes",
  "barrier",
  "prediction",
] as const;
export type Mechanism = Partial<
  Record<(typeof MECHANISM_KEYS)[number], string>
>;

type HypothesisPayload = {
  statement: string;
  depth: HypothesisDepth;
  framework: string | null;
  construct: string | null;
  confidence: Confidence;
  subjects: HypothesisSubjectInput[];
  evidence: EvidenceInput[];
  limits: string;
  revisionConditions: string;
  alternativeTo: TargetRef | null;
  validFrom: string | null;
  validTo: string | null;
  /** Statut demandé dès la création ; « plausible » seulement si les règles l'autorisent (D-015). */
  status: (typeof CREATION_STATUSES)[number];
  /** Classement parmi les lectures d'un même sujet ; 1 = lecture principale. */
  rank: number | null;
  mechanism: Mechanism | null;
};

type RevisePayload = {
  target: EntityRef;
  expectedRowVersion: number;
  status: HypothesisStatus;
  confidence: Confidence;
  addEvidence: EvidenceInput[];
  /** Nouveau classement ; absent = inchangé. */
  rank?: number | null;
};

export const CRITIQUE_KINDS = [
  "ignored_evidence",
  "simpler_explanation",
  "overgeneralization",
  "alternative_not_distinct",
  "circular_reasoning",
  "other",
] as const;

export type CritiqueFinding = {
  kind: (typeof CRITIQUE_KINDS)[number];
  detail: string;
  claims: TargetRef[];
};

type CritiquePayload = {
  target: EntityRef;
  findings: CritiqueFinding[];
};

type RolePayload = {
  /** Événement du paquet, ou propose_event de cette réponse. */
  event: TargetRef;
  subject: MemberInput;
  role: EpisodeRole;
  outcome: RoleOutcome | null;
  citations: SourceCitation[];
};

type QuestionPayload = {
  question: string;
  targets: TargetRef[];
  discriminatingInfo: string;
  whyNow: string;
};

export type SourceCitation = {
  sourceId: string;
  contentHash: string;
  spanStart: number;
  spanEnd: number;
  quote: string;
};

type ClaimPayload = {
  text: string;
  category: Exclude<InformationCategory, "unclassified_note">;
  modality: ClaimModality;
  validFrom: string | null;
  validTo: string | null;
  citations: SourceCitation[];
};

type EventPayload = {
  title: string;
  text: string;
  category: Exclude<InformationCategory, "unclassified_note">;
  occurredStart: string | null;
  occurredEnd: string | null;
  temporalPrecision: TemporalPrecision;
  context: string | null;
  citations: SourceCitation[];
};

export type CognitiveOperation =
  | {
      key: string;
      kind: "propose_claim";
      payload: ClaimPayload;
      rationale: string;
    }
  | {
      key: string;
      kind: "propose_event";
      payload: EventPayload;
      rationale: string;
    }
  | {
      key: string;
      kind: "propose_hypothesis";
      payload: HypothesisPayload;
      rationale: string;
    }
  | {
      key: string;
      kind: "revise_hypothesis";
      payload: RevisePayload;
      rationale: string;
    }
  | {
      key: string;
      kind: "propose_question";
      payload: QuestionPayload;
      rationale: string;
    }
  | {
      key: string;
      kind: "propose_critique";
      payload: CritiquePayload;
      rationale: string;
    }
  | {
      key: string;
      kind: "propose_role";
      payload: RolePayload;
      rationale: string;
    };

export type CognitiveProposal = {
  schemaVersion: typeof COGNITION_SCHEMA_VERSION;
  requestId: string;
  workspaceId: string;
  baseRevision: number;
  contextHash: string;
  modelDeclaration: {
    declaredModel: string;
    role: string;
    technicalId: string | null;
  };
  outcome: "proposed" | "no_change" | "needs_context";
  operations: CognitiveOperation[];
  clarifications: { question: string; relatedRefs: EntityRef[] }[];
  summary: string;
};

export type ContextPacket = {
  schemaVersion: typeof COGNITION_SCHEMA_VERSION;
  requestId: string;
  workspaceId: string;
  baseRevision: number;
  createdAt: string;
  expiresAt: string;
  mode: AnalysisMode;
  providerId: string;
  task: AnalysisTask;
  promptVersion: string;
  contextHash: string;
  focus: EntityRef[];
  sources: Array<SourceCitation & { text: string }>;
  entities: unknown[];
  episodes: unknown[];
  claims: unknown[];
  hypotheses: unknown[];
  annotations: unknown[];
  questions: unknown[];
  goals: unknown[];
  /** Rôles des épisodes du paquet (D-013). */
  roles: unknown[];
  /** Relations pertinentes et leurs indicateurs calculés (D-012). */
  relations: unknown[];
  coverage: { included: string[]; omissions: string[]; truncated: boolean };
  allowedOperations: CognitiveOperationKind[];
  limits: { maxBytes: number; maxOperations: number };
};

export type ApplicationResult = {
  requestId: string;
  responseId: string;
  status: "applied" | "no_change";
  baseRevision: number;
  resultRevision: number;
  createdIds: EntityRef[];
  changedIds: EntityRef[];
  warnings: Array<{ code: string; message: string }>;
  errors: Array<{ code: string; message: string }>;
  replayed: boolean;
};

export type PrepareAnalysisCommand = {
  task: AnalysisTask;
  focus?: EntityRef[];
  allowedOperations?: CognitiveOperationKind[];
  expiresAt?: string;
  mode?: AnalysisMode;
  providerId?: string;
};

export type AnalysisPreview = {
  requestId: string;
  responseId: string;
  status:
    | "ready_for_review"
    | "needs_context"
    | "rejected"
    | "applied"
    | "no_change"
    | "stale";
  outcome: CognitiveProposal["outcome"] | null;
  summary: string | null;
  operations: CognitiveOperation[];
  errors: Array<{ code: string; message: string }>;
  applicationResult: ApplicationResult | null;
  telemetry: {
    manualWaitDurationMs: number | null;
    inferenceDurationMs: number | null;
    usage: unknown | null;
    cost: unknown | null;
  };
  replayed: boolean;
};

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(",")}}`;
  }
  const serialized = JSON.stringify(value);
  if (serialized === undefined)
    throw new DomainError(
      "invalid_json_value",
      "Valeur JSON non sérialisable.",
    );
  return serialized;
}

export const cognitionHash = (value: unknown) =>
  createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");

function object(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new DomainError("invalid_proposal", `${name} doit être un objet.`);
  return value as Record<string, unknown>;
}

function exactKeys(
  value: Record<string, unknown>,
  allowed: string[],
  name: string,
) {
  const extra = Object.keys(value).filter((key) => !allowed.includes(key));
  if (extra.length)
    throw new DomainError(
      "unknown_field",
      `${name} contient des champs inconnus : ${extra.join(", ")}.`,
    );
}

function text(value: unknown, name: string, maximum: number) {
  if (typeof value !== "string" || !value.trim() || value.length > maximum)
    throw new DomainError(
      "invalid_proposal",
      `${name} doit contenir entre 1 et ${maximum} caractères.`,
    );
  return value.trim();
}

const dateOrNull = (value: unknown, name: string) => {
  if (value === null) return null;
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value)))
    throw new DomainError(
      "invalid_date",
      `${name} doit être une date ISO ou null.`,
    );
  return value;
};

function reference(value: unknown): EntityRef {
  const input = object(value, "reference");
  exactKeys(input, ["kind", "id"], "reference");
  const kinds = [
    "source",
    "event",
    "person",
    "episode",
    "claim",
    "hypothesis",
    "question",
    "goal",
    "annotation",
  ];
  if (
    !kinds.includes(String(input.kind)) ||
    typeof input.id !== "string" ||
    !input.id
  )
    throw new DomainError("invalid_reference", "Référence cognitive invalide.");
  return { kind: input.kind as EntityRef["kind"], id: input.id };
}

function citation(value: unknown): SourceCitation {
  const input = object(value, "citation");
  exactKeys(
    input,
    ["sourceId", "contentHash", "spanStart", "spanEnd", "quote"],
    "citation",
  );
  if (typeof input.sourceId !== "string" || !input.sourceId)
    throw new DomainError("invalid_citation", "sourceId est requis.");
  if (
    typeof input.contentHash !== "string" ||
    !/^[a-f0-9]{64}$/.test(input.contentHash)
  )
    throw new DomainError("invalid_citation", "contentHash est invalide.");
  if (
    !Number.isInteger(input.spanStart) ||
    !Number.isInteger(input.spanEnd) ||
    Number(input.spanStart) < 0 ||
    Number(input.spanEnd) < Number(input.spanStart)
  )
    throw new DomainError("invalid_citation", "Bornes de citation invalides.");
  return {
    sourceId: input.sourceId,
    contentHash: input.contentHash,
    spanStart: Number(input.spanStart),
    spanEnd: Number(input.spanEnd),
    quote: typeof input.quote === "string" ? input.quote : "",
  };
}

function citations(value: unknown) {
  if (!Array.isArray(value) || value.length === 0 || value.length > 20)
    throw new DomainError(
      "invalid_citation",
      "Chaque opération exige entre 1 et 20 citations.",
    );
  return value.map(citation);
}

const categories: readonly Exclude<InformationCategory, "unclassified_note">[] =
  CLAIM_CATEGORIES;
const claimModalities: readonly ClaimModality[] = CLAIM_MODALITIES;
const precisions: readonly TemporalPrecision[] = TEMPORAL_PRECISIONS;

function targetRef(value: unknown, name: string): TargetRef {
  const input = object(value, name);
  if ("proposalKey" in input) {
    exactKeys(input, ["proposalKey"], name);
    return { proposalKey: text(input.proposalKey, `${name}.proposalKey`, 80) };
  }
  return reference(input);
}

function oneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
  code: string,
  message: string,
): T {
  if (!allowed.includes(value as T)) throw new DomainError(code, message);
  return value as T;
}

function textOrNull(value: unknown, name: string, maximum: number) {
  return value === null ? null : text(value, name, maximum);
}

function evidenceList(value: unknown, name: string): EvidenceInput[] {
  if (!Array.isArray(value) || value.length > 50)
    throw new DomainError(
      "invalid_evidence",
      `${name} doit être une liste de 0 à 50 preuves.`,
    );
  return value.map((item) => {
    const input = object(item, name);
    exactKeys(input, ["claim", "stance"], name);
    return {
      claim: targetRef(input.claim, `${name}.claim`),
      stance: oneOf(
        input.stance,
        EVIDENCE_STANCES,
        "invalid_evidence",
        "stance doit valoir supports ou contradicts.",
      ),
    };
  });
}

const depths = DEPTHS;
const confidences = CONFIDENCES;
const hypothesisStatuses = HYPOTHESIS_STATUSES;

function subjectInput(value: unknown): HypothesisSubjectInput {
  const input = object(value, "subject");
  if ("relation" in input) {
    exactKeys(input, ["relation"], "subject");
    if (!Array.isArray(input.relation) || input.relation.length !== 2)
      throw new DomainError(
        "invalid_subject",
        "Une relation réunit exactement deux membres (dyade).",
      );
    return { relation: input.relation.map(memberInput) };
  }
  return memberInput(value);
}

function memberInput(value: unknown): MemberInput {
  const input = object(value, "subject");
  const keys = Object.keys(input);
  if (keys.length !== 1)
    throw new DomainError(
      "invalid_subject",
      "Un sujet est { person }, { mention } ou { self: true }.",
    );
  if ("person" in input) {
    const person = reference(input.person);
    if (person.kind !== "person")
      throw new DomainError(
        "invalid_subject",
        "Le sujet doit être une personne.",
      );
    return { person };
  }
  if ("mention" in input)
    return { mention: text(input.mention, "subject.mention", 120) };
  if ("self" in input && input.self === true) return { self: true };
  throw new DomainError(
    "invalid_subject",
    "Un sujet est { person }, { mention } ou { self: true }.",
  );
}

function hypothesisOperation(
  key: string,
  rationale: string,
  payload: Record<string, unknown>,
): CognitiveOperation {
  exactKeys(
    payload,
    [
      "statement",
      "depth",
      "framework",
      "construct",
      "confidence",
      "subjects",
      "evidence",
      "limits",
      "revisionConditions",
      "alternativeTo",
      "validFrom",
      "validTo",
      "status",
      "rank",
      "mechanism",
    ],
    "propose_hypothesis.payload",
  );
  if (!Array.isArray(payload.subjects) || payload.subjects.length === 0)
    throw new DomainError(
      "invalid_subject",
      "Une hypothèse exige au moins un sujet.",
    );
  const evidence = evidenceList(payload.evidence, "hypothesis.evidence");
  if (!evidence.some((item) => item.stance === "supports"))
    throw new DomainError(
      "invalid_evidence",
      "Une hypothèse exige au moins une preuve favorable.",
    );
  return {
    key,
    kind: "propose_hypothesis",
    rationale,
    payload: {
      statement: text(payload.statement, "hypothesis.statement", 2_000),
      depth: oneOf(
        payload.depth,
        depths,
        "invalid_depth",
        "Profondeur inconnue.",
      ),
      framework: textOrNull(payload.framework, "hypothesis.framework", 240),
      construct: textOrNull(payload.construct, "hypothesis.construct", 240),
      confidence: oneOf(
        payload.confidence,
        confidences,
        "invalid_confidence",
        "Confiance inconnue.",
      ),
      subjects: payload.subjects.map(subjectInput),
      evidence,
      limits: text(payload.limits, "hypothesis.limits", 2_000),
      revisionConditions: text(
        payload.revisionConditions,
        "hypothesis.revisionConditions",
        2_000,
      ),
      alternativeTo:
        payload.alternativeTo === null
          ? null
          : targetRef(payload.alternativeTo, "hypothesis.alternativeTo"),
      validFrom: dateOrNull(payload.validFrom, "hypothesis.validFrom"),
      validTo: dateOrNull(payload.validTo, "hypothesis.validTo"),
      status:
        payload.status === undefined
          ? "draft"
          : oneOf(
              payload.status,
              CREATION_STATUSES,
              "invalid_status",
              "À la création, le statut est « draft » ou « plausible ».",
            ),
      rank: rankOrNull(payload.rank, "hypothesis.rank"),
      mechanism: mechanismOrNull(payload.mechanism),
    },
  };
}

function rankOrNull(value: unknown, name: string) {
  if (value === undefined || value === null) return null;
  if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > 20)
    throw new DomainError(
      "invalid_rank",
      `${name} doit être un entier entre 1 et 20, ou null.`,
    );
  return Number(value);
}

function mechanismOrNull(value: unknown): Mechanism | null {
  if (value === undefined || value === null) return null;
  const input = object(value, "hypothesis.mechanism");
  exactKeys(input, [...MECHANISM_KEYS], "hypothesis.mechanism");
  const mechanism: Mechanism = {};
  for (const key of MECHANISM_KEYS)
    if (input[key] !== undefined && input[key] !== null)
      mechanism[key] = text(input[key], `mechanism.${key}`, 1_000);
  if (!Object.keys(mechanism).length)
    throw new DomainError(
      "invalid_mechanism",
      "Une formulation mécaniste renseigne au moins un champ.",
    );
  return mechanism;
}

function reviseOperation(
  key: string,
  rationale: string,
  payload: Record<string, unknown>,
): CognitiveOperation {
  exactKeys(
    payload,
    [
      "target",
      "expectedRowVersion",
      "status",
      "confidence",
      "addEvidence",
      "rank",
    ],
    "revise_hypothesis.payload",
  );
  const target = reference(payload.target);
  if (target.kind !== "hypothesis")
    throw new DomainError(
      "invalid_reference",
      "revise_hypothesis vise une hypothèse existante.",
    );
  if (
    !Number.isInteger(payload.expectedRowVersion) ||
    Number(payload.expectedRowVersion) < 1
  )
    throw new DomainError(
      "invalid_proposal",
      "expectedRowVersion doit être un entier positif.",
    );
  return {
    key,
    kind: "revise_hypothesis",
    rationale,
    payload: {
      target,
      expectedRowVersion: Number(payload.expectedRowVersion),
      status: oneOf(
        payload.status,
        hypothesisStatuses,
        "invalid_status",
        "Statut d’hypothèse inconnu.",
      ),
      confidence: oneOf(
        payload.confidence,
        confidences,
        "invalid_confidence",
        "Confiance inconnue.",
      ),
      addEvidence: evidenceList(payload.addEvidence, "revise.addEvidence"),
      ...(payload.rank === undefined
        ? {}
        : { rank: rankOrNull(payload.rank, "revise.rank") }),
    },
  };
}

function questionOperation(
  key: string,
  rationale: string,
  payload: Record<string, unknown>,
): CognitiveOperation {
  exactKeys(
    payload,
    ["question", "targets", "discriminatingInfo", "whyNow"],
    "propose_question.payload",
  );
  if (
    !Array.isArray(payload.targets) ||
    payload.targets.length === 0 ||
    payload.targets.length > 10
  )
    throw new DomainError(
      "invalid_question",
      "Une question cible entre 1 et 10 hypothèses.",
    );
  return {
    key,
    kind: "propose_question",
    rationale,
    payload: {
      question: text(payload.question, "question.question", 500),
      targets: payload.targets.map((item) =>
        targetRef(item, "question.targets"),
      ),
      discriminatingInfo: text(
        payload.discriminatingInfo,
        "question.discriminatingInfo",
        1_000,
      ),
      whyNow: text(payload.whyNow, "question.whyNow", 1_000),
    },
  };
}

function critiqueOperation(
  key: string,
  rationale: string,
  payload: Record<string, unknown>,
): CognitiveOperation {
  exactKeys(payload, ["target", "findings"], "propose_critique.payload");
  const target = reference(payload.target);
  if (target.kind !== "hypothesis")
    throw new DomainError(
      "invalid_reference",
      "propose_critique vise une hypothèse existante.",
    );
  if (!Array.isArray(payload.findings) || payload.findings.length > 20)
    throw new DomainError(
      "invalid_critique",
      "findings est une liste de 0 à 20 constats.",
    );
  return {
    key,
    kind: "propose_critique",
    rationale,
    payload: {
      target,
      findings: payload.findings.map((item) => {
        const finding = object(item, "critique.finding");
        exactKeys(finding, ["kind", "detail", "claims"], "critique.finding");
        if (!Array.isArray(finding.claims) || finding.claims.length > 20)
          throw new DomainError(
            "invalid_critique",
            "claims est une liste de 0 à 20 références.",
          );
        return {
          kind: oneOf(
            finding.kind,
            CRITIQUE_KINDS,
            "invalid_critique",
            "Type de constat critique inconnu.",
          ),
          detail: text(finding.detail, "critique.detail", 1_000),
          claims: finding.claims.map((claim) =>
            targetRef(claim, "critique.claims"),
          ),
        };
      }),
    },
  };
}

function operation(value: unknown): CognitiveOperation {
  const input = object(value, "operation");
  exactKeys(input, ["key", "kind", "payload", "rationale"], "operation");
  const key = text(input.key, "operation.key", 80);
  const rationale = text(input.rationale, "operation.rationale", 800);
  const payload = object(input.payload, "operation.payload");
  if (input.kind === "propose_role") {
    exactKeys(
      payload,
      ["event", "subject", "role", "outcome", "citations"],
      "propose_role.payload",
    );
    return {
      key,
      kind: "propose_role",
      rationale,
      payload: {
        event: targetRef(payload.event, "role.event"),
        subject: memberInput(payload.subject),
        role: oneOf(
          payload.role,
          EPISODE_ROLES,
          "invalid_role",
          "Rôle d’épisode inconnu.",
        ),
        outcome:
          payload.outcome === null || payload.outcome === undefined
            ? null
            : oneOf(
                payload.outcome,
                ROLE_OUTCOMES,
                "invalid_role",
                "Issue de rôle inconnue.",
              ),
        citations: citations(payload.citations),
      },
    };
  }
  if (input.kind === "propose_claim") {
    exactKeys(
      payload,
      ["text", "category", "modality", "validFrom", "validTo", "citations"],
      "propose_claim.payload",
    );
    if (!categories.includes(payload.category as (typeof categories)[number]))
      throw new DomainError("invalid_category", "Catégorie de claim inconnue.");
    if (!claimModalities.includes(payload.modality as ClaimModality))
      throw new DomainError("invalid_modality", "Modalité de claim inconnue.");
    return {
      key,
      kind: input.kind,
      rationale,
      payload: {
        text: text(payload.text, "claim.text", 2_000),
        category: payload.category as ClaimPayload["category"],
        modality: payload.modality as ClaimModality,
        validFrom: dateOrNull(payload.validFrom, "claim.validFrom"),
        validTo: dateOrNull(payload.validTo, "claim.validTo"),
        citations: citations(payload.citations),
      },
    };
  }
  if (input.kind === "propose_event") {
    exactKeys(
      payload,
      [
        "title",
        "text",
        "category",
        "occurredStart",
        "occurredEnd",
        "temporalPrecision",
        "context",
        "citations",
      ],
      "propose_event.payload",
    );
    if (!categories.includes(payload.category as (typeof categories)[number]))
      throw new DomainError(
        "invalid_category",
        "Catégorie d’événement inconnue.",
      );
    if (!precisions.includes(payload.temporalPrecision as TemporalPrecision))
      throw new DomainError(
        "invalid_temporal_precision",
        "Précision temporelle inconnue.",
      );
    const occurredStart = dateOrNull(
      payload.occurredStart,
      "event.occurredStart",
    );
    const occurredEnd = dateOrNull(payload.occurredEnd, "event.occurredEnd");
    if (
      (payload.temporalPrecision === "interval" &&
        (!occurredStart || !occurredEnd)) ||
      (payload.temporalPrecision === "unknown" &&
        (occurredStart || occurredEnd)) ||
      (occurredEnd &&
        occurredStart &&
        Date.parse(occurredEnd) < Date.parse(occurredStart))
    )
      throw new DomainError("invalid_interval", "Temps proposé incohérent.");
    return {
      key,
      kind: input.kind,
      rationale,
      payload: {
        title: text(payload.title, "event.title", 160),
        text: text(payload.text, "event.text", 12_000),
        category: payload.category as EventPayload["category"],
        occurredStart,
        occurredEnd,
        temporalPrecision: payload.temporalPrecision as TemporalPrecision,
        context:
          payload.context === null
            ? null
            : text(payload.context, "event.context", 240),
        citations: citations(payload.citations),
      },
    };
  }
  if (input.kind === "propose_hypothesis")
    return hypothesisOperation(key, rationale, payload);
  if (input.kind === "revise_hypothesis")
    return reviseOperation(key, rationale, payload);
  if (input.kind === "propose_question")
    return questionOperation(key, rationale, payload);
  if (input.kind === "propose_critique")
    return critiqueOperation(key, rationale, payload);
  throw new DomainError(
    "operation_not_allowed",
    "Opération cognitive inconnue.",
  );
}

export function parseCognitiveProposal(value: unknown): CognitiveProposal {
  const input = object(value, "proposal");
  exactKeys(
    input,
    [
      "schemaVersion",
      "requestId",
      "workspaceId",
      "baseRevision",
      "contextHash",
      "modelDeclaration",
      "outcome",
      "operations",
      "clarifications",
      "summary",
    ],
    "proposal",
  );
  if (input.schemaVersion !== COGNITION_SCHEMA_VERSION)
    throw new DomainError(
      "unsupported_schema_version",
      "Version cognitive non prise en charge.",
    );
  if (!Number.isInteger(input.baseRevision) || Number(input.baseRevision) < 0)
    throw new DomainError("invalid_revision", "Révision de base invalide.");
  if (
    typeof input.contextHash !== "string" ||
    !/^[a-f0-9]{64}$/.test(input.contextHash)
  )
    throw new DomainError(
      "invalid_context_hash",
      "Empreinte de contexte invalide.",
    );
  const declaration = object(input.modelDeclaration, "modelDeclaration");
  exactKeys(
    declaration,
    ["declaredModel", "role", "technicalId"],
    "modelDeclaration",
  );
  if (
    declaration.technicalId !== null &&
    typeof declaration.technicalId !== "string"
  )
    throw new DomainError(
      "invalid_model_declaration",
      "technicalId doit être une chaîne ou null.",
    );
  const outcomes = ["proposed", "no_change", "needs_context"] as const;
  if (!outcomes.includes(input.outcome as (typeof outcomes)[number]))
    throw new DomainError("invalid_outcome", "Résultat cognitif inconnu.");
  if (
    !Array.isArray(input.operations) ||
    input.operations.length > COGNITION_MAX_OPERATIONS
  )
    throw new DomainError(
      "too_many_operations",
      "Liste d’opérations invalide ou trop longue.",
    );
  const operations = input.operations.map(operation);
  if (new Set(operations.map((item) => item.key)).size !== operations.length)
    throw new DomainError(
      "duplicate_operation_key",
      "Clé d’opération dupliquée.",
    );
  if (input.outcome !== "proposed" && operations.length)
    throw new DomainError(
      "invalid_outcome",
      "Ce résultat impose une liste d’opérations vide.",
    );
  if (input.outcome === "proposed" && operations.length === 0)
    throw new DomainError(
      "empty_proposal",
      "Une proposition doit contenir une opération.",
    );
  if (!Array.isArray(input.clarifications))
    throw new DomainError(
      "invalid_clarifications",
      "clarifications doit être une liste.",
    );
  const clarifications = input.clarifications.map((value) => {
    const clarification = object(value, "clarification");
    exactKeys(clarification, ["question", "relatedRefs"], "clarification");
    if (!Array.isArray(clarification.relatedRefs))
      throw new DomainError(
        "invalid_clarifications",
        "relatedRefs doit être une liste.",
      );
    return {
      question: text(clarification.question, "clarification.question", 500),
      relatedRefs: clarification.relatedRefs.map(reference),
    };
  });
  if (input.outcome === "needs_context" && clarifications.length === 0)
    throw new DomainError(
      "missing_clarification",
      "Une clarification ciblée est requise.",
    );
  return {
    schemaVersion: COGNITION_SCHEMA_VERSION,
    requestId: text(input.requestId, "requestId", 128),
    workspaceId: text(input.workspaceId, "workspaceId", 128),
    baseRevision: Number(input.baseRevision),
    contextHash: input.contextHash,
    modelDeclaration: {
      declaredModel: text(declaration.declaredModel, "declaredModel", 160),
      role: text(declaration.role, "role", 160),
      technicalId: declaration.technicalId,
    },
    outcome: input.outcome as CognitiveProposal["outcome"],
    operations,
    clarifications,
    summary: text(input.summary, "summary", 2_000),
  };
}

export function parsePrepareAnalysisCommand(
  value: unknown,
): PrepareAnalysisCommand {
  const input = object(value, "analysis.prepare");
  exactKeys(
    input,
    ["task", "focus", "allowedOperations", "expiresAt", "mode", "providerId"],
    "analysis.prepare",
  );
  const tasks: AnalysisTask[] = ["extract", "interpret", "revise", "explore"];
  if (!tasks.includes(input.task as AnalysisTask))
    throw new DomainError("invalid_analysis_task", "Tâche d’analyse inconnue.");
  const focus = input.focus ?? [];
  if (!Array.isArray(focus))
    throw new DomainError("invalid_focus", "focus doit être une liste.");
  const allowed =
    input.allowedOperations ?? DEFAULT_OPERATIONS[input.task as AnalysisTask];
  if (!Array.isArray(allowed))
    throw new DomainError(
      "invalid_allowed_operations",
      "allowedOperations doit être une liste.",
    );
  if (
    allowed.length === 0 ||
    allowed.some(
      (kind) =>
        !COGNITIVE_OPERATION_KINDS.includes(kind as CognitiveOperationKind),
    )
  )
    throw new DomainError(
      "invalid_allowed_operations",
      "Une opération autorisée est inconnue.",
    );
  const modes: AnalysisMode[] = ["demo-fixture", "assisted", "automatic"];
  const mode = input.mode ?? "assisted";
  if (!modes.includes(mode as AnalysisMode))
    throw new DomainError("invalid_analysis_mode", "Mode d’analyse inconnu.");
  if (
    input.expiresAt !== undefined &&
    (typeof input.expiresAt !== "string" ||
      !Number.isFinite(Date.parse(input.expiresAt)))
  )
    throw new DomainError(
      "invalid_expiration",
      "expiresAt doit être une date ISO.",
    );
  return {
    task: input.task as AnalysisTask,
    focus: focus.map(reference),
    allowedOperations: allowed as CognitiveOperationKind[],
    expiresAt: input.expiresAt as string | undefined,
    mode: mode as AnalysisMode,
    providerId:
      input.providerId === undefined
        ? undefined
        : text(input.providerId, "providerId", 160),
  };
}
