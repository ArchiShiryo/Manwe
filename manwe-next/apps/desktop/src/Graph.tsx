import { useState } from "react";
import { ArrowUpRight, Focus, Minus, Plus } from "lucide-react";
import { JewelField, type FieldSegment } from "./JewelField.tsx";
import { CONTEXT_COLORS } from "./jewelTheme.ts";
import {
  getHypothesis,
  people,
  type DemoState,
  type Selection,
} from "../../../packages/domain/src/demo.ts";

// Liens sociaux de la démonstration pour le champ du thème Jewel case :
// travail (Marc, Léa), jeu (Marc), amitié (Claire).
const DEMO_FIELD: FieldSegment[] = [
  { ax: 533, ay: 411, bx: 450, by: 241, color: CONTEXT_COLORS.play, weight: 1 },
  {
    ax: 467,
    ay: 223,
    bx: 668,
    by: 183,
    color: CONTEXT_COLORS.work,
    weight: 0.55,
  },
  {
    ax: 541,
    ay: 407,
    bx: 680,
    by: 199,
    color: CONTEXT_COLORS.work,
    weight: 0.8,
  },
  {
    ax: 563,
    ay: 432,
    bx: 762,
    by: 445,
    color: CONTEXT_COLORS.close,
    weight: 0.8,
  },
];

