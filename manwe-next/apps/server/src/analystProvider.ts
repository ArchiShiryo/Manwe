// Fournisseur d'analyse automatique (IA-A.2, IA-A.3, D-020, D-021).
// Il reprend exactement la mécanique validée par le harnais d'évaluation :
// même prompt versionné, même paquet de contexte (memory.get_context, préparé
// par le stockage), une seule seconde tentative informée du motif de rejet.
// Le modèle n'a aucun accès à la base ni au poste : il reçoit le paquet et
// renvoie une proposition, que le contrat valide. Rien n'est appliqué sans la
// confirmation explicite de l'utilisateur.
import { readFileSync } from "node:fs";
import { DomainError } from "../../../packages/domain/src/memory.ts";
import type {
  AnalysisPreview,
  AnalysisTask,
  ContextPacket,
} from "../../../packages/cognition/src/contract.ts";
import type { EntityRef } from "../../../packages/domain/src/memory.ts";
import { MEMORY_TOOLS } from "../../../packages/cognition/src/memoryTools.ts";
import type { SqliteMemoryStore } from "../../../packages/storage/src/sqliteStore.ts";

export type ProviderCallResult = {
  content: string;
  reasoning: string | null;
  meta: {
    servedModel: string | null;
    finishReason: string | null;
    usage: unknown;
    latencyMs: number;
    /** D-023 : requêtes faites par le modèle pendant l'analyse. */
    queries?: Array<{ name: string; args: unknown }>;
    rounds?: number;
  };
};

/** Appel au modèle : un prompt complet, une réponse brute jamais modifiée. */
export type AnalystCall = (input: {
  prompt: string;
  signal: AbortSignal;
  /** D-023 : requêtes mémoire offertes au modèle (lecture seule). */
  tools?: readonly unknown[];
  executeTool?: (name: string, args: Record<string, unknown>) => unknown;
  maxRounds?: number;
}) => Promise<ProviderCallResult>;

export type ProviderConfig = {
  id: string;
  model: string;
  call: AnalystCall;
  /** Jetons autorisés par jour (UTC) ; absent = pas de plafond. */
  dailyTokenBudget?: number | null;
};

const startOfUtcDay = (now = new Date()) =>
  new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  ).toISOString();

/** Codes d'erreur du fournisseur, jamais remplacés par Sol assisté ni une fixture. */
export type ProviderErrorCode =
  | "provider_auth"
  | "provider_quota"
  | "provider_rate_limited"
  | "provider_unreachable"
  | "provider_timeout"
  | "provider_error"
  | "analysis_cancelled"
  | "proposal_rejected";

export class ProviderError extends Error {
  readonly code: ProviderErrorCode;
  constructor(code: ProviderErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "ProviderError";
  }
}

const PROMPTS: Record<string, string> = {};
function promptText(version: string) {
  if (!/^analyst-v\d+$/.test(version))
    throw new DomainError(
      "unknown_prompt_version",
      `Version de prompt inconnue : ${version}.`,
    );
  PROMPTS[version] ??= readFileSync(
    new URL(
      `../../../packages/cognition/prompts/${version}.md`,
      import.meta.url,
    ),
    "utf8",
  );
  return PROMPTS[version];
}

/** Même composition que PROMPT.txt dans le harnais (scenario-run.mjs). */
export function composePrompt(packet: ContextPacket) {
  return `${promptText(packet.promptVersion).trimEnd()}\n\n${JSON.stringify(packet, null, 2)}\n`;
}

/** D-021 : la seconde tentative connaît le motif exact du premier rejet. */
export function composeRetryPrompt(
  prompt: string,
  errors: { code: string; message: string }[],
) {
  const list = errors.map((error) => `- ${error.code} : ${error.message}`);
  return `${prompt.trimEnd()}\n\nTa réponse précédente à ce paquet a été rejetée par le validateur :\n${list.join("\n")}\nRenvoie un objet CognitiveProposal complet et corrigé, qui respecte exactement le format.\n`;
}

const pause = (ms: number, signal: AbortSignal) =>
  new Promise<void>((done, fail) => {
    const timer = setTimeout(done, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      fail(signal.reason);
    });
  });

