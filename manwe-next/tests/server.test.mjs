import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { startManweServer } from "../apps/server/src/server.ts";

const uiOrigin = "http://127.0.0.1:5180";

async function withServer(run) {
  const directory = mkdtempSync(join(tmpdir(), "manwe-server-"));
  const databasePath = join(directory, "memory.sqlite3");
  let server = await startManweServer({
    databasePath,
    port: 0,
    allowedOrigin: uiOrigin,
  });
  try {
    await run({
      databasePath,
      get origin() {
        return server.origin;
      },
      async restart() {
        await server.close();
        server = await startManweServer({
          databasePath,
          port: 0,
          allowedOrigin: uiOrigin,
        });
      },
    });
  } finally {
    await server.close();
    rmSync(directory, { recursive: true, force: true });
  }
}

async function session(origin) {
  const response = await fetch(`${origin}/api/session`, {
    method: "POST",
    headers: { origin: uiOrigin },
  });
  assert.equal(response.status, 200);
  return response.headers.get("set-cookie").split(";", 1)[0];
}

const request = (origin, cookie, path, options = {}) =>
  fetch(`${origin}${path}`, {
    ...options,
    headers: {
      origin: uiOrigin,
      cookie,
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...options.headers,
    },
  });

test("le service refuse une origine étrangère et exige une session locale", () =>
  withServer(async ({ origin }) => {
    const health = await fetch(`${origin}/api/health`);
    assert.equal(health.status, 200);
    assert.equal((await health.json()).service, "manwe-memory");
    assert.equal(
      (
        await fetch(`${origin}/api/session`, {
          method: "POST",
          headers: { origin: "https://example.com" },
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await fetch(`${origin}/api/workspace`, {
          headers: { origin: uiOrigin },
        })
      ).status,
      401,
    );
  }));

test("capture, recherche, correction et redémarrage utilisent la même mémoire", () =>
  withServer(async (context) => {
    let cookie = await session(context.origin);
    const captureBody = {
      idempotencyKey: "api:capture:0001",
      text: "Marc ne m’a pas invité hier.",
      recordedAt: "2026-09-14T15:00:00-03:00",
      narratedAt: "2026-09-14T14:55:00-03:00",
      occurredStart: "2026-09-13T12:00:00-03:00",
      temporalPrecision: "day",
      context: "Amitiés proches",
    };
    const capture = await request(context.origin, cookie, "/api/captures", {
      method: "POST",
      body: JSON.stringify(captureBody),
    });
    assert.equal(capture.status, 201);
    const first = await capture.json();
    const event = first.created.find((item) => item.kind === "event");
    assert.ok(event);

    const replay = await request(context.origin, cookie, "/api/captures", {
      method: "POST",
      body: JSON.stringify(captureBody),
    });
    assert.equal((await replay.json()).replayed, true);

    const annotation = await request(
      context.origin,
      cookie,
      "/api/annotations",
      {
        method: "POST",
        body: JSON.stringify({
          idempotencyKey: "api:annotate:0001",
          target: event,
          annotationType: "context",
          text: "Il parlait d’une autre date.",
        }),
      },
    );
    assert.equal(annotation.status, 201);

    const search = await request(
      context.origin,
      cookie,
      "/api/search?q=invité",
    );
    const searchBody = await search.json();
    assert.equal(searchBody.results.length, 1);
    assert.equal(searchBody.results[0].source.content, captureBody.text);
    const filteredSearch = await request(
      context.origin,
      cookie,
      "/api/search?context=Amiti%C3%A9s&from=2026-09-13T00%3A00%3A00-03%3A00&to=2026-09-13T23%3A59%3A59-03%3A00",
    );
    assert.equal((await filteredSearch.json()).results.length, 1);
    await context.restart();
    cookie = await session(context.origin);
    const graph = await request(context.origin, cookie, "/api/graph?kind=self");
    assert.equal(graph.status, 200);
    const projection = await graph.json();
    assert.equal(projection.focus.kind, "self");
    assert.ok(projection.nodes.some((node) => node.id === "self"));
    const snapshot = await request(context.origin, cookie, "/api/workspace");
    const body = await snapshot.json();
    assert.equal(body.workspace.revision, 2);
    // L'annotation de contexte crée sa propre note citable (BRIEF-003).
    assert.equal(body.events.length, 2);
    assert.ok(
      body.events.every((item) => item.category === "unclassified_note"),
    );
    assert.equal(body.annotations[0].target.id, event.id);
    assert.ok(
      body.sources.some((source) => source.id === body.annotations[0].sourceId),
    );
  }));

test("les erreurs de validation de l’API n’écrivent pas d’état partiel", () =>
  withServer(async ({ origin }) => {
    const cookie = await session(origin);
    const invalid = await request(origin, cookie, "/api/captures", {
      method: "POST",
      body: JSON.stringify({ idempotencyKey: "trop-court", text: "" }),
    });
    assert.equal(invalid.status, 400);
    assert.equal((await invalid.json()).error.code, "invalid_text");
    const snapshot = await request(origin, cookie, "/api/workspace");
    assert.equal((await snapshot.json()).workspace.revision, 0);
  }));

test("l’API importe JSON, expose les candidats et déduplique le même fichier", () =>
  withServer(async ({ origin }) => {
    const cookie = await session(origin);
    const content = JSON.stringify([
      {
        text: "Camille a confirmé sa présence.",
        participants: [{ name: "Camille", identityKey: "camille-1" }],
      },
    ]);
    const body = {
      idempotencyKey: "api:import:json:0001",
      format: "json",
      content,
      sourceSystem: "api-fixture",
    };
    const imported = await request(origin, cookie, "/api/imports", {
      method: "POST",
      body: JSON.stringify(body),
    });
    assert.equal(imported.status, 201);
    assert.equal((await imported.json()).createdPeople, 1);
    const replayed = await request(origin, cookie, "/api/imports", {
      method: "POST",
      body: JSON.stringify({ ...body, idempotencyKey: "api:import:json:0002" }),
    });
    assert.equal((await replayed.json()).replayed, true);
    const snapshot = await request(origin, cookie, "/api/workspace");
    const state = await snapshot.json();
    assert.equal(state.events.length, 1);
    assert.equal(state.persons[0].displayName, "Camille");
    assert.equal(state.workspace.revision, 1);
  }));

test("l’API prépare, prévisualise et applique explicitement une proposition assistée", () =>
  withServer(async ({ origin }) => {
    const cookie = await session(origin);
    await request(origin, cookie, "/api/captures", {
      method: "POST",
      body: JSON.stringify({
        idempotencyKey: "api:cognition:capture",
        text: "Claire a écrit : « Je préfère rester seule ce week-end. »",
      }),
    });
    const preparedResponse = await request(origin, cookie, "/api/analyses", {
      method: "POST",
      body: JSON.stringify({ task: "extract", mode: "assisted" }),
    });
    assert.equal(preparedResponse.status, 201);
    const packet = await preparedResponse.json();
    const source = packet.sources[0];
    const proposal = {
      schemaVersion: "1.4",
      requestId: packet.requestId,
      workspaceId: packet.workspaceId,
      baseRevision: packet.baseRevision,
      contextHash: packet.contextHash,
      modelDeclaration: {
        declaredModel: "Sol",
        role: "analyse assistée",
        technicalId: null,
      },
      outcome: "proposed",
      operations: [
        {
          key: "claim-preference",
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
          rationale:
            "La source contient une citation directe limitée au week-end.",
        },
      ],
      clarifications: [],
      summary: "Une déclaration explicite et temporellement limitée.",
    };
    const received = await request(
      origin,
      cookie,
      `/api/analyses/${packet.requestId}/responses`,
      { method: "POST", body: JSON.stringify(proposal) },
    );
    const preview = await received.json();
    assert.equal(preview.status, "ready_for_review");
    const unconfirmed = await request(
      origin,
      cookie,
      `/api/analyses/${packet.requestId}/apply`,
      {
        method: "POST",
        body: JSON.stringify({
          requestId: packet.requestId,
          responseId: preview.responseId,
          confirmed: false,
        }),
      },
    );
    assert.equal(unconfirmed.status, 400);
    const applied = await request(
      origin,
      cookie,
      `/api/analyses/${packet.requestId}/apply`,
      {
        method: "POST",
        body: JSON.stringify({
          requestId: packet.requestId,
          responseId: preview.responseId,
          confirmed: true,
        }),
      },
    );
    const result = await applied.json();
    assert.equal(result.status, "applied");
    assert.equal(result.resultRevision, 2);
    const journal = await request(
      origin,
      cookie,
      `/api/analyses/${packet.requestId}`,
    );
    assert.equal((await journal.json()).status, "applied");
    const snapshot = await request(origin, cookie, "/api/workspace");
    assert.equal((await snapshot.json()).claims.length, 1);
  }));
