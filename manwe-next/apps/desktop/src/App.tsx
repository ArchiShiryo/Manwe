import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowUp,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Command,
  Compass,
  Database,
  GitBranch,
  Layers3,
  Maximize2,
  Network,
  PanelRightOpen,
  Search,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import {
  addAnnotation,
  answerQuestion,
  captureNote,
  initialSelection,
  people,
  selectionTitle,
  type Page,
  type Selection,
} from "../../../packages/domain/src/demo.ts";
import type {
  AnnotationCommand,
  AnnotationType,
  TemporalPrecision,
} from "../../../packages/domain/src/memory.ts";
import { Graph } from "./Graph.tsx";
import { Inspector } from "./Inspector.tsx";
import {
  PersonalIntentions,
  PersonalLoading,
  PersonalMemory,
  PersonalPeople,
  PersonalUnavailable,
  PersonalWorld,
} from "./PersonalSurfaces.tsx";
import { IntentionsView, MemoryView, PeopleView } from "./Surfaces.tsx";
import { usePersonalWorkspace } from "./usePersonalWorkspace.ts";
import { useWorkspace } from "./useWorkspace.ts";
import { Sigil } from "./ui.tsx";

function Modal({
  title,
  onClose,
  children,
  className = "",
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${className}`}
      aria-label={title}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const rect = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < rect.left ||
            e.clientX > rect.right ||
            e.clientY < rect.top ||
            e.clientY > rect.bottom
          )
            onClose();
        }
      }}
    >
      <div className="modal-heading">
        <h2>{title}</h2>
        <button
          className="icon-button"
          aria-label="Fermer la fenêtre"
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </div>
      {children}
    </dialog>
  );
}

const navItems = [
  { id: "world", label: "Mon monde", icon: Network },
  { id: "people", label: "Personnes", icon: Users },
  { id: "intentions", label: "Intentions", icon: Compass },
  { id: "memory", label: "Mémoire", icon: BookOpen },
] as const;
const pageCopy = {
  world: {
    eyebrow: "VOTRE MONDE, EN PERSPECTIVE",
    title: "Les liens se dessinent.",
    subtitle: "Un peu de recul pour comprendre ce qui vous rapproche.",
  },
  people: {
    eyebrow: "CELLES ET CEUX QUI COMPTENT",
    title: "Des liens, des personnes.",
    subtitle:
      "Retrouver le contexte d’une relation, sans enfermer une personne dans un portrait.",
  },
  intentions: {
    eyebrow: "UNE DIRECTION, À VOTRE RYTHME",
    title: "Faire place à l’essentiel.",
    subtitle:
      "Ce que vous souhaitez cultiver, et les possibilités qui s’ouvrent.",
  },
  memory: {
    eyebrow: "LE FIL DE CE QUE VOUS PARTAGEZ",
    title: "Rien ne part de rien.",
    subtitle:
      "Revenir aux mots d’origine. Retrouver une nuance. Garder le contexte.",
  },
};

export default function App() {
  const { state, setState, warning } = useWorkspace();
  const [mode, setMode] = useState<"demo" | "personal">("demo");
  const personal = usePersonalWorkspace(mode === "personal");
  const [page, setPage] = useState<Page>("world");
  const [selection, setSelection] = useState<Selection>(initialSelection);
  const [inspectorOpen, setInspectorOpen] = useState(
    () => window.innerWidth >= 1000,
  );
  const [context, setContext] = useState<"all" | "work" | "friends">("all");
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [infoOpen, setInfoOpen] = useState(false);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [captureDetailsOpen, setCaptureDetailsOpen] = useState(false);
  const [eventPrecision, setEventPrecision] =
    useState<TemporalPrecision>("unknown");
  const [eventStart, setEventStart] = useState("");
  const [eventEnd, setEventEnd] = useState("");
  const [noteContext, setNoteContext] = useState("");
  const [toast, setToast] = useState("");
  const [toastSequence, setToastSequence] = useState(0);
  const [focusGraph, setFocusGraph] = useState(false);
  const composer = useRef<HTMLTextAreaElement>(null);
  const notify = (message: string) => {
    setToast(message);
    setToastSequence((n) => n + 1);
  };
  const annotatePersonal = async (
    target: AnnotationCommand["target"],
    text: string,
    type: AnnotationType,
  ) => {
    try {
      await personal.annotate(target, text, type);
      notify("Précision conservée sans modifier la source");
      return true;
    } catch {
      notify("La précision n’a pas pu être enregistrée");
      return false;
    }
  };
  const select = (s: Selection) => {
    setSelection(s);
    if (mode === "demo") setInspectorOpen(true);
  };
  const navigate = (next: Page) => {
    setPage(next);
    setFocusGraph(false);
  };
  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(timeout);
  }, [toast, toastSequence]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((open) => !open);
      }
      if (e.key === "Escape" && !document.querySelector("dialog[open]")) {
        setFocusGraph(false);
        if (window.innerWidth < 1000) setInspectorOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  const saveNote = async () => {
    if (!draft.trim()) return;
    if (mode === "personal") {
      if (eventPrecision === "interval" && (!eventStart || !eventEnd)) {
        setCaptureDetailsOpen(true);
        notify("Indiquez le début et la fin de l’intervalle");
        return;
      }
      if (eventPrecision !== "unknown" && !eventStart) {
        setCaptureDetailsOpen(true);
        notify("Indiquez la date de l’événement");
        return;
      }
      const occurrenceIso = (value: string) =>
        value ? new Date(`${value}T12:00:00`).toISOString() : null;
      try {
        await personal.capture({
          text: draft,
          narratedAt: new Date().toISOString(),
          occurredStart: occurrenceIso(eventStart),
          occurredEnd:
            eventPrecision === "interval" ? occurrenceIso(eventEnd) : null,
          temporalPrecision: eventPrecision,
          context: noteContext.trim() || null,
        });
        setDraft("");
        setEventPrecision("unknown");
        setEventStart("");
        setEventEnd("");
        setNoteContext("");
        setCaptureDetailsOpen(false);
        navigate("memory");
        notify("Note conservée dans la mémoire SQLite · texte non analysé");
      } catch {
        notify("La note n’a pas été enregistrée · votre texte reste ici");
      }
      return;
    }
    const id = crypto.randomUUID();
    setState((previous) =>
      captureNote(previous, draft, id, new Date().toISOString()),
    );
    setDraft("");
    select({ kind: "event", id });
    notify("Note conservée localement · texte non analysé");
  };
  const demoSearchEntries: {
    selection: Selection;
    title: string;
    type: string;
    text?: string;
  }[] = [
    ...people.map((p) => ({
      selection: { kind: "person" as const, id: p.id },
      title: p.name,
      type: "Personne",
    })),
    ...state.events.map((e) => ({
      selection: { kind: "event" as const, id: e.id },
      title: e.title,
      type: "Mémoire",
      text: e.text,
    })),
    ...(["closeness", "alternative"] as const).map((id) => ({
      selection: { kind: "hypothesis" as const, id },
      title: selectionTitle({ kind: "hypothesis", id }, state),
      type: "Hypothèse",
    })),
    {
      selection: { kind: "goal", id: "friendship" },
      title: state.goalText,
      type: "Intention",
    },
  ];
  const personalSearchEntries: {
    selection: Selection;
    title: string;
    type: string;
    text?: string;
  }[] = [
    ...(personal.snapshot?.events ?? []).map((event) => ({
      selection: { kind: "event" as const, id: event.id },
      title: event.title,
      type: "Mémoire",
      text: [event.text, event.context, event.occurredStart, event.occurredEnd]
        .filter(Boolean)
        .join(" "),
    })),
    ...(personal.snapshot?.goals ?? []).map((goal) => ({
      selection: { kind: "goal" as const, id: goal.id },
      title: goal.text,
      type: "Intention",
    })),
  ];
  const searchEntries =
    mode === "personal" ? personalSearchEntries : demoSearchEntries;
  const normalize = (text: string) =>
    text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const results = searchEntries
    .filter((e) =>
      normalize(`${e.title} ${e.type} ${e.text ?? ""}`).includes(
        normalize(search),
      ),
    )
    .slice(0, 12);
  const pageInfo = pageCopy[page];
  return (
    <div
      className={`app-shell ${mode === "demo" && inspectorOpen ? "with-inspector" : ""} ${focusGraph ? "focused-layout" : ""}`}
    >
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate("world");
          }}
          aria-label="MANWË, mon monde"
        >
          <Sigil />
          <span>MANWË</span>
        </a>
        <button
          className="workspace-switch"
          onClick={() => setWorkspaceOpen(true)}
        >
          <span className="workspace-initial">M</span>
          <span>
            Mon espace
            <small>
              {mode === "personal" ? "Mémoire locale" : "Démonstration"}
            </small>
          </span>
          <ChevronDown size={13} />
        </button>
        <nav aria-label="Navigation principale">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              aria-label={label}
              onClick={() => navigate(id)}
              className={`nav-item ${page === id ? "active" : ""}`}
              aria-current={page === id ? "page" : undefined}
            >
              <Icon size={18} strokeWidth={1.6} />
              <span>{label}</span>
              {id === "world" && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        {mode === "demo" ? (
          <div className="sidebar-contexts">
            <div className="sidebar-label">
              CONTEXTES <Layers3 size={12} />
            </div>
            <button
              className={
                page === "world" && context === "work" ? "current" : ""
              }
              onClick={() => {
                navigate("world");
                setContext(context === "work" ? "all" : "work");
              }}
            >
              <span className="context-dot sage" />
              Le groupe du travail
            </button>
            <button
              className={
                page === "world" && context === "friends" ? "current" : ""
              }
              onClick={() => {
                navigate("world");
                setContext(context === "friends" ? "all" : "friends");
              }}
            >
              <span className="context-dot clay" />
              Amitiés proches
            </button>
          </div>
        ) : (
          <div className="sidebar-contexts personal-context">
            <div className="sidebar-label">
              ESPACE LOCAL <Database size={12} />
            </div>
            <p>
              {personal.snapshot?.events.length ?? 0} note
              {personal.snapshot?.events.length === 1 ? "" : "s"} · révision{" "}
              {personal.snapshot?.workspace.revision ?? 0}
            </p>
          </div>
        )}
        <div className="sidebar-bottom">
          <div className="sidebar-quote">
            <span>«</span>
            <p>
              Comprendre un peu mieux.
              <br />
              Avancer à votre rythme.
            </p>
          </div>
          <button className="help-link" onClick={() => setInfoOpen(true)}>
            <CircleHelp size={16} />
            <span>À propos de cet espace</span>
          </button>
          <div className="profile">
            <span className="profile-symbol">
              <Sigil small />
            </span>
            <span>
              Votre espace privé
              <small>
                <i />
                {mode === "personal"
                  ? "Mémoire SQLite"
                  : "Démonstration locale"}
              </small>
            </span>
          </div>
        </div>
      </aside>
      <div className="workspace-main">
        <header className="topbar">
          <div className="breadcrumbs">
            <span>Mon espace</span>
            <ChevronRight size={12} />
            <strong>{navItems.find((n) => n.id === page)?.label}</strong>
          </div>
          <div className="topbar-actions">
            <button
              className="search-trigger"
              aria-label="Rechercher dans l’espace"
              onClick={() => {
                setSearch("");
                setSearchOpen(true);
              }}
            >
              <Search size={15} />
              <span>Rechercher</span>
              <kbd>Ctrl K</kbd>
            </button>
            <span className="topbar-divider" />
            <button
              className={`demo-pill ${mode === "personal" ? "personal" : ""}`}
              onClick={() => setWorkspaceOpen(true)}
            >
              <span />
              {mode === "personal" ? "Mémoire locale" : "Démonstration"}
            </button>
          </div>
        </header>
        <div className="main-content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">{pageInfo.eyebrow}</div>
              <h1>{pageInfo.title}</h1>
              <p>{pageInfo.subtitle}</p>
            </div>
            <div className="heading-actions">
              {mode === "demo" && page === "world" && (
                <button
                  className={`icon-button ${focusGraph ? "active" : ""}`}
                  aria-label={
                    focusGraph ? "Quitter la vue étendue" : "Étendre le graphe"
                  }
                  aria-pressed={focusGraph}
                  onClick={() => setFocusGraph((value) => !value)}
                >
                  <Maximize2 size={17} />
                </button>
              )}
              {mode === "demo" && (
                <button
                  className={`icon-button inspector-toggle ${inspectorOpen ? "active" : ""}`}
                  aria-label={
                    inspectorOpen
                      ? "Masquer les détails"
                      : "Afficher les détails"
                  }
                  aria-expanded={inspectorOpen}
                  onClick={() => setInspectorOpen((value) => !value)}
                >
                  <PanelRightOpen size={18} />
                </button>
              )}
            </div>
          </div>
          <div className="content-grid">
            <div className="main-column">
              {mode === "demo" && page === "world" && (
                <Graph
                  state={state}
                  selection={selection}
                  onSelect={select}
                  context={context}
                />
              )}
              {mode === "demo" && page === "people" && (
                <PeopleView state={state} onSelect={select} />
              )}
              {mode === "demo" && page === "memory" && (
                <MemoryView state={state} onSelect={select} />
              )}
              {mode === "demo" && page === "intentions" && (
                <IntentionsView
                  state={state}
                  onSelect={(s) => {
                    navigate("world");
                    select(s);
                  }}
                  onSave={(text) => {
                    setState((s) => ({
                      ...s,
                      goalText: text,
                      revision: s.revision + 1,
                    }));
                    notify("Votre intention a été mise à jour");
                  }}
                />
              )}
              {mode === "personal" &&
                !personal.snapshot &&
                personal.status === "connecting" && <PersonalLoading />}
              {mode === "personal" &&
                !personal.snapshot &&
                personal.status === "error" && (
                  <PersonalUnavailable
                    message={
                      personal.error ?? "Le service local ne répond pas."
                    }
                    onRetry={() => void personal.reload()}
                  />
                )}
              {mode === "personal" && personal.snapshot && page === "world" && (
                <PersonalWorld
                  snapshot={personal.snapshot}
                  onMemory={() => navigate("memory")}
                  onAnnotate={annotatePersonal}
                />
              )}
              {mode === "personal" &&
                personal.snapshot &&
                page === "people" && (
                  <PersonalPeople
                    snapshot={personal.snapshot}
                    onReload={personal.reload}
                    onNotify={notify}
                  />
                )}
              {mode === "personal" &&
                personal.snapshot &&
                page === "memory" && (
                  <PersonalMemory
                    snapshot={personal.snapshot}
                    onReload={personal.reload}
                    onNotify={notify}
                    onAnnotate={annotatePersonal}
                  />
                )}
              {mode === "personal" &&
                personal.snapshot &&
                page === "intentions" && (
                  <PersonalIntentions
                    snapshot={personal.snapshot}
                    onSave={async (text, id) => {
                      try {
                        await personal.updateGoal(text, id);
                        notify("Votre intention a été conservée");
                        return true;
                      } catch {
                        notify("L’intention n’a pas pu être enregistrée");
                        return false;
                      }
                    }}
                  />
                )}
              <form
                className="composer"
                onSubmit={(e) => {
                  e.preventDefault();
                  void saveNote();
                }}
              >
                <div className="composer-entry">
                  <span className="composer-sigil">
                    <Sigil small />
                  </span>
                  <label htmlFor="memory-input" className="sr-only">
                    Raconter un événement ou ajouter une note
                  </label>
                  <textarea
                    ref={composer}
                    id="memory-input"
                    value={draft}
                    maxLength={12000}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (
                        e.key === "Enter" &&
                        !e.shiftKey &&
                        !e.nativeEvent.isComposing
                      ) {
                        e.preventDefault();
                        void saveNote();
                      }
                    }}
                    placeholder="Un événement, une impression, quelque chose à éclaircir…"
                    rows={2}
                  />
                  <button
                    className="send-button"
                    disabled={!draft.trim() || personal.status === "saving"}
                    aria-label="Conserver la note"
                  >
                    <ArrowUp size={18} />
                  </button>
                </div>
                {mode === "personal" && (
                  <>
                    <button
                      type="button"
                      className={`composer-details-toggle ${captureDetailsOpen ? "active" : ""}`}
                      onClick={() => setCaptureDetailsOpen((open) => !open)}
                      aria-expanded={captureDetailsOpen}
                    >
                      <CalendarDays size={13} />
                      Date et contexte
                      {(eventPrecision !== "unknown" || noteContext.trim()) && (
                        <span>renseignés</span>
                      )}
                    </button>
                    {captureDetailsOpen && (
                      <div className="composer-details">
                        <label>
                          Précision
                          <select
                            value={eventPrecision}
                            onChange={(event) => {
                              const precision = event.target
                                .value as TemporalPrecision;
                              setEventPrecision(precision);
                              if (precision === "unknown") {
                                setEventStart("");
                                setEventEnd("");
                              } else if (precision !== "interval") {
                                setEventEnd("");
                              }
                            }}
                          >
                            <option value="unknown">Date inconnue</option>
                            <option value="day">Jour connu</option>
                            <option value="approximate">
                              Date approximative
                            </option>
                            <option value="interval">Période</option>
                          </select>
                        </label>
                        {eventPrecision !== "unknown" && (
                          <label>
                            {eventPrecision === "interval" ? "Début" : "Date"}
                            <input
                              type="date"
                              value={eventStart}
                              onChange={(event) =>
                                setEventStart(event.target.value)
                              }
                            />
                          </label>
                        )}
                        {eventPrecision === "interval" && (
                          <label>
                            Fin
                            <input
                              type="date"
                              min={eventStart || undefined}
                              value={eventEnd}
                              onChange={(event) =>
                                setEventEnd(event.target.value)
                              }
                            />
                          </label>
                        )}
                        <label className="composer-context-field">
                          Contexte
                          <input
                            value={noteContext}
                            maxLength={240}
                            onChange={(event) =>
                              setNoteContext(event.target.value)
                            }
                            placeholder="Travail, amis, famille…"
                          />
                        </label>
                      </div>
                    )}
                  </>
                )}
                <div className="composer-footer">
                  <span>
                    <ShieldCheck size={12} />
                    {mode === "personal"
                      ? personal.status === "saving"
                        ? "Enregistrement dans la mémoire SQLite…"
                        : personal.error
                          ? "Service local en difficulté · texte préservé"
                          : "Mémoire SQLite locale · sources intactes"
                      : warning
                        ? "Stockage indisponible · session uniquement"
                        : "Notes du navigateur · non analysées"}
                  </span>
                  <span className="composer-shortcut">
                    Entrée pour conserver <span>↵</span>
                  </span>
                </div>
              </form>
              <div className="workspace-footer">
                <span>
                  Un espace pour comprendre, pas pour conclure à votre place.
                </span>
                <span>
                  MANWË <i /> LOCAL 0.2
                </span>
              </div>
            </div>
            {mode === "demo" && inspectorOpen && (
              <>
                <button
                  className="inspector-backdrop"
                  aria-label="Fermer les détails"
                  onClick={() => setInspectorOpen(false)}
                />
                <Inspector
                  key={`${selection.kind}:${selection.id}`}
                  state={state}
                  selection={selection}
                  onSelect={select}
                  onClose={() => setInspectorOpen(false)}
                  onAnnotate={(text) => {
                    setState((previous) =>
                      addAnnotation(
                        previous,
                        selection,
                        text,
                        crypto.randomUUID(),
                        new Date().toISOString(),
                      ),
                    );
                    notify(
                      "Nuance conservée · lecture signalée si elle est concernée",
                    );
                  }}
                  onAnswer={(answer) => {
                    setState((previous) =>
                      answerQuestion(
                        previous,
                        answer,
                        new Date().toISOString(),
                      ),
                    );
                    notify(
                      answer === "unknown"
                        ? "L’incertitude est conservée"
                        : "Scénario mis à jour avec votre réponse",
                    );
                  }}
                />
              </>
            )}
          </div>
        </div>
      </div>
      {toast && (
        <div className="toast" role="status">
          <Check size={15} />
          {toast}
          <button
            aria-label="Fermer la notification"
            onClick={() => setToast("")}
          >
            <X size={13} />
          </button>
        </div>
      )}
      {searchOpen && (
        <Modal
          title="Retrouver un fil"
          onClose={() => setSearchOpen(false)}
          className="search-modal"
        >
          <label className="command-search">
            <Search size={20} />
            <input
              autoFocus
              placeholder="Une personne, un souvenir, une intention…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Rechercher dans votre espace"
            />
            <kbd>Échap</kbd>
          </label>
          <div className="search-results">
            {results.length ? (
              results.map((result) => (
                <button
                  key={`${result.selection.kind}:${result.selection.id}`}
                  onClick={() => {
                    if (mode === "personal") {
                      navigate(
                        result.selection.kind === "goal"
                          ? "intentions"
                          : "memory",
                      );
                    } else {
                      select(result.selection);
                    }
                    setSearchOpen(false);
                  }}
                >
                  <span className="search-result-icon">
                    {result.selection.kind === "person" ? (
                      <Users size={16} />
                    ) : result.selection.kind === "event" ? (
                      <BookOpen size={16} />
                    ) : (
                      <GitBranch size={16} />
                    )}
                  </span>
                  <span>
                    <small>{result.type}</small>
                    <strong>{result.title}</strong>
                  </span>
                  <ArrowUpRight size={15} />
                </button>
              ))
            ) : (
              <div className="empty-state">
                <Search size={24} />
                <p>Aucun résultat pour « {search} ».</p>
              </div>
            )}
          </div>
          <div className="search-hint">
            <Command size={12} /> Recherche dans{" "}
            {mode === "personal"
              ? "la mémoire SQLite locale"
              : "la mémoire de démonstration"}
          </div>
        </Modal>
      )}
      {workspaceOpen && (
        <Modal
          title="Choisir un espace"
          onClose={() => setWorkspaceOpen(false)}
          className="workspace-modal"
        >
          <p className="modal-intro">
            Séparez votre mémoire réelle du scénario fictif utilisé pour
            explorer l’interface.
          </p>
          <div className="workspace-options">
            <button
              className={mode === "personal" ? "selected" : ""}
              onClick={() => {
                setMode("personal");
                setInspectorOpen(false);
                setFocusGraph(false);
                setWorkspaceOpen(false);
              }}
            >
              <span className="workspace-option-icon">
                <Database size={19} />
              </span>
              <span>
                <strong>Mémoire personnelle</strong>
                <small>SQLite sur ce poste · vide au premier lancement</small>
              </span>
              {mode === "personal" && <Check size={16} />}
            </button>
            <button
              className={mode === "demo" ? "selected" : ""}
              onClick={() => {
                setMode("demo");
                setWorkspaceOpen(false);
              }}
            >
              <span className="workspace-option-icon">
                <Network size={19} />
              </span>
              <span>
                <strong>Démonstration</strong>
                <small>Données fictives · stockage du navigateur</small>
              </span>
              {mode === "demo" && <Check size={16} />}
            </button>
          </div>
          <p className="workspace-note">
            <ShieldCheck size={13} /> Aucun contenu n’est copié entre les deux
            espaces.
          </p>
        </Modal>
      )}
      {infoOpen && (
        <Modal
          title="Un espace pour comprendre."
          onClose={() => setInfoOpen(false)}
        >
          <div className="about-brand">
            <Sigil />
            <span>
              MANWË <small>MÉMOIRE LOCALE · 0.2</small>
            </span>
          </div>
          <p className="modal-intro">
            Relier les événements, explorer plusieurs lectures et garder votre
            droit de nuancer.
          </p>
          <div className="about-feature">
            <Network size={20} />
            <div>
              <h3>Une mémoire visible</h3>
              <p>
                Le graphe, les sources et vos corrections partagent un même
                état. Sélectionnez un élément pour retrouver son contexte.
              </p>
            </div>
          </div>
          <div className="about-feature">
            <ShieldCheck size={20} />
            <div>
              <h3>
                {mode === "personal"
                  ? "Une mémoire personnelle distincte"
                  : "Une démonstration, clairement identifiée"}
              </h3>
              <p>
                {mode === "personal"
                  ? "Les notes personnelles sont conservées dans une base SQLite locale. Aucune personne ni hypothèse n’est créée automatiquement dans cette étape."
                  : "Les personnes et les souvenirs initiaux sont fictifs. Les réponses proposées suivent un scénario fixe."}
              </p>
            </div>
          </div>
          <div className="about-feature">
            <BookOpen size={20} />
            <div>
              <h3>
                {mode === "personal"
                  ? "Conservé sur ce poste"
                  : "Conservé dans ce navigateur"}
              </h3>
              <p>
                {mode === "personal"
                  ? "Les sources sont immuables et les corrections s’ajoutent comme annotations. Le chiffrement et les sauvegardes guidées restent à livrer."
                  : "Vos notes et nuances restent dans le stockage local de cette adresse. Effacer les données du navigateur les efface aussi."}
              </p>
            </div>
          </div>
          <div className="quiet-note">
            Aucune requête IA. Aucune action sur vos contacts. DeepSeek et le
            harnais agentique ne sont pas encore connectés.
          </div>
          <button
            className="primary-button about-close"
            onClick={() => setInfoOpen(false)}
          >
            Explorer mon monde <ArrowUpRight size={15} />
          </button>
        </Modal>
      )}
    </div>
  );
}
