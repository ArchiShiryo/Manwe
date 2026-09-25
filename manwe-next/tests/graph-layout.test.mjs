import test from "node:test";
import assert from "node:assert/strict";
import { copyFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SqliteMemoryStore } from "../packages/storage/src/sqliteStore.ts";
import { projectGraph } from "../packages/cognition/src/projection.ts";
import {
  LAYOUT_HEIGHT,
  LAYOUT_WIDTH,
  focusFromNodeId,
  focusNodeId,
  layoutGraph,
  tremor,
} from "../apps/desktop/src/graphLayout.ts";

// Même données réelles que le test des projections (R4-S02, Q01).
function snapshot() {
  const directory = mkdtempSync(join(tmpdir(), "manwe-layout-"));
  const path = join(directory, "copy.sqlite3");
  copyFileSync(
    "packages/evaluation/runs/2026-09-25-deepseek-flash-r4-s02/Q01/final.sqlite3",
    path,
  );
  const store = new SqliteMemoryStore(
    path,
    "evaluation-2026-09-25-deepseek-flash-r4-s02-Q01",
  );
  try {
    return store.snapshot();
  } finally {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
}

test("la disposition place le focus au centre et chaque nœud dans le cadre, de façon stable", () => {
  const data = snapshot();
  const relation = data.relations.find((item) => item.indicators.episodes > 0);
  assert.ok(relation);
  for (const focus of [
    { kind: "self", id: "self" },
    { kind: "relation", id: relation.id },
  ]) {
    const projection = projectGraph(data, focus);
    const placed = layoutGraph(projection);
    assert.equal(placed.length, projection.nodes.length);
    const center = placed.find((node) => node.id === focusNodeId(projection));
    assert.ok(center, "focus présent");
    assert.deepEqual(
      [center.x, center.y, center.ring],
      [LAYOUT_WIDTH / 2, LAYOUT_HEIGHT / 2, 0],
    );
    for (const node of placed) {
      assert.ok(node.x >= 0 && node.x <= LAYOUT_WIDTH, node.id);
      assert.ok(node.y >= 0 && node.y <= LAYOUT_HEIGHT, node.id);
    }
    const positions = new Set(placed.map((node) => `${node.x},${node.y}`));
    assert.equal(positions.size, placed.length, "aucun chevauchement exact");
    assert.deepEqual(layoutGraph(projection), placed, "déterministe");
  }
});

test("recentrage et tremblement des lectures", () => {
  assert.deepEqual(focusFromNodeId("self"), { kind: "self", id: "self" });
  assert.deepEqual(focusFromNodeId("relation:a:b"), {
    kind: "relation",
    id: "a:b",
  });
  assert.equal(focusFromNodeId("claim:x"), null);
  assert.equal(focusFromNodeId("event:x"), null);
  const hypothesis = (confidence) => ({
    id: "hypothesis:h",
    kind: "hypothesis",
    label: "",
    style: "inferred",
    meta: { confidence },
  });
  assert.equal(tremor(hypothesis("high")), "low");
  assert.equal(tremor(hypothesis("low")), "high");
  assert.equal(tremor({ ...hypothesis("low"), kind: "person" }), "none");
});
