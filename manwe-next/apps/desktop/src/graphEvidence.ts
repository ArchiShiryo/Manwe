// « Pourquoi ? » depuis le graphe (R4.5). Fonction pure : pour un nœud, elle
// rassemble les éléments qui le fondent, chacun relié à son épisode et à
// l'extrait exact de la source. Rien n'est reformulé.
import type {
  AnnotationCommand,
  WorkspaceSnapshot,
} from "../../../packages/domain/src/memory.ts";

export type Excerpt = {
  quote: string;
  sourceId: string;
  eventId: string | null;
  eventTitle: string | null;
  occurredStart: string | null;
};

export type Reason = {
  /** Soutient ou contredit la lecture ; rôle tenu dans un épisode ; ou fait cité. */
  kind: "supports" | "contradicts" | "role" | "cites";
  label: string;
  category: string | null;
  contested: boolean;
  excerpts: Excerpt[];
};

const ROLE_LABELS: Record<string, string> = {
  initiator: "initie",
  recipient: "reçoit",
  requester: "demande",
  helper: "aide",
  responder: "répond",
  observer: "observe",
};
const OUTCOME_LABELS: Record<string, string> = {
  accepted: "accepté",
  declined: "refusé",
  unknown: "issue inconnue",
};

function excerptsOf(
  snapshot: WorkspaceSnapshot,
  citations: Array<{ sourceId: string; quote: string }>,
): Excerpt[] {
  return citations.map((citation) => {
    const event = snapshot.events.find(
      (item) => item.sourceId === citation.sourceId,
    );
    return {
      quote: citation.quote,
      sourceId: citation.sourceId,
      eventId: event?.id ?? null,
      eventTitle: event?.title ?? null,
      occurredStart: event?.occurredStart ?? null,
    };
  });
}

function memberName(
  snapshot: WorkspaceSnapshot,
  member: { kind: "self" } | { kind: "person"; personId: string },
) {
  if (member.kind === "self") return "Vous";
  return (
    snapshot.persons.find((person) => person.id === member.personId)
      ?.displayName ?? "personne inconnue"
  );
}

export function explainNode(
  snapshot: WorkspaceSnapshot,
  nodeId: string,
): Reason[] {
  const [kind, ...rest] = nodeId.split(":");
  const id = rest.join(":");
  if (kind === "hypothesis") {
    const hypothesis = snapshot.hypotheses.find((item) => item.id === id);
    if (!hypothesis) return [];
    return hypothesis.evidence
      .filter((item) => item.supersededRevision === null)
      .map((item) => {
        const claim = snapshot.claims.find(
          (entry) => entry.id === item.claimId,
        );
        return {
          kind: item.stance,
          label: claim?.text ?? "élément introuvable",
          category: claim?.category ?? null,
          contested: claim ? claim.contestedRevision !== null : false,
          excerpts: claim ? excerptsOf(snapshot, claim.citations) : [],
        };
      })
      .sort((left, right) => left.kind.localeCompare(right.kind));
  }
  if (kind === "claim") {
    const claim = snapshot.claims.find((item) => item.id === id);
    if (!claim) return [];
    return [
      {
        kind: "cites",
        label: claim.text,
        category: claim.category,
        contested: claim.contestedRevision !== null,
        excerpts: excerptsOf(snapshot, claim.citations),
      },
    ];
  }
  if (kind === "relation") {
    const relation = snapshot.relations.find((item) => item.id === id);
    if (!relation) return [];
    const keys = new Set(
      relation.members.map((member) =>
        member.kind === "self" ? "self" : `person:${member.personId}`,
      ),
    );
    return snapshot.roles
      .filter((role) =>
        keys.has(
          role.subject.kind === "self"
            ? "self"
            : `person:${role.subject.personId}`,
        ),
      )
      .map((role) => ({
        kind: "role" as const,
        label: `${memberName(snapshot, role.subject)} ${ROLE_LABELS[role.role] ?? role.role}${role.outcome ? ` (${OUTCOME_LABELS[role.outcome]})` : ""}`,
        category: null,
        contested: false,
        excerpts: excerptsOf(snapshot, role.citations),
      }))
      .sort((left, right) =>
        String(left.excerpts[0]?.occurredStart ?? "").localeCompare(
          String(right.excerpts[0]?.occurredStart ?? ""),
        ),
      );
  }
  return [];
}

/** Cible d'annotation d'un nœud ; null si on ne peut pas l'annoter directement. */
export function annotationTarget(
  nodeId: string,
): AnnotationCommand["target"] | null {
  const [kind, ...rest] = nodeId.split(":");
  const id = rest.join(":");
  if (
    kind === "hypothesis" ||
    kind === "claim" ||
    kind === "event" ||
    kind === "person" ||
    kind === "question"
  )
    return { kind, id };
  return null;
}
