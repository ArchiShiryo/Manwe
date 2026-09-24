// Harnais d'évaluation multi-étapes (R3). Chaque scénario rejoue, dans une
// base fictive isolée, une suite de captures, d'analyses, d'annotations et de
// réponses. Les analyses sont produites hors du dépôt, dans des conversations
// neuves ; ce script ne note jamais leur justesse.
//
//   node scripts/scenario-run.mjs prepare <fixture.json> <runDir>
//   node scripts/scenario-run.mjs advance <runDir>
//   node scripts/scenario-run.mjs summary <runDir>
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { basename, join, resolve } from "node:path";
import {
  DomainError,
  parseCaptureCommand,
} from "../packages/domain/src/memory.ts";
import { SqliteMemoryStore } from "../packages/storage/src/sqliteStore.ts";

const PROMPT_TEXT = readFileSync(
  new URL("../packages/cognition/prompts/analyst-v3.md", import.meta.url),
  "utf8",
);
const QA_ROOT = resolve(process.cwd(), ".qa");
const PACKET_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;
const PREPARED_SNAPSHOT = "prepared.sqlite3";
const FINAL_SNAPSHOT = "final.sqlite3";
const RAW_PROPOSAL = "proposal.raw.json";
const RETRY_PROPOSAL = "proposal.retry.raw.json";

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const writeJson = (path, value) =>
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
const plain = (value) =>
  value
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .trim();

function safeId(value, label) {
  if (
    typeof value !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(value)
  )
    throw new Error(`${label} doit être un identifiant de fichier sûr.`);
  return value;
}

function normalizeError(error) {
  if (error instanceof DomainError)
    return { code: error.code, message: error.message };
  if (error instanceof SyntaxError)
    return { code: "invalid_json", message: error.message };
  return {
    code: "harness_error",
    message: error instanceof Error ? error.message : String(error),
  };
}

function paths(runDir, scenarioId) {
  const runId = safeId(basename(runDir), "runDir");
  return {
    runId,
    scenarioDir: join(runDir, scenarioId),
    statePath: join(runDir, scenarioId, "state.json"),
    databasePath: join(QA_ROOT, runId, `${scenarioId}.sqlite3`),
    workspaceId: `evaluation-${runId}-${scenarioId}`,
  };
}

function openStore(runDir, scenarioId, state) {
  const { databasePath, workspaceId, scenarioDir } = paths(runDir, scenarioId);
  const fresh = state.nextStepIndex === 0 && !state.pending;
  if (!existsSync(databasePath) && !fresh) {
    const snapshot = state.pending
      ? join(scenarioDir, state.pending, PREPARED_SNAPSHOT)
      : join(scenarioDir, FINAL_SNAPSHOT);
    if (!existsSync(snapshot))
      throw new Error(
        `Base introuvable pour ${scenarioId} et aucune copie préparée disponible.`,
      );
    mkdirSync(join(QA_ROOT, paths(runDir, scenarioId).runId), {
      recursive: true,
    });
    copyFileSync(snapshot, databasePath);
  }
  return new SqliteMemoryStore(databasePath, workspaceId);
}

function subjectMatches(snapshot, hypothesis, subject) {
  return hypothesis.subjects.some((item) =>
    plain(subject) === "moi"
      ? item.kind === "self"
      : item.kind === "person" &&
        plain(
          snapshot.persons.find((person) => person.id === item.personId)
            ?.displayName ?? "",
        ) === plain(subject),
  );
}

