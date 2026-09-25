// Contrôle navigateur de R5.3 sur une copie du lot R4-S02 (Q01, Chloé) :
// répondre à une question, voir la lecture visée passer « à réexaminer »,
// puis inspecter la révision produite dans l'historique de la lecture.
//   node scripts/ui-check-r5-3.mjs
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
const directory = mkdtempSync(join(tmpdir(), "manwe-ui-r53-"));
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
    viewport: { width: 1300, height: 1200 },
  });
  await page.goto("http://127.0.0.1:5180");
  await page.getByRole("button", { name: /Mon espace/ }).click();
  await page.getByRole("button", { name: /Mémoire personnelle/ }).click();
  await page.waitForSelector(".lieu");
  await page
    .getByRole("button", { name: "Mémoire", exact: true })
    .first()
    .click();
  const question = page.locator(".personal-question").first();
  await question.waitFor();
  const asked = await question.locator("p").first().textContent();
  await question
    .locator("textarea")
    .fill(
      "Je l'ai pris comme normal, elle était vraiment débordée ce mois-là.",
    );
  await question.getByRole("button", { name: "Répondre" }).click();
  await pause(1500);
  assert.equal(
    await page.locator(".personal-question p", { hasText: asked }).count(),
    0,
    "la question répondue n'est plus ouverte",
  );
  const reviewed = page.locator(".personal-hypothesis", {
    has: page.getByRole("button", { name: "Préparer la réanalyse" }),
  });
  assert.ok(
    (await reviewed.count()) >= 1,
    "une lecture visée est à réexaminer",
  );
  const history = reviewed.first().locator(".personal-hypothesis-history");
  await history.locator("summary").click();
  assert.match(
    await history.innerText(),
    /réponse à une question/,
    "révision inspectable",
  );
  console.log(
    `R5.3 vérifié : question répondue, ${await reviewed.count()} lecture(s) à réexaminer, révision visible dans l'historique.`,
  );
} finally {
  await browser.close();
  server.kill();
  process.kill(-vite.pid);
  rmSync(directory, { recursive: true, force: true });
}
