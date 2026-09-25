import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import {
  MEMORY_SCHEMA_VERSION,
  DomainError,
  type AnnotationCommand,
  type ChooseDirectionCommand,
  type RelationMember,
  type DirectionRecord,
  type RecordOutcomeCommand,
  type AnswerQuestionCommand,
  type CaptureCommand,
  type Claim,
  type CommandResult,
  type EntityRef,
  type Episode,
  type GoalCommand,
  type HumanAnnotation,
  type Hypothesis,
  type IdentityAmbiguity,
  type ImportCommand,
  type ImportedParticipant,
  type ImportResult,
  type MemoryEvent,
  type MemorySearchQuery,
  type MemorySearchResult,
  type OpenQuestion,
  type Person,
  type RevisionEntry,
  type ResolveIdentityCommand,
  type Source,
  type TargetKind,
  type WorkspaceSnapshot,
  parseImportedEvents,
} from "../../domain/src/memory.ts";
import {
  COGNITION_MAX_BYTES,
  COGNITION_MAX_OPERATIONS,
  COGNITION_SCHEMA_VERSION,
  COGNITION_VALIDATOR_VERSION,
  cognitionHash,
  parseCognitiveProposal,
  type AnalysisPreview,
  type ApplicationResult,
  type CognitiveOperation,
  type CognitiveOperationKind,
  type CognitiveProposal,
  type ContextPacket,
  type PrepareAnalysisCommand,
  type SourceCitation,
  COGNITIVE_OPERATION_KINDS,
  DEFAULT_OPERATIONS,
} from "../../cognition/src/contract.ts";
import { HypothesisStore, type OperationContext } from "./hypothesisStore.ts";

type SqlRow = Record<string, unknown>;

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

const sha256 = (value: string) =>
  createHash("sha256").update(value, "utf8").digest("hex");
const nowIso = () => new Date().toISOString();
const ANALYST_PROMPT_VERSION = "analyst-v10";
const ANALYST_PROMPT_HASH = sha256(
  readFileSync(
    fileURLToPath(
      new URL("../../cognition/prompts/analyst-v10.md", import.meta.url),
    ),
    "utf8",
  ),
);

function parseResult(value: unknown): CommandResult {
  return JSON.parse(String(value)) as CommandResult;
}

export class SqliteMemoryStore {
  private readonly database: DatabaseSync;
  private readonly workspaceId: string;
  private readonly hypotheses: HypothesisStore;

  constructor(
    databasePath: string,
    workspaceId = "personal",
    workspaceName = "Mon espace",
  ) {
    this.workspaceId = workspaceId;
    if (databasePath !== ":memory:")
      mkdirSync(dirname(resolve(databasePath)), { recursive: true });
    this.database = new DatabaseSync(databasePath);
    this.database.exec(
      "PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;",
    );
    const migrationPath = fileURLToPath(
      new URL("./migrations/001_initial.sql", import.meta.url),
    );
    this.database.exec(readFileSync(migrationPath, "utf8"));
    const cognitionMigration = this.database
      .prepare("SELECT version FROM schema_migrations WHERE version = 2")
      .get();
    if (!cognitionMigration) {
      const cognitionMigrationPath = fileURLToPath(
        new URL("./migrations/002_cognition.sql", import.meta.url),
      );
      this.database.exec(readFileSync(cognitionMigrationPath, "utf8"));
    }
    const importMigration = this.database
      .prepare("SELECT version FROM schema_migrations WHERE version = 3")
      .get();
    if (!importMigration) {
      const importMigrationPath = fileURLToPath(
        new URL("./migrations/003_imports_and_metrics.sql", import.meta.url),
      );
      this.database.exec(readFileSync(importMigrationPath, "utf8"));
    }
    const modalityMigration = this.database
      .prepare("SELECT version FROM schema_migrations WHERE version = 4")
      .get();
    if (!modalityMigration) {
      const modalityMigrationPath = fileURLToPath(
        new URL("./migrations/004_claim_modality.sql", import.meta.url),
      );
      this.database.exec(readFileSync(modalityMigrationPath, "utf8"));
    }
    const revisionMigration = this.database
      .prepare("SELECT version FROM schema_migrations WHERE version = 5")
      .get();
    if (!revisionMigration) {
      const revisionMigrationPath = fileURLToPath(
        new URL("./migrations/005_revision_engine.sql", import.meta.url),
      );
      this.database.exec(readFileSync(revisionMigrationPath, "utf8"));
    }
    const critiqueMigration = this.database
      .prepare("SELECT version FROM schema_migrations WHERE version = 6")
      .get();
    if (!critiqueMigration) {
      const critiqueMigrationPath = fileURLToPath(
        new URL("./migrations/006_critiques.sql", import.meta.url),
      );
      this.database.exec(readFileSync(critiqueMigrationPath, "utf8"));
    }
    const brief003Migration = this.database
      .prepare("SELECT version FROM schema_migrations WHERE version = 7")
      .get();
    if (!brief003Migration) {
      const brief003MigrationPath = fileURLToPath(
        new URL("./migrations/007_brief003.sql", import.meta.url),
      );
      this.database.exec(readFileSync(brief003MigrationPath, "utf8"));
    }
    const relationsMigration = this.database
      .prepare("SELECT version FROM schema_migrations WHERE version = 8")
      .get();
    if (!relationsMigration) {
      const relationsMigrationPath = fileURLToPath(
        new URL("./migrations/008_relations_roles.sql", import.meta.url),
      );
      this.database.exec(readFileSync(relationsMigrationPath, "utf8"));
    }
    const directionsMigration = this.database
      .prepare("SELECT version FROM schema_migrations WHERE version = 9")
      .get();
    if (!directionsMigration) {
      const directionsMigrationPath = fileURLToPath(
        new URL("./migrations/009_directions_actions.sql", import.meta.url),
      );
      this.database.exec(readFileSync(directionsMigrationPath, "utf8"));
    }
    const goalMigration = this.database
      .prepare("SELECT version FROM schema_migrations WHERE version = 10")
      .get();
    if (!goalMigration) {
      const goalMigrationPath = fileURLToPath(
        new URL("./migrations/010_goal_emergence.sql", import.meta.url),
      );
      this.database.exec(readFileSync(goalMigrationPath, "utf8"));
    }
    const partialMigration = this.database
      .prepare("SELECT version FROM schema_migrations WHERE version = 11")
      .get();
    if (!partialMigration) {
      const partialMigrationPath = fileURLToPath(
        new URL("./migrations/011_partial_application.sql", import.meta.url),
      );
      this.database.exec(readFileSync(partialMigrationPath, "utf8"));
    }
    const queriesMigration = this.database
      .prepare("SELECT version FROM schema_migrations WHERE version = 12")
      .get();
    if (!queriesMigration) {
      const queriesMigrationPath = fileURLToPath(
        new URL("./migrations/012_memory_queries.sql", import.meta.url),
      );
      this.database.exec(readFileSync(queriesMigrationPath, "utf8"));
    }
    this.hypotheses = new HypothesisStore(this.database, workspaceId);
    const timestamp = nowIso();
    this.database
      .prepare(
        "INSERT OR IGNORE INTO workspaces(id, name, revision, created_at, updated_at) VALUES (?, ?, 0, ?, ?)",
      )
      .run(this.workspaceId, workspaceName, timestamp, timestamp);
  }

  close() {
    this.database.close();
  }

  backup(destinationPath: string) {
    const destination = resolve(destinationPath);
    if (existsSync(destination))
      throw new DomainError(
        "backup_exists",
        "Une sauvegarde existe déjà à cet emplacement.",
        409,
      );
    mkdirSync(dirname(destination), { recursive: true });
    this.database.exec("PRAGMA wal_checkpoint(FULL)");
    const sqlPath = destination.replaceAll("'", "''");
    this.database.exec(`VACUUM INTO '${sqlPath}'`);
    return destination;
  }

  /**
   * État léger pour la resynchronisation (R4.7) : la révision canonique et
   * les analyses encore ouvertes, sans charger l'instantané complet.
   */
  status(now = nowIso()) {
    const rows = this.database
      .prepare(
        "SELECT status, mode, COUNT(*) AS count FROM analysis_requests WHERE workspace_id = ? AND status IN ('awaiting_response', 'ready_for_review', 'needs_context') AND expires_at > ? GROUP BY status, mode",
      )
      .all(this.workspaceId, now) as SqlRow[];
    const count = (status: string) =>
      rows
        .filter((row) => row.status === status)
        .reduce((sum, row) => sum + Number(row.count), 0);
    return {
      revision: this.revision,
      analyses: {
        awaitingResponse: count("awaiting_response"),
        readyForReview: count("ready_for_review"),
        needsContext: count("needs_context"),
        modes: [...new Set(rows.map((row) => String(row.mode)))].sort(),
      },
    };
  }

  get revision() {
    return Number(
      (
        this.database
          .prepare("SELECT revision FROM workspaces WHERE id = ?")
          .get(this.workspaceId) as SqlRow
      ).revision,
    );
  }

  private transaction<T>(operation: () => T): T {
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const result = operation();
      this.database.exec("COMMIT");
      return result;
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }

  /** Exécute des écritures pour les valider, puis annule tout. */
  private dryRun(operation: () => unknown) {
    this.database.exec("BEGIN IMMEDIATE");
    try {
      operation();
    } finally {
      this.database.exec("ROLLBACK");
    }
  }

  private receipt(commandType: string, key: string, commandHash: string) {
    const row = this.database
      .prepare(
        "SELECT command_hash, result_json FROM command_receipts WHERE workspace_id = ? AND command_type = ? AND idempotency_key = ?",
      )
      .get(this.workspaceId, commandType, key) as SqlRow | undefined;
    if (!row) return null;
    if (row.command_hash !== commandHash)
      throw new DomainError(
        "idempotency_conflict",
        "Cette clé d’idempotence a déjà servi pour une autre commande.",
        409,
      );
    return { ...parseResult(row.result_json), replayed: true };
  }

  private saveReceipt(
    commandType: string,
    key: string,
    commandHash: string,
    result: CommandResult,
    timestamp: string,
  ) {
    this.database
      .prepare(
        "INSERT INTO command_receipts(workspace_id, command_type, idempotency_key, command_hash, result_json, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run(
        this.workspaceId,
        commandType,
        key,
        commandHash,
        JSON.stringify(result),
        timestamp,
      );
  }

  private advanceRevision(
    commandType: RevisionEntry["commandType"],
    refs: EntityRef[],
    timestamp: string,
  ) {
    const next = this.revision + 1;
    this.database
      .prepare(
        "UPDATE workspaces SET revision = ?, updated_at = ? WHERE id = ?",
      )
      .run(next, timestamp, this.workspaceId);
    this.database
      .prepare(
        "INSERT INTO revisions(workspace_id, revision, command_type, changed_refs_json, created_at) VALUES (?, ?, ?, ?, ?)",
      )
      .run(
        this.workspaceId,
        next,
        commandType,
        JSON.stringify(refs),
        timestamp,
      );
    return next;
  }

  capture(command: CaptureCommand): CommandResult {
    const commandHash = sha256(
      canonicalJson({
        text: command.text,
        title: command.title ?? null,
        recordedAt: command.recordedAt ?? null,
        narratedAt: command.narratedAt ?? null,
        occurredStart: command.occurredStart ?? null,
        occurredEnd: command.occurredEnd ?? null,
        temporalPrecision: command.temporalPrecision ?? "unknown",
        context: command.context ?? null,
        sensitivity: command.sensitivity ?? "personal",
      }),
    );
    const previous = this.receipt(
      "capture",
      command.idempotencyKey,
      commandHash,
    );
    if (previous) return previous;
    return this.transaction(() => {
      const replay = this.receipt(
        "capture",
        command.idempotencyKey,
        commandHash,
      );
      if (replay) return replay;
      const timestamp = command.recordedAt ?? nowIso();
      const createdAt = nowIso();
      const sourceId = randomUUID();
      const eventId = randomUUID();
      const sourceHash = sha256(command.text);
      this.database
        .prepare(
          "INSERT INTO sources(id, workspace_id, kind, content, content_hash, recorded_at, narrated_at, sensitivity, created_at) VALUES (?, ?, 'user_entry', ?, ?, ?, ?, ?, ?)",
        )
        .run(
          sourceId,
          this.workspaceId,
          command.text,
          sourceHash,
          timestamp,
          command.narratedAt ?? null,
          command.sensitivity ?? "personal",
          createdAt,
        );
      this.database
        .prepare(
          "INSERT INTO events(id, workspace_id, title, text, category, source_id, occurred_start, occurred_end, temporal_precision, context, row_version, created_at, updated_at) VALUES (?, ?, ?, ?, 'unclassified_note', ?, ?, ?, ?, ?, 1, ?, ?)",
        )
        .run(
          eventId,
          this.workspaceId,
          command.title ?? command.text.slice(0, 75),
          command.text,
          sourceId,
          command.occurredStart ?? null,
          command.occurredEnd ?? null,
          command.temporalPrecision ?? "unknown",
          command.context ?? null,
          createdAt,
          createdAt,
        );
      const created: EntityRef[] = [
        { kind: "source", id: sourceId },
        { kind: "event", id: eventId },
      ];
      const revision = this.advanceRevision("capture", created, createdAt);
      const result = {
        idempotencyKey: command.idempotencyKey,
        replayed: false,
        revision,
        created,
      };
      this.saveReceipt(
        "capture",
        command.idempotencyKey,
        commandHash,
        result,
        createdAt,
      );
      return result;
    });
  }