/** Rejoue les étapes jusqu'à la prochaine analyse, qu'il prépare. */
function runUntilAnalysis(runDir, scenario, state, store) {
  const { scenarioDir, runId } = paths(runDir, scenario.id);
  while (state.nextStepIndex < scenario.steps.length) {
    const step = scenario.steps[state.nextStepIndex];
    const stepId = safeId(step.id, "step.id");
    if (step.type === "capture") {
      const result = store.capture(parseCaptureCommand(step.command));
      state.captures[stepId] = result.created.find(
        (ref) => ref.kind === "event",
      ).id;
      state.log.push({ step: stepId, type: "capture", outcome: "captured" });
    } else if (step.type === "annotate") {
      const snapshot = store.snapshot();
      const targets = step.target.claimsFromStep
        ? [{ kind: "event", id: state.captures[step.target.claimsFromStep] }]
        : snapshot.hypotheses
            .filter(
              (hypothesis) =>
                hypothesis.status !== "superseded" &&
                subjectMatches(
                  snapshot,
                  hypothesis,
                  step.target.hypotheses.subject,
                ),
            )
            .map((hypothesis) => ({ kind: "hypothesis", id: hypothesis.id }));
      for (const [index, target] of targets.entries())
        store.annotate({
          idempotencyKey: `scenario:${stepId}:${index}`,
          target,
          text: step.text,
          annotationType: step.annotationType,
        });
      state.log.push({
        step: stepId,
        type: "annotate",
        outcome: targets.length ? "annotated" : "no_target",
        targets,
      });
    } else if (step.type === "answer") {
      const open = store
        .snapshot()
        .questions.filter((question) => question.status === "open")
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
      const question = open.at(-1);
      if (question)
        store.answerQuestion({
          idempotencyKey: `scenario:${stepId}`,
          questionId: question.id,
          choice: step.choice,
          text: step.choice === "text" ? step.text : undefined,
        });
      state.log.push({
        step: stepId,
        type: "answer",
        outcome: question ? `answered:${step.choice}` : "no_open_question",
        questionId: question?.id ?? null,
      });
    } else if (step.type === "analyze") {
      const snapshot = store.snapshot();
      const focus = [
        ...snapshot.events.map((event) => ({ kind: "event", id: event.id })),
        ...snapshot.hypotheses
          .filter((hypothesis) => hypothesis.status !== "superseded")
          .map((hypothesis) => ({ kind: "hypothesis", id: hypothesis.id })),
      ].slice(0, 100);
      const packet = store.prepareAnalysis({
        task: step.task,
        mode: "assisted",
        focus,
        expiresAt: new Date(Date.now() + PACKET_LIFETIME_MS).toISOString(),
      });
      const stepDir = join(scenarioDir, stepId);
      mkdirSync(stepDir, { recursive: true });
      writeJson(join(stepDir, "context.json"), packet);
      writeFileSync(
        join(stepDir, "PROMPT.txt"),
        `${PROMPT_TEXT.trimEnd()}\n\n${JSON.stringify(packet, null, 2)}\n`,
        "utf8",
      );
      store.backup(join(stepDir, PREPARED_SNAPSHOT));
      state.pending = stepId;
      state.nextStepIndex += 1;
      state.log.push({
        step: stepId,
        type: "analyze",
        outcome: "awaiting_response",
        requestId: packet.requestId,
      });
      return;
    } else throw new Error(`Type d'étape inconnu : ${step.type}`);
    state.nextStepIndex += 1;
  }
  state.log.push({ step: "end", type: "end", outcome: "completed" });
  store.backup(join(scenarioDir, FINAL_SNAPSHOT));
  void runId;
}

function applyPending(runDir, scenario, state, store) {
  const stepDir = join(paths(runDir, scenario.id).scenarioDir, state.pending);
  const attempts = [];
  for (const file of [RAW_PROPOSAL, RETRY_PROPOSAL]) {
    const path = join(stepDir, file);
    if (!existsSync(path)) continue;
    if (attempts.length && attempts.at(-1).status !== "rejected") break;
    const errors = [];
    let preview = null;
    let result = null;
    try {
      preview = store.receiveAnalysis(JSON.parse(readFileSync(path, "utf8")));
      errors.push(...preview.errors);
      if (preview.status === "ready_for_review")
        result = store.applyAnalysis(preview.responseId);
    } catch (error) {
      errors.push(normalizeError(error));
    }
    attempts.push({
      file,
      status:
        result?.status ??
        preview?.status ??
        (errors.length ? "rejected" : "received"),
      errors,
      createdIds: result?.createdIds ?? [],
      changedIds: result?.changedIds ?? [],
    });
  }
  if (!attempts.length) return false;
  writeJson(join(stepDir, "receipt.json"), {
    step: state.pending,
    status: attempts.at(-1).status,
    attempts,
  });
  const entry = state.log.findLast((item) => item.step === state.pending);
  entry.outcome = attempts.at(-1).status;
  entry.attempts = attempts.length;
  state.pending = null;
  return true;
}

function prepare(fixturePath, runDirArgument) {
  const runDir = resolve(runDirArgument);
  const fixture = readJson(fixturePath);
  mkdirSync(runDir, { recursive: true });
  const { runId } = paths(runDir, "x");
  if (existsSync(join(QA_ROOT, runId)))
    throw new Error(`Le dossier de bases du run existe déjà : .qa/${runId}`);
  for (const scenario of fixture.scenarios) {
    safeId(scenario.id, "scenario.id");
    mkdirSync(paths(runDir, scenario.id).scenarioDir);
    const state = {
      scenarioId: scenario.id,
      nextStepIndex: 0,
      pending: null,
      captures: {},
      log: [],
    };
    mkdirSync(join(QA_ROOT, runId), { recursive: true });
    const store = openStore(runDir, scenario.id, state);
    try {
      runUntilAnalysis(runDir, scenario, state, store);
    } finally {
      store.close();
    }
    writeJson(paths(runDir, scenario.id).statePath, state);
  }
  writeJson(join(runDir, "fixture.json"), fixture);
  console.log(status(runDir));
}

function advance(runDirArgument) {
  const runDir = resolve(runDirArgument);
  const fixture = readJson(join(runDir, "fixture.json"));
  for (const scenario of fixture.scenarios) {
    const statePath = paths(runDir, scenario.id).statePath;
    const state = readJson(statePath);
    if (!state.pending) continue;
    const store = openStore(runDir, scenario.id, state);
    try {
      if (applyPending(runDir, scenario, state, store))
        runUntilAnalysis(runDir, scenario, state, store);
    } finally {
      store.close();
    }
    writeJson(statePath, state);
  }
  console.log(status(runDir));
}

