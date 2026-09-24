import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { basename, join, resolve } from "node:path";
import {
  DomainError,
  parseCaptureCommand,
} from "../packages/domain/src/memory.ts";
import { SqliteMemoryStore } from "../packages/storage/src/sqliteStore.ts";

const PROMPT_PATH = new URL(
  "../packages/cognition/prompts/analyst-v3.md",
  import.meta.url,
);
const PROMPT_TEXT = readFileSync(PROMPT_PATH, "utf8");
const QA_ROOT = resolve(process.cwd(), ".qa");
const PACKET_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;
// Copie versionnée de la base fictive telle qu'à l'export : permet d'appliquer
// les réponses sur une autre machine que celle qui a préparé le lot.
const PREPARED_SNAPSHOT = "prepared.sqlite3";

function usage() {
  console.error(
    "Usage: node scripts/evaluation-run.mjs <prepare|apply|summary> <fixture.json> <runDir>\n" +
      "       node scripts/evaluation-run.mjs <apply|summary> <runDir>",
  );
  process.exitCode = 2;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function safeId(value, label) {
  if (
    typeof value !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(value)
  )
    throw new Error(`${label} doit être un identifiant de fichier sûr.`);
  return value;
}

function runIdentity(runDir) {
  return safeId(basename(resolve(runDir)), "runDir");
}

function caseDirectories(runDir) {
  if (!existsSync(runDir)) throw new Error(`Run introuvable : ${runDir}`);
  return readdirSync(runDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((caseId) => existsSync(join(runDir, caseId, "context.json")))
    .sort((left, right) => left.localeCompare(right));
}

function normalizeError(error) {
  if (error instanceof DomainError)
    return { code: error.code, message: error.message };
  if (error instanceof SyntaxError)
    return { code: "invalid_json", message: error.message };
  return {
    code: "evaluation_harness_error",
    message: error instanceof Error ? error.message : String(error),
  };
}

function uniqueErrors(errors) {
  const seen = new Set();
  return errors.filter((error) => {
    const key = `${error.code}:${error.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function prepare(fixturePath, runDirArgument) {
  const runDir = resolve(runDirArgument);
  const runId = runIdentity(runDir);
  if (existsSync(runDir) && readdirSync(runDir).length > 0)
    throw new Error(`Le dossier du run n'est pas vide : ${runDir}`);
  const fixture = readJson(resolve(fixturePath));
  if (!Array.isArray(fixture.events) || fixture.events.length === 0)
    throw new Error("La fixture doit contenir une liste events non vide.");
  const cases = fixture.events.map((entry) => ({
    caseId: safeId(entry.id, "events[].id"),
    command: entry.command,
  }));
  if (new Set(cases.map((entry) => entry.caseId)).size !== cases.length)
    throw new Error("Les identifiants de cas doivent être uniques.");

  const databaseDir = join(QA_ROOT, runId);
  if (existsSync(databaseDir) && readdirSync(databaseDir).length > 0)
    throw new Error(
      `Le dossier de bases du run n'est pas vide : ${databaseDir}`,
    );
  mkdirSync(runDir, { recursive: true });
  mkdirSync(databaseDir, { recursive: true });

  const prepared = [];
  for (const entry of cases) {
    const caseDir = join(runDir, entry.caseId);
    const databasePath = join(databaseDir, `${entry.caseId}.sqlite3`);
    mkdirSync(caseDir, { recursive: false });
    const store = new SqliteMemoryStore(
      databasePath,
      `evaluation-${runId}-${entry.caseId}`,
    );
    try {
      const capture = store.capture(parseCaptureCommand(entry.command));
      const event = capture.created.find((ref) => ref.kind === "event");
      if (!event)
        throw new Error(`Aucun événement capturé pour ${entry.caseId}.`);
      const packet = store.prepareAnalysis({
        task: "extract",
        mode: "assisted",
        focus: [event],
        expiresAt: new Date(Date.now() + PACKET_LIFETIME_MS).toISOString(),
      });
      writeJson(join(caseDir, "context.json"), packet);
      store.backup(join(caseDir, PREPARED_SNAPSHOT));
      writeFileSync(
        join(caseDir, "PROMPT.txt"),
        `${PROMPT_TEXT.trimEnd()}\n\n${JSON.stringify(packet, null, 2)}\n`,
        "utf8",
      );
      prepared.push({
        caseId: entry.caseId,
        requestId: packet.requestId,
        contextPath: join(caseDir, "context.json"),
        promptPath: join(caseDir, "PROMPT.txt"),
        databasePath,
        expiresAt: packet.expiresAt,
      });
    } finally {
      store.close();
    }
  }
  console.log(JSON.stringify({ runId, prepared }, null, 2));
}

const RAW_PROPOSAL = "proposal.raw.json";
const RETRY_PROPOSAL = "proposal.retry.raw.json";

function attempt(store, proposalPath) {
  const raw = readFileSync(proposalPath, "utf8");
  const errors = [];
  let proposal = null;
  let preview = null;
  let applicationResult = null;
  let replay = null;
  try {
    proposal = JSON.parse(raw);
  } catch (error) {
    errors.push(normalizeError(error));
  }
  if (proposal !== null) {
    try {
      preview = store.receiveAnalysis(proposal);
      errors.push(...preview.errors);
      if (preview.status === "ready_for_review")
        applicationResult = store.applyAnalysis(preview.responseId);
    } catch (error) {
      errors.push(normalizeError(error));
    }
    try {
      replay = store.receiveAnalysis(proposal);
    } catch (error) {
      replay = { replayed: false, error: normalizeError(error) };
    }
  }
  return {
    file: basename(proposalPath),
    status:
      applicationResult?.status ??
      preview?.status ??
      (errors.length ? "rejected" : "received"),
    preview,
    applicationResult,
    replay,
    errors: uniqueErrors(errors),
  };
}

function apply(runDirArgument) {
  const runDir = resolve(runDirArgument);
  const runId = runIdentity(runDir);
  const databaseDir = join(QA_ROOT, runId);
  const receipts = [];

  for (const caseId of caseDirectories(runDir)) {
    const caseDir = join(runDir, caseId);
    const proposalPath = join(caseDir, RAW_PROPOSAL);
    if (!existsSync(proposalPath)) continue;
    const context = readJson(join(caseDir, "context.json"));
    const databasePath = join(databaseDir, `${caseId}.sqlite3`);
    if (!existsSync(databasePath)) {
      const snapshotPath = join(caseDir, PREPARED_SNAPSHOT);
      if (!existsSync(snapshotPath))
        throw new Error(
          `Base introuvable pour ${caseId} : ni ${databasePath} ni ${snapshotPath}.`,
        );
      mkdirSync(databaseDir, { recursive: true });
      copyFileSync(snapshotPath, databasePath);
    }
    const store = new SqliteMemoryStore(
      databasePath,
      `evaluation-${runId}-${caseId}`,
    );
    const attempts = [];
    try {
      attempts.push(attempt(store, proposalPath));
      // Une seule nouvelle tentative autorisée par le brief, dans une autre
      // conversation neuve ; elle n'est jouée que si la première est rejetée.
      const retryPath = join(caseDir, RETRY_PROPOSAL);
      if (attempts[0].status === "rejected" && existsSync(retryPath))
        attempts.push(attempt(store, retryPath));
    } finally {
      store.close();
    }
    const { preview, applicationResult, replay, errors } = attempts.at(-1);

    const reopened = new SqliteMemoryStore(
      databasePath,
      `evaluation-${runId}-${caseId}`,
    );
    let persistedAnalysis = null;
    let snapshot = null;
    try {
      persistedAnalysis = reopened.getAnalysis(context.requestId);
      snapshot = reopened.snapshot();
    } finally {
      reopened.close();
    }

    const receipt = {
      caseId,
      requestId: context.requestId,
      responseId: preview?.responseId ?? null,
      status: attempts.at(-1).status,
      proposalFile: attempts.at(-1).file,
      attempts: attempts.map(({ file, status, errors }) => ({
        file,
        status,
        errorCodes: [...new Set(errors.map((error) => error.code))],
      })),
      preview,
      applicationResult,
      exactReplay: replay,
      persisted: {
        requestStatus: persistedAnalysis.status,
        responseStatuses: persistedAnalysis.responses.map(
          (response) => response.status,
        ),
        revision: snapshot.workspace.revision,
        claimCount: snapshot.claims.length,
        eventCount: snapshot.events.length,
      },
      errors: uniqueErrors(errors),
    };
    writeJson(join(caseDir, "receipt.json"), receipt);
    receipts.push(receipt);
  }
  console.log(JSON.stringify({ runId, receipts }, null, 2));
}

function rawProposalFacts(path) {
  if (!existsSync(path))
    return { operationCount: 0, categories: [], modalities: [] };
  try {
    const proposal = readJson(path);
    const operations = Array.isArray(proposal.operations)
      ? proposal.operations
      : [];
    return {
      operationCount: operations.length,
      categories: [
        ...new Set(
          operations
            .map((operation) => operation?.payload?.category)
            .filter((value) => typeof value === "string"),
        ),
      ],
      modalities: [
        ...new Set(
          operations
            .map((operation) => operation?.payload?.modality)
            .filter((value) => typeof value === "string"),
        ),
      ],
    };
  } catch {
    return { operationCount: 0, categories: [], modalities: [] };
  }
}

function markdownCell(values) {
  return values.length ? values.map((value) => `\`${value}\``).join(", ") : "—";
}

function summary(runDirArgument) {
  const runDir = resolve(runDirArgument);
  const runId = runIdentity(runDir);
  const cases = caseDirectories(runDir).map((caseId) => {
    const caseDir = join(runDir, caseId);
    const receiptPath = join(caseDir, "receipt.json");
    const receipt = existsSync(receiptPath) ? readJson(receiptPath) : null;
    const proposal = rawProposalFacts(
      join(caseDir, receipt?.proposalFile ?? RAW_PROPOSAL),
    );
    return {
      caseId,
      status: receipt?.status ?? "awaiting_response",
      proposalFile: receipt?.proposalFile ?? null,
      attempts: receipt?.attempts?.length ?? 0,
      operationCount: proposal.operationCount,
      categories: proposal.categories,
      modalities: proposal.modalities,
      errorCodes: [
        ...new Set(
          (receipt?.errors ?? [])
            .map((error) => error?.code)
            .filter((value) => typeof value === "string"),
        ),
      ],
    };
  });
  const results = {
    schemaVersion: "1.0",
    runId,
    generatedAt: new Date().toISOString(),
    cases,
  };
  writeJson(join(runDir, "results.json"), results);
  const rows = cases.map(
    (entry) =>
      `| ${entry.caseId} | ${entry.status} | ${entry.attempts} | ${entry.operationCount} | ${markdownCell(entry.categories)} | ${markdownCell(entry.modalities)} | ${markdownCell(entry.errorCodes)} |`,
  );
  const markdown = [
    `# Résumé mécanique — ${runId}`,
    "",
    "Ce tableau décrit uniquement les sorties et validations enregistrées. Il ne note pas leur justesse.",
    "",
    "| Cas | Statut | Tentatives | Opérations | Catégories | Modalités | Codes d'erreur |",
    "| --- | --- | ---: | ---: | --- | --- | --- |",
    ...rows,
    "",
  ].join("\n");
  writeFileSync(join(runDir, "SUMMARY.md"), markdown, "utf8");
  console.log(JSON.stringify(results, null, 2));
}

const [command, first, second] = process.argv.slice(2);
try {
  if (command === "prepare" && first && second) prepare(first, second);
  else if (command === "apply" && first && !second) apply(first);
  else if (command === "summary" && first && !second) summary(first);
  else usage();
} catch (error) {
  const normalized = normalizeError(error);
  console.error(`${normalized.code}: ${normalized.message}`);
  process.exitCode = 1;
}