  importData(command: ImportCommand): ImportResult {
    const commandHash = sha256(
      canonicalJson({
        format: command.format,
        content: command.content,
        sourceName: command.sourceName ?? null,
        sourceSystem: command.sourceSystem ?? "manual-import",
        importedAt: command.importedAt ?? null,
      }),
    );
    const previous = this.receipt(
      "import",
      command.idempotencyKey,
      commandHash,
    ) as ImportResult | null;
    if (previous) return previous;
    const importedEvents = parseImportedEvents(command);
    const contentHash = sha256(command.content);
    const sourceSystem = command.sourceSystem ?? "manual-import";

    return this.transaction(() => {
      const replay = this.receipt(
        "import",
        command.idempotencyKey,
        commandHash,
      ) as ImportResult | null;
      if (replay) return replay;
      const existingBatch = this.database
        .prepare(
          "SELECT result_json FROM import_batches WHERE workspace_id = ? AND content_hash = ?",
        )
        .get(this.workspaceId, contentHash) as SqlRow | undefined;
      if (existingBatch) {
        const original = JSON.parse(
          String(existingBatch.result_json),
        ) as ImportResult;
        const result: ImportResult = {
          ...original,
          idempotencyKey: command.idempotencyKey,
          replayed: true,
        };
        this.saveReceipt(
          "import",
          command.idempotencyKey,
          commandHash,
          result,
          nowIso(),
        );
        return result;
      }

      const importId = randomUUID();
      const importedAt = command.importedAt ?? nowIso();
      const createdAt = nowIso();
      const created: EntityRef[] = [];
      const ambiguities: ImportResult["ambiguities"] = [];
      let createdPeople = 0;
      let linkedParticipants = 0;

      for (const importedEvent of importedEvents) {
        const recordedAt = importedEvent.recordedAt ?? importedAt;
        const sourceHash = sha256(importedEvent.text);
        const existingSource = this.database
          .prepare(
            "SELECT id FROM sources WHERE workspace_id = ? AND content_hash = ? AND recorded_at = ?",
          )
          .get(this.workspaceId, sourceHash, recordedAt) as SqlRow | undefined;
        const sourceId = existingSource
          ? String(existingSource.id)
          : randomUUID();
        if (!existingSource) {
          this.database
            .prepare(
              "INSERT INTO sources(id, workspace_id, kind, content, content_hash, recorded_at, narrated_at, sensitivity, created_at) VALUES (?, ?, 'import', ?, ?, ?, ?, ?, ?)",
            )
            .run(
              sourceId,
              this.workspaceId,
              importedEvent.text,
              sourceHash,
              recordedAt,
              importedEvent.narratedAt ?? null,
              importedEvent.sensitivity ?? "personal",
              createdAt,
            );
          created.push({ kind: "source", id: sourceId });
        }

        const eventId = randomUUID();
        this.database
          .prepare(
            "INSERT INTO events(id, workspace_id, title, text, category, source_id, occurred_start, occurred_end, temporal_precision, context, row_version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)",
          )
          .run(
            eventId,
            this.workspaceId,
            importedEvent.title ?? importedEvent.text.slice(0, 75),
            importedEvent.text,
            importedEvent.category ?? "unclassified_note",
            sourceId,
            importedEvent.occurredStart ?? null,
            importedEvent.occurredEnd ?? null,
            importedEvent.temporalPrecision ?? "unknown",
            importedEvent.context ?? null,
            createdAt,
            createdAt,
          );
        created.push({ kind: "event", id: eventId });

        const linkedPeople = new Set<string>();
        for (const participant of importedEvent.participants ?? []) {
          const resolution = this.resolveImportedParticipant(
            participant,
            sourceSystem,
            sourceId,
            createdAt,
            created,
          );
          if (resolution.created) createdPeople += 1;
          if (resolution.candidates.length > 1) {
            const ambiguityId = randomUUID();
            this.database
              .prepare(
                "INSERT INTO identity_ambiguities(id, workspace_id, event_id, mention, candidate_person_ids_json, status, created_at) VALUES (?, ?, ?, ?, ?, 'open', ?)",
              )
              .run(
                ambiguityId,
                this.workspaceId,
                eventId,
                participant.name,
                JSON.stringify(resolution.candidates),
                createdAt,
              );
            ambiguities.push({
              ambiguityId,
              eventId,
              mention: participant.name,
              candidatePersonIds: resolution.candidates,
            });
            continue;
          }
          const personId = resolution.candidates[0];
          if (!personId || linkedPeople.has(personId)) continue;
          this.database
            .prepare(
              "INSERT INTO event_participants(event_id, person_id, role) VALUES (?, ?, NULL)",
            )
            .run(eventId, personId);
          linkedPeople.add(personId);
          linkedParticipants += 1;
        }
      }

      const revision = this.advanceRevision("import", created, createdAt);
      const result: ImportResult = {
        idempotencyKey: command.idempotencyKey,
        replayed: false,
        revision,
        created,
        importId,
        importedEvents: importedEvents.length,
        createdPeople,
        linkedParticipants,
        ambiguities,
      };
      this.database
        .prepare(
          "INSERT INTO import_batches(id, workspace_id, format, source_name, source_system, content_hash, imported_at, result_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .run(
          importId,
          this.workspaceId,
          command.format,
          command.sourceName ?? null,
          sourceSystem,
          contentHash,
          importedAt,
          JSON.stringify(result),
        );
      this.saveReceipt(
        "import",
        command.idempotencyKey,
        commandHash,
        result,
        createdAt,
      );
      return result;
    });
  }

  private resolveImportedParticipant(
    participant: ImportedParticipant,
    sourceSystem: string,
    sourceId: string,
    timestamp: string,
    created: EntityRef[],
  ) {
    let candidates: string[];
    let wasCreated = false;
    if (participant.identityKey) {
      const external = this.database
        .prepare(
          "SELECT person_id FROM person_external_keys WHERE workspace_id = ? AND source_system = ? AND external_key = ?",
        )
        .get(this.workspaceId, sourceSystem, participant.identityKey) as
        | SqlRow
        | undefined;
      if (external) candidates = [String(external.person_id)];
      else {
        const personId = randomUUID();
        this.database
          .prepare(
            "INSERT INTO persons(id, workspace_id, display_name, resolution_status, row_version, created_at, updated_at) VALUES (?, ?, ?, 'resolved', 1, ?, ?)",
          )
          .run(
            personId,
            this.workspaceId,
            participant.name,
            timestamp,
            timestamp,
          );
        this.database
          .prepare(
            "INSERT INTO person_external_keys(workspace_id, person_id, source_system, external_key, created_at) VALUES (?, ?, ?, ?, ?)",
          )
          .run(
            this.workspaceId,
            personId,
            sourceSystem,
            participant.identityKey,
            timestamp,
          );
        created.push({ kind: "person", id: personId });
        candidates = [personId];
        wasCreated = true;
      }
    } else {
      const matches = this.database
        .prepare(
          "SELECT DISTINCT p.id FROM persons p LEFT JOIN person_aliases a ON a.person_id = p.id WHERE p.workspace_id = ? AND (lower(p.display_name) = lower(?) OR lower(a.alias) = lower(?)) ORDER BY p.id",
        )
        .all(this.workspaceId, participant.name, participant.name) as SqlRow[];
      candidates = matches.map((row) => String(row.id));
      if (candidates.length === 0) {
        const personId = randomUUID();
        this.database
          .prepare(
            "INSERT INTO persons(id, workspace_id, display_name, resolution_status, row_version, created_at, updated_at) VALUES (?, ?, ?, 'candidate', 1, ?, ?)",
          )
          .run(
            personId,
            this.workspaceId,
            participant.name,
            timestamp,
            timestamp,
          );
        created.push({ kind: "person", id: personId });
        candidates = [personId];
        wasCreated = true;
      }
    }
    if (candidates.length === 1)
      this.database
        .prepare(
          "INSERT OR IGNORE INTO person_aliases(id, workspace_id, person_id, alias, source_id, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .run(
          randomUUID(),
          this.workspaceId,
          candidates[0],
          participant.name,
          sourceId,
          timestamp,
        );
    return { candidates, created: wasCreated };
  }

  resolveIdentity(command: ResolveIdentityCommand): CommandResult {
    const commandHash = sha256(canonicalJson(command));
    const previous = this.receipt(
      "identity.resolve",
      command.idempotencyKey,
      commandHash,
    );
    if (previous) return previous;
    return this.transaction(() => {
      const replay = this.receipt(
        "identity.resolve",
        command.idempotencyKey,
        commandHash,
      );
      if (replay) return replay;
      const ambiguity = this.database
        .prepare(
          "SELECT * FROM identity_ambiguities WHERE workspace_id = ? AND id = ?",
        )
        .get(this.workspaceId, command.ambiguityId) as SqlRow | undefined;
      if (!ambiguity)
        throw new DomainError(
          "identity_ambiguity_not_found",
          "Cette ambiguïté d’identité n’existe pas.",
          404,
        );
      if (String(ambiguity.status) !== "open")
        throw new DomainError(
          "identity_ambiguity_resolved",
          "Cette ambiguïté est déjà résolue.",
          409,
        );
      const candidates = JSON.parse(
        String(ambiguity.candidate_person_ids_json),
      ) as string[];
      if (!candidates.includes(command.personId))
        throw new DomainError(
          "invalid_identity_candidate",
          "L’identité choisie ne fait pas partie des candidats.",
        );
      const timestamp = command.resolvedAt ?? nowIso();
      const eventId = String(ambiguity.event_id);
      this.database
        .prepare(
          "INSERT OR IGNORE INTO event_participants(event_id, person_id, role) VALUES (?, ?, NULL)",
        )
        .run(eventId, command.personId);
      this.database
        .prepare(
          "UPDATE identity_ambiguities SET status = 'resolved', resolved_at = ? WHERE workspace_id = ? AND id = ?",
        )
        .run(timestamp, this.workspaceId, command.ambiguityId);
      const changed: EntityRef[] = [
        { kind: "event", id: eventId },
        { kind: "person", id: command.personId },
      ];
      const revision = this.advanceRevision(
        "identity.resolve",
        changed,
        timestamp,
      );
      const result: CommandResult = {
        idempotencyKey: command.idempotencyKey,
        replayed: false,
        revision,
        created: [],
      };
      this.saveReceipt(
        "identity.resolve",
        command.idempotencyKey,
        commandHash,
        result,
        timestamp,
      );
      return result;
    });
  }

