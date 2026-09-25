import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SqliteMemoryStore } from "../packages/storage/src/sqliteStore.ts";
import { Interviewer } from "../apps/server/src/interviewer.ts";

// R5.8 · la conversation du lieu : un message devient une note, l'agent
// répond par une seule question motivée par la mémoire.

test("R5.8 · un message devient une note et l'agent répond par une question motivée", async () => {
  const directory = mkdtempSync(join(tmpdir(), "manwe-conversation-"));
  const store = new SqliteMemoryStore(join(directory, "m.sqlite3"), "c");
  store.setSetting("transmission_consent", "granted");
  const prompts = [];
  let answer = null;
  const interviewer = new Interviewer(store, {
    id: "deepseek:test",
    model: "test",
    call: async ({ prompt }) => {
      prompts.push(prompt);
      return {
        content: JSON.stringify(answer(prompt)),
        meta: { latencyMs: 1, usage: null, servedModel: "test" },
      };
    },
  });
  try {
    // Ouverture : l'agent se présente.
    answer = () => ({
      reply:
        "Bonjour, je suis là pour vous écouter. Qu'avez-vous envie de raconter ?",
      gap: "ouverture",
      motive: [],
    });
    interviewer.open();
    await interviewer.settle();
    let state = interviewer.state();
    assert.equal(state.turns.length, 1);
    assert.equal(state.turns[0].role, "agent");
    assert.equal(state.turns[0].gap, "ouverture");

    // La personne parle : sa parole devient une note citable.
    answer = (prompt) => {
      const memory = JSON.parse(
        prompt.slice(prompt.lastIndexOf('\n{\n  "memory"')),
      ).memory;
      return {
        reply:
          "Vous avez dîné avec Paul. Comment s'était passé votre dernier échange avec lui ?",
        gap: "personne",
        motive: [
          { kind: "person", id: "inconnue" },
          ...memory.persons.map((person) => ({
            kind: "person",
            id: person.id,
          })),
        ],
      };
    };
    interviewer.say(
      "conv:msg:0001",
      "Samedi j'ai dîné avec Paul, c'était tendu.",
    );
    await interviewer.settle();
    state = interviewer.state();
    assert.equal(state.turns.length, 3);
    const said = state.turns[1];
    assert.equal(said.role, "user");
    assert.ok(said.sourceId, "le message est une note");
    const source = store
      .snapshot()
      .sources.find((item) => item.id === said.sourceId);
    assert.equal(source.content, "Samedi j'ai dîné avec Paul, c'était tendu.");
    assert.match(prompts[1], /Samedi j'ai dîné avec Paul/);
    const question = state.turns[2];
    assert.equal(question.role, "agent");
    assert.equal(question.gap, "personne");
    assert.ok(
      question.motive.every((ref) => ref.id !== "inconnue"),
      "un motif inexistant est écarté",
    );
    // Le même message, rejoué, ne crée ni doublon de note ni de tour.
    interviewer.say(
      "conv:msg:0001",
      "Samedi j'ai dîné avec Paul, c'était tendu.",
    );
    await interviewer.settle();
    assert.equal(store.snapshot().sources.length, 1);
    assert.equal(
      interviewer.state().turns.filter((t) => t.role === "user").length,
      1,
    );
  } finally {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
