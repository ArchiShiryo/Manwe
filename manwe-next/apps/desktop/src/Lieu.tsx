// Le lieu (D-029, BRIEF-007) : on y demeure et on s'y livre. Le visualiseur
// est au centre ; à côté, la conversation avec l'agent (R5.8) et le journal
// pour qui a beaucoup à raconter. L'agent analyse seul (D-028) ; une ligne
// d'activité montre ce qu'il fait, sans rien demander.
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp, BookOpen, MessageCircle } from "lucide-react";
import type {
  AnnotationCommand,
  AnnotationType,
  CaptureCommand,
  WorkspaceSnapshot,
} from "../../../packages/domain/src/memory.ts";
import { WorldGraph } from "./WorldGraph.tsx";
import {
  memoryApi,
  type AgentState,
  type ConversationState,
  type Coverage,
  type MemoryStatus,
} from "./memoryApi.ts";
import { syncLabels, type ConnectionState } from "./syncLabels.ts";

type Annotate = (
  target: AnnotationCommand["target"],
  text: string,
  type: AnnotationType,
) => Promise<boolean>;

const TASK_LABELS: Record<string, string> = {
  extract: "relève les faits",
  interpret: "lit vos notes",
  revise: "revoit ses lectures",
  explore: "cherche des pistes",
};

function elapsed(since: string, now: number) {
  const seconds = Math.max(0, Math.round((now - Date.parse(since)) / 1000));
  return seconds < 60
    ? `${seconds} s`
    : `${Math.floor(seconds / 60)} min ${String(seconds % 60).padStart(2, "0")}`;
}

/** Ce que fait l'agent : une ligne, jamais une question. */
function AgentActivity({
  agent,
  now,
  onRetry,
}: {
  agent: AgentState | null;
  now: number;
  onRetry: () => void;
}) {
  if (!agent?.enabled)
    return (
      <p className="lieu-activity is-idle" role="status">
        Analyse automatique non configurée : vos notes sont conservées, sans
        lecture pour l’instant.
      </p>
    );
  const job = agent.job;
  if (job?.status === "running")
    return (
      <p className="lieu-activity is-running" role="status">
        <span className="lieu-activity-bar" aria-hidden />
        MANWË {TASK_LABELS[job.task ?? ""] ?? "analyse"}
        {job.reason ? ` · ${job.reason}` : ""} · {elapsed(job.startedAt, now)}
      </p>
    );
  if (job?.status === "failed")
    return (
      <p className="lieu-activity is-failed" role="alert">
        La dernière analyse n’a pas abouti : {job.error?.message ?? "erreur"}.
        <button onClick={onRetry}>Réessayer</button>
      </p>
    );
  if (agent.scheduled || agent.next)
    return (
      <p className="lieu-activity" role="status">
        {agent.next?.reason ?? "Nouvelles notes"} MANWË s’y met dans un instant.
      </p>
    );
  return (
    <p className="lieu-activity is-idle" role="status">
      {job?.status === "applied" && job.finishedAt
        ? `À jour · dernière lecture il y a ${elapsed(job.finishedAt, now)}${
            job.applied
              ? ` · ${job.applied.created} ajout${job.applied.created > 1 ? "s" : ""}, ${job.applied.changed} mise${job.applied.changed > 1 ? "s" : ""} à jour`
              : ""
          }`
        : "À jour."}
    </p>
  );
}

/**
 * D-032 : ce que l'agent cherche (son objectif, modifiable) et où en est la
 * carte, pour vous et chaque personne.
 */
function Cartography({
  coverage,
  onMission,
}: {
  coverage: Coverage | null;
  onMission: (text: string | null) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  if (!coverage) return null;
  const percent = (value: number) => `${Math.round(value * 100)} %`;
  return (
    <div
      className="lieu-map"
      aria-label="Objectif de MANWË et couverture de la carte"
    >
      <div className="lieu-mission">
        <span className="eyebrow">OBJECTIF</span>
        {editing ? (
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              await onMission(draft.trim() || null);
              setEditing(false);
            }}
          >
            <input
              aria-label="Objectif de MANWË"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Vide = revenir à : cartographier"
            />
            <button className="text-button">Garder</button>
          </form>
        ) : (
          <>
            <p>{coverage.mission}</p>
            <button
              className="text-button"
              onClick={() => {
                setDraft(coverage.mission);
                setEditing(true);
              }}
            >
              Changer
            </button>
          </>
        )}
      </div>
      <div className="lieu-coverage">
        <span className="eyebrow">CARTE · {percent(coverage.score)}</span>
        <ul>
          {coverage.actors.slice(0, 8).map((actor) => (
            <li
              key={actor.id}
              title={actor.items
                .map((item) => `${item.known ? "✓" : "?"} ${item.label}`)
                .join("\n")}
            >
              <span>{actor.name}</span>
              <i aria-hidden>
                <b style={{ width: percent(actor.score) }} />
              </i>
              <small>{percent(actor.score)}</small>
            </li>
          ))}
        </ul>
        {coverage.gaps[0] && (
          <p className="lieu-next-gap">
            À découvrir : {coverage.gaps[0].label.toLowerCase()}
            {coverage.gaps[0].actorId === "self"
              ? ""
              : ` (${coverage.gaps[0].actor})`}
          </p>
        )}
      </div>
    </div>
  );
}

