export const MEMORY_SCHEMA_VERSION = "1.0" as const;
export const IMPORT_MAX_BYTES = 1024 * 1024;
export const IMPORT_MAX_EVENTS = 500;

export type InformationCategory =
  | "explicit_statement"
  | "sourced_observation"
  | "reported_observation"
  | "user_impression"
  | "inference"
  | "unclassified_note";

export type ClaimModality = "actual" | "intended" | "hypothetical";

export type AnnotationType =
  | "factual_correction"
  | "context"
  | "disagreement"
  | "agreement";

export type TemporalPrecision =
  | "exact"
  | "day"
  | "approximate"
  | "interval"
  | "unknown";

export type TargetKind =
  | "source"
  | "event"
  | "person"
  | "episode"
  | "claim"
  | "hypothesis"
  | "question"
  | "goal";

export type EntityKind = TargetKind | "annotation";
export type EntityRef = { kind: EntityKind; id: string };

export type Source = {
  id: string;
  workspaceId: string;
  kind: "user_entry" | "import";
  content: string;
  contentHash: string;
  recordedAt: string;
  narratedAt: string | null;
  sensitivity: "personal" | "private" | "restricted";
  createdAt: string;
};

export type MemoryEvent = {
  id: string;
  workspaceId: string;
  title: string;
  text: string;
  category: InformationCategory;
  sourceId: string;
  episodeId: string | null;
  occurredStart: string | null;
  occurredEnd: string | null;
  temporalPrecision: TemporalPrecision;
  context: string | null;
  revision: number;
  createdAt: string;
  updatedAt: string;
};

export type HumanAnnotation = {
  id: string;
  workspaceId: string;
  target: EntityRef;
  text: string;
  annotationType: AnnotationType;
  revision: number;
  createdAt: string;
};

export type Goal = {
  id: string;
  workspaceId: string;
  text: string;
  confirmedByUser: boolean;
  revision: number;
  createdAt: string;
  updatedAt: string;
};

export type Person = {
  id: string;
  workspaceId: string;
  displayName: string;
  resolutionStatus: "resolved" | "candidate" | "ambiguous";
  revision: number;
  createdAt: string;
  updatedAt: string;
};

export type Episode = {
  id: string;
  workspaceId: string;
  title: string;
  occurredStart: string | null;
  occurredEnd: string | null;
  temporalPrecision: TemporalPrecision;
  context: string | null;
  revision: number;
  createdAt: string;
  updatedAt: string;
};

export type HypothesisSubject =
  | { kind: "person"; personId: string }
  | { kind: "self" };

export type HypothesisEvidence = {
  claimId: string;
  stance: "supports" | "contradicts";
  addedRevision: number;
  supersededRevision: number | null;
};

export type Hypothesis = {
  id: string;
  workspaceId: string;
  statement: string;
  depth: "D1" | "D2" | "D3" | "D4" | "D5";
  framework: string | null;
  construct: string | null;
  confidence: "low" | "moderate" | "high";
  status: "draft" | "plausible" | "contradicted" | "superseded";
  needsReview: boolean;
  reviewReason: "correction" | "context" | "disagreement" | "answer" | null;
  reviewSinceRevision: number | null;
  limits: string | null;
  revisionConditions: string | null;
  validFrom: string | null;
  validTo: string | null;
  alternativeTo: string | null;
  subjects: HypothesisSubject[];
  evidence: HypothesisEvidence[];
  /** Comptages calculés par le backend (D-007), jamais déclarés par le modèle. */
  counts: {
    supportUnits: number;
    contradictUnits: number;
    anchoredSupports: number;
    anchoredContradicts: number;
    supportSpanDays: number;
  };
  createdRevision: number;
  revision: number;
  createdAt: string;
  updatedAt: string;
};

