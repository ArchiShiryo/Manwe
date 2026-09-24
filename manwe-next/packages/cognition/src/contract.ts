import { createHash } from "node:crypto";
import {
  DomainError,
  type EntityRef,
  type InformationCategory,
  type TemporalPrecision,
} from "../../domain/src/memory.ts";

export const COGNITION_SCHEMA_VERSION = "1.0" as const;
export const COGNITION_VALIDATOR_VERSION = "1.0.0" as const;
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

export type CognitiveOperationKind = "propose_event" | "propose_claim";

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

const categories: Array<Exclude<InformationCategory, "unclassified_note">> = [
  "explicit_statement",
  "sourced_observation",
  "reported_observation",
  "user_impression",
  "inference",
];
const precisions: TemporalPrecision[] = [
  "exact",
  "day",
  "approximate",
  "interval",
  "unknown",
];

function operation(value: unknown): CognitiveOperation {
  const input = object(value, "operation");
  exactKeys(input, ["key", "kind", "payload", "rationale"], "operation");
  const key = text(input.key, "operation.key", 80);
  const rationale = text(input.rationale, "operation.rationale", 800);
  const payload = object(input.payload, "operation.payload");
  if (input.kind === "propose_claim") {
    exactKeys(
      payload,
      ["text", "category", "validFrom", "validTo", "citations"],
      "propose_claim.payload",
    );
    if (!categories.includes(payload.category as (typeof categories)[number]))
      throw new DomainError("invalid_category", "Catégorie de claim inconnue.");
    return {
      key,
      kind: input.kind,
      rationale,
      payload: {
        text: text(payload.text, "claim.text", 2_000),
        category: payload.category as ClaimPayload["category"],
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
      "unsupported_schema",
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
  const allowed = input.allowedOperations ?? ["propose_event", "propose_claim"];
  if (!Array.isArray(allowed))
    throw new DomainError(
      "invalid_allowed_operations",
      "allowedOperations doit être une liste.",
    );
  const known: CognitiveOperationKind[] = ["propose_event", "propose_claim"];
  if (
    allowed.length === 0 ||
    allowed.some((kind) => !known.includes(kind as CognitiveOperationKind))
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
