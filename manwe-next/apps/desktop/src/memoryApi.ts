import type {
  AnnotationCommand,
  AnswerQuestionCommand,
  ChooseDirectionCommand,
  RecordOutcomeCommand,
  CaptureCommand,
  CommandResult,
  GoalCommand,
  ImportCommand,
  ImportResult,
  MemorySearchQuery,
  MemorySearchResult,
  ResolveIdentityCommand,
  WorkspaceSnapshot,
} from "../../../packages/domain/src/memory.ts";
import type {
  AnalysisPreview,
  ApplicationResult,
  CognitiveProposal,
  ContextPacket,
  PrepareAnalysisCommand,
} from "../../../packages/cognition/src/contract.ts";
import type {
  FocusContext,
  GraphProjection,
} from "../../../packages/cognition/src/projection.ts";
import type { Synthesis } from "../../../packages/cognition/src/synthesis.ts";

export type MemoryStatus = {
  revision: number;
  analyses: {
    awaitingResponse: number;
    readyForReview: number;
    needsContext: number;
    modes: string[];
  };
};

export type AutomaticJob = {
  requestId: string;
  task?: "extract" | "interpret" | "revise" | "explore";
  /** D-028 : pourquoi l'agent a lancé cette analyse (null si demandée). */
  reason?: string | null;
  applied?: {
    revision: number;
    created: number;
    changed: number;
    warnings: { code: string; message: string }[];
  } | null;
  status:
    | "running"
    | "ready_for_review"
    | "applied"
    | "needs_context"
    | "failed"
    | "cancelled";
  startedAt: string;
  finishedAt: string | null;
  attempts: { status: string; errors: { code: string; message: string }[] }[];
  preview: AnalysisPreview | null;
  error: { code: string; message: string } | null;
};

/** D-028 : ce que fait l'agent, ce qu'il a fait, ce qu'il fera ensuite. */
export type AgentState = {
  enabled: boolean;
  consent: boolean;
  job: AutomaticJob | null;
  scheduled: boolean;
  next: { task: string; reason: string } | null;
};

export type ConversationTurn = {
  id: string;
  role: "user" | "agent";
  text: string;
  sourceId: string | null;
  gap: string | null;
  motive: { kind: string; id: string }[];
  createdAt: string;
};

export type ConversationState = {
  enabled: boolean;
  consent: boolean;
  thinking: boolean;
  error: string | null;
  turns: ConversationTurn[];
};

const API_ORIGIN = "http://127.0.0.1:5181";

export class MemoryApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "MemoryApiError";
  }
}

class MemoryApi {
  private session: Promise<void> | null = null;

  private async openSession() {
    const response = await fetch(`${API_ORIGIN}/api/session`, {
      method: "POST",
      credentials: "include",
    });
    if (!response.ok) throw await this.error(response);
  }

  private ensureSession() {
    this.session ??= this.openSession().catch((error) => {
      this.session = null;
      throw error;
    });
    return this.session;
  }

  private async error(response: Response) {
    try {
      const body = (await response.json()) as {
        error?: { code?: string; message?: string };
      };
      return new MemoryApiError(
        body.error?.code ?? "request_failed",
        body.error?.message ?? "Le service local a refusé la requête.",
        response.status,
      );
    } catch {
      return new MemoryApiError(
        "request_failed",
        "Le service local a renvoyé une réponse illisible.",
        response.status,
      );
    }
  }

  private async request<T>(
    path: string,
    init?: RequestInit,
    retry = true,
  ): Promise<T> {
    await this.ensureSession();
    let response: Response;
    try {
      response = await fetch(`${API_ORIGIN}${path}`, {
        ...init,
        credentials: "include",
        headers: {
          ...(init?.body ? { "content-type": "application/json" } : {}),
          ...init?.headers,
        },
      });
    } catch {
      throw new MemoryApiError(
        "service_unavailable",
        "Le service de mémoire locale ne répond pas.",
        0,
      );
    }
    if (response.status === 401 && retry) {
      this.session = null;
      return this.request<T>(path, init, false);
    }
    if (!response.ok) throw await this.error(response);
    return response.json() as Promise<T>;
  }

  snapshot() {
    return this.request<WorkspaceSnapshot>("/api/workspace");
  }

  status() {
    return this.request<MemoryStatus>("/api/status");
  }

  graph(focus: FocusContext) {
    const params = new URLSearchParams({ kind: focus.kind, id: focus.id });
    return this.request<GraphProjection & { synthesis: Synthesis }>(
      `/api/graph?${params}`,
    );
  }

  search(query: MemorySearchQuery) {
    const params = new URLSearchParams();
    const apiQuery = {
      q: query.text,
      personId: query.personId,
      context: query.context,
      from: query.occurredFrom,
      to: query.occurredTo,
      limit: query.limit,
    };
    for (const [key, value] of Object.entries(apiQuery))
      if (value !== undefined) params.set(key, String(value));
    return this.request<{ results: MemorySearchResult[] }>(
      `/api/search?${params}`,
    );
  }

