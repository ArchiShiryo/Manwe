// Historique : preuve assistée 2026-09-14. Utiliser evaluation-run.mjs pour les nouveaux lots.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SqliteMemoryStore } from "../packages/storage/src/sqliteStore.ts";

const runs = [
  ["01", "01-negation"],
  ["02", "02-conditionnel"],
  ["03", "03-propos-rapporte"],
];
const results = [];

for (const [number, folder] of runs) {
  const databasePath = join(process.cwd(), ".qa", `assisted-${number}.sqlite3`);
  const proposalPath = join(
    process.cwd(),
    "packages",
    "evaluation",
    "runs",
    "2026-09-14-assisted",
    folder,
    "proposal.raw.json",
  );
  const store = new SqliteMemoryStore(databasePath, `evaluation-${number}`);
  const proposal = JSON.parse(readFileSync(proposalPath, "utf8"));
  const preview = store.receiveAnalysis(proposal);
  const applied = store.applyAnalysis(preview.responseId);
  const replay = store.receiveAnalysis(proposal);
  store.close();

  const reopenedStore = new SqliteMemoryStore(
    databasePath,
    `evaluation-${number}`,
  );
  const snapshot = reopenedStore.snapshot();
  const persistedAnalysis = reopenedStore.getAnalysis(proposal.requestId);
  results.push({
    run: number,
    preview,
    applicationResult: applied,
    exactReimport: {
      replayed: replay.replayed,
      applicationResult: replay.applicationResult,
    },
    persisted: {
      requestStatus: persistedAnalysis.status,
      responseStatus: persistedAnalysis.responses[0]?.status ?? null,
      revision: snapshot.workspace.revision,
      claims: snapshot.claims,
      events: snapshot.events.length,
    },
  });
  reopenedStore.close();
}

console.log(JSON.stringify(results, null, 2));
