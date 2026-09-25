import test from "node:test";
import { parseCaptureCommand } from "../packages/domain/src/memory.ts";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SqliteMemoryStore } from "../packages/storage/src/sqliteStore.ts";
import {
  AutomaticAnalyses,
  ProviderError,
  composePrompt,
  createDeepSeekCall,
} from "../apps/server/src/analystProvider.ts";

const PROMPT_V6 = readFileSync(
  new URL("../packages/cognition/prompts/analyst-v12.md", import.meta.url),
  "utf8",
);

function withStore(callback) {
  const directory = mkdtempSync(join(tmpdir(), "manwe-automatic-"));
  const store = new SqliteMemoryStore(
    join(directory, "memory.sqlite3"),
    "auto",
  );
  store.capture({
    idempotencyKey: "auto:capture:0001",
    text: "Claire a écrit : « Je préfère rester seule ce week-end. »",
  });
  return Promise.resolve(callback(store)).finally(() => {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  });
}

/** Réponse valide pour un paquet, comme la renverrait le modèle. */
function validProposal(packet) {
  const source = packet.sources[0];
  return JSON.stringify({
    schemaVersion: "1.4",
    requestId: packet.requestId,
    workspaceId: packet.workspaceId,
    baseRevision: packet.baseRevision,
    contextHash: packet.contextHash,
    modelDeclaration: {
      declaredModel: "DeepSeek V4.1-Flash",
      role: "analyse automatique",
      technicalId: "deepseek-flash",
    },
    outcome: "proposed",
    operations: [
      {
        key: "c1",
        kind: "propose_claim",
        payload: {
          text: "Claire préfère rester seule ce week-end.",
          category: "explicit_statement",
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
        rationale: "Citation directe.",
      },
    ],
    clarifications: [],
    summary: "Une déclaration explicite.",
  });
}

const packetOf = (prompt) =>
  JSON.parse(
    prompt
      .slice(PROMPT_V6.trimEnd().length)
      .split("\n\nTa réponse précédente")[0],
  );

const reply = (content) => ({
  content,
  reasoning: null,
  meta: {
    servedModel: "deepseek-flash",
    finishReason: "stop",
    usage: { total_tokens: 1234 },
    latencyMs: 5,
  },
});

test("IA-A.2 · même prompt que le harnais ; sans application automatique, rien n'est appliqué", () =>
  withStore(async (store) => {
    const prompts = [];
    const automatic = new AutomaticAnalyses(
      store,
      {
        id: "deepseek:test",
        model: "test",
        call: async ({ prompt }) => {
          prompts.push(prompt);
          return reply(validProposal(packetOf(prompt)));
        },
      },
      null,
      // Mode des évaluations scellées (IA-A.5) : confirmation explicite.
      { autoApply: false },
    );
    const revision = store.revision;
    const job = automatic.start({ task: "extract" });
    assert.equal(store.status().analyses.awaitingResponse, 1);
    assert.deepEqual(store.status().analyses.modes, ["automatic"]);
    const done = await automatic.settle(job.requestId);
    assert.equal(done.status, "ready_for_review");
    assert.equal(done.attempts.length, 1);
    assert.equal(done.preview.telemetry.inferenceDurationMs, 5);
    assert.ok(prompts[0].startsWith(PROMPT_V6.trimEnd()), "prompt v6 intact");
    const packet = packetOf(prompts[0]);
    assert.equal(prompts[0], composePrompt(packet), "composition du harnais");
    assert.equal(packet.requestId, job.requestId);
    assert.equal(
      store.revision,
      revision,
      "rien n'est appliqué sans confirmation",
    );
    const analysis = store.getAnalysis(job.requestId);
    assert.equal(analysis.responses.length, 1);
    const row = store.database
      .prepare(
        "SELECT verified_model, provider_usage_json, inference_duration_ms FROM analysis_responses WHERE id = ?",
      )
      .get(done.preview.responseId);
    assert.equal(row.verified_model, "deepseek-flash");
    assert.equal(JSON.parse(row.provider_usage_json).total_tokens, 1234);
    assert.equal(row.inference_duration_ms, 5);
    store.applyAnalysis(done.preview.responseId);
    assert.ok(store.revision > revision);
  }));

test("D-031 · reprises informées, puis échec explicite après trois rejets", () =>
  withStore(async (store) => {
    const prompts = [];
    let answers = ["pas du JSON", null];
    const automatic = new AutomaticAnalyses(store, {
      id: "deepseek:test",
      model: "test",
      call: async ({ prompt }) => {
        prompts.push(prompt);
        const next = answers.shift();
        return reply(next ?? validProposal(packetOf(prompt)));
      },
    });
    const first = await automatic.settle(
      automatic.start({ task: "extract" }).requestId,
    );
    // D-028 : une proposition valide s'applique d'elle-même.
    assert.equal(first.status, "applied");
    assert.ok(first.applied.revision > 0);
    assert.equal(first.attempts.length, 2);
    assert.match(prompts[1], /Ta réponse précédente à ce paquet a été rejetée/);
    assert.match(prompts[1], /invalid_json/);

    answers = ["{}", "{}", "{}"];
    prompts.length = 0;
    store.capture(
      parseCaptureCommand({
        idempotencyKey: "d031:capture",
        text: "Une autre note, pour une nouvelle analyse.",
      }),
    );
    const second = await automatic.settle(
      automatic.start({ task: "extract" }).requestId,
    );
    assert.equal(second.status, "failed");
    assert.equal(second.error.code, "proposal_rejected");
    assert.equal(prompts.length, 3, "deux reprises informées, pas plus");
    assert.equal(
      store.status().analyses.awaitingResponse,
      0,
      "plus rien « en cours »",
    );
  }));

test("IA-A.3 · erreur du fournisseur explicite, annulation et résultat tardif ignoré", () =>
  withStore(async (store) => {
    const failing = new AutomaticAnalyses(store, {
      id: "deepseek:test",
      model: "test",
      call: async () => {
        throw new ProviderError(
          "provider_quota",
          "Crédit du fournisseur épuisé.",
        );
      },
    });
    const failed = await failing.settle(
      failing.start({ task: "extract" }).requestId,
    );
    assert.equal(failed.status, "failed");
    assert.equal(failed.error.code, "provider_quota");
    assert.equal(store.getAnalysis(failed.requestId).status, "cancelled");

    let release;
    const slow = new AutomaticAnalyses(store, {
      id: "deepseek:test",
      model: "test",
      call: ({ prompt }) =>
        new Promise((done) => {
          release = () => done(reply(validProposal(packetOf(prompt))));
        }),
    });
    const job = slow.start({ task: "extract" });
    assert.throws(() => slow.start({ task: "extract" }), /déjà en cours/);
    slow.abort(job.requestId);
    store.cancelAnalysis(job.requestId);
    release();
    await new Promise((done) => setTimeout(done, 50));
    const after = slow.get(job.requestId);
    assert.equal(after.status, "cancelled");
    assert.equal(
      store.getAnalysis(job.requestId).responses.length,
      0,
      "résultat tardif ignoré",
    );
  }));

test("IA-A.3 · le client DeepSeek classe clé refusée, crédit, délai, réseau et reprise bornée", async () => {
  let mode = "ok";
  let hits = 0;
  const server = createServer((request, response) => {
    hits += 1;
    let body = "";
    request.on("data", (chunk) => (body += chunk));
    request.on("end", () => {
      if (mode === "auth") return response.writeHead(401).end("{}");
      if (mode === "quota") return response.writeHead(402).end("{}");
      if (mode === "hang") return; // jamais de réponse
      if (mode === "flaky" && hits === 1)
        return response.writeHead(503).end("{}");
      const parsed = JSON.parse(body);
      assert.equal(parsed.response_format.type, "json_object");
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          model: "deepseek-flash",
          usage: { total_tokens: 7 },
          choices: [
            {
              finish_reason: "stop",
              message: { content: '{"ok":true}', reasoning_content: "…" },
            },
          ],
        }),
      );
    });
  });
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  const endpoint = `http://127.0.0.1:${server.address().port}`;
  const call = (options = {}) =>
    createDeepSeekCall({
      endpoint,
      model: "deepseek-flash",
      backoffMs: 10,
      ...options,
    });
  const signal = new AbortController().signal;
  try {
    const ok = await call()({ prompt: "p", signal });
    assert.equal(ok.content, '{"ok":true}');
    assert.equal(ok.meta.usage.total_tokens, 7);
    for (const [name, code] of [
      ["auth", "provider_auth"],
      ["quota", "provider_quota"],
    ]) {
      mode = name;
      await assert.rejects(
        call()({ prompt: "p", signal }),
        (error) => error.code === code,
      );
    }
    mode = "flaky";
    hits = 0;
    const retried = await call({ transportRetries: 1 })({
      prompt: "p",
      signal,
    });
    assert.equal(retried.content, '{"ok":true}');
    assert.equal(hits, 2, "une reprise bornée");
    mode = "hang";
    await assert.rejects(
      call({ timeoutMs: 100 })({ prompt: "p", signal }),
      (error) => error.code === "provider_timeout",
    );
    const cancelled = new AbortController();
    const pending = call()({ prompt: "p", signal: cancelled.signal });
    cancelled.abort();
    await assert.rejects(
      pending,
      (error) => error.code === "analysis_cancelled",
    );
  } finally {
    server.closeAllConnections();
    await new Promise((done) => server.close(done));
  }
  await assert.rejects(
    createDeepSeekCall({ endpoint, model: "m", transportRetries: 0 })({
      prompt: "p",
      signal,
    }),
    (error) => error.code === "provider_unreachable",
  );
});

