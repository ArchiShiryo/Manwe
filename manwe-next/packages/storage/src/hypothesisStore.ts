import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import {
  memberKey,
  relationIndicators,
  relationKey,
  type RoleFact,
} from "../../cognition/src/relations.ts";
import {
  DomainError,
  type AnnotationType,
  type ActionRecord,
  type DirectionRecord,
  type EpisodeRoleRecord,
  type RelationMember,
  type RelationRecord,
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
  MemberInput,
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
  isPromotion,
  maxConfidence,
  promotionAllowedAfterAgreement,
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
  /** Liens résolus après création de toutes les hypothèses (références en avant). */
  links: Array<() => void>;
  deferred: Array<() => void>;
  /** Ajustements du moteur signalés sans rejeter la réponse (D-015). */
  warnings: Array<{ code: string; message: string }>;
  /** Directions déjà reçues par objectif dans cette réponse (BRIEF-005). */
  directions?: Map<string, { actions: number; doNothing: boolean }>;
  /** Un seul objectif proposé par réponse (R5.4). */
  goalProposed?: boolean;
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
    for (const link of this.database
      .prepare(
        "SELECT relation_id FROM hypothesis_relations WHERE hypothesis_id = ? ORDER BY relation_id",
      )
      .all(id) as SqlRow[])
      subjects.push({
        kind: "relation",
        relationId: String(link.relation_id),
        members: this.relationMembers(String(link.relation_id)),
      });
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
    const critiques = (
      this.database
        .prepare(
          "SELECT * FROM hypothesis_critiques WHERE hypothesis_id = ? ORDER BY created_revision, id",
        )
        .all(id) as SqlRow[]
    ).map((critique) => ({
      id: String(critique.id),
      findings: JSON.parse(
        String(critique.findings_json),
      ) as Hypothesis["critiques"][number]["findings"],
      createdRevision: Number(critique.created_revision),
      resolvedRevision:
        critique.resolved_revision == null
          ? null
          : Number(critique.resolved_revision),
    }));
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
      rank:
        row.rank === null || row.rank === undefined ? null : Number(row.rank),
      mechanism: row.mechanism_json
        ? (JSON.parse(String(row.mechanism_json)) as Hypothesis["mechanism"])
        : null,
      subjects,
      evidence,
      critiques,
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
  /** Preuves actives ; `upToRevision` limite à celles ajoutées jusqu'à cette révision. */
  evidenceFacts(hypothesisId: string, upToRevision?: number): EvidenceFact[] {
    const rows = this.database
      .prepare(
        `SELECT he.claim_id, he.stance, c.category, c.contested_revision, c.valid_from,
           (SELECT cs.source_id FROM claim_sources cs WHERE cs.claim_id = c.id ORDER BY cs.source_id LIMIT 1) AS source_id
         FROM hypothesis_evidence he JOIN claims c ON c.id = he.claim_id
         WHERE he.hypothesis_id = ? AND he.superseded_revision IS NULL AND he.added_revision <= ?`,
      )
      .all(hypothesisId, upToRevision ?? Number.MAX_SAFE_INTEGER) as SqlRow[];
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

  summary(hypothesisId: string, upToRevision?: number): EvidenceSummary {
    return independentUnits(this.evidenceFacts(hypothesisId, upToRevision));
  }

  // ---- Relations et rôles (BRIEF-004) --------------------------------

  relationMembers(relationId: string): RelationMember[] {
    return (
      this.database
        .prepare(
          "SELECT member_kind, person_id FROM relation_members WHERE relation_id = ? ORDER BY member_kind, person_id",
        )
        .all(relationId) as SqlRow[]
    ).map((row) =>
      row.member_kind === "self"
        ? { kind: "self" }
        : { kind: "person", personId: String(row.person_id) },
    );
  }

  /** Relation d'une dyade, créée au besoin : une dyade n'existe qu'une fois. */
  ensureRelation(members: RelationMember[], timestamp: string): string {
    const keys = members.map(memberKey);
    if (
      new Set(keys).size !== keys.length ||
      keys.length < 2 ||
      keys.length > 8
    )
      throw new DomainError(
        "invalid_subject",
        "Une relation ou un groupe réunit de 2 à 8 membres distincts.",
      );
    const key = relationKey(keys);
    const existing = this.database
      .prepare(
        "SELECT id FROM relations WHERE workspace_id = ? AND member_key = ?",
      )
      .get(this.workspaceId, key) as SqlRow | undefined;
    if (existing) return String(existing.id);
    const id = randomUUID();
    this.database
      .prepare(
        "INSERT INTO relations(id, workspace_id, member_key, created_at) VALUES (?, ?, ?, ?)",
      )
      .run(id, this.workspaceId, key, timestamp);
    for (const member of members)
      this.database
        .prepare(
          "INSERT INTO relation_members(relation_id, member_kind, person_id) VALUES (?, ?, ?)",
        )
        .run(
          id,
          member.kind,
          member.kind === "person" ? member.personId : null,
        );
    return id;
  }

  roles(): EpisodeRoleRecord[] {
    return (
      this.database
        .prepare(
          "SELECT * FROM event_roles WHERE workspace_id = ? ORDER BY created_at, id",
        )
        .all(this.workspaceId) as SqlRow[]
    ).map((row) => ({
      id: String(row.id),
      eventId: String(row.event_id),
      subject:
        row.subject_kind === "self"
          ? { kind: "self" }
          : { kind: "person", personId: String(row.person_id) },
      role: String(row.role) as EpisodeRoleRecord["role"],
      outcome: (row.outcome ?? null) as EpisodeRoleRecord["outcome"],
      citations: JSON.parse(String(row.citations_json)),
      createdRevision: Number(row.created_revision),
    }));
  }

  // ---- Directions et actions (BRIEF-005) --------------------------------

  directions(): DirectionRecord[] {
    return (
      this.database
        .prepare(
          "SELECT * FROM directions WHERE workspace_id = ? ORDER BY created_at, id",
        )
        .all(this.workspaceId) as SqlRow[]
    ).map((row) => ({
      id: String(row.id),
      goalId: nullableString(row.goal_id),
      title: String(row.title),
      action: String(row.action_text),
      lever: {
        kind: String(row.lever_kind) as DirectionRecord["lever"]["kind"],
        hypothesisId: nullableString(row.lever_hypothesis_id),
        mechanismKey: nullableString(row.mechanism_key),
      },
      conditions: String(row.conditions),
      effort: String(row.effort) as DirectionRecord["effort"],
      limits: String(row.limits),
      signals: JSON.parse(String(row.signals_json)),
      learnsIfFails: String(row.learns_if_fails),
      predictions: JSON.parse(String(row.predictions_json)),
      status: String(row.status) as DirectionRecord["status"],
      createdRevision: Number(row.created_revision),
      createdAt: String(row.created_at),
    }));
  }

  actions(): ActionRecord[] {
    return (
      this.database
        .prepare(
          `SELECT a.*, n.source_id AS outcome_source_id FROM actions a
             LEFT JOIN annotations n ON n.id = a.outcome_annotation_id
           WHERE a.workspace_id = ? ORDER BY a.created_at, a.id`,
        )
        .all(this.workspaceId) as SqlRow[]
    ).map((row) => ({
      id: String(row.id),
      directionId: String(row.direction_id),
      status: String(row.status) as ActionRecord["status"],
      expectation: JSON.parse(String(row.expectation_json)),
      expectationRecordedAt: String(row.expectation_recorded_at),
      chosenRevision: Number(row.chosen_revision),
      outcome:
        row.outcome_text === null || row.outcome_text === undefined
          ? null
          : {
              text: String(row.outcome_text),
              annotationId: String(row.outcome_annotation_id),
              sourceId: nullableString(row.outcome_source_id),
              recordedAt: String(row.outcome_recorded_at),
            },
      verdicts:
        row.verdicts_json === null || row.verdicts_json === undefined
          ? null
          : JSON.parse(String(row.verdicts_json)),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    }));
  }

  private roleFacts(): RoleFact[] {
    return (
      this.database
        .prepare(
          "SELECT r.*, e.occurred_start FROM event_roles r JOIN events e ON e.id = r.event_id WHERE r.workspace_id = ?",
        )
        .all(this.workspaceId) as SqlRow[]
    ).map((row) => ({
      eventId: String(row.event_id),
      member:
        row.subject_kind === "self"
          ? "self"
          : `person:${String(row.person_id)}`,
      role: String(row.role) as RoleFact["role"],
      outcome: (row.outcome ?? null) as RoleFact["outcome"],
      occurredAt: nullableString(row.occurred_start),
    }));
  }

  /**
   * Relations connues et dyades implicites « utilisateur + personne » ou
   * « personne + personne » qui partagent au moins un épisode avec rôles,
   * avec leurs indicateurs calculés.
   */
  relations(): RelationRecord[] {
    const facts = this.roleFacts();
    const byEvent = new Map<string, Set<string>>();
    for (const fact of facts) {
      const set = byEvent.get(fact.eventId) ?? new Set<string>();
      set.add(fact.member);
      byEvent.set(fact.eventId, set);
    }
    const keys = new Set<string>();
    for (const row of this.database
      .prepare("SELECT member_key FROM relations WHERE workspace_id = ?")
      .all(this.workspaceId) as SqlRow[])
      keys.add(String(row.member_key));
    for (const members of byEvent.values()) {
      const list = [...members].sort();
      for (let i = 0; i < list.length; i += 1)
        for (let j = i + 1; j < list.length; j += 1)
          keys.add(relationKey([list[i], list[j]]));
    }
    const records: RelationRecord[] = [];
    for (const key of [...keys].sort()) {
      const members = key.split("|");
      const stored = this.database
        .prepare(
          "SELECT id FROM relations WHERE workspace_id = ? AND member_key = ?",
        )
        .get(this.workspaceId, key) as SqlRow | undefined;
      records.push({
        id: stored ? String(stored.id) : `implicit:${key}`,
        members: members.map((member) =>
          member === "self"
            ? { kind: "self" }
            : { kind: "person", personId: member.slice("person:".length) },
        ),
        indicators: relationIndicators(members, facts),
      });
    }
    return records;
  }

  /** Révision du dernier accord de l'utilisateur sur cette hypothèse, ou null. */
  private lastAgreementRevision(hypothesisId: string) {
    const row = this.database
      .prepare(
        "SELECT MAX(revision) AS revision FROM annotations WHERE workspace_id = ? AND target_kind = 'hypothesis' AND target_id = ? AND annotation_type = 'agreement'",
      )
      .get(this.workspaceId, hypothesisId) as SqlRow;
    return row.revision === null || row.revision === undefined
      ? null
      : Number(row.revision);
  }

  /** État de la passe critique pour les règles (R3.4). */
  critiqueFacts(hypothesisId: string) {
    const row = this.database
      .prepare(
        "SELECT COUNT(*) AS total, SUM(CASE WHEN resolved_revision IS NULL THEN 1 ELSE 0 END) AS open FROM hypothesis_critiques WHERE hypothesis_id = ?",
      )
      .get(hypothesisId) as SqlRow;
    return {
      critiqued: Number(row.total) > 0,
      openCritiques: Number(row.open ?? 0),
    };
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
            ...this.critiqueFacts(id),
          },
          summary,
        ).allowed;
      const ceiling = maxConfidence(
        summary,
        String(row.depth) as Hypothesis["depth"],
      );
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

  private resolveEvent(ref: TargetRef, context: OperationContext): string {
    if ("proposalKey" in ref) {
      const local = context.keys.get(ref.proposalKey);
      if (!local || local.kind !== "event")
        throw new DomainError(
          "unknown_proposal_key",
          `La clé ${ref.proposalKey} ne désigne pas un événement de cette proposition.`,
        );
      return local.id;
    }
    if (ref.kind !== "event")
      throw new DomainError("invalid_reference", "Référence event attendue.");
    const inPacket = context.packet.entities.some(
      (entity) =>
        (entity as { id?: string; title?: string }).id === ref.id &&
        (entity as { title?: string }).title !== undefined,
    );
    if (!inPacket)
      throw new DomainError(
        "reference_not_in_context",
        `event:${ref.id} n’appartient pas au paquet de contexte.`,
      );
    return ref.id;
  }

  private resolveSubject(
    subject: MemberInput,
    context: OperationContext,
  ): RelationMember {
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

  /**
   * Ramène la confiance au plafond permis par les preuves et la profondeur,
   * avec un avertissement, au lieu de rejeter toute la réponse (D-015).
   */
  private capConfidence(
    hypothesisId: string,
    depth: Hypothesis["depth"],
    confidence: Hypothesis["confidence"],
    context: OperationContext,
  ): Hypothesis["confidence"] {
    const ceiling = maxConfidence(this.summary(hypothesisId), depth);
    if (confidenceAtMost(confidence, ceiling)) return confidence;
    context.warnings.push({
      code: "confidence_capped",
      message: `hypothesis:${hypothesisId} : confiance « ${confidence} » ramenée à « ${ceiling} » (preuves et profondeur ${depth}).`,
    });
    return ceiling;
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
      // Une alternative peut viser une hypothèse proposée plus loin dans la même
      // réponse : sa résolution est alors différée après toutes les créations.
      const forward =
        payload.alternativeTo !== null &&
        "proposalKey" in payload.alternativeTo &&
        !context.keys.has(payload.alternativeTo.proposalKey);
      const alternativeTo =
        payload.alternativeTo && !forward
          ? this.resolve(payload.alternativeTo, "hypothesis", context)
          : null;
      this.database
        .prepare(
          `INSERT INTO hypotheses(id, workspace_id, statement, depth, framework, construct, confidence, status,
             needs_review, limits, revision_conditions, valid_from, valid_to, alternative_to, created_revision,
             row_version, created_at, updated_at, rank, mechanism_json)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', 0, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
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
          payload.rank,
          payload.mechanism ? JSON.stringify(payload.mechanism) : null,
        );
      const subjects: RelationMember[] = [];
      for (const subject of payload.subjects) {
        if ("relation" in subject) {
          const members = subject.relation.map((member) =>
            this.resolveSubject(member, context),
          );
          const relationId = this.ensureRelation(members, context.timestamp);
          this.database
            .prepare(
              "INSERT OR IGNORE INTO hypothesis_relations(hypothesis_id, relation_id) VALUES (?, ?)",
            )
            .run(id, relationId);
        } else subjects.push(this.resolveSubject(subject, context));
      }
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
      if (forward && payload.alternativeTo)
        context.links.push(() => {
          const target = this.resolve(
            payload.alternativeTo as TargetRef,
            "hypothesis",
            context,
          );
          this.database
            .prepare("UPDATE hypotheses SET alternative_to = ? WHERE id = ?")
            .run(target, id);
        });
      context.deferred.push(() => {
        if (depthAtLeast(payload.depth, "D3") && !this.hasActiveAlternative(id))
          throw new DomainError(
            "alternative_required",
            `Une hypothèse ${payload.depth} exige une alternative incompatible.`,
          );
        const confidence = this.capConfidence(
          id,
          payload.depth,
          payload.confidence,
          context,
        );
        // « plausible » dès la création si les règles l'autorisent : en
        // pratique D1 et D2, puisque D3 et plus exigent une passe critique
        // distincte (D-015).
        let status: Hypothesis["status"] = "draft";
        if (payload.status === "plausible") {
          const check = checkStatus(
            "plausible",
            {
              depth: payload.depth,
              hasActiveAlternative: this.hasActiveAlternative(id),
              ...this.critiqueFacts(id),
            },
            this.summary(id),
          );
          if (check.allowed) status = "plausible";
          else
            context.warnings.push({
              code: "status_downgraded",
              message: `hypothesis:${id} reste « draft » : ${check.reason ?? "statut non permis"}`,
            });
        }
        this.database
          .prepare(
            "UPDATE hypotheses SET status = ?, confidence = ? WHERE id = ?",
          )
          .run(status, confidence, id);
      });
      return { created: [{ kind: "hypothesis", id }], changed: [] };
    }

    if (operation.kind === "propose_role") {
      const payload = operation.payload;
      const eventId = this.resolveEvent(payload.event, context);
      const member = this.resolveSubject(payload.subject, context);
      const id = randomUUID();
      this.database
        .prepare(
          "INSERT INTO event_roles(id, workspace_id, event_id, subject_kind, person_id, role, outcome, citations_json, created_revision, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .run(
          id,
          this.workspaceId,
          eventId,
          member.kind,
          member.kind === "person" ? member.personId : null,
          payload.role,
          payload.outcome,
          JSON.stringify(payload.citations),
          context.revision,
          context.timestamp,
        );
      // Le rôle rattache aussi la personne à l'épisode, pour les paquets suivants.
      if (member.kind === "person")
        this.database
          .prepare(
            "INSERT OR IGNORE INTO event_participants(event_id, person_id, role) VALUES (?, ?, NULL)",
          )
          .run(eventId, member.personId);
      context.keys.set(operation.key, { kind: "event", id: eventId });
      return { created: [], changed: [{ kind: "event", id: eventId }] };
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
        // Cette révision traite les passes critiques ouvertes.
        this.database
          .prepare(
            "UPDATE hypothesis_critiques SET resolved_revision = ? WHERE hypothesis_id = ? AND resolved_revision IS NULL",
          )
          .run(context.revision, id);
        const summary = this.summary(id);
        const hasActiveAlternative = this.hasActiveAlternative(id);
        const depth = String(row.depth) as Hypothesis["depth"];
        const facts = {
          depth,
          hasActiveAlternative,
          ...this.critiqueFacts(id),
        };
        const previous = {
          status: String(row.status) as Hypothesis["status"],
          confidence: String(row.confidence) as Hypothesis["confidence"],
        };
        // Statut non permis : on garde l'ancien s'il reste permis, sinon draft,
        // avec un avertissement plutôt qu'un rejet de toute la réponse (D-015).
        let status = payload.status;
        const check = checkStatus(status, facts, summary);
        if (!check.allowed) {
          status = checkStatus(previous.status, facts, summary).allowed
            ? previous.status
            : "draft";
          context.warnings.push({
            code: "status_not_allowed",
            message:
              `hypothesis:${id} : « ${payload.status} » refusé, statut « ${status} » conservé. ${check.reason ?? ""}`.trim(),
          });
        }
        let confidence = this.capConfidence(
          id,
          depth,
          payload.confidence,
          context,
        );
        const agreementRevision = this.lastAgreementRevision(id);
        if (
          agreementRevision !== null &&
          isPromotion(previous, { status, confidence }) &&
          !promotionAllowedAfterAgreement(
            this.summary(id, agreementRevision),
            summary,
          )
        ) {
          context.warnings.push({
            code: "promotion_after_agreement",
            message: `hypothesis:${id} : aucune promotion sans nouvel épisode depuis l'accord de l'utilisateur ; statut et confiance conservés.`,
          });
          if (status === "plausible" && previous.status !== "plausible")
            status = previous.status;
          if (!confidenceAtMost(confidence, previous.confidence))
            confidence = previous.confidence;
        }
        if (
          reviewReason === "disagreement" &&
          !disagreementAddressed({
            hasActiveAlternative,
            addsContradiction: payload.addEvidence.some(
              (item) => item.stance === "contradicts",
            ),
            newStatus: status,
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
          .run(status, confidence, context.timestamp, id);
        if (payload.rank !== undefined)
          this.database
            .prepare("UPDATE hypotheses SET rank = ? WHERE id = ?")
            .run(payload.rank, id);
      });
      return { created: [], changed: [{ kind: "hypothesis", id }] };
    }

    if (operation.kind === "propose_critique") {
      const payload = operation.payload;
      const id = this.resolve(payload.target, "hypothesis", context);
      const row = this.row(id);
      // Une autocritique dans la réponse qui crée l'hypothèse n'est pas une passe distincte.
      if (Number(row.created_revision) === context.revision)
        throw new DomainError(
          "critique_same_proposal",
          "La passe critique doit viser une hypothèse issue d’une réponse antérieure.",
        );
      const findings = payload.findings.map((finding) => ({
        kind: finding.kind,
        detail: finding.detail,
        claimIds: finding.claims.map((claim) =>
          this.resolve(claim, "claim", context),
        ),
      }));
      const critiqueId = randomUUID();
      this.database
        .prepare(
          "INSERT INTO hypothesis_critiques(id, workspace_id, hypothesis_id, findings_json, created_revision, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .run(
          critiqueId,
          this.workspaceId,
          id,
          JSON.stringify(findings),
          context.revision,
          context.timestamp,
        );
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
    if (operation.kind === "propose_goal") {
      // R5.4 : une proposition ne remplace jamais un objectif confirmé ; elle
      // remplace une proposition précédente encore en attente.
      if (context.goalProposed) {
        context.warnings.push({
          code: "too_many_goals",
          message:
            "Un seul objectif proposé par réponse ; le suivant est écarté.",
        });
        return { created: [], changed: [] };
      }
      context.goalProposed = true;
      const pending = this.database
        .prepare(
          "SELECT id FROM goals WHERE workspace_id = ? AND origin = 'analysis' AND confirmed_by_user = 0 AND dismissed_at IS NULL",
        )
        .all(this.workspaceId) as SqlRow[];
      for (const row of pending)
        this.database
          .prepare(
            "UPDATE goals SET dismissed_at = ?, row_version = row_version + 1, updated_at = ? WHERE id = ?",
          )
          .run(context.timestamp, context.timestamp, String(row.id));
      const id = randomUUID();
      this.database
        .prepare(
          `INSERT INTO goals(id, workspace_id, text, confirmed_by_user, row_version, created_at, updated_at,
             problem, origin, citations_json) VALUES (?, ?, ?, 0, 1, ?, ?, ?, 'analysis', ?)`,
        )
        .run(
          id,
          this.workspaceId,
          operation.payload.goal,
          context.timestamp,
          context.timestamp,
          operation.payload.problem,
          JSON.stringify(
            operation.payload.citations.map((citation) => ({
              sourceId: citation.sourceId,
              quote: citation.quote,
            })),
          ),
        );
      return { created: [{ kind: "goal", id }], changed: [] };
    }

    if (operation.kind === "propose_direction") {
      const payload = operation.payload;
      // Objectif existant dans l'espace.
      if (payload.goal) {
        const goal = this.database
          .prepare("SELECT id FROM goals WHERE workspace_id = ? AND id = ?")
          .get(this.workspaceId, payload.goal.id);
        if (!goal)
          throw new DomainError(
            "reference_not_in_context",
            `goal:${payload.goal.id} n’existe pas.`,
          );
      }
      // La lecture actionnée existe et n'est ni remplacée ni contredite (H4).
      let hypothesisId: string | null = null;
      if (payload.lever.hypothesis) {
        hypothesisId = this.resolve(
          payload.lever.hypothesis,
          "hypothesis",
          context,
        );
        const row = this.database
          .prepare("SELECT status FROM hypotheses WHERE id = ?")
          .get(hypothesisId) as SqlRow | undefined;
        if (
          row &&
          (row.status === "superseded" || row.status === "contradicted")
        )
          throw new DomainError(
            "lever_not_active",
            `La direction s’appuie sur hypothesis:${hypothesisId}, ${String(row.status)}.`,
          );
      }
      const goalKey = payload.goal?.id ?? "none";
      context.directions ??= new Map();
      const counts = context.directions.get(goalKey) ?? {
        actions: 0,
        doNothing: false,
      };
      if (!context.directions.has(goalKey)) {
        context.directions.set(goalKey, counts);
        // Nouvelle série pour cet objectif : les directions non choisies
        // des séries précédentes sont remplacées.
        this.database
          .prepare(
            `UPDATE directions SET status = 'superseded' WHERE workspace_id = ? AND status = 'proposed'
               AND ${payload.goal ? "goal_id = ?" : "goal_id IS NULL"}`,
          )
          .run(
            ...(payload.goal
              ? [this.workspaceId, payload.goal.id]
              : [this.workspaceId]),
          );
        context.deferred.push(() => {
          if (!counts.doNothing)
            context.warnings.push({
              code: "do_nothing_missing",
              message: `Aucune direction « ne rien entreprendre » pour ${goalKey === "none" ? "cette série" : `goal:${goalKey}`} ; l’interface l’affiche sans prédiction.`,
            });
        });
      }
      if (payload.lever.kind === "do_nothing") {
        if (counts.doNothing) {
          context.warnings.push({
            code: "too_many_directions",
            message:
              "Une seule direction « ne rien entreprendre » par objectif ; la suivante est écartée.",
          });
          return { created: [], changed: [] };
        }
        counts.doNothing = true;
      } else {
        // D-024 : aucun plafond sur les directions d'action (capacité maximale).
        counts.actions += 1;
      }
      const predictions = payload.predictions.map((prediction) => ({
        actor: this.resolveSubject(prediction.actor, context),
        response: prediction.response,
        phase: prediction.phase,
        horizonDays: prediction.horizonDays,
      }));
      const id = randomUUID();
      this.database
        .prepare(
          `INSERT INTO directions(id, workspace_id, goal_id, title, action_text, lever_kind, lever_hypothesis_id,
             mechanism_key, conditions, effort, limits, signals_json, learns_if_fails, predictions_json,
             status, response_id, created_revision, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'proposed', NULL, ?, ?)`,
        )
        .run(
          id,
          this.workspaceId,
          payload.goal?.id ?? null,
          payload.title,
          payload.action,
          payload.lever.kind,
          hypothesisId,
          payload.lever.mechanismKey,
          payload.conditions,
          payload.effort,
          payload.limits,
          JSON.stringify(payload.signals),
          payload.learnsIfFails,
          JSON.stringify(predictions),
          context.revision,
          context.timestamp,
        );
      return { created: [{ kind: "direction", id }], changed: [] };
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