export type OpenQuestion = {
  id: string;
  workspaceId: string;
  question: string;
  status: "open" | "answered" | "unknown" | "dismissed";
  targets: EntityRef[];
  discriminatingInfo: string | null;
  whyNow: string | null;
  answerSourceId: string | null;
  revision: number;
  createdAt: string;
  updatedAt: string;
};

export type Claim = {
  id: string;
  workspaceId: string;
  text: string;
  category: Exclude<InformationCategory, "unclassified_note">;
  modality: ClaimModality;
  knowledgeStatus: "unresolved" | "supported" | "contradicted" | "superseded";
  /** Révision de la correction factuelle de l'utilisateur ; le claim ne compte plus. */
  contestedRevision: number | null;
  validFrom: string | null;
  validTo: string | null;
  revision: number;
  createdAt: string;
  updatedAt: string;
};

export type RevisionEntry = {
  revision: number;
  commandType:
    | "capture"
    | "import"
    | "identity.resolve"
    | "annotate"
    | "goal.update"
    | "analysis.apply"
    | "question.answer";
  changedRefs: EntityRef[];
  createdAt: string;
};

export type IdentityAmbiguity = {
  id: string;
  workspaceId: string;
  eventId: string;
  mention: string;
  candidatePersonIds: string[];
  status: "open" | "resolved" | "dismissed";
  createdAt: string;
  resolvedAt: string | null;
};

export type WorkspaceSnapshot = {
  schemaVersion: typeof MEMORY_SCHEMA_VERSION;
  workspace: { id: string; name: string; revision: number; createdAt: string };
  sources: Source[];
  events: MemoryEvent[];
  annotations: HumanAnnotation[];
  goals: Goal[];
  claims: Claim[];
  persons: Person[];
  episodes: Episode[];
  hypotheses: Hypothesis[];
  questions: OpenQuestion[];
  identityAmbiguities: IdentityAmbiguity[];
  revisions: RevisionEntry[];
};

export type ImportedParticipant = {
  name: string;
  identityKey?: string;
};

export type ImportedEvent = {
  text: string;
  title?: string;
  recordedAt?: string;
  narratedAt?: string | null;
  occurredStart?: string | null;
  occurredEnd?: string | null;
  temporalPrecision?: TemporalPrecision;
  context?: string | null;
  sensitivity?: Source["sensitivity"];
  category?: InformationCategory;
  participants?: ImportedParticipant[];
};

export type ImportCommand = {
  idempotencyKey: string;
  format: "json" | "csv";
  content: string;
  sourceName?: string;
  sourceSystem?: string;
  importedAt?: string;
};

export type ImportResult = CommandResult & {
  importId: string;
  importedEvents: number;
  createdPeople: number;
  linkedParticipants: number;
  ambiguities: Array<{
    ambiguityId: string;
    eventId: string;
    mention: string;
    candidatePersonIds: string[];
  }>;
};

export type ResolveIdentityCommand = {
  idempotencyKey: string;
  ambiguityId: string;
  personId: string;
  resolvedAt?: string;
};

export type CaptureCommand = {
  idempotencyKey: string;
  text: string;
  title?: string;
  recordedAt?: string;
  narratedAt?: string | null;
  occurredStart?: string | null;
  occurredEnd?: string | null;
  temporalPrecision?: TemporalPrecision;
  context?: string | null;
  sensitivity?: Source["sensitivity"];
};

export type MemorySearchQuery = {
  text?: string;
  personId?: string;
  context?: string;
  occurredFrom?: string;
  occurredTo?: string;
  limit?: number;
};

export type MemorySearchResult = {
  event: MemoryEvent;
  source: Source;
  participants: { id: string; displayName: string }[];
};

export type AnnotationCommand = {
  idempotencyKey: string;
  target: { kind: TargetKind; id: string };
  text: string;
  annotationType: AnnotationType;
  createdAt?: string;
};

