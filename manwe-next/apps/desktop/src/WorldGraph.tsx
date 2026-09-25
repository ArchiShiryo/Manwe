// Graphe vivant du mode personnel (R4.3). Il affiche la projection calculée
// par le service (`GET /api/graph`) avec la sémiologie des thèmes :
// trait plein = observé, tirets = rapporté, pointillé = impression,
// double trait qui tremble = inféré (plus la confiance est basse, plus il
// tremble), gris avec « ? » = inconnu. Jamais de couleur de réussite sur une
// hypothèse ; au plus 7 relations par schéma (garanti par la projection).
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  FocusContext,
  GraphEdge,
  GraphProjection,
} from "../../../packages/cognition/src/projection.ts";
import type {
  AnnotationCommand,
  AnnotationType,
  WorkspaceSnapshot,
} from "../../../packages/domain/src/memory.ts";
import { annotationTarget, explainNode } from "./graphEvidence.ts";
import { memoryApi } from "./memoryApi.ts";
import {
  LAYOUT_HEIGHT,
  LAYOUT_WIDTH,
  anchorLayout,
  focusFromNodeId,
  focusNodeId,
  layoutGraph,
  tremor,
  visibleNodeIds,
  type DetailLevel,
  type PlacedNode,
} from "./graphLayout.ts";

const KIND_LABELS: Record<PlacedNode["kind"], string> = {
  self: "vous",
  person: "personne",
  relation: "relation",
  hypothesis: "lecture",
  claim: "élément",
  event: "épisode",
  question: "question",
};

const STYLE_LABELS: Record<GraphEdge["style"], string> = {
  observed: "observé",
  reported: "rapporté",
  impression: "impression",
  inferred: "inféré",
  unknown: "inconnu",
};

const EDGE_LABELS: Partial<Record<GraphEdge["kind"], string>> = {
  supports: "soutient",
  contradicts: "contredit",
  about: "porte sur",
  alternative_to: "alternative",
  targets: "départage",
  plays_role: "rôle",
  member_of: "membre",
  cites: "cite",
};

const short = (text: string, max = 34) =>
  text.length > max ? `${text.slice(0, max - 1)}…` : text;

function nodeRadius(node: PlacedNode) {
  if (node.kind === "self" || node.ring === 0) return 26;
  if (node.kind === "person" || node.kind === "relation") return 18;
  return 13;
}

function Edge({
  edge,
  from,
  to,
  shaky,
}: {
  edge: GraphEdge;
  from: PlacedNode;
  to: PlacedNode;
  shaky: string;
}) {
  const d = `M${from.x},${from.y} L${to.x},${to.y}`;
  const className = `world-edge world-edge-${edge.style} world-edge-${edge.kind}`;
  if (edge.style === "inferred")
    return (
      <g className={`${className} tremor-${shaky}`}>
        <path d={d} className="world-edge-double-outer" />
        <path d={d} className="world-edge-double-inner" />
      </g>
    );
  return <path d={d} className={className} />;
}

type Annotate = (
  target: AnnotationCommand["target"],
  text: string,
  type: AnnotationType,
) => Promise<boolean>;

const STATUS_LABELS: Record<string, string> = {
  draft: "brouillon",
  plausible: "plausible",
  contradicted: "contredite",
  superseded: "remplacée",
};
const CONFIDENCE_LABELS: Record<string, string> = {
  low: "faible",
  moderate: "modérée",
  high: "élevée",
};

const REASON_LABELS = {
  supports: "soutient",
  contradicts: "contredit",
  role: "rôle",
  cites: "cité",
} as const;

