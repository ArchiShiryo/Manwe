// Parcours IA-A.5 dans le code de l'application : notes → analyse automatique
// → application → contexte de l'utilisateur → réanalyse → application →
// redémarrage. Attentes scellées : docs/pilotage/scelles/IA-A5.sha256.
//   node scripts/ia-a5-parcours.mjs packages/evaluation/runs/<date>-ia-a5
// Réponses brutes archivées telles quelles ; aucune intervention entre l'envoi
// et la validation. La clé DeepSeek vient de l'environnement ou du proxy.
import {
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
  existsSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { withEnvProxy } from "./lib/deepseek.mjs";

if (!withEnvProxy()) {
  const { SqliteMemoryStore } = await import(
    "../packages/storage/src/sqliteStore.ts"
  );
  const { AutomaticAnalyses, createDeepSeekCall } = await import(
    "../apps/server/src/analystProvider.ts"
  );
  const { parseCaptureCommand } = await import(
    "../packages/domain/src/memory.ts"
  );
  const { projectGraph } = await import(
    "../packages/cognition/src/projection.ts"
  );
  const { buildSynthesis } = await import(
    "../packages/cognition/src/synthesis.ts"
  );

  const runDir = resolve(process.argv[2] ?? "");
  if (!process.argv[2])
    throw new Error("Usage : node scripts/ia-a5-parcours.mjs <dossier du run>");
  if (existsSync(join(runDir, "log.json")))
    throw new Error(
      `${runDir} contient déjà un parcours : on ne rejoue pas par-dessus.`,
    );
  mkdirSync(runDir, { recursive: true });
  const work = resolve(".qa", "ia-a5.sqlite3");
  mkdirSync(resolve(".qa"), { recursive: true });
  rmSync(work, { force: true });
  const workspaceId = "ia-a5";
  const writeJson = (path, value) =>
    writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  const log = [];
  const note = (entry) => {
    log.push({ at: new Date().toISOString(), ...entry });
    console.log(JSON.stringify(entry));
  };

  let store = new SqliteMemoryStore(work, workspaceId);
  const model = process.env.MANWE_ANALYST_MODEL ?? "deepseek-flash";
  let stepDir = runDir;
  const automatic = new AutomaticAnalyses(
    store,
    {
      id: `deepseek:${model}`,
      model,
      dailyTokenBudget: 2_000_000,
      call: createDeepSeekCall({
        endpoint: process.env.DEEPSEEK_BASE_URL,
        apiKey: process.env.DEEPSEEK_API_KEY,
        model,
      }),
    },
    ({ attempt, prompt, call }) => {
      writeFileSync(join(stepDir, `PROMPT-${attempt}.txt`), prompt, "utf8");
      writeFileSync(
        join(stepDir, `proposal-${attempt}.raw.json`),
        call.content,
        "utf8",
      );
      writeJson(join(stepDir, `call-${attempt}.json`), call.meta);
      if (call.reasoning)
        writeFileSync(
          join(stepDir, `reasoning-${attempt}.txt`),
          call.reasoning,
          "utf8",
        );
    },
  );

  const fixture = JSON.parse(
    readFileSync("packages/evaluation/fixtures/r4-blind-s02.json", "utf8"),
  );
  const scenario = fixture.scenarios.find((item) => item.id === "Q01");
  for (const step of scenario.steps.filter((item) => item.type === "capture")) {
    store.capture(
      parseCaptureCommand({
        ...step.command,
        idempotencyKey: `ia-a5:${step.id}`,
      }),
    );
    note({ step: step.id, type: "capture" });
  }

  const hypothesesView = () =>
    store.snapshot().hypotheses.map((item) => ({
      id: item.id,
      statement: item.statement,
      depth: item.depth,
      status: item.status,
      confidence: item.confidence,
      rank: item.rank,
      needsReview: item.needsReview,
      subjects: item.subjects.map((subject) => subject.kind),
    }));
  const fullFocus = () => {
    const snapshot = store.snapshot();
    return [
      ...snapshot.events.map((event) => ({ kind: "event", id: event.id })),
      ...snapshot.hypotheses
        .filter((item) => item.status !== "superseded")
        .map((item) => ({ kind: "hypothesis", id: item.id })),
    ].slice(0, 100);
  };

  const analyse = async (name, task) => {
    stepDir = join(runDir, name);
    mkdirSync(stepDir, { recursive: true });
    const job = automatic.start({ task, focus: fullFocus() });
    const done = await automatic.settle(job.requestId, 11 * 60 * 1000);
    const summary = {
      step: name,
      type: "analyze",
      task,
      status: done.status,
      attempts: done.attempts.map((item) => ({
        status: item.status,
        errors: item.errors,
        latencyMs: item.latencyMs,
        servedModel: item.servedModel,
        usage: item.usage,
      })),
      error: done.error,
    };
    if (done.status === "ready_for_review") {
      // Confirmation explicite, simulée par le script (aucune retouche).
      const result = store.applyAnalysis(done.preview.responseId);
      summary.applied = {
        status: result.status,
        revision: result.resultRevision,
        warnings: result.warnings,
      };
    }
    writeJson(join(stepDir, "receipt.json"), summary);
    note(summary);
    return summary;
  };

  const first = await analyse("A1-interpret", "interpret");
  const afterFirst = hypothesesView();
  writeJson(join(runDir, "hypotheses-A1.json"), afterFirst);

  // Contexte ajouté sur la lecture de rang 1 portant sur la relation.
  const target =
    afterFirst.find(
      (item) => item.subjects.includes("relation") && item.rank === 1,
    ) ?? afterFirst.find((item) => item.subjects.includes("relation"));
  const contextText =
    "Précision : l'an dernier, Chloé m'a aidé trois jours à déménager et m'a souvent dépanné. Depuis janvier, elle traverse un divorce difficile.";
  let annotation = null;
  if (target) {
    store.annotate({
      idempotencyKey: "ia-a5:context",
      target: { kind: "hypothesis", id: target.id },
      text: contextText,
      annotationType: "context",
    });
    const snapshot = store.snapshot();
    annotation = snapshot.annotations.find((item) => item.text === contextText);
    note({
      step: "C1-context",
      type: "annotate",
      target: target.id,
      sourceId: annotation?.sourceId ?? null,
      needsReview: snapshot.hypotheses.find((item) => item.id === target.id)
        ?.needsReview,
    });
  } else
    note({
      step: "C1-context",
      type: "annotate",
      error: "aucune lecture de relation",
    });

  const second = await analyse("A2-revise", "revise");
  const afterSecond = hypothesesView();
  writeJson(join(runDir, "hypotheses-A2.json"), afterSecond);
  const citingContext = annotation?.sourceId
    ? store
        .snapshot()
        .claims.filter((claim) =>
          claim.citations.some(
            (citation) => citation.sourceId === annotation.sourceId,
          ),
        )
        .map((claim) => claim.text)
    : [];

  // Redémarrage : fermeture puis réouverture de la même base.
  const before = store.snapshot();
  store.close();
  store = new SqliteMemoryStore(work, workspaceId);
  const after = store.snapshot();
  const same =
    before.workspace.revision === after.workspace.revision &&
    JSON.stringify(
      before.hypotheses.map((h) => [h.id, h.status, h.confidence, h.rank]),
    ) ===
      JSON.stringify(
        after.hypotheses.map((h) => [h.id, h.status, h.confidence, h.rank]),
      );
  const relation = after.relations[0];
  const projection = relation
    ? projectGraph(after, { kind: "relation", id: relation.id })
    : projectGraph(after, { kind: "self", id: "self" });
  const synthesis = buildSynthesis(after, projection);
  const usage = store.database
    .prepare(
      "SELECT id, verified_model, provider_usage_json, inference_duration_ms FROM analysis_responses WHERE workspace_id = ?",
    )
    .all(workspaceId);
  note({
    step: "R1-restart",
    type: "restart",
    revision: after.workspace.revision,
    identical: same,
    graphNodes: projection.nodes.length,
    synthesisRevision: synthesis.revision,
    responsesWithUsage: usage.filter((row) => row.provider_usage_json).length,
    responses: usage.length,
  });
  store.backup(join(runDir, "final.sqlite3"));
  store.close();
  writeJson(join(runDir, "log.json"), {
    model,
    prompt: "analyst-v7",
    contract: "1.4",
    first: first.status,
    second: second.status,
    target: target?.id ?? null,
    citingContext,
    log,
  });
  console.log(`Parcours terminé : ${runDir}`);
}