test("IA-A.2 · routes du service : désactivé par défaut, puis parcours automatique complet", async () => {
  const { startManweServer } = await import("../apps/server/src/server.ts");
  const uiOrigin = "http://127.0.0.1:5180";
  const directory = mkdtempSync(join(tmpdir(), "manwe-automatic-server-"));
  const open = async (analyst, agent = {}) => {
    const server = await startManweServer({
      databasePath: join(directory, "memory.sqlite3"),
      port: 0,
      allowedOrigin: uiOrigin,
      analyst,
      agent,
    });
    const cookie = (
      await fetch(`${server.origin}/api/session`, {
        method: "POST",
        headers: { origin: uiOrigin },
      })
    ).headers
      .get("set-cookie")
      .split(";", 1)[0];
    const call = (path, options = {}) =>
      fetch(`${server.origin}${path}`, {
        ...options,
        headers: {
          origin: uiOrigin,
          cookie,
          ...(options.body ? { "content-type": "application/json" } : {}),
        },
      });
    servers.push(server);
    return { server, call };
  };
  const servers = [];
  try {
    const off = await open(null);
    assert.deepEqual(await (await off.call("/api/analyses/automatic")).json(), {
      enabled: false,
      providerId: null,
      model: null,
      budget: null,
    });
    const refused = await off.call("/api/analyses/automatic", {
      method: "POST",
      body: JSON.stringify({ task: "extract" }),
    });
    assert.equal(refused.status, 503);
    assert.equal((await refused.json()).error.code, "provider_unconfigured");
    await off.call("/api/captures", {
      method: "POST",
      body: JSON.stringify({
        idempotencyKey: "auto:route:capture",
        text: "Claire a écrit : « Je préfère rester seule ce week-end. »",
      }),
    });
    await off.server.close();
    servers.length = 0;

    const on = await open(
      {
        id: "deepseek:test",
        model: "test",
        call: async ({ prompt }) => {
          const packet = packetOf(prompt);
          // Sans note nouvelle à citer, le modèle simulé ne change rien.
          if (packet.sources.length) return reply(validProposal(packet));
          return reply(
            JSON.stringify({
              ...JSON.parse(
                validProposal({ ...packet, sources: [{ text: "" }] }),
              ),
              outcome: "no_change",
              operations: [],
            }),
          );
        },
      },
      { quietMs: 30 },
    );
    const forged = await on.call("/api/analyses/automatic", {
      method: "POST",
      body: JSON.stringify({ task: "extract", providerId: "autre" }),
    });
    assert.equal(forged.status, 202, "providerId du client ignoré");
    const job = await forged.json();
    let state = job;
    for (let i = 0; i < 50 && state.status === "running"; i += 1) {
      await new Promise((done) => setTimeout(done, 20));
      state = await (
        await on.call(`/api/analyses/automatic/${job.requestId}`)
      ).json();
    }
    // D-028 : appliquée d'elle-même, sans confirmation.
    assert.equal(state.status, "applied");
    const analysis = await (
      await on.call(`/api/analyses/${job.requestId}`)
    ).json();
    assert.equal(analysis.packet.providerId, "deepseek:test");
    assert.equal(analysis.packet.mode, "automatic");
    assert.equal(analysis.promptVersion, "analyst-v12");
    assert.equal(analysis.status, "applied");
    // Après un rechargement, l'interface retrouve la dernière analyse.
    const current = await (
      await on.call("/api/analyses/automatic/current")
    ).json();
    assert.equal(current.job.requestId, job.requestId);
    assert.equal(
      current.next?.task,
      "interpret",
      "après les faits, l'agent prévoit de les comprendre",
    );

    // Sans consentement, rien ne part ; une fois donné, l'agent analyse
    // seul une nouvelle note, après un court silence.
    const consent = await on.call("/api/agent/consent", {
      method: "POST",
      body: JSON.stringify({ granted: true }),
    });
    assert.equal((await consent.json()).consent, true);
    await on.call("/api/captures", {
      method: "POST",
      body: JSON.stringify({
        idempotencyKey: "auto:route:capture:2",
        text: "Claire m'a rappelé ce soir pour s'excuser.",
      }),
    });
    // L'agent enchaîne seul : relever la note, puis la comprendre ; on attend
    // qu'il n'ait plus rien à faire, puis on lit son historique en base.
    let agentState = null;
    for (let i = 0; i < 200; i += 1) {
      await new Promise((done) => setTimeout(done, 25));
      agentState = await (
        await on.call("/api/analyses/automatic/current")
      ).json();
      if (
        agentState.job?.status !== "running" &&
        !agentState.scheduled &&
        agentState.next === null
      )
        break;
    }
    assert.equal(agentState.next, null, "l'agent a tout traité");
    const { DatabaseSync } = await import("node:sqlite");
    const database = new DatabaseSync(join(directory, "memory.sqlite3"), {
      readOnly: true,
    });
    const tasks = database
      .prepare(
        "SELECT task, status FROM analysis_requests WHERE mode = 'automatic' ORDER BY created_at",
      )
      .all()
      .map((row) => `${row.task}:${row.status}`);
    database.close();
    assert.ok(
      tasks.slice(1).includes("extract:applied"),
      `relevé autonome de la nouvelle note (${tasks.join(", ")})`,
    );
    assert.ok(
      tasks.includes("interpret:applied") ||
        tasks.includes("interpret:no_change"),
      `interprétation autonome ensuite (${tasks.join(", ")})`,
    );
  } finally {
    for (const server of servers) await server.close().catch(() => {});
    rmSync(directory, { recursive: true, force: true });
  }
});

