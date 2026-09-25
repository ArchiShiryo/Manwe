import type { Person } from "../../../packages/domain/src/demo.ts";
import type {
  ClaimModality,
  Hypothesis,
  InformationCategory,
} from "../../../packages/domain/src/memory.ts";
import type { CognitiveOperation } from "../../../packages/cognition/src/contract.ts";

export function Sigil({ small = false }: { small?: boolean }) {
  return (
    <svg
      className={small ? "sigil small" : "sigil"}
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M7 29V12l13 10 13-10v17M7 12l13 20 13-20M20 5v27"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="20" cy="5" r="2" fill="currentColor" />
    </svg>
  );
}
export function Avatar({
  person,
  size = "",
}: {
  person: Person;
  size?: string;
}) {
  return (
    <span className={`avatar ${person.color} ${size}`}>{person.initials}</span>
  );
}
export function dateLabel(value: string, full = false) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: full ? "long" : "short",
    ...(full ? { year: "numeric" } : {}),
  }).format(new Date(value));
}
export const categoryLabels = {
  reported: "Fait rapporté",
  impression: "Impression",
  note: "Note non analysée",
};

export const informationCategoryLabels: Record<
  Exclude<InformationCategory, "unclassified_note">,
  string
> = {
  explicit_statement: "déclaration explicite",
  sourced_observation: "observation directe",
  reported_observation: "observation rapportée",
  user_impression: "impression utilisateur",
  inference: "inférence",
};

export const claimModalityLabels: Record<ClaimModality, string> = {
  actual: "fait",
  intended: "intention",
  hypothetical: "hypothèse",
};

export const depthLabels: Record<Hypothesis["depth"], string> = {
  D1: "surface",
  D2: "schéma relationnel",
  D3: "motifs / attachement",
  D4: "personnalité / psychodynamique",
  D5: "groupe / champ",
};

export const confidenceLabels: Record<Hypothesis["confidence"], string> = {
  low: "confiance faible",
  moderate: "confiance modérée",
  high: "confiance élevée",
};

export const hypothesisStatusLabels: Record<Hypothesis["status"], string> = {
  draft: "brouillon",
  plausible: "plausible",
  contradicted: "contredite",
  superseded: "dépassée",
};

export const reviewReasonLabels: Record<
  NonNullable<Hypothesis["reviewReason"]>,
  string
> = {
  correction: "correction factuelle",
  context: "contexte ajouté",
  disagreement: "désaccord",
  answer: "réponse à une question",
};

/** Résumé lisible d'une opération proposée, pour l'aperçu avant confirmation. */
export function describeOperation(operation: CognitiveOperation): {
  label: string;
  classification: string;
  text: string;
} {
  switch (operation.kind) {
    case "propose_claim":
      return {
        label: "claim",
        classification: `${informationCategoryLabels[operation.payload.category]} · ${claimModalityLabels[operation.payload.modality]}`,
        text: operation.payload.text,
      };
    case "propose_role":
      return {
        label: "rôle",
        classification: operation.payload.outcome
          ? `${operation.payload.role} · ${operation.payload.outcome}`
          : operation.payload.role,
        text: operation.payload.citations[0]?.quote ?? "",
      };
    case "propose_person":
      return {
        label: "personne",
        classification: operation.payload.relationLabel ?? "citée",
        text: operation.payload.mention,
      };
    case "propose_event":
      return {
        label: "événement",
        classification: `${informationCategoryLabels[operation.payload.category]} · ${claimModalityLabels.actual}`,
        text: operation.payload.text,
      };
    case "propose_hypothesis":
      return {
        label: "hypothèse",
        classification: [
          `${operation.payload.depth} ${depthLabels[operation.payload.depth]}`,
          operation.payload.construct,
          confidenceLabels[operation.payload.confidence],
        ]
          .filter(Boolean)
          .join(" · "),
        text: operation.payload.statement,
      };
    case "revise_hypothesis":
      return {
        label: "révision",
        classification: `${hypothesisStatusLabels[operation.payload.status]} · ${confidenceLabels[operation.payload.confidence]}`,
        text: `${operation.payload.addEvidence.length} preuve(s) ajoutée(s)`,
      };
    case "propose_question":
      return {
        label: "question",
        classification: operation.payload.discriminatingInfo,
        text: operation.payload.question,
      };
    case "propose_critique":
      return {
        label: "passe critique",
        classification: `${operation.payload.findings.length} constat(s)`,
        text: operation.payload.findings.length
          ? operation.payload.findings
              .map((finding) => finding.detail)
              .join(" · ")
          : "Aucun constat",
      };
    case "propose_goal":
      return {
        label: "objectif proposé",
        classification: operation.payload.problem,
        text: operation.payload.goal,
      };
    case "propose_direction":
      return {
        label:
          operation.payload.lever.kind === "do_nothing"
            ? "ne rien entreprendre"
            : "direction",
        classification: `${leverLabels[operation.payload.lever.kind]} · effort ${effortLabels[operation.payload.effort]}`,
        text: `${operation.payload.title} — ${operation.payload.action}`,
      };
  }
}

export const leverLabels: Record<string, string> = {
  change_reward: "changer ce qui est récompensé",
  lower_barrier: "abaisser la barrière",
  alternative_source: "autre source du même gain",
  disconfirming_experience: "expérience qui dément une croyance",
  change_game: "changer de jeu",
  do_nothing: "ne rien entreprendre",
};
export const effortLabels: Record<string, string> = {
  low: "faible",
  moderate: "modéré",
  high: "élevé",
};
export const phaseLabels: Record<string, string> = {
  immediate: "tout de suite",
  transitional: "phase transitoire",
  equilibrium: "nouvel équilibre",
};