  annotate(command: AnnotationCommand): CommandResult {
    const commandHash = sha256(canonicalJson(command));
    const previous = this.receipt(
      "annotate",
      command.idempotencyKey,
      commandHash,
    );
    if (previous) return previous;
    return this.transaction(() => {
      const replay = this.receipt(
        "annotate",
        command.idempotencyKey,
        commandHash,
      );
      if (replay) return replay;
      if (!this.targetExists(command.target))
        throw new DomainError(
          "target_not_found",
          "La cible n’existe pas dans cet espace.",
          404,
        );
      const timestamp = command.createdAt ?? nowIso();
      const annotationId = randomUUID();
      const nextRevision = this.revision + 1;
      // Une correction, un contexte ou un désaccord est une déclaration de
      // l'utilisateur : il devient une source citable (RAPPORT-003 §4.2).
      // L'accord n'en crée pas, car il n'est jamais une preuve (D-008).
      const citable = command.annotationType !== "agreement";
      // Une même annotation portée sur plusieurs objets partage sa source
      // (RAPPORT-004 §4.3) : on réutilise la source d'un texte identique.
      const shared = citable
        ? (this.database
            .prepare(
              "SELECT source_id FROM annotations WHERE workspace_id = ? AND text = ? AND annotation_type = ? AND source_id IS NOT NULL LIMIT 1",
            )
            .get(this.workspaceId, command.text, command.annotationType) as
            | SqlRow
            | undefined)
        : undefined;
      const sourceId = shared
        ? String(shared.source_id)
        : citable
          ? randomUUID()
          : null;
      const createdRefs: EntityRef[] = [];
      if (sourceId && !shared) {
        const eventId = randomUUID();
        this.database
          .prepare(
            "INSERT INTO sources(id, workspace_id, kind, content, content_hash, recorded_at, narrated_at, sensitivity, created_at) VALUES (?, ?, 'user_entry', ?, ?, ?, ?, 'personal', ?)",
          )
          .run(
            sourceId,
            this.workspaceId,
            command.text,
            sha256(command.text),
            timestamp,
            timestamp,
            timestamp,
          );
        this.database
          .prepare(
            "INSERT INTO events(id, workspace_id, title, text, category, source_id, occurred_start, occurred_end, temporal_precision, context, row_version, created_at, updated_at) VALUES (?, ?, ?, ?, 'unclassified_note', ?, NULL, NULL, 'unknown', ?, 1, ?, ?)",
          )
          .run(
            eventId,
            this.workspaceId,
            `Annotation (${command.annotationType})`,
            command.text,
            sourceId,
            "Annotation de l’utilisateur",
            timestamp,
            timestamp,
          );
        createdRefs.push(
          { kind: "source", id: sourceId },
          { kind: "event", id: eventId },
        );
      }
      this.database
        .prepare(
          "INSERT INTO annotations(id, workspace_id, target_kind, target_id, text, annotation_type, revision, created_at, source_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .run(
          annotationId,
          this.workspaceId,
          command.target.kind,
          command.target.id,
          command.text,
          command.annotationType,
          nextRevision,
          timestamp,
          sourceId,
        );
      const changed: EntityRef[] = [
        command.target,
        { kind: "annotation", id: annotationId },
        ...createdRefs,
        ...this.hypotheses.onAnnotation(
          command.target,
          command.annotationType,
          nextRevision,
          timestamp,
        ),
      ];
      const revision = this.advanceRevision("annotate", changed, timestamp);
      const result: CommandResult = {
        idempotencyKey: command.idempotencyKey,
        replayed: false,
        revision,
        created: [{ kind: "annotation", id: annotationId }, ...createdRefs],
      };
      this.saveReceipt(
        "annotate",
        command.idempotencyKey,
        commandHash,
        result,
        timestamp,
      );
      return result;
    });
  }

  /**
   * Choix d'une direction (D-016) : l'action copie les prédictions de la
   * direction, datées maintenant, avant tout résultat. Aucune exécution :
   * c'est l'utilisateur qui agit dans le monde.
   */
  chooseDirection(command: ChooseDirectionCommand): CommandResult {
    const commandHash = sha256(canonicalJson(command));
    const previous = this.receipt(
      "action.choose",
      command.idempotencyKey,
      commandHash,
    );
    if (previous) return previous;
    return this.transaction(() => {
      const replay = this.receipt(
        "action.choose",
        command.idempotencyKey,
        commandHash,
      );
      if (replay) return replay;
      const direction = this.hypotheses
        .directions()
        .find((item) => item.id === command.directionId);
      if (!direction)
        throw new DomainError(
          "direction_not_found",
          "Direction inconnue.",
          404,
        );
      if (direction.status !== "proposed")
        throw new DomainError(
          "direction_not_available",
          `Cette direction est ${direction.status}.`,
          409,
        );
      const timestamp = nowIso();
      const id = randomUUID();
      const nextRevision = this.revision + 1;
      this.database
        .prepare(
          `INSERT INTO actions(id, workspace_id, direction_id, status, expectation_json, expectation_recorded_at,
             chosen_revision, created_at, updated_at) VALUES (?, ?, ?, 'planned', ?, ?, ?, ?, ?)`,
        )
        .run(
          id,
          this.workspaceId,
          direction.id,
          JSON.stringify({
            predictions: direction.predictions,
            userExpectation: command.userExpectation ?? null,
          }),
          timestamp,
          nextRevision,
          timestamp,
          timestamp,
        );
      this.database
        .prepare("UPDATE directions SET status = 'chosen' WHERE id = ?")
        .run(direction.id);
      const revision = this.advanceRevision(
        "action.choose",
        [
          { kind: "direction", id: direction.id },
          { kind: "action", id },
        ],
        timestamp,
      );
      const result: CommandResult = {
        idempotencyKey: command.idempotencyKey,
        replayed: false,
        revision,
        created: [{ kind: "action", id }],
      };
      this.saveReceipt(
        "action.choose",
        command.idempotencyKey,
        commandHash,
        result,
        timestamp,
      );
      return result;
    });
  }

  /**
   * Résultat d'une action (D-016) : il devient une annotation citable sur la
   * lecture actionnée, qui passe à réexaminer ; la réanalyse compare ensuite
   * les prédictions figées au résultat.
   */
  recordOutcome(command: RecordOutcomeCommand): CommandResult {
    const commandHash = sha256(canonicalJson(command));
    const previous = this.receipt(
      "action.outcome",
      command.idempotencyKey,
      commandHash,
    );
    if (previous) return previous;
    const action = this.hypotheses
      .actions()
      .find((item) => item.id === command.actionId);
    if (!action)
      throw new DomainError("action_not_found", "Action inconnue.", 404);
    if (action.outcome)
      throw new DomainError(
        "outcome_already_recorded",
        "Le résultat de cette action est déjà enregistré.",
        409,
      );
    const direction = this.hypotheses
      .directions()
      .find((item) => item.id === action.directionId);
    if (!direction)
      throw new DomainError("direction_not_found", "Direction inconnue.", 404);
    if (
      command.verdicts &&
      command.verdicts.length !== action.expectation.predictions.length
    )
      throw new DomainError(
        "invalid_verdicts",
        "Un verdict par prédiction, ou aucun.",
      );
    const recordedAt = command.recordedAt ?? nowIso();
    if (recordedAt < action.expectationRecordedAt)
      throw new DomainError(
        "outcome_before_expectation",
        "Le résultat ne peut pas précéder l’attente enregistrée.",
      );
    // L'annotation porte sur la lecture actionnée, ou sur l'objectif pour
    // « ne rien entreprendre ».
    const target = direction.lever.hypothesisId
      ? { kind: "hypothesis" as const, id: direction.lever.hypothesisId }
      : direction.goalId
        ? { kind: "goal" as const, id: direction.goalId }
        : null;
    if (!target)
      throw new DomainError(
        "outcome_without_target",
        "Cette direction ne vise ni lecture ni objectif.",
      );
    const annotated = this.annotate({
      idempotencyKey: `${command.idempotencyKey}:annotation`,
      target,
      text: `Résultat de l’action « ${direction.title} » : ${command.text}`,
      annotationType: "context",
      createdAt: recordedAt,
    });
    const annotationId = annotated.created.find(
      (ref) => ref.kind === "annotation",
    )?.id;
    return this.transaction(() => {
      const replay = this.receipt(
        "action.outcome",
        command.idempotencyKey,
        commandHash,
      );
      if (replay) return replay;
      this.database
        .prepare(
          `UPDATE actions SET status = 'done', outcome_text = ?, outcome_annotation_id = ?, outcome_recorded_at = ?,
             verdicts_json = ?, updated_at = ? WHERE id = ?`,
        )
        .run(
          command.text,
          annotationId ?? null,
          recordedAt,
          command.verdicts ? JSON.stringify(command.verdicts) : null,
          recordedAt,
          action.id,
        );
      const revision = this.advanceRevision(
        "action.outcome",
        [{ kind: "action", id: action.id }],
        recordedAt,
      );
      const result: CommandResult = {
        idempotencyKey: command.idempotencyKey,
        replayed: false,
        revision,
        created: annotated.created,
      };
      this.saveReceipt(
        "action.outcome",
        command.idempotencyKey,
        commandHash,
        result,
        recordedAt,
      );
      return result;
    });
  }

  /**
   * Réponse de l'utilisateur à une question ouverte (T5). Une réponse libre
   * devient une source capturée et remet les hypothèses ciblées à réexaminer ;
   * « je ne sais pas » et « ne plus poser » ne changent que la question.
   */
  answerQuestion(command: AnswerQuestionCommand): CommandResult {
    const commandHash = sha256(canonicalJson(command));
    const previous = this.receipt(
      "question.answer",
      command.idempotencyKey,
      commandHash,
    );
    if (previous) return previous;
    return this.transaction(() => {
      const replay = this.receipt(
        "question.answer",
        command.idempotencyKey,
        commandHash,
      );
      if (replay) return replay;
      const question = this.hypotheses.question(command.questionId);
      if (question.status !== "open")
        throw new DomainError(
          "question_closed",
          `Cette question est déjà ${question.status}.`,
          409,
        );
      const createdAt = nowIso();
      const nextRevision = this.revision + 1;
      const created: EntityRef[] = [];
      const changed: EntityRef[] = [{ kind: "question", id: question.id }];
      let answerSourceId: string | null = null;
      if (command.choice === "text") {
        const text = command.text ?? "";
        answerSourceId = randomUUID();
        const eventId = randomUUID();
        this.database
          .prepare(
            "INSERT INTO sources(id, workspace_id, kind, content, content_hash, recorded_at, narrated_at, sensitivity, created_at) VALUES (?, ?, 'user_entry', ?, ?, ?, ?, 'personal', ?)",
          )
          .run(
            answerSourceId,
            this.workspaceId,
            text,
            sha256(text),
            command.recordedAt ?? createdAt,
            command.recordedAt ?? createdAt,
            createdAt,
          );
        this.database
          .prepare(
            "INSERT INTO events(id, workspace_id, title, text, category, source_id, occurred_start, occurred_end, temporal_precision, context, row_version, created_at, updated_at) VALUES (?, ?, ?, ?, 'unclassified_note', ?, NULL, NULL, 'unknown', ?, 1, ?, ?)",
          )
          .run(
            eventId,
            this.workspaceId,
            `Réponse : ${question.question}`.slice(0, 160),
            text,
            answerSourceId,
            "Réponse à une question",
            createdAt,
            createdAt,
          );
        created.push(
          { kind: "source", id: answerSourceId },
          { kind: "event", id: eventId },
        );
        changed.push(
          ...this.hypotheses.markForReview(
            question.targets
              .filter((target) => target.kind === "hypothesis")
              .map((target) => target.id),
            "answer",
            nextRevision,
            createdAt,
          ),
        );
      }
      this.hypotheses.closeQuestion(
        question.id,
        command.choice === "text"
          ? "answered"
          : command.choice === "unknown"
            ? "unknown"
            : "dismissed",
        answerSourceId,
        createdAt,
      );
      const revision = this.advanceRevision(
        "question.answer",
        [...created, ...changed],
        createdAt,
      );
      const result: CommandResult = {
        idempotencyKey: command.idempotencyKey,
        replayed: false,
        revision,
        created,
      };
      this.saveReceipt(
        "question.answer",
        command.idempotencyKey,
        commandHash,
        result,
        createdAt,
      );
      return result;
    });
  }

  /** R5.4 : écarter un objectif proposé par l'analyse (jamais un objectif confirmé). */
  dismissGoal(command: {
    idempotencyKey: string;
    goalId: string;
  }): CommandResult {
    const commandHash = sha256(canonicalJson(command));
    const previous = this.receipt(
      "goal.update",
      command.idempotencyKey,
      commandHash,
    );
    if (previous) return previous;
    return this.transaction(() => {
      const row = this.database
        .prepare(
          "SELECT confirmed_by_user, origin FROM goals WHERE workspace_id = ? AND id = ?",
        )
        .get(this.workspaceId, command.goalId) as SqlRow | undefined;
      if (!row)
        throw new DomainError(
          "goal_not_found",
          "Cette intention n’existe pas.",
          404,
        );
      if (row.confirmed_by_user)
        throw new DomainError(
          "goal_confirmed",
          "Une intention confirmée se reformule, elle ne s’écarte pas.",
          409,
        );
      const timestamp = nowIso();
      this.database
        .prepare(
          "UPDATE goals SET dismissed_at = ?, row_version = row_version + 1, updated_at = ? WHERE id = ?",
        )
        .run(timestamp, timestamp, command.goalId);
      const ref: EntityRef = { kind: "goal", id: command.goalId };
      const revision = this.advanceRevision("goal.update", [ref], timestamp);
      const result: CommandResult = {
        idempotencyKey: command.idempotencyKey,
        replayed: false,
        revision,
        created: [],
      };
      this.saveReceipt(
        "goal.update",
        command.idempotencyKey,
        commandHash,
        result,
        timestamp,
      );
      return result;
    });
  }