export type AnswerQuestionCommand = {
  idempotencyKey: string;
  questionId: string;
  /** Réponse libre, « je ne sais pas » ou « ne plus poser ». */
  choice: "text" | "unknown" | "dismiss";
  text?: string;
  recordedAt?: string;
};

export type GoalCommand = {
  idempotencyKey: string;
  goalId?: string;
  text: string;
  createdAt?: string;
};

export type CommandResult = {
  idempotencyKey: string;
  replayed: boolean;
  revision: number;
  created: EntityRef[];
};

export class DomainError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = "DomainError";
    this.code = code;
    this.status = status;
  }
}

const idempotencyPattern = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{7,127}$/;
const isoDate = (value: string) =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}T/.test(value) &&
  Number.isFinite(Date.parse(value));

function requireObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new DomainError("invalid_body", "Le corps doit être un objet JSON.");
  return value as Record<string, unknown>;
}

function requireIdempotencyKey(value: unknown) {
  if (typeof value !== "string" || !idempotencyPattern.test(value))
    throw new DomainError(
      "invalid_idempotency_key",
      "La clé d’idempotence doit contenir 8 à 128 caractères sûrs.",
    );
  return value;
}

function requireText(value: unknown, field: string, maximum: number) {
  if (typeof value !== "string" || !value.trim())
    throw new DomainError("invalid_text", `${field} ne peut pas être vide.`);
  if (value.length > maximum)
    throw new DomainError(
      "text_too_large",
      `${field} dépasse ${maximum} caractères.`,
      413,
    );
  return value.trim();
}

function optionalDate(value: unknown, field: string) {
  if (value === undefined || value === null) return value as undefined | null;
  if (!isoDate(value as string))
    throw new DomainError(
      "invalid_date",
      `${field} doit être une date ISO 8601.`,
    );
  return value as string;
}

export function parseCaptureCommand(value: unknown): CaptureCommand {
  const input = requireObject(value);
  const recordedAt = optionalDate(input.recordedAt, "recordedAt");
  const narratedAt = optionalDate(input.narratedAt, "narratedAt");
  const occurredStart = optionalDate(input.occurredStart, "occurredStart");
  const occurredEnd = optionalDate(input.occurredEnd, "occurredEnd");
  const precisions: TemporalPrecision[] = [
    "exact",
    "day",
    "approximate",
    "interval",
    "unknown",
  ];
  const temporalPrecision = input.temporalPrecision ?? "unknown";
  if (!precisions.includes(temporalPrecision as TemporalPrecision))
    throw new DomainError(
      "invalid_temporal_precision",
      "Précision temporelle inconnue.",
    );
  if (temporalPrecision === "interval" && (!occurredStart || !occurredEnd))
    throw new DomainError(
      "invalid_interval",
      "Un intervalle exige une date de début et une date de fin.",
    );
  if (
    temporalPrecision !== "unknown" &&
    temporalPrecision !== "interval" &&
    !occurredStart
  )
    throw new DomainError(
      "missing_occurrence_date",
      "Cette précision temporelle exige une date d’événement.",
    );
  if (temporalPrecision === "unknown" && (occurredStart || occurredEnd))
    throw new DomainError(
      "unexpected_occurrence_date",
      "Une date d’événement exige une précision temporelle.",
    );
  if (
    occurredEnd &&
    (!occurredStart || Date.parse(occurredEnd) < Date.parse(occurredStart))
  )
    throw new DomainError(
      "invalid_interval",
      "La fin de l’intervalle doit suivre son début.",
    );
  if (temporalPrecision !== "interval" && occurredEnd)
    throw new DomainError(
      "unexpected_interval_end",
      "Une date de fin n’est acceptée que pour un intervalle.",
    );
  const sensitivity = input.sensitivity ?? "personal";
  if (
    !(["personal", "private", "restricted"] as unknown[]).includes(sensitivity)
  )
    throw new DomainError("invalid_sensitivity", "Sensibilité inconnue.");
  const title =
    input.title === undefined
      ? undefined
      : requireText(input.title, "title", 160);
  const context =
    input.context === undefined || input.context === null
      ? null
      : requireText(input.context, "context", 240);
  return {
    idempotencyKey: requireIdempotencyKey(input.idempotencyKey),
    text: requireText(input.text, "text", 12_000),
    title,
    recordedAt: recordedAt ?? undefined,
    narratedAt: narratedAt ?? null,
    occurredStart: occurredStart ?? null,
    occurredEnd: occurredEnd ?? null,
    temporalPrecision: temporalPrecision as TemporalPrecision,
    context,
    sensitivity: sensitivity as Source["sensitivity"],
  };
}