/** Consentement à la transmission, une seule fois (D-031). */
function Consent({ onAnswer }: { onAnswer: (granted: boolean) => void }) {
  return (
    <div className="lieu-consent" role="dialog" aria-labelledby="consent-title">
      <div className="eyebrow" id="consent-title">
        AVANT DE COMMENCER
      </div>
      <p>
        Pour comprendre ce que vous racontez, MANWË envoie vos notes et ses
        lectures au fournisseur d’analyse (DeepSeek). Rien d’autre ne quitte
        votre ordinateur ; tout reste conservé ici, mot pour mot.
      </p>
      <div className="lieu-consent-actions">
        <button className="primary-button" onClick={() => onAnswer(true)}>
          J’accepte
        </button>
        <button className="text-button" onClick={() => onAnswer(false)}>
          Pas maintenant
        </button>
      </div>
    </div>
  );
}

function Conversation({
  state,
  onSay,
}: {
  state: ConversationState | null;
  onSay: (text: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const turns = state?.turns ?? [];
  useEffect(() => {
    end.current?.scrollIntoView?.({ block: "end" });
  }, [turns.length, state?.thinking]);
  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      await onSay(text);
      setDraft("");
    } finally {
      setSending(false);
    }
  };
  return (
    <div className="lieu-conversation">
      <div className="lieu-turns" aria-live="polite">
        {turns.length === 0 && !state?.thinking && (
          <p className="lieu-hint">
            Racontez ce que vous voulez : votre journée, une personne qui
            compte, quelque chose qui vous travaille.
          </p>
        )}
        {turns.map((turn) => (
          <div key={turn.id} className={`lieu-turn is-${turn.role}`}>
            {turn.text}
          </div>
        ))}
        {state?.thinking && (
          <div
            className="lieu-turn is-agent is-thinking"
            aria-label="MANWË réfléchit"
          >
            <span />
            <span />
            <span />
          </div>
        )}
        {state?.error && !state.thinking && (
          <p className="lieu-hint" role="alert">
            MANWË n’a pas pu répondre ({state.error}). Votre message est
            conservé.
          </p>
        )}
        <div ref={end} />
      </div>
      <form
        className="lieu-input"
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        <textarea
          aria-label="Écrire à MANWË"
          placeholder="Écrire…"
          rows={2}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault();
              void send();
            }
          }}
        />
        <button
          className="send-button"
          disabled={!draft.trim() || sending}
          aria-label="Envoyer"
        >
          <ArrowUp size={18} />
        </button>
      </form>
    </div>
  );
}