  updateGoal(command: GoalCommand): CommandResult {
    const commandHash = sha256(canonicalJson(command));
    const previous = this.receipt(
      "goal.update",
      command.idempotencyKey,
      commandHash,
    );
    if (previous) return previous;
    return this.transaction(() => {
      const replay = this.receipt(
        "goal.update",
        command.idempotencyKey,
        commandHash,
      );
      if (replay) return replay;
      const timestamp = command.createdAt ?? nowIso();
      const goalId = command.goalId ?? randomUUID();
      const existing = this.database
        .prepare("SELECT id FROM goals WHERE workspace_id = ? AND id = ?")
        .get(this.workspaceId, goalId);
      if (command.goalId && !existing)
        throw new DomainError(
          "goal_not_found",
          "Cette intention n’existe pas.",
          404,
        );
      if (existing)
        this.database
          .prepare(
            "UPDATE goals SET text = ?, confirmed_by_user = 1, row_version = row_version + 1, updated_at = ? WHERE workspace_id = ? AND id = ?",
          )
          .run(command.text, timestamp, this.workspaceId, goalId);
      else
        this.database
          .prepare(
            "INSERT INTO goals(id, workspace_id, text, confirmed_by_user, row_version, created_at, updated_at) VALUES (?, ?, ?, 1, 1, ?, ?)",
          )
          .run(goalId, this.workspaceId, command.text, timestamp, timestamp);
      const ref: EntityRef = { kind: "goal", id: goalId };
      const revision = this.advanceRevision("goal.update", [ref], timestamp);
      const result = {
        idempotencyKey: command.idempotencyKey,
        replayed: false,
        revision,
        created: existing ? [] : [ref],
      };
      this.saveReceipt(
        "goal.update",
        command.idempotencyKey,
        commandHash,
        result,
        timestamp,
      );
      return result;
    });
  }

  private targetExists(target: AnnotationCommand["target"]) {
    const tableByKind: Record<TargetKind, string> = {
      source: "sources",
      event: "events",
      person: "persons",
      episode: "episodes",
      claim: "claims",
      hypothesis: "hypotheses",
      question: "open_questions",
      goal: "goals",
    };
    const table = tableByKind[target.kind];
    return Boolean(
      this.database
        .prepare(`SELECT id FROM ${table} WHERE workspace_id = ? AND id = ?`)
        .get(this.workspaceId, target.id),
    );
  }

  snapshot(): WorkspaceSnapshot {
    const workspace = this.database
      .prepare(
        "SELECT id, name, revision, created_at FROM workspaces WHERE id = ?",
      )
      .get(this.workspaceId) as SqlRow;
    const sources = this.database
      .prepare(
        "SELECT * FROM sources WHERE workspace_id = ? ORDER BY recorded_at DESC, id",
      )
      .all(this.workspaceId) as SqlRow[];
    const events = this.database
      .prepare(
        "SELECT * FROM events WHERE workspace_id = ? ORDER BY created_at DESC, id",
      )
      .all(this.workspaceId) as SqlRow[];
    const annotations = this.database
      .prepare(
        "SELECT * FROM annotations WHERE workspace_id = ? ORDER BY created_at DESC, id",
      )
      .all(this.workspaceId) as SqlRow[];
    const goals = this.database
      .prepare(
        "SELECT * FROM goals WHERE workspace_id = ? ORDER BY updated_at DESC, id",
      )
      .all(this.workspaceId) as SqlRow[];
    const claims = this.database
      .prepare(
        "SELECT * FROM claims WHERE workspace_id = ? ORDER BY created_at DESC, id",
      )
      .all(this.workspaceId) as SqlRow[];
    const persons = this.database
      .prepare(
        "SELECT * FROM persons WHERE workspace_id = ? ORDER BY display_name, id",
      )
      .all(this.workspaceId) as SqlRow[];
    const episodes = this.database
      .prepare(
        "SELECT * FROM episodes WHERE workspace_id = ? ORDER BY occurred_start DESC, id",
      )
      .all(this.workspaceId) as SqlRow[];
    const hypotheses = this.database
      .prepare(
        "SELECT * FROM hypotheses WHERE workspace_id = ? ORDER BY updated_at DESC, id",
      )
      .all(this.workspaceId) as SqlRow[];
    const questions = this.database
      .prepare(
        "SELECT * FROM open_questions WHERE workspace_id = ? ORDER BY updated_at DESC, id",
      )
      .all(this.workspaceId) as SqlRow[];
    const identityAmbiguities = this.database
      .prepare(
        "SELECT * FROM identity_ambiguities WHERE workspace_id = ? ORDER BY created_at DESC, id",
      )
      .all(this.workspaceId) as SqlRow[];
    const revisions = this.database
      .prepare(
        "SELECT * FROM revisions WHERE workspace_id = ? ORDER BY revision",
      )
      .all(this.workspaceId) as SqlRow[];
    return {
      schemaVersion: MEMORY_SCHEMA_VERSION,
      workspace: {
        id: String(workspace.id),
        name: String(workspace.name),
        revision: Number(workspace.revision),
        createdAt: String(workspace.created_at),
      },
      sources: sources.map(this.mapSource),
      events: events.map(this.mapEvent),
      annotations: annotations.map(this.mapAnnotation),
      roles: this.hypotheses.roles(),
      relations: this.hypotheses.relations(),
      directions: this.hypotheses.directions(),
      actions: this.hypotheses.actions(),
      goals: goals.map((row) => ({
        id: String(row.id),
        workspaceId: String(row.workspace_id),
        text: String(row.text),
        confirmedByUser: Boolean(row.confirmed_by_user),
        problem:
          row.problem === null || row.problem === undefined
            ? null
            : String(row.problem),
        origin: (row.origin ?? "user") as "user" | "analysis",
        citations:
          row.citations_json === null || row.citations_json === undefined
            ? []
            : JSON.parse(String(row.citations_json)),
        dismissed: row.dismissed_at !== null && row.dismissed_at !== undefined,
        revision: Number(row.row_version),
        createdAt: String(row.created_at),
        updatedAt: String(row.updated_at),
      })),
      claims: claims.map((row) => ({
        id: String(row.id),
        workspaceId: String(row.workspace_id),
        text: String(row.text),
        category: String(row.category) as Claim["category"],
        modality: String(row.modality) as Claim["modality"],
        knowledgeStatus: String(
          row.knowledge_status,
        ) as Claim["knowledgeStatus"],
        validFrom: row.valid_from === null ? null : String(row.valid_from),
        validTo: row.valid_to === null ? null : String(row.valid_to),
        contestedRevision:
          row.contested_revision == null
            ? null
            : Number(row.contested_revision),
        citations: (
          this.database
            .prepare(
              "SELECT source_id, span_start, span_end, quote FROM claim_sources WHERE claim_id = ? ORDER BY source_id, span_start",
            )
            .all(String(row.id)) as SqlRow[]
        ).map((citation) => ({
          sourceId: String(citation.source_id),
          spanStart: Number(citation.span_start),
          spanEnd: Number(citation.span_end),
          quote: String(citation.quote),
        })),
        revision: Number(row.row_version),
        createdAt: String(row.created_at),
        updatedAt: String(row.updated_at),
      })),
      persons: persons.map((row) => ({
        id: String(row.id),
        workspaceId: String(row.workspace_id),
        displayName: String(row.display_name),
        resolutionStatus: String(
          row.resolution_status,
        ) as Person["resolutionStatus"],
        revision: Number(row.row_version),
        createdAt: String(row.created_at),
        updatedAt: String(row.updated_at),
      })),
      episodes: episodes.map((row) => ({
        id: String(row.id),
        workspaceId: String(row.workspace_id),
        title: String(row.title),
        occurredStart:
          row.occurred_start === null ? null : String(row.occurred_start),
        occurredEnd:
          row.occurred_end === null ? null : String(row.occurred_end),
        temporalPrecision: String(
          row.temporal_precision,
        ) as Episode["temporalPrecision"],
        context: row.context === null ? null : String(row.context),
        revision: Number(row.row_version),
        createdAt: String(row.created_at),
        updatedAt: String(row.updated_at),
      })),
      hypotheses: hypotheses.map((row) => this.hypotheses.mapHypothesis(row)),
      questions: questions.map((row) => this.hypotheses.mapQuestion(row)),
      identityAmbiguities: identityAmbiguities.map((row) => ({
        id: String(row.id),
        workspaceId: String(row.workspace_id),
        eventId: String(row.event_id),
        mention: String(row.mention),
        candidatePersonIds: JSON.parse(
          String(row.candidate_person_ids_json),
        ) as IdentityAmbiguity["candidatePersonIds"],
        status: String(row.status) as IdentityAmbiguity["status"],
        createdAt: String(row.created_at),
        resolvedAt: row.resolved_at === null ? null : String(row.resolved_at),
      })),
      revisions: revisions.map((row) => ({
        revision: Number(row.revision),
        commandType: String(row.command_type) as RevisionEntry["commandType"],
        changedRefs: JSON.parse(String(row.changed_refs_json)) as EntityRef[],
        createdAt: String(row.created_at),
      })),
    };
  }

  search(
    input: string | MemorySearchQuery,
    fallbackLimit = 50,
  ): MemorySearchResult[] {
    const query =
      typeof input === "string" ? { text: input, limit: fallbackLimit } : input;
    const conditions = ["e.workspace_id = ?"];
    const parameters: (string | number)[] = [this.workspaceId];
    const escapeLike = (value: string) =>
      `%${value.replace(/[\\%_]/g, "\\$&")}%`;
    if (query.text?.trim()) {
      const text = escapeLike(query.text.trim());
      conditions.push(
        "(e.title LIKE ? ESCAPE '\\' OR e.text LIKE ? ESCAPE '\\' OR e.context LIKE ? ESCAPE '\\')",
      );
      parameters.push(text, text, text);
    }
    if (query.context?.trim()) {
      conditions.push("e.context LIKE ? ESCAPE '\\'");
      parameters.push(escapeLike(query.context.trim()));
    }
    if (query.personId) {
      conditions.push(
        "EXISTS (SELECT 1 FROM event_participants ep WHERE ep.event_id = e.id AND ep.person_id = ?)",
      );
      parameters.push(query.personId);
    }
    if (query.occurredFrom) {
      conditions.push("COALESCE(e.occurred_end, e.occurred_start) >= ?");
      parameters.push(query.occurredFrom);
    }
    if (query.occurredTo) {
      conditions.push("e.occurred_start <= ?");
      parameters.push(query.occurredTo);
    }
    const requestedLimit = query.limit ?? fallbackLimit;
    parameters.push(
      Number.isInteger(requestedLimit) && requestedLimit > 0
        ? Math.min(requestedLimit, 100)
        : fallbackLimit,
    );
    const rows = this.database
      .prepare(
        `SELECT e.*, s.kind AS source_kind, s.content AS source_content, s.content_hash AS source_content_hash, s.recorded_at AS source_recorded_at, s.narrated_at AS source_narrated_at, s.sensitivity AS source_sensitivity, s.created_at AS source_created_at FROM events e JOIN sources s ON s.id = e.source_id WHERE ${conditions.join(" AND ")} ORDER BY e.created_at DESC, e.id LIMIT ?`,
      )
      .all(...parameters) as SqlRow[];
    const participants = this.database.prepare(
      "SELECT p.id, p.display_name FROM event_participants ep JOIN persons p ON p.id = ep.person_id WHERE ep.event_id = ? ORDER BY p.display_name, p.id",
    );
    return rows.map((row) => ({
      event: this.mapEvent(row),
      source: this.mapSource({
        id: row.source_id,
        workspace_id: row.workspace_id,
        kind: row.source_kind,
        content: row.source_content,
        content_hash: row.source_content_hash,
        recorded_at: row.source_recorded_at,
        narrated_at: row.source_narrated_at,
        sensitivity: row.source_sensitivity,
        created_at: row.source_created_at,
      }),
      participants: (participants.all(String(row.id)) as SqlRow[]).map(
        (person) => ({
          id: String(person.id),
          displayName: String(person.display_name),
        }),
      ),
    }));
  }

