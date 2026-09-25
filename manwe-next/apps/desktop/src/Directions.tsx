// Directions et boucle d'action (BRIEF-005, D-016, D-017). MANWË propose au
// plus deux directions d'action et l'option de ne rien entreprendre ; chacune
// nomme son levier et prédit la réponse des acteurs. L'utilisateur choisit,
// agit lui-même, puis consigne le résultat : la prédiction, figée avant
// l'essai, est comparée à la réalité à la réanalyse.
import { useEffect, useState } from "react";
import {
  currentGoal,
  type ActionRecord,
  type DirectionRecord,
  type WorkspaceSnapshot,
} from "../../../packages/domain/src/memory.ts";
import type { AnalysisPreview } from "../../../packages/cognition/src/contract.ts";
import { memoryApi, type AutomaticJob } from "./memoryApi.ts";
import {
  dateLabel,
  describeOperation,
  effortLabels,
  leverLabels,
  phaseLabels,
} from "./ui.tsx";

const MECHANISM_LABELS: Record<string, string> = {
  optimizes: "ce qui est optimisé",
  protects: "ce qui est protégé",
  defenses: "les défenses",
  beliefs: "les croyances",
  triggers: "les déclencheurs",
  soothes: "ce qui apaise",
  barrier: "la barrière",
  prediction: "la prédiction",
};

const VERDICT_LABELS = {
  confirmed: "confirmée",
  refuted: "démentie",
  unclear: "incertaine",
} as const;
type Verdict = keyof typeof VERDICT_LABELS | null;

function actorName(
  snapshot: WorkspaceSnapshot,
  actor: DirectionRecord["predictions"][number]["actor"],
) {
  if (actor.kind === "self") return "Vous";
  return (
    snapshot.persons.find((person) => person.id === actor.personId)
      ?.displayName ?? "une personne"
  );
}

function Predictions({
  snapshot,
  predictions,
}: {
  snapshot: WorkspaceSnapshot;
  predictions: DirectionRecord["predictions"];
}) {
  return (
    <ul className="direction-predictions">
      {predictions.map((prediction, index) => (
        <li key={index}>
          <span className={`phase phase-${prediction.phase}`}>
            {phaseLabels[prediction.phase]}
            {prediction.horizonDays ? ` · ${prediction.horizonDays} j` : ""}
          </span>{" "}
          <strong>{actorName(snapshot, prediction.actor)}</strong> :{" "}
          {prediction.response}
        </li>
      ))}
    </ul>
  );
}

/** Suit une analyse automatique jusqu'à l'aperçu, puis attend la confirmation. */
function useAutomaticJob(onDone: () => Promise<void>) {
  const [job, setJob] = useState<AutomaticJob | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!job || job.status !== "running") return;
    const timer = window.setInterval(() => {
      memoryApi
        .automaticJob(job.requestId)
        .then(setJob)
        .catch((cause: unknown) =>
          setError(
            cause instanceof Error ? cause.message : "Suivi impossible.",
          ),
        );
    }, 1500);
    return () => window.clearInterval(timer);
  }, [job]);
  const start = async (
    task: "explore" | "revise",
    focus: { kind: string; id: string }[],
  ) => {
    setError("");
    try {
      setJob(await memoryApi.startAutomatic(task, focus));
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Démarrage impossible.",
      );
    }
  };
  const apply = async (preview: AnalysisPreview) => {
    if (!job) return;
    try {
      await memoryApi.applyAnalysis(job.requestId, preview.responseId);
      setJob(null);
      await onDone();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Application impossible.",
      );
    }
  };
  const discard = async () => {
    if (!job) return;
    try {
      await memoryApi.cancelAnalysis(job.requestId);
    } finally {
      setJob(null);
    }
  };
  return { job, error, start, apply, discard };
}

function JobPanel({
  job,
  error,
  onApply,
  onDiscard,
}: {
  job: AutomaticJob | null;
  error: string;
  onApply: (preview: AnalysisPreview) => void;
  onDiscard: () => void;
}) {
  if (error) return <div className="analysis-error">{error}</div>;
  if (!job) return null;
  if (job.status === "running")
    return (
      <p className="automatic-running" role="status">
        Analyse automatique en cours · tentative {job.attempts.length + 1} sur 2
        au plus
      </p>
    );
  if (job.status === "failed" || job.status === "cancelled")
    return (
      <div className="analysis-error" role="alert">
        {job.error?.message ?? "Analyse interrompue."}
      </div>
    );
  const preview = job.preview;
  if (!preview) return null;
  return (
    <div className={`analysis-preview ${preview.status}`}>
      <div className="eyebrow">PROPOSITION À EXAMINER</div>
      <h3>{preview.summary ?? "Proposition"}</h3>
      {preview.operations.map((operation) => {
        const described = describeOperation(operation);
        return (
          <article key={operation.key}>
            <strong>{described.label}</strong>
            <span className="analysis-operation-classification">
              {described.classification}
            </span>
            <p>{described.text}</p>
          </article>
        );
      })}
      {preview.status === "ready_for_review" && (
        <div className="analysis-actions">
          <button className="primary-button" onClick={() => onApply(preview)}>
            Appliquer
          </button>
          <button className="text-button" onClick={onDiscard}>
            Écarter
          </button>
        </div>
      )}
    </div>
  );
}