/** « Pourquoi ? », « Corriger » et « Ajouter du contexte » (R4.5). */
function DetailActions({
  snapshot,
  node,
  onAnnotate,
}: {
  snapshot: WorkspaceSnapshot;
  node: PlacedNode;
  onAnnotate?: Annotate;
}) {
  const [panel, setPanel] = useState<"why" | "correct" | "context" | null>(
    null,
  );
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setPanel(null);
    setText("");
  }, [node.id]);
  const reasons = explainNode(snapshot, node.id);
  const target = annotationTarget(node.id);
  // Une lecture ou une question se conteste ; un fait se corrige.
  const correctionType: AnnotationType =
    node.kind === "hypothesis" || node.kind === "question"
      ? "disagreement"
      : "factual_correction";
  const canWhy = ["hypothesis", "claim", "relation"].includes(node.kind);
  const canCorrect = !!target && !!onAnnotate && node.kind !== "question";
  const canContext = !!target && !!onAnnotate;
  const submit = async () => {
    if (!target || !onAnnotate || !text.trim() || panel === "why") return;
    setBusy(true);
    const ok = await onAnnotate(
      target,
      text.trim(),
      panel === "correct" ? correctionType : "context",
    );
    setBusy(false);
    if (ok) {
      setPanel(null);
      setText("");
    }
  };
  if (!canWhy && !canCorrect && !canContext) return null;
  return (
    <div className="world-graph-actions">
      <div className="world-graph-action-row">
        {canWhy && (
          <button
            className={panel === "why" ? "active" : ""}
            aria-expanded={panel === "why"}
            onClick={() => setPanel(panel === "why" ? null : "why")}
          >
            Pourquoi ?
          </button>
        )}
        {canCorrect && (
          <button
            className={panel === "correct" ? "active" : ""}
            aria-expanded={panel === "correct"}
            onClick={() => setPanel(panel === "correct" ? null : "correct")}
          >
            {correctionType === "disagreement" ? "Contester" : "Corriger"}
          </button>
        )}
        {canContext && (
          <button
            className={panel === "context" ? "active" : ""}
            aria-expanded={panel === "context"}
            onClick={() => setPanel(panel === "context" ? null : "context")}
          >
            Ajouter du contexte
          </button>
        )}
      </div>
      {panel === "why" && (
        <div className="world-graph-why">
          {reasons.length === 0 && (
            <p className="world-graph-empty">
              Aucun élément cité pour cet objet.
            </p>
          )}
          {reasons.map((reason, index) => (
            <article key={`${reason.kind}-${index}`}>
              <div className="world-graph-reason-head">
                <span className={`reason-${reason.kind}`}>
                  {REASON_LABELS[reason.kind]}
                </span>
                {reason.contested && <span>corrigé par vous</span>}
              </div>
              <p>{reason.label}</p>
              {reason.excerpts.map((excerpt, position) => (
                <blockquote key={`${excerpt.sourceId}-${position}`}>
                  « {excerpt.quote} »
                  <cite>
                    {excerpt.eventTitle ?? "source"}
                    {excerpt.occurredStart
                      ? ` · ${excerpt.occurredStart.slice(0, 10)}`
                      : ""}
                  </cite>
                </blockquote>
              ))}
            </article>
          ))}
        </div>
      )}
      {(panel === "correct" || panel === "context") && (
        <form
          className="world-graph-annotate"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <textarea
            value={text}
            rows={3}
            aria-label={
              panel === "correct" ? "Votre correction" : "Contexte à ajouter"
            }
            placeholder={
              panel === "correct"
                ? correctionType === "disagreement"
                  ? "Ce qui, selon vous, ne tient pas dans cette lecture…"
                  : "Ce qui est inexact, et ce qui s’est vraiment passé…"
                : "Ce que MANWË ne sait pas encore et qui change la lecture…"
            }
            onChange={(event) => setText(event.target.value)}
          />
          <small>
            Conservé comme votre déclaration, citable ; la source d’origine
            n’est pas modifiée.
          </small>
          <button type="submit" disabled={busy || !text.trim()}>
            {busy ? "Enregistrement…" : "Conserver"}
          </button>
        </form>
      )}
    </div>
  );
}