/**
 * Client DeepSeek (API compatible OpenAI). La clé vient de l'environnement ou
 * du proxy de la session ; elle n'est jamais journalisée ni renvoyée.
 * D-023 : si des requêtes mémoire sont fournies, le modèle peut les appeler
 * autant de tours que nécessaire (bride : maxRounds, à lever à terme) avant
 * de rendre sa proposition.
 */
export function createDeepSeekCall(options: {
  endpoint?: string;
  apiKey?: string;
  model: string;
  effort?: string;
  timeoutMs?: number;
  transportRetries?: number;
  backoffMs?: number;
}): AnalystCall {
  const endpoint = `${options.endpoint ?? "https://api.deepseek.com"}/chat/completions`;
  const timeoutMs = options.timeoutMs ?? 10 * 60 * 1000;
  const retries = options.transportRetries ?? 2;
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (options.apiKey) headers.authorization = `Bearer ${options.apiKey}`;

  type Message = {
    role: string;
    content: string;
    tool_calls?: unknown[];
    tool_call_id?: string;
    reasoning_content?: string;
  };
  type Choice = {
    finish_reason?: string;
    message?: {
      content?: string;
      reasoning_content?: string;
      tool_calls?: Array<{
        id: string;
        function: { name: string; arguments: string };
      }>;
    };
  };

  const post = async (payload: unknown, signal: AbortSignal) => {
    const body = JSON.stringify(payload);
    let last: ProviderError | null = null;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      if (attempt)
        await pause((options.backoffMs ?? 2000) * 2 ** (attempt - 1), signal);
      const timeout = AbortSignal.timeout(timeoutMs);
      let response: Response;
      try {
        response = await fetch(endpoint, {
          method: "POST",
          headers,
          body,
          signal: AbortSignal.any([signal, timeout]),
        });
      } catch {
        if (signal.aborted)
          throw new ProviderError("analysis_cancelled", "Analyse annulée.");
        if (timeout.aborted)
          throw new ProviderError(
            "provider_timeout",
            `Le modèle n’a pas répondu en ${Math.round(timeoutMs / 1000)} s.`,
          );
        last = new ProviderError(
          "provider_unreachable",
          "Le service du modèle est injoignable (réseau).",
        );
        continue;
      }
      const text = await response.text();
      if (response.status === 401 || response.status === 403)
        throw new ProviderError(
          "provider_auth",
          "Clé du fournisseur absente ou refusée.",
        );
      if (response.status === 402)
        throw new ProviderError(
          "provider_quota",
          "Crédit du fournisseur épuisé.",
        );
      if (response.status === 429 || response.status >= 500) {
        last = new ProviderError(
          response.status === 429 ? "provider_rate_limited" : "provider_error",
          `Le fournisseur a répondu ${response.status}.`,
        );
        continue;
      }
      if (!response.ok)
        throw new ProviderError(
          "provider_error",
          `Le fournisseur a refusé la requête (${response.status}).`,
        );
      try {
        return JSON.parse(text) as {
          model?: string;
          usage?: Record<string, number>;
          choices?: Choice[];
        };
      } catch {
        throw new ProviderError(
          "provider_error",
          "Réponse du fournisseur illisible.",
        );
      }
    }
    throw last ?? new ProviderError("provider_error", "Appel impossible.");
  };

  return async ({ prompt, signal, tools, executeTool, maxRounds = 12 }) => {
    const started = Date.now();
    const messages: Message[] = [{ role: "user", content: prompt }];
    const usage: Record<string, number> = {};
    const queries: Array<{ name: string; args: unknown }> = [];
    let servedModel: string | null = null;
    for (let round = 0; ; round += 1) {
      const allowTools = Boolean(tools && executeTool) && round < maxRounds;
      const data = await post(
        {
          model: options.model,
          messages,
          response_format: { type: "json_object" },
          reasoning_effort: options.effort ?? "high",
          max_tokens: 64000,
          ...(allowTools ? { tools } : {}),
        },
        signal,
      );
      servedModel = data.model ?? servedModel;
      for (const [key, value] of Object.entries(data.usage ?? {}))
        if (typeof value === "number") usage[key] = (usage[key] ?? 0) + value;
      const choice = data.choices?.[0];
      const calls = choice?.message?.tool_calls ?? [];
      if (allowTools && calls.length && executeTool) {
        messages.push({
          role: "assistant",
          content: choice?.message?.content ?? "",
          tool_calls: calls,
          ...(choice?.message?.reasoning_content
            ? { reasoning_content: choice.message.reasoning_content }
            : {}),
        });
        for (const call of calls) {
          let args: Record<string, unknown> = {};
          try {
            args = JSON.parse(call.function.arguments || "{}");
          } catch {
            args = {};
          }
          queries.push({ name: call.function.name, args });
          const result = await executeTool(call.function.name, args);
          messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify(result).slice(0, 60_000),
          });
        }
        continue;
      }
      return {
        content: choice?.message?.content ?? "",
        reasoning: choice?.message?.reasoning_content ?? null,
        meta: {
          servedModel,
          finishReason: choice?.finish_reason ?? null,
          usage,
          latencyMs: Date.now() - started,
          queries,
          rounds: round + 1,
        },
      };
    }
  };
}