  prepareAnalysis(command: PrepareAnalysisCommand): ContextPacket {
    const tasks = ["extract", "interpret", "revise", "explore"];
    if (!tasks.includes(command.task))
      throw new DomainError(
        "invalid_analysis_task",
        "Tâche d’analyse inconnue.",
      );
    const allowed =
      command.allowedOperations ?? DEFAULT_OPERATIONS[command.task];
    if (
      allowed.length === 0 ||
      allowed.some((kind) => !COGNITIVE_OPERATION_KINDS.includes(kind))
    )
      throw new DomainError(
        "invalid_allowed_operations",
        "Liste d’opérations autorisées invalide.",
      );
    const modes = ["demo-fixture", "assisted", "automatic"];
    const mode = command.mode ?? "assisted";
    if (!modes.includes(mode))
      throw new DomainError("invalid_analysis_mode", "Mode d’analyse inconnu.");
    const providerId =
      command.providerId ??
      (mode === "assisted"
        ? "sol-assisted"
        : mode === "demo-fixture"
          ? "fixture"
          : "unconfigured-automatic");
    if (
      (mode === "assisted" && providerId !== "sol-assisted") ||
      (mode === "demo-fixture" && providerId === "sol-assisted")
    )
      throw new DomainError(
        "provider_mode_mismatch",
        "Le fournisseur ne correspond pas au mode d’analyse.",
      );

    const snapshot = this.snapshot();
    const focus =
      command.focus && command.focus.length
        ? command.focus
        : snapshot.events.slice(0, 20).map((event) => ({
            kind: "event" as const,
            id: event.id,
          }));
    if (focus.length > 100)
      throw new DomainError("focus_too_large", "Le focus dépasse 100 objets.");
    for (const ref of focus)
      if (!this.entityExists(ref))
        throw new DomainError(
          "focus_not_found",
          `Le focus ${ref.kind}:${ref.id} n’existe pas dans cet espace.`,
          404,
        );

    const sourceIds = new Set<string>();
    const focusHypothesisIds = new Set(
      focus.filter((ref) => ref.kind === "hypothesis").map((ref) => ref.id),
    );
    const hypothesisContext = this.hypotheses.contextFor(
      new Set(),
      focusHypothesisIds,
    );
    for (const claimId of hypothesisContext.evidenceClaimIds)
      for (const row of this.database
        .prepare("SELECT source_id FROM claim_sources WHERE claim_id = ?")
        .all(claimId) as SqlRow[])
        sourceIds.add(String(row.source_id));
    for (const ref of focus) {
      if (ref.kind === "source") sourceIds.add(ref.id);
      if (ref.kind === "event") {
        const row = this.database
          .prepare(
            "SELECT source_id FROM events WHERE workspace_id = ? AND id = ?",
          )
          .get(this.workspaceId, ref.id) as SqlRow | undefined;
        if (row) sourceIds.add(String(row.source_id));
      }
      if (ref.kind === "claim") {
        const rows = this.database
          .prepare(
            "SELECT cs.source_id FROM claim_sources cs JOIN claims c ON c.id = cs.claim_id WHERE c.workspace_id = ? AND c.id = ?",
          )
          .all(this.workspaceId, ref.id) as SqlRow[];
        for (const row of rows) sourceIds.add(String(row.source_id));
      }
      if (ref.kind === "person") {
        const rows = this.database
          .prepare(
            "SELECT e.source_id FROM event_participants ep JOIN events e ON e.id = ep.event_id WHERE e.workspace_id = ? AND ep.person_id = ?",
          )
          .all(this.workspaceId, ref.id) as SqlRow[];
        for (const row of rows) sourceIds.add(String(row.source_id));
      }
      if (ref.kind === "episode") {
        const rows = this.database
          .prepare(
            "SELECT source_id FROM events WHERE workspace_id = ? AND episode_id = ?",
          )
          .all(this.workspaceId, ref.id) as SqlRow[];
        for (const row of rows) sourceIds.add(String(row.source_id));
      }
    }
    if (focus.length === 0) {
      for (const source of snapshot.sources.slice(0, 20))
        sourceIds.add(source.id);
    }
    const selectedSources = snapshot.sources.filter((source) =>
      sourceIds.has(source.id),
    );
    const selectedEventIds = new Set(
      focus.filter((ref) => ref.kind === "event").map((ref) => ref.id),
    );
    for (const ref of focus) {
      if (ref.kind === "person") {
        const rows = this.database
          .prepare(
            "SELECT event_id FROM event_participants WHERE person_id = ?",
          )
          .all(ref.id) as SqlRow[];
        for (const row of rows) selectedEventIds.add(String(row.event_id));
      }
      if (ref.kind === "episode")
        for (const event of snapshot.events)
          if (event.episodeId === ref.id) selectedEventIds.add(event.id);
    }
    const selectedEvents = snapshot.events.filter((event) =>
      selectedEventIds.has(event.id),
    );
    const selectedPersonIds = new Set(
      focus.filter((ref) => ref.kind === "person").map((ref) => ref.id),
    );
    const selectedIdentityAmbiguities = snapshot.identityAmbiguities.filter(
      (ambiguity) =>
        ambiguity.status === "open" && selectedEventIds.has(ambiguity.eventId),
    );
    for (const ambiguity of selectedIdentityAmbiguities)
      for (const personId of ambiguity.candidatePersonIds)
        selectedPersonIds.add(personId);
    const selectedEpisodeIds = new Set(
      focus.filter((ref) => ref.kind === "episode").map((ref) => ref.id),
    );
    for (const event of selectedEvents) {
      if (event.episodeId) selectedEpisodeIds.add(event.episodeId);
      const rows = this.database
        .prepare("SELECT person_id FROM event_participants WHERE event_id = ?")
        .all(event.id) as SqlRow[];
      for (const row of rows) selectedPersonIds.add(String(row.person_id));
    }
    const selectedClaimIds = new Set([
      ...focus.filter((ref) => ref.kind === "claim").map((ref) => ref.id),
      ...hypothesisContext.evidenceClaimIds,
    ]);
    for (const sourceId of sourceIds) {
      const rows = this.database
        .prepare("SELECT claim_id FROM claim_sources WHERE source_id = ?")
        .all(sourceId) as SqlRow[];
      for (const row of rows) selectedClaimIds.add(String(row.claim_id));
    }
    const packetHypotheses = this.hypotheses.contextFor(
      selectedClaimIds,
      focusHypothesisIds,
    );
    for (const claimId of packetHypotheses.evidenceClaimIds) {
      if (selectedClaimIds.has(claimId)) continue;
      selectedClaimIds.add(claimId);
      for (const row of this.database
        .prepare("SELECT source_id FROM claim_sources WHERE claim_id = ?")
        .all(claimId) as SqlRow[])
        if (!sourceIds.has(String(row.source_id))) {
          sourceIds.add(String(row.source_id));
          const source = snapshot.sources.find(
            (item) => item.id === String(row.source_id),
          );
          if (source) selectedSources.push(source);
        }
    }
    for (const hypothesis of packetHypotheses.hypotheses)
      for (const subject of hypothesis.subjects) {
        if (subject.kind === "person") selectedPersonIds.add(subject.personId);
        // Les membres d'une relation sujet sont aussi nommables (RAPPORT-010).
        if (subject.kind === "relation")
          for (const member of subject.members)
            if (member.kind === "person")
              selectedPersonIds.add(member.personId);
      }
    const createdAt = nowIso();
    const expiresAt =
      command.expiresAt ??
      new Date(Date.parse(createdAt) + 60 * 60 * 1000).toISOString();
    if (
      !Number.isFinite(Date.parse(expiresAt)) ||
      Date.parse(expiresAt) <= Date.parse(createdAt) ||
      Date.parse(expiresAt) > Date.parse(createdAt) + 7 * 24 * 60 * 60 * 1000
    )
      throw new DomainError(
        "invalid_expiration",
        "L’expiration doit être future et limitée à 7 jours.",
      );
    const requestId = randomUUID();
    const focused = new Set(focus.map((ref) => `${ref.kind}:${ref.id}`));
    const relevant = new Set([
      ...focused,
      ...selectedSources.map((source) => `source:${source.id}`),
      ...selectedEvents.map((event) => `event:${event.id}`),
      ...[...selectedPersonIds].map((id) => `person:${id}`),
      ...[...selectedEpisodeIds].map((id) => `episode:${id}`),
      ...[...selectedClaimIds].map((id) => `claim:${id}`),
      ...packetHypotheses.hypotheses.map((item) => `hypothesis:${item.id}`),
      ...packetHypotheses.questions.map((item) => `question:${item.id}`),
    ]);
    const packetAnnotations = snapshot.annotations.filter((annotation) =>
      relevant.has(`${annotation.target.kind}:${annotation.target.id}`),
    );
    // Les annotations citables apportent leur source au paquet.
    for (const annotation of packetAnnotations)
      if (annotation.sourceId && !sourceIds.has(annotation.sourceId)) {
        const source = snapshot.sources.find(
          (item) => item.id === annotation.sourceId,
        );
        if (source) {
          sourceIds.add(source.id);
          selectedSources.push(source);
        }
      }
    const packetWithoutHash: Omit<ContextPacket, "contextHash"> = {
      schemaVersion: COGNITION_SCHEMA_VERSION,
      requestId,
      workspaceId: this.workspaceId,
      baseRevision: snapshot.workspace.revision,
      createdAt,
      expiresAt,
      mode,
      providerId,
      task: command.task,
      promptVersion: ANALYST_PROMPT_VERSION,
      focus,
      sources: selectedSources.map((source) => ({
        sourceId: source.id,
        contentHash: source.contentHash,
        spanStart: 0,
        spanEnd: source.content.length,
        quote: source.content,
        text: source.content,
      })),
      entities: [
        ...selectedEvents,
        ...snapshot.persons.filter((person) =>
          selectedPersonIds.has(person.id),
        ),
        ...selectedIdentityAmbiguities,
      ],
      episodes: snapshot.episodes.filter((episode) =>
        selectedEpisodeIds.has(episode.id),
      ),
      claims: snapshot.claims.filter((claim) => selectedClaimIds.has(claim.id)),
      hypotheses: packetHypotheses.hypotheses,
      annotations: packetAnnotations,
      questions: packetHypotheses.questions,
      // Rôles des épisodes du paquet et relations des personnes présentes (BRIEF-004).
      roles: snapshot.roles.filter((role) =>
        selectedEvents.some((event) => event.id === role.eventId),
      ),
      relations: snapshot.relations.filter((relation) =>
        relation.members.some(
          (member) =>
            member.kind === "person" && selectedPersonIds.has(member.personId),
        ),
      ),
      goals: snapshot.goals.filter((goal) => focused.has(`goal:${goal.id}`)),
      // BRIEF-005 : directions des objectifs visés, et actions dont la lecture
      // actionnée ou l'objectif est dans le paquet, avec prédictions figées et
      // résultat, pour comparer la prédiction à la réalité.
      ...this.packetDirections(snapshot, focused, packetHypotheses.hypotheses),
      coverage: {
        included: [...sourceIds],
        omissions: [],
        truncated: false,
      },
      allowedOperations: [...new Set(allowed)],
      limits: {
        maxBytes: COGNITION_MAX_BYTES,
        maxOperations: COGNITION_MAX_OPERATIONS,
      },
    };
    const compact =
      (command.context ?? "working") === "working"
        ? this.workingMemory(packetWithoutHash, snapshot)
        : { ...packetWithoutHash, memory: "full" as const };
    const packet: ContextPacket = {
      ...compact,
      contextHash: cognitionHash(compact),
    };
    // Mesure de la mémoire de travail sur un même état (RAPPORT-012).
    this.lastPacketSizes = {
      working: JSON.stringify(compact).length,
      full: JSON.stringify({ ...packetWithoutHash, memory: "full" }).length,
    };
    this.database
      .prepare(
        "INSERT INTO analysis_requests(id, workspace_id, base_revision, created_at, expires_at, mode, provider_id, task, prompt_version, prompt_hash, context_hash, context_json, allowed_operations_json, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'awaiting_response')",
      )
      .run(
        requestId,
        this.workspaceId,
        packet.baseRevision,
        createdAt,
        expiresAt,
        mode,
        providerId,
        command.task,
        packet.promptVersion,
        ANALYST_PROMPT_HASH,
        packet.contextHash,
        JSON.stringify(packet),
        JSON.stringify(packet.allowedOperations),
      );
    return packet;
  }

  /** Tailles (caractères JSON) du dernier paquet préparé, complet et de travail. */
  lastPacketSizes: { working: number; full: number } | null = null;

