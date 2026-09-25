// Indicateurs relationnels déterministes (BRIEF-004, D-012, D-013).
// Fonctions pures : elles résument des rôles d'épisodes cités et datés.
// Ce sont des ancrages chiffrés, jamais des preuves à eux seuls.

export const EPISODE_ROLES = [
  "initiator",
  "recipient",
  "requester",
  "helper",
  "responder",
  "observer",
] as const;
export type EpisodeRole = (typeof EPISODE_ROLES)[number];
export const ROLE_OUTCOMES = ["accepted", "declined", "unknown"] as const;
export type RoleOutcome = (typeof ROLE_OUTCOMES)[number];

/** « self » ou « person:<id> ». */
export type MemberKey = string;

export type RoleFact = {
  eventId: string;
  member: MemberKey;
  role: EpisodeRole;
  outcome: RoleOutcome | null;
  occurredAt: string | null;
};

export type SideCounts = Record<MemberKey, number>;

export type RelationIndicators = {
  /** Épisodes où au moins un membre tient un rôle. */
  episodes: number;
  initiatives: SideCounts;
  requests: SideCounts;
  /** Demandes acceptées ou refusées, du point de vue de celui qui répond. */
  acceptedRequests: SideCounts;
  declinedRequests: SideCounts;
  help: SideCounts;
  /** Initiatives du membre minoritaire : les exceptions au schéma dominant. */
  counterexamples: number;
  firstAt: string | null;
  lastAt: string | null;
  spanDays: number;
  /** Épisodes par tranche de 30 jours sur l'étendue observée. */
  episodesPer30Days: number | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function memberKey(
  member: { kind: "self" } | { kind: "person"; personId: string },
) {
  return member.kind === "self" ? "self" : `person:${member.personId}`;
}

/** Clé canonique d'une dyade, indépendante de l'ordre des membres. */
export function relationKey(members: MemberKey[]) {
  return [...new Set(members)].sort().join("|");
}

const zero = (members: MemberKey[]): SideCounts =>
  Object.fromEntries(members.map((member) => [member, 0]));

export function relationIndicators(
  members: MemberKey[],
  roles: RoleFact[],
): RelationIndicators {
  const inRelation = roles.filter((fact) => members.includes(fact.member));
  const initiatives = zero(members);
  const requests = zero(members);
  const help = zero(members);
  const acceptedRequests = zero(members);
  const declinedRequests = zero(members);
  const events = new Map<string, string | null>();
  for (const fact of inRelation) {
    events.set(
      fact.eventId,
      fact.occurredAt ?? events.get(fact.eventId) ?? null,
    );
    if (fact.role === "initiator") initiatives[fact.member] += 1;
    if (fact.role === "requester") requests[fact.member] += 1;
    if (fact.role === "helper") help[fact.member] += 1;
    if (fact.role === "responder" && fact.outcome === "accepted")
      acceptedRequests[fact.member] += 1;
    if (fact.role === "responder" && fact.outcome === "declined")
      declinedRequests[fact.member] += 1;
  }
  const initiativeValues = members.map((member) => initiatives[member]);
  const counterexamples =
    members.length === 2 && initiativeValues[0] !== initiativeValues[1]
      ? Math.min(...initiativeValues)
      : 0;
  const times = [...events.values()]
    .filter(
      (date): date is string => !!date && Number.isFinite(Date.parse(date)),
    )
    .map((date) => Date.parse(date))
    .sort((left, right) => left - right);
  const spanDays = times.length
    ? Math.round((times[times.length - 1] - times[0]) / DAY_MS)
    : 0;
  return {
    episodes: events.size,
    initiatives,
    requests,
    acceptedRequests,
    declinedRequests,
    help,
    counterexamples,
    firstAt: times.length ? new Date(times[0]).toISOString() : null,
    lastAt: times.length
      ? new Date(times[times.length - 1]).toISOString()
      : null,
    spanDays,
    episodesPer30Days:
      times.length > 1 && spanDays > 0
        ? Math.round((events.size / spanDays) * 30 * 10) / 10
        : null,
  };
}
