import test from "node:test";
import assert from "node:assert/strict";
import { copyFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SqliteMemoryStore } from "../packages/storage/src/sqliteStore.ts";

// D-026 sur les données réelles de P02 (R5-S02, club de volley, 20 notes).
const RUN = "2026-09-25-deepseek-flash-r5-s02";

test("D-026 · la mémoire de travail garde l'état du monde et allège nettement le paquet", () => {
  const directory = mkdtempSync(join(tmpdir(), "manwe-working-"));
  const path = join(directory, "copy.sqlite3");
  copyFileSync(
    join("packages/evaluation/runs", RUN, "P02/final.sqlite3"),
    path,
  );
  const store = new SqliteMemoryStore(path, `evaluation-${RUN}-P02`);
  try {
    const snapshot = store.snapshot();
    const focus = [
      ...snapshot.goals.map((goal) => ({ kind: "goal", id: goal.id })),
      ...snapshot.events.map((event) => ({ kind: "event", id: event.id })),
      ...snapshot.hypotheses
        .filter((item) => item.status !== "superseded")
        .map((item) => ({ kind: "hypothesis", id: item.id })),
    ].slice(0, 100);
    const full = store.prepareAnalysis({
      task: "revise",
      focus,
      context: "full",
    });
    const working = store.prepareAnalysis({ task: "revise", focus });
    assert.equal(full.memory, "full");
    assert.equal(working.memory, "working");
    const size = (packet) => JSON.stringify(packet).length;
    // Garde-fou sur le paquet le plus lourd (dernière réanalyse, 18 lectures) :
    // au moins 35 %. Le critère scellé du lot (40 % en moyenne sur A2 à A5)
    // se mesure pendant le run R5-S03.
    assert.ok(
      size(working) <= size(full) * 0.65,
      `paquet ${size(working)} contre ${size(full)} (réduction insuffisante)`,
    );
    // Rien de l'état n'est perdu.
    for (const key of [
      "hypotheses",
      "claims",
      "roles",
      "relations",
      "goals",
      "questions",
      "directions",
      "actions",
    ])
      assert.equal(working[key].length, full[key].length, key);
    // Les faits se citent par identifiant, sans recopier leurs citations.
    assert.ok(
      working.claims.every(
        (claim) => !("citations" in claim) && claim.sourceIds.length,
      ),
    );
    // Seules les notes non analysées (ou apportées par une annotation) gardent leur texte.
    const analysed = new Set(
      snapshot.claims.flatMap((claim) =>
        claim.citations.map((item) => item.sourceId),
      ),
    );
    const annotationSources = new Set(
      snapshot.annotations.map((item) => item.sourceId),
    );
    for (const source of working.sources)
      assert.ok(
        !analysed.has(source.sourceId) ||
          annotationSources.has(source.sourceId),
      );
    assert.ok(working.sources.length < full.sources.length);
    assert.ok(
      working.coverage.omissions.some((item) =>
        item.includes("texte intégral sur requête"),
      ),
    );
  } finally {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