export function WorldGraph({
  snapshot,
  onAnnotate,
}: {
  snapshot: WorkspaceSnapshot;
  onAnnotate?: Annotate;
}) {
  const [focus, setFocus] = useState<FocusContext>({
    kind: "self",
    id: "self",
  });
  const [projection, setProjection] = useState<GraphProjection | null>(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [level, setLevel] = useState<DetailLevel>("full");
  // Dernière disposition par focus : une nouvelle révision ne déplace pas
  // ce qui était déjà à l'écran (R4.4).
  const previous = useRef(new Map<string, PlacedNode[]>());
  const revision = snapshot.workspace.revision;

  useEffect(() => {
    let alive = true;
    setError("");
    memoryApi
      .graph(focus)
      .then((result) => {
        if (alive) setProjection(result);
      })
      .catch((cause: unknown) => {
        if (alive)
          setError(
            cause instanceof Error ? cause.message : "Graphe indisponible.",
          );
      });
    return () => {
      alive = false;
    };
  }, [focus, revision]);

  const placed = useMemo(() => {
    if (!projection) return [];
    const key = focusNodeId(projection);
    const result = anchorLayout(
      layoutGraph(projection),
      previous.current.get(key) ?? null,
    );
    previous.current.set(key, result);
    return result;
  }, [projection]);
  const visible = visibleNodeIds(placed, level);
  const byId = new Map(
    placed
      .filter((node) => visible.has(node.id))
      .map((node) => [node.id, node]),
  );
  const hidden = placed.length - byId.size;
  const detail = selected ? byId.get(selected) : undefined;
  const centerId = projection ? focusNodeId(projection) : "self";

  const choose = (node: PlacedNode) => {
    const next = focusFromNodeId(node.id);
    setSelected(node.id);
    if (next && node.id !== centerId) setFocus(next);
  };

  const shortcuts: { label: string; focus: FocusContext }[] = [
    { label: "Vous", focus: { kind: "self", id: "self" } },
    ...snapshot.persons.slice(0, 7).map((person) => ({
      label: person.displayName,
      focus: { kind: "person" as const, id: person.id },
    })),
  ];

  return (
    <section className="world-graph" aria-label="Graphe de votre monde">
      <div className="world-graph-toolbar">
        <div className="segmented" aria-label="Centrer le graphe">
          {shortcuts.map((item) => (
            <button
              key={`${item.focus.kind}:${item.focus.id}`}
              className={
                focus.kind === item.focus.kind && focus.id === item.focus.id
                  ? "active"
                  : ""
              }
              onClick={() => setFocus(item.focus)}
            >
              {short(item.label, 18)}
            </button>
          ))}
        </div>
        <div className="segmented" aria-label="Niveau de détail">
          <button
            className={level === "essential" ? "active" : ""}
            aria-pressed={level === "essential"}
            onClick={() => setLevel("essential")}
          >
            Essentiel
          </button>
          <button
            className={level === "full" ? "active" : ""}
            aria-pressed={level === "full"}
            onClick={() => setLevel("full")}
          >
            Détails
          </button>
        </div>
        <div className="world-graph-legend" aria-label="Légende des traits">
          {(
            [
              "observed",
              "reported",
              "impression",
              "inferred",
              "unknown",
            ] as const
          ).map((style) => (
            <span key={style}>
              <svg width="26" height="8" aria-hidden="true">
                {style === "inferred" ? (
                  <g className="world-edge-inferred">
                    <path d="M1,4 L25,4" className="world-edge-double-outer" />
                    <path d="M1,4 L25,4" className="world-edge-double-inner" />
                  </g>
                ) : (
                  <path
                    d="M1,4 L25,4"
                    className={`world-edge world-edge-${style}`}
                  />
                )}
              </svg>
              {STYLE_LABELS[style]}
            </span>
          ))}
        </div>
      </div>
      {error && <div className="analysis-error">{error}</div>}
      {projection && placed.length <= 1 && !error && (
        <p className="world-graph-empty">
          Rien à relier pour l’instant autour de ce focus. Les relations
          apparaissent quand une analyse a extrait des rôles cités.
        </p>
      )}
      {projection && placed.length > 1 && (
        <svg
          className="world-graph-canvas"
          viewBox={`0 0 ${LAYOUT_WIDTH} ${LAYOUT_HEIGHT}`}
          role="group"
          aria-label="Personnes, relations et lectures autour du focus. Sélectionnez un élément pour recentrer."
        >
          {projection.edges.map((edge) => {
            const from = byId.get(edge.from);
            const to = byId.get(edge.to);
            if (!from || !to) return null;
            const hypothesis = [from, to].find(
              (node) => node.kind === "hypothesis",
            );
            return (
              <Edge
                key={edge.id}
                edge={edge}
                from={from}
                to={to}
                shaky={hypothesis ? tremor(hypothesis) : "medium"}
              />
            );
          })}
          {placed
            .filter((node) => visible.has(node.id))
            .map((node) => {
              const radius = nodeRadius(node);
              const label =
                node.kind === "question" ? `? ${node.label}` : node.label;
              return (
                <g
                  key={node.id}
                  className={`world-node world-node-${node.kind} world-node-${node.style} ${node.id === centerId ? "is-focus" : ""} ${node.id === selected ? "is-selected" : ""}`}
                  style={{ transform: `translate(${node.x}px, ${node.y}px)` }}
                  role="button"
                  tabIndex={0}
                  aria-label={`${KIND_LABELS[node.kind]} : ${node.label}`}
                  onClick={() => choose(node)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      choose(node);
                    }
                  }}
                >
                  {node.kind === "relation" ? (
                    <rect
                      x={-radius}
                      y={-radius * 0.6}
                      width={radius * 2}
                      height={radius * 1.2}
                      rx={radius * 0.6}
                    />
                  ) : node.kind === "hypothesis" ? (
                    <polygon
                      points={`0,${-radius} ${radius},0 0,${radius} ${-radius},0`}
                    />
                  ) : (
                    <circle r={radius} />
                  )}
                  {node.kind === "hypothesis" && node.meta.rank === 1 && (
                    <text className="world-node-rank" dy="4">
                      1
                    </text>
                  )}
                  {(node.style === "unknown" || node.kind === "question") && (
                    <text className="world-node-unknown" dy="4">
                      ?
                    </text>
                  )}
                  <text className="world-node-label" y={radius + 14}>
                    {short(label)}
                  </text>
                </g>
              );
            })}
        </svg>
      )}
      {detail && (
        <aside className="world-graph-detail" aria-live="polite">
          <div className="eyebrow">
            {KIND_LABELS[detail.kind].toUpperCase()} ·{" "}
            {STYLE_LABELS[detail.style]}
          </div>
          <p>{detail.label}</p>
          {detail.kind === "hypothesis" && (
            <small>
              {String(detail.meta.depth)} ·{" "}
              {STATUS_LABELS[String(detail.meta.status)] ??
                String(detail.meta.status)}{" "}
              · confiance{" "}
              {CONFIDENCE_LABELS[String(detail.meta.confidence)] ??
                String(detail.meta.confidence)}
              {detail.meta.rank ? ` · rang ${String(detail.meta.rank)}` : ""}
              {detail.meta.needsReview ? " · à réexaminer" : ""}
            </small>
          )}
          {detail.kind === "relation" && (
            <small>
              {String(detail.meta.episodes)} épisode(s) ·{" "}
              {String(detail.meta.counterexamples)} contre-exemple(s)
              {detail.meta.episodesPer30Days !== null
                ? ` · ${String(detail.meta.episodesPer30Days)} / 30 j`
                : ""}
            </small>
          )}
          <ul>
            {projection?.edges
              .filter(
                (edge) => edge.from === detail.id || edge.to === detail.id,
              )
              .slice(0, 8)
              .map((edge) => {
                const other = byId.get(
                  edge.from === detail.id ? edge.to : edge.from,
                );
                return (
                  <li key={edge.id}>
                    {EDGE_LABELS[edge.kind] ?? edge.kind} ·{" "}
                    {other ? short(other.label, 48) : "?"}
                  </li>
                );
              })}
          </ul>
          <DetailActions
            snapshot={snapshot}
            node={detail}
            onAnnotate={onAnnotate}
          />
        </aside>
      )}
      {hidden > 0 && (
        <p className="world-graph-note">
          Vue essentielle : {hidden} élément{hidden > 1 ? "s" : ""} masqué
          {hidden > 1 ? "s" : ""}, sans rien déplacer.
        </p>
      )}
      {projection?.truncated && (
        <p className="world-graph-note">
          Schéma allégé : 7 relations et 5 lectures au plus. Recentrez sur un
          élément pour voir le reste.
        </p>
      )}
    </section>
  );
}