const importEventFields = [
  "text",
  "title",
  "recordedAt",
  "narratedAt",
  "occurredStart",
  "occurredEnd",
  "temporalPrecision",
  "context",
  "sensitivity",
  "category",
  "participants",
] as const;

function rejectUnknownFields(
  value: Record<string, unknown>,
  allowed: readonly string[],
  label: string,
) {
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unknown.length)
    throw new DomainError(
      "unknown_import_field",
      `${label} contient des champs inconnus : ${unknown.join(", ")}.`,
    );
}

function parseImportedParticipant(
  value: unknown,
  index: number,
): ImportedParticipant {
  if (typeof value === "string")
    return { name: requireText(value, `participants[${index}]`, 160) };
  const input = requireObject(value);
  rejectUnknownFields(input, ["name", "identityKey"], "participant");
  return {
    name: requireText(input.name, `participants[${index}].name`, 160),
    identityKey:
      input.identityKey === undefined
        ? undefined
        : requireText(
            input.identityKey,
            `participants[${index}].identityKey`,
            240,
          ),
  };
}

function parseImportedEvent(value: unknown, index: number): ImportedEvent {
  const input = requireObject(value);
  rejectUnknownFields(input, importEventFields, `events[${index}]`);
  const inferredPrecision = input.occurredEnd
    ? "interval"
    : input.occurredStart
      ? "exact"
      : "unknown";
  const capture = parseCaptureCommand({
    idempotencyKey: `import-row:${String(index).padStart(4, "0")}`,
    text: input.text,
    title: input.title,
    recordedAt: input.recordedAt,
    narratedAt: input.narratedAt,
    occurredStart: input.occurredStart,
    occurredEnd: input.occurredEnd,
    temporalPrecision: input.temporalPrecision ?? inferredPrecision,
    context: input.context,
    sensitivity: input.sensitivity,
  });
  const categories: InformationCategory[] = [
    "explicit_statement",
    "sourced_observation",
    "reported_observation",
    "user_impression",
    "inference",
    "unclassified_note",
  ];
  const category = input.category ?? "unclassified_note";
  if (!categories.includes(category as InformationCategory))
    throw new DomainError(
      "invalid_category",
      `events[${index}].category est inconnue.`,
    );
  const participants = input.participants ?? [];
  if (!Array.isArray(participants) || participants.length > 50)
    throw new DomainError(
      "invalid_participants",
      `events[${index}].participants doit contenir au plus 50 entrées.`,
    );
  const { idempotencyKey: _idempotencyKey, ...normalizedCapture } = capture;
  return {
    ...normalizedCapture,
    category: category as InformationCategory,
    participants: participants.map(parseImportedParticipant),
  };
}

