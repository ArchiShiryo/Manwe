// Contrôle navigateur du critère de passage de R4, sur une copie des données
// réelles du lot R4-S02 (scénario Q03 : deux personnes, deux relations).
//   node scripts/ui-check-r4.mjs
// 1. Changer de personne ne laisse aucun texte de la personne précédente.
// 2. Une correction faite depuis le graphe est visible de façon cohérente :
//    nœud du graphe, « Pourquoi ? », synthèse et page Mémoire.
// (Le troisième point, la resynchronisation, est couvert par ui-check-sync.mjs.)
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
const SCENARIO = "Q03";
const directory = mkdtempSync(join(tmpdir(), "manwe-ui-r4-"));
const database = join(directory, "ui.sqlite3");
copyFileSync(
  join("packages/evaluation/runs", RUN, SCENARIO, "final.sqlite3"),
  database,
);
const env = {
  ...process.env,
  LOCALAPPDATA: directory,
  MANWE_DATABASE_PATH: database,
  MANWE_WORKSPACE_ID: `evaluation-${RUN}-${SCENARIO}`,
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
  await page.waitForSelector(".world-graph-canvas");
  const graph = page.locator(".world-graph");
  const labels = () =>
    page
      .locator(".world-node")
      .evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute("aria-label")),
      );
  const readings = async () =>
    (await labels())
      .filter((label) => label.startsWith("lecture : "))
      .map((label) => label.slice("lecture : ".length));

  // 1. Changement de personne.
  const shortcuts = page.getByRole("group", { name: "Centrer le graphe" });
  const names = (await shortcuts.getByRole("button").allTextContents()).filter(
    (name) => name !== "Vous",
  );
  assert.ok(names.length >= 2, "au moins deux personnes");
  await shortcuts.getByRole("button", { name: names[0], exact: true }).click();
  await pause(900);
  const first = await readings();
  assert.ok(first.length > 0, `lectures sur ${names[0]}`);
  await page.locator(".world-node-hypothesis").first().click();
  await pause(900);
  await shortcuts.getByRole("button", { name: names[1], exact: true }).click();
  await pause(900);
  const second = await readings();
  const onlyFirst = first.filter((statement) => !second.includes(statement));
  const visible = `${await graph.innerText()}\n${(await labels()).join("\n")}`;
  for (const statement of onlyFirst)
    assert.ok(
      !visible.includes(statement.slice(0, 40)),
      `texte de ${names[0]} resté affiché : ${statement.slice(0, 60)}`,
    );
  console.log(
    `1. ${names[0]} → ${names[1]} : ${onlyFirst.length} lecture(s) propre(s) à ${names[0]}, aucune ne reste affichée.`,
  );

  // 2. Correction depuis le graphe.
  await page.locator(".world-node-hypothesis").first().click();
  await pause(900);
  const claimNode = page
    .locator(".world-node-claim:not(.is-contested)")
    .first();
  const claimText = (await claimNode.getAttribute("aria-label")).slice(
    "élément : ".length,
  );
  const hypothesisLabel = await page
    .locator(".world-node-hypothesis.is-focus")
    .getAttribute("aria-label");
  const factsBefore = await page.locator(".world-synthesis").innerText();
  await claimNode.click();
  await page.getByRole("button", { name: "Corriger", exact: true }).click();
  await page
    .getByLabel("Votre correction")
    .fill("Ce n'est pas ce qui s'est passé : je corrige ce point.");
  await page.getByRole("button", { name: "Conserver", exact: true }).click();
  await pause(1500);
  assert.ok(
    (await page.locator(".world-node-claim.is-contested").count()) >= 1,
    "nœud marqué corrigé",
  );
  await page.locator(".world-node-hypothesis.is-focus").click();
  await page.getByRole("button", { name: "Pourquoi ?" }).click();
  const why = await page.locator(".world-graph-why").innerText();
  assert.ok(
    why.toLowerCase().includes("corrigé par vous"),
    "« Pourquoi ? » signale la correction",
  );
  const synthesis = await page.locator(".world-synthesis").innerText();
  const established = (synthesis.split("Ce qui est établi")[1] ?? "").split(
    /Ce qui ne colle pas|Ce qui reste ouvert/,
  )[0];
  assert.ok(
    !established.includes(claimText),
    "la synthèse ne présente plus l'élément corrigé comme établi",
  );
  await page
    .getByRole("button", { name: "Mémoire", exact: true })
    .first()
    .click();
  await pause(900);
  const memoryClaim = page
    .locator(".personal-claim", { hasText: claimText })
    .first();
  assert.match(
    await memoryClaim.innerText(),
    /corrigé par vous/,
    "la page Mémoire signale la correction",
  );
  console.log(
    `2. Correction de « ${claimText.slice(0, 50)}… » visible dans le graphe, « Pourquoi ? », la synthèse (${factsBefore.includes(claimText) ? "retirée des faits établis" : "absente des faits établis"}) et la page Mémoire. Lecture : ${hypothesisLabel.slice("lecture : ".length, 60)}…`,
  );
} finally {
  await browser.close();
  server.kill();
  process.kill(-vite.pid);
  rmSync(directory, { recursive: true, force: true });
}