function Journal({
  snapshot,
  onWrite,
}: {
  snapshot: WorkspaceSnapshot;
  onWrite: (input: Omit<CaptureCommand, "idempotencyKey">) => Promise<void>;
}) {
  const [draft, setDraft] = useState("");
  const [context, setContext] = useState("");
  const [sending, setSending] = useState(false);
  const entries = [...snapshot.sources]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, 30);
  return (
    <div className="lieu-journal">
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          if (!draft.trim() || sending) return;
          setSending(true);
          try {
            await onWrite({
              text: draft,
              narratedAt: new Date().toISOString(),
              context: context.trim() || null,
            });
            setDraft("");
          } finally {
            setSending(false);
          }
        }}
      >
        <textarea
          aria-label="Écrire dans le journal"
          placeholder="Écrivez aussi longtemps que vous voulez. Chaque entrée est gardée telle quelle."
          rows={7}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <div className="lieu-journal-actions">
          <input
            aria-label="Milieu (facultatif)"
            placeholder="Milieu : travail, famille, club… (facultatif)"
            value={context}
            onChange={(event) => setContext(event.target.value)}
          />
          <button
            className="primary-button"
            disabled={!draft.trim() || sending}
          >
            Déposer
          </button>
        </div>
      </form>
      <ol className="lieu-entries" aria-label="Entrées récentes">
        {entries.map((source) => (
          <li key={source.id}>
            <small>
              {new Date(source.createdAt).toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "short",
              })}
            </small>
            <p>{source.content}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function Lieu({
  snapshot,
  onReload,
  onAnnotate,
  onWrite,
  connection = "online",
  remote = null,
}: {
  snapshot: WorkspaceSnapshot;
  onReload: () => Promise<unknown> | void;
  onAnnotate?: Annotate;
  onWrite: (input: Omit<CaptureCommand, "idempotencyKey">) => Promise<void>;
  connection?: ConnectionState;
  remote?: MemoryStatus | null;
}) {
  const labels = syncLabels(connection, remote);
  const [agent, setAgent] = useState<AgentState | null>(null);
  const [conversation, setConversation] = useState<ConversationState | null>(
    null,
  );
  const [side, setSide] = useState<"conversation" | "journal">("conversation");
  const [coverage, setCoverage] = useState<Coverage | null>(null);
  const [now, setNow] = useState(Date.now());
  const lastApplied = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [nextAgent, nextConversation, nextCoverage] = await Promise.all([
        memoryApi.agent(),
        memoryApi.conversation(),
        memoryApi.coverage(),
      ]);
      setAgent(nextAgent);
      setConversation(nextConversation);
      setCoverage(nextCoverage);
      // Une analyse appliquée change le monde : on relit la mémoire.
      const job = nextAgent.job;
      if (job?.status === "applied" && job.requestId !== lastApplied.current) {
        if (lastApplied.current !== null) void onReload();
        lastApplied.current = job.requestId;
      } else if (lastApplied.current === null)
        lastApplied.current = job?.requestId ?? "";
    } catch {
      // service momentanément absent : l'état de connexion le dit ailleurs
    }
  }, [onReload]);

  useEffect(() => {
    void refresh().then(() => {
      void memoryApi
        .openConversation()
        .then(setConversation)
        .catch(() => {});
    });
  }, [refresh]);

  // Rythme de lecture de l'état : rapide quand quelque chose se passe.
  const busy =
    agent?.job?.status === "running" ||
    agent?.scheduled ||
    conversation?.thinking;
  useEffect(() => {
    const timer = setInterval(
      () => {
        setNow(Date.now());
        void refresh();
      },
      busy ? 1500 : 6000,
    );
    return () => clearInterval(timer);
  }, [busy, refresh]);

  const needsConsent = agent?.enabled && !agent.consent;

  return (
    <section className="lieu" aria-label="Votre monde">
      {/* R4.7 : état de la connexion au service local et révision affichée. */}
      <div
        className={`personal-status-row ${connection === "reconnecting" ? "is-offline" : ""}`}
        role="status"
      >
        <span>
          <i /> {labels.connection}
        </span>
        {labels.analysis && <span>{labels.analysis}</span>}
        <span>
          {connection === "reconnecting"
            ? "Affichage : révision "
            : "Révision "}
          {snapshot.workspace.revision.toString().padStart(2, "0")}
        </span>
      </div>
      <AgentActivity
        agent={agent}
        now={now}
        onRetry={() => {
          const task = agent?.next?.task ?? agent?.job?.task ?? "interpret";
          void memoryApi
            .startAutomatic(task as "interpret")
            .then(refresh)
            .catch(() => refresh());
        }}
      />
      <Cartography
        coverage={coverage}
        onMission={async (text) => {
          await memoryApi.setMission(text);
          await refresh();
        }}
      />
      <div className="lieu-body">
        <div className="lieu-visualizer">
          {snapshot.persons.length || snapshot.relations.length ? (
            <WorldGraph snapshot={snapshot} onAnnotate={onAnnotate} />
          ) : (
            <p className="lieu-empty">
              Votre monde apparaîtra ici, au fil de ce que vous racontez : les
              personnes, les liens, les milieux.
            </p>
          )}
        </div>
        <aside className="lieu-side" aria-label="Parler et écrire">
          <div className="segmented lieu-tabs" role="tablist">
            <button
              role="tab"
              aria-selected={side === "conversation"}
              className={side === "conversation" ? "active" : ""}
              onClick={() => setSide("conversation")}
            >
              <MessageCircle size={14} /> Conversation
            </button>
            <button
              role="tab"
              aria-selected={side === "journal"}
              className={side === "journal" ? "active" : ""}
              onClick={() => setSide("journal")}
            >
              <BookOpen size={14} /> Journal
            </button>
          </div>
          {needsConsent && (
            <Consent
              onAnswer={(granted) =>
                void memoryApi
                  .consent(granted)
                  .then(setAgent)
                  .then(refresh)
                  .catch(() => {})
              }
            />
          )}
          {side === "conversation" ? (
            <Conversation
              state={conversation}
              onSay={async (text) => {
                await memoryApi.say(text);
                await refresh();
                void onReload();
              }}
            />
          ) : (
            <Journal
              snapshot={snapshot}
              onWrite={async (input) => {
                await onWrite(input);
                await refresh();
              }}
            />
          )}
        </aside>
      </div>
    </section>
  );
}
