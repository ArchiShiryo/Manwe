// Harnais d'évaluation multi-étapes (R3). Chaque scénario rejoue, dans une
// base fictive isolée, une suite de captures, d'analyses, d'annotations et de
// réponses. Les analyses sont produites hors du dépôt, dans des conversations
// neuves ; ce script ne note jamais leur justesse.
//
//   node scripts/scenario-run.mjs prepare <fixture.json> <runDir>
//   node scripts/scenario-run.mjs advance <runDir>
//   node scripts/scenario-run.mjs summary <runDir>
//   node scripts/scenario-run.mjs rewind <runDir> <stepId>
//   node scripts/scenario-run.mjs auto <runDir> [--model m] [--effort e] [--concurrency n]
//
// « auto » remplace les allers-retours manuels : chaque analyse en attente est
// envoyée à l'API DeepSeek (prompt complet, un seul message, sans mémoire), la
// réponse brute est enregistrée telle quelle, puis le scénario avance. Les
// scénarios tournent en parallèle ; les étapes d'un scénario restent en ordre.
// Chaque appel laisse call.json (modèle servi, usage, durée) et reasoning.txt.
//
// Une analyse rejetée reste en attente de la seconde tentative autorisée
// (proposal.retry.raw.json) ; le reçu regroupe les deux essais. « rewind »
// ramène à une analyse que l'ancien harnais avait close sur un rejet ; les
// étapes ultérieures, jamais répondues, sont supprimées puis régénérées.
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { basename, join, resolve } from "node:path";
import {
  DomainError,
  parseCaptureCommand,
} from "../packages/domain/src/memory.ts";
import { SqliteMemoryStore } from "../packages/storage/src/sqliteStore.ts";
import {
  DEFAULT_EFFORT,
  DEFAULT_MODEL,
  withEnvProxy,
} from "./lib/deepseek.mjs";
import { createDeepSeekCall } from "../apps/server/src/analystProvider.ts";
import { MEMORY_TOOLS } from "../packages/cognition/src/memoryTools.ts";

