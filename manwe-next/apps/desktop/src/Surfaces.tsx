import { useState } from "react";
import {
  ArrowUpRight,
  Check,
  Compass,
  FileText,
  MessageSquarePlus,
  Search,
} from "lucide-react";
import {
  people,
  selectionTitle,
  type DemoState,
  type Selection,
} from "../../../packages/domain/src/demo.ts";
import { Avatar, categoryLabels, dateLabel } from "./ui.tsx";

export function PeopleView({
  state,
  onSelect,
}: {
  state: DemoState;
  onSelect: (s: Selection) => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("Tous");
  const visible = people.filter(
    (p) =>
      (filter === "Tous" || p.context === filter) &&
      `${p.name} ${p.role}`
        .toLocaleLowerCase("fr")
        .includes(query.toLocaleLowerCase("fr")),
  );
  return (
    <section className="surface-panel">
      <div className="surface-toolbar">
        <div className="segmented">
          {["Tous", "Travail", "Hors du travail"].map((item) => (
            <button
              key={item}
              className={filter === item ? "active" : ""}
              onClick={() => setFilter(item)}
            >
              {item}
            </button>
          ))}
        </div>
        <label className="inline-search">
          <Search size={15} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Une personne…"
            aria-label="Filtrer les personnes"
          />
        </label>
      </div>
      <div className="people-list">
        {visible.map((person) => (
          <button
            className="person-card"
            key={person.id}
            onClick={() => onSelect({ kind: "person", id: person.id })}
          >
            <Avatar person={person} size="large" />
            <div>
              <span className="eyebrow">{person.context}</span>
              <h2>{person.name}</h2>
              <span className="person-caption">{person.role}</span>
              <p>{person.description}</p>
              <small>
                {
                  state.events.filter((e) => e.personIds.includes(person.id))
                    .length
                }{" "}
                éléments rapportés
              </small>
            </div>
            <ArrowUpRight size={18} />
          </button>
        ))}
        {visible.length === 0 && (
          <div className="empty-state">
            <Search size={24} />
            <h2>Aucune personne trouvée</h2>
            <p>Essayez un autre nom ou un autre contexte.</p>
          </div>
        )}
      </div>
      <p className="surface-footnote">
        Des personnes, pas des étiquettes. Les portraits évoluent avec ce que
        vous partagez.
      </p>
    </section>
  );
}

export function MemoryView({
  state,
  onSelect,
}: {
  state: DemoState;
  onSelect: (s: Selection) => void;
}) {
  const [filter, setFilter] = useState("Tout");
  const entries = [
    ...state.events.map((e) => ({
      id: e.id,
      date: e.date,
      title: e.title,
      text: e.text,
      label: categoryLabels[e.category],
      selection: { kind: "event" as const, id: e.id },
      type: e.category === "note" ? "Notes" : "Sources",
    })),
    ...state.annotations.map((a) => ({
      id: a.id,
      date: a.date,
      title: `Nuance · ${selectionTitle(a.target, state)}`,
      text: a.text,
      label: "Votre précision",
      selection: a.target,
      type: "Nuances",
    })),
  ]
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
    .filter((e) => filter === "Tout" || e.type === filter);
  return (
    <section className="surface-panel memory-panel">
      <div className="surface-toolbar">
        <div className="segmented">
          {["Tout", "Sources", "Notes", "Nuances"].map((item) => (
            <button
              className={filter === item ? "active" : ""}
              key={item}
              onClick={() => setFilter(item)}
            >
              {item}
            </button>
          ))}
        </div>
        <span className="muted-text">
          {entries.length} élément{entries.length > 1 ? "s" : ""}
        </span>
      </div>
      <div className="timeline">
        {entries.map((entry) => (
          <button
            className="timeline-entry"
            key={entry.id}
            onClick={() => onSelect(entry.selection)}
          >
            <span className="timeline-date">{dateLabel(entry.date)}</span>
            <span
              className={`timeline-dot ${entry.type === "Nuances" ? "clay" : ""}`}
            >
              {entry.type === "Nuances" ? (
                <MessageSquarePlus size={14} />
              ) : (
                <FileText size={14} />
              )}
            </span>
            <div>
              <span className="eyebrow">{entry.label}</span>
              <h3>{entry.title}</h3>
              <p>{entry.text}</p>
            </div>
            <ArrowUpRight size={15} />
          </button>
        ))}
        {entries.length === 0 && (
          <div className="empty-state">
            <FileText size={24} />
            <h2>Un espace pour ce qui compte</h2>
            <p>
              {filter === "Nuances"
                ? "Ajoutez une précision depuis l’inspecteur."
                : "Racontez quelque chose dans le champ ci-dessous."}
            </p>
          </div>
        )}
      </div>
      <p className="surface-footnote">
        Le texte d’origine est conservé. Vos notes personnelles ne sont pas
        analysées dans cette version.
      </p>
    </section>
  );
}

export function IntentionsView({
  state,
  onSelect,
  onSave,
}: {
  state: DemoState;
  onSelect: (s: Selection) => void;
  onSave: (text: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(state.goalText);
  return (
    <section className="surface-panel intentions-panel">
      <div className="intent-hero">
        <span className="intent-emblem">
          <Compass size={30} strokeWidth={1} />
        </span>
        <div className="eyebrow">CE QUI COMPTE POUR VOUS</div>
        {editing ? (
          <form
            className="goal-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (!text.trim()) return;
              onSave(text.trim());
              setEditing(false);
            }}
          >
            <label className="sr-only" htmlFor="goal">
              Votre intention
            </label>
            <textarea
              id="goal"
              autoFocus
              maxLength={180}
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
            />
            <div className="form-actions">
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  setText(state.goalText);
                  setEditing(false);
                }}
              >
                Annuler
              </button>
              <button disabled={!text.trim()} className="primary-button">
                <Check size={14} />
                Conserver
              </button>
            </div>
          </form>
        ) : (
          <>
            <h2>{state.goalText}</h2>
            <p>Garder un cap, tout en laissant de la place à ce qui émerge.</p>
            <button className="text-button" onClick={() => setEditing(true)}>
              Reformuler mon intention <ArrowUpRight size={14} />
            </button>
          </>
        )}
      </div>
      <div className="directions-heading">
        <h3>Deux directions possibles</h3>
        <span>Aucune obligation d’agir</span>
      </div>
      <div className="direction-grid">
        <article>
          <span className="direction-number">01</span>
          <h3>Créer une occasion</h3>
          <p>
            Un café avec Marc, hors du contexte habituel. Un petit pas pour
            découvrir une autre facette du lien.
          </p>
          <span className="direction-tag">Ouvrir une possibilité</span>
        </article>
        <article>
          <span className="direction-number">02</span>
          <h3>Laisser du temps</h3>
          <p>
            Continuer à partager ce qui vous rapproche déjà. Remarquer ce qui
            évolue, sans chercher à le provoquer.
          </p>
          <span className="direction-tag">Observer sans forcer</span>
        </article>
      </div>
      <button
        className="direction-explore"
        onClick={() => onSelect({ kind: "goal", id: "friendship" })}
      >
        Examiner ces pistes dans leur contexte <ArrowUpRight size={16} />
      </button>
      <p className="surface-footnote">
        Pistes du scénario de démonstration. Aucune action n’est envoyée à vos
        contacts.
      </p>
    </section>
  );
}
