import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  parseCaptureCommand,
  parseChooseDirectionCommand,
  parseGoalCommand,
  parseRecordOutcomeCommand,
} from "../packages/domain/src/memory.ts";
import { SqliteMemoryStore } from "../packages/storage/src/sqliteStore.ts";

// BRIEF-005 : directions reliées aux leviers et boucle d'action. Les
// « réponses du modèle » sont écrites à la main : on teste les règles.

function withStore(run) {
  const directory = mkdtempSync(join(tmpdir(), "manwe-r5-"));
  const store = new SqliteMemoryStore(join(directory, "memory.sqlite3"), "r5");
  try {
    return run(store);
  } finally {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
}

const proposal = (packet, operations, version = "1.5") => ({
  schemaVersion: version,
  requestId: packet.requestId,
  workspaceId: packet.workspaceId,
  baseRevision: packet.baseRevision,
  contextHash: packet.contextHash,
  modelDeclaration: {
    declaredModel: "Test",
    role: "analyst",
    technicalId: null,
  },
  outcome: "proposed",
  operations,
  clarifications: [],
  summary: "Réponse de test.",
});

function respond(store, packet, operations, version) {
  const preview = store.receiveAnalysis(proposal(packet, operations, version));
  if (preview.status !== "ready_for_review") return { preview, result: null };
  return { preview, result: store.applyAnalysis(preview.responseId) };
}

const citation = (source) => ({
  sourceId: source.sourceId,
  contentHash: source.contentHash,
  spanStart: 0,
  spanEnd: source.text.length,
  quote: source.text,
});

/** Une note, un claim, une lecture D1 sur Lucas et un objectif. */
function setup(store) {
  store.capture(
    parseCaptureCommand({
      idempotencyKey: "r5:capture:1",
      text: "Lucas m'a encore demandé de relire son CV ce soir ; j'ai dit oui alors que j'étais crevé.",
      occurredStart: "2026-03-01T20:00:00+01:00",
      temporalPrecision: "day",
    }),
  );
  const packet = store.prepareAnalysis({ task: "interpret" });
  const { result } = respond(store, packet, [
    {
      key: "c1",
      kind: "propose_claim",
      payload: {
        text: "Lucas a demandé une relecture et l'utilisateur a accepté malgré la fatigue.",
        category: "reported_observation",
        modality: "actual",
        validFrom: null,
        validTo: null,
        citations: [citation(packet.sources[0])],
      },
      rationale: "Fait rapporté.",
    },
    {
      key: "h1",
      kind: "propose_hypothesis",
      payload: {
        statement: "Les demandes de Lucas sont renforcées par un oui immédiat.",
        depth: "D2",
        framework: null,
        construct: null,
        confidence: "low",
        subjects: [{ relation: [{ mention: "Lucas" }, { self: true }] }],
        evidence: [{ claim: { proposalKey: "c1" }, stance: "supports" }],
        limits: "Un seul épisode.",
        revisionConditions: "Un refus sans relance.",
        alternativeTo: null,
        validFrom: null,
        validTo: null,
      },
      rationale: "Lecture de test.",
    },
  ]);
  const hypothesisId = result.createdIds.find(
    (ref) => ref.kind === "hypothesis",
  ).id;
  const goalId = store.updateGoal(
    parseGoalCommand({
      idempotencyKey: "r5:goal:1",
      text: "Aider Lucas sans être débordé",
    }),
  ).created[0].id;
  return { hypothesisId, goalId };
}

function direction(
  key,
  goalId,
  hypothesisId,
  kind = "change_reward",
  title = key,
) {
  return {
    key,
    kind: "propose_direction",
    payload: {
      goal: { kind: "goal", id: goalId },
      title,
      action: "Proposer un créneau fixe le samedi matin.",
      lever: {
        kind,
        hypothesis:
          kind === "do_nothing"
            ? null
            : { kind: "hypothesis", id: hypothesisId },
        mechanismKey: null,
      },
      conditions: "Si Lucas accepte un cadre.",
      effort: "low",
      limits: "Un seul essai.",
      signals: ["Nombre de demandes tardives"],
      learnsIfFails:
        "Si Lucas refuse tout cadre, la lecture de renforcement perd du poids.",
      predictions: [
        {
          actor: { mention: "Lucas" },
          response: "Il insiste davantage les premiers jours.",
          phase: "transitional",
          horizonDays: 14,
        },
      ],
    },
    rationale: "Direction de test.",
  };
}

const explorePacket = (store, goalId, hypothesisId) =>
  store.prepareAnalysis({
    task: "explore",
    focus: [
      { kind: "goal", id: goalId },
      { kind: "hypothesis", id: hypothesisId },
    ],
  });

test("BRIEF-005 · directions : levier requis, deux au plus, « ne rien entreprendre » attendu", () =>
  withStore((store) => {
    const { hypothesisId, goalId } = setup(store);
    const packet = explorePacket(store, goalId, hypothesisId);
    assert.equal(packet.schemaVersion, "1.5");
    assert.ok(packet.allowedOperations.includes("propose_direction"));
    assert.equal(packet.goals.length, 1);
    const { result } = respond(store, packet, [
      direction("d1", goalId, hypothesisId),
      direction("d2", goalId, hypothesisId, "lower_barrier"),
      direction("d3", goalId, hypothesisId, "change_game"),
    ]);
    assert.equal(result.status, "applied");
    assert.ok(
      result.warnings.some((item) => item.code === "too_many_directions"),
    );
    assert.ok(
      result.warnings.some((item) => item.code === "do_nothing_missing"),
    );
    const directions = store.snapshot().directions;
    assert.equal(directions.length, 2);
    assert.deepEqual(directions[0].predictions[0].actor.kind, "person");
    assert.equal(directions[0].lever.hypothesisId, hypothesisId);

    // Nouvelle série : les directions non choisies sont remplacées.
    const again = explorePacket(store, goalId, hypothesisId);
    const second = respond(store, again, [
      direction("d1", goalId, hypothesisId),
      direction("n1", goalId, hypothesisId, "do_nothing", "Ne rien changer"),
    ]).result;
    assert.ok(
      !second.warnings.some((item) => item.code === "do_nothing_missing"),
    );
    const statuses = store.snapshot().directions.map((item) => item.status);
    assert.deepEqual(
      statuses.filter((item) => item === "superseded").length,
      2,
    );
    assert.deepEqual(statuses.filter((item) => item === "proposed").length, 2);
  }));

test("BRIEF-005 · une direction sans lecture active est rejetée ; 1.4 reste accepté", () =>
  withStore((store) => {
    const { hypothesisId, goalId } = setup(store);
    const packet = explorePacket(store, goalId, hypothesisId);
    const withoutLever = direction("d1", goalId, hypothesisId);
    withoutLever.payload.lever.hypothesis = null;
    assert.throws(
      () => store.receiveAnalysis(proposal(packet, [withoutLever])),
      (error) => error.code === "direction_without_lever",
    );
    const noPrediction = direction("d2", goalId, hypothesisId);
    noPrediction.payload.predictions = [];
    assert.throws(
      () => store.receiveAnalysis(proposal(packet, [noPrediction])),
      (error) => error.code === "direction_without_prediction",
    );
    // Lecture remplacée : refus à l'application.
    store.database
      .prepare("UPDATE hypotheses SET status = 'superseded' WHERE id = ?")
      .run(hypothesisId);
    const packet3 = explorePacket(store, goalId, hypothesisId);
    const preview = store.receiveAnalysis(
      proposal(packet3, [direction("d3", goalId, hypothesisId)]),
    );
    if (preview.status === "ready_for_review")
      assert.throws(
        () => store.applyAnalysis(preview.responseId),
        /lever_not_active|superseded|remplacée|n’appartient/,
      );
    else assert.equal(preview.status, "rejected");
    // Une réponse 1.4 sans direction reste valide (prompt v6).
    const packet4 = store.prepareAnalysis({
      task: "explore",
      focus: [{ kind: "goal", id: goalId }],
    });
    const old = store.receiveAnalysis({
      ...proposal(packet4, []),
      schemaVersion: "1.4",
      outcome: "no_change",
    });
    assert.notEqual(old.status, "rejected");
  }));

test("BRIEF-005 · boucle d'action : attente figée, résultat citable, lecture à réexaminer, paquet complet", () =>
  withStore((store) => {
    const { hypothesisId, goalId } = setup(store);
    respond(store, explorePacket(store, goalId, hypothesisId), [
      direction("d1", goalId, hypothesisId),
      direction("n1", goalId, hypothesisId, "do_nothing", "Ne rien changer"),
    ]);
    const chosen = store
      .snapshot()
      .directions.find((item) => item.lever.kind === "change_reward");
    const choice = store.chooseDirection(
      parseChooseDirectionCommand({
        idempotencyKey: "r5:choose:1",
        directionId: chosen.id,
        userExpectation: "Je m'attends à ce qu'il râle un peu.",
      }),
    );
    const actionId = choice.created[0].id;
    assert.throws(
      () =>
        store.chooseDirection(
          parseChooseDirectionCommand({
            idempotencyKey: "r5:choose:2",
            directionId: chosen.id,
          }),
        ),
      /chosen/,
    );
    let snapshot = store.snapshot();
    const action = snapshot.actions[0];
    assert.equal(action.status, "planned");
    assert.equal(action.expectation.predictions[0].phase, "transitional");
    assert.equal(
      action.expectation.userExpectation,
      "Je m'attends à ce qu'il râle un peu.",
    );
    assert.equal(
      snapshot.directions.find((item) => item.id === chosen.id).status,
      "chosen",
    );

    assert.throws(
      () =>
        store.recordOutcome(
          parseRecordOutcomeCommand({
            idempotencyKey: "r5:outcome:bad",
            actionId,
            text: "x",
            verdicts: ["confirmed", "refuted"],
          }),
        ),
      /Un verdict par prédiction/,
    );
    store.recordOutcome(
      parseRecordOutcomeCommand({
        idempotencyKey: "r5:outcome:1",
        actionId,
        text: "Lucas a insisté deux soirs, puis il s'en est tenu au samedi.",
        verdicts: ["confirmed"],
      }),
    );
    snapshot = store.snapshot();
    const done = snapshot.actions[0];
    assert.equal(done.status, "done");
    assert.ok(done.outcome.sourceId, "résultat citable");
    assert.ok(done.outcome.recordedAt >= done.expectationRecordedAt);
    assert.deepEqual(done.verdicts, ["confirmed"]);
    const lever = snapshot.hypotheses.find((item) => item.id === hypothesisId);
    assert.equal(lever.needsReview, true, "lecture à réexaminer");
    assert.ok(
      snapshot.sources.some(
        (source) =>
          source.id === done.outcome.sourceId &&
          source.content.includes("s'en est tenu au samedi"),
      ),
    );
    assert.deepEqual(
      snapshot.revisions.slice(-1)[0].commandType,
      "action.outcome",
    );

    const revise = store.prepareAnalysis({
      task: "revise",
      focus: [{ kind: "hypothesis", id: hypothesisId }],
    });
    assert.equal(revise.actions.length, 1);
    assert.equal(revise.actions[0].outcome.text.includes("samedi"), true);
    assert.equal(revise.directions.length >= 1, true);
    assert.ok(
      revise.sources.some(
        (source) => source.sourceId === done.outcome.sourceId,
      ),
    );
    assert.throws(
      () =>
        store.recordOutcome(
          parseRecordOutcomeCommand({
            idempotencyKey: "r5:outcome:2",
            actionId,
            text: "encore",
          }),
        ),
      /déjà enregistré/,
    );
  }));