  async capture(command: CaptureCommand) {
    await this.request<CommandResult>("/api/captures", {
      method: "POST",
      body: JSON.stringify(command),
    });
    return this.snapshot();
  }

  async importData(command: ImportCommand) {
    const result = await this.request<ImportResult>("/api/imports", {
      method: "POST",
      body: JSON.stringify(command),
    });
    return { result, snapshot: await this.snapshot() };
  }

  async resolveIdentity(command: ResolveIdentityCommand) {
    await this.request<CommandResult>(
      `/api/identities/ambiguities/${encodeURIComponent(command.ambiguityId)}/resolve`,
      { method: "POST", body: JSON.stringify(command) },
    );
    return this.snapshot();
  }

  async annotate(command: AnnotationCommand) {
    await this.request<CommandResult>("/api/annotations", {
      method: "POST",
      body: JSON.stringify(command),
    });
    return this.snapshot();
  }

  async answerQuestion(command: AnswerQuestionCommand) {
    await this.request<CommandResult>(
      `/api/questions/${encodeURIComponent(command.questionId)}/answer`,
      { method: "POST", body: JSON.stringify(command) },
    );
    return this.snapshot();
  }

  async chooseDirection(command: ChooseDirectionCommand) {
    await this.request<CommandResult>("/api/actions", {
      method: "POST",
      body: JSON.stringify(command),
    });
    return this.snapshot();
  }

  async recordOutcome(command: RecordOutcomeCommand) {
    await this.request<CommandResult>(
      `/api/actions/${encodeURIComponent(command.actionId)}/outcome`,
      { method: "POST", body: JSON.stringify(command) },
    );
    return this.snapshot();
  }

  async dismissGoal(goalId: string) {
    await this.request<CommandResult>(
      `/api/goals/${encodeURIComponent(goalId)}/dismiss`,
      {
        method: "POST",
        body: JSON.stringify({
          idempotencyKey: `goal:dismiss:${crypto.randomUUID()}`,
        }),
      },
    );
    return this.snapshot();
  }

  async updateGoal(command: GoalCommand) {
    await this.request<CommandResult>("/api/goals", {
      method: "POST",
      body: JSON.stringify(command),
    });
    return this.snapshot();
  }

  prepareAnalysis(command: PrepareAnalysisCommand) {
    return this.request<ContextPacket>("/api/analyses", {
      method: "POST",
      body: JSON.stringify(command),
    });
  }

  receiveAnalysis(proposal: CognitiveProposal) {
    return this.request<AnalysisPreview>(
      `/api/analyses/${encodeURIComponent(proposal.requestId)}/responses`,
      { method: "POST", body: JSON.stringify(proposal) },
    );
  }

  applyAnalysis(requestId: string, responseId: string) {
    return this.request<ApplicationResult>(
      `/api/analyses/${encodeURIComponent(requestId)}/apply`,
      {
        method: "POST",
        body: JSON.stringify({ requestId, responseId, confirmed: true }),
      },
    );
  }

  automaticProvider() {
    return this.request<{
      enabled: boolean;
      providerId: string | null;
      model: string | null;
      budget: { dailyTokens: number | null; usedToday: number } | null;
    }>("/api/analyses/automatic");
  }

  startAutomatic(
    task: "extract" | "interpret" | "revise" | "explore",
    focus?: { kind: string; id: string }[],
  ) {
    return this.request<AutomaticJob>("/api/analyses/automatic", {
      method: "POST",
      body: JSON.stringify(focus ? { task, focus } : { task }),
    });
  }

  automaticJob(requestId: string) {
    return this.request<AutomaticJob>(
      `/api/analyses/automatic/${encodeURIComponent(requestId)}`,
    );
  }

  agent() {
    return this.request<AgentState>("/api/analyses/automatic/current");
  }

  consent(granted: boolean) {
    return this.request<AgentState>("/api/agent/consent", {
      method: "POST",
      body: JSON.stringify({ granted }),
    });
  }

  conversation() {
    return this.request<ConversationState>("/api/conversation");
  }

  openConversation() {
    return this.request<ConversationState>("/api/conversation/open", {
      method: "POST",
      body: JSON.stringify({}),
    });
  }

  say(text: string) {
    return this.request<ConversationTurn>("/api/conversation/messages", {
      method: "POST",
      body: JSON.stringify({ idempotencyKey: crypto.randomUUID(), text }),
    });
  }

  renamePerson(
    personId: string,
    change: {
      displayName?: string;
      relatedPersonId?: string | null;
      relationLabel?: string | null;
    },
  ) {
    return this.request<CommandResult>(
      `/api/persons/${encodeURIComponent(personId)}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          idempotencyKey: crypto.randomUUID(),
          ...change,
        }),
      },
    );
  }

  cancelAnalysis(requestId: string) {
    return this.request<{ requestId: string; status: "cancelled" }>(
      `/api/analyses/${encodeURIComponent(requestId)}/cancel`,
      { method: "POST", body: JSON.stringify({}) },
    );
  }
}

export const memoryApi = new MemoryApi();
