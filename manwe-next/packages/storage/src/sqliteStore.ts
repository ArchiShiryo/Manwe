import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import {
  MEMORY_SCHEMA_VERSION,
  DomainError,
  type AnnotationCommand,
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
const ANALYST_PROMPT_VERSION = "analyst-v2";
const ANALYST_PROMPT_HASH = sha256(
  readFileSync(
    fileURLToPath(
      new URL("../../cognition/prompts/analyst-v2.md", import.meta.url),
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
      this.database
        .prepare(
          "INSERT INTO annotations(id, workspace_id, target_kind, target_id, text, annotation_type, revision, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
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
        );
      const changed: EntityRef[] = [
        command.target,
        { kind: "annotation", id: annotationId },
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
        created: [{ kind: "annotation", id: annotationId }],
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
      goals: goals.map((row) => ({
        id: String(row.id),
        workspaceId: String(row.workspace_id),
        text: String(row.text),
        confirmedByUser: Boolean(row.confirmed_by_user),
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
      for (const subject of hypothesis.subjects)
        if (subject.kind === "person") selectedPersonIds.add(subject.personId);
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
      annotations: snapshot.annotations.filter((annotation) =>
        relevant.has(`${annotation.target.kind}:${annotation.target.id}`),
      ),
      questions: packetHypotheses.questions,
      goals: snapshot.goals.filter((goal) => focused.has(`goal:${goal.id}`)),
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
    const packet: ContextPacket = {
      ...packetWithoutHash,
      contextHash: cognitionHash(packetWithoutHash),
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
      this.validateCitations(proposal.operations, packet);
      this.dryRun(() => this.applyOperations(proposal, packet, receivedAt));
      const status =
        proposal.outcome === "needs_context"
          ? "needs_context"
          : "ready_for_review";
      this.database
        .prepare(
          "INSERT INTO analysis_responses(id, workspace_id, request_id, response_hash, raw_json, normalized_json, outcome, declared_model, verified_model, received_at, status, provider_usage_json, provider_cost_json, inference_duration_ms, manual_wait_duration_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, NULL, NULL, NULL, ?)",
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
          status,
          manualWaitDurationMs,
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
      const { created, changed } = this.applyOperations(
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
        warnings: [],
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
    if (proposal.outcome !== "proposed") return { created, changed };
    const context: OperationContext = {
      packet,
      revision: this.revision + 1,
      timestamp,
      keys: new Map(),
      deferred: [],
    };
    const order: CognitiveOperationKind[] = [
      "propose_event",
      "propose_claim",
      "propose_hypothesis",
      "revise_hypothesis",
      "propose_question",
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
        operation.kind === "propose_question"
      ) {
        const result = this.hypotheses.applyOperation(operation, context);
        created.push(...result.created);
        changed.push(...result.changed);
      }
    }
    for (const check of context.deferred) check();
    return { created, changed };
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
        const source = sources.get(citation.sourceId);
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
            "La citation n’est pas une tranche exacte de la source.",
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
      revision: Number(row.revision),
      createdAt: String(row.created_at),
    };
  }
}
