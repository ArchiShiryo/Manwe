import test from "node:test";
import assert from "node:assert/strict";
import { copyFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SqliteMemoryStore } from "../packages/storage/src/sqliteStore.ts";
import { projectGraph } from "../packages/cognition/src/projection.ts";
import {
  MAX_FACTS,
  MAX_READINGS,
  buildSynthesis,
} from "../packages/cognition/src/synthesis.ts";

const RUN = "2026-09-25-deepseek-flash-r4-s02";

function withStore(callback) {
  const directory = mkdtempSync(join(tmpdir(), "manwe-synthesis-"));
  const path = join(directory, "copy.sqlite3");
  copyFileSync(
    join("packages/evaluation/runs", RUN, "Q01/final.sqlite3"),
    path,
  );
  const store = new SqliteMemoryStore(path, `evaluation-${RUN}-Q01`);
  try {
    return callback(store);
  } finally {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
}

test("R4.6 · la synthèse ne reprend que des faits cités et non contestés, datés par la révision", () => {
  withStore((store) => {
    const snapshot = store.snapshot();
    const relation = snapshot.relations.find(
      (item) => item.indicators.episodes > 0,
    );
    const projection = projectGraph(snapshot, {
      kind: "relation",
      id: relation.id,
    });
    const synthesis = buildSynthesis(snapshot, projection);
    assert.equal(synthesis.revision, snapshot.workspace.revision);
    assert.ok(
      synthesis.readings.length > 0 &&
        synthesis.readings.length <= MAX_READINGS,
    );
    assert.ok(
      synthesis.facts.length > 0 && synthesis.facts.length <= MAX_FACTS,
    );
    assert.equal(synthesis.relation.episodes, relation.indicators.episodes);
    const shown = new Set(
      projection.nodes
        .filter((node) => node.kind === "hypothesis")
        .map((node) => node.id.slice("hypothesis:".length)),
    );
    for (const reading of synthesis.readings)
      assert.ok(
        shown.has(reading.hypothesisId),
        "lecture issue de la projection",
      );
    for (const fact of [...synthesis.facts, ...synthesis.counterexamples]) {
      const claim = snapshot.claims.find((item) => item.id === fact.claimId);
      assert.notEqual(claim.category, "inference");
      assert.equal(claim.contestedRevision, null);
      assert.equal(fact.quote, claim.citations[0].quote);
    }
    const factIds = new Set(synthesis.facts.map((fact) => fact.claimId));
    for (const item of synthesis.counterexamples)
      assert.ok(
        !factIds.has(item.claimId),
        "un contre-exemple n'est pas un fait à l'appui",
      );
    assert.deepEqual(
      buildSynthesis(snapshot, projection),
      synthesis,
      "déterministe",
    );

    // Une correction retire le fait de la synthèse suivante.
    const target = synthesis.facts[0];
    store.annotate({
      idempotencyKey: "synthesis-correction",
      target: { kind: "claim", id: target.claimId },
      text: "C'est inexact.",
      annotationType: "factual_correction",
    });
    const after = store.snapshot();
    const next = buildSynthesis(
      after,
      projectGraph(after, { kind: "relation", id: relation.id }),
    );
    assert.ok(next.revision > synthesis.revision);
    assert.ok(!next.facts.some((fact) => fact.claimId === target.claimId));
  });
});