export type AutomaticJob = {
  requestId: string;
  task: AnalysisTask;
  /** D-028 : pourquoi l'agent a lancé cette analyse (null si demandée). */
  reason: string | null;
  status:
    | "running"
    | "ready_for_review"
    | "applied"
    | "needs_context"
    | "failed"
    | "cancelled";
  startedAt: string;
  finishedAt: string | null;
  attempts: {
    status: string;
    errors: { code: string; message: string }[];
    latencyMs: number | null;
    usage: unknown;
    servedModel: string | null;
    queries: Array<{ name: string; args: unknown }>;
  }[];
  preview: AnalysisPreview | null;
  /** D-028 : résultat de l'application automatique. */
  applied: {
    revision: number;
    created: number;
    changed: number;
    warnings: { code: string; message: string }[];
  } | null;
  error: { code: string; message: string } | null;
};

export type AgentOptions = {
  /** D-028 : appliquer d'elle-même une analyse valide (vrai par défaut). */
  autoApply?: boolean;
  /** D-031 : essais au total, dont les reprises informées (3 par défaut). */
  maxAttempts?: number;
  /** Silence attendu après la dernière note avant d'analyser (ms). */
  quietMs?: number;
};

/**
 * Travaux d'analyse automatique en cours, en mémoire du service. Un résultat
 * arrivé après une annulation est ignoré (le stockage refuse d'ailleurs une
 * réponse à une demande annulée).
 */
export class AutomaticAnalyses {
  private readonly jobs = new Map<string, AutomaticJob>();
  private readonly controllers = new Map<string, AbortController>();
  private readonly store: SqliteMemoryStore;
  private readonly provider: ProviderConfig | null;

  /** Archivage facultatif des réponses brutes, jamais retouchées (évaluations). */
  private readonly onCall:
    | ((entry: {
        requestId: string;
        attempt: number;
        prompt: string;
        call: ProviderCallResult;
      }) => void)
    | null;

  private readonly options: Required<AgentOptions>;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private again = false;
  private lastJob: AutomaticJob | null = null;
  /** Révision d'un échec : l'agent n'y revient pas seul avant du nouveau. */
  private failedAt: number | null = null;

  constructor(
    store: SqliteMemoryStore,
    provider: ProviderConfig | null,
    onCall: AutomaticAnalyses["onCall"] = null,
    options: AgentOptions = {},
  ) {
    this.store = store;
    this.provider = provider;
    this.onCall = onCall;
    this.options = {
      autoApply: options.autoApply ?? true,
      maxAttempts: options.maxAttempts ?? 3,
      quietMs: options.quietMs ?? 12_000,
    };
  }

  /** Analyse en cours, sinon la dernière : l'interface la retrouve après un rechargement. */
  current() {
    const running = [...this.jobs.values()].find(
      (job) => job.status === "running",
    );
    return {
      job: running ?? this.lastJob,
      scheduled: this.timer !== null,
      next: this.provider ? this.store.agentPlan() : null,
    };
  }

