import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { randomUUID } from "node:crypto";
import { basename, join } from "node:path";
import { tmpdir } from "node:os";

const script = join(process.cwd(), "scripts", "scenario-run.mjs");

function execute(...arguments_) {
  const result = spawnSync(process.execPath, [script, ...arguments_], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  assert.equal(
    result.status,
    0,
    `Commande échouée.\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`,
  );
  return result.stdout;
}

const read = (path) => JSON.parse(readFileSync(path, "utf8"));

function answer(packet, operations) {
  return JSON.stringify({
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
    outcome: operations.length ? "proposed" : "no_change",
    operations,
    clarifications: [],
    summary: "Réponse simulée.",
  });
}

test("le harnais multi-étapes enchaîne analyses, annotations et réponses, puis reprend depuis les copies versionnées", () => {
  const directory = mkdtempSync(join(tmpdir(), "manwe-scenario-"));
  const runDir = join(directory, `run-${randomUUID()}`);
  const qaDir = join(process.cwd(), ".qa", basename(runDir));
  const fixturePath = join(directory, "fixture.json");
  const capture = (id, text, date) => ({
    id,
    type: "capture",
    command: {
      idempotencyKey: `scenario-test:${id}`,
      title: `Étape ${id}`,
      text,
      recordedAt: date,
      narratedAt: date,
      occurredStart: date,
      occurredEnd: null,
      temporalPrecision: "day",
      context: "Test",
    },
  });
  writeFileSync(
    fixturePath,
    JSON.stringify({
      schemaVersion: "1.0",
      scenarios: [
        {
          id: "T1",
          steps: [
            capture(
              "T1-1",
              "Karim a mis deux jours à répondre.",
              "2026-05-12T12:00:00-03:00",
            ),
            {
              id: "T1-A1",
              type: "analyze",
              task: "interpret",
              focus: { person: "Karim" },
            },
            {
              id: "T1-C1",
              type: "annotate",
              target: { hypotheses: { subject: "Karim", which: "all_active" } },
              annotationType: "agreement",
              text: "Oui, c'est lui.",
            },
            {
              id: "T1-Q1",
              type: "answer",
              question: "last_open",
              choice: "unknown",
            },
            {
              id: "T1-A2",
              type: "analyze",
              task: "revise",
              focus: { person: "Karim" },
            },
          ],
        },
      ],
    }),
    "utf8",
  );
  try {
    execute("prepare", fixturePath, runDir);
    const first = read(join(runDir, "T1", "T1-A1", "context.json"));
    assert.equal(first.task, "interpret");
    assert.ok(existsSync(join(runDir, "T1", "T1-A1", "prepared.sqlite3")));
    const source = first.sources[0];
    writeFileSync(
      join(runDir, "T1", "T1-A1", "proposal.raw.json"),
      answer(first, [
        {
          key: "c1",
          kind: "propose_claim",
          payload: {
            text: "Karim a mis deux jours à répondre.",
            category: "sourced_observation",
            modality: "actual",
            validFrom: null,
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
          rationale: "Fait.",
        },
        {
          key: "h1",
          kind: "propose_hypothesis",
          payload: {
            statement: "Karim est surchargé.",
            depth: "D1",
            framework: null,
            construct: null,
            confidence: "low",
            subjects: [{ mention: "Karim" }],
            evidence: [{ claim: { proposalKey: "c1" }, stance: "supports" }],
            limits: "Un seul épisode.",
            revisionConditions: "Des réponses rapides.",
            alternativeTo: null,
            validFrom: null,
            validTo: null,
          },
          rationale: "Lecture de surface.",
        },
        {
          key: "q1",
          kind: "propose_question",
          payload: {
            question: "Karim répond-il aussi tard aux autres ?",
            targets: [{ proposalKey: "h1" }],
            discriminatingInfo: "Surcharge générale ou non.",
            whyNow: "Premier délai observé.",
          },
          rationale: "Question.",
        },
      ]),
      "utf8",
    );
    // Reprise depuis une autre machine : seules les copies versionnées subsistent.
    rmSync(qaDir, { recursive: true, force: true });
    execute("advance", runDir);
    const state = read(join(runDir, "T1", "state.json"));
    assert.equal(state.pending, "T1-A2");
    assert.deepEqual(
      state.log.map((entry) => [entry.step, entry.outcome]),
      [
        ["T1-1", "captured"],
        ["T1-A1", "applied"],
        ["T1-C1", "annotated"],
        ["T1-Q1", "answered:unknown"],
        ["T1-A2", "awaiting_response"],
      ],
    );
    const second = read(join(runDir, "T1", "T1-A2", "context.json"));
    assert.equal(second.task, "revise");
    assert.equal(second.hypotheses.length, 1);
    assert.equal(second.questions[0].status, "unknown");
    writeFileSync(
      join(runDir, "T1", "T1-A2", "proposal.raw.json"),
      answer(second, []),
      "utf8",
    );
    rmSync(qaDir, { recursive: true, force: true });
    execute("advance", runDir);
    execute("summary", runDir);
    const results = read(join(runDir, "results.json"));
    const scenario = results.scenarios[0];
    assert.equal(scenario.completed, true);
    assert.equal(scenario.hypotheses[0].subjects[0], "Karim");
    assert.equal(
      scenario.hypotheses[0].needsReview,
      false,
      "l’accord ne déclenche rien",
    );
    assert.equal(scenario.questions[0].status, "unknown");
    assert.ok(existsSync(join(runDir, "T1", "final.sqlite3")));
    assert.match(
      readFileSync(join(runDir, "SUMMARY.md"), "utf8"),
      /Karim est surchargé/,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
    rmSync(qaDir, { recursive: true, force: true });
  }
});
