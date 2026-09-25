// Registre ontologique unique (R4.0d, D-014). Il décrit ce qui existe dans
// MANWË : types d'objets, liens typés et actions permises. Le contrat, le
// prompt et le stockage doivent rester alignés sur lui ; un test le vérifie.

import { MECHANISM_KEYS, DEFAULT_OPERATIONS } from "./contract.ts";
import { EPISODE_ROLES, ROLE_OUTCOMES } from "./relations.ts";

export const OBJECT_TYPES = {
  source: "Texte d'origine, jamais modifié ; toute affirmation le cite.",
  event: "Épisode daté, extrait d'une source.",
  claim: "Affirmation avec provenance (catégorie) et modalité.",
  person: "Personne mentionnée, résolue ou candidate.",
  relation: "Dyade (avec ou sans l'utilisateur), objet à part entière (D-012).",
  role: "Rôle tenu dans un épisode, cité (D-013).",
  hypothesis: "Lecture D1 à D5, avec preuves, alternative, rang et mécanisme.",
  critique: "Passe critique ; jamais une preuve.",
  question: "Question qui départage des hypothèses.",
  annotation: "Correction, contexte, désaccord ou accord de l'utilisateur.",
  goal: "Objectif de l'utilisateur.",
} as const;

export const LINK_TYPES = {
  cites: ["claim", "source"],
  occurs_in: ["event", "source"],
  plays_role: ["role", "event"],
  supports: ["claim", "hypothesis"],
  contradicts: ["claim", "hypothesis"],
  about: ["hypothesis", "person|self|relation"],
  alternative_to: ["hypothesis", "hypothesis"],
  targets: ["question", "hypothesis"],
  annotates: ["annotation", "claim|event|hypothesis|person"],
  member_of: ["person|self", "relation"],
} as const;

/** Actions du modèle, par tâche : la source de vérité est DEFAULT_OPERATIONS. */
export const ACTIONS = DEFAULT_OPERATIONS;

export const VOCABULARIES = {
  episodeRoles: EPISODE_ROLES,
  roleOutcomes: ROLE_OUTCOMES,
  mechanismKeys: MECHANISM_KEYS,
  depths: ["D1", "D2", "D3", "D4", "D5"],
  statuses: ["draft", "plausible", "contradicted", "superseded"],
  confidences: ["low", "moderate", "high"],
  categories: [
    "explicit_statement",
    "sourced_observation",
    "reported_observation",
    "user_impression",
    "inference",
  ],
} as const;