test("IA-A.4 · budget quotidien : consommation comptée, refus explicite au-delà", () =>
  withStore(async (store) => {
    const automatic = new AutomaticAnalyses(
      store,
      {
        id: "deepseek:test",
        model: "test",
        dailyTokenBudget: 2000,
        call: async ({ prompt }) => reply(validProposal(packetOf(prompt))),
      },
      null,
      { autoApply: false },
    );
    assert.deepEqual(automatic.describe().budget, {
      dailyTokens: 2000,
      usedToday: 0,
    });
    const first = await automatic.settle(
      automatic.start({ task: "extract" }).requestId,
    );
    assert.equal(first.status, "ready_for_review");
    assert.equal(automatic.budget().usedToday, 1234);
    store.cancelAnalysis(first.requestId);
    const second = await automatic.settle(
      automatic.start({ task: "extract" }).requestId,
    );
    assert.equal(second.status, "ready_for_review");
    assert.equal(automatic.budget().usedToday, 2468);
    assert.throws(
      () => automatic.start({ task: "extract" }),
      (error) => error.code === "budget_exceeded" && error.status === 429,
    );
    const unlimited = new AutomaticAnalyses(store, {
      id: "deepseek:test",
      model: "test",
      call: async ({ prompt }) => reply(validProposal(packetOf(prompt))),
    });
    assert.equal(unlimited.budget().dailyTokens, null);
  }));