  receiveAnalysis(value: unknown): AnalysisPreview {
    const rawJson = JSON.stringify(value);
    if (Buffer.byteLength(rawJson, "utf8") > COGNITION_MAX_BYTES)
      throw new DomainError(
        "proposal_too_large",
        "La proposition dépasse 1 Mio.",
        413,
      );
    const proposal = parseCognitiveProposal(value);
    const request = this.database
      .prepare(
        "SELECT * FROM analysis_requests WHERE workspace_id = ? AND id = ?",
      )
      .get(this.workspaceId, proposal.requestId) as SqlRow | undefined;
    if (!request)
      throw new DomainError(
        "analysis_request_not_found",
        "Demande d’analyse inconnue.",
        404,
      );
    const responseHash = cognitionHash(proposal);
    const existing = this.database
      .prepare(
        "SELECT * FROM analysis_responses WHERE request_id = ? AND response_hash = ?",
      )
      .get(proposal.requestId, responseHash) as SqlRow | undefined;
    if (existing) return this.mapAnalysisPreview(existing, true);
    if (
      ["applied", "no_change", "cancelled", "expired"].includes(
        String(request.status),
      )
    )
      throw new DomainError(
        "already_resolved",
        `Cette demande est déjà ${String(request.status)}.`,
        409,
      );
    if (Date.parse(String(request.expires_at)) <= Date.now()) {
      this.database
        .prepare(
          "UPDATE analysis_requests SET status = 'expired' WHERE workspace_id = ? AND id = ?",
        )
        .run(this.workspaceId, proposal.requestId);
      throw new DomainError("analysis_expired", "Cette demande a expiré.", 409);
    }

    const responseId = randomUUID();
    const receivedAt = nowIso();
    const manualWaitDurationMs = Math.max(
      0,
      Date.parse(receivedAt) - Date.parse(String(request.created_at)),
    );
    try {
      if (
        proposal.workspaceId !== this.workspaceId ||
        proposal.baseRevision !== Number(request.base_revision) ||
        proposal.contextHash !== request.context_hash
      )
        throw new DomainError(
          "proposal_mismatch",
          "La proposition ne correspond pas exactement à la demande.",
        );
      const allowed = JSON.parse(
        String(request.allowed_operations_json),
      ) as CognitiveOperationKind[];
      if (
        proposal.operations.some(
          (operation) => !allowed.includes(operation.kind),
        )
      )
        throw new DomainError(
          "operation_not_allowed",
          "La proposition contient une opération non autorisée.",
        );
      const packet = JSON.parse(String(request.context_json)) as ContextPacket;
      const { kept, dropped } = this.withoutMiscited(proposal, packet);
      this.dryRun(() => this.applyOperations(kept, packet, receivedAt));
      const status =
        proposal.outcome === "needs_context"
          ? "needs_context"
          : "ready_for_review";
      this.database
        .prepare(
          "INSERT INTO analysis_responses(id, workspace_id, request_id, response_hash, raw_json, normalized_json, outcome, declared_model, verified_model, received_at, status, provider_usage_json, provider_cost_json, inference_duration_ms, manual_wait_duration_ms, dropped_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, NULL, NULL, NULL, ?, ?)",
        )
        .run(
          responseId,
          this.workspaceId,
          proposal.requestId,
          responseHash,
          rawJson,
          JSON.stringify(kept),
          proposal.outcome,
          proposal.modelDeclaration.declaredModel,
          receivedAt,
          status,
          manualWaitDurationMs,
          dropped.length ? JSON.stringify(dropped) : null,
        );
      this.database
        .prepare(
          "UPDATE analysis_requests SET status = ?, resolved_response_id = CASE WHEN ? = 'needs_context' THEN ? ELSE resolved_response_id END WHERE workspace_id = ? AND id = ?",
        )
        .run(status, status, responseId, this.workspaceId, proposal.requestId);
      const row = this.database
        .prepare("SELECT * FROM analysis_responses WHERE id = ?")
        .get(responseId) as SqlRow;
      return this.mapAnalysisPreview(row, false);
    } catch (error) {
      if (!(error instanceof DomainError)) throw error;
      this.database
        .prepare(
          "INSERT INTO analysis_responses(id, workspace_id, request_id, response_hash, raw_json, normalized_json, outcome, declared_model, verified_model, received_at, status, rejection_code, rejection_message, provider_usage_json, provider_cost_json, inference_duration_ms, manual_wait_duration_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, 'rejected', ?, ?, NULL, NULL, NULL, ?)",
        )
        .run(
          responseId,
          this.workspaceId,
          proposal.requestId,
          responseHash,
          rawJson,
          JSON.stringify(proposal),
          proposal.outcome,
          proposal.modelDeclaration.declaredModel,
          receivedAt,
          error.code,
          error.message,
          manualWaitDurationMs,
        );
      const row = this.database
        .prepare("SELECT * FROM analysis_responses WHERE id = ?")
        .get(responseId) as SqlRow;
      return this.mapAnalysisPreview(row, false);
    }
  }

  applyAnalysis(responseId: string): ApplicationResult {
    const response = this.database
      .prepare(
        "SELECT * FROM analysis_responses WHERE workspace_id = ? AND id = ?",
      )
      .get(this.workspaceId, responseId) as SqlRow | undefined;
    if (!response)
      throw new DomainError(
        "analysis_response_not_found",
        "Réponse d’analyse inconnue.",
        404,
      );
    if (response.application_result_json) {
      const replayed = JSON.parse(
        String(response.application_result_json),
      ) as ApplicationResult;
      return { ...replayed, replayed: true };
    }
    if (response.status !== "ready_for_review")
      throw new DomainError(
        "analysis_not_applicable",
        `Cette réponse est ${String(response.status)}.`,
        409,
      );
    const request = this.database
      .prepare("SELECT * FROM analysis_requests WHERE id = ?")
      .get(String(response.request_id)) as SqlRow;
    if (this.revision !== Number(request.base_revision)) {
      this.database
        .prepare("UPDATE analysis_responses SET status = 'stale' WHERE id = ?")
        .run(responseId);
      this.database
        .prepare("UPDATE analysis_requests SET status = 'stale' WHERE id = ?")
        .run(String(request.id));
      throw new DomainError(
        "stale_revision",
        "La mémoire a changé depuis la préparation de cette analyse.",
        409,
      );
    }
    const proposal = parseCognitiveProposal(
      JSON.parse(String(response.normalized_json)),
    );
    if (proposal.outcome === "needs_context")
      throw new DomainError(
        "analysis_not_applicable",
        "Cette réponse demande du contexte.",
        409,
      );
    return this.transaction(() => {
      const lockedRequest = this.database
        .prepare("SELECT * FROM analysis_requests WHERE id = ?")
        .get(String(request.id)) as SqlRow;
      if (this.revision !== Number(lockedRequest.base_revision))
        throw new DomainError(
          "stale_revision",
          "La mémoire a changé pendant l’application.",
          409,
        );
      const timestamp = nowIso();
      const packet = JSON.parse(
        String(lockedRequest.context_json),
      ) as ContextPacket;
      const { created, changed, warnings } = this.applyOperations(
        proposal,
        packet,
        timestamp,
      );
      const touched = [...created, ...changed];
      const resultRevision = touched.length
        ? this.advanceRevision("analysis.apply", touched, timestamp)
        : this.revision;
      const status = touched.length ? "applied" : "no_change";
      const result: ApplicationResult = {
        requestId: proposal.requestId,
        responseId,
        status,
        baseRevision: proposal.baseRevision,
        resultRevision,
        createdIds: created,
        changedIds: touched,
        warnings: [
          ...(response.dropped_json
            ? (
                JSON.parse(String(response.dropped_json)) as Array<{
                  key: string;
                  code: string;
                  message: string;
                }>
              ).map((item) => ({
                code: "operation_dropped",
                message: `Opération « ${item.key} » écartée (${item.code}) : ${item.message}`,
              }))
            : []),
          ...warnings,
        ],
        errors: [],
        replayed: false,
      };
      this.database
        .prepare(
          "UPDATE analysis_responses SET status = ?, application_result_json = ?, applied_at = ? WHERE id = ?",
        )
        .run(status, JSON.stringify(result), timestamp, responseId);
      this.database
        .prepare(
          "UPDATE analysis_requests SET status = ?, resolved_response_id = ? WHERE id = ?",
        )
        .run(status, responseId, proposal.requestId);
      return result;
    });
  }

  /**
   * Applique les opérations d'une proposition dans la transaction courante.
   * Ordre fixe : faits (événements, claims), hypothèses, révisions, questions ;
   * puis contrôles différés (alternatives, statuts, confiance). Utilisé aussi
   * à blanc à la réception pour que l'aperçu reflète les refus du moteur.
   */
  private applyOperations(
    proposal: CognitiveProposal,
    packet: ContextPacket,
    timestamp: string,
  ) {
    const created: EntityRef[] = [];
    const changed: EntityRef[] = [];
    if (proposal.outcome !== "proposed")
      return { created, changed, warnings: [] };
    const context: OperationContext = {
      packet,
      revision: this.revision + 1,
      timestamp,
      keys: new Map(),
      links: [],
      deferred: [],
      warnings: [],
    };
    const order: CognitiveOperationKind[] = [
      "propose_event",
      "propose_claim",
      "propose_role",
      "propose_hypothesis",
      "propose_critique",
      "revise_hypothesis",
      "propose_question",
      "propose_goal",
      "propose_direction",
    ];
    const operations = [...proposal.operations].sort(
      (left, right) => order.indexOf(left.kind) - order.indexOf(right.kind),
    );
    for (const operation of operations) {
      if (operation.kind === "propose_claim") {
        const id = randomUUID();
        this.database
          .prepare(
            "INSERT INTO claims(id, workspace_id, text, category, modality, knowledge_status, valid_from, valid_to, row_version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'unresolved', ?, ?, 1, ?, ?)",
          )
          .run(
            id,
            this.workspaceId,
            operation.payload.text,
            operation.payload.category,
            operation.payload.modality,
            operation.payload.validFrom,
            operation.payload.validTo,
            timestamp,
            timestamp,
          );
        for (const source of operation.payload.citations)
          this.database
            .prepare(
              "INSERT INTO claim_sources(claim_id, source_id, span_start, span_end, quote) VALUES (?, ?, ?, ?, ?)",
            )
            .run(
              id,
              source.sourceId,
              source.spanStart,
              source.spanEnd,
              source.quote,
            );
        created.push({ kind: "claim", id });
        context.keys.set(operation.key, { kind: "claim", id });
      }
      if (operation.kind === "propose_event") {
        const id = randomUUID();
        this.database
          .prepare(
            "INSERT INTO events(id, workspace_id, title, text, category, source_id, episode_id, occurred_start, occurred_end, temporal_precision, context, row_version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, 1, ?, ?)",
          )
          .run(
            id,
            this.workspaceId,
            operation.payload.title,
            operation.payload.text,
            operation.payload.category,
            operation.payload.citations[0].sourceId,
            operation.payload.occurredStart,
            operation.payload.occurredEnd,
            operation.payload.temporalPrecision,
            operation.payload.context,
            timestamp,
            timestamp,
          );
        created.push({ kind: "event", id });
        context.keys.set(operation.key, { kind: "event", id });
      }
      if (
        operation.kind === "propose_hypothesis" ||
        operation.kind === "revise_hypothesis" ||
        operation.kind === "propose_question" ||
        operation.kind === "propose_critique" ||
        operation.kind === "propose_role" ||
        operation.kind === "propose_direction" ||
        operation.kind === "propose_goal"
      ) {
        const result = this.hypotheses.applyOperation(operation, context);
        created.push(...result.created);
        changed.push(...result.changed);
      }
    }
    for (const link of context.links) link();
    for (const check of context.deferred) check();
    return { created, changed, warnings: context.warnings };
  }

  private packetDirections(
    snapshot: WorkspaceSnapshot,
    focused: Set<string>,
    hypotheses: unknown[],
  ) {
    const hypothesisIds = new Set(
      hypotheses.map((item) => String((item as { id: string }).id)),
    );
    const concerned = (direction: DirectionRecord) =>
      (direction.goalId !== null && focused.has(`goal:${direction.goalId}`)) ||
      (direction.lever.hypothesisId !== null &&
        hypothesisIds.has(direction.lever.hypothesisId));
    const directions = snapshot.directions.filter(
      (direction) =>
        direction.status !== "superseded" &&
        direction.status !== "dismissed" &&
        concerned(direction),
    );
    const directionIds = new Set(directions.map((item) => item.id));
    return {
      directions,
      actions: snapshot.actions.filter((action) =>
        directionIds.has(action.directionId),
      ),
    };
  }

