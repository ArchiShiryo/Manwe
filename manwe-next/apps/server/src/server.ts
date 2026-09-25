import { randomBytes } from "node:crypto";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import {
  DomainError,
  IMPORT_MAX_BYTES,
  parseAnnotationCommand,
  parseCaptureCommand,
  parseAnswerQuestionCommand,
  parseGoalCommand,
  parseImportCommand,
  parseResolveIdentityCommand,
} from "../../../packages/domain/src/memory.ts";
import {
  COGNITION_MAX_BYTES,
  parsePrepareAnalysisCommand,
} from "../../../packages/cognition/src/contract.ts";
import { SqliteMemoryStore } from "../../../packages/storage/src/sqliteStore.ts";
import {
  projectGraph,
  type FocusContext,
} from "../../../packages/cognition/src/projection.ts";
import { buildSynthesis } from "../../../packages/cognition/src/synthesis.ts";

const JSON_LIMIT = 64 * 1024;

type ServerOptions = {
  databasePath: string;
  port?: number;
  allowedOrigin?: string;
  workspaceId?: string;
  workspaceName?: string;
};

function json(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(body));
}

async function readJson(request: IncomingMessage, limit = JSON_LIMIT) {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.byteLength;
    if (size > limit)
      throw new DomainError(
        "body_too_large",
        `La requête dépasse ${Math.round(limit / 1024)} Kio.`,
        413,
      );
    chunks.push(buffer);
  }
  if (chunks.length === 0)
    throw new DomainError("missing_body", "Corps JSON manquant.");
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch {
    throw new DomainError("invalid_json", "Le corps JSON est invalide.");
  }
}