test("D-023 · le client laisse le modèle interroger la mémoire, puis rend sa réponse", async () => {
  const bodies = [];
  const server = createServer((request, response) => {
    let body = "";
    request.on("data", (chunk) => (body += chunk));
    request.on("end", () => {
      const parsed = JSON.parse(body);
      bodies.push(parsed);
      const toolAnswered = parsed.messages.some(
        (message) => message.role === "tool",
      );
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          model: "deepseek-flash",
          usage: { total_tokens: 10 },
          choices: [
            toolAnswered
              ? { finish_reason: "stop", message: { content: '{"ok":true}' } }
              : {
                  finish_reason: "tool_calls",
                  message: {
                    content: "",
                    reasoning_content: "je dois relire la note",
                    tool_calls: [
                      {
                        id: "call_1",
                        type: "function",
                        function: {
                          name: "get_note",
                          arguments: '{"sourceId":"s1"}',
                        },
                      },
                    ],
                  },
                },
          ],
        }),
      );
    });
  });
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  try {
    const executed = [];
    const call = createDeepSeekCall({
      endpoint: `http://127.0.0.1:${server.address().port}`,
      model: "deepseek-flash",
    });
    const result = await call({
      prompt: "p",
      signal: new AbortController().signal,
      tools: [{ type: "function", function: { name: "get_note" } }],
      executeTool: (name, args) => {
        executed.push([name, args]);
        return { text: "note" };
      },
    });
    assert.equal(result.content, '{"ok":true}');
    assert.deepEqual(executed, [["get_note", { sourceId: "s1" }]]);
    assert.deepEqual(result.meta.queries, [
      { name: "get_note", args: { sourceId: "s1" } },
    ]);
    assert.equal(result.meta.rounds, 2);
    assert.equal(result.meta.usage.total_tokens, 20, "usage cumulé");
    const followUp = bodies[1].messages;
    assert.equal(followUp[1].reasoning_content, "je dois relire la note");
    assert.equal(followUp[2].role, "tool");
    // Bride (à lever à terme) : au-delà de maxRounds, plus d'outils offerts.
    const capped = await call({
      prompt: "p",
      signal: new AbortController().signal,
      tools: [{ type: "function", function: { name: "get_note" } }],
      executeTool: () => ({}),
      maxRounds: 0,
    });
    assert.ok(!("tools" in bodies.at(-1)));
    void capped;
  } finally {
    server.closeAllConnections();
    await new Promise((done) => server.close(done));
  }
});

