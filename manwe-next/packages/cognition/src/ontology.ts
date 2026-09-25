// Registre ontologique unique (R4.0d, D-014). Il décrit ce qui existe dans
// MANWË : types d'objets, liens typés et actions permises. Le contrat, le
// prompt et le stockage doivent rester alignés sur lui ; un test le vérifie.

import type {
  AnnotationType,
  Claim,
  ClaimModality,
  Hypothesis,
  InformationCategory,
} from "../../domain/src/memory.ts";
import {
  CRITIQUE_KINDS,
  DEFAULT_OPERATIONS,
  MECHANISM_KEYS,
} from "./contract.ts";
import { EPISODE_ROLES, ROLE_OUTCOMES } from "./relations.ts";
import {
  ANNOTATION_TYPES,
  CLAIM_CATEGORIES,
  CLAIM_MODALITIES,
  CONFIDENCES,
  CREATION_STATUSES,
  DEPTHS,
  EVIDENCE_STANCES,
  HYPOTHESIS_STATUSES,
  TEMPORAL_PRECISIONS,
} from "./vocabulary.ts";

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
  // Dans le graphe, la source est représentée par son épisode.
  cites: ["claim", "source|event"],
  occurs_in: ["event", "source"],
  // Le rôle (table event_roles) est porté par le lien membre → épisode.
  plays_role: ["person|self", "event"],
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
  depths: DEPTHS,
  statuses: HYPOTHESIS_STATUSES,
  confidences: CONFIDENCES,
  stances: EVIDENCE_STANCES,
  categories: CLAIM_CATEGORIES,
  modalities: CLAIM_MODALITIES,
  annotationTypes: ANNOTATION_TYPES,
  creationStatuses: CREATION_STATUSES,
  temporalPrecisions: TEMPORAL_PRECISIONS,
  critiqueKinds: CRITIQUE_KINDS,
} as const;

// Contrôle à la compilation : les types du domaine et les vocabulaires
// canoniques décrivent exactement les mêmes valeurs (R4.0d).
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const _aligned: [
  Same<AnnotationType, (typeof ANNOTATION_TYPES)[number]>,
  Same<
    Exclude<InformationCategory, "unclassified_note">,
    (typeof CLAIM_CATEGORIES)[number]
  >,
  Same<ClaimModality, (typeof CLAIM_MODALITIES)[number]>,
  Same<Hypothesis["depth"], (typeof DEPTHS)[number]>,
  Same<Hypothesis["status"], (typeof HYPOTHESIS_STATUSES)[number]>,
  Same<Hypothesis["confidence"], (typeof CONFIDENCES)[number]>,
  Same<Claim["category"], (typeof CLAIM_CATEGORIES)[number]>,
] = [true, true, true, true, true, true, true];
void _aligned;

/**
 * Rendu d'un gabarit de prompt (R4.0d) : chaque `{{enum:nom}}` devient la
 * liste des valeurs du registre, au format du schéma (`"a" | "b"`). Le prompt
 * versionné est la sortie de ce rendu ; un test vérifie l'identité exacte.
 */
export function renderPrompt(template: string): string {
  return template.replace(/\{\{enum:(\w+)\}\}/g, (_, name: string) => {
    const list = (VOCABULARIES as Record<string, readonly string[]>)[name];
    if (!list) throw new Error(`Vocabulaire inconnu dans le gabarit : ${name}`);
    return list.map((value) => `"${value}"`).join(" | ");
  });
}