export async function startManweServer(options: ServerOptions) {
  const port = options.port ?? 5181;
  const allowedOrigin = options.allowedOrigin ?? "http://127.0.0.1:5180";
  const workspaceId = options.workspaceId ?? "personal";
  const store = new SqliteMemoryStore(
    options.databasePath,
    workspaceId,
    options.workspaceName,
  );
  const sessionToken = randomBytes(32).toString("base64url");
  const rate = new Map<string, number[]>();

  const server = createServer(async (request, response) => {
    const requestOrigin = request.headers.origin;
    const host = request.headers.host ?? "";
    const activePort =
      (server.address() as { port: number } | null)?.port ?? port;
    const validHosts = new Set([
      `127.0.0.1:${activePort}`,
      `localhost:${activePort}`,
    ]);
    const pathname = new URL(
      request.url ?? "/",
      `http://${host || "127.0.0.1"}`,
    ).pathname;

    response.setHeader("cache-control", "no-store");
    response.setHeader("x-content-type-options", "nosniff");
    response.setHeader("referrer-policy", "no-referrer");

    if (!validHosts.has(host)) {
      json(response, 400, {
        error: { code: "invalid_host", message: "Hôte local invalide." },
      });
      return;
    }

    if (pathname === "/api/health" && request.method === "GET") {
      json(response, 200, {
        status: "ok",
        service: "manwe-memory",
        workspaceRevision: store.revision,
      });
      return;
    }

    if (requestOrigin !== allowedOrigin) {
      json(response, 403, {
        error: {
          code: "origin_not_allowed",
          message: "Origine non autorisée.",
        },
      });
      return;
    }
    response.setHeader("access-control-allow-origin", allowedOrigin);
    response.setHeader("access-control-allow-credentials", "true");
    response.setHeader("vary", "Origin");
    if (request.method === "OPTIONS") {
      response.setHeader("access-control-allow-methods", "GET, POST, OPTIONS");
      response.setHeader("access-control-allow-headers", "Content-Type");
      response.writeHead(204);
      response.end();
      return;
    }

    if (pathname === "/api/session" && request.method === "POST") {
      response.setHeader(
        "set-cookie",
        `manwe_session=${sessionToken}; HttpOnly; SameSite=Strict; Path=/`,
      );
      json(response, 200, {
        workspace: { id: workspaceId, revision: store.revision },
        storage: "sqlite",
        mode: "personal",
      });
      return;
    }

    const cookies = Object.fromEntries(
      (request.headers.cookie ?? "")
        .split(";")
        .map((item) => item.trim().split("="))
        .filter(([key, value]) => Boolean(key && value)),
    );
    if (cookies.manwe_session !== sessionToken) {
      json(response, 401, {
        error: { code: "session_required", message: "Session locale requise." },
      });
      return;
    }

    try {
      if (pathname === "/api/status" && request.method === "GET") {
        json(response, 200, store.status());
        return;
      }
      if (pathname === "/api/workspace" && request.method === "GET") {
        json(response, 200, store.snapshot());
        return;
      }
      const analysisRoute = pathname.match(/^\/api\/analyses\/([^/]+)$/);
      if (analysisRoute && request.method === "GET") {
        json(
          response,
          200,
          store.getAnalysis(decodeURIComponent(analysisRoute[1])),
        );
        return;
      }
      if (pathname === "/api/graph" && request.method === "GET") {
        // Projection du graphe vivant autour d'un focus (R4.1, R4.2).
        const params = new URL(request.url ?? "/", `http://${host}`)
          .searchParams;
        const kind = params.get("kind") ?? "self";
        const kinds = ["person", "self", "relation", "hypothesis", "question"];
        if (!kinds.includes(kind))
          throw new DomainError("invalid_focus", "Focus de graphe inconnu.");
        // Synthèse (R4.6) calculée sur le même instantané : même révision.
        const snapshot = store.snapshot();
        const projection = projectGraph(snapshot, {
          kind: kind as FocusContext["kind"],
          id: params.get("id") ?? "self",
        });
        json(response, 200, {
          ...projection,
          synthesis: buildSynthesis(snapshot, projection),
        });
        return;
      }
      if (pathname === "/api/search" && request.method === "GET") {
        const params = new URL(request.url ?? "/", `http://${host}`)
          .searchParams;
        const value = params.get("q") ?? "";
        const from = params.get("from") ?? undefined;
        const to = params.get("to") ?? undefined;
        for (const [field, date] of [
          ["from", from],
          ["to", to],
        ] as const)
          if (date && !Number.isFinite(Date.parse(date)))
            throw new DomainError(
              "invalid_date",
              `${field} doit être une date ISO 8601.`,
            );
        json(response, 200, {
          results: store.search({
            text: value.trim() || undefined,
            personId: params.get("personId") ?? undefined,
            context: params.get("context") ?? undefined,
            occurredFrom: from,
            occurredTo: to,
            limit: Number(params.get("limit") ?? 50),
          }),
        });
        return;
      }

      if (request.method === "POST") {
        const timestamps = rate.get(sessionToken) ?? [];
        const cutoff = Date.now() - 60_000;
        const recent = timestamps.filter((timestamp) => timestamp > cutoff);
        if (recent.length >= 60)
          throw new DomainError(
            "rate_limited",
            "Trop de modifications en une minute.",
            429,
          );
        recent.push(Date.now());
        rate.set(sessionToken, recent);
      }

      if (pathname === "/api/captures" && request.method === "POST") {
        json(
          response,
          201,
          store.capture(parseCaptureCommand(await readJson(request))),
        );
        return;
      }
      if (pathname === "/api/imports" && request.method === "POST") {
        json(
          response,
          201,
          store.importData(
            parseImportCommand(
              await readJson(request, IMPORT_MAX_BYTES * 2 + JSON_LIMIT),
            ),
          ),
        );
        return;
      }
      const identityResolutionRoute = pathname.match(
        /^\/api\/identities\/ambiguities\/([^/]+)\/resolve$/,
      );
      if (identityResolutionRoute && request.method === "POST") {
        const ambiguityId = decodeURIComponent(identityResolutionRoute[1]);
        const command = parseResolveIdentityCommand(await readJson(request));
        if (command.ambiguityId !== ambiguityId)
          throw new DomainError(
            "identity_ambiguity_mismatch",
            "L’ambiguïté ne correspond pas à la route.",
          );
        json(response, 200, store.resolveIdentity(command));
        return;
      }
      if (pathname === "/api/annotations" && request.method === "POST") {
        json(
          response,
          201,
          store.annotate(parseAnnotationCommand(await readJson(request))),
        );
        return;
      }
      const answerRoute = pathname.match(/^\/api\/questions\/([^/]+)\/answer$/);
      if (answerRoute && request.method === "POST") {
        json(
          response,
          201,
          store.answerQuestion(
            parseAnswerQuestionCommand(
              await readJson(request),
              decodeURIComponent(answerRoute[1]),
            ),
          ),
        );
        return;
      }
      if (pathname === "/api/goals" && request.method === "POST") {
        json(
          response,
          201,
          store.updateGoal(parseGoalCommand(await readJson(request))),
        );
        return;
      }
      if (pathname === "/api/analyses" && request.method === "POST") {
        json(
          response,
          201,
          store.prepareAnalysis(
            parsePrepareAnalysisCommand(await readJson(request)),
          ),
        );
        return;
      }
      const responseRoute = pathname.match(
        /^\/api\/analyses\/([^/]+)\/responses$/,
      );
      if (responseRoute && request.method === "POST") {
        const requestId = decodeURIComponent(responseRoute[1]);
        const proposal = await readJson(request, COGNITION_MAX_BYTES);
        if (
          !proposal ||
          typeof proposal !== "object" ||
          Array.isArray(proposal) ||
          (proposal as { requestId?: unknown }).requestId !== requestId
        )
          throw new DomainError(
            "proposal_mismatch",
            "requestId ne correspond pas à la route.",
          );
        json(response, 201, store.receiveAnalysis(proposal));
        return;
      }
      const applyRoute = pathname.match(/^\/api\/analyses\/([^/]+)\/apply$/);
      if (applyRoute && request.method === "POST") {
        const requestId = decodeURIComponent(applyRoute[1]);
        const body = await readJson(request);
        if (!body || typeof body !== "object" || Array.isArray(body))
          throw new DomainError("invalid_body", "Confirmation invalide.");
        const confirmation = body as {
          requestId?: unknown;
          responseId?: unknown;
          confirmed?: unknown;
        };
        if (
          confirmation.requestId !== requestId ||
          typeof confirmation.responseId !== "string" ||
          confirmation.confirmed !== true
        )
          throw new DomainError(
            "confirmation_required",
            "La proposition complète doit être confirmée explicitement.",
          );
        const analysis = store.getAnalysis(requestId);
        if (
          !analysis.responses.some(
            (item) => item.responseId === confirmation.responseId,
          )
        )
          throw new DomainError(
            "proposal_mismatch",
            "La réponse ne dépend pas de cette demande.",
          );
        json(response, 200, store.applyAnalysis(confirmation.responseId));
        return;
      }
      const cancelRoute = pathname.match(/^\/api\/analyses\/([^/]+)\/cancel$/);
      if (cancelRoute && request.method === "POST") {
        json(
          response,
          200,
          store.cancelAnalysis(decodeURIComponent(cancelRoute[1])),
        );
        return;
      }
      json(response, 404, {
        error: { code: "not_found", message: "Route inconnue." },
      });
    } catch (error) {
      if (error instanceof DomainError) {
        json(response, error.status, {
          error: { code: error.code, message: error.message },
        });
        return;
      }
      console.error("manwe-server", error);
      json(response, 500, {
        error: {
          code: "internal_error",
          message: "Erreur interne du service local.",
        },
      });
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  const actualPort =
    typeof address === "object" && address ? address.port : port;
  return {
    port: actualPort,
    origin: `http://127.0.0.1:${actualPort}`,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((error) => {
          store.close();
          if (error) reject(error);
          else resolve();
        }),
      ),
  };
}