test("D-023 · une requête mémoire est journalisée, n'écrit rien, et rend l'objet servi référençable", () =>
  withStore(async (store) => {
    const extract = store.prepareAnalysis({ task: "extract" });
    const applied = store.receiveAnalysis(JSON.parse(validProposal(extract)));
    store.applyAnalysis(applied.responseId);
    const claimId = store.snapshot().claims[0].id;
    // Paquet centré sur une autre note : ce fait n'y est pas, il faut le demander.
    const other = store.capture({
      idempotencyKey: "auto:capture:other",
      text: "Une autre note sans rapport.",
    });
    const packet = store.prepareAnalysis({
      task: "interpret",
      focus: [other.created.find((ref) => ref.kind === "event")],
    });
    assert.ok(!packet.claims.some((claim) => claim.id === claimId));
    const revision = store.revision;
    const note = store.queryMemory(packet.requestId, "get_note", {
      sourceId: store
        .snapshot()
        .sources.find((source) => source.content.includes("Claire")).id,
    });
    assert.ok(note.text.includes("Claire"));
    assert.equal(note.claims[0].claimId, claimId);
    assert.equal(store.revision, revision, "aucune écriture");
    assert.equal(store.analysisQueries(packet.requestId).length, 1);
    assert.deepEqual(store.queryMemory(packet.requestId, "inconnue", {}), {
      error: "Requête inconnue : inconnue.",
    });
    const preview = store.receiveAnalysis({
      ...JSON.parse(validProposal(packet)),
      schemaVersion: "1.6",
      operations: [
        {
          key: "h1",
          kind: "propose_hypothesis",
          payload: {
            statement: "Claire préfère la solitude le week-end.",
            depth: "D1",
            framework: null,
            construct: null,
            confidence: "low",
            subjects: [{ mention: "Claire" }],
            evidence: [
              { claim: { kind: "claim", id: claimId }, stance: "supports" },
            ],
            limits: "Une note.",
            revisionConditions: "Une sortie choisie le week-end.",
            alternativeTo: null,
            validFrom: null,
            validTo: null,
          },
          rationale: "S'appuie sur un fait obtenu par requête.",
        },
      ],
    });
    assert.equal(
      preview.status,
      "ready_for_review",
      JSON.stringify(preview.errors),
    );
  }));
