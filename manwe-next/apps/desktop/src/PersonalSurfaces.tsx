import { useState } from "react";
import {
  ArrowUpRight,
  AlertTriangle,
  BrainCircuit,
  BookOpen,
  Check,
  CircleDotDashed,
  Compass,
  Copy,
  Database,
  FileText,
  FileUp,
  MessageSquarePlus,
  RefreshCw,
  ShieldCheck,
  Users,
} from "lucide-react";
import type {
  AnnotationCommand,
  AnnotationType,
  WorkspaceSnapshot,
} from "../../../packages/domain/src/memory.ts";
import type {
  AnalysisPreview,
  CognitiveProposal,
  ContextPacket,
} from "../../../packages/cognition/src/contract.ts";
import { MemoryApiError, memoryApi } from "./memoryApi.ts";
import {
  claimModalityLabels,
  dateLabel,
  describeOperation,
  informationCategoryLabels,
} from "./ui.tsx";

export function PersonalUnavailable({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <section className="surface-panel personal-empty">
      <span className="personal-emblem warning">
        <Database size={26} />
      </span>
      <div className="eyebrow">SERVICE LOCAL INDISPONIBLE</div>
      <h2>La mémoire reste fermée.</h2>
      <p>{message}</p>
      <button className="primary-button" onClick={onRetry}>
        <RefreshCw size={14} /> Réessayer
      </button>
      <small>
        Le scénario de démonstration reste accessible depuis « Mon espace ».
      </small>
    </section>
  );
}

export function PersonalLoading() {
  return (
    <section className="surface-panel personal-empty">
      <span className="personal-emblem">
        <RefreshCw className="spin" size={26} />
      </span>
      <div className="eyebrow">OUVERTURE DE LA MÉMOIRE</div>
      <h2>Retrouver votre espace…</h2>
      <p>Connexion au service qui conserve vos sources sur ce poste.</p>
    </section>
  );
}

export function PersonalWorld({
  snapshot,
  onMemory,
}: {
  snapshot: WorkspaceSnapshot;
  onMemory: () => void;
}) {
  const lastEvent = snapshot.events[0];
  return (
    <section className="surface-panel personal-world">
      <div className="personal-status-row">
        <span>
          <i /> Mémoire locale disponible
        </span>
        <span>
          Révision {snapshot.workspace.revision.toString().padStart(2, "0")}
        </span>
      </div>
      <div className="personal-world-core">
        <span className="personal-emblem">
          <CircleDotDashed size={31} strokeWidth={1} />
        </span>
        <div className="eyebrow">VOTRE MONDE PERSONNEL</div>
        <h2>
          {snapshot.events.length
            ? "La mémoire commence à prendre forme."
            : "Un espace encore ouvert."}
        </h2>
        <p>
          {snapshot.events.length
            ? `${snapshot.events.length} note${snapshot.events.length > 1 ? "s" : ""} conservée${snapshot.events.length > 1 ? "s" : ""}.${snapshot.persons.length ? ` ${snapshot.persons.length} identité${snapshot.persons.length > 1 ? "s" : ""} issue${snapshot.persons.length > 1 ? "s" : ""} des imports.` : " Aucun nom n’est transformé silencieusement en identité."}`
            : "Racontez un premier événement ci-dessous. Il sera conservé mot pour mot, sans interprétation silencieuse."}
        </p>
        {lastEvent && (
          <button className="personal-latest" onClick={onMemory}>
            <FileText size={15} />
            <span>
              <small>DERNIÈRE NOTE · {dateLabel(lastEvent.createdAt)}</small>
              <strong>{lastEvent.title}</strong>
            </span>
            <ArrowUpRight size={14} />
          </button>
        )}
      </div>
      <div className="personal-world-foot">
        <span>
          <ShieldCheck size={13} /> Sources brutes conservées
        </span>
        <span>
          <CircleDotDashed size={13} /> Analyse Sol :{" "}
          {snapshot.claims.length
            ? `${snapshot.claims.length} proposition${snapshot.claims.length > 1 ? "s" : ""} appliquée${snapshot.claims.length > 1 ? "s" : ""}`
            : "non demandée"}
        </span>
      </div>
    </section>
  );
}

