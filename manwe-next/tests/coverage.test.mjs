import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  DEFAULT_AGENT_MISSION,
  SqliteMemoryStore,
} from "../packages/storage/src/sqliteStore.ts";
import { Interviewer } from "../apps/server/src/interviewer.ts";

// D-032 : l'agent cartographie. Objectif de départ, plan de couverture pour
// l'utilisateur et chaque personne, profil tiré de ses seuls mots.

test("D-032 · objectif de départ, plan de couverture et profil cité", async () => {
  const directory = mkdtempSync(join(tmpdir(), "manwe-coverage-"));
  const store = new SqliteMemoryStore(join(directory, "m.sqlite3"), "cv");
  store.setSetting("transmission_consent", "granted");
  try {
    // Bootloader : l'objectif de départ est de cartographier ; il se change.
    assert.equal(store.agentMission, DEFAULT_AGENT_MISSION);
    assert.match(store.agentMission, /Cartographier/);
    store.setAgentMission("Comprendre ce qui se joue au travail.");
    assert.equal(store.agentMission, "Comprendre ce qui se joue au travail.");
    store.setAgentMission(null);
    assert.equal(store.agentMission, DEFAULT_AGENT_MISSION);

    // Espace vide : tout est inconnu, et le premier creux vous concerne.
    let plan = store.coveragePlan();
    assert.equal(plan.score, 0);
    assert.equal(plan.actors[0].kind, "self");
    assert.equal(plan.gaps[0].actorId, "self");
    assert.match(plan.gaps[0].key, /^profil:/);

    // L'agent relève l'âge dans le message, avec les mots exacts ; une
    // valeur sans citation exacte est ignorée.
    const prompts = [];
    const interviewer = new Interviewer(store, {
      id: "deepseek:test",
      model: "test",
      call: async ({ prompt }) => {
        prompts.push(prompt);
        return {
          content: JSON.stringify({
            reply: "Merci. Avec qui vivez-vous en ce moment ?",
            gap: "milieu",
            motive: [],
            action: null,
            profile: [
              { field: "age", value: "34 ans", quote: "j'ai 34 ans" },
              {
                field: "situation",
                value: "infirmier",
                quote: "je suis infirmier",
              },
            ],
          }),
          meta: { latencyMs: 1, usage: null, servedModel: "test" },
        };
      },
    });
    interviewer.say(
      "cv:msg:0001",
      "Bonjour, j'ai 34 ans et je travaille de nuit.",
    );
    await interviewer.settle();
    assert.match(prompts[0], /"mission": "Cartographier/);
    assert.match(prompts[0], /"gaps"/);
    const profile = store.selfProfile();
    assert.equal(profile.length, 1, "la situation inventée est écartée");
    assert.equal(profile[0].field, "age");
    assert.equal(profile[0].quote, "j'ai 34 ans");
    plan = store.coveragePlan();
    assert.ok(plan.score > 0);
    assert.ok(
      plan.actors[0].items.find((item) => item.key === "profil:age").known,
    );
  } finally {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
