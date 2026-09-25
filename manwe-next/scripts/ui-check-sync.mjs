// Contrôle navigateur de la resynchronisation (R4.7), sur une copie des
// données réelles du lot R4-S02. Nécessite Playwright (global ou local) et
// Chromium ; rien n'est écrit dans le dépôt.
//   node scripts/ui-check-sync.mjs
// Vérifie : une écriture d'un autre onglet apparaît sans recharger ; une
// coupure du service est affichée ; une écriture faite pendant la coupure
// est récupérée à la reconnexion (révision et synthèse du graphe).
import { spawn, execSync } from "node:child_process";
import { copyFileSync, mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require("playwright"));
} catch {
  const globalRoot = execSync("npm root -g").toString().trim();
  ({ chromium } = createRequire(`${globalRoot}/`)("playwright"));
}

const RUN = "2026-09-25-deepseek-flash-r4-s02";
const directory = mkdtempSync(join(tmpdir(), "manwe-ui-sync-"));
const database = join(directory, "ui.sqlite3");
copyFileSync(
  join("packages/evaluation/runs", RUN, "Q01/final.sqlite3"),
  database,
);
const env = {
  ...process.env,
  LOCALAPPDATA: directory,
  MANWE_DATABASE_PATH: database,
  MANWE_WORKSPACE_ID: `evaluation-${RUN}-Q01`,
};
const pause = (ms) => new Promise((done) => setTimeout(done, ms));
const startServer = () =>
  spawn(process.execPath, ["apps/server/src/main.ts"], {
    env,
    stdio: "ignore",
  });
let server = startServer();
const vite = spawn(
  "npx",
  ["vite", "--host", "127.0.0.1", "--port", "5180", "--strictPort"],
  { stdio: "ignore", detached: true },
);
const browser = await chromium.launch();
try {
  await pause(5000);
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:5180");
  await page.getByRole("button", { name: /Mon espace/ }).click();
  await page.getByRole("button", { name: /Mémoire personnelle/ }).click();
  await page.waitForSelector(".world-graph-canvas");
  const status = () => page.locator(".personal-status-row").textContent();
  const other = await context.newPage();
  await other.goto("http://127.0.0.1:5180");
  const capture = (text) =>
    other.evaluate(async (text) => {
      await fetch("http://127.0.0.1:5181/api/session", {
        method: "POST",
        credentials: "include",
      });
      const response = await fetch("http://127.0.0.1:5181/api/captures", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          idempotencyKey: `capture:${crypto.randomUUID()}`,
          text,
        }),
      });
      return response.status;
    }, text);
  const initial = await status();
  assert.match(initial, /Révision 05/);
  assert.equal(await capture("Note écrite depuis un autre onglet."), 201);
  await pause(6000);
  assert.match(await status(), /Révision 06/, "autre onglet synchronisé");
  server.kill();
  await pause(6000);
  assert.match(await status(), /reconnexion/, "coupure affichée");
  server = startServer();
  await pause(1500);
  assert.equal(await capture("Note manquée pendant la coupure."), 201);
  await pause(6000);
  assert.match(await status(), /disponible.*Révision 07/, "resynchronisé");
  assert.match(
    await page.locator(".world-synthesis .eyebrow").first().textContent(),
    /RÉVISION 07/,
    "graphe et synthèse resynchronisés",
  );
  console.log(
    "Resynchronisation vérifiée : 05 → 06 (autre onglet) → coupure → 07.",
  );
} finally {
  await browser.close();
  server.kill();
  process.kill(-vite.pid);
  rmSync(directory, { recursive: true, force: true });
}
