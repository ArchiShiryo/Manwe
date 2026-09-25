// Thème « Jewel case » (maquette 13, docs/references/themes/06-themes-monde) :
// la couleur d'un lien dit le contexte de la relation (travail, jeu, amitié,
// famille…), jamais une réussite ni une confiance. Fonctions pures.
import type { WorkspaceSnapshot } from "../../../packages/domain/src/memory.ts";

export type ContextKey =
  | "work"
  | "play"
  | "close"
  | "kin"
  | "form"
  | "comm"
  | "intime"
  | "voisin";

export const CONTEXT_COLORS: Record<ContextKey, [number, number, number]> = {
  work: [127, 139, 224],
  play: [238, 153, 60],
  close: [208, 52, 64],
  kin: [196, 195, 200],
  form: [122, 119, 199],
  comm: [165, 62, 102],
  intime: [222, 154, 158],
  voisin: [137, 166, 198],
};

export const CONTEXT_LABELS: Record<ContextKey, string> = {
  work: "Travail",
  play: "Loisirs · jeu",
  close: "Amitié",
  kin: "Famille",
  form: "Formation",
  comm: "Communauté",
  intime: "Couple · intime",
  voisin: "Voisinage · foyer",
};

// Mots du contexte libre saisi avec la note ; le premier qui correspond gagne.
const KEYWORDS: Array<[ContextKey, RegExp]> = [
  ["intime", /couple|conjoint|copine|copain|amour/i],
  ["kin", /famil|parent|frère|soeur|sœur|mère|père|cousin|enfant/i],
  ["work", /travail|boulot|bureau|coll[eè]gue|\bpro\b|client|réunion/i],
  ["form", /école|\bfac\b|universit|formation|cours|classe|étude/i],
  ["play", /club|jeu|loisir|sport|volley|foot|match|tournoi|jeux/i],
  ["voisin", /coloc|voisin|appart|immeuble|foyer|maison/i],
  ["comm", /asso|communaut|bénévol|paroisse|quartier/i],
  ["close", /ami|amitié|pote|proche/i],
];

export function contextKey(context: string | null | undefined): ContextKey {
  if (!context) return "close";
  for (const [key, pattern] of KEYWORDS) if (pattern.test(context)) return key;
  const keys = Object.keys(CONTEXT_COLORS) as ContextKey[];
  let hash = 0;
  for (const char of context.toLowerCase())
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return keys[hash % keys.length];
}

/**
 * Part de chaque contexte dans les épisodes d'une personne (rôles cités),
 * du plus fréquent au moins fréquent. Vide si aucun épisode.
 */
export function personContexts(
  snapshot: WorkspaceSnapshot,
  personId: string,
): Array<{ key: ContextKey; share: number }> {
  const eventIds = new Set(
    snapshot.roles
      .filter(
        (role) =>
          role.subject.kind === "person" && role.subject.personId === personId,
      )
      .map((role) => role.eventId),
  );
  const counts = new Map<ContextKey, number>();
  for (const event of snapshot.events)
    if (eventIds.has(event.id)) {
      const key = contextKey(event.context);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  const total = [...counts.values()].reduce((sum, value) => sum + value, 0);
  return [...counts.entries()]
    .map(([key, count]) => ({ key, share: count / total }))
    .sort((left, right) => right.share - left.share);
}

/** Contextes présents dans l'espace, pour la légende « Contextes = couleurs ». */
export function workspaceContexts(snapshot: WorkspaceSnapshot) {
  const counts = new Map<ContextKey, number>();
  for (const event of snapshot.events) {
    const key = contextKey(event.context);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return (Object.keys(CONTEXT_COLORS) as ContextKey[]).map((key) => ({
    key,
    count: counts.get(key) ?? 0,
  }));
}

export const rgb = ([r, g, b]: [number, number, number], alpha = 1) =>
  alpha === 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${alpha})`;
