import type { Person } from "../../../packages/domain/src/demo.ts";
import type {
  ClaimModality,
  InformationCategory,
} from "../../../packages/domain/src/memory.ts";

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
