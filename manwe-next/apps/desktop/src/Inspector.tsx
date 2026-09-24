import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  ChevronRight,
  CircleHelp,
  FileText,
  MessageSquarePlus,
  Sparkles,
  X,
} from "lucide-react";
import {
  getHypothesis,
  people,
  selectionTitle,
  type DemoState,
  type MemoryEvent,
  type Selection,
} from "../../../packages/domain/src/demo.ts";
import { Avatar, categoryLabels, dateLabel } from "./ui.tsx";

type Props = {
  state: DemoState;
  selection: Selection;
  onSelect: (selection: Selection) => void;
  onClose: () => void;
  onAnnotate: (text: string) => void;
  onAnswer: (answer: "yes" | "activity" | "unknown") => void;
};
export function SourceRow({
  event,
  onClick,
  counter = false,
}: {
  event: MemoryEvent;
  onClick: () => void;
  counter?: boolean;
}) {
  return (
    <button
      className={`source-row ${counter ? "counter" : ""}`}
      onClick={onClick}
    >
      <span className="source-icon">
        <FileText size={14} />
      </span>
      <span>
        <strong>{event.title}</strong>
        <small>
          {dateLabel(event.date)} · {categoryLabels[event.category]}
        </small>
      </span>
      <ChevronRight size={14} />
    </button>
  );
}
export function Inspector({
  state,
  selection,
  onSelect,
  onClose,
  onAnnotate,
  onAnswer,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState("");
  const panelRef = useRef<HTMLElement>(null);
  const [compact, setCompact] = useState(
    () => window.matchMedia("(max-width: 999px)").matches,
  );
  useEffect(() => {
    const media = window.matchMedia("(max-width: 999px)");
    const update = () => setCompact(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (!compact) return;
    const panel = panelRef.current;
    const previous = document.activeElement as HTMLElement | null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel?.querySelector<HTMLButtonElement>("button")?.focus();
    const trapFocus = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !panel) return;
      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(
          "button:not(:disabled), textarea, input, a[href]",
        ),
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      }
      if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    panel?.addEventListener("keydown", trapFocus);
    return () => {
      document.body.style.overflow = oldOverflow;
      panel?.removeEventListener("keydown", trapFocus);
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [compact]);
  const hypothesis = getHypothesis(state);
  const isMainHypothesis =
    selection.kind === "hypothesis" && selection.id === "closeness";
  const annotations = state.annotations.filter(
    (a) => a.target.kind === selection.kind && a.target.id === selection.id,
  );
  const event = state.events.find((e) => e.id === selection.id);
  const person = people.find((p) => p.id === selection.id);
  const sectionNames = {
    hypothesis: "UNE LECTURE POSSIBLE",
    person: "UNE PERSONNE",
    event: "REMONTÉE À LA SOURCE",
    question: "CE QUI RESTE OUVERT",
    goal: "VOTRE DIRECTION",
  };
  const sourceList = (ids: string[], counter = false) =>
    ids
      .map((id) => state.events.find((e) => e.id === id))
      .filter((e): e is MemoryEvent => !!e)
      .map((e) => (
        <SourceRow
          key={e.id}
          event={e}
          counter={counter}
          onClick={() => onSelect({ kind: "event", id: e.id })}
        />
      ));
  return (
    <aside
      ref={panelRef}
      className="inspector"
      aria-label="Inspecteur contextuel"
      role={compact ? "dialog" : undefined}
      aria-modal={compact ? true : undefined}
    >
      <div className="inspector-top">
        <span>
          <span className="tiny-diamond" />
          INSPECTEUR
        </span>
        <button
          className="icon-button"
          aria-label="Fermer l’inspecteur"
          onClick={onClose}
        >
          <X size={16} />
        </button>
      </div>
      <div className="inspector-body">
        {selection.kind === "event" && (
          <button
            className="text-button back-link"
            onClick={() => onSelect({ kind: "hypothesis", id: "closeness" })}
          >
            <ArrowLeft size={13} />
            Revenir à la lecture
          </button>
        )}
        <div className="eyebrow">{sectionNames[selection.kind]}</div>
        {selection.kind === "person" && person && (
          <Avatar person={person} size="large" />
        )}
        <h2>{selectionTitle(selection, state)}</h2>
        {isMainHypothesis && (
          <>
            <span className={`badge ${hypothesis.tone}`}>
              <i />
              {hypothesis.status}
            </span>
            <p className="inspector-description">{hypothesis.narrative}</p>
            <div className="evidence-section">
              <h3>
                <span className="evidence-mark">↗</span> Ce qui soutient cette
                lecture <span>{hypothesis.supporting.length}</span>
              </h3>
              {sourceList(hypothesis.supporting)}
            </div>
            <div className="evidence-section">
              <h3>
                <span className="evidence-mark muted">↔</span> Ce qui la limite
              </h3>
              {sourceList(hypothesis.against, true)}
            </div>
            <button
              className="alternative-link"
              onClick={() =>
                onSelect({ kind: "hypothesis", id: "alternative" })
              }
            >
              <span className="tiny-diamond" />
              <span>
                Autre lecture<strong>Le rôle des activités partagées</strong>
              </span>
              <ArrowUpRight size={15} />
            </button>
            <button
              className="question-card"
              onClick={() => onSelect({ kind: "question", id: "initiative" })}
            >
              <CircleHelp size={17} />
              <span>
                <small>
                  {state.questionAnswer
                    ? "QUESTION EXPLORÉE"
                    : "POUR MIEUX COMPRENDRE"}
                </small>
                <strong>Marc initie-t-il aussi sans activité prévue ?</strong>
                <em>
                  {state.questionAnswer
                    ? "Relire ou changer votre réponse"
                    : "Explorer cette question"}{" "}
                  <ArrowUpRight size={12} />
                </em>
              </span>
            </button>
          </>
        )}
        {selection.kind === "hypothesis" && !isMainHypothesis && (
          <>
            <span className="badge neutral">
              <i />
              Explication concurrente
            </span>
            <p className="inspector-description">
              Le travail et le jeu créent des occasions de se retrouver. Les
              initiatives de Marc pourraient refléter ces intérêts communs, sans
              traduire un rapprochement plus général.
            </p>
            <div className="evidence-section">
              <h3>Un contexte à garder en tête</h3>
              {sourceList(["context"])}
            </div>
            <div className="quiet-note">
              Ces deux lectures peuvent coexister. L’une ne prouve pas que
              l’autre est fausse.
            </div>
            <button
              className="question-card"
              onClick={() => onSelect({ kind: "question", id: "initiative" })}
            >
              <CircleHelp size={18} />
              <span>
                <small>CE QUI AIDERAIT À LES DISTINGUER</small>
                <strong>
                  Une initiative en dehors des activités partagées ?
                </strong>
                <em>
                  Ouvrir la question <ArrowUpRight size={12} />
                </em>
              </span>
            </button>
            <button
              className="text-button"
              onClick={() => onSelect({ kind: "hypothesis", id: "closeness" })}
            >
              <ArrowLeft size={14} />
              Revenir à la première lecture
            </button>
          </>
        )}
        {selection.kind === "person" && person && (
          <>
            <span className="person-caption">{person.role}</span>
            <p className="inspector-description">{person.description}</p>
            <div className="evidence-section">
              <h3>Ce que vous avez rapporté</h3>
              {sourceList(
                state.events
                  .filter((e) => e.personIds.includes(person.id))
                  .map((e) => e.id),
              )}
            </div>
            {person.id === "marc" && (
              <button
                className="alternative-link"
                onClick={() =>
                  onSelect({ kind: "hypothesis", id: "closeness" })
                }
              >
                <Sparkles size={15} />
                <span>
                  Lecture associée<strong>{hypothesis.short}</strong>
                </span>
                <ChevronRight size={14} />
              </button>
            )}
            <div className="quiet-note">
              Une personne n’est pas un profil figé. Ce portrait est limité aux
              éléments du scénario.
            </div>
          </>
        )}
        {selection.kind === "event" && event && (
          <>
            <span
              className={`badge ${event.category === "impression" ? "amber" : "neutral"}`}
            >
              {categoryLabels[event.category]}
            </span>
            <blockquote className="source-quote">{event.text}</blockquote>
            <dl className="source-metadata">
              <div>
                <dt>Provenance</dt>
                <dd>{event.source}</dd>
              </div>
              <div>
                <dt>Date</dt>
                <dd>{dateLabel(event.date, true)}</dd>
              </div>
              <div>
                <dt>Traitement</dt>
                <dd>
                  {event.category === "note"
                    ? "Texte conservé tel quel"
                    : "Élément du scénario fictif"}
                </dd>
              </div>
            </dl>
            {event.category === "note" && (
              <div className="quiet-note">
                Cette note n’a pas été analysée. Aucune relation ni
                interprétation n’a été créée à partir de son texte.
              </div>
            )}
            {event.personIds.length > 0 && (
              <div className="related-people">
                {event.personIds.map((id) => {
                  const p = people.find((item) => item.id === id);
                  return (
                    p && (
                      <button
                        key={id}
                        onClick={() => onSelect({ kind: "person", id })}
                      >
                        <Avatar person={p} />
                        {p.firstName}
                        <ArrowUpRight size={12} />
                      </button>
                    )
                  );
                })}
              </div>
            )}
          </>
        )}
        {selection.kind === "question" && (
          <>
            <span
              className={`badge ${state.questionAnswer ? "sage" : "amber"}`}
            >
              <i />
              {state.questionAnswer
                ? "Réponse conservée"
                : "Incertitude ouverte"}
            </span>
            <p className="inspector-description">
              Les invitations de Marc existent. Ce qui reste flou, c’est leur
              portée : cherche-t-il à vous voir, ou surtout à partager une
              activité ?
            </p>
            <div className="quiet-note">
              Essayez une réponse dans le scénario de démonstration. Elle met à
              jour la lecture sans faire appel à un modèle.
            </div>
            <div className="answer-options">
              {(
                [
                  {
                    id: "yes",
                    label: "Oui, en dehors des activités",
                    hint: "Exemple : un café sans autre prétexte.",
                  },
                  {
                    id: "activity",
                    label: "Surtout autour d’une activité",
                    hint: "Le travail ou le jeu restent le contexte.",
                  },
                  {
                    id: "unknown",
                    label: "Je ne sais pas encore",
                    hint: "On peut laisser cette question ouverte.",
                  },
                ] as const
              ).map((answer) => (
                <button
                  key={answer.id}
                  className={state.questionAnswer === answer.id ? "chosen" : ""}
                  aria-pressed={state.questionAnswer === answer.id}
                  onClick={() => onAnswer(answer.id)}
                >
                  <span>
                    <strong>{answer.label}</strong>
                    <small>{answer.hint}</small>
                  </span>
                  {state.questionAnswer === answer.id ? (
                    <Check size={16} />
                  ) : (
                    <span className="answer-circle" />
                  )}
                </button>
              ))}
            </div>
            <button
              className="text-button"
              onClick={() => onSelect({ kind: "hypothesis", id: "closeness" })}
            >
              Voir la lecture actuelle <ArrowUpRight size={14} />
            </button>
          </>
        )}
        {selection.kind === "goal" && (
          <>
            <span className="badge clay">Intention personnelle</span>
            <p className="inspector-description">
              Un cap, pas un score à atteindre. Cette intention aide à choisir
              ce que vous souhaitez comprendre et les petits pas qui vous
              ressemblent.
            </p>
            <div className="intent-option">
              <span>01</span>
              <h3>Créer une occasion simple</h3>
              <p>
                Proposer un café à Marc, sans autre activité. Une possibilité à
                envisager, pas une action à exécuter automatiquement.
              </p>
            </div>
            <div className="intent-option">
              <span>02</span>
              <h3>Laisser le lien se développer</h3>
              <p>
                Continuer les activités partagées et observer les prochaines
                initiatives, sans forcer une conclusion.
              </p>
            </div>
            <div className="quiet-note">
              MANWË ne contacte personne et ne décide pas à votre place.
            </div>
          </>
        )}
        {annotations.length > 0 && (
          <section className="annotations">
            <h3>
              Vos nuances <span>{annotations.length}</span>
            </h3>
            {annotations.map((a) => (
              <article key={a.id}>
                <MessageSquarePlus size={14} />
                <div>
                  <p>{a.text}</p>
                  <small>{dateLabel(a.date)} · Conservée localement</small>
                </div>
              </article>
            ))}
          </section>
        )}
        <div className="correction-area">
          {editing ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!note.trim()) return;
                onAnnotate(note);
                setNote("");
                setEditing(false);
              }}
            >
              <label htmlFor="correction">Qu’aimeriez-vous préciser ?</label>
              <textarea
                id="correction"
                autoFocus
                maxLength={4000}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Un contexte manquant, une nuance, un désaccord…"
                rows={4}
              />
              <div className="form-actions">
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setEditing(false)}
                >
                  Annuler
                </button>
                <button
                  className="primary-button small-button"
                  disabled={!note.trim()}
                >
                  Conserver la nuance
                </button>
              </div>
            </form>
          ) : (
            <button
              className="correction-button"
              onClick={() => setEditing(true)}
            >
              <MessageSquarePlus size={15} />
              {selection.kind === "hypothesis"
                ? "Nuancer cette lecture"
                : "Ajouter une précision"}
              <span>+</span>
            </button>
          )}
          <p>Vos précisions restent attachées à cet élément.</p>
        </div>
      </div>
      <div className="inspector-footer">
        <span className="local-indicator" />
        Scénario local{" "}
        <span>Révision {state.revision.toString().padStart(2, "0")}</span>
      </div>
    </aside>
  );
}
