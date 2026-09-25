import test from "node:test";
import assert from "node:assert/strict";
import { copyFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SqliteMemoryStore } from "../packages/storage/src/sqliteStore.ts";
import {
  MAX_HYPOTHESES,
  MAX_RELATIONS,
  projectGraph,
} from "../packages/cognition/src/projection.ts";
import {
  LINK_TYPES,
  OBJECT_TYPES,
} from "../packages/cognition/src/ontology.ts";

// Données réelles d'un lot validé (R4-S02, scénario Q01 : Chloé).
function snapshotOf(run, scenario) {
  const directory = mkdtempSync(join(tmpdir(), "manwe-projection-"));
  const path = join(directory, "copy.sqlite3");
  copyFileSync(
    join("packages/evaluation/runs", run, scenario, "final.sqlite3"),
    path,
  );
  const store = new SqliteMemoryStore(path, `evaluation-${run}-${scenario}`);
  try {
    return store.snapshot();
  } finally {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
}

function checkShape(projection, snapshot) {
  const ids = new Set(projection.nodes.map((node) => node.id));
  assert.equal(projection.revision, snapshot.workspace.revision);
  for (const edge of projection.edges) {
    assert.ok(
      ids.has(edge.from) && ids.has(edge.to),
      `lien orphelin ${edge.id}`,
    );
    assert.ok(edge.kind in LINK_TYPES, `type de lien déclaré : ${edge.kind}`);
  }
  for (const node of projection.nodes)
    assert.ok(
      node.kind === "self" || node.kind in OBJECT_TYPES,
      `type d’objet déclaré : ${node.kind}`,
    );
  assert.equal(ids.size, projection.nodes.length, "nœuds uniques");
}

test("R4.1-R4.2 · projections personne, relation, hypothèse et question sur des données réelles", () => {
  const snapshot = snapshotOf("2026-09-25-deepseek-flash-r4-s02", "Q01");
  const chloe = snapshot.persons.find(
    (person) => person.displayName === "Chloé",
  );
  assert.ok(chloe);

  const person = projectGraph(snapshot, { kind: "person", id: chloe.id });
  checkShape(person, snapshot);
  assert.ok(person.nodes.some((node) => node.id === `person:${chloe.id}`));
  assert.ok(
    person.nodes.filter((node) => node.kind === "relation").length <=
      MAX_RELATIONS,
  );
  const readings = person.nodes.filter((node) => node.kind === "hypothesis");
  assert.ok(readings.length > 0 && readings.length <= MAX_HYPOTHESES);

  const relation = snapshot.relations.find((item) =>
    item.members.some((member) => member.personId === chloe.id),
  );
  const relationView = projectGraph(snapshot, {
    kind: "relation",
    id: relation.id,
  });
  checkShape(relationView, snapshot);
  assert.equal(
    relationView.nodes.filter((node) => node.kind === "event").length,
    4,
    "les 4 épisodes avec rôles",
  );
  assert.ok(relationView.edges.some((edge) => edge.kind === "plays_role"));
  assert.ok(relationView.edges.some((edge) => edge.kind === "about"));

  const main = snapshot.hypotheses.find((item) =>
    item.subjects.some((subject) => subject.kind === "relation"),
  );
  const hypothesisView = projectGraph(snapshot, {
    kind: "hypothesis",
    id: main.id,
  });
  checkShape(hypothesisView, snapshot);
  const evidence = hypothesisView.edges.filter(
    (edge) => edge.kind === "supports" || edge.kind === "contradicts",
  );
  assert.ok(evidence.length > 0, "preuves reliées");
  assert.ok(
    hypothesisView.edges.some((edge) => edge.kind === "cites"),
    "chaque preuve remonte à son épisode source",
  );

  const question = snapshot.questions[0];
  if (question)
    checkShape(
      projectGraph(snapshot, { kind: "question", id: question.id }),
      snapshot,
    );

  // Déterminisme : même instantané, même projection.
  assert.deepEqual(
    projectGraph(snapshot, { kind: "person", id: chloe.id }),
    person,
  );
});
