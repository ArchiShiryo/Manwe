// Contrôle navigateur de R5.4 : un objectif proposé par l'analyse s'affiche
// avec son problème et ses citations, se reformule et s'adopte ; il devient
// alors l'intention courante. Base fictive créée pour l'occasion.
//   node scripts/ui-check-goal.mjs
import { spawn, execSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { SqliteMemoryStore } from "../packages/storage/src/sqliteStore.ts";

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require("playwright"));
} catch {
  const globalRoot = execSync("npm root -g").toString().trim();
  ({ chromium } = createRequire(`${globalRoot}/`)("playwright"));
}
const directory = mkdtempSync(join(tmpdir(), "manwe-ui-goal-"));
const database = join(directory, "memory.sqlite3");
const store = new SqliteMemoryStore(database, "personal");
store.capture({
  idempotencyKey: "ui-goal:capture:1",
  text: "J'en ai marre de tout porter pour la coloc, je voudrais que ça tourne sans que je sois le seul à tout gérer.",
});
const packet = store.prepareAnalysis({ task: "interpret" });
const source = packet.sources[0];
const preview = store.receiveAnalysis({
  schemaVersion: "1.6",
  requestId: packet.requestId,
  workspaceId: packet.workspaceId,
  baseRevision: packet.baseRevision,
  contextHash: packet.contextHash,
  modelDeclaration: {
    declaredModel: "contrôle",
    role: "analyst",
    technicalId: null,
  },
  outcome: "proposed",
  operations: [
    {
      key: "g1",
      kind: "propose_goal",
      payload: {
        problem: "Vous portez seul la charge de la colocation.",
        goal: "Que la coloc tourne sans être le seul à tout gérer",
        citations: [
          {
            sourceId: source.sourceId,
            contentHash: source.contentHash,
            spanStart: 0,
            spanEnd: source.text.length,
            quote: source.text,
          },
        ],
      },
      rationale: "Souhait exprimé.",
    },
  ],
  clarifications: [],
  summary: "Un objectif proposé.",
});
store.applyAnalysis(preview.responseId);
store.close();

const env = {
  ...process.env,
  LOCALAPPDATA: directory,
  MANWE_DATABASE_PATH: database,
};
const pause = (ms) => new Promise((done) => setTimeout(done, ms));
const server = spawn(process.execPath, ["apps/server/src/main.ts"], {
  env,
  stdio: "ignore",
});
const vite = spawn(
  "npx",
  ["vite", "--host", "127.0.0.1", "--port", "5180", "--strictPort"],
  {
    stdio: "ignore",
    detached: true,
  },
);
const browser = await chromium.launch();
try {
  await pause(5000);
  const page = await browser.newPage({
    viewport: { width: 1300, height: 1100 },
  });
  await page.goto("http://127.0.0.1:5180");
  await page.getByRole("button", { name: /Mon espace/ }).click();
  await page.getByRole("button", { name: /Mémoire personnelle/ }).click();
  await page.waitForSelector(".lieu");
  await page
    .getByRole("button", { name: "Intentions", exact: true })
    .first()
    .click();
  const card = page.locator(".goal-suggestion");
  await card.waitFor();
  const text = await card.innerText();
  assert.match(text, /Problème : Vous portez seul/);
  assert.match(text, /« J'en ai marre/);
  assert.match(
    await page.locator(".personal-goal h2").innerText(),
    /Aucune direction formulée/,
    "pas adopté sans vous",
  );
  await card.getByRole("button", { name: "Reformuler" }).click();
  await card
    .locator("textarea")
    .fill("Partager les tâches de la coloc sans conflit");
  await card.getByRole("button", { name: "Adopter cette formulation" }).click();
  await pause(1500);
  assert.equal(
    await page.locator(".goal-suggestion").count(),
    0,
    "proposition adoptée",
  );
  assert.match(
    await page.locator(".personal-goal h2").innerText(),
    /Partager les tâches de la coloc sans conflit/,
  );
  console.log(
    "R5.4 vérifié : proposition affichée, reformulée et adoptée comme intention courante.",
  );
} finally {
  await browser.close();
  server.kill();
  process.kill(-vite.pid);
  rmSync(directory, { recursive: true, force: true });
}
