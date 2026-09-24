import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import {
  DomainError,
  type AnnotationType,
  type EntityRef,
  type Hypothesis,
  type HypothesisSubject,
  type OpenQuestion,
  type TargetKind,
} from "../../domain/src/memory.ts";
import type {
  CognitiveOperation,
  ContextPacket,
  EvidenceInput,
  TargetRef,
} from "../../cognition/src/contract.ts";
import {
  checkStatus,
  confidenceAtMost,
  dependentHypotheses,
  depthAtLeast,
  disagreementAddressed,
  independentUnits,
  isDuplicateQuestion,
  maxConfidence,
  normalizeQuestion,
  type EvidenceFact,
  type EvidenceSummary,
} from "../../cognition/src/revision.ts";

type SqlRow = Record<string, unknown>;
type ReviewReason = NonNullable<Hypothesis["reviewReason"]>;

/** État partagé par les opérations d'une même proposition en cours d'application. */
export type OperationContext = {
  packet: ContextPacket;
  revision: number;
  timestamp: string;
  keys: Map<string, EntityRef>;
  deferred: Array<() => void>;
};

const plain = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase();

const nullableString = (value: unknown) =>
  value === null || value === undefined ? null : String(value);

/**
 * Accès SQL du moteur de révision (R3). Les règles elles-mêmes restent des
 * fonctions pures dans `cognition/src/revision.ts` (D-009).
 */
export class HypothesisStore {
  private readonly database: DatabaseSync;
  private readonly workspaceId: string;

  constructor(database: DatabaseSync, workspaceId: string) {
    this.database = database;
    this.workspaceId = workspaceId;
  }

