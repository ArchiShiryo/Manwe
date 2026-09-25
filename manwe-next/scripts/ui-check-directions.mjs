// Contrôle navigateur des directions et de la boucle d'action (BRIEF-005),
// sur une copie du scénario D02 du lot R5-S01.
//   node scripts/ui-check-directions.mjs
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { copyFileSync } from "node:fs";
const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require("playwright"));
} catch {
  const globalRoot = execSync("npm root -g").toString().trim();
  ({ chromium } = createRequire(`${globalRoot}/`)("playwright"));
}
const SP = mkdtempSync(join(tmpdir(), "manwe-ui-directions-"));
copyFileSync(
  "packages/evaluation/runs/2026-09-25-deepseek-flash-r5-s01/D02/final.sqlite3",
  SP + "/d02.sqlite3",
);
const env = {
  ...process.env,
  LOCALAPPDATA: SP,
  MANWE_DATABASE_PATH: SP + "/d02.sqlite3",
  MANWE_WORKSPACE_ID: "evaluation-2026-09-25-deepseek-flash-r5-s01-D02",
};
const server = spawn(process.execPath, ["apps/server/src/main.ts"], {
  env,
  stdio: "ignore",
});
const vite = spawn(
  "npx",
  ["vite", "--host", "127.0.0.1", "--port", "5180", "--strictPort"],
  { stdio: "ignore", detached: true },
);
await new Promise((r) => setTimeout(r, 5000));
const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1300, height: 1400 },
  });
  page.on(
    "console",
    (m) => m.type() === "error" && console.log("console:", m.text()),
  );
  await page.goto("http://127.0.0.1:5180");
  await page.getByRole("button", { name: /Mon espace/ }).click();
  await page.getByRole("button", { name: /Mémoire personnelle/ }).click();
  await page.waitForSelector(".personal-world");
  await page
    .getByRole("button", { name: "Intentions", exact: true })
    .first()
    .click();
  await page.waitForSelector(".direction-card");
  assert.equal(
    await page.locator(".direction-card").count(),
    3,
    "deux directions et « ne rien entreprendre »",
  );
  const first = page
    .locator(".direction-card")
    .filter({
      has: page.getByRole("button", { name: "Choisir cette direction" }),
    })
    .first();
  await first
    .locator("textarea")
    .fill("Je pense qu'elle va être froide quelques jours.");
  await first.getByRole("button", { name: "Choisir cette direction" }).click();
  await page.waitForSelector(".direction-outcome");
  const outcome = page.locator(".direction-outcome");
  await outcome
    .locator("textarea")
    .fill(
      "J'ai ajouté la ligne d'attribution ; Inès a demandé à être en copie, puis n'a plus repris le tableau.",
    );
  await outcome.locator("select").first().selectOption("confirmed");
  await outcome.getByRole("button", { name: "Consigner le résultat" }).click();
  await page.waitForTimeout(1500);
  const text = await page.locator(".direction-action").first().innerText();
  assert.match(text, /ATTENTE FIGÉE/);
  assert.match(text, /Votre attente : Je pense/);
  assert.match(text, /Résultat : J'ai ajouté/);
  assert.match(text, /confirmée/);
  console.log(
    "Directions vérifiées : affichage, choix avec attente figée, résultat et verdict.",
  );
} finally {
  await browser.close();
  server.kill();
  process.kill(-vite.pid);
  rmSync(SP, { recursive: true, force: true });
}
