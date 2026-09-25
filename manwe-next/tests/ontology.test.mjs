import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ACTIONS,
  OBJECT_TYPES,
  VOCABULARIES,
} from "../packages/cognition/src/ontology.ts";
import { COGNITIVE_OPERATION_KINDS } from "../packages/cognition/src/contract.ts";

const prompt = readFileSync(
  new URL("../packages/cognition/prompts/analyst-v6.md", import.meta.url),
  "utf8",
);
const migrations = [1, 2, 3, 4, 5, 6, 7, 8]
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