  /**
   * D-028 : l'utilisateur a écrit, répondu ou ajouté du contexte. L'agent
   * attend un court silence, puis lance seul l'analyse utile, s'il y en a.
   */
  nudge(delayMs = this.options.quietMs) {
    if (!this.provider) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      this.tick();
    }, delayMs);
    this.timer.unref?.();
  }

  private tick() {
    if ([...this.jobs.values()].some((job) => job.status === "running")) {
      this.again = true;
      return;
    }
    const revision = this.store.snapshot().workspace.revision;
    if (this.failedAt === revision) return;
    const plan = this.store.agentPlan();
    if (!plan) return;
    try {
      this.start({ task: plan.task, focus: plan.focus }, plan.reason);
    } catch {
      // budget atteint ou fournisseur absent : l'état reste lisible par current()
    }
  }

  get enabled() {
    return this.provider !== null;
  }

  /** Budget du jour (IA-A.4) : plafond et jetons déjà consommés. */
  budget() {
    return {
      dailyTokens: this.provider?.dailyTokenBudget ?? null,
      usedToday: this.store.providerTokensSince(startOfUtcDay()),
    };
  }

  describe() {
    return this.provider
      ? {
          enabled: true,
          providerId: this.provider.id,
          model: this.provider.model,
          budget: this.budget(),
        }
      : { enabled: false, providerId: null, model: null, budget: null };
  }

  start(
    input: { task: AnalysisTask; focus?: EntityRef[] },
    reason: string | null = null,
  ) {
    if (!this.provider)
      throw new DomainError(
        "provider_unconfigured",
        "Aucun fournisseur automatique n’est configuré ; l’analyse assistée reste disponible.",
        503,
      );
    const budget = this.budget();
    if (budget.dailyTokens !== null && budget.usedToday >= budget.dailyTokens)
      throw new DomainError(
        "budget_exceeded",
        `Budget du jour atteint : ${budget.usedToday} jetons sur ${budget.dailyTokens}. L’analyse assistée reste disponible.`,
        429,
      );
    const running = [...this.jobs.values()].find(
      (job) => job.status === "running",
    );
    if (running)
      throw new DomainError(
        "analysis_in_progress",
        "Une analyse automatique est déjà en cours.",
        409,
      );
    const packet = this.store.prepareAnalysis({
      task: input.task,
      focus: input.focus,
      mode: "automatic",
      providerId: this.provider.id,
    });
    const job: AutomaticJob = {
      requestId: packet.requestId,
      task: input.task,
      reason,
      status: "running",
      startedAt: new Date().toISOString(),
      finishedAt: null,
      attempts: [],
      preview: null,
      applied: null,
      error: null,
    };
    this.jobs.set(packet.requestId, job);
    this.lastJob = job;
    const controller = new AbortController();
    this.controllers.set(packet.requestId, controller);
    void this.run(job, packet, controller.signal);
    return job;
  }

  get(requestId: string) {
    const job = this.jobs.get(requestId);
    if (!job)
      throw new DomainError(
        "analysis_request_not_found",
        "Aucune analyse automatique avec cet identifiant.",
        404,
      );
    return job;
  }

  /** Annule le travail s'il existe ; le stockage enregistre l'annulation. */
  abort(requestId: string) {
    const job = this.jobs.get(requestId);
    if (job?.status === "running") {
      job.status = "cancelled";
      job.finishedAt = new Date().toISOString();
      job.error = { code: "analysis_cancelled", message: "Analyse annulée." };
      this.controllers.get(requestId)?.abort(new Error("cancelled"));
    }
  }

  /** Attend la fin du travail (tests). */
  async settle(requestId: string, timeoutMs = 30_000) {
    const deadline = Date.now() + timeoutMs;
    while (this.get(requestId).status === "running") {
      if (Date.now() > deadline) throw new Error("Travail non terminé.");
      await new Promise((done) => setTimeout(done, 20));
    }
    return this.get(requestId);
  }

  private async run(
    job: AutomaticJob,
    packet: ContextPacket,
    signal: AbortSignal,
  ) {
    const provider = this.provider as ProviderConfig;
    const prompt = composePrompt(packet);
    let errors: { code: string; message: string }[] = [];
    try {
      for (let attempt = 0; attempt < this.options.maxAttempts; attempt += 1) {
        const sent = attempt ? composeRetryPrompt(prompt, errors) : prompt;
        const call = await provider.call({
          prompt: sent,
          signal,
          // D-023 : le modèle explore librement la mémoire, en lecture seule.
          tools: MEMORY_TOOLS,
          executeTool: (name, args) =>
            this.store.queryMemory(job.requestId, name, args),
        });
        this.onCall?.({
          requestId: job.requestId,
          attempt: attempt + 1,
          prompt: sent,
          call,
        });
        if (signal.aborted || job.status === "cancelled") return;
        errors = [];
        let preview: AnalysisPreview | null = null;
        try {
          preview = this.store.receiveAnalysis(JSON.parse(call.content));
          errors.push(...preview.errors);
        } catch (error) {
          errors.push(
            error instanceof DomainError
              ? { code: error.code, message: error.message }
              : error instanceof SyntaxError
                ? {
                    code: "invalid_json",
                    message: "La réponse n’est pas un JSON valide.",
                  }
                : { code: "invalid_proposal", message: String(error) },
          );
        }
        if (preview)
          this.store.recordProviderUsage(preview.responseId, {
            servedModel: call.meta.servedModel,
            usage: call.meta.usage,
            inferenceDurationMs: call.meta.latencyMs,
          });
        job.attempts.push({
          status: preview?.status ?? "rejected",
          errors,
          latencyMs: call.meta.latencyMs,
          usage: call.meta.usage,
          servedModel: call.meta.servedModel,
          queries: call.meta.queries ?? [],
        });
        if (preview && preview.status !== "rejected") {
          job.preview = {
            ...preview,
            telemetry: {
              ...preview.telemetry,
              inferenceDurationMs: call.meta.latencyMs,
              usage: call.meta.usage,
            },
          };
          job.status =
            preview.status === "needs_context"
              ? "needs_context"
              : "ready_for_review";
          if (job.status === "ready_for_review" && this.options.autoApply) {
            // D-028 : pas de confirmation ; les garde-fous sont dans le moteur.
            const result = this.store.applyAnalysis(preview.responseId);
            job.status = "applied";
            job.applied = {
              revision: result.resultRevision,
              created: result.createdIds.length,
              changed: result.changedIds.length,
              warnings: result.warnings,
            };
          }
          return;
        }
      }
      job.status = "failed";
      job.error = {
        code: "proposal_rejected",
        message: `${this.options.maxAttempts} propositions rejetées par le validateur : ${errors.map((error) => error.code).join(", ")}.`,
      };
    } catch (error) {
      if (job.status === "cancelled") return;
      job.status = "failed";
      job.error =
        error instanceof ProviderError
          ? { code: error.code, message: error.message }
          : {
              code: "provider_error",
              // DEMO-R5-7 : la vraie cause, sans la clé ni le prompt.
              message: `Erreur inattendue du fournisseur : ${
                error instanceof Error ? error.message : String(error)
              }`.slice(0, 400),
            };
      console.error(
        `[analyse ${job.requestId}] ${job.error.code} : ${job.error.message}`,
      );
    } finally {
      if (job.status === "running") job.status = "failed";
      job.finishedAt ??= new Date().toISOString();
      // Une demande restée sans réponse valide est close : elle ne doit pas
      // apparaître comme « analyse en cours » (IA-A.3).
      if (job.status === "failed")
        try {
          this.store.cancelAnalysis(job.requestId);
        } catch {
          // déjà close (rejets enregistrés) : rien à faire
        }
      this.controllers.delete(job.requestId);
      this.failedAt =
        job.status === "failed"
          ? this.store.snapshot().workspace.revision
          : null;
      // D-028 : une analyse en appelle parfois une autre (des notes arrivées
      // pendant le calcul, un objectif qui attend des pistes).
      if (this.provider && (this.again || job.status === "applied")) {
        this.again = false;
        this.nudge(0);
      }
    }
  }
}
