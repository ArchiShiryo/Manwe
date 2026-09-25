// Analyse automatique (IA-A.2, IA-A.3). Le service prépare le paquet, l'envoie
// au fournisseur configuré et valide la proposition ; l'interface montre ce qui
// part, l'état réel, les erreurs telles quelles, puis demande une confirmation
// explicite avant toute écriture. Aucun repli silencieux vers Sol ni une fixture.
import { useEffect, useState } from "react";
import { Cpu } from "lucide-react";
import type { AnalysisPreview } from "../../../packages/cognition/src/contract.ts";
import { MemoryApiError, memoryApi, type AutomaticJob } from "./memoryApi.ts";
import { describeOperation } from "./ui.tsx";

const POLL_MS = 1500;

const ERROR_HINTS: Record<string, string> = {
  provider_auth: "Vérifiez la clé du fournisseur côté service.",
  provider_quota: "Rechargez le crédit du fournisseur.",
  provider_rate_limited:
    "Le fournisseur limite le débit ; réessayez plus tard.",
  provider_unreachable: "Le réseau ou le fournisseur est injoignable.",
  provider_timeout: "Le modèle n’a pas répondu à temps.",
  proposal_rejected:
    "Deux propositions ont été refusées par le validateur ; rien n’a été écrit.",
};

export function AutomaticAnalysisPanel({
  disabled,
  onReload,
  onNotify,
}: {
  disabled: boolean;
  onReload: () => Promise<void>;
  onNotify: (message: string) => void;
}) {
  const [provider, setProvider] = useState<Awaited<
    ReturnType<typeof memoryApi.automaticProvider>
  > | null>(null);
  const [task, setTask] = useState<"extract" | "interpret">("extract");
  const [consent, setConsent] = useState(false);
  const [job, setJob] = useState<AutomaticJob | null>(null);
  const [preview, setPreview] = useState<AnalysisPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    memoryApi
      .automaticProvider()
      .then(setProvider)
      .catch(() =>
        setProvider({
          enabled: false,
          providerId: null,
          model: null,
          budget: null,
        }),
      );
  }, [job?.status]);

  useEffect(() => {
    if (!job || job.status !== "running") return;
    const timer = window.setInterval(() => {
      memoryApi
        .automaticJob(job.requestId)
        .then((next) => {
          setJob(next);
          if (next.preview) setPreview(next.preview);
        })
        .catch((cause: unknown) =>
          setError(
            cause instanceof Error ? cause.message : "Suivi impossible.",
          ),
        );
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [job]);

  if (!provider?.enabled) return null;

  const start = async () => {
    setBusy(true);
    setError("");
    setPreview(null);
    try {
      setJob(await memoryApi.startAutomatic(task));
      onNotify(
        `Paquet envoyé à ${provider.model} · proposition à examiner ensuite`,
      );
    } catch (cause) {
      setError(
        cause instanceof MemoryApiError
          ? cause.message
          : "Démarrage impossible.",
      );
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (!job) return;
    setBusy(true);
    try {
      await memoryApi.cancelAnalysis(job.requestId);
      setJob({ ...job, status: "cancelled" });
      onNotify("Analyse automatique annulée · rien n’a été écrit");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Annulation impossible.",
      );
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    if (!job || !preview) return;
    setBusy(true);
    setError("");
    try {
      const result = await memoryApi.applyAnalysis(
        job.requestId,
        preview.responseId,
      );
      setPreview({
        ...preview,
        status: result.status,
        applicationResult: result,
      });
      await onReload();
      onNotify(
        result.status === "no_change"
          ? "Analyse close sans changement"
          : `Analyse appliquée · révision ${result.resultRevision}`,
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Application impossible.",
      );
    } finally {
      setBusy(false);
    }
  };

  const running = job?.status === "running";
  const attempt = (job?.attempts.length ?? 0) + 1;
  return (
    <div className="assisted-analysis automatic-analysis">
      <div className="assisted-analysis-heading">
        <span className="workspace-option-icon">
          <Cpu size={18} />
        </span>
        <div>
          <div className="eyebrow">
            ANALYSE AUTOMATIQUE · {String(provider.model).toUpperCase()}
          </div>
          <h3>Le modèle propose ; vous seul appliquez.</h3>
          {provider.budget && (
            <small className="automatic-budget">
              Budget du jour :{" "}
              {provider.budget.usedToday.toLocaleString("fr-FR")} jetons
              {provider.budget.dailyTokens !== null &&
                ` sur ${provider.budget.dailyTokens.toLocaleString("fr-FR")}`}
            </small>
          )}
          <p>
            Le service envoie au fournisseur le paquet de contexte (sources
            citées, hypothèses en cours) et rien d’autre. Le modèle n’a aucun
            accès à la mémoire ni à ce poste.
          </p>
        </div>
      </div>
      {!running && (
        <div className="analysis-start">
          <label>
            <span>Tâche</span>
            <select
              value={task}
              onChange={(event) =>
                setTask(event.target.value as "extract" | "interpret")
              }
            >
              <option value="extract">Extraire les faits</option>
              <option value="interpret">
                Interpréter (hypothèses, questions)
              </option>
            </select>
          </label>
          <label className="automatic-consent">
            <input
              type="checkbox"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
            />
            <span>
              J’accepte que ce paquet soit transmis à {provider.providerId}.
            </span>
          </label>
          <button
            className="primary-button"
            disabled={disabled || busy || !consent}
            onClick={() => void start()}
          >
            Lancer l’analyse
          </button>
        </div>
      )}
      {running && (
        <div className="automatic-running" role="status">
          <span>
            Analyse automatique en cours · tentative {attempt} sur 2 au plus
          </span>
          <button
            className="text-button"
            disabled={busy}
            onClick={() => void cancel()}
          >
            Annuler
          </button>
        </div>
      )}
      {error && <div className="analysis-error">{error}</div>}
      {job?.status === "failed" && job.error && (
        <div className="analysis-error" role="alert">
          {job.error.message} {ERROR_HINTS[job.error.code] ?? ""} L’analyse
          assistée reste disponible ci-dessous.
        </div>
      )}
      {preview && (
        <div className={`analysis-preview ${preview.status}`}>
          <div className="eyebrow">
            APERÇU · {preview.status.replaceAll("_", " ")} ·{" "}
            {job?.attempts.length} tentative
            {(job?.attempts.length ?? 0) > 1 ? "s" : ""}
          </div>
          <h3>{preview.summary ?? "Proposition non applicable"}</h3>
          <div className="analysis-telemetry">
            <span>
              Inférence :{" "}
              {preview.telemetry.inferenceDurationMs === null
                ? "indisponible"
                : `${Math.round(preview.telemetry.inferenceDurationMs / 1000)} s`}
            </span>
          </div>
          {preview.operations.map((operation) => {
            const described = describeOperation(operation);
            return (
              <article key={operation.key}>
                <strong>{described.label}</strong>
                <span className="analysis-operation-classification">
                  {described.classification}
                </span>
                <p>{described.text}</p>
                <small>{operation.rationale}</small>
              </article>
            );
          })}
          {preview.status === "ready_for_review" && (
            <div className="analysis-actions">
              <button
                className="primary-button"
                disabled={busy}
                onClick={() => void apply()}
              >
                Appliquer cette proposition
              </button>
              <button
                className="text-button"
                disabled={busy}
                onClick={() => void cancel()}
              >
                Écarter
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
