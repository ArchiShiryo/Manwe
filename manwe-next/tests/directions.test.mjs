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

test("BRIEF-005 · directions : levier requis, aucun plafond (D-024), « ne rien entreprendre » attendu", () =>
  withStore((store) => {
    const { hypothesisId, goalId } = setup(store);
    const packet = explorePacket(store, goalId, hypothesisId);
    assert.equal(packet.schemaVersion, "1.7");
    assert.ok(packet.allowedOperations.includes("propose_direction"));
    assert.equal(packet.goals.length, 1);
    const { result } = respond(store, packet, [
      direction("d1", goalId, hypothesisId),
      direction("d2", goalId, hypothesisId, "lower_barrier"),
      direction("d3", goalId, hypothesisId, "change_game"),
    ]);
    assert.equal(result.status, "applied");
    assert.ok(
      !result.warnings.some((item) => item.code === "too_many_directions"),
      "aucun plafond de directions (D-024)",
    );
    assert.ok(
      result.warnings.some((item) => item.code === "do_nothing_missing"),
    );
    const directions = store.snapshot().directions;
    assert.equal(directions.length, 3);
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
      3,
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

test("RAPPORT-010 · un sujet recopié du format du paquet est normalisé", () =>
  withStore((store) => {
    const { hypothesisId, goalId } = setup(store);
    const packet = explorePacket(store, goalId, hypothesisId);
    const personId = store.snapshot().persons[0].id;
    const op = direction("d1", goalId, hypothesisId);
    op.payload.predictions = [
      {
        actor: { kind: "self" },
        response: "Je culpabilise un peu.",
        phase: "immediate",
        horizonDays: null,
      },
      {
        actor: { kind: "person", personId },
        response: "Il insiste.",
        phase: "transitional",
        horizonDays: 7,
      },
    ];
    const { preview, result } = respond(store, packet, [op]);
    assert.equal(result?.status, "applied", JSON.stringify(preview.errors));
    const stored = store
      .snapshot()
      .directions[0].predictions.map((item) => item.actor);
    assert.deepEqual(stored, [{ kind: "self" }, { kind: "person", personId }]);
    const packet2 = explorePacket(store, goalId, hypothesisId);
    const bad = direction("d2", goalId, hypothesisId);
    bad.payload.predictions[0].actor = { kind: "person", personId, extra: 1 };
    assert.throws(
      () => store.receiveAnalysis(proposal(packet2, [bad])),
      /invalid_subject|Un sujet/,
    );
  }));

test("R5.4 · un objectif émerge de la conversation, reste à adopter, ne remplace jamais un objectif confirmé", () =>
  withStore((store) => {
    store.capture(
      parseCaptureCommand({
        idempotencyKey: "r54:capture:1",
        text: "J'en ai marre de tout porter pour la coloc, je voudrais que ça tourne sans que je sois le seul à tout gérer.",
        occurredStart: "2026-03-01T20:00:00+01:00",
        temporalPrecision: "day",
      }),
    );
    const goalOp = (key, goal) => ({
      key,
      kind: "propose_goal",
      payload: {
        problem: "L'utilisateur porte seul la charge de la colocation.",
        goal,
        citations: [],
      },
      rationale: "Souhait exprimé.",
    });
    let packet = store.prepareAnalysis({ task: "interpret" });
    const cite = [citation(packet.sources[0])];
    const first = goalOp(
      "g1",
      "Que la coloc tourne sans que je sois le seul à tout gérer",
    );
    first.payload.citations = cite;
    const second = goalOp("g2", "Autre formulation");
    second.payload.citations = cite;
    const { result } = respond(store, packet, [first, second]);
    assert.ok(result.warnings.some((item) => item.code === "too_many_goals"));
    let goals = store.snapshot().goals;
    assert.equal(goals.length, 1);
    assert.equal(goals[0].origin, "analysis");
    assert.equal(
      goals[0].confirmedByUser,
      false,
      "pas adopté sans l'utilisateur",
    );
    assert.equal(
      goals[0].problem,
      "L'utilisateur porte seul la charge de la colocation.",
    );
    assert.equal(goals[0].citations[0].sourceId, packet.sources[0].sourceId);

    // Sans citation : refusé par le contrat.
    packet = store.prepareAnalysis({ task: "interpret" });
    assert.throws(
      () =>
        store.receiveAnalysis(proposal(packet, [goalOp("g3", "Sans source")])),
      /citation/i,
    );

    // Une nouvelle proposition remplace la précédente en attente.
    packet = store.prepareAnalysis({ task: "interpret" });
    const third = goalOp("g4", "Partager les tâches de la coloc");
    third.payload.citations = [citation(packet.sources[0])];
    respond(store, packet, [third]);
    goals = store.snapshot().goals;
    assert.equal(goals.filter((goal) => !goal.dismissed).length, 1);
    const pending = goals.find((goal) => !goal.dismissed);

    // Adoption avec reformulation immédiate : l'objectif devient courant.
    store.updateGoal(
      parseGoalCommand({
        idempotencyKey: "r54:adopt",
        goalId: pending.id,
        text: "Partager les tâches de la coloc sans conflit",
      }),
    );
    goals = store.snapshot().goals;
    const adopted = goals.find((goal) => goal.id === pending.id);
    assert.equal(adopted.confirmedByUser, true);
    assert.equal(adopted.text, "Partager les tâches de la coloc sans conflit");
    assert.throws(
      () =>
        store.dismissGoal({
          idempotencyKey: "r54:dismiss:confirmed",
          goalId: adopted.id,
        }),
      /confirmée/,
    );

    // Une proposition ultérieure ne remplace jamais l'objectif confirmé.
    packet = store.prepareAnalysis({ task: "interpret" });
    const fourth = goalOp("g5", "Autre chose");
    fourth.payload.citations = [citation(packet.sources[0])];
    respond(store, packet, [fourth]);
    goals = store.snapshot().goals;
    assert.equal(
      goals.find((goal) => goal.id === adopted.id).text,
      "Partager les tâches de la coloc sans conflit",
    );
    const later = goals.find((goal) => goal.text === "Autre chose");
    assert.equal(later.confirmedByUser, false);
    store.dismissGoal({ idempotencyKey: "r54:dismiss", goalId: later.id });
    assert.equal(
      store.snapshot().goals.find((goal) => goal.id === later.id).dismissed,
      true,
    );
  }));

test("RAPPORT-011 · une citation mal recopiée est refusée avec un message qui permet de la corriger", () =>
  withStore((store) => {
    setup(store);
    const packet = store.prepareAnalysis({ task: "extract", context: "full" });
    const source = packet.sources[0];
    const quote = source.text.replace("crevé", "crevè");
    const preview = store.receiveAnalysis(
      proposal(packet, [
        {
          key: "c9",
          kind: "propose_claim",
          payload: {
            text: "Fait mal cité.",
            category: "reported_observation",
            modality: "actual",
            validFrom: null,
            validTo: null,
            citations: [{ ...citation(source), quote }],
          },
          rationale: "x".repeat(1200),
        },
      ]),
    );
    assert.equal(preview.status, "rejected");
    assert.equal(preview.errors[0].code, "citation_mismatch");
    assert.match(preview.errors[0].message, /« c9 »/);
    assert.match(
      preview.errors[0].message,
      /crevé/,
      "le texte exact est rappelé",
    );
  }));

test("D-025 · application partielle : l'opération mal citée et ses dépendantes sont écartées, le reste s'applique", () =>
  withStore((store) => {
    setup(store);
    const packet = store.prepareAnalysis({ task: "interpret", context: "full" });
    const source = packet.sources[0];
    const claim = (key, bad = false) => ({
      key,
      kind: "propose_claim",
      payload: {
        text: `Fait ${key}.`,
        category: "reported_observation",
        modality: "actual",
        validFrom: null,
        validTo: null,
        citations: [
          {
            ...citation(source),
            quote: bad ? source.text.replace("crevé", "crevè") : source.text,
          },
        ],
      },
      rationale: "Test.",
    });
    const hypothesis = {
      key: "h9",
      kind: "propose_hypothesis",
      payload: {
        statement: "Lecture qui s'appuie sur le fait mal cité.",
        depth: "D1",
        framework: null,
        construct: null,
        confidence: "low",
        subjects: [{ mention: "Lucas" }],
        evidence: [{ claim: { proposalKey: "bad" }, stance: "supports" }],
        limits: "Test.",
        revisionConditions: "Test.",
        alternativeTo: null,
        validFrom: null,
        validTo: null,
      },
      rationale: "Test.",
    };
    const operations = [
      claim("bad", true),
      hypothesis,
      ...["a", "b", "c", "d", "e", "f", "g", "h"].map((key) => claim(key)),
    ];
    const preview = store.receiveAnalysis(proposal(packet, operations));
    assert.equal(preview.status, "ready_for_review");
    assert.deepEqual(
      preview.droppedOperations.map((item) => [item.key, item.code]),
      [
        ["bad", "citation_mismatch"],
        ["h9", "dependent_dropped"],
      ],
    );
    assert.equal(preview.operations.length, 8);
    const result = store.applyAnalysis(preview.responseId);
    assert.equal(
      result.warnings.filter((item) => item.code === "operation_dropped")
        .length,
      2,
    );
    assert.ok(
      !store.snapshot().claims.some((item) => item.text === "Fait bad."),
    );

    // Plus de 20 % d'opérations écartées : rejet complet, comme avant.
    const packet2 = store.prepareAnalysis({ task: "interpret", context: "full" });
    const many = store.receiveAnalysis(
      proposal(packet2, [claim("x1", true), claim("x2", true), claim("x3")]),
    );
    assert.equal(many.status, "rejected");
  }));

test("D-025 · sujet de groupe de trois membres ou plus", () =>
  withStore((store) => {
    store.capture(
      parseCaptureCommand({
        idempotencyKey: "group:capture:1",
        text: "Maya m'a demandé de faire les courses et Jules a laissé sa vaisselle ; j'ai tout fait.",
        occurredStart: "2026-03-01T20:00:00+01:00",
        temporalPrecision: "day",
      }),
    );
    const packet = store.prepareAnalysis({ task: "interpret" });
    const { preview, result } = respond(store, packet, [
      {
        key: "c1",
        kind: "propose_claim",
        payload: {
          text: "L'utilisateur a fait les courses et la vaisselle.",
          category: "explicit_statement",
          modality: "actual",
          validFrom: null,
          validTo: null,
          citations: [citation(packet.sources[0])],
        },
        rationale: "Fait.",
      },
      {
        key: "h1",
        kind: "propose_hypothesis",
        payload: {
          statement:
            "Dans la colocation, la charge se concentre sur l'utilisateur.",
          depth: "D2",
          framework: null,
          construct: null,
          confidence: "low",
          subjects: [
            {
              group: [
                { mention: "Maya" },
                { mention: "Jules" },
                { self: true },
              ],
            },
          ],
          evidence: [{ claim: { proposalKey: "c1" }, stance: "supports" }],
          limits: "Un épisode.",
          revisionConditions: "Une tâche prise spontanément par Maya ou Jules.",
          alternativeTo: null,
          validFrom: null,
          validTo: null,
        },
        rationale: "Lecture de groupe.",
      },
    ]);
    assert.equal(result?.status, "applied", JSON.stringify(preview.errors));
    const snapshot = store.snapshot();
    const group = snapshot.relations.find((item) => item.members.length === 3);
    assert.ok(group, "groupe stocké comme relation à trois membres");
    const reading = snapshot.hypotheses.find((item) => item.depth === "D2");
    assert.equal(reading.subjects[0].kind, "relation");
    assert.equal(reading.subjects[0].members.length, 3);
  }));
