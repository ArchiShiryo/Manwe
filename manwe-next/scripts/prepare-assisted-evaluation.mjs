import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseCaptureCommand } from "../packages/domain/src/memory.ts";
import { SqliteMemoryStore } from "../packages/storage/src/sqliteStore.ts";

const corpus = JSON.parse(
  readFileSync(
    new URL(
      "../packages/evaluation/fixtures/r1-reference.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const selected = [0, 1, 2];
const packets = [];

for (const [position, corpusIndex] of selected.entries()) {
  const run = String(position + 1).padStart(2, "0");
  const databasePath = join(process.cwd(), ".qa", `assisted-${run}.sqlite3`);
  const store = new SqliteMemoryStore(databasePath, `evaluation-${run}`);
  const capture = store.capture(
    parseCaptureCommand(corpus.events[corpusIndex].command),
  );
  const event = capture.created.find((ref) => ref.kind === "event");
  packets.push(
    store.prepareAnalysis({
      task: "extract",
      mode: "assisted",
      focus: [event],
      expiresAt: new Date(Date.now() + 23 * 60 * 60 * 1000).toISOString(),
    }),
  );
  store.close();
}

console.log(JSON.stringify(packets, null, 2));