export function PersonalPeople({
  snapshot,
  onReload,
  onNotify,
}: {
  snapshot: WorkspaceSnapshot;
  onReload: () => Promise<void>;
  onNotify: (message: string) => void;
}) {
  const [resolving, setResolving] = useState<string | null>(null);
  const [error, setError] = useState("");
  const resolve = async (ambiguityId: string, personId: string) => {
    setResolving(ambiguityId);
    setError("");
    try {
      await memoryApi.resolveIdentity({
        idempotencyKey: `identity:${crypto.randomUUID()}`,
        ambiguityId,
        personId,
      });
      await onReload();
      onNotify("Identité confirmée · événement relié");
    } catch (cause) {
      setError(
        cause instanceof MemoryApiError
          ? cause.message
          : "L’identité n’a pas pu être confirmée.",
      );
    } finally {
      setResolving(null);
    }
  };
  if (snapshot.persons.length > 0)
    return (
      <section className="surface-panel personal-people">
        <div className="surface-toolbar">
          <span className="memory-counter">
            <Users size={14} /> {snapshot.persons.length} identité
            {snapshot.persons.length === 1 ? "" : "s"}
          </span>
          <span className="muted-text">
            {snapshot.identityAmbiguities.filter(
              (ambiguity) => ambiguity.status === "open",
            ).length || "Aucune"}{" "}
            ambiguïté ouverte
          </span>
        </div>
        {snapshot.identityAmbiguities
          .filter((ambiguity) => ambiguity.status === "open")
          .map((ambiguity) => (
            <article className="identity-ambiguity" key={ambiguity.id}>
              <AlertTriangle size={16} />
              <div>
                <strong>« {ambiguity.mention} » reste ambigu</strong>
                <p>
                  {ambiguity.candidatePersonIds.length} identités candidates ·
                  aucune fusion ni liaison automatique.
                </p>
                <div className="identity-candidates">
                  {ambiguity.candidatePersonIds.map((personId) => {
                    const candidate = snapshot.persons.find(
                      (person) => person.id === personId,
                    );
                    return (
                      <button
                        className="text-button"
                        key={personId}
                        disabled={resolving === ambiguity.id}
                        onClick={() => void resolve(ambiguity.id, personId)}
                      >
                        Choisir {candidate?.displayName ?? personId.slice(0, 8)}{" "}
                        · {personId.slice(0, 8)}
                      </button>
                    );
                  })}
                </div>
              </div>
            </article>
          ))}
        {error && <div className="analysis-error people-error">{error}</div>}
        <div className="people-list">
          {snapshot.persons.map((person) => (
            <article className="person-card" key={person.id}>
              <span className="personal-emblem compact">
                <Users size={18} strokeWidth={1} />
              </span>
              <div>
                <div className="eyebrow">
                  {person.resolutionStatus.replace("_", " ")}
                </div>
                <h2>{person.displayName}</h2>
                <p>
                  Identité locale issue d’un import sourcé. Une clé externe peut
                  la résoudre ; un nom seul reste un candidat.
                </p>
                <small>{person.id}</small>
              </div>
            </article>
          ))}
        </div>
      </section>
    );
  return (
    <section className="surface-panel personal-empty">
      <span className="personal-emblem">
        <Users size={28} strokeWidth={1} />
      </span>
      <div className="eyebrow">PERSONNES</div>
      <h2>Aucune identité extraite.</h2>
      <p>
        Les noms présents dans vos notes restent du texte tant qu’une analyse
        sourcée n’a pas proposé de personnes à confirmer.
      </p>
      <small>
        C’est volontaire : un prénom ne provoque aucune fusion silencieuse.
      </small>
    </section>
  );
}

type MemoryProps = {
  snapshot: WorkspaceSnapshot;
  onAnnotate: (
    target: AnnotationCommand["target"],
    text: string,
    type: AnnotationType,
  ) => Promise<boolean>;
  onReload: () => Promise<void>;
  onNotify: (message: string) => void;
};

