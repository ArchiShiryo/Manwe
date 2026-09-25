import type { MemoryStatus } from "./memoryApi.ts";

/** « online » : révision vérifiée ; « reconnecting » : service injoignable, dernière révision connue affichée. */
export type ConnectionState = "online" | "reconnecting";

/**
 * Mode réel (R4.7) : état de la connexion et des analyses, sans indicateur
 * d'inférence pendant une attente manuelle.
 */
export function syncLabels(
  connection: ConnectionState,
  remote: MemoryStatus | null,
) {
  const analyses = remote?.analyses;
  const analysis = !analyses
    ? null
    : analyses.readyForReview
      ? `Proposition à examiner (${analyses.readyForReview})`
      : analyses.needsContext
        ? "L’analyse demande du contexte"
        : analyses.awaitingResponse
          ? analyses.modes.includes("automatic")
            ? "Analyse automatique en cours"
            : "Analyse assistée : en attente de la réponse collée"
          : null;
  return {
    connection:
      connection === "online"
        ? "Mémoire locale disponible"
        : "Service injoignable · reconnexion…",
    analysis,
  };
}
