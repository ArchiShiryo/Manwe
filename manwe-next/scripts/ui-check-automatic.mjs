// Contrôle navigateur du parcours d'analyse automatique (IA-A.2).
//   node scripts/ui-check-automatic.mjs          fournisseur DeepSeek simulé (gratuit)
//   node scripts/ui-check-automatic.mjs --real   UN appel réel à DeepSeek (coût minime)
// Parcours : note fictive → consentement → analyse → aperçu → application
// → la mémoire contient les claims proposés. Rien n'est écrit dans le dépôt.
import { spawn, execSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";

const real = process.argv.includes("--real");
const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require("playwright"));
} catch {
  const globalRoot = execSync("npm root -g").toString().trim();
  ({ chromium } = createRequire(`${globalRoot}/`)("playwright"));
}

// Fournisseur simulé : renvoie une proposition valide construite sur le paquet.
let fake = null;
if (!real) {
  fake = createServer((request, response) => {
    let body = "";
    request.on("data", (chunk) => (body += chunk));
    request.on("end", () => {
      const prompt = JSON.parse(body).messages[0].content;
      const packet = JSON.parse(prompt.slice(prompt.lastIndexOf("\n\n{") + 2));
      const source = packet.sources[0];
      const proposal = {
        schemaVersion: "1.4",
        requestId: packet.requestId,
        workspaceId: packet.workspaceId,
        baseRevision: packet.baseRevision,
        contextHash: packet.contextHash,
        modelDeclaration: {
          declaredModel: "simulé",
          role: "contrôle",
          technicalId: null,
        },
        outcome: "proposed",
        operations: [
          {
            key: "c1",
            kind: "propose_claim",
            payload: {
              text: "Léon a annulé le déjeuner prévu.",
              category: "reported_observation",
              modality: "actual",
              validFrom: null,
              validTo: null,
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
            rationale: "Rapporté par l'utilisateur.",
          },
        ],
        clarifications: [],
        summary: "Un fait rapporté.",
      };
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          model: "simulé",
          usage: { total_tokens: 1 },
          choices: [
            {
              finish_reason: "stop",
              message: { content: JSON.stringify(proposal) },
            },
          ],
        }),
      );
    });
  });
  await new Promise((done) => fake.listen(0, "127.0.0.1", done));
}

const directory = mkdtempSync(join(tmpdir(), "manwe-ui-auto-"));
const env = {
  ...process.env,
  LOCALAPPDATA: directory,
  MANWE_DATABASE_PATH: join(directory, "memory.sqlite3"),
  MANWE_ANALYST_PROVIDER: "deepseek",
  ...(real
    ? { NODE_USE_ENV_PROXY: "1" }
    : { DEEPSEEK_BASE_URL: `http://127.0.0.1:${fake.address().port}` }),
};
const pause = (ms) => new Promise((done) => setTimeout(done, ms));
const server = spawn(process.execPath, ["apps/server/src/main.ts"], {
  env,
  stdio: "ignore",
});
const vite = spawn(
  "npx",
  ["vite", "--host", "127.0.0.1", "--port", "5180", "--strictPort"],
  { stdio: "ignore", detached: true },
);
const browser = await chromium.launch();
try {
  await pause(5000);
  const page = await browser.newPage({
    viewport: { width: 1300, height: 1000 },
  });
  await page.goto("http://127.0.0.1:5180");
  await page.getByRole("button", { name: /Mon espace/ }).click();
  await page.getByRole("button", { name: /Mémoire personnelle/ }).click();
  await page.waitForSelector(".personal-world");
  // Note fictive, sans donnée réelle.
  await page.evaluate(async () => {
    await fetch("http://127.0.0.1:5181/api/session", {
      method: "POST",
      credentials: "include",
    });
    await fetch("http://127.0.0.1:5181/api/captures", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        idempotencyKey: `capture:${crypto.randomUUID()}`,
        text: "Mardi, Léon a annulé le déjeuner prévu une heure avant, en disant qu'il était débordé. C'est la troisième fois ce mois-ci.",
      }),
    });
  });
  await pause(5000);
  await page
    .getByRole("button", { name: "Mémoire", exact: true })
    .first()
    .click();
  const panel = page.locator(".automatic-analysis");
  await panel.waitFor();
  const launch = panel.getByRole("button", { name: "Lancer l’analyse" });
  assert.equal(await launch.isDisabled(), true, "consentement exigé");
  await panel.getByRole("checkbox").check();
  await launch.click();
  await panel.locator(".automatic-running").waitFor();
  console.log(
    "En cours :",
    await panel.locator(".automatic-running span").textContent(),
  );
  await panel
    .locator(".analysis-preview, .analysis-error")
    .first()
    .waitFor({ timeout: 11 * 60 * 1000 });
  if (await panel.locator(".analysis-error").count()) {
    console.log(
      "Erreur affichée :",
      await panel.locator(".analysis-error").first().textContent(),
    );
    process.exitCode = 1;
  } else {
    console.log(
      "Aperçu :",
      (await panel.locator(".analysis-preview").innerText()).slice(0, 600),
    );
    await panel
      .getByRole("button", { name: "Appliquer cette proposition" })
      .click();
    await pause(1500);
    const claims = await page.locator(".personal-claim").allTextContents();
    assert.ok(claims.length > 0, "claims appliqués et visibles");
    console.log(`Appliqué : ${claims.length} élément(s) dans la page Mémoire.`);
  }
} finally {
  await browser.close();
  server.kill();
  process.kill(-vite.pid);
  fake?.close();
  rmSync(directory, { recursive: true, force: true });
}