export function PersonalMemory({
  snapshot,
  onAnnotate,
  onReload,
  onNotify,
}: MemoryProps) {
  const [target, setTarget] = useState<AnnotationCommand["target"] | null>(
    null,
  );
  const [text, setText] = useState("");
  const [annotationType, setAnnotationType] =
    useState<AnnotationType>("context");
  const close = () => {
    setTarget(null);
    setText("");
  };
  return (
    <section className="surface-panel memory-panel personal-memory">
      <div className="surface-toolbar">
        <span className="memory-counter">
          <Database size={14} /> {snapshot.events.length} note
          {snapshot.events.length === 1 ? "" : "s"}
        </span>
        <span className="muted-text">
          Révision {snapshot.workspace.revision}
        </span>
      </div>
      <PersonalImportPanel onReload={onReload} onNotify={onNotify} />
      {snapshot.events.length === 0 ? (
        <div className="empty-state">
          <BookOpen size={24} />
          <h2>Votre mémoire est vide</h2>
          <p>La première note apparaîtra ici avec sa source exacte.</p>
        </div>
      ) : (
        <div className="personal-event-list">
          {snapshot.events.map((event) => {
            const source = snapshot.sources.find(
              (item) => item.id === event.sourceId,
            );
            const notes = snapshot.annotations.filter(
              (item) =>
                item.target.kind === "event" && item.target.id === event.id,
            );
            return (
              <article className="personal-event" key={event.id}>
                <div className="personal-event-meta">
                  <span>{event.category.replaceAll("_", " ")}</span>
                  <time>
                    {event.occurredStart
                      ? `${event.temporalPrecision === "approximate" ? "Vers " : ""}${dateLabel(event.occurredStart, true)}${event.occurredEnd ? ` → ${dateLabel(event.occurredEnd, true)}` : ""}`
                      : `Raconté le ${dateLabel(source?.narratedAt ?? event.createdAt, true)}`}
                  </time>
                </div>
                <h3>{event.title}</h3>
                {event.context && (
                  <div className="personal-event-context">{event.context}</div>
                )}
                <blockquote>{source?.content ?? event.text}</blockquote>
                <div className="source-integrity">
                  <ShieldCheck size={13} /> Source intacte ·{" "}
                  {source?.contentHash.slice(0, 10)}…
                </div>
                {notes.map((note) => (
                  <div className="personal-annotation" key={note.id}>
                    <MessageSquarePlus size={14} />
                    <span>
                      <small>{note.annotationType.replace("_", " ")}</small>
                      {note.text}
                    </span>
                  </div>
                ))}
                {target?.id === event.id ? (
                  <form
                    className="personal-annotation-form"
                    onSubmit={(formEvent) => {
                      formEvent.preventDefault();
                      if (!text.trim()) return;
                      void onAnnotate(target, text, annotationType).then(
                        (saved) => {
                          if (saved) close();
                        },
                      );
                    }}
                  >
                    <label htmlFor={`annotation-${event.id}`}>
                      Ajouter une précision
                    </label>
                    <select
                      value={annotationType}
                      onChange={(change) =>
                        setAnnotationType(change.target.value as AnnotationType)
                      }
                    >
                      <option value="context">Contexte</option>
                      <option value="factual_correction">
                        Correction factuelle
                      </option>
                      <option value="disagreement">Désaccord</option>
                      <option value="agreement">Accord subjectif</option>
                    </select>
                    <textarea
                      id={`annotation-${event.id}`}
                      value={text}
                      onChange={(change) => setText(change.target.value)}
                      rows={3}
                      maxLength={4000}
                      autoFocus
                    />
                    <div className="form-actions">
                      <button
                        type="button"
                        className="text-button"
                        onClick={close}
                      >
                        Annuler
                      </button>
                      <button
                        className="primary-button"
                        disabled={!text.trim()}
                      >
                        Conserver
                      </button>
                    </div>
                  </form>
                ) : (
                  <button
                    className="text-button"
                    onClick={() => setTarget({ kind: "event", id: event.id })}
                  >
                    <MessageSquarePlus size={13} /> Préciser cette note
                  </button>
                )}
              </article>
            );
          })}
        </div>
      )}
      <PersonalClaimInspector snapshot={snapshot} />
      <AssistedAnalysisPanel
        disabled={snapshot.events.length === 0}
        onReload={onReload}
        onNotify={onNotify}
      />
      <p className="surface-footnote">
        La mémoire personnelle vient du service local. Le texte source n’est
        jamais réécrit par une correction.
      </p>
    </section>
  );
}

