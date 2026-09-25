// Contrôle navigateur du lieu (BRIEF-007), avec un fournisseur simulé
// (gratuit, sans donnée réelle) :
//   node scripts/ui-check-lieu.mjs
// 1. L'application s'ouvre sur la mémoire locale ; le consentement est
//    demandé une fois ; la conversation s'ouvre d'elle-même.
// 2. Un message devient une note ; l'agent répond par une question.
// 3. Sans aucun clic de plus, l'agent analyse et applique : la personne
//    décrite sans nom (« la femme d'un ami ») apparaît dans le graphe.
// 4. Un rechargement ne perd ni la conversation ni l'état de l'agent.
// 5. Le journal accumule une entrée ; aucun écran ne propose de choisir une
//    tâche d'analyse ni de confirmer une application.
import { spawn, execSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
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

const quote = (source, text) => {
  const start = source.text.indexOf(text);
  return {
    sourceId: source.sourceId,
    contentHash: source.contentHash,
    spanStart: start,
    spanEnd: start + text.length,
    quote: text,
  };
};

const fake = createServer((request, response) => {
  let body = "";
  request.on("data", (chunk) => (body += chunk));
  request.on("end", () => {
    const prompt = JSON.parse(body).messages[0].content;
    let content;
    if (prompt.startsWith("Tu es la voix de MANWË")) {
      const state = JSON.parse(
        prompt.slice(prompt.lastIndexOf('\n{\n  "memory"')),
      );
      content = state.conversation.length
        ? {
            reply:
              "Merci de raconter ce dîner. Qu'est-ce qui vous a marqué dans la façon dont elle vous a posé ces questions ?",
            gap: "episode",
            motive: [],
          }
        : {
            reply:
              "Bonsoir, je suis là pour vous écouter. Qu'avez-vous envie de raconter aujourd'hui ?",
            gap: "ouverture",
            motive: [],
          };
    } else {
      const packet = JSON.parse(prompt.slice(prompt.lastIndexOf("\n\n{") + 2));
      const source = packet.sources.find((item) =>
        item.text.includes("la femme d'un ami"),
      );
      content = {
        schemaVersion: "1.8",
        requestId: packet.requestId,
        workspaceId: packet.workspaceId,
        baseRevision: packet.baseRevision,
        contextHash: packet.contextHash,
        modelDeclaration: {
          declaredModel: "simulé",
          role: "contrôle",
          technicalId: null,
        },
        outcome: source ? "proposed" : "no_change",
        operations: source
          ? [
              {
                key: "p1",
                kind: "propose_person",
                payload: {
                  mention: "Paul",
                  relatedTo: null,
                  relationLabel: null,
                  citations: [quote(source, "Paul")],
                },
                rationale: "Nommé.",
              },
              {
                key: "p2",
                kind: "propose_person",
                payload: {
                  mention: "la femme d'un ami",
                  relatedTo: { mention: "Paul" },
                  relationLabel: "conjointe",
                  citations: [quote(source, "la femme d'un ami")],
                },
                rationale: "Décrite par sa relation.",
              },
            ]
          : [],
        clarifications: [],
        summary: "Personnes citées.",
      };
    }
    response.writeHead(200, { "content-type": "application/json" });
    response.end(
      JSON.stringify({
        model: "simulé",
        usage: { total_tokens: 1 },
        choices: [
          {
            finish_reason: "stop",
            message: { content: JSON.stringify(content) },
          },
        ],
      }),
    );
  });
});
await new Promise((done) => fake.listen(0, "127.0.0.1", done));

const directory = mkdtempSync(join(tmpdir(), "manwe-ui-lieu-"));
const env = {
  ...process.env,
  LOCALAPPDATA: directory,
  MANWE_DATABASE_PATH: join(directory, "memory.sqlite3"),
  MANWE_ANALYST_PROVIDER: "deepseek",
  MANWE_AGENT_QUIET_MS: "500",
  DEEPSEEK_BASE_URL: `http://127.0.0.1:${fake.address().port}`,
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
    viewport: { width: 1440, height: 1000 },
  });
  await page.goto("http://127.0.0.1:5180");
  // 1. Mémoire locale d'emblée, consentement une fois, ouverture.
  await page.waitForSelector(".lieu");
  assert.ok(
    await page.getByText("Mémoire locale").first().isVisible(),
    "ouverture sur la mémoire locale",
  );
  await page.getByRole("button", { name: "J’accepte" }).click();
  await page.waitForSelector(".lieu-turn.is-agent:not(.is-thinking)");
  assert.match(
    await page
      .locator(".lieu-turn.is-agent:not(.is-thinking)")
      .first()
      .innerText(),
    /je suis là pour vous écouter/,
  );

  // 2. Un message fictif devient une note ; l'agent répond.
  await page
    .getByLabel("Écrire à MANWË")
    .fill(
      "Samedi, Paul est venu dîner avec la femme d'un ami ; elle m'a posé plein de questions.",
    );
  await page.keyboard.press("Enter");
  await page.waitForFunction(
    () =>
      document.querySelectorAll(".lieu-turn.is-agent:not(.is-thinking)")
        .length >= 2,
  );
  assert.equal(await page.locator(".lieu-turn.is-user").count(), 1);

  // 3. L'agent analyse seul ; la personne décrite apparaît dans le graphe.
  await page.waitForSelector(
    '.world-node[aria-label="personne : la femme d\'un ami"]',
    { timeout: 30_000 },
  );
  await page.waitForSelector(".lieu-activity.is-idle");
  assert.match(await page.locator(".lieu-activity").innerText(), /À jour/);
  await page.screenshot({ path: join(directory, "lieu.png") });

  // 4. Rechargement : rien n'est perdu.
  await page.reload();
  await page.waitForSelector(".lieu-turn.is-user");
  assert.equal(await page.locator(".lieu-turn.is-user").count(), 1);
  assert.match(await page.locator(".lieu-activity").innerText(), /À jour/);
  assert.equal(
    await page.getByRole("button", { name: "J’accepte" }).count(),
    0,
    "le consentement n'est demandé qu'une fois",
  );

  // 4 bis. D-030 : nommer la personne décrite ; le graphe suit.
  await page
    .getByRole("button", { name: "Personnes", exact: true })
    .first()
    .click();
  await page
    .locator(".person-card", { hasText: "la femme d'un ami" })
    .getByRole("button", { name: "La nommer" })
    .click();
  const card = page.locator(".person-card", { hasText: "la femme d'un ami" });
  await card.getByLabel("Nom").fill("Julie");
  await card.getByRole("button", { name: "Enregistrer" }).click();
  await page
    .locator(".person-card", { hasText: "Aussi appelée : la femme d'un ami" })
    .waitFor();
  await page
    .getByRole("button", { name: "Mon monde", exact: true })
    .first()
    .click();
  await page.waitForSelector('.world-node[aria-label="personne : Julie"]');

  // 5. Journal, et aucune mécanique exposée.
  await page.getByRole("tab", { name: /Journal/ }).click();
  await page
    .getByLabel("Écrire dans le journal")
    .fill("Dimanche, longue marche seul. Je repensais au dîner.");
  await page.getByRole("button", { name: "Déposer" }).click();
  await page.waitForSelector(".lieu-entries li:has-text('longue marche')");
  const text = await page.locator("body").innerText();
  for (const forbidden of [
    "Extraire les faits",
    "Appliquer cette proposition",
    "Interpréter",
  ])
    assert.ok(!text.includes(forbidden), `« ${forbidden} » ne s'affiche pas`);
  console.log(
    "Lieu vérifié : ouverture locale, consentement unique, conversation, analyse autonome (personne décrite dans le graphe), rechargement, personne nommée ensuite, journal.",
  );
} finally {
  await browser.close();
  server.kill();
  try {
    process.kill(-vite.pid);
  } catch {
    vite.kill();
  }
  fake.close();
  rmSync(directory, { recursive: true, force: true });
}