  /**
   * D-026 : mémoire de travail. Le paquet garde tout l'état du modèle du
   * monde, mais sous forme compacte : les faits et rôles déjà extraits ne
   * recopient plus leurs citations, les épisodes ne recopient plus leur
   * texte, et seules les notes non encore analysées (ou apportées par une
   * annotation) gardent leur texte intégral, citable. Le reste se cite par
   * identifiant ou se consulte par requête (D-023).
   */
  private workingMemory(
    packet: Omit<ContextPacket, "contextHash">,
    snapshot: WorkspaceSnapshot,
  ): Omit<ContextPacket, "contextHash"> {
    const analysed = new Set<string>();
    for (const claim of snapshot.claims)
      for (const citation of claim.citations) analysed.add(citation.sourceId);
    for (const role of snapshot.roles)
      for (const citation of role.citations) analysed.add(citation.sourceId);
    const annotationSources = new Set(
      snapshot.annotations
        .map((annotation) => annotation.sourceId)
        .filter((id): id is string => Boolean(id)),
    );
    const keepText = (sourceId: string) =>
      !analysed.has(sourceId) || annotationSources.has(sourceId);
    const omit = <T extends Record<string, unknown>>(item: T, keys: string[]) =>
      Object.fromEntries(
        Object.entries(item).filter(([key]) => !keys.includes(key)),
      );
    const technical = [
      "workspaceId",
      "createdAt",
      "updatedAt",
      "createdRevision",
      "rowVersion",
    ];
    const sources = packet.sources.filter((source) =>
      keepText(source.sourceId),
    );
    const omitted = packet.sources.length - sources.length;
    // Un champ absent vaut null ou vide (le prompt le dit) : on ne transmet
    // ni les valeurs nulles ni les listes vides.
    const prune = (value: unknown): unknown => {
      if (Array.isArray(value)) return value.map(prune);
      if (value && typeof value === "object")
        return Object.fromEntries(
          Object.entries(value as Record<string, unknown>)
            .filter(
              ([, item]) =>
                item !== null &&
                item !== undefined &&
                !(Array.isArray(item) && item.length === 0),
            )
            .map(([key, item]) => [key, prune(item)]),
        );
      return value;
    };
    const pruneItems = (items: unknown[]) => items.map(prune);
    const compact = {
      ...packet,
      memory: "working" as const,
      sources,
      entities: packet.entities.map((entity) => {
        const item = entity as Record<string, unknown>;
        if (item.title === undefined) return omit(item, technical);
        // Épisode : son texte est celui de la source ; on le garde seulement
        // si la source n'a pas encore été analysée.
        return omit(
          item,
          keepText(String(item.sourceId)) ? technical : [...technical, "text"],
        );
      }),
      claims: packet.claims.map((claim) => {
        const item = claim as Record<string, unknown> & {
          citations?: Array<{ sourceId: string }>;
        };
        return {
          ...omit(item, [...technical, "citations"]),
          sourceIds: [
            ...new Set(
              (item.citations ?? []).map((citation) => citation.sourceId),
            ),
          ],
        };
      }),
      roles: packet.roles.map((role) =>
        omit(role as Record<string, unknown>, ["citations", "createdRevision"]),
      ),
      hypotheses: packet.hypotheses.map((hypothesis) => {
        const item = hypothesis as Record<string, unknown> & {
          evidence?: Array<{
            claimId: string;
            stance: string;
            supersededRevision: number | null;
          }>;
          critiques?: Array<{ findings?: Array<{ kind: string }> }>;
        };
        return {
          ...omit(item, [
            ...technical,
            "reviewSinceRevision",
            "evidence",
            "critiques",
            "mechanism",
            "limits",
            "revisionConditions",
          ]),
          evidence: (item.evidence ?? [])
            .filter((entry) => entry.supersededRevision === null)
            .map((entry) => ({ claimId: entry.claimId, stance: entry.stance })),
          critiques: (item.critiques ?? []).map((critique) =>
            (critique.findings ?? []).map((finding) => finding.kind),
          ),
          // Le mécanisme, les limites et les conditions de révision se lisent
          // par get_hypothesis ; seule la prédiction reste, pour comparer au
          // résultat d'une action (RAPPORT-012).
          prediction:
            (item.mechanism as { prediction?: string } | null | undefined)
              ?.prediction ?? null,
        };
      }),
      // Une direction non choisie se résume à ce qui évite de la reproposer ;
      // la direction choisie garde ses prédictions et son détail.
      directions: packet.directions.map((direction) => {
        const item = direction as Record<string, unknown>;
        const chosen =
          item.status === "chosen" ||
          packet.actions.some(
            (action) =>
              (action as { directionId?: string }).directionId === item.id,
          );
        return chosen
          ? omit(item, technical)
          : Object.fromEntries(
              ["id", "goalId", "title", "action", "lever", "status"]
                .filter((key) => key in item)
                .map((key) => [key, item[key]]),
            );
      }),
      // Une question close ne sert qu'à ne pas être reposée.
      questions: packet.questions.map((question) => {
        const item = question as Record<string, unknown>;
        return item.status === "open"
          ? omit(item, [...technical, "normalizedText"])
          : omit(item, [
              ...technical,
              "normalizedText",
              "discriminatingInfo",
              "whyNow",
              "answer",
            ]);
      }),
      coverage: {
        ...packet.coverage,
        included: packet.coverage.included.filter(keepText),
        omissions: [
          ...packet.coverage.omissions,
          ...(omitted
            ? [
                `${omitted} note(s) déjà analysée(s) : leurs faits sont dans claims et roles ; texte intégral sur requête (get_note).`,
              ]
            : []),
          ...(packet.hypotheses.length
            ? [
                "Lectures résumées : mécanisme, limites et conditions de révision sur requête (get_hypothesis).",
              ]
            : []),
          ...(packet.directions.length
            ? [
                "Directions non choisies résumées (titre, action, levier) ; la direction choisie reste entière.",
              ]
            : []),
        ],
      },
    };
    // Les listes de premier niveau restent présentes, même vides ; seuls
    // leurs éléments sont allégés.
    return {
      ...compact,
      entities: pruneItems(compact.entities),
      claims: pruneItems(compact.claims),
      roles: pruneItems(compact.roles),
      hypotheses: pruneItems(compact.hypotheses),
      questions: pruneItems(compact.questions),
      relations: pruneItems(compact.relations),
      directions: pruneItems(compact.directions),
      actions: pruneItems(compact.actions),
      annotations: pruneItems(compact.annotations),
      episodes: pruneItems(compact.episodes),
    };
  }

  /**
   * D-023 : requête du modèle dans la mémoire, en lecture seule. Le résultat
   * est journalisé avec l'analyse ; les objets servis deviennent citables et
   * référençables dans sa proposition. Une requête invalide renvoie une
   * erreur lisible au modèle au lieu d'interrompre l'analyse.
   */
  queryMemory(requestId: string, name: string, args: Record<string, unknown>) {
    const request = this.database
      .prepare(
        "SELECT id FROM analysis_requests WHERE workspace_id = ? AND id = ?",
      )
      .get(this.workspaceId, requestId);
    if (!request)
      throw new DomainError(
        "analysis_request_not_found",
        "Demande d’analyse inconnue.",
        404,
      );
    const snapshot = this.snapshot();
    const served: Record<string, Set<string>> = {
      source: new Set(),
      event: new Set(),
      person: new Set(),
      claim: new Set(),
      hypothesis: new Set(),
      relation: new Set(),
    };
    const str = (value: unknown) =>
      typeof value === "string" && value.trim() ? value.trim() : undefined;
    const person = (id: string) =>
      snapshot.persons.find((item) => item.id === id)?.displayName ?? null;
    const memberName = (member: RelationMember) =>
      member.kind === "self" ? "utilisateur" : person(member.personId);
    const note = (sourceId: string) => {
      const source = snapshot.sources.find((item) => item.id === sourceId);
      if (!source) return null;
      served.source.add(source.id);
      const events = snapshot.events.filter(
        (event) => event.sourceId === source.id,
      );
      for (const event of events) served.event.add(event.id);
      const claims = snapshot.claims.filter((claim) =>
        claim.citations.some((citation) => citation.sourceId === source.id),
      );
      for (const claim of claims) served.claim.add(claim.id);
      return {
        sourceId: source.id,
        contentHash: source.contentHash,
        text: source.content,
        events: events.map((event) => ({
          eventId: event.id,
          title: event.title,
          occurredStart: event.occurredStart,
        })),
        claims: claims.map((claim) => ({
          claimId: claim.id,
          text: claim.text,
          category: claim.category,
          contested: claim.contestedRevision !== null,
        })),
        roles: snapshot.roles
          .filter((role) => events.some((event) => event.id === role.eventId))
          .map((role) => ({
            eventId: role.eventId,
            member: memberName(role.subject),
            role: role.role,
            outcome: role.outcome,
          })),
      };
    };
    const readingSummary = (id: string) => {
      const hypothesis = snapshot.hypotheses.find((item) => item.id === id);
      if (!hypothesis) return null;
      served.hypothesis.add(hypothesis.id);
      return {
        hypothesisId: hypothesis.id,
        statement: hypothesis.statement,
        depth: hypothesis.depth,
        status: hypothesis.status,
        confidence: hypothesis.confidence,
        rank: hypothesis.rank,
      };
    };
    const relationView = (relationId: string) => {
      const relation = snapshot.relations.find(
        (item) => item.id === relationId,
      );
      if (!relation) return null;
      served.relation.add(relation.id);
      const keys = new Set(
        relation.members.map((member) =>
          member.kind === "self" ? "self" : `person:${member.personId}`,
        ),
      );
      return {
        relationId: relation.id,
        members: relation.members.map(memberName),
        indicators: relation.indicators,
        roles: snapshot.roles
          .filter((role) =>
            keys.has(
              role.subject.kind === "self"
                ? "self"
                : `person:${role.subject.personId}`,
            ),
          )
          .map((role) => {
            served.event.add(role.eventId);
            return {
              eventId: role.eventId,
              member: memberName(role.subject),
              role: role.role,
              outcome: role.outcome,
            };
          }),
        readings: snapshot.hypotheses
          .filter((item) =>
            item.subjects.some(
              (subject) =>
                subject.kind === "relation" &&
                subject.relationId === relation.id,
            ),
          )
          .map((item) => readingSummary(item.id)),
      };
    };
    let result: unknown;
    try {
      if (name === "search_notes") {
        const limit = Math.min(20, Math.max(1, Number(args.limit ?? 10) || 10));
        const who = str(args.person);
        const personId = who
          ? snapshot.persons.find(
              (item) => item.displayName.toLowerCase() === who.toLowerCase(),
            )?.id
          : undefined;
        const text = str(args.query);
        const from = str(args.from);
        const to = str(args.to);
        const matches = snapshot.sources
          .filter((source) => {
            const event = snapshot.events.find(
              (item) => item.sourceId === source.id,
            );
            const when = event?.occurredStart ?? source.recordedAt;
            if (
              text &&
              !source.content.toLowerCase().includes(text.toLowerCase())
            )
              return false;
            if (
              who &&
              !personId &&
              !source.content.toLowerCase().includes(who.toLowerCase())
            )
              return false;
            if (
              personId &&
              !source.content
                .toLowerCase()
                .includes(String(person(personId)).toLowerCase())
            )
              return false;
            if (from && when && when < from) return false;
            if (to && when && when > to) return false;
            return true;
          })
          .slice(0, limit);
        result = { notes: matches.map((source) => note(source.id)) };
      } else if (name === "get_note") {
        const sourceId =
          str(args.sourceId) ??
          snapshot.events.find((event) => event.id === str(args.eventId))
            ?.sourceId;
        const found = sourceId ? note(sourceId) : null;
        result = found ?? { error: "Note introuvable." };
      } else if (name === "get_person") {
        const target =
          snapshot.persons.find((item) => item.id === str(args.personId)) ??
          snapshot.persons.find(
            (item) =>
              item.displayName.toLowerCase() ===
              String(str(args.name) ?? "").toLowerCase(),
          );
        if (!target) result = { error: "Personne introuvable." };
        else {
          served.person.add(target.id);
          const key = `person:${target.id}`;
          const roles = snapshot.roles.filter(
            (role) =>
              role.subject.kind === "person" &&
              role.subject.personId === target.id,
          );
          for (const role of roles) served.event.add(role.eventId);
          result = {
            personId: target.id,
            name: target.displayName,
            episodes: roles.map((role) => {
              const event = snapshot.events.find(
                (item) => item.id === role.eventId,
              );
              return {
                eventId: role.eventId,
                title: event?.title ?? null,
                occurredStart: event?.occurredStart ?? null,
                role: role.role,
                outcome: role.outcome,
              };
            }),
            relations: snapshot.relations
              .filter((relation) =>
                relation.members.some(
                  (member) =>
                    member.kind === "person" && member.personId === target.id,
                ),
              )
              .map((relation) => relationView(relation.id)),
            readings: snapshot.hypotheses
              .filter((item) =>
                item.subjects.some((subject) =>
                  subject.kind === "relation"
                    ? subject.members.some(
                        (member) =>
                          member.kind === "person" &&
                          `person:${member.personId}` === key,
                      )
                    : subject.kind === "person" &&
                      subject.personId === target.id,
                ),
              )
              .map((item) => readingSummary(item.id)),
          };
        }
      } else if (name === "get_relation") {
        result = relationView(String(str(args.relationId))) ?? {
          error: "Relation introuvable.",
        };
      } else if (name === "get_hypothesis") {
        const hypothesis = snapshot.hypotheses.find(
          (item) => item.id === str(args.hypothesisId),
        );
        if (!hypothesis) result = { error: "Lecture introuvable." };
        else {
          served.hypothesis.add(hypothesis.id);
          result = {
            ...hypothesis,
            evidence: hypothesis.evidence.map((item) => {
              const claim = snapshot.claims.find(
                (entry) => entry.id === item.claimId,
              );
              if (claim) served.claim.add(claim.id);
              for (const citation of claim?.citations ?? [])
                served.source.add(citation.sourceId);
              return {
                claimId: item.claimId,
                stance: item.stance,
                active: item.supersededRevision === null,
                text: claim?.text ?? null,
                citations: claim?.citations ?? [],
              };
            }),
            history: snapshot.revisions
              .filter((revision) =>
                revision.changedRefs.some(
                  (ref) =>
                    ref.kind === "hypothesis" && ref.id === hypothesis.id,
                ),
              )
              .map((revision) => ({
                revision: revision.revision,
                commandType: revision.commandType,
                createdAt: revision.createdAt,
              })),
          };
        }
      } else result = { error: `Requête inconnue : ${name}.` };
    } catch (error) {
      result = {
        error: error instanceof Error ? error.message : "Requête impossible.",
      };
    }
    this.database
      .prepare(
        "INSERT INTO analysis_queries(id, workspace_id, request_id, name, args_json, served_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        randomUUID(),
        this.workspaceId,
        requestId,
        name,
        JSON.stringify(args),
        JSON.stringify(
          Object.fromEntries(
            Object.entries(served).map(([kind, ids]) => [kind, [...ids]]),
          ),
        ),
        nowIso(),
      );
    return result;
  }

