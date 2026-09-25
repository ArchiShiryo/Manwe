// R5.8 · la conversation du lieu (D-029). L'agent lit la mémoire, accueille
// ce que la personne dit et pose une seule question, fondée sur un creux réel
// de la mémoire. Chaque message de la personne devient une note ; l'analyse
// suit d'elle-même (D-028).
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import type { SqliteMemoryStore } from "../../../packages/storage/src/sqliteStore.ts";
import type { EntityRef } from "../../../packages/domain/src/memory.ts";
import { MEMORY_TOOLS } from "../../../packages/cognition/src/memoryTools.ts";
import type { ProviderConfig } from "./analystProvider.ts";

export const INTERVIEWER_PROMPT = readFileSync(
  new URL(
    "../../../packages/cognition/prompts/interviewer-v1.md",
    import.meta.url,
  ),
  "utf8",
);

const GAPS = [
  "milieu",
  "personne",
  "periode",
  "episode",
  "lecture",
  "suivi",
  "ouverture",
  "detresse",
  "modelisation",
] as const;

export class Interviewer {
  private readonly store: SqliteMemoryStore;
  private readonly provider: ProviderConfig | null;
  private thinking: Promise<void> | null = null;
  private lastError: string | null = null;

  /** DEMO-R5-7 (constat 26) : la conversation peut lancer la modélisation. */
  private readonly onModel: () => void;
  /** Ce que l'agent d'analyse fait, pour que la conversation le dise juste. */
  private readonly analysisState: () => unknown;

  constructor(
    store: SqliteMemoryStore,
    provider: ProviderConfig | null,
    hooks: { onModel?: () => void; analysisState?: () => unknown } = {},
  ) {
    this.store = store;
    this.provider = provider;
    this.onModel = hooks.onModel ?? (() => {});
    this.analysisState = hooks.analysisState ?? (() => null);
  }

  state() {
    return {
      enabled: this.provider !== null,
      consent: this.store.transmissionConsent,
      thinking: this.thinking !== null,
      error: this.lastError,
      turns: this.store.conversation(),
    };
  }

  /** Message de la personne : note citable, puis réponse de l'agent. */
  say(idempotencyKey: string, text: string) {
    const turn = this.store.addConversationTurn({
      idempotencyKey,
      role: "user",
      text,
    });
    this.reply();
    return turn;
  }

  /** Ouvre ou relance la conversation si la dernière parole n'est pas de l'agent. */
  open() {
    const turns = this.store.conversation();
    if (turns.at(-1)?.role !== "agent") this.reply();
    return this.state();
  }

  /** Attend la réponse en cours (tests). */
  async settle() {
    while (this.thinking) await this.thinking;
  }

  private reply() {
    if (!this.provider || this.thinking || !this.store.transmissionConsent)
      return;
    let failed = false;
    this.thinking = this.ask()
      .catch((error: unknown) => {
        failed = true;
        this.lastError =
          error instanceof Error ? error.message.slice(0, 300) : String(error);
        console.error(`[conversation] ${this.lastError}`);
      })
      .finally(() => {
        this.thinking = null;
        // La personne a peut-être écrit pendant la réflexion : on lui répond.
        // Après un échec, on attend son prochain message (pas de boucle).
        if (!failed && this.store.conversation().at(-1)?.role === "user")
          this.reply();
      });
  }

  /** Délai maximal d'une réponse, sans retenir le processus à l'arrêt. */
  private deadline(ms: number) {
    const controller = new AbortController();
    setTimeout(() => controller.abort(new Error("Délai dépassé.")), ms).unref();
    return controller.signal;
  }

  private async ask() {
    const provider = this.provider as ProviderConfig;
    const turnId = randomUUID();
    const conversation = this.store
      .conversation(24)
      .map((turn) => ({ role: turn.role, text: turn.text }));
    const prompt = `${INTERVIEWER_PROMPT.trimEnd()}\n\n${JSON.stringify(
      {
        mission: this.store.agentMission,
        coverage: (({ score, gaps }) => ({ score, gaps }))(
          this.store.coveragePlan(),
        ),
        memory: {
          ...this.store.interviewDigest(),
          analysis: this.analysisState(),
        },
        conversation,
      },
      null,
      2,
    )}\n`;
    const call = await provider.call({
      prompt,
      signal: this.deadline(5 * 60 * 1000),
      tools: MEMORY_TOOLS,
      executeTool: (name, args) =>
        this.store.queryMemory(`conversation:${turnId}`, name, args),
    });
    const parsed = JSON.parse(call.content) as {
      reply?: unknown;
      gap?: unknown;
      motive?: unknown;
      action?: unknown;
      profile?: unknown;
    };
    if (parsed.action === "modeliser") this.onModel();
    // D-032 : un champ du profil n'est gardé que s'il cite mot pour mot le
    // dernier message de la personne.
    const lastSaid = this.store
      .conversation(24)
      .filter((turn) => turn.role === "user" && turn.sourceId)
      .at(-1);
    for (const entry of Array.isArray(parsed.profile) ? parsed.profile : [])
      if (lastSaid?.sourceId && entry && typeof entry === "object")
        try {
          this.store.setProfileField({
            field: String((entry as { field?: unknown }).field ?? ""),
            value: String((entry as { value?: unknown }).value ?? ""),
            quote: String((entry as { quote?: unknown }).quote ?? ""),
            sourceId: lastSaid.sourceId,
          });
        } catch {
          // citation inexacte ou champ inconnu : ignoré, jamais inventé
        }
    const reply =
      typeof parsed.reply === "string" ? parsed.reply.trim().slice(0, 600) : "";
    if (!reply) throw new Error("Réponse de l’agent vide.");
    const gap = GAPS.includes(parsed.gap as (typeof GAPS)[number])
      ? String(parsed.gap)
      : null;
    // Seuls les objets qui existent dans la mémoire sont gardés comme motif.
    const snapshot = this.store.snapshot();
    const known = new Set([
      ...snapshot.persons.map((item) => `person:${item.id}`),
      ...snapshot.hypotheses.map((item) => `hypothesis:${item.id}`),
      ...snapshot.questions.map((item) => `question:${item.id}`),
      ...snapshot.events.map((item) => `event:${item.id}`),
    ]);
    const motive = (Array.isArray(parsed.motive) ? parsed.motive : [])
      .filter(
        (item): item is EntityRef =>
          !!item &&
          typeof item === "object" &&
          known.has(`${(item as EntityRef).kind}:${(item as EntityRef).id}`),
      )
      .slice(0, 5)
      .map((item) => ({ kind: item.kind, id: item.id }) as EntityRef);
    this.lastError = null;
    this.store.addConversationTurn({
      idempotencyKey: turnId,
      role: "agent",
      text: reply,
      gap,
      motive,
    });
  }
}
