import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  parseCaptureCommand,
  parseGoalCommand,
} from "../packages/domain/src/memory.ts";
import { SqliteMemoryStore } from "../packages/storage/src/sqliteStore.ts";

// D-028 : l'agent choisit seul la prochaine analyse, et s'arrête quand il
// n'y a rien de nouveau.

test("D-028 · l'agent interprète les nouvelles notes, puis explore une intention sans piste", () => {
  const directory = mkdtempSync(join(tmpdir(), "manwe-agent-"));
  const store = new SqliteMemoryStore(join(directory, "m.sqlite3"), "a");
  try {
    assert.equal(store.agentPlan(), null, "espace vide : rien à faire");
    store.capture(
      parseCaptureCommand({
        idempotencyKey: "a:capture:1",
        text: "Nora m'a proposé un café ; j'ai dit non, trop fatigué.",
      }),
    );
    const plan = store.agentPlan();
    assert.equal(plan.task, "interpret");
    assert.match(plan.reason, /1 nouvelle note/);
    assert.ok(plan.focus.some((ref) => ref.kind === "event"));

    // Une analyse close sans changement suffit : la note est lue.
    const packet = store.prepareAnalysis({
      task: plan.task,
      focus: plan.focus,
    });
    const preview = store.receiveAnalysis({
      schemaVersion: "1.8",
      requestId: packet.requestId,
      workspaceId: packet.workspaceId,
      baseRevision: packet.baseRevision,
      contextHash: packet.contextHash,
      modelDeclaration: {
        declaredModel: "Test",
        role: "analyst",
        technicalId: null,
      },
      outcome: "no_change",
      operations: [],
      clarifications: [],
      summary: "Rien à ajouter.",
    });
    store.applyAnalysis(preview.responseId);
    assert.equal(store.agentPlan(), null, "rien de nouveau depuis");

    store.updateGoal(
      parseGoalCommand({
        idempotencyKey: "a:goal:1",
        text: "Revoir mes amis sans m'épuiser.",
      }),
    );
    const explore = store.agentPlan();
    assert.equal(explore?.task, "explore");
  } finally {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