function PersonalClaimInspector({ snapshot }: { snapshot: WorkspaceSnapshot }) {
  if (snapshot.claims.length === 0) return null;
  return (
    <section
      className="personal-claim-inspector"
      aria-label="Inspecteur des propositions appliquées"
    >
      <div className="eyebrow">PROPOSITIONS APPLIQUÉES</div>
      <h2>Ce que l'analyse a distingué</h2>
      <div className="personal-claim-list">
        {snapshot.claims.map((claim) => (
          <article className="personal-claim" key={claim.id}>
            <div className="personal-event-meta">
              <span>
                {informationCategoryLabels[claim.category]} ·{" "}
                {claimModalityLabels[claim.modality]}
              </span>
              <time>{dateLabel(claim.createdAt, true)}</time>
            </div>
            <p>{claim.text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function PersonalImportPanel({
  onReload,
  onNotify,
}: {
  onReload: () => Promise<void>;
  onNotify: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<"json" | "csv">("json");
  const [content, setContent] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    importedEvents: number;
    createdPeople: number;
    ambiguities: Array<{ mention: string }>;
    replayed: boolean;
  } | null>(null);

  const importContent = async () => {
    if (!content.trim()) return;
    setBusy(true);
    setError("");
    try {
      const imported = await memoryApi.importData({
        idempotencyKey: `import:${crypto.randomUUID()}`,
        format,
        content,
        sourceName: sourceName.trim() || undefined,
        sourceSystem: "manual-import",
      });
      setResult(imported.result);
      await onReload();
      onNotify(
        imported.result.replayed
          ? "Import déjà connu · aucun doublon créé"
          : `${imported.result.importedEvents} événement${imported.result.importedEvents === 1 ? "" : "s"} importé${imported.result.importedEvents === 1 ? "" : "s"}`,
      );
    } catch (cause) {
      setError(
        cause instanceof MemoryApiError
          ? cause.message
          : "Le fichier n’a pas pu être importé.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="personal-import">
      <div className="personal-import-heading">
        <span>
          <FileUp size={15} /> Importer des événements JSON ou CSV
        </span>
        <button className="text-button" onClick={() => setOpen(!open)}>
          {open ? "Fermer" : "Ouvrir l’import"}
        </button>
      </div>
      {open && (
        <div className="personal-import-body">
          <div className="import-controls">
            <label>
              Format
              <select
                value={format}
                onChange={(event) =>
                  setFormat(event.target.value as "json" | "csv")
                }
              >
                <option value="json">JSON</option>
                <option value="csv">CSV</option>
              </select>
            </label>
            <label>
              Nom de source
              <input
                value={sourceName}
                maxLength={260}
                placeholder="export-conversations.json"
                onChange={(event) => setSourceName(event.target.value)}
              />
            </label>
            <label className="import-file">
              Choisir un fichier
              <input
                type="file"
                accept=".json,.csv,application/json,text/csv"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  setSourceName(file.name);
                  setFormat(
                    file.name.toLowerCase().endsWith(".csv") ? "csv" : "json",
                  );
                  void file
                    .text()
                    .then((value) => setContent(value))
                    .catch(() => setError("Lecture du fichier impossible."));
                }}
              />
            </label>
          </div>
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            rows={7}
            placeholder={
              format === "json"
                ? '[{"text":"Léa dit…","participants":[{"name":"Léa","identityKey":"lea-42"}]}]'
                : "text,occurredStart,context,participants"
            }
            aria-label="Contenu JSON ou CSV à importer"
          />
          <div className="import-actions">
            <small>Maximum 1 Mio et 500 événements · import atomique</small>
            <button
              className="primary-button"
              disabled={!content.trim() || busy}
              onClick={() => void importContent()}
            >
              <FileUp size={14} /> {busy ? "Import…" : "Vérifier et importer"}
            </button>
          </div>
          {error && <div className="analysis-error">{error}</div>}
          {result && (
            <div className="import-result">
              <Check size={14} /> {result.importedEvents} événement(s),{" "}
              {result.createdPeople} identité(s) créée(s)
              {result.ambiguities.length > 0 && (
                <span>
                  <AlertTriangle size={13} /> {result.ambiguities.length} nom(s)
                  ambigu(s) laissés sans liaison
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AssistedAnalysisPanel({
  disabled,
  onReload,
  onNotify,
}: {
  disabled: boolean;
  onReload: () => Promise<void>;
  onNotify: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [packet, setPacket] = useState<ContextPacket | null>(null);
  const [proposalText, setProposalText] = useState("");
  const [preview, setPreview] = useState<AnalysisPreview | null>(null);
  const [error, setError] = useState("");
  const message = (cause: unknown) =>
    cause instanceof MemoryApiError
      ? cause.message
      : cause instanceof Error
        ? cause.message
        : "L’opération d’analyse a échoué.";

  const prepare = async () => {
    setBusy(true);
    setError("");
    try {
      const next = await memoryApi.prepareAnalysis({
        task: "extract",
        mode: "assisted",
      });
      setPacket(next);
      setPreview(null);
      setProposalText("");
      setOpen(true);
      onNotify("Paquet Sol préparé · aucune donnée envoyée automatiquement");
    } catch (cause) {
      setError(message(cause));
    } finally {
      setBusy(false);
    }
  };

  const receive = async () => {
    if (!packet || !proposalText.trim()) return;
    setBusy(true);
    setError("");
    try {
      const parsed = JSON.parse(proposalText) as CognitiveProposal;
      const next = await memoryApi.receiveAnalysis(parsed);
      setPreview(next);
      onNotify(
        next.status === "rejected"
          ? "Proposition rejetée sans modifier la mémoire"
          : next.status === "needs_context"
            ? "Sol demande davantage de contexte"
            : "Proposition validée · confirmation encore requise",
      );
    } catch (cause) {
      setError(
        cause instanceof SyntaxError
          ? "Le JSON collé est invalide."
          : message(cause),
      );
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    if (!packet || !preview) return;
    setBusy(true);
    setError("");
    try {
      const result = await memoryApi.applyAnalysis(
        packet.requestId,
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
      setError(message(cause));
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (!packet) return;
    setBusy(true);
    setError("");
    try {
      await memoryApi.cancelAnalysis(packet.requestId);
      setPacket(null);
      setPreview(null);
      setProposalText("");
      setOpen(false);
      onNotify("Demande d’analyse annulée");
    } catch (cause) {
      setError(message(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="assisted-analysis">
      <div className="assisted-analysis-heading">
        <span className="workspace-option-icon">
          <BrainCircuit size={18} />
        </span>
        <div>
          <div className="eyebrow">ANALYSE ASSISTÉE · SOL</div>
          <h3>Proposer, vérifier, puis seulement appliquer.</h3>
          <p>
            MANWË prépare un JSON sourcé. Rien n’est envoyé automatiquement et
            Sol ne peut jamais écrire directement dans la mémoire.
          </p>
        </div>
        {!open && (
          <button
            className="primary-button"
            disabled={disabled || busy}
            onClick={() => void prepare()}
          >
            Préparer le paquet
          </button>
        )}
      </div>
      {disabled && (
        <small>Conservez d’abord au moins une note personnelle.</small>
      )}
      {error && <div className="analysis-error">{error}</div>}
      {open && packet && (
        <div className="analysis-workflow">
          <div className="analysis-step">
            <span>01</span>
            <div>
              <strong>Copier le ContextPacket</strong>
              <p>
                Révision {packet.baseRevision} · {packet.sources.length} source
                {packet.sources.length === 1 ? "" : "s"} · expire le{" "}
                {dateLabel(packet.expiresAt, true)}
              </p>
              <textarea
                readOnly
                value={JSON.stringify(packet, null, 2)}
                rows={8}
                aria-label="ContextPacket à remettre à Sol"
              />
              <button
                className="text-button"
                onClick={() => {
                  void navigator.clipboard
                    .writeText(JSON.stringify(packet, null, 2))
                    .then(() => onNotify("ContextPacket copié"))
                    .catch(() => setError("La copie presse-papiers a échoué."));
                }}
              >
                <Copy size={13} /> Copier le JSON
              </button>
            </div>
          </div>
          <div className="analysis-step">
            <span>02</span>
            <div>
              <strong>Coller la proposition brute de Sol</strong>
              <p>
                Le validateur vérifiera schéma, révision, sources et citations.
              </p>
              <textarea
                value={proposalText}
                onChange={(event) => setProposalText(event.target.value)}
                rows={8}
                placeholder='{"schemaVersion":"1.1", …}'
                aria-label="Proposition JSON de Sol"
              />
              <button
                className="primary-button"
                disabled={!proposalText.trim() || busy || Boolean(preview)}
                onClick={() => void receive()}
              >
                Vérifier et prévisualiser
              </button>
            </div>
          </div>
          {preview && (
            <div className={`analysis-preview ${preview.status}`}>
              <div className="eyebrow">
                APERÇU · {preview.status.replaceAll("_", " ")}
              </div>
              <h3>{preview.summary ?? "Proposition non applicable"}</h3>
              <div className="analysis-telemetry">
                <span>
                  Attente manuelle :{" "}
                  {preview.telemetry.manualWaitDurationMs === null
                    ? "indisponible"
                    : `${Math.round(preview.telemetry.manualWaitDurationMs / 1000)} s`}
                </span>
                <span>Inférence : indisponible</span>
                <span>Usage / coût : indisponibles</span>
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
              {preview.errors.map((item) => (
                <div className="analysis-error" key={item.code}>
                  {item.code} · {item.message}
                </div>
              ))}
              {preview.status === "ready_for_review" && (
                <button
                  className="primary-button"
                  disabled={busy}
                  onClick={() => void apply()}
                >
                  <Check size={14} /> Confirmer et appliquer la proposition
                  complète
                </button>
              )}
              {(preview.status === "applied" ||
                preview.status === "no_change") && (
                <div className="analysis-applied">
                  <Check size={14} /> Révision{" "}
                  {preview.applicationResult?.resultRevision}
                </div>
              )}
            </div>
          )}
          {!preview && (
            <button
              className="text-button analysis-cancel"
              disabled={busy}
              onClick={() => void cancel()}
            >
              Annuler cette demande
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function PersonalIntentions({
  snapshot,
  onSave,
}: {
  snapshot: WorkspaceSnapshot;
  onSave: (text: string, id?: string) => Promise<boolean>;
}) {
  const current = snapshot.goals[0];
  const [text, setText] = useState(current?.text ?? "");
  return (
    <section className="surface-panel personal-empty personal-goal">
      <span className="personal-emblem">
        <Compass size={28} strokeWidth={1} />
      </span>
      <div className="eyebrow">VOTRE INTENTION</div>
      <h2>{current?.text ?? "Aucune direction formulée."}</h2>
      <p>
        Cette formulation vient de vous. Sol pourra plus tard proposer des
        pistes, mais ne remplacera pas ce cap sans votre confirmation.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!text.trim()) return;
          void onSave(text.trim(), current?.id);
        }}
      >
        <label htmlFor="personal-goal">
          {current ? "Reformuler" : "Formuler une intention"}
        </label>
        <textarea
          id="personal-goal"
          value={text}
          onChange={(event) => setText(event.target.value)}
          maxLength={240}
          rows={3}
          placeholder="Ce que vous souhaitez cultiver…"
        />
        <button
          className="primary-button"
          disabled={!text.trim() || text.trim() === current?.text}
        >
          <Check size={14} /> Conserver
        </button>
      </form>
    </section>
  );
}