const PROMPT_TEXT = readFileSync(
  new URL("../packages/cognition/prompts/analyst-v11.md", import.meta.url),
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

// L'interface de ChatGPT insère parfois « :chatgpt-content-reference{index="0"} »
// dans le texte copié ; ses guillemets non échappés rendent le JSON invalide.
// On retire ce seul marqueur, connu, avant lecture ; le fichier brut reste intact
// et le reçu signale la normalisation.
const INTERFACE_ARTIFACT = /\s*:chatgpt-content-reference\{index="\d+"\}/g;
const stripInterfaceArtifacts = (text) => text.replace(INTERFACE_ARTIFACT, "");

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

function memberMatches(snapshot, item, subject) {
  return plain(subject) === "moi"
    ? item.kind === "self"
    : item.kind === "person" &&
        plain(
          snapshot.persons.find((person) => person.id === item.personId)
            ?.displayName ?? "",
        ) === plain(subject);
}

/** Une hypothèse vise le sujet directement, ou via une relation dont il est membre. */
function subjectMatches(snapshot, hypothesis, subject) {
  return hypothesis.subjects.some((item) =>
    item.kind === "relation"
      ? item.members.some((member) => memberMatches(snapshot, member, subject))
      : memberMatches(snapshot, item, subject),
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
    } else if (step.type === "goal") {
      // BRIEF-005 : objectif de l'utilisateur, formulé par le corpus.
      const result = store.updateGoal({
        idempotencyKey: `scenario:${stepId}`,
        text: step.text,
      });
      state.goalId = result.created[0]?.id ?? state.goalId ?? null;
      state.log.push({ step: stepId, type: "goal", outcome: "set" });
    } else if (step.type === "adopt") {
      // R5.4 : l'utilisateur adopte l'objectif proposé par l'analyse ; sans
      // proposition, un objectif de secours est posé (le point R5.4 est perdu).
      const pending = store
        .snapshot()
        .goals.find(
          (goal) =>
            goal.origin === "analysis" &&
            !goal.confirmedByUser &&
            !goal.dismissed,
        );
      if (pending) {
        store.updateGoal({
          idempotencyKey: `scenario:${stepId}`,
          goalId: pending.id,
          text: pending.text,
        });
        state.goalId = pending.id;
      } else {
        const result = store.updateGoal({
          idempotencyKey: `scenario:${stepId}`,
          text: step.fallbackText,
        });
        state.goalId = result.created[0]?.id ?? null;
      }
      state.log.push({
        step: stepId,
        type: "adopt",
        outcome: pending ? "adopted" : "fallback",
        goal: pending?.text ?? step.fallbackText,
      });
    } else if (step.type === "choose") {
      // Règle fixe, écrite avant tout run : la première direction d'action
      // proposée pour l'objectif (ordre de création), jamais « ne rien
      // faire ». Le résultat enregistré ensuite est celui de son levier
      // (step.outcomes de l'étape outcome, RAPPORT-013).
      const direction = store
        .snapshot()
        .directions.find(
          (item) =>
            item.status === "proposed" &&
            item.lever.kind !== "do_nothing" &&
            item.goalId === (state.goalId ?? null),
        );
      state.leverKind = direction?.lever.kind ?? null;
      if (direction) {
        const result = store.chooseDirection({
          idempotencyKey: `scenario:${stepId}`,
          directionId: direction.id,
          userExpectation: step.userExpectation ?? null,
        });
        state.actionId = result.created[0].id;
      }
      state.log.push({
        step: stepId,
        type: "choose",
        outcome: direction ? "chosen" : "no_direction",
        directionId: direction?.id ?? null,
        title: direction?.title ?? null,
        leverKind: direction?.lever.kind ?? null,
      });
    } else if (step.type === "outcome") {
      // Un résultat par levier quand la fixture en fournit ; sinon le texte unique.
      const text =
        (state.leverKind && step.outcomes?.[state.leverKind]) ?? step.text;
      if (state.actionId && text)
        store.recordOutcome({
          idempotencyKey: `scenario:${stepId}`,
          actionId: state.actionId,
          text,
          verdicts: null,
        });
      state.log.push({
        step: stepId,
        type: "outcome",
        outcome: state.actionId && text ? "recorded" : "no_action",
        leverKind: state.leverKind ?? null,
        text: text ?? null,
      });
    } else if (step.type === "analyze") {
      const snapshot = store.snapshot();
      const focus = [
        ...snapshot.goals
          .filter((goal) => !goal.dismissed)
          .map((goal) => ({ kind: "goal", id: goal.id })),
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
      // Réduction de la mémoire de travail, mesurée sur le même état.
      if (store.lastPacketSizes)
        writeJson(join(stepDir, "packet-sizes.json"), {
          ...store.lastPacketSizes,
          reduction:
            1 - store.lastPacketSizes.working / store.lastPacketSizes.full,
        });
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
    const normalized = [];
    let preview = null;
    let result = null;
    try {
      const text = readFileSync(path, "utf8");
      const cleaned = stripInterfaceArtifacts(text);
      if (cleaned !== text) normalized.push("chatgpt-content-reference");
      preview = store.receiveAnalysis(JSON.parse(cleaned));
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
      ...(normalized.length ? { normalized } : {}),
      warnings: result?.warnings ?? [],
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
  // Un premier rejet laisse l'analyse en attente de la seconde tentative.
  if (attempts.length === 1 && attempts[0].status === "rejected") return false;
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

function advanceScenario(runDir, scenario) {
  const statePath = paths(runDir, scenario.id).statePath;
  const state = readJson(statePath);
  if (!state.pending) return state;
  const store = openStore(runDir, scenario.id, state);
  try {
    if (applyPending(runDir, scenario, state, store))
      runUntilAnalysis(runDir, scenario, state, store);
  } finally {
    store.close();
  }
  writeJson(statePath, state);
  return state;
}

function advance(runDirArgument) {
  const runDir = resolve(runDirArgument);
  const fixture = readJson(join(runDir, "fixture.json"));
  for (const scenario of fixture.scenarios) advanceScenario(runDir, scenario);
  console.log(status(runDir));
}

/** Fichier attendu pour l'étape en attente, ou null si rien n'est à demander. */
function nextAttemptFile(stepDir) {
  if (!existsSync(join(stepDir, RAW_PROPOSAL))) return RAW_PROPOSAL;
  if (existsSync(join(stepDir, RETRY_PROPOSAL))) return null;
  const receipt = join(stepDir, "receipt.json");
  if (existsSync(receipt) && readJson(receipt).status === "rejected")
    return RETRY_PROPOSAL;
  return null;
}

async function driveScenario(runDir, scenario, options, log) {
  for (;;) {
    const state = readJson(paths(runDir, scenario.id).statePath);
    if (!state.pending) return;
    const stepDir = join(paths(runDir, scenario.id).scenarioDir, state.pending);
    const file = nextAttemptFile(stepDir);
    if (!file) {
      const after = advanceScenario(runDir, scenario);
      if (after.pending === state.pending) return; // rien ne bouge : on s'arrête
      continue;
    }
    const suffix = file === RETRY_PROPOSAL ? ".retry" : "";
    log(
      `${state.pending} : appel ${options.model}${suffix ? " (seconde tentative)" : ""}`,
    );
    // D-021 : la seconde tentative connaît le motif exact du premier rejet.
    let prompt = readFileSync(join(stepDir, "PROMPT.txt"), "utf8");
    if (file === RETRY_PROPOSAL) {
      const errors = readJson(join(stepDir, "receipt.json"))
        .attempts.flatMap((attempt) => attempt.errors)
        .map((error) => `- ${error.code} : ${error.message}`)
        .join("\n");
      prompt = `${prompt.trimEnd()}\n\nTa réponse précédente à ce paquet a été rejetée par le validateur :\n${errors}\nRenvoie un objet CognitiveProposal complet et corrigé, qui respecte exactement le format.\n`;
      writeFileSync(join(stepDir, "PROMPT.retry.txt"), prompt, "utf8");
    }
    // D-023 : même client que l'application ; le modèle interroge librement
    // la mémoire du scénario, en lecture seule, pendant l'analyse.
    const requestId = readJson(join(stepDir, "context.json")).requestId;
    const toolStore = openStore(runDir, scenario.id, state);
    let call;
    try {
      call = await createDeepSeekCall({
        endpoint: process.env.DEEPSEEK_BASE_URL,
        apiKey: process.env.DEEPSEEK_API_KEY,
        model: options.model,
        effort: options.effort,
      })({
        prompt,
        signal: new AbortController().signal,
        tools: MEMORY_TOOLS,
        executeTool: (name, args) =>
          toolStore.queryMemory(requestId, name, args),
      });
    } finally {
      toolStore.close();
    }
    call.meta = {
      provider: "deepseek",
      requestedModel: options.model,
      effort: options.effort,
      ...call.meta,
    };
    if (call.meta.queries?.length)
      writeJson(join(stepDir, `queries${suffix}.json`), call.meta.queries);
    writeFileSync(join(stepDir, file), call.content, "utf8");
    writeJson(join(stepDir, `call${suffix}.json`), call.meta);
    if (call.reasoning)
      writeFileSync(
        join(stepDir, `reasoning${suffix}.txt`),
        call.reasoning,
        "utf8",
      );
    const after = advanceScenario(runDir, scenario);
    const receipt = readJson(join(stepDir, "receipt.json"));
    log(
      `${state.pending} : ${receipt.status} (${Math.round(call.meta.latencyMs / 1000)} s)`,
    );
    void after;
  }
}

async function auto(runDirArgument, flags) {
  const runDir = resolve(runDirArgument);
  const fixture = readJson(join(runDir, "fixture.json"));
  const options = {
    model: flags.model ?? DEFAULT_MODEL,
    effort: flags.effort ?? DEFAULT_EFFORT,
    concurrency: Number(flags.concurrency ?? 10),
  };
  const queue = [...fixture.scenarios];
  const log = (line) =>
    console.log(`[${new Date().toISOString().slice(11, 19)}] ${line}`);
  const failures = [];
  const worker = async () => {
    for (let scenario = queue.shift(); scenario; scenario = queue.shift()) {
      try {
        await driveScenario(runDir, scenario, options, log);
      } catch (error) {
        failures.push(scenario.id);
        log(`${scenario.id} : arrêt (${error.message})`);
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.max(1, options.concurrency) }, worker),
  );
  console.log(status(runDir));
  if (failures.length) process.exitCode = 1;
}

function parseFlags(list) {
  const flags = {};
  for (let index = 0; index < list.length; index += 2) {
    const key = list[index];
    if (!key?.startsWith("--") || list[index + 1] === undefined)
      throw new Error(`Option invalide : ${key}`);
    flags[key.slice(2)] = list[index + 1];
  }
  return flags;
}

function rewind(runDirArgument, stepId) {
  const runDir = resolve(runDirArgument);
  const fixture = readJson(join(runDir, "fixture.json"));
  const scenario = fixture.scenarios.find((item) =>
    item.steps.some((step) => step.id === stepId),
  );
  if (!scenario) throw new Error(`Étape inconnue : ${stepId}`);
  const index = scenario.steps.findIndex((step) => step.id === stepId);
  if (scenario.steps[index].type !== "analyze")
    throw new Error(`${stepId} n'est pas une analyse.`);
  const { scenarioDir, statePath, databasePath } = paths(runDir, scenario.id);
  const state = readJson(statePath);
  const position = state.log.findIndex((item) => item.step === stepId);
  const entry = state.log[position];
  if (!entry || entry.outcome !== "rejected")
    throw new Error(`${stepId} n'a pas été rejetée : rien à reprendre.`);
  const later = scenario.steps
    .slice(index + 1)
    .filter((step) => step.type === "analyze")
    .map((step) => join(scenarioDir, step.id));
  for (const directory of later)
    if (
      existsSync(join(directory, RAW_PROPOSAL)) ||
      existsSync(join(directory, RETRY_PROPOSAL))
    )
      throw new Error(`Une étape ultérieure a déjà une réponse : ${directory}`);
  for (const directory of later)
    rmSync(directory, { recursive: true, force: true });
  rmSync(join(scenarioDir, FINAL_SNAPSHOT), { force: true });
  rmSync(databasePath, { force: true });
  // Le reçu sera réécrit, avec les deux essais, à l'application du second.
  rmSync(join(scenarioDir, stepId, "receipt.json"), { force: true });
  state.log = state.log.slice(0, position + 1);
  state.log[position] = {
    step: stepId,
    type: "analyze",
    outcome: "awaiting_response",
    requestId: entry.requestId,
  };
  state.nextStepIndex = index + 1;
  state.pending = stepId;
  writeJson(statePath, state);
  console.log(`${stepId} : en attente de ${RETRY_PROPOSAL}`);
}

function status(runDir) {
  const fixture = readJson(join(runDir, "fixture.json"));
  return fixture.scenarios
    .map((scenario) => {
      const state = readJson(paths(runDir, scenario.id).statePath);
      if (!state.pending) return `${scenario.id} : terminé`;
      const rejected = existsSync(
        join(runDir, scenario.id, state.pending, RAW_PROPOSAL),
      );
      return `${scenario.id} : ${rejected ? `${state.pending} rejetée, en attente de ${RETRY_PROPOSAL}` : `en attente de ${state.pending}/PROMPT.txt`}`;
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
        subject.kind === "relation"
          ? `relation(${subject.members.map((member) => (member.kind === "self" ? "moi" : person(member.personId))).join(" – ")})`
          : subject.kind === "self"
            ? "moi"
            : person(subject.personId),
      ),
      counts: hypothesis.counts,
      rank: hypothesis.rank,
      mechanism: hypothesis.mechanism,
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
      goals: snapshot.goals,
      directions: snapshot.directions ?? [],
      actions: snapshot.actions ?? [],
    };
    scenarios.push(result);
    lines.push("", `## ${scenario.id}`, "");
    lines.push(
      `Étapes : ${state.log.map((item) => `${item.step}=${item.outcome}`).join(" · ")}`,
      "",
    );
    for (const hypothesis of hypotheses)
      lines.push(
        `- **${hypothesis.depth}** ${hypothesis.statement} — ${hypothesis.status}, ${hypothesis.confidence}${hypothesis.needsReview ? `, à réexaminer (${hypothesis.reviewReason})` : ""} ; sujets : ${hypothesis.subjects.join(", ")} ; ${hypothesis.counts.anchoredSupports} pour / ${hypothesis.counts.anchoredContradicts} contre${hypothesis.construct ? ` ; construct : ${hypothesis.construct}` : ""}${hypothesis.alternativeTo ? ` ; alternative de : ${hypothesis.alternativeTo}` : ""}${hypothesis.rank ? ` ; rang ${hypothesis.rank}` : ""}${
          hypothesis.mechanism
            ? ` ; mécanisme : ${Object.entries(hypothesis.mechanism)
                .map(([key, value]) => `${key} = ${value}`)
                .join(" | ")}`
            : ""
        }`,
      );
    for (const question of result.questions)
      lines.push(`- ? ${question.question} — ${question.status}`);
    for (const goal of snapshot.goals)
      lines.push(
        `- ◎ **objectif** [${goal.origin}${goal.confirmedByUser ? ", confirmé" : ", proposé"}${goal.dismissed ? ", écarté" : ""}] ${goal.text}${goal.problem ? ` ; problème : ${goal.problem}` : ""}${goal.citations?.length ? ` ; cite : ${goal.citations.map((citation) => `« ${citation.quote} »`).join(" | ")}` : ""}`,
      );
    // BRIEF-005 : directions et actions.
    const memberName = (member) =>
      member.kind === "self" ? "moi" : person(member.personId);
    for (const direction of snapshot.directions ?? []) {
      const lever = snapshot.hypotheses.find(
        (item) => item.id === direction.lever.hypothesisId,
      );
      lines.push(
        `- → **direction** [${direction.status}] ${direction.lever.kind}${lever ? ` (actionne ${lever.depth} « ${lever.statement} »)` : ""} — ${direction.title} : ${direction.action} ; effort ${direction.effort} ; conditions : ${direction.conditions} ; limites : ${direction.limits} ; signaux : ${direction.signals.join(" | ")} ; si échec : ${direction.learnsIfFails} ; prédictions : ${direction.predictions
          .map(
            (prediction) =>
              `${memberName(prediction.actor)} [${prediction.phase}${prediction.horizonDays ? `, ${prediction.horizonDays} j` : ""}] ${prediction.response}`,
          )
          .join(" | ")}`,
      );
    }
    for (const action of snapshot.actions ?? [])
      lines.push(
        `- ⇒ **action** [${action.status}] attente figée le ${action.expectationRecordedAt}${action.outcome ? ` ; résultat : ${action.outcome.text}` : ""}`,
      );
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

const [command, first, second, third] = process.argv.slice(2);
try {
  if (command === "auto" && first) {
    if (!withEnvProxy()) await auto(first, parseFlags(process.argv.slice(4)));
  } else if (command === "prepare" && first && second) prepare(first, second);
  else if (command === "advance" && first && !second) advance(first);
  else if (command === "summary" && first && !second) summary(first);
  else if (command === "rewind" && first && second && !third)
    rewind(first, second);
  else {
    console.error(
      "Usage : scenario-run.mjs prepare <fixture> <runDir> | advance <runDir> | summary <runDir> | rewind <runDir> <stepId> | auto <runDir> [--model m] [--effort e] [--concurrency n]",
    );
    process.exitCode = 2;
  }
} catch (error) {
  const normalized = normalizeError(error);
  console.error(`${normalized.code}: ${normalized.message}`);
  process.exitCode = 1;
}
