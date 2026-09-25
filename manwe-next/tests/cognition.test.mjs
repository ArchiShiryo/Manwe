import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  COGNITION_MAX_BYTES,
  cognitionHash,
} from "../packages/cognition/src/contract.ts";
import { parseCaptureCommand } from "../packages/domain/src/memory.ts";
import { SqliteMemoryStore } from "../packages/storage/src/sqliteStore.ts";

function withStore(run) {
  const directory = mkdtempSync(join(tmpdir(), "manwe-cognition-"));
  const path = join(directory, "memory.sqlite3");
  try {
    return run(new SqliteMemoryStore(path), path);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function capturedStore(store, suffix = "base") {
  store.capture(
    parseCaptureCommand({
      idempotencyKey: `cognition:capture:${suffix}`,
      text: "Léa dit que Marc l’a invitée.",
      recordedAt: "2026-09-14T18:00:00-03:00",
      narratedAt: "2026-09-14T18:00:00-03:00",
      occurredStart: "2026-09-13T12:00:00-03:00",
      temporalPrecision: "approximate",
      context: "Travail",
    }),
  );
  return store;
}

function proposal(packet, overrides = {}) {
  const source = packet.sources[0];
  return {
    schemaVersion: "1.4",
    requestId: packet.requestId,
    workspaceId: packet.workspaceId,
    baseRevision: packet.baseRevision,
    contextHash: packet.contextHash,
    modelDeclaration: {
      declaredModel: "Sol",
      role: "analyse assistée",
      technicalId: null,
    },
    outcome: "proposed",
    operations: [
      {
        key: "claim-reported-invitation",
        kind: "propose_claim",
        payload: {
          text: "Selon Léa, Marc l’a invitée.",
          category: "reported_observation",
          modality: "actual",
          validFrom: "2026-09-13T12:00:00-03:00",
          validTo: null,
          citations: [
            {
              sourceId: source.sourceId,
              contentHash: source.contentHash,
              spanStart: source.spanStart,
              spanEnd: source.spanEnd,
              quote: source.text,
            },
          ],
        },
        rationale: "Le récit attribue explicitement l’information à Léa.",
      },
    ],
    clarifications: [],
    summary:
      "Une déclaration rapportée est proposée, sans observation directe.",
    ...overrides,
  };
}

test("un ContextPacket est figé, sourcé et son empreinte exclut uniquement contextHash", () =>
  withStore((store) => {
    capturedStore(store);
    const event = store.snapshot().events[0];
    const packet = store.prepareAnalysis({
      task: "extract",
      focus: [{ kind: "event", id: event.id }],
    });
    const { contextHash, ...unsigned } = packet;
    assert.equal(contextHash, cognitionHash(unsigned));
    assert.equal(packet.mode, "assisted");
    assert.equal(packet.providerId, "sol-assisted");
    assert.equal(packet.baseRevision, 1);
    assert.equal(packet.sources[0].text, event.text);
    assert.equal(packet.sources[0].spanEnd, event.text.length);
    assert.equal(
      store.getAnalysis(packet.requestId).status,
      "awaiting_response",
    );
    store.close();
  }));

test("chaque demande enregistre l’empreinte du prompt analyst-v8 versionné", () =>
  withStore((store) => {
    capturedStore(store, "prompt-hash");
    const prompt = readFileSync(
      new URL("../packages/cognition/prompts/analyst-v8.md", import.meta.url),
      "utf8",
    );
    const expectedHash = createHash("sha256")
      .update(prompt, "utf8")
      .digest("hex");
    const requests = [
      store.prepareAnalysis({ task: "extract" }),
      store.prepareAnalysis({ task: "extract" }),
    ];
    for (const packet of requests) {
      const journal = store.getAnalysis(packet.requestId);
      assert.equal(packet.promptVersion, "analyst-v8");
      assert.equal(journal.promptVersion, "analyst-v8");
      assert.equal(journal.promptHash, expectedHash);
    }
    store.close();
  }));

test("le prompt analyst-v6 documente chaque champ exigé par le parseur strict", () => {
  const prompt = readFileSync(
    new URL("../packages/cognition/prompts/analyst-v8.md", import.meta.url),
    "utf8",
  );
  const required = [
    // CognitiveProposal
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
    // modelDeclaration
    "declaredModel",
    "role",
    "technicalId",
    // opération
    "key",
    "kind",
    "payload",
    "rationale",
    // propose_claim.payload
    "text",
    "category",
    "modality",
    "validFrom",
    "validTo",
    "citations",
    // propose_event.payload
    "title",
    "occurredStart",
    "occurredEnd",
    "temporalPrecision",
    "context",
    // citation
    "sourceId",
    "contentHash",
    "spanStart",
    "spanEnd",
    "quote",
    // clarification
    "question",
    "relatedRefs",
    // propose_hypothesis.payload
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
    "rank",
    "mechanism",
    "optimizes",
    "protects",
    "defenses",
    "beliefs",
    "triggers",
    "soothes",
    "barrier",
    "prediction",
    "relation",
    // propose_role.payload
    "event",
    "subject",
    "role",
    "outcome",
    "mention",
    "person",
    "self",
    "claim",
    "stance",
    "proposalKey",
    // revise_hypothesis.payload
    "target",
    "expectedRowVersion",
    "status",
    "addEvidence",
    // propose_question.payload
    "targets",
    "discriminatingInfo",
    "whyNow",
    // propose_critique.payload
    "findings",
    "detail",
  ];
  const missing = required.filter((field) => !prompt.includes(`"${field}"`));
  assert.deepEqual(missing, []);
});

test("une proposition sourcée s’applique une fois et survit au redémarrage", () =>
  withStore((store, path) => {
    capturedStore(store);
    const packet = store.prepareAnalysis({ task: "extract" });
    const response = proposal(packet);
    const preview = store.receiveAnalysis(response);
    assert.equal(preview.status, "ready_for_review");
    assert.equal(preview.operations.length, 1);
    assert.ok(preview.telemetry.manualWaitDurationMs >= 0);
    assert.equal(preview.telemetry.inferenceDurationMs, null);
    assert.equal(preview.telemetry.usage, null);
    assert.equal(preview.telemetry.cost, null);
    const result = store.applyAnalysis(preview.responseId);
    assert.equal(result.status, "applied");
    assert.equal(result.baseRevision, 1);
    assert.equal(result.resultRevision, 2);
    assert.equal(result.createdIds[0].kind, "claim");
    assert.equal(store.snapshot().claims[0].category, "reported_observation");
    assert.equal(store.snapshot().claims[0].modality, "actual");
    assert.equal(store.applyAnalysis(preview.responseId).replayed, true);
    assert.equal(
      store.receiveAnalysis(response).applicationResult.resultRevision,
      2,
    );
    store.close();

    const reopened = new SqliteMemoryStore(path);
    assert.equal(reopened.snapshot().workspace.revision, 2);
    assert.equal(reopened.snapshot().claims.length, 1);
    assert.equal(reopened.getAnalysis(packet.requestId).status, "applied");
    reopened.close();
  }));

test("un claim intended est persisté et relu après redémarrage", () =>
  withStore((store, path) => {
    capturedStore(store, "intended");
    const packet = store.prepareAnalysis({ task: "extract" });
    const intended = proposal(packet);
    intended.operations[0].payload.modality = "intended";
    const preview = store.receiveAnalysis(intended);
    store.applyAnalysis(preview.responseId);
    store.close();

    const reopened = new SqliteMemoryStore(path);
    assert.equal(reopened.snapshot().claims[0].modality, "intended");
    reopened.close();
  }));

test("le schéma 1.2 exige la modalité uniquement sur propose_claim", () =>
  withStore((store) => {
    capturedStore(store, "modality-validation");
    const packet = store.prepareAnalysis({ task: "extract" });

    const missing = proposal(packet);
    delete missing.operations[0].payload.modality;
    assert.throws(
      () => store.receiveAnalysis(missing),
      (error) => error.code === "invalid_modality",
    );

    const unknown = proposal(packet);
    unknown.operations[0].payload.modality = "possible";
    assert.throws(
      () => store.receiveAnalysis(unknown),
      (error) => error.code === "invalid_modality",
    );

    const source = packet.sources[0];
    const eventWithModality = proposal(packet, {
      operations: [
        {
          key: "event-with-modality",
          kind: "propose_event",
          payload: {
            title: "Invitation",
            text: source.text,
            category: "reported_observation",
            modality: "actual",
            occurredStart: null,
            occurredEnd: null,
            temporalPrecision: "unknown",
            context: null,
            citations: [
              {
                sourceId: source.sourceId,
                contentHash: source.contentHash,
                spanStart: source.spanStart,
                spanEnd: source.spanEnd,
                quote: source.text,
              },
            ],
          },
          rationale: "La modalité est volontairement interdite ici.",
        },
      ],
    });
    assert.throws(
      () => store.receiveAnalysis(eventWithModality),
      (error) => error.code === "unknown_field",
    );

    assert.throws(
      () =>
        store.receiveAnalysis({ ...proposal(packet), schemaVersion: "1.0" }),
      (error) => error.code === "unsupported_schema_version",
    );
    store.close();
  }));

test("une citation altérée est conservée comme rejet sans mutation", () =>
  withStore((store) => {
    capturedStore(store);
    const packet = store.prepareAnalysis({ task: "extract" });
    const invalid = proposal(packet);
    invalid.operations[0].payload.citations[0].quote = "Citation inventée";
    const preview = store.receiveAnalysis(invalid);
    assert.equal(preview.status, "rejected");
    assert.equal(preview.errors[0].code, "citation_mismatch");
    assert.equal(store.revision, 1);
    assert.equal(store.snapshot().claims.length, 0);
    const journal = store.getAnalysis(packet.requestId);
    assert.equal(journal.status, "awaiting_response");
    assert.equal(journal.responses[0].status, "rejected");
    store.close();
  }));

test("une correction après export rend la réponse obsolète", () =>
  withStore((store) => {
    capturedStore(store);
    const packet = store.prepareAnalysis({ task: "extract" });
    store.capture(
      parseCaptureCommand({
        idempotencyKey: "cognition:capture:newer",
        text: "Une information ajoutée après l’export.",
      }),
    );
    const preview = store.receiveAnalysis(proposal(packet));
    assert.equal(preview.status, "ready_for_review");
    assert.throws(
      () => store.applyAnalysis(preview.responseId),
      (error) => error.code === "stale_revision",
    );
    assert.equal(store.revision, 2);
    assert.equal(store.snapshot().claims.length, 0);
    assert.equal(store.getAnalysis(packet.requestId).status, "stale");
    store.close();
  }));

test("no_change clôt la demande sans révision et une demande annulée refuse une réponse", () =>
  withStore((store) => {
    capturedStore(store);
    const noChangePacket = store.prepareAnalysis({ task: "extract" });
    const noChange = proposal(noChangePacket, {
      outcome: "no_change",
      operations: [],
      summary: "Aucun changement suffisamment fondé.",
    });
    const preview = store.receiveAnalysis(noChange);
    const result = store.applyAnalysis(preview.responseId);
    assert.equal(result.status, "no_change");
    assert.equal(result.resultRevision, 1);
    assert.equal(store.revision, 1);

    const cancelledPacket = store.prepareAnalysis({ task: "extract" });
    assert.equal(
      store.cancelAnalysis(cancelledPacket.requestId).status,
      "cancelled",
    );
    assert.throws(
      () => store.receiveAnalysis(proposal(cancelledPacket)),
      (error) => error.code === "already_resolved",
    );
    assert.equal(store.revision, 1);
    store.close();
  }));

test("les opérations inconnues, doublons et besoins de contexte incohérents sont rejetés par le schéma", () =>
  withStore((store) => {
    capturedStore(store);
    const packet = store.prepareAnalysis({ task: "extract" });
    assert.throws(
      () =>
        store.receiveAnalysis(
          proposal(packet, {
            operations: [
              {
                key: "unsafe",
                kind: "execute_sql",
                payload: {},
                rationale: "Contourner le domaine.",
              },
            ],
          }),
        ),
      (error) => error.code === "operation_not_allowed",
    );
    const duplicate = proposal(packet);
    duplicate.operations.push(structuredClone(duplicate.operations[0]));
    assert.throws(
      () => store.receiveAnalysis(duplicate),
      (error) => error.code === "duplicate_operation_key",
    );
    assert.throws(
      () =>
        store.receiveAnalysis(
          proposal(packet, {
            outcome: "needs_context",
            operations: [],
            clarifications: [],
          }),
        ),
      (error) => error.code === "missing_clarification",
    );
    assert.equal(store.revision, 1);
    store.close();
  }));

test("une proposition trop grande ou arrivée après expiration est refusée sans mutation", () =>
  withStore((store) => {
    capturedStore(store);
    const packet = store.prepareAnalysis({ task: "extract" });
    assert.throws(
      () =>
        store.receiveAnalysis({
          ...proposal(packet),
          summary: "x".repeat(COGNITION_MAX_BYTES + 1),
        }),
      (error) => error.code === "proposal_too_large",
    );
    assert.equal(store.revision, 1);

    const expiresAt = new Date(Date.now() + 100).toISOString();
    const expiringPacket = store.prepareAnalysis({
      task: "extract",
      expiresAt,
    });
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 150);
    assert.throws(
      () => store.receiveAnalysis(proposal(expiringPacket)),
      (error) => error.code === "analysis_expired",
    );
    assert.equal(store.getAnalysis(expiringPacket.requestId).status, "expired");
    assert.equal(store.revision, 1);
    store.close();
  }));