  mapHypothesis(row: SqlRow): Hypothesis {
    const id = String(row.id);
    const subjects = (
      this.database
        .prepare(
          "SELECT subject_kind, person_id FROM hypothesis_subjects WHERE hypothesis_id = ? ORDER BY subject_kind, person_id",
        )
        .all(id) as SqlRow[]
    ).map(
      (subject): HypothesisSubject =>
        subject.subject_kind === "self"
          ? { kind: "self" }
          : { kind: "person", personId: String(subject.person_id) },
    );
    const evidence = (
      this.database
        .prepare(
          "SELECT * FROM hypothesis_evidence WHERE hypothesis_id = ? ORDER BY added_revision, claim_id",
        )
        .all(id) as SqlRow[]
    ).map((link) => ({
      claimId: String(link.claim_id),
      stance: String(link.stance) as "supports" | "contradicts",
      addedRevision: Number(link.added_revision),
      supersededRevision:
        link.superseded_revision == null
          ? null
          : Number(link.superseded_revision),
    }));
    const summary = this.summary(id);
    return {
      id,
      workspaceId: String(row.workspace_id),
      statement: String(row.statement),
      depth: String(row.depth) as Hypothesis["depth"],
      framework: nullableString(row.framework),
      construct: nullableString(row.construct),
      confidence: String(row.confidence) as Hypothesis["confidence"],
      status: String(row.status) as Hypothesis["status"],
      needsReview: Number(row.needs_review) === 1,
      reviewReason: nullableString(row.review_reason) as ReviewReason | null,
      reviewSinceRevision:
        row.review_since_revision == null
          ? null
          : Number(row.review_since_revision),
      limits: nullableString(row.limits),
      revisionConditions: nullableString(row.revision_conditions),
      validFrom: nullableString(row.valid_from),
      validTo: nullableString(row.valid_to),
      alternativeTo: nullableString(row.alternative_to),
      subjects,
      evidence,
      counts: {
        supportUnits: summary.supports.length,
        contradictUnits: summary.contradicts.length,
        anchoredSupports: summary.anchoredSupports,
        anchoredContradicts: summary.anchoredContradicts,
        supportSpanDays: Math.round(summary.supportSpanDays),
      },
      createdRevision: Number(row.created_revision),
      revision: Number(row.row_version),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
  }

  mapQuestion(row: SqlRow): OpenQuestion {
    return {
      id: String(row.id),
      workspaceId: String(row.workspace_id),
      question: String(row.question),
      status: String(row.status) as OpenQuestion["status"],
      targets: JSON.parse(String(row.targets_json)) as EntityRef[],
      discriminatingInfo: nullableString(row.discriminating_info),
      whyNow: nullableString(row.why_now),
      answerSourceId: nullableString(row.answer_source_id),
      revision: Number(row.row_version),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
  }

  /** Preuves actives, décrites pour les règles pures (unité, date, ancrage). */
  evidenceFacts(hypothesisId: string): EvidenceFact[] {
    const rows = this.database
      .prepare(
        `SELECT he.claim_id, he.stance, c.category, c.contested_revision, c.valid_from,
           (SELECT cs.source_id FROM claim_sources cs WHERE cs.claim_id = c.id ORDER BY cs.source_id LIMIT 1) AS source_id
         FROM hypothesis_evidence he JOIN claims c ON c.id = he.claim_id
         WHERE he.hypothesis_id = ? AND he.superseded_revision IS NULL`,
      )
      .all(hypothesisId) as SqlRow[];
    return rows.map((row) => {
      const source = this.database
        .prepare("SELECT content_hash FROM sources WHERE id = ?")
        .get(String(row.source_id)) as SqlRow | undefined;
      const event = this.database
        .prepare(
          "SELECT episode_id, occurred_start FROM events WHERE source_id = ? ORDER BY (episode_id IS NULL), occurred_start LIMIT 1",
        )
        .get(String(row.source_id)) as SqlRow | undefined;
      return {
        claimId: String(row.claim_id),
        stance: String(row.stance) as EvidenceFact["stance"],
        category: String(row.category),
        contested: row.contested_revision != null,
        unitKey: event?.episode_id
          ? `episode:${String(event.episode_id)}`
          : `hash:${String(source?.content_hash ?? row.claim_id)}`,
        occurredAt:
          nullableString(event?.occurred_start) ??
          nullableString(row.valid_from),
      };
    });
  }

  summary(hypothesisId: string): EvidenceSummary {
    return independentUnits(this.evidenceFacts(hypothesisId));
  }

  hasActiveAlternative(hypothesisId: string) {
    return Boolean(
      this.database
        .prepare(
          `SELECT h.id FROM hypotheses h, hypotheses me
           WHERE me.id = ? AND h.workspace_id = me.workspace_id AND h.id <> me.id
             AND h.status <> 'superseded'
             AND (h.alternative_to = me.id OR me.alternative_to = h.id)`,
        )
        .get(hypothesisId),
    );
  }

  private row(hypothesisId: string) {
    const row = this.database
      .prepare("SELECT * FROM hypotheses WHERE workspace_id = ? AND id = ?")
      .get(this.workspaceId, hypothesisId) as SqlRow | undefined;
    if (!row)
      throw new DomainError(
        "hypothesis_not_found",
        "Hypothèse introuvable dans cet espace.",
        404,
      );
    return row;
  }

  /** Claims touchés par une annotation sur un claim, un événement ou une source. */
  claimsForTarget(target: { kind: TargetKind; id: string }): string[] {
    const query =
      target.kind === "claim"
        ? "SELECT id AS claim_id FROM claims WHERE workspace_id = ? AND id = ?"
        : target.kind === "source"
          ? "SELECT DISTINCT cs.claim_id FROM claim_sources cs JOIN claims c ON c.id = cs.claim_id WHERE c.workspace_id = ? AND cs.source_id = ?"
          : target.kind === "event"
            ? "SELECT DISTINCT cs.claim_id FROM claim_sources cs JOIN claims c ON c.id = cs.claim_id JOIN events e ON e.source_id = cs.source_id WHERE c.workspace_id = ? AND e.id = ?"
            : null;
    if (!query) return [];
    return (
      this.database.prepare(query).all(this.workspaceId, target.id) as SqlRow[]
    ).map((row) => String(row.claim_id));
  }

  private dependentsOf(claimIds: string[]) {
    if (!claimIds.length) return [];
    const links = (
      this.database
        .prepare(
          `SELECT he.hypothesis_id, he.claim_id FROM hypothesis_evidence he
           JOIN hypotheses h ON h.id = he.hypothesis_id
           WHERE h.workspace_id = ? AND he.superseded_revision IS NULL`,
        )
        .all(this.workspaceId) as SqlRow[]
    ).map((row) => ({
      hypothesisId: String(row.hypothesis_id),
      claimId: String(row.claim_id),
    }));
    return dependentHypotheses(claimIds, links);
  }

  /**
   * Passe des hypothèses à « à réexaminer ». Une hypothèse plausible qui ne
   * remplit plus la règle redescend en brouillon, dans la même transaction.
   */
  markForReview(
    hypothesisIds: string[],
    reason: ReviewReason,
    revision: number,
    timestamp: string,
  ): EntityRef[] {
    const changed: EntityRef[] = [];
    for (const id of hypothesisIds) {
      const row = this.row(id);
      if (row.status === "superseded") continue;
      const summary = this.summary(id);
      const stillPlausible =
        row.status !== "plausible" ||
        checkStatus(
          "plausible",
          {
            depth: String(row.depth) as Hypothesis["depth"],
            hasActiveAlternative: this.hasActiveAlternative(id),
          },
          summary,
        ).allowed;
      const ceiling = maxConfidence(summary);
      const confidence = confidenceAtMost(
        String(row.confidence) as Hypothesis["confidence"],
        ceiling,
      )
        ? String(row.confidence)
        : ceiling;
      this.database
        .prepare(
          `UPDATE hypotheses SET needs_review = 1, review_reason = ?, review_since_revision = ?,
             status = ?, confidence = ?, row_version = row_version + 1, updated_at = ?
           WHERE id = ?`,
        )
        .run(
          reason,
          revision,
          stillPlausible ? String(row.status) : "draft",
          confidence,
          timestamp,
          id,
        );
      changed.push({ kind: "hypothesis", id });
    }
    return changed;
  }

  /** Effets déterministes d'une annotation humaine (D-008). */
  onAnnotation(
    target: { kind: TargetKind; id: string },
    type: AnnotationType,
    revision: number,
    timestamp: string,
  ): EntityRef[] {
    if (type === "agreement") return [];
    if (target.kind === "hypothesis")
      return this.markForReview(
        [target.id],
        type === "factual_correction" ? "correction" : (type as ReviewReason),
        revision,
        timestamp,
      );
    const claimIds = this.claimsForTarget(target);
    const changed: EntityRef[] = [];
    if (type === "factual_correction")
      for (const claimId of claimIds) {
        this.database
          .prepare(
            "UPDATE claims SET contested_revision = COALESCE(contested_revision, ?), updated_at = ? WHERE id = ?",
          )
          .run(revision, timestamp, claimId);
        changed.push({ kind: "claim", id: claimId });
      }
    const reason: ReviewReason =
      type === "factual_correction" ? "correction" : (type as ReviewReason);
    return [
      ...changed,
      ...this.markForReview(
        this.dependentsOf(claimIds),
        reason,
        revision,
        timestamp,
      ),
    ];
  }

  /** Hypothèses et questions à inclure dans un paquet, à partir de ses claims. */
  contextFor(claimIds: Set<string>, focusHypothesisIds: Set<string>) {
    const selected = new Set(focusHypothesisIds);
    for (const id of this.dependentsOf([...claimIds])) selected.add(id);
    for (const id of [...selected]) {
      const row = this.row(id);
      if (row.alternative_to) selected.add(String(row.alternative_to));
      for (const alt of this.database
        .prepare(
          "SELECT id FROM hypotheses WHERE workspace_id = ? AND alternative_to = ?",
        )
        .all(this.workspaceId, id) as SqlRow[])
        selected.add(String(alt.id));
    }
    const hypotheses = [...selected]
      .sort()
      .map((id) => this.mapHypothesis(this.row(id)));
    const evidenceClaimIds = new Set(
      hypotheses.flatMap((hypothesis) =>
        hypothesis.evidence.map((item) => item.claimId),
      ),
    );
    const questions = (
      this.database
        .prepare(
          "SELECT * FROM open_questions WHERE workspace_id = ? ORDER BY created_at, id",
        )
        .all(this.workspaceId) as SqlRow[]
    )
      .map((row) => this.mapQuestion(row))
      .filter((question) =>
        question.targets.some(
          (target) => target.kind === "hypothesis" && selected.has(target.id),
        ),
      );
    return { hypotheses, questions, evidenceClaimIds };
  }

  // ---- Application des opérations R3 ----------------------------------

  private resolve(
    ref: TargetRef,
    kind: "claim" | "hypothesis",
    context: OperationContext,
  ): string {
    if ("proposalKey" in ref) {
      const local = context.keys.get(ref.proposalKey);
      if (!local || local.kind !== kind)
        throw new DomainError(
          "unknown_proposal_key",
          `La clé ${ref.proposalKey} ne désigne pas un objet ${kind} de cette proposition.`,
        );
      return local.id;
    }
    if (ref.kind !== kind)
      throw new DomainError("invalid_reference", `Référence ${kind} attendue.`);
    const packetIds = new Set(
      (kind === "claim"
        ? context.packet.claims
        : context.packet.hypotheses
      ).map((item) => String((item as { id: string }).id)),
    );
    if (!packetIds.has(ref.id))
      throw new DomainError(
        "reference_not_in_context",
        `${kind}:${ref.id} n’appartient pas au paquet de contexte.`,
      );
    return ref.id;
  }

  private resolveSubject(
    subject: Extract<
      CognitiveOperation,
      { kind: "propose_hypothesis" }
    >["payload"]["subjects"][number],
    context: OperationContext,
  ): HypothesisSubject {
    if ("self" in subject) return { kind: "self" };
    if ("person" in subject) {
      const inPacket = context.packet.entities.some(
        (entity) =>
          (entity as { id?: string; displayName?: string }).id ===
            subject.person.id &&
          (entity as { displayName?: string }).displayName !== undefined,
      );
      if (!inPacket)
        throw new DomainError(
          "reference_not_in_context",
          `person:${subject.person.id} n’appartient pas au paquet de contexte.`,
        );
      return { kind: "person", personId: subject.person.id };
    }
    const mention = subject.mention;
    if (
      !context.packet.sources.some((source) =>
        plain(source.text).includes(plain(mention)),
      )
    )
      throw new DomainError(
        "subject_not_in_sources",
        `« ${mention} » n’apparaît dans aucune source du paquet.`,
      );
    const candidates = new Set<string>();
    for (const row of this.database
      .prepare("SELECT id, display_name FROM persons WHERE workspace_id = ?")
      .all(this.workspaceId) as SqlRow[])
      if (plain(String(row.display_name)) === plain(mention))
        candidates.add(String(row.id));
    for (const row of this.database
      .prepare(
        "SELECT person_id, alias FROM person_aliases WHERE workspace_id = ?",
      )
      .all(this.workspaceId) as SqlRow[])
      if (plain(String(row.alias)) === plain(mention))
        candidates.add(String(row.person_id));
    if (candidates.size > 1)
      throw new DomainError(
        "ambiguous_subject",
        `« ${mention} » correspond à plusieurs personnes ; une clarification est nécessaire.`,
      );
    if (candidates.size === 1)
      return { kind: "person", personId: [...candidates][0] };
    const personId = randomUUID();
    this.database
      .prepare(
        "INSERT INTO persons(id, workspace_id, display_name, resolution_status, row_version, created_at, updated_at) VALUES (?, ?, ?, 'candidate', 1, ?, ?)",
      )
      .run(
        personId,
        this.workspaceId,
        mention,
        context.timestamp,
        context.timestamp,
      );
    return { kind: "person", personId };
  }

  private addEvidence(
    hypothesisId: string,
    evidence: EvidenceInput[],
    context: OperationContext,
  ) {
    for (const item of evidence) {
      const claimId = this.resolve(item.claim, "claim", context);
      const existing = this.database
        .prepare(
          "SELECT stance FROM hypothesis_evidence WHERE hypothesis_id = ? AND claim_id = ?",
        )
        .get(hypothesisId, claimId) as SqlRow | undefined;
      if (existing) {
        if (existing.stance !== item.stance)
          throw new DomainError(
            "invalid_evidence",
            "Un même claim ne peut pas appuyer et contredire la même hypothèse.",
          );
        continue;
      }
      this.database
        .prepare(
          "INSERT INTO hypothesis_evidence(hypothesis_id, claim_id, stance, added_revision) VALUES (?, ?, ?, ?)",
        )
        .run(hypothesisId, claimId, item.stance, context.revision);
    }
  }

  private checkConfidence(hypothesisId: string, confidence: string) {
    const ceiling = maxConfidence(this.summary(hypothesisId));
    if (!confidenceAtMost(confidence as Hypothesis["confidence"], ceiling))
      throw new DomainError(
        "confidence_not_supported",
        `Les preuves ne permettent pas une confiance « ${confidence} » (plafond : ${ceiling}).`,
      );
  }

  applyOperation(
    operation: CognitiveOperation,
    context: OperationContext,
  ): { created: EntityRef[]; changed: EntityRef[] } {
    if (operation.kind === "propose_hypothesis") {
      const payload = operation.payload;
      if (payload.depth === "D4" && (!payload.framework || !payload.construct))
        throw new DomainError(
          "framework_required",
          "Une hypothèse D4 nomme son cadre et son construct.",
        );
      const id = randomUUID();
      const alternativeTo = payload.alternativeTo
        ? this.resolve(payload.alternativeTo, "hypothesis", context)
        : null;
      this.database
        .prepare(
          `INSERT INTO hypotheses(id, workspace_id, statement, depth, framework, construct, confidence, status,
             needs_review, limits, revision_conditions, valid_from, valid_to, alternative_to, created_revision,
             row_version, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', 0, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
        )
        .run(
          id,
          this.workspaceId,
          payload.statement,
          payload.depth,
          payload.framework,
          payload.construct,
          payload.confidence,
          payload.limits,
          payload.revisionConditions,
          payload.validFrom,
          payload.validTo,
          alternativeTo,
          context.revision,
          context.timestamp,
          context.timestamp,
        );
      const subjects = payload.subjects.map((subject) =>
        this.resolveSubject(subject, context),
      );
      const seen = new Set<string>();
      for (const subject of subjects) {
        const key =
          subject.kind === "self" ? "self" : `person:${subject.personId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        this.database
          .prepare(
            "INSERT INTO hypothesis_subjects(hypothesis_id, subject_kind, person_id) VALUES (?, ?, ?)",
          )
          .run(
            id,
            subject.kind,
            subject.kind === "person" ? subject.personId : null,
          );
      }
      this.addEvidence(id, payload.evidence, context);
      context.keys.set(operation.key, { kind: "hypothesis", id });
      context.deferred.push(() => {
        if (depthAtLeast(payload.depth, "D3") && !this.hasActiveAlternative(id))
          throw new DomainError(
            "alternative_required",
            `Une hypothèse ${payload.depth} exige une alternative incompatible.`,
          );
        this.checkConfidence(id, payload.confidence);
      });
      return { created: [{ kind: "hypothesis", id }], changed: [] };
    }

    if (operation.kind === "revise_hypothesis") {
      const payload = operation.payload;
      const id = this.resolve(payload.target, "hypothesis", context);
      const row = this.row(id);
      if (Number(row.row_version) !== payload.expectedRowVersion)
        throw new DomainError(
          "stale_object",
          "L’hypothèse a changé depuis la préparation du paquet.",
          409,
        );
      const reviewReason = nullableString(row.review_reason);
      this.addEvidence(id, payload.addEvidence, context);
      context.deferred.push(() => {
        const summary = this.summary(id);
        const hasActiveAlternative = this.hasActiveAlternative(id);
        const check = checkStatus(
          payload.status,
          {
            depth: String(row.depth) as Hypothesis["depth"],
            hasActiveAlternative,
          },
          summary,
        );
        if (!check.allowed)
          throw new DomainError(
            "status_not_allowed",
            check.reason ?? "Statut non permis par les preuves.",
          );
        this.checkConfidence(id, payload.confidence);
        if (
          reviewReason === "disagreement" &&
          !disagreementAddressed({
            hasActiveAlternative,
            addsContradiction: payload.addEvidence.some(
              (item) => item.stance === "contradicts",
            ),
            newStatus: payload.status,
          })
        )
          throw new DomainError(
            "disagreement_unaddressed",
            "Le désaccord de l’utilisateur exige une alternative, une contre-preuve ou l’abandon de l’hypothèse.",
          );
        this.database
          .prepare(
            `UPDATE hypotheses SET status = ?, confidence = ?, needs_review = 0, review_reason = NULL,
               review_since_revision = NULL, row_version = row_version + 1, updated_at = ?
             WHERE id = ?`,
          )
          .run(payload.status, payload.confidence, context.timestamp, id);
      });
      return { created: [], changed: [{ kind: "hypothesis", id }] };
    }

    if (operation.kind === "propose_question") {
      const payload = operation.payload;
      const targets = payload.targets.map((target) => ({
        kind: "hypothesis" as const,
        id: this.resolve(target, "hypothesis", context),
      }));
      const existing = (
        this.database
          .prepare(
            "SELECT normalized_text, targets_json FROM open_questions WHERE workspace_id = ?",
          )
          .all(this.workspaceId) as SqlRow[]
      ).map((row) => ({
        normalizedText: String(row.normalized_text),
        targets: (JSON.parse(String(row.targets_json)) as EntityRef[]).map(
          (target) => target.id,
        ),
      }));
      if (
        isDuplicateQuestion(
          { text: payload.question, targets: targets.map((t) => t.id) },
          existing,
        )
      )
        throw new DomainError(
          "duplicate_question",
          "Cette question a déjà été posée pour les mêmes hypothèses.",
        );
      const id = randomUUID();
      this.database
        .prepare(
          `INSERT INTO open_questions(id, workspace_id, question, status, targets_json, discriminating_info,
             why_now, normalized_text, row_version, created_at, updated_at)
           VALUES (?, ?, ?, 'open', ?, ?, ?, ?, 1, ?, ?)`,
        )
        .run(
          id,
          this.workspaceId,
          payload.question,
          JSON.stringify(targets),
          payload.discriminatingInfo,
          payload.whyNow,
          normalizeQuestion(payload.question),
          context.timestamp,
          context.timestamp,
        );
      context.keys.set(operation.key, { kind: "question", id });
      return { created: [{ kind: "question", id }], changed: [] };
    }
    throw new DomainError(
      "operation_not_allowed",
      "Opération non prise en charge par le moteur de révision.",
    );
  }

  // ---- Questions ------------------------------------------------------

  question(questionId: string) {
    const row = this.database
      .prepare("SELECT * FROM open_questions WHERE workspace_id = ? AND id = ?")
      .get(this.workspaceId, questionId) as SqlRow | undefined;
    if (!row)
      throw new DomainError("question_not_found", "Question introuvable.", 404);
    return this.mapQuestion(row);
  }

  closeQuestion(
    questionId: string,
    status: "answered" | "unknown" | "dismissed",
    answerSourceId: string | null,
    timestamp: string,
  ) {
    this.database
      .prepare(
        `UPDATE open_questions SET status = ?, answer_source_id = ?, row_version = row_version + 1, updated_at = ?
         WHERE workspace_id = ? AND id = ?`,
      )
      .run(status, answerSourceId, timestamp, this.workspaceId, questionId);
  }
}