export function Directions({
  snapshot,
  onReload,
  onNotify,
}: {
  snapshot: WorkspaceSnapshot;
  onReload: () => Promise<void>;
  onNotify: (message: string) => void;
}) {
  const goal = currentGoal(snapshot.goals);
  const [automatic, setAutomatic] = useState(false);
  const [expectation, setExpectation] = useState<Record<string, string>>({});
  const [outcome, setOutcome] = useState<Record<string, string>>({});
  const [verdicts, setVerdicts] = useState<Record<string, Verdict[]>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const job = useAutomaticJob(async () => {
    await onReload();
    onNotify("Proposition appliquée");
  });
  useEffect(() => {
    memoryApi
      .automaticProvider()
      .then((provider) => setAutomatic(provider.enabled))
      .catch(() => setAutomatic(false));
  }, []);
  if (!goal) return null;

  const directions = snapshot.directions.filter(
    (item) =>
      item.goalId === goal.id &&
      (item.status === "proposed" || item.status === "chosen"),
  );
  const actionOf = (direction: DirectionRecord) =>
    snapshot.actions.find((item) => item.directionId === direction.id);
  const reading = (id: string | null) =>
    snapshot.hypotheses.find((item) => item.id === id);
  const context = () =>
    [
      { kind: "goal", id: goal.id },
      ...snapshot.hypotheses
        .filter((item) => item.status !== "superseded")
        .map((item) => ({ kind: "hypothesis", id: item.id })),
      ...snapshot.events.map((event) => ({ kind: "event", id: event.id })),
    ].slice(0, 100);

  const run = async (operation: () => Promise<unknown>, done: string) => {
    setBusy(true);
    setError("");
    try {
      await operation();
      await onReload();
      onNotify(done);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Opération impossible.",
      );
    } finally {
      setBusy(false);
    }
  };

  const choose = (direction: DirectionRecord) =>
    run(
      () =>
        memoryApi.chooseDirection({
          idempotencyKey: `choose:${crypto.randomUUID()}`,
          directionId: direction.id,
          userExpectation: expectation[direction.id]?.trim() || null,
        }),
      "Direction choisie · votre attente est enregistrée avant l’essai",
    );

  const record = (action: ActionRecord) => {
    const list = verdicts[action.id];
    return run(
      () =>
        memoryApi.recordOutcome({
          idempotencyKey: `outcome:${crypto.randomUUID()}`,
          actionId: action.id,
          text: outcome[action.id].trim(),
          verdicts: list?.some((item) => item !== null) ? list : null,
        }),
      "Résultat conservé · la lecture concernée est à réexaminer",
    );
  };

  const hasDoNothing = directions.some(
    (item) => item.lever.kind === "do_nothing",
  );
  return (
    <section
      className="directions"
      aria-label="Directions pour votre intention"
    >
      <div className="directions-heading">
        <div>
          <div className="eyebrow">DIRECTIONS</div>
          <h3>Deux pistes au plus, et l’option de ne rien faire.</h3>
          <p>
            Chaque piste dit quel levier elle actionne et ce qu’elle prédit, y
            compris la phase difficile. MANWË n’agit jamais à votre place.
          </p>
        </div>
        {automatic ? (
          <button
            className="primary-button"
            disabled={busy || job.job?.status === "running"}
            onClick={() => void job.start("explore", context())}
          >
            {directions.length
              ? "Proposer à nouveau"
              : "Explorer des directions"}
          </button>
        ) : (
          <small>
            Analyse automatique désactivée : utilisez l’analyse assistée (tâche
            « explore ») depuis la page Mémoire.
          </small>
        )}
      </div>
      <JobPanel
        job={job.job}
        error={job.error}
        onApply={(preview) => void job.apply(preview)}
        onDiscard={() => void job.discard()}
      />
      {error && <div className="analysis-error">{error}</div>}
      <div className="direction-list">
        {directions.map((direction) => {
          const lever = reading(direction.lever.hypothesisId);
          const action = actionOf(direction);
          return (
            <article
              key={direction.id}
              className={`direction-card lever-${direction.lever.kind} status-${direction.status}`}
            >
              <div className="personal-event-meta">
                <span>
                  {leverLabels[direction.lever.kind]} · effort{" "}
                  {effortLabels[direction.effort]}
                </span>
                {direction.status === "chosen" && <span>choisie</span>}
              </div>
              <h4>{direction.title}</h4>
              <p>{direction.action}</p>
              {lever && (
                <p className="direction-lever">
                  Actionne la lecture {lever.depth} : « {lever.statement} »
                  {direction.lever.mechanismKey
                    ? ` — levier sur ${MECHANISM_LABELS[direction.lever.mechanismKey] ?? direction.lever.mechanismKey}`
                    : ""}
                </p>
              )}
              <Predictions
                snapshot={snapshot}
                predictions={direction.predictions}
              />
              <details>
                <summary>Conditions, limites, signaux</summary>
                <p>
                  <strong>Quand :</strong> {direction.conditions}
                </p>
                <p>
                  <strong>Limites :</strong> {direction.limits}
                </p>
                <p>
                  <strong>À observer :</strong> {direction.signals.join(" · ")}
                </p>
                <p>
                  <strong>Si cela échoue :</strong> {direction.learnsIfFails}
                </p>
              </details>
              {direction.status === "proposed" &&
                direction.lever.kind !== "do_nothing" && (
                  <div className="direction-choose">
                    <label>
                      <span>Votre propre attente (facultatif)</span>
                      <textarea
                        rows={2}
                        value={expectation[direction.id] ?? ""}
                        onChange={(event) =>
                          setExpectation({
                            ...expectation,
                            [direction.id]: event.target.value,
                          })
                        }
                      />
                    </label>
                    <button
                      className="primary-button"
                      disabled={busy}
                      onClick={() => void choose(direction)}
                    >
                      Choisir cette direction
                    </button>
                  </div>
                )}
              {action && (
                <div className="direction-action">
                  <div className="eyebrow">
                    ATTENTE FIGÉE LE{" "}
                    {dateLabel(
                      action.expectationRecordedAt,
                      true,
                    ).toUpperCase()}
                  </div>
                  {action.expectation.userExpectation && (
                    <p>Votre attente : {action.expectation.userExpectation}</p>
                  )}
                  {action.outcome ? (
                    <>
                      <p>
                        <strong>Résultat :</strong> {action.outcome.text}
                      </p>
                      {action.verdicts && (
                        <ul className="direction-verdicts">
                          {action.expectation.predictions.map(
                            (prediction, index) => (
                              <li key={index}>
                                {prediction.response} —{" "}
                                {action.verdicts?.[index]
                                  ? VERDICT_LABELS[
                                      action.verdicts[
                                        index
                                      ] as keyof typeof VERDICT_LABELS
                                    ]
                                  : "non évaluée"}
                              </li>
                            ),
                          )}
                        </ul>
                      )}
                      {automatic && lever && (
                        <button
                          className="text-button"
                          disabled={busy || job.job?.status === "running"}
                          onClick={() =>
                            void job.start("revise", [
                              { kind: "hypothesis", id: lever.id },
                              ...context(),
                            ])
                          }
                        >
                          Comparer à la prédiction (réanalyse)
                        </button>
                      )}
                    </>
                  ) : (
                    <div className="direction-outcome">
                      <label>
                        <span>Ce qui s’est passé</span>
                        <textarea
                          rows={3}
                          value={outcome[action.id] ?? ""}
                          onChange={(event) =>
                            setOutcome({
                              ...outcome,
                              [action.id]: event.target.value,
                            })
                          }
                        />
                      </label>
                      {action.expectation.predictions.map(
                        (prediction, index) => (
                          <label key={index} className="direction-verdict">
                            <span>{prediction.response}</span>
                            <select
                              value={verdicts[action.id]?.[index] ?? ""}
                              onChange={(event) => {
                                const list = [
                                  ...(verdicts[action.id] ??
                                    action.expectation.predictions.map(
                                      () => null,
                                    )),
                                ];
                                list[index] = (event.target.value ||
                                  null) as Verdict;
                                setVerdicts({ ...verdicts, [action.id]: list });
                              }}
                            >
                              <option value="">— sans avis</option>
                              <option value="confirmed">confirmée</option>
                              <option value="refuted">démentie</option>
                              <option value="unclear">incertaine</option>
                            </select>
                          </label>
                        ),
                      )}
                      <button
                        className="primary-button"
                        disabled={busy || !outcome[action.id]?.trim()}
                        onClick={() => void record(action)}
                      >
                        Consigner le résultat
                      </button>
                    </div>
                  )}
                </div>
              )}
            </article>
          );
        })}
        {directions.length > 0 && !hasDoNothing && (
          <article className="direction-card lever-do_nothing">
            <div className="personal-event-meta">
              <span>ne rien entreprendre</span>
            </div>
            <h4>Ne rien changer pour l’instant</h4>
            <p>
              Toujours possible. Aucune prédiction n’a été formulée pour cette
              option.
            </p>
          </article>
        )}
      </div>
    </section>
  );
}
