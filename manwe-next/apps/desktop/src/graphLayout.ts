// Disposition déterministe d'une projection du graphe (R4.3). Le focus est au
// centre ; chaque nœud est placé sur l'anneau de sa distance au focus, et les
// anneaux sont ordonnés par type puis par identifiant pour rester stables d'une
// révision à l'autre. Aucun hasard, aucune simulation physique.
import type {
  GraphNode,
  GraphProjection,
} from "../../../packages/cognition/src/projection.ts";

export type PlacedNode = GraphNode & { x: number; y: number; ring: number };

const KIND_ORDER: GraphNode["kind"][] = [
  "self",
  "person",
  "relation",
  "hypothesis",
  "question",
  "claim",
  "event",
];

export const LAYOUT_WIDTH = 960;
export const LAYOUT_HEIGHT = 620;
const RING_STEP = 150;

export function focusNodeId(projection: GraphProjection) {
  const { kind, id } = projection.focus;
  return kind === "self" ? "self" : `${kind}:${id}`;
}

export function layoutGraph(projection: GraphProjection): PlacedNode[] {
  const center = focusNodeId(projection);
  const neighbours = new Map<string, string[]>();
  for (const edge of projection.edges) {
    neighbours.set(edge.from, [...(neighbours.get(edge.from) ?? []), edge.to]);
    neighbours.set(edge.to, [...(neighbours.get(edge.to) ?? []), edge.from]);
  }
  const distance = new Map<string, number>();
  if (projection.nodes.some((node) => node.id === center)) {
    distance.set(center, 0);
    const queue = [center];
    while (queue.length) {
      const current = queue.shift() as string;
      for (const next of neighbours.get(current) ?? [])
        if (!distance.has(next)) {
          distance.set(next, (distance.get(current) as number) + 1);
          queue.push(next);
        }
    }
  }
  const maxRing = Math.max(0, ...distance.values());
  const ringOf = (node: GraphNode) => distance.get(node.id) ?? maxRing + 1;
  const rings = new Map<number, GraphNode[]>();
  for (const node of projection.nodes)
    rings.set(ringOf(node), [...(rings.get(ringOf(node)) ?? []), node]);
  const placed: PlacedNode[] = [];
  const cx = LAYOUT_WIDTH / 2;
  const cy = LAYOUT_HEIGHT / 2;
  const angles = new Map<string, number>();
  for (const [ring, nodes] of [...rings.entries()].sort(
    (a, b) => a[0] - b[0],
  )) {
    const ordered = [...nodes].sort(
      (left, right) =>
        KIND_ORDER.indexOf(left.kind) - KIND_ORDER.indexOf(right.kind) ||
        left.id.localeCompare(right.id),
    );
    if (ring === 0) {
      for (const node of ordered) placed.push({ ...node, x: cx, y: cy, ring });
      continue;
    }
    // Anneau 1 : réparti régulièrement depuis le haut. Anneaux suivants :
    // chaque nœud vise l'angle moyen de ses voisins déjà placés, puis un
    // écart minimal évite les chevauchements.
    const step = (2 * Math.PI) / ordered.length;
    const wanted = ordered.map((node, index) => {
      const parents = (neighbours.get(node.id) ?? [])
        .map((id) => angles.get(id))
        .filter((angle) => angle !== undefined);
      if (ring === 1 || !parents.length) return -Math.PI / 2 + step * index;
      const x = parents.reduce((sum, angle) => sum + Math.cos(angle), 0);
      const y = parents.reduce((sum, angle) => sum + Math.sin(angle), 0);
      return Math.atan2(y, x);
    });
    const order = ordered
      .map((node, index) => ({ node, angle: wanted[index] }))
      .sort((left, right) => left.angle - right.angle);
    const gap = Math.min(step, 0.5);
    for (let index = 1; index < order.length; index += 1)
      order[index].angle = Math.max(
        order[index].angle,
        order[index - 1].angle + gap,
      );
    // Anneaux elliptiques pour occuper le cadre large.
    const rx = Math.min(RING_STEP * ring * 1.35, LAYOUT_WIDTH / 2 - 90);
    const ry = Math.min(RING_STEP * ring * 0.85, LAYOUT_HEIGHT / 2 - 50);
    for (const { node, angle } of order) {
      angles.set(node.id, angle);
      placed.push({
        ...node,
        x: Math.round(cx + rx * Math.cos(angle)),
        y: Math.round(cy + ry * Math.sin(angle)),
        ring,
      });
    }
  }
  return placed;
}

/** Nœuds sur lesquels on peut recentrer le graphe. */
export function focusFromNodeId(id: string): GraphProjection["focus"] | null {
  if (id === "self") return { kind: "self", id: "self" };
  const [kind, ...rest] = id.split(":");
  const value = rest.join(":");
  if (
    kind === "person" ||
    kind === "relation" ||
    kind === "hypothesis" ||
    kind === "question"
  )
    return { kind, id: value };
  return null;
}

/** Plus la lecture est incertaine, plus le double trait tremble. */
export function tremor(node: GraphNode) {
  if (node.kind !== "hypothesis") return "none";
  const confidence = node.meta.confidence;
  return confidence === "high"
    ? "low"
    : confidence === "moderate"
      ? "medium"
      : "high";
}

const MIN_DISTANCE = 44;

/**
 * R4.4 : après une nouvelle révision sur le même focus, les nœuds déjà
 * visibles gardent leur place ; seuls les nouveaux sont posés, à l'endroit
 * libre le plus proche de leur position calculée.
 */
export function anchorLayout(
  placed: PlacedNode[],
  previous: PlacedNode[] | null,
): PlacedNode[] {
  if (!previous?.length) return placed;
  const before = new Map(previous.map((node) => [node.id, node]));
  const kept = placed.map((node) => {
    const old = before.get(node.id);
    return old ? { ...node, x: old.x, y: old.y } : node;
  });
  const fixed = kept.filter((node) => before.has(node.id));
  const free = (x: number, y: number) =>
    fixed.every(
      (other) => Math.hypot(other.x - x, other.y - y) >= MIN_DISTANCE,
    );
  const inside = (x: number, y: number) =>
    x >= 40 && x <= LAYOUT_WIDTH - 40 && y >= 30 && y <= LAYOUT_HEIGHT - 30;
  return kept.map((node) => {
    if (before.has(node.id)) return node;
    let spot = { x: node.x, y: node.y };
    // Spirale déterministe autour de la position calculée.
    for (let step = 0; step < 60 && !free(spot.x, spot.y); step += 1) {
      const angle = step * 0.9;
      const radius = MIN_DISTANCE * (1 + step / 6);
      const x = Math.round(node.x + radius * Math.cos(angle));
      const y = Math.round(node.y + radius * Math.sin(angle));
      if (inside(x, y)) spot = { x, y };
    }
    const result = { ...node, ...spot };
    fixed.push(result);
    return result;
  });
}

export type DetailLevel = "essential" | "full";

/**
 * Zoom sémantique (R4.4) : il masque des objets sans changer le focus ni
 * déplacer ceux qui restent. « Essentiel » garde le focus, ses voisins
 * directs, les personnes et relations, et les lectures principales (rang 1).
 */
export function visibleNodeIds(
  placed: PlacedNode[],
  level: DetailLevel,
): Set<string> {
  if (level === "full") return new Set(placed.map((node) => node.id));
  return new Set(
    placed
      .filter(
        (node) =>
          node.ring <= 1 ||
          node.kind === "self" ||
          node.kind === "person" ||
          node.kind === "relation" ||
          (node.kind === "hypothesis" && node.meta.rank === 1),
      )
      .map((node) => node.id),
  );
}
