import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { copyFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  ACTIONS,
  LINK_TYPES,
  OBJECT_TYPES,
  VOCABULARIES,
  renderPrompt,
} from "../packages/cognition/src/ontology.ts";
import { projectGraph } from "../packages/cognition/src/projection.ts";
import { SqliteMemoryStore } from "../packages/storage/src/sqliteStore.ts";
import { COGNITIVE_OPERATION_KINDS } from "../packages/cognition/src/contract.ts";

const prompt = readFileSync(
  new URL("../packages/cognition/prompts/analyst-v7.md", import.meta.url),
  "utf8",
);
const migrations = [1, 2, 3, 4, 5, 6, 7, 8, 9]
  .map((n) => String(n).padStart(3, "0"))
  .map((prefix) => {
    const dir = new URL("../packages/storage/src/migrations/", import.meta.url);
    const files = [
      "initial",
      "cognition",
      "imports_and_metrics",
      "claim_modality",
      "revision_engine",
      "critiques",
      "brief003",
      "relations_roles",
      "directions_actions",
    ];
    return readFileSync(
      new URL(`${prefix}_${files[Number(prefix) - 1]}.sql`, dir),
      "utf8",
    );
  })
  .join("\n");

test("R4.0d · le registre, le contrat, le prompt et le stockage restent alignés", () => {
  const actions = new Set(Object.values(ACTIONS).flat());
  assert.deepEqual([...actions].sort(), [...COGNITIVE_OPERATION_KINDS].sort());
  for (const kind of COGNITIVE_OPERATION_KINDS)
    assert.ok(prompt.includes(`"${kind}"`), `le prompt décrit ${kind}`);
  for (const list of [
    VOCABULARIES.episodeRoles,
    VOCABULARIES.mechanismKeys,
    VOCABULARIES.depths,
    VOCABULARIES.categories,
  ])
    for (const value of list)
      assert.ok(prompt.includes(value), `le prompt mentionne ${value}`);
  for (const role of VOCABULARIES.episodeRoles)
    assert.ok(migrations.includes(`'${role}'`), `le stockage accepte ${role}`);
  const tables = {
    source: "sources",
    event: "events",
    claim: "claims",
    person: "persons",
    relation: "relations",
    role: "event_roles",
    hypothesis: "hypotheses",
    critique: "hypothesis_critiques",
    question: "open_questions",
    annotation: "annotations",
    goal: "goals",
    direction: "directions",
    action: "actions",
  };
  assert.deepEqual(
    Object.keys(tables).sort(),
    Object.keys(OBJECT_TYPES).sort(),
  );
  for (const table of Object.values(tables))
    assert.match(
      migrations,
      new RegExp(`CREATE TABLE (IF NOT EXISTS )?${table}\\b`),
      `table ${table}`,
    );
});

test("R4.0d · chaque vocabulaire correspond exactement à une contrainte du stockage", () => {
  const checks = [
    ...migrations.matchAll(/CHECK \((\w+) IN \(([^)]*)\)\)/g),
  ].map((match) =>
    match[2]
      .split(",")
      .map((value) => value.trim().replace(/'/g, ""))
      .sort()
      .join("|"),
  );
  for (const [name, list] of Object.entries({
    categories: VOCABULARIES.categories,
    stances: VOCABULARIES.stances,
    depths: VOCABULARIES.depths,
    confidences: VOCABULARIES.confidences,
    statuses: VOCABULARIES.statuses,
    annotationTypes: VOCABULARIES.annotationTypes,
    episodeRoles: VOCABULARIES.episodeRoles,
  }))
    assert.ok(
      checks.includes([...list].sort().join("|")),
      `aucune contrainte du stockage ne correspond à ${name}`,
    );
  for (const value of [
    ...VOCABULARIES.stances,
    ...VOCABULARIES.confidences,
    ...VOCABULARIES.statuses.filter((status) => status !== "superseded"),
  ])
    assert.ok(prompt.includes(value), `le prompt mentionne ${value}`);
});

test("R4.0d · les liens émis par le graphe respectent le registre", () => {
  const run = "2026-09-25-deepseek-flash-r4-s02";
  for (const scenario of ["Q01", "Q02", "Q03"]) {
    const directory = mkdtempSync(join(tmpdir(), "manwe-ontology-"));
    const path = join(directory, "copy.sqlite3");
    copyFileSync(
      join("packages/evaluation/runs", run, scenario, "final.sqlite3"),
      path,
    );
    const store = new SqliteMemoryStore(path, `evaluation-${run}-${scenario}`);
    try {
      const snapshot = store.snapshot();
      const focuses = [
        { kind: "self", id: "self" },
        ...snapshot.persons.map((item) => ({ kind: "person", id: item.id })),
        ...snapshot.relations.map((item) => ({
          kind: "relation",
          id: item.id,
        })),
        ...snapshot.hypotheses.map((item) => ({
          kind: "hypothesis",
          id: item.id,
        })),
        ...snapshot.questions.map((item) => ({
          kind: "question",
          id: item.id,
        })),
      ];
      let edges = 0;
      for (const focus of focuses) {
        const projection = projectGraph(snapshot, focus);
        const kinds = new Map(
          projection.nodes.map((node) => [node.id, node.kind]),
        );
        for (const edge of projection.edges) {
          edges += 1;
          const [from, to] = LINK_TYPES[edge.kind];
          assert.ok(
            from.split("|").includes(kinds.get(edge.from)),
            `${edge.kind} part de ${kinds.get(edge.from)} (${scenario})`,
          );
          assert.ok(
            to.split("|").includes(kinds.get(edge.to)),
            `${edge.kind} arrive sur ${kinds.get(edge.to)} (${scenario})`,
          );
        }
      }
      assert.ok(edges > 0);
    } finally {
      store.close();
      rmSync(directory, { recursive: true, force: true });
    }
  }
});

test("R4.0d · le prompt versionné est exactement le rendu du gabarit depuis le registre", () => {
  const template = readFileSync(
    new URL(
      "../packages/cognition/prompts/analyst.template.md",
      import.meta.url,
    ),
    "utf8",
  );
  assert.ok(template.includes("{{enum:"), "le gabarit contient des marqueurs");
  assert.equal(
    renderPrompt(template),
    prompt,
    "analyst-v7.md = rendu du gabarit",
  );
  assert.throws(() => renderPrompt("{{enum:inconnu}}"), /inconnu/);
});
