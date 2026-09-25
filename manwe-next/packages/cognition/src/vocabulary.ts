// Vocabulaires canoniques (R4.0d, D-014). Source unique des valeurs permises :
// le contrat les contrôle, le moteur de révision les ordonne, le registre
// ontologique les expose et le test d'ontologie vérifie que le prompt et le
// stockage les acceptent. Aucune dépendance, pour éviter les cycles.

export const DEPTHS = ["D1", "D2", "D3", "D4", "D5"] as const;
export const CONFIDENCES = ["low", "moderate", "high"] as const;
export const HYPOTHESIS_STATUSES = [
  "draft",
  "plausible",
  "contradicted",
  "superseded",
] as const;
/** Statuts permis à la création d'une lecture (D-015). */
export const CREATION_STATUSES = ["draft", "plausible"] as const;
export const EVIDENCE_STANCES = ["supports", "contradicts"] as const;
export const CLAIM_CATEGORIES = [
  "explicit_statement",
  "sourced_observation",
  "reported_observation",
  "user_impression",
  "inference",
] as const;
export const CLAIM_MODALITIES = ["actual", "intended", "hypothetical"] as const;
export const TEMPORAL_PRECISIONS = [
  "exact",
  "day",
  "approximate",
  "interval",
  "unknown",
] as const;
export const ANNOTATION_TYPES = [
  "factual_correction",
  "context",
  "disagreement",
  "agreement",
] as const;

export type HypothesisDepth = (typeof DEPTHS)[number];
export type Confidence = (typeof CONFIDENCES)[number];
export type HypothesisStatus = (typeof HYPOTHESIS_STATUSES)[number];
export type EvidenceStance = (typeof EVIDENCE_STANCES)[number];