type Props = {
  state: DemoState;
  selection: Selection;
  onSelect: (selection: Selection) => void;
  context: "all" | "work" | "friends";
};
export function Graph({ state, selection, onSelect, context }: Props) {
  const [mode, setMode] = useState<"relations" | "evidence">("relations");
  const [zoom, setZoom] = useState(1);
  const hypothesis = getHypothesis(state);
  const active = (kind: Selection["kind"], id: string) =>
    selection.kind === kind && selection.id === id;
  const choose = (kind: Selection["kind"], id: string) =>
    onSelect({ kind, id });
  const keyChoose = (
    event: React.KeyboardEvent,
    kind: Selection["kind"],
    id: string,
  ) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      choose(kind, id);
    }
  };
  const nodeProps = (kind: Selection["kind"], id: string, label: string) => ({
    role: "button",
    tabIndex: 0,
    "aria-label": label,
    "aria-pressed": active(kind, id),
    onClick: () => choose(kind, id),
    onKeyDown: (event: React.KeyboardEvent) => keyChoose(event, kind, id),
  });
  return (
    <section className="graph-panel" aria-label="Graphe de votre monde">
      <div className="graph-toolbar">
        <div className="segmented" aria-label="Affichage du graphe">
          <button
            className={mode === "relations" ? "active" : ""}
            onClick={() => setMode("relations")}
          >
            Relations
          </button>
          <button
            className={mode === "evidence" ? "active" : ""}
            onClick={() => setMode("evidence")}
          >
            Preuves{" "}
            <span>
              {state.events.filter((e) => e.personIds.includes("marc")).length}
            </span>
          </button>
        </div>
        <span className="graph-scope">
          <i />
          {context === "work"
            ? "Le groupe du travail"
            : context === "friends"
              ? "Amitiés proches"
              : "Vue contextuelle"}
        </span>
      </div>
      <div className="graph-canvas">
        <JewelField
          segments={DEMO_FIELD}
          width={960}
          height={610}
          focus={{ x: 540, y: 420 }}
        />
        <svg
          className="living-graph"
          role="group"
          viewBox="0 0 960 610"
          aria-label="Personnes, hypothèses et intention. Sélectionnez un élément pour explorer ses sources."
        >
          <defs>
            <pattern
              id="graph-dots"
              x="0"
              y="0"
              width="25"
              height="25"
              patternUnits="userSpaceOnUse"
            >
              <circle cx="1" cy="1" r=".7" fill="#b1afb7" opacity=".16" />
            </pattern>
            <radialGradient id="work-glow">
              <stop offset="0" stopColor="#64626d" stopOpacity=".15" />
              <stop offset="1" stopColor="#64626d" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="friend-glow">
              <stop offset="0" stopColor="#515ca7" stopOpacity=".1" />
              <stop offset="1" stopColor="#515ca7" stopOpacity="0" />
            </radialGradient>
            <filter id="soft-glow">
              <feGaussianBlur stdDeviation="10" />
            </filter>
          </defs>
          <rect width="960" height="610" fill="url(#graph-dots)" />
          <g
            transform={`translate(480 305) scale(${zoom}) translate(-480 -305)`}
            className="graph-scene"
          >
            <ellipse
              cx="564"
              cy="223"
              rx="350"
              ry="235"
              fill="url(#work-glow)"
            />
            <ellipse
              cx="741"
              cy="452"
              rx="230"
              ry="155"
              fill="url(#friend-glow)"
            />
            <path
              d="M367 121C456 38 677 38 777 145C864 240 746 332 565 300"
              className="region-boundary"
            />
            <path
              d="M598 403C670 328 842 323 878 438C900 524 775 572 670 536"
              className="region-boundary"
            />
            <text x="550" y="71" className="cluster-label">
              LE GROUPE DU TRAVAIL
            </text>
            <text x="707" y="555" className="cluster-label">
              HORS DU TRAVAIL
            </text>
            <g className="graph-edges">
              <path d="M533 411Q440 342 450 241" className="edge primary" />
              <path d="M467 223Q564 155 668 183" className="edge" />
              <path d="M541 407Q652 313 680 199" className="edge" />
              <path d="M563 432Q650 478 762 445" className="edge blue" />
              <path d="M424 205Q368 148 325 148" className="edge inference" />
              <path
                d="M482 243Q535 310 627 316"
                className="edge inference faint"
              />
              <path d="M225 180Q155 237 217 322" className="edge inquiry" />
              <path d="M285 349Q382 379 510 417" className="edge inquiry" />
              <path d="M500 449Q422 507 332 505" className="edge intention" />
              {mode === "evidence" && (
                <>
                  <path
                    d="M141 216Q169 165 212 157"
                    className="edge evidence"
                  />
                  <path
                    d="M118 280Q174 231 222 173"
                    className="edge evidence"
                  />
                  <path
                    d="M770 294Q731 303 719 316"
                    className="edge evidence"
                  />
                </>
              )}
            </g>
            <text
              x="443"
              y="323"
              className="edge-label"
              transform="rotate(51 443 323)"
            >
              initiatives récentes
            </text>
            <text x="659" y="472" className="edge-label">
              amitié
            </text>
            <g opacity={context === "friends" ? 0.45 : 1}>
              <g
                {...nodeProps("hypothesis", "closeness", hypothesis.title)}
                className={`graph-node hypothesis-node ${active("hypothesis", "closeness") ? "selected" : ""} ${hypothesis.tone}`}
                transform="translate(179 113)"
              >
                <rect
                  className="node-halo"
                  x="-7"
                  y="-7"
                  width="244"
                  height="87"
                  rx="15"
                />
                <rect className="node-face" width="230" height="73" rx="10" />
                <path d="M18 20l5-5 5 5-5 5z" className="hypothesis-diamond" />
                <text x="36" y="24" className="node-eyebrow">
                  HYPOTHÈSE
                </text>
                <text x="18" y="49" className="node-title">
                  {hypothesis.short}
                </text>
                <circle cx="213" cy="21" r="3" className="status-dot" />
              </g>
              {[
                { person: people[0], x: 450, y: 223 },
                { person: people[1], x: 684, y: 181 },
              ].map(({ person, x, y }) => (
                <g
                  key={person.id}
                  {...nodeProps("person", person.id, `Explorer ${person.name}`)}
                  transform={`translate(${x} ${y})`}
                  className={`graph-node person-node ${person.color} ${active("person", person.id) ? "selected" : ""}`}
                >
                  <circle className="person-halo" r="45" />
                  <circle className="person-orbit" r="36" />
                  <circle className="person-face" r="29" />
                  <text className="person-initials" textAnchor="middle" y="6">
                    {person.initials}
                  </text>
                  <text className="person-name" textAnchor="middle" y="60">
                    {person.firstName}
                  </text>
                  <text className="person-role" textAnchor="middle" y="77">
                    {person.id === "marc"
                      ? "Collègue · ami de jeu"
                      : "Collègue"}
                  </text>
                </g>
              ))}
              <g
                {...nodeProps(
                  "hypothesis",
                  "alternative",
                  "Explorer l’explication alternative : activités partagées",
                )}
                transform="translate(603 294)"
                className={`graph-node alternative-node ${active("hypothesis", "alternative") ? "selected" : ""}`}
              >
                <rect className="node-face" width="204" height="56" rx="9" />
                <text x="15" y="20" className="node-eyebrow">
                  AUTRE LECTURE
                </text>
                <text x="15" y="40" className="node-subtitle">
                  Des activités partagées
                </text>
              </g>
            </g>
            <g
              {...nodeProps("person", "claire", "Explorer Claire Morel")}
              transform="translate(785 430)"
              opacity={context === "work" ? 0.3 : 1}
              className={`graph-node person-node blue ${active("person", "claire") ? "selected" : ""}`}
            >
              <circle className="person-halo" r="42" />
              <circle className="person-orbit" r="34" />
              <circle className="person-face" r="27" />
              <text className="person-initials" textAnchor="middle" y="6">
                CM
              </text>
              <text className="person-name" textAnchor="middle" y="58">
                Claire
              </text>
              <text className="person-role" textAnchor="middle" y="75">
                Amie de longue date
              </text>
            </g>
            <g transform="translate(539 429)" className="self-node">
              <circle className="self-aura" r="54" />
              <circle className="self-orbit" r="39" />
              <circle className="self-face" r="25" />
              <path
                d="M-8 3l8-12 8 12M-4-3L0 10 4-3"
                fill="none"
                stroke="#d7d6da"
                strokeWidth="1.4"
              />
              <text textAnchor="middle" y="62" className="self-label">
                Vous
              </text>
            </g>
            <g
              {...nodeProps(
                "question",
                "initiative",
                "Explorer la question ouverte",
              )}
              transform="translate(137 321)"
              className={`graph-node question-node ${active("question", "initiative") ? "selected" : ""}`}
            >
              <rect className="node-face" width="206" height="65" rx="10" />
              <circle cx="22" cy="23" r="8" fill="none" stroke="currentColor" />
              <text x="22" y="27" textAnchor="middle" className="question-mark">
                ?
              </text>
              <text x="39" y="26" className="node-eyebrow">
                {state.questionAnswer
                  ? "QUESTION EXPLORÉE"
                  : "QUESTION OUVERTE"}
              </text>
              <text x="16" y="48" className="node-subtitle">
                Et sans activité prévue ?
              </text>
            </g>
            <g
              {...nodeProps(
                "goal",
                "friendship",
                `Explorer votre intention : ${state.goalText}`,
              )}
              transform="translate(182 486)"
              className={`graph-node goal-node ${active("goal", "friendship") ? "selected" : ""}`}
            >
              <rect className="node-face" width="215" height="61" rx="10" />
              <path
                d="M17 24l5-10 5 10-5-3z"
                fill="none"
                stroke="currentColor"
              />
              <text x="36" y="23" className="node-eyebrow">
                VOTRE INTENTION
              </text>
              <text x="16" y="45" className="node-subtitle">
                {state.goalText.length > 29
                  ? `${state.goalText.slice(0, 27)}…`
                  : state.goalText}
              </text>
            </g>
            {mode === "evidence" &&
              [
                { id: "invite", x: 41, y: 202, label: "Invitation à jouer" },
                { id: "lunch", x: 26, y: 263, label: "Déjeuner proposé" },
                { id: "context", x: 765, y: 253, label: "Contexte partagé" },
                ...(state.questionAnswer
                  ? [
                      {
                        id: "question-answer",
                        x: 363,
                        y: 345,
                        label: "Votre réponse",
                      },
                    ]
                  : []),
              ].map((e) => (
                <g
                  key={e.id}
                  {...nodeProps("event", e.id, `Lire la source : ${e.label}`)}
                  transform={`translate(${e.x} ${e.y})`}
                  className={`graph-node source-node ${active("event", e.id) ? "selected" : ""}`}
                >
                  <rect className="node-face" width="150" height="33" rx="6" />
                  <path
                    d="M12 9h7v14h-7zM14 13h3M14 16h3"
                    fill="none"
                    stroke="currentColor"
                  />
                  <text x="28" y="21" className="source-label">
                    {e.label}
                  </text>
                </g>
              ))}
          </g>
        </svg>
      </div>
      <div className="graph-mobile-hint">
        Balayez le graphe pour explorer <span>↔</span>
      </div>
      <div className="graph-footer">
        <div className="graph-legend">
          <span>
            <i className="legend-person" />
            Personne
          </span>
          <span>
            <i className="legend-hypothesis" />
            Hypothèse
          </span>
          <span>
            <i className="legend-question" />À explorer
          </span>
        </div>
        <div className="zoom-controls">
          <button
            aria-label="Réduire le graphe"
            disabled={zoom <= 0.8}
            onClick={() => setZoom(Math.max(0.8, +(zoom - 0.1).toFixed(1)))}
          >
            <Minus size={14} />
          </button>
          <span>{Math.round(zoom * 100)}%</span>
          <button
            aria-label="Agrandir le graphe"
            disabled={zoom >= 1.4}
            onClick={() => setZoom(Math.min(1.4, +(zoom + 0.1).toFixed(1)))}
          >
            <Plus size={14} />
          </button>
          <button aria-label="Recentrer le graphe" onClick={() => setZoom(1)}>
            <Focus size={15} />
          </button>
        </div>
      </div>
      <div className="graph-insight">
        <span className={`tiny-diamond ${hypothesis.tone}`} />
        <p>
          {hypothesis.status === "À réexaminer"
            ? "Votre nuance est conservée. Cette lecture reste à réexaminer."
            : "Une même initiative peut raconter plusieurs histoires."}
        </p>
        <button onClick={() => choose("hypothesis", "alternative")}>
          Explorer l’autre lecture <ArrowUpRight size={14} />
        </button>
      </div>
    </section>
  );
}
