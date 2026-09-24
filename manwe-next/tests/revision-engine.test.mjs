import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parseCaptureCommand } from "../packages/domain/src/memory.ts";
import { SqliteMemoryStore } from "../packages/storage/src/sqliteStore.ts";

// Parcours R3 de bout en bout : les « réponses du modèle » sont écrites à la
// main ici pour tester les règles déterministes, pas la qualité d'analyse.

function withStore(run) {
  const directory = mkdtempSync(join(tmpdir(), "manwe-r3-"));
  const path = join(directory, "memory.sqlite3");
  try {
    return run(() => new SqliteMemoryStore(path, "r3"));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

let captureCounter = 0;
function capture(store, text, occurredStart, recordedAt = occurredStart) {
  captureCounter += 1;
  return store.capture(
    parseCaptureCommand({
      idempotencyKey: `r3:capture:${captureCounter}`,
      text,
      recordedAt,
      narratedAt: recordedAt,
      occurredStart,
      temporalPrecision: "day",
      context: "Test",
    }),
  );
}

function citation(source) {
  return {
    sourceId: source.sourceId,
    contentHash: source.contentHash,
    spanStart: source.spanStart,
    spanEnd: source.spanEnd,
    quote: source.text,
  };
}

function proposal(packet, operations, outcome = "proposed") {
  return {
    schemaVersion: "1.2",
    requestId: packet.requestId,
    workspaceId: packet.workspaceId,
    baseRevision: packet.baseRevision,
    contextHash: packet.contextHash,
    modelDeclaration: {
      declaredModel: "Test",
      role: "analyst",
      technicalId: null,
    },
    outcome,
    operations,
    clarifications: [],
    summary: "Réponse de test.",
  };
}

function respond(store, packet, operations) {
  const preview = store.receiveAnalysis(proposal(packet, operations));
  if (preview.status !== "ready_for_review") return { preview, result: null };
  return { preview, result: store.applyAnalysis(preview.responseId) };
}

/** Capture un récit et en extrait un claim ; renvoie l'id du claim. */
function claimFrom(
  store,
  text,
  occurredStart,
  category = "sourced_observation",
  recordedAt = occurredStart,
) {
  const { created } = capture(store, text, occurredStart, recordedAt);
  const event = created.find((ref) => ref.kind === "event");
  const packet = store.prepareAnalysis({ task: "extract", focus: [event] });
  const { result } = respond(store, packet, [
    {
      key: "c1",
      kind: "propose_claim",
      payload: {
        text,
        category,
        modality: "actual",
        validFrom: null,
        validTo: null,
        citations: [citation(packet.sources[0])],
      },
      rationale: "Extraction de test.",
    },
  ]);
  return result.createdIds.find((ref) => ref.kind === "claim").id;
}

function interpretPacket(store, claimIds) {
  return store.prepareAnalysis({
    task: "interpret",
    focus: claimIds.map((id) => ({ kind: "claim", id })),
  });
}

function revisePacket(store, hypothesisId) {
  return store.prepareAnalysis({
    task: "revise",
    focus: [{ kind: "hypothesis", id: hypothesisId }],
  });
}

function hypothesisOp(key, claimIds, overrides = {}) {
  return {
    key,
    kind: "propose_hypothesis",
    payload: {
      statement: "Hugo répond aux invitations mais n’en prend jamais.",
      depth: "D1",
      framework: null,
      construct: null,
      confidence: "low",
      subjects: [{ mention: "Hugo" }],
      evidence: claimIds.map((id) => ({
        claim: { kind: "claim", id },
        stance: "supports",
      })),
      limits: "Observations de l’utilisateur uniquement.",
      revisionConditions: "Une invitation spontanée de Hugo.",
      alternativeTo: null,
      validFrom: null,
      validTo: null,
      ...overrides,
    },
    rationale: "Hypothèse de test.",
  };
}

function reviseOp(hypothesis, overrides = {}) {
  return {
    key: "r1",
    kind: "revise_hypothesis",
    payload: {
      target: { kind: "hypothesis", id: hypothesis.id },
      expectedRowVersion: hypothesis.revision,
      status: "plausible",
      confidence: "low",
      addEvidence: [],
      ...overrides,
    },
    rationale: "Révision de test.",
  };
}

function hypothesis(store, id) {
  return store.snapshot().hypotheses.find((item) => item.id === id);
}

function createHypothesis(store, claimIds, overrides = {}) {
  const packet = interpretPacket(store, claimIds);
  const { preview, result } = respond(store, packet, [
    hypothesisOp("h1", claimIds, overrides),
  ]);
  assert.equal(
    preview.status,
    "ready_for_review",
    JSON.stringify(preview.errors),
  );
  return result.createdIds.find((ref) => ref.kind === "hypothesis").id;
}

function promote(store, id, overrides = {}) {
  const { preview } = respond(store, revisePacket(store, id), [
    reviseOp(hypothesis(store, id), overrides),
  ]);
  return preview;
}

test("R3-1 · une contre-preuve ancrée retire le droit au statut plausible", () =>
  withStore((open) => {
    const store = open();
    const support = claimFrom(
      store,
      "Hugo a accepté mon invitation au cinéma sans rien proposer d’autre.",
      "2026-05-20T12:00:00-03:00",
    );
    const id = createHypothesis(store, [support]);
    assert.equal(promote(store, id).status, "ready_for_review");
    assert.equal(hypothesis(store, id).status, "plausible");

    const contra = claimFrom(
      store,
      "Hugo m’a écrit de lui-même pour proposer un concert vendredi.",
      "2026-06-30T12:00:00-03:00",
    );
    const packet = store.prepareAnalysis({
      task: "revise",
      focus: [
        { kind: "hypothesis", id },
        { kind: "claim", id: contra },
      ],
    });
    const refused = respond(store, packet, [
      reviseOp(hypothesis(store, id), {
        addEvidence: [
          { claim: { kind: "claim", id: contra }, stance: "contradicts" },
        ],
      }),
    ]).preview;
    assert.equal(refused.status, "rejected");
    assert.equal(refused.errors[0].code, "status_not_allowed");

    const packet2 = store.prepareAnalysis({
      task: "revise",
      focus: [
        { kind: "hypothesis", id },
        { kind: "claim", id: contra },
      ],
    });
    const accepted = respond(store, packet2, [
      reviseOp(hypothesis(store, id), {
        status: "contradicted",
        addEvidence: [
          { claim: { kind: "claim", id: contra }, stance: "contradicts" },
        ],
      }),
    ]).preview;
    assert.equal(accepted.status, "ready_for_review");
    const after = hypothesis(store, id);
    assert.equal(after.status, "contradicted");
    assert.equal(after.counts.anchoredContradicts, 1);
    store.close();
  }));

test("R3-2 · une correction factuelle fait redescendre l’hypothèse et survit au redémarrage", () =>
  withStore((open) => {
    let store = open();
    const first = claimFrom(
      store,
      "Inès a annulé notre dîner une heure avant.",
      "2026-03-03T12:00:00-03:00",
    );
    const second = claimFrom(
      store,
      "Le week-end à la mer avec Inès est tombé à l’eau.",
      "2026-03-21T12:00:00-03:00",
    );
    const id = createHypothesis(store, [first, second], {
      statement: "Inès se retire des projets communs.",
      depth: "D2",
      subjects: [{ mention: "Inès" }],
    });
    assert.equal(promote(store, id).status, "ready_for_review");
    assert.equal(hypothesis(store, id).status, "plausible");

    store.annotate({
      idempotencyKey: "r3:correction",
      target: { kind: "claim", id: second },
      text: "C’est moi qui ai annulé le week-end, pas Inès.",
      annotationType: "factual_correction",
    });
    let after = hypothesis(store, id);
    assert.equal(after.status, "draft");
    assert.equal(after.needsReview, true);
    assert.equal(after.reviewReason, "correction");
    assert.equal(after.counts.anchoredSupports, 1);
    store.close();

    store = open();
    after = hypothesis(store, id);
    assert.equal(after.status, "draft");
    assert.equal(after.needsReview, true);
    assert.notEqual(
      store.snapshot().claims.find((claim) => claim.id === second)
        .contestedRevision,
      null,
    );
    store.close();
  }));

test("R3-3 · « je suis d’accord » n’ajoute aucune preuve et ne change aucun statut", () =>
  withStore((open) => {
    const store = open();
    const claim = claimFrom(
      store,
      "Théo a fait la tête toute la soirée.",
      "2026-02-07T12:00:00-03:00",
    );
    const id = createHypothesis(store, [claim], {
      subjects: [{ mention: "Théo" }],
      statement: "Théo supporte mal que l’utilisateur voie d’autres amis.",
    });
    const before = hypothesis(store, id);
    store.annotate({
      idempotencyKey: "r3:agreement",
      target: { kind: "hypothesis", id },
      text: "Oui, c’est tout à fait lui.",
      annotationType: "agreement",
    });
    const after = hypothesis(store, id);
    assert.deepEqual(after.counts, before.counts);
    assert.equal(after.status, before.status);
    assert.equal(after.confidence, before.confidence);
    assert.equal(after.needsReview, false);
    assert.equal(after.revision, before.revision);
    store.close();
  }));

test("R3-4 · une réponse tardive ne restaure pas une conclusion invalidée", () =>
  withStore((open) => {
    const store = open();
    const first = claimFrom(
      store,
      "Inès a annulé le cinéma.",
      "2026-04-10T12:00:00-03:00",
    );
    const second = claimFrom(
      store,
      "Inès a annulé le dîner.",
      "2026-03-03T12:00:00-03:00",
    );
    const id = createHypothesis(store, [first, second], {
      depth: "D2",
      subjects: [{ mention: "Inès" }],
      statement: "Inès se retire.",
    });
    const latePacket = revisePacket(store, id);
    store.annotate({
      idempotencyKey: "r3:late-correction",
      target: { kind: "claim", id: second },
      text: "Ce dîner, c’est moi qui l’ai annulé.",
      annotationType: "factual_correction",
    });
    const preview = store.receiveAnalysis(
      proposal(latePacket, [
        reviseOp(hypothesis(store, id), { expectedRowVersion: 1 }),
      ]),
    );
    assert.equal(preview.status, "rejected");
    assert.equal(preview.errors[0].code, "stale_object");
    assert.throws(
      () => store.applyAnalysis(preview.responseId),
      (error) => error.code === "analysis_not_applicable",
    );
    assert.notEqual(hypothesis(store, id).status, "plausible");
    assert.equal(hypothesis(store, id).needsReview, true);
    store.close();
  }));

test("R3-5 · trois indices d’un même récit ou deux copies d’un message comptent pour une unité", () =>
  withStore((open) => {
    const store = open();
    const lunch =
      "Déjeuner avec Yanis : il a regardé son téléphone, changé de sujet et est parti avant le café.";
    const { created } = capture(store, lunch, "2026-04-15T12:00:00-03:00");
    const event = created.find((ref) => ref.kind === "event");
    const packet = store.prepareAnalysis({ task: "extract", focus: [event] });
    const source = packet.sources[0];
    const cue = (key, text) => ({
      key,
      kind: "propose_claim",
      payload: {
        text,
        category: "sourced_observation",
        modality: "actual",
        validFrom: null,
        validTo: null,
        citations: [citation(source)],
      },
      rationale: "Indice.",
    });
    const { result } = respond(store, packet, [
      cue("a", "Yanis a regardé son téléphone."),
      cue("b", "Yanis a changé de sujet."),
      cue("c", "Yanis est parti avant le café."),
    ]);
    const cues = result.createdIds
      .filter((ref) => ref.kind === "claim")
      .map((ref) => ref.id);
    const copyA = claimFrom(
      store,
      "Yanis a raccroché quand j’ai parlé des 200 euros.",
      "2026-04-06T12:00:00-03:00",
    );
    const copyB = claimFrom(
      store,
      "Yanis a raccroché quand j’ai parlé des 200 euros.",
      "2026-04-06T12:00:00-03:00",
      "sourced_observation",
      "2026-04-09T20:00:00-03:00",
    );
    const id = createHypothesis(store, [...cues, copyA, copyB], {
      depth: "D2",
      subjects: [{ mention: "Yanis" }],
      statement: "Yanis évite le sujet de sa dette.",
    });
    const counts = hypothesis(store, id).counts;
    assert.equal(counts.supportUnits, 2);
    assert.equal(counts.anchoredSupports, 2);
    store.close();
  }));

test("R3-6 · une hypothèse appuyée seulement sur des inférences ne devient pas plausible", () =>
  withStore((open) => {
    const store = open();
    const a = claimFrom(
      store,
      "Karim semble désintéressé.",
      "2026-05-12T12:00:00-03:00",
      "inference",
    );
    const b = claimFrom(
      store,
      "Karim paraît distant.",
      "2026-06-16T12:00:00-03:00",
      "inference",
    );
    const id = createHypothesis(store, [a, b], {
      subjects: [{ mention: "Karim" }],
      statement: "Karim s’éloigne.",
    });
    const preview = promote(store, id);
    assert.equal(preview.status, "rejected");
    assert.equal(preview.errors[0].code, "status_not_allowed");
    store.close();
  }));

test("R3-7 · profondeurs : D4 accepté en brouillon, promu seulement sur 3 épisodes / 30 jours avec alternative", () =>
  withStore((open) => {
    const store = open();
    const crisis = [
      claimFrom(
        store,
        "Maëlle m’a dit que j’étais la seule personne qui la comprenait.",
        "2026-07-01T12:00:00-03:00",
      ),
      claimFrom(
        store,
        "Maëlle m’a envoyé onze messages : « tu vas m’abandonner toi aussi ».",
        "2026-07-04T12:00:00-03:00",
      ),
      claimFrom(
        store,
        "Maëlle m’a dit que j’étais égoïste puis m’a remercié le soir même.",
        "2026-07-09T12:00:00-03:00",
      ),
    ];
    const deep = {
      statement:
        "Fonctionnement de type borderline : idéalisation, dévalorisation, peur d’abandon.",
      depth: "D4",
      framework: "DSM-5 / CIM-11 (lecture non clinique)",
      construct: "traits de personnalité borderline",
      subjects: [{ mention: "Maëlle" }],
    };

    let packet = interpretPacket(store, crisis);
    let preview = respond(store, packet, [
      hypothesisOp("h1", crisis, deep),
    ]).preview;
    assert.equal(preview.errors[0]?.code, "alternative_required");

    packet = interpretPacket(store, crisis);
    preview = respond(store, packet, [
      hypothesisOp("h1", crisis, { ...deep, framework: null }),
    ]).preview;
    assert.equal(preview.errors[0]?.code, "framework_required");

    packet = interpretPacket(store, crisis);
    preview = respond(store, packet, [
      hypothesisOp("h1", crisis, { ...deep, confidence: "high" }),
      hypothesisOp("h2", crisis, {
        statement: "Crise transitoire après la rupture.",
        depth: "D1",
        subjects: [{ mention: "Maëlle" }],
        alternativeTo: { proposalKey: "h1" },
      }),
    ]).preview;
    assert.equal(preview.errors[0]?.code, "confidence_not_supported");

    packet = interpretPacket(store, crisis);
    const { result } = respond(store, packet, [
      hypothesisOp("h1", crisis, deep),
      hypothesisOp("h2", crisis, {
        statement: "Crise transitoire après la rupture.",
        depth: "D1",
        subjects: [{ mention: "Maëlle" }],
        alternativeTo: { proposalKey: "h1" },
      }),
      hypothesisOp("h3", crisis, {
        statement: "Une troisième lecture reste possible.",
        depth: "D1",
        subjects: [{ mention: "Maëlle" }],
      }),
    ]);
    assert.ok(
      result,
      "trois hypothèses sont acceptées : pas de plafond backend (D-010)",
    );
    const deepId = result.createdIds.filter(
      (ref) => ref.kind === "hypothesis",
    )[0].id;
    assert.equal(hypothesis(store, deepId).status, "draft");
    assert.equal(promote(store, deepId).errors[0].code, "status_not_allowed");

    const later = claimFrom(
      store,
      "Maëlle a de nouveau menacé de couper les ponts, deux mois après.",
      "2026-09-10T12:00:00-03:00",
    );
    packet = store.prepareAnalysis({
      task: "revise",
      focus: [
        { kind: "hypothesis", id: deepId },
        { kind: "claim", id: later },
      ],
    });
    preview = respond(store, packet, [
      reviseOp(hypothesis(store, deepId), {
        addEvidence: [
          { claim: { kind: "claim", id: later }, stance: "supports" },
        ],
        confidence: "high",
      }),
    ]).preview;
    assert.equal(
      preview.status,
      "ready_for_review",
      JSON.stringify(preview.errors),
    );
    assert.equal(hypothesis(store, deepId).status, "plausible");
    assert.equal(hypothesis(store, deepId).confidence, "high");
    const maelle = store
      .snapshot()
      .persons.filter((person) => person.displayName === "Maëlle");
    assert.equal(maelle.length, 1, "une mention résolue une seule fois");
    store.close();
  }));

test("R3-8 · une question identique n’est pas reposée ; « je ne sais pas » ne change rien d’autre", () =>
  withStore((open) => {
    const store = open();
    const claim = claimFrom(
      store,
      "Karim a mis deux jours à répondre.",
      "2026-05-12T12:00:00-03:00",
    );
    const id = createHypothesis(store, [claim], {
      subjects: [{ mention: "Karim" }],
      statement: "Karim est surchargé.",
    });
    const ask = (packet) =>
      respond(store, packet, [
        {
          key: "q1",
          kind: "propose_question",
          payload: {
            question: "Karim répond-il aussi tard aux autres ?",
            targets: [{ kind: "hypothesis", id }],
            discriminatingInfo: "Distingue surcharge générale et désintérêt.",
            whyNow: "Trois silences en un mois.",
          },
          rationale: "Question discriminante.",
        },
      ]);
    const { result } = ask(interpretPacket(store, [claim]));
    const questionId = result.createdIds.find(
      (ref) => ref.kind === "question",
    ).id;
    const before = hypothesis(store, id);
    store.answerQuestion({
      idempotencyKey: "r3:unknown",
      questionId,
      choice: "unknown",
    });
    const question = store
      .snapshot()
      .questions.find((item) => item.id === questionId);
    assert.equal(question.status, "unknown");
    const after = hypothesis(store, id);
    assert.equal(after.needsReview, false);
    assert.deepEqual(after.counts, before.counts);
    const packet = interpretPacket(store, [claim]);
    assert.ok(
      packet.questions.some((item) => item.id === questionId),
      "les questions closes restent visibles",
    );
    const again = ask(packet).preview;
    assert.equal(again.errors[0].code, "duplicate_question");
    store.close();
  }));

test("R3-9 · une révision qui ignore le désaccord de l’utilisateur est refusée", () =>
  withStore((open) => {
    const store = open();
    const a = claimFrom(
      store,
      "Sofia m’a répondu sèchement.",
      "2026-05-09T12:00:00-03:00",
    );
    const b = claimFrom(
      store,
      "Sofia a levé les yeux au ciel quand j’ai parlé de mon entretien.",
      "2026-06-01T12:00:00-03:00",
    );
    const id = createHypothesis(store, [a, b], {
      depth: "D2",
      subjects: [{ mention: "Sofia" }],
      statement: "Sofia méprise l’utilisateur.",
    });
    store.annotate({
      idempotencyKey: "r3:disagreement",
      target: { kind: "hypothesis", id },
      text: "Elle est comme ça avec tout le monde.",
      annotationType: "disagreement",
    });
    assert.equal(hypothesis(store, id).reviewReason, "disagreement");
    let preview = promote(store, id, { status: "draft" });
    assert.equal(preview.errors[0].code, "disagreement_unaddressed");
    const packet = revisePacket(store, id);
    preview = respond(store, packet, [
      reviseOp(hypothesis(store, id), { status: "draft" }),
      hypothesisOp("alt", [a, b], {
        depth: "D2",
        subjects: [{ mention: "Sofia" }],
        statement: "Sofia a un style direct avec tout le monde.",
        alternativeTo: { kind: "hypothesis", id },
      }),
    ]).preview;
    assert.equal(
      preview.status,
      "ready_for_review",
      JSON.stringify(preview.errors),
    );
    assert.equal(hypothesis(store, id).needsReview, false);
    store.close();
  }));

test("R3-10 · une erreur du moteur ne laisse aucune mutation partielle", () =>
  withStore((open) => {
    const store = open();
    const claim = claimFrom(
      store,
      "Nathan a trouvé ma présentation trop longue.",
      "2026-08-03T12:00:00-03:00",
    );
    const before = store.snapshot();
    const packet = interpretPacket(store, [claim]);
    const source = packet.sources[0];
    const preview = respond(store, packet, [
      {
        key: "c2",
        kind: "propose_claim",
        payload: {
          text: "L’utilisateur pense que Nathan est pervers narcissique.",
          category: "user_impression",
          modality: "actual",
          validFrom: null,
          validTo: null,
          citations: [citation(source)],
        },
        rationale: "Impression.",
      },
      hypothesisOp("h1", [claim], {
        depth: "D3",
        subjects: [{ mention: "Nathan" }],
        statement: "Nathan cherche à dominer.",
      }),
    ]).preview;
    assert.equal(preview.status, "rejected");
    assert.equal(preview.errors[0].code, "alternative_required");
    const after = store.snapshot();
    assert.equal(after.workspace.revision, before.workspace.revision);
    assert.equal(after.claims.length, before.claims.length);
    assert.equal(after.hypotheses.length, 0);
    assert.equal(after.persons.length, 0);
    store.close();
  }));

test("R3 · un sujet absent des sources est refusé ; l’utilisateur peut être sujet", () =>
  withStore((open) => {
    const store = open();
    const claim = claimFrom(
      store,
      "J’ai dit oui à Lucas alors que je n’en avais pas envie.",
      "2026-04-22T12:00:00-03:00",
      "explicit_statement",
    );
    let preview = respond(store, interpretPacket(store, [claim]), [
      hypothesisOp("h1", [claim], { subjects: [{ mention: "Bastien" }] }),
    ]).preview;
    assert.equal(preview.errors[0].code, "subject_not_in_sources");
    preview = respond(store, interpretPacket(store, [claim]), [
      hypothesisOp("h1", [claim], {
        subjects: [{ self: true }, { mention: "Lucas" }],
        statement: "L’utilisateur peine à refuser à Lucas.",
      }),
    ]).preview;
    assert.equal(preview.status, "ready_for_review");
    const created = store.snapshot().hypotheses[0];
    assert.deepEqual(created.subjects.map((subject) => subject.kind).sort(), [
      "person",
      "self",
    ]);
    store.close();
  }));