function status(runDir) {
  const fixture = readJson(join(runDir, "fixture.json"));
  return fixture.scenarios
    .map((scenario) => {
      const state = readJson(paths(runDir, scenario.id).statePath);
      return `${scenario.id} : ${state.pending ? `en attente de ${state.pending}/PROMPT.txt` : "terminé"}`;
    })
    .join("\n");
}

function summary(runDirArgument) {
  const runDir = resolve(runDirArgument);
  const fixture = readJson(join(runDir, "fixture.json"));
  const scenarios = [];
  const lines = [
    `# Résumé mécanique — ${basename(runDir)}`,
    "",
    "Ce document décrit l'état final de chaque base fictive. Il ne note pas la justesse des analyses.",
  ];
  for (const scenario of fixture.scenarios) {
    const state = readJson(paths(runDir, scenario.id).statePath);
    const store = openStore(runDir, scenario.id, state);
    let snapshot;
    try {
      snapshot = store.snapshot();
    } finally {
      store.close();
    }
    const person = (id) =>
      snapshot.persons.find((item) => item.id === id)?.displayName ?? id;
    const claimText = (id) =>
      snapshot.claims.find((claim) => claim.id === id)?.text ?? id;
    const hypotheses = snapshot.hypotheses.map((hypothesis) => ({
      statement: hypothesis.statement,
      depth: hypothesis.depth,
      framework: hypothesis.framework,
      construct: hypothesis.construct,
      confidence: hypothesis.confidence,
      status: hypothesis.status,
      needsReview: hypothesis.needsReview,
      reviewReason: hypothesis.reviewReason,
      subjects: hypothesis.subjects.map((subject) =>
        subject.kind === "self" ? "moi" : person(subject.personId),
      ),
      counts: hypothesis.counts,
      alternativeTo: hypothesis.alternativeTo
        ? (snapshot.hypotheses.find(
            (item) => item.id === hypothesis.alternativeTo,
          )?.statement ?? null)
        : null,
      evidence: hypothesis.evidence.map((item) => ({
        stance: item.stance,
        claim: claimText(item.claimId),
      })),
      critiques: hypothesis.critiques.length,
    }));
    const result = {
      scenarioId: scenario.id,
      completed: !state.pending,
      log: state.log,
      claims: snapshot.claims.map((claim) => ({
        text: claim.text,
        category: claim.category,
        modality: claim.modality,
        contested: claim.contestedRevision !== null,
      })),
      events: snapshot.events.filter(
        (event) => event.category !== "unclassified_note",
      ).length,
      hypotheses,
      questions: snapshot.questions.map((question) => ({
        question: question.question,
        status: question.status,
      })),
    };
    scenarios.push(result);
    lines.push("", `## ${scenario.id}`, "");
    lines.push(
      `Étapes : ${state.log.map((item) => `${item.step}=${item.outcome}`).join(" · ")}`,
      "",
    );
    for (const hypothesis of hypotheses)
      lines.push(
        `- **${hypothesis.depth}** ${hypothesis.statement} — ${hypothesis.status}, ${hypothesis.confidence}${hypothesis.needsReview ? `, à réexaminer (${hypothesis.reviewReason})` : ""} ; sujets : ${hypothesis.subjects.join(", ")} ; ${hypothesis.counts.anchoredSupports} pour / ${hypothesis.counts.anchoredContradicts} contre${hypothesis.construct ? ` ; construct : ${hypothesis.construct}` : ""}${hypothesis.alternativeTo ? ` ; alternative de : ${hypothesis.alternativeTo}` : ""}`,
      );
    for (const question of result.questions)
      lines.push(`- ? ${question.question} — ${question.status}`);
    lines.push(
      `- ${result.claims.length} claims (${result.claims
        .map(
          (claim) =>
            `${claim.category}/${claim.modality}${claim.contested ? "/contesté" : ""}`,
        )
        .join(", ")})`,
    );
  }
  writeJson(join(runDir, "results.json"), {
    schemaVersion: "1.0",
    runId: basename(runDir),
    generatedAt: new Date().toISOString(),
    scenarios,
  });
  writeFileSync(join(runDir, "SUMMARY.md"), `${lines.join("\n")}\n`, "utf8");
  console.log(`${scenarios.length} scénarios résumés.`);
}

const [command, first, second] = process.argv.slice(2);
try {
  if (command === "prepare" && first && second) prepare(first, second);
  else if (command === "advance" && first && !second) advance(first);
  else if (command === "summary" && first && !second) summary(first);
  else {
    console.error(
      "Usage : scenario-run.mjs prepare <fixture> <runDir> | advance <runDir> | summary <runDir>",
    );
    process.exitCode = 2;
  }
} catch (error) {
  const normalized = normalizeError(error);
  console.error(`${normalized.code}: ${normalized.message}`);
  process.exitCode = 1;
}