function parseCsv(content: string): Record<string, string>[] {
  const firstLine = content.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = firstLine.includes("\t")
    ? "\t"
    : firstLine.includes(";") && !firstLine.includes(",")
      ? ";"
      : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];
    if (character === '"') {
      if (quoted && content[index + 1] === '"') {
        field += '"';
        index += 1;
      } else quoted = !quoted;
    } else if (character === delimiter && !quoted) {
      row.push(field);
      field = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && content[index + 1] === "\n") index += 1;
      row.push(field);
      if (row.some((item) => item.trim())) rows.push(row);
      row = [];
      field = "";
    } else field += character;
  }
  if (quoted)
    throw new DomainError("invalid_csv", "Une cellule CSV n’est pas refermée.");
  row.push(field);
  if (row.some((item) => item.trim())) rows.push(row);
  if (rows.length < 2)
    throw new DomainError(
      "invalid_csv",
      "Le CSV doit contenir un en-tête et au moins une ligne.",
    );
  const headers = rows[0].map((item) => item.trim().replace(/^\uFEFF/, ""));
  if (new Set(headers).size !== headers.length || headers.some((item) => !item))
    throw new DomainError(
      "invalid_csv_header",
      "Les en-têtes CSV doivent être uniques et non vides.",
    );
  rejectUnknownFields(
    Object.fromEntries(headers.map((header) => [header, true])),
    importEventFields,
    "L’en-tête CSV",
  );
  if (!headers.includes("text"))
    throw new DomainError(
      "missing_csv_text",
      "L’en-tête CSV doit contenir text.",
    );
  return rows.slice(1).map((cells, rowIndex) => {
    if (cells.length !== headers.length)
      throw new DomainError(
        "invalid_csv_row",
        `La ligne CSV ${rowIndex + 2} contient ${cells.length} cellules au lieu de ${headers.length}.`,
      );
    return Object.fromEntries(
      headers.map((header, cellIndex) => [header, cells[cellIndex].trim()]),
    );
  });
}

export function parseImportCommand(value: unknown): ImportCommand {
  const input = requireObject(value);
  rejectUnknownFields(
    input,
    [
      "idempotencyKey",
      "format",
      "content",
      "sourceName",
      "sourceSystem",
      "importedAt",
    ],
    "import",
  );
  if (input.format !== "json" && input.format !== "csv")
    throw new DomainError(
      "invalid_import_format",
      "Le format doit être json ou csv.",
    );
  if (typeof input.content !== "string" || !input.content.trim())
    throw new DomainError("invalid_import", "Le contenu importé est vide.");
  if (new TextEncoder().encode(input.content).byteLength > IMPORT_MAX_BYTES)
    throw new DomainError(
      "import_too_large",
      "Le contenu importé dépasse 1 Mio.",
      413,
    );
  return {
    idempotencyKey: requireIdempotencyKey(input.idempotencyKey),
    format: input.format,
    content: input.content,
    sourceName:
      input.sourceName === undefined
        ? undefined
        : requireText(input.sourceName, "sourceName", 260),
    sourceSystem:
      input.sourceSystem === undefined
        ? undefined
        : requireText(input.sourceSystem, "sourceSystem", 120),
    importedAt: optionalDate(input.importedAt, "importedAt") ?? undefined,
  };
}

export function parseImportedEvents(command: ImportCommand): ImportedEvent[] {
  let values: unknown[];
  if (command.format === "json") {
    let parsed: unknown;
    try {
      parsed = JSON.parse(command.content) as unknown;
    } catch {
      throw new DomainError(
        "invalid_import_json",
        "Le fichier JSON est invalide.",
      );
    }
    if (Array.isArray(parsed)) values = parsed;
    else {
      const envelope = requireObject(parsed);
      rejectUnknownFields(envelope, ["events"], "Le document JSON");
      if (!Array.isArray(envelope.events))
        throw new DomainError(
          "invalid_import_json",
          "Le document JSON doit contenir une liste events.",
        );
      values = envelope.events;
    }
  } else {
    values = parseCsv(command.content).map((row) => ({
      ...Object.fromEntries(
        Object.entries(row).filter(
          ([key, value]) => key !== "participants" && value !== "",
        ),
      ),
      participants: row.participants
        ? row.participants
            .split("|")
            .map((name) => name.trim())
            .filter(Boolean)
        : [],
    }));
  }
  if (values.length === 0 || values.length > IMPORT_MAX_EVENTS)
    throw new DomainError(
      "invalid_import_count",
      `Un import doit contenir entre 1 et ${IMPORT_MAX_EVENTS} événements.`,
    );
  return values.map(parseImportedEvent);
}

