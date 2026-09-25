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

const script = join(process.cwd(), "scripts", "evaluation-run.mjs");

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

test("le harnais prépare, applique, rejoue et résume mécaniquement un lot", () => {
  const directory = mkdtempSync(join(tmpdir(), "manwe-evaluation-"));
  const runDir = join(directory, `run-${randomUUID()}`);
  const runId = basename(runDir);
  const fixturePath = join(directory, "fixture.json");
  const qaDir = join(process.cwd(), ".qa", runId);
  const baseCommand = {
    recordedAt: "2026-09-24T14:00:00-03:00",
    narratedAt: "2026-09-24T14:00:00-03:00",
    occurredStart: "2026-09-24T12:00:00-03:00",
    occurredEnd: null,
    temporalPrecision: "day",
    context: "Test",
  };
  writeFileSync(
    fixturePath,
    JSON.stringify({
      schemaVersion: "1.0",
      events: [
        {
          id: "T01",
          command: {
            ...baseCommand,
            idempotencyKey: "evaluation:test:capture:T01",
            title: "Cas T01",
            text: "Je vais appeler Samir demain.",
          },
        },
        {
          id: "T02",
          command: {
            ...baseCommand,
            idempotencyKey: "evaluation:test:capture:T02",
            title: "Cas T02",
            text: "Une réponse volontairement invalide sera associée à ce cas.",
          },
        },
        {
          id: "T03",
          command: {
            ...baseCommand,
            idempotencyKey: "evaluation:test:capture:T03",
            title: "Cas T03",
            text: "Je vais écrire à Nora ce soir.",
          },
        },
      ],
    }),
    "utf8",
  );

  try {
    execute("prepare", fixturePath, runDir);
    const promptText = readFileSync(
      join(process.cwd(), "packages", "cognition", "prompts", "analyst-v11.md"),
      "utf8",
    ).trimEnd();
    const packet = JSON.parse(
      readFileSync(join(runDir, "T01", "context.json"), "utf8"),
    );
    const preparedPrompt = readFileSync(
      join(runDir, "T01", "PROMPT.txt"),
      "utf8",
    );
    assert.ok(preparedPrompt.startsWith(`${promptText}\n\n{`));
    assert.ok(
      Date.parse(packet.expiresAt) - Date.parse(packet.createdAt) >=
        72 * 60 * 60 * 1000,
    );

    const source = packet.sources[0];
    writeFileSync(
      join(runDir, "T01", "proposal.raw.json"),
      JSON.stringify({
        schemaVersion: "1.4",
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
        operations: [
          {
            key: "claim-intended-call",
            kind: "propose_claim",
            payload: {
              text: "L'utilisateur prévoit d'appeler Samir demain.",
              category: "explicit_statement",
              modality: "intended",
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
            rationale: "Le projet futur est déclaré explicitement.",
          },
        ],
        clarifications: [],
        summary: "Une intention déclarée est proposée.",
      }),
      "utf8",
    );
    writeFileSync(
      join(runDir, "T02", "proposal.raw.json"),
      "réponse non JSON conservée telle quelle",
      "utf8",
    );

    // T03 : première réponse abîmée par le transport, nouvelle tentative
    // valide dans une autre conversation.
    writeFileSync(
      join(runDir, "T03", "proposal.raw.json"),
      '{"summary":"coupé :chatgpt-content-reference{index="0"}"}',
      "utf8",
    );
    const retryPacket = JSON.parse(
      readFileSync(join(runDir, "T03", "context.json"), "utf8"),
    );
    const retry = JSON.parse(
      readFileSync(join(runDir, "T01", "proposal.raw.json"), "utf8"),
    );
    for (const field of [
      "requestId",
      "workspaceId",
      "baseRevision",
      "contextHash",
    ])
      retry[field] = retryPacket[field];
    const retrySource = retryPacket.sources[0];
    retry.operations[0].payload.text = "L'utilisateur prévoit d'écrire à Nora.";
    retry.operations[0].payload.citations = [
      {
        sourceId: retrySource.sourceId,
        contentHash: retrySource.contentHash,
        spanStart: retrySource.spanStart,
        spanEnd: retrySource.spanEnd,
        quote: retrySource.text,
      },
    ];
    writeFileSync(
      join(runDir, "T03", "proposal.retry.raw.json"),
      JSON.stringify(retry),
      "utf8",
    );

    // Simule une application sur une autre machine : seules les copies
    // versionnées dans le dossier du run subsistent.
    assert.ok(existsSync(join(runDir, "T01", "prepared.sqlite3")));
    assert.ok(existsSync(join(runDir, "T02", "prepared.sqlite3")));
    rmSync(qaDir, { recursive: true, force: true });

    execute("apply", runDir);
    const applied = JSON.parse(
      readFileSync(join(runDir, "T01", "receipt.json"), "utf8"),
    );
    const rejected = JSON.parse(
      readFileSync(join(runDir, "T02", "receipt.json"), "utf8"),
    );
    assert.equal(applied.status, "applied");
    assert.equal(applied.exactReplay.replayed, true);
    assert.equal(applied.persisted.claimCount, 1);
    assert.equal(rejected.status, "rejected");
    assert.equal(rejected.attempts.length, 1);
    const retried = JSON.parse(
      readFileSync(join(runDir, "T03", "receipt.json"), "utf8"),
    );
    assert.equal(retried.status, "applied");
    assert.equal(retried.proposalFile, "proposal.retry.raw.json");
    assert.deepEqual(
      retried.attempts.map((entry) => [entry.status, entry.errorCodes]),
      [
        ["rejected", ["invalid_json"]],
        ["applied", []],
      ],
    );
    assert.equal(retried.persisted.claimCount, 1);
    assert.deepEqual(
      rejected.errors.map((error) => error.code),
      ["invalid_json"],
    );

    execute("summary", runDir);
    const results = JSON.parse(
      readFileSync(join(runDir, "results.json"), "utf8"),
    );
    assert.deepEqual(
      results.cases.map((entry) => [
        entry.caseId,
        entry.status,
        entry.attempts,
        entry.operationCount,
        entry.modalities,
        entry.errorCodes,
      ]),
      [
        ["T01", "applied", 1, 1, ["intended"], []],
        ["T02", "rejected", 1, 0, [], ["invalid_json"]],
        ["T03", "applied", 2, 1, ["intended"], []],
      ],
    );
    assert.match(
      readFileSync(join(runDir, "SUMMARY.md"), "utf8"),
      /Il ne note pas leur justesse/,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
    rmSync(qaDir, { recursive: true, force: true });
  }
});