  /** Requêtes journalisées d'une analyse (D-023). */
  analysisQueries(requestId: string) {
    return (
      this.database
        .prepare(
          "SELECT name, args_json, served_json, created_at FROM analysis_queries WHERE workspace_id = ? AND request_id = ? ORDER BY created_at, id",
        )
        .all(this.workspaceId, requestId) as SqlRow[]
    ).map((row) => ({
      name: String(row.name),
      args: JSON.parse(String(row.args_json)),
      served: JSON.parse(String(row.served_json)) as Record<string, string[]>,
      createdAt: String(row.created_at),
    }));
  }

  /** IA-A.4 : usage, modèle servi et durée d'inférence d'une réponse automatique. */
  recordProviderUsage(
    responseId: string,
    input: {
      servedModel: string | null;
      usage: unknown;
      inferenceDurationMs: number | null;
    },
  ) {
    this.database
      .prepare(
        "UPDATE analysis_responses SET verified_model = ?, provider_usage_json = ?, inference_duration_ms = ? WHERE workspace_id = ? AND id = ?",
      )
      .run(
        input.servedModel,
        input.usage === null || input.usage === undefined
          ? null
          : JSON.stringify(input.usage),
        input.inferenceDurationMs,
        this.workspaceId,
        responseId,
      );
  }

  /** IA-A.4 : jetons consommés par le fournisseur depuis une date (ISO). */
  providerTokensSince(sinceIso: string) {
    const row = this.database
      .prepare(
        "SELECT COALESCE(SUM(json_extract(provider_usage_json, '$.total_tokens')), 0) AS total FROM analysis_responses WHERE workspace_id = ? AND received_at >= ? AND provider_usage_json IS NOT NULL",
      )
      .get(this.workspaceId, sinceIso) as SqlRow;
    return Number(row.total);
  }

  cancelAnalysis(requestId: string) {
    const result = this.database
      .prepare(
        "UPDATE analysis_requests SET status = 'cancelled', cancelled_at = ? WHERE workspace_id = ? AND id = ? AND status IN ('awaiting_response', 'ready_for_review')",
      )
      .run(nowIso(), this.workspaceId, requestId);
    if (result.changes === 0)
      throw new DomainError(
        "analysis_not_cancellable",
        "Cette demande est absente ou déjà close.",
        409,
      );
    return { requestId, status: "cancelled" as const };
  }

  getAnalysis(requestId: string) {
    const request = this.database
      .prepare(
        "SELECT * FROM analysis_requests WHERE workspace_id = ? AND id = ?",
      )
      .get(this.workspaceId, requestId) as SqlRow | undefined;
    if (!request)
      throw new DomainError(
        "analysis_request_not_found",
        "Demande d’analyse inconnue.",
        404,
      );
    const responses = this.database
      .prepare(
        "SELECT * FROM analysis_responses WHERE request_id = ? ORDER BY received_at, id",
      )
      .all(requestId) as SqlRow[];
    return {
      requestId,
      status: String(request.status),
      promptVersion: String(request.prompt_version),
      promptHash:
        request.prompt_hash === null ? null : String(request.prompt_hash),
      packet: JSON.parse(String(request.context_json)) as ContextPacket,
      validatorVersion: COGNITION_VALIDATOR_VERSION,
      responses: responses.map((row) => this.mapAnalysisPreview(row, false)),
    };
  }

  /**
   * D-025 : écarte les opérations dont une citation est fausse, et celles qui
   * en dépendent (proposalKey), au lieu de rejeter toute la réponse ; au-delà
   * de 20 % d'opérations écartées, la réponse est rejetée en entier.
   */
  private withoutMiscited(proposal: CognitiveProposal, packet: ContextPacket) {
    const dropped: Array<{
      key: string;
      kind: string;
      code: string;
      message: string;
    }> = [];
    const bad = new Set<string>();
    let first: DomainError | null = null;
    for (const operation of proposal.operations)
      try {
        this.validateCitations([operation], packet);
      } catch (error) {
        if (!(error instanceof DomainError)) throw error;
        first ??= error;
        bad.add(operation.key);
        dropped.push({
          key: operation.key,
          kind: operation.kind,
          code: error.code,
          message: error.message,
        });
      }
    if (!bad.size) return { kept: proposal, dropped };
    // Dépendances transitives : une opération qui cite la clé d'une opération écartée.
    for (let changed = true; changed; ) {
      changed = false;
      for (const operation of proposal.operations) {
        if (bad.has(operation.key)) continue;
        const text = JSON.stringify(operation.payload);
        const on = [...bad].find((key) =>
          text.includes(`"proposalKey":"${key}"`),
        );
        if (on) {
          bad.add(operation.key);
          dropped.push({
            key: operation.key,
            kind: operation.kind,
            code: "dependent_dropped",
            message: `Dépend de l’opération écartée « ${on} ».`,
          });
          changed = true;
        }
      }
    }
    if (
      bad.size > proposal.operations.length * 0.2 ||
      bad.size === proposal.operations.length
    )
      throw first as DomainError;
    return {
      kept: {
        ...proposal,
        operations: proposal.operations.filter((item) => !bad.has(item.key)),
      },
      dropped,
    };
  }

  private workspaceSourceText(sourceId: string) {
    const row = this.database
      .prepare(
        "SELECT content, content_hash FROM sources WHERE workspace_id = ? AND id = ?",
      )
      .get(this.workspaceId, sourceId) as SqlRow | undefined;
    return row
      ? {
          sourceId,
          contentHash: String(row.content_hash),
          text: String(row.content),
        }
      : undefined;
  }

  private validateCitations(
    operations: CognitiveOperation[],
    packet: ContextPacket,
  ) {
    const sources = new Map(
      packet.sources.map((source) => [source.sourceId, source]),
    );
    for (const operation of operations) {
      if (!("citations" in operation.payload)) continue;
      const seen = new Set<string>();
      for (const citation of operation.payload.citations) {
        const key = `${citation.sourceId}:${citation.spanStart}:${citation.spanEnd}`;
        if (seen.has(key))
          throw new DomainError(
            "duplicate_citation",
            "Une citation est répétée dans la même opération.",
          );
        seen.add(key);
        // D-023, D-026 : une note de l'espace reste citable même si son texte
        // n'est pas dans le paquet (mémoire de travail, requête du modèle).
        const source =
          sources.get(citation.sourceId) ??
          this.workspaceSourceText(citation.sourceId);
        if (!source)
          throw new DomainError(
            "source_not_in_context",
            "Une citation vise une source absente du contexte.",
          );
        if (citation.contentHash !== source.contentHash)
          throw new DomainError(
            "source_hash_mismatch",
            "L’empreinte d’une source ne correspond pas.",
          );
        if (
          citation.spanEnd > source.text.length ||
          source.text.slice(citation.spanStart, citation.spanEnd) !==
            citation.quote
        )
          throw new DomainError(
            "citation_mismatch",
            // RAPPORT-011 : le message nomme l'opération et le texte exact de
            // la source, pour que la seconde tentative informée (D-021) puisse
            // corriger une citation mal recopiée.
            `La citation de l’opération « ${operation.key} » n’est pas une tranche exacte de la source : « ${citation.quote.slice(0, 120)} ». Texte exact de la source à ces positions : « ${source.text.slice(citation.spanStart, Math.min(citation.spanEnd, citation.spanStart + 120))} ». Recopie le texte de la source caractère pour caractère, ou cite la source entière.`,
          );
      }
    }
  }

  private mapAnalysisPreview(row: SqlRow, replayed: boolean): AnalysisPreview {
    const proposal = row.normalized_json
      ? (JSON.parse(String(row.normalized_json)) as CognitiveProposal)
      : null;
    return {
      requestId: String(row.request_id),
      responseId: String(row.id),
      status: String(row.status) as AnalysisPreview["status"],
      outcome: proposal?.outcome ?? null,
      summary: proposal?.summary ?? null,
      operations: proposal?.operations ?? [],
      errors: row.rejection_code
        ? [
            {
              code: String(row.rejection_code),
              message: String(row.rejection_message),
            },
          ]
        : [],
      droppedOperations: row.dropped_json
        ? JSON.parse(String(row.dropped_json))
        : [],
      applicationResult: row.application_result_json
        ? (JSON.parse(String(row.application_result_json)) as ApplicationResult)
        : null,
      telemetry: {
        manualWaitDurationMs:
          row.manual_wait_duration_ms == null
            ? null
            : Number(row.manual_wait_duration_ms),
        inferenceDurationMs:
          row.inference_duration_ms == null
            ? null
            : Number(row.inference_duration_ms),
        usage:
          row.provider_usage_json == null
            ? null
            : JSON.parse(String(row.provider_usage_json)),
        cost:
          row.provider_cost_json == null
            ? null
            : JSON.parse(String(row.provider_cost_json)),
      },
      replayed,
    };
  }

  private entityExists(ref: EntityRef) {
    const tableByKind: Record<EntityRef["kind"], string> = {
      source: "sources",
      event: "events",
      person: "persons",
      episode: "episodes",
      claim: "claims",
      hypothesis: "hypotheses",
      question: "open_questions",
      goal: "goals",
      annotation: "annotations",
      direction: "directions",
      action: "actions",
    };
    return Boolean(
      this.database
        .prepare(
          `SELECT id FROM ${tableByKind[ref.kind]} WHERE workspace_id = ? AND id = ?`,
        )
        .get(this.workspaceId, ref.id),
    );
  }

  private mapSource(row: SqlRow): Source {
    return {
      id: String(row.id),
      workspaceId: String(row.workspace_id),
      kind: String(row.kind) as Source["kind"],
      content: String(row.content),
      contentHash: String(row.content_hash),
      recordedAt: String(row.recorded_at),
      narratedAt: row.narrated_at === null ? null : String(row.narrated_at),
      sensitivity: String(row.sensitivity) as Source["sensitivity"],
      createdAt: String(row.created_at),
    };
  }

  private mapEvent(row: SqlRow): MemoryEvent {
    return {
      id: String(row.id),
      workspaceId: String(row.workspace_id),
      title: String(row.title),
      text: String(row.text),
      category: String(row.category) as MemoryEvent["category"],
      sourceId: String(row.source_id),
      episodeId: row.episode_id === null ? null : String(row.episode_id),
      occurredStart:
        row.occurred_start === null ? null : String(row.occurred_start),
      occurredEnd: row.occurred_end === null ? null : String(row.occurred_end),
      temporalPrecision: String(
        row.temporal_precision,
      ) as MemoryEvent["temporalPrecision"],
      context: row.context === null ? null : String(row.context),
      revision: Number(row.row_version),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
  }

  private mapAnnotation(row: SqlRow): HumanAnnotation {
    return {
      id: String(row.id),
      workspaceId: String(row.workspace_id),
      target: {
        kind: String(row.target_kind) as TargetKind,
        id: String(row.target_id),
      },
      text: String(row.text),
      annotationType: String(
        row.annotation_type,
      ) as HumanAnnotation["annotationType"],
      sourceId: row.source_id ? String(row.source_id) : null,
      revision: Number(row.revision),
      createdAt: String(row.created_at),
    };
  }
}