export function parseResolveIdentityCommand(
  value: unknown,
): ResolveIdentityCommand {
  const input = requireObject(value);
  rejectUnknownFields(
    input,
    ["idempotencyKey", "ambiguityId", "personId", "resolvedAt"],
    "identity.resolve",
  );
  if (typeof input.ambiguityId !== "string" || !input.ambiguityId)
    throw new DomainError(
      "invalid_ambiguity",
      "L’identifiant d’ambiguïté est requis.",
    );
  if (typeof input.personId !== "string" || !input.personId)
    throw new DomainError(
      "invalid_identity_candidate",
      "Une identité candidate est requise.",
    );
  return {
    idempotencyKey: requireIdempotencyKey(input.idempotencyKey),
    ambiguityId: input.ambiguityId,
    personId: input.personId,
    resolvedAt: optionalDate(input.resolvedAt, "resolvedAt") ?? undefined,
  };
}

export function parseAnnotationCommand(value: unknown): AnnotationCommand {
  const input = requireObject(value);
  const target = requireObject(input.target);
  const kinds: TargetKind[] = [
    "source",
    "event",
    "person",
    "episode",
    "claim",
    "hypothesis",
    "question",
    "goal",
  ];
  const types: AnnotationType[] = [
    "factual_correction",
    "context",
    "disagreement",
    "agreement",
  ];
  if (
    !kinds.includes(target.kind as TargetKind) ||
    typeof target.id !== "string" ||
    !target.id
  )
    throw new DomainError(
      "invalid_target",
      "La cible de l’annotation est invalide.",
    );
  if (!types.includes(input.annotationType as AnnotationType))
    throw new DomainError(
      "invalid_annotation_type",
      "Type d’annotation inconnu.",
    );
  return {
    idempotencyKey: requireIdempotencyKey(input.idempotencyKey),
    target: { kind: target.kind as TargetKind, id: target.id },
    text: requireText(input.text, "text", 4_000),
    annotationType: input.annotationType as AnnotationType,
    createdAt: optionalDate(input.createdAt, "createdAt") ?? undefined,
  };
}

export function parseAnswerQuestionCommand(
  value: unknown,
  questionId: string,
): AnswerQuestionCommand {
  const input = requireObject(value);
  const choices = ["text", "unknown", "dismiss"] as const;
  if (!choices.includes(input.choice as (typeof choices)[number]))
    throw new DomainError(
      "invalid_answer",
      "choice vaut text, unknown ou dismiss.",
    );
  const choice = input.choice as AnswerQuestionCommand["choice"];
  if (choice !== "text" && input.text !== undefined)
    throw new DomainError(
      "invalid_answer",
      "Seule une réponse libre porte un texte.",
    );
  return {
    idempotencyKey: requireIdempotencyKey(input.idempotencyKey),
    questionId,
    choice,
    text:
      choice === "text" ? requireText(input.text, "text", 12_000) : undefined,
    recordedAt: optionalDate(input.recordedAt, "recordedAt") ?? undefined,
  };
}

export function parseGoalCommand(value: unknown): GoalCommand {
  const input = requireObject(value);
  if (
    input.goalId !== undefined &&
    (typeof input.goalId !== "string" || !input.goalId)
  )
    throw new DomainError("invalid_goal", "Identifiant d’intention invalide.");
  return {
    idempotencyKey: requireIdempotencyKey(input.idempotencyKey),
    goalId: input.goalId as string | undefined,
    text: requireText(input.text, "text", 240),
    createdAt: optionalDate(input.createdAt, "createdAt") ?? undefined,
  };
}
