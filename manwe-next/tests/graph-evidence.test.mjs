import test from "node:test";
import assert from "node:assert/strict";
import { copyFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SqliteMemoryStore } from "../packages/storage/src/sqliteStore.ts";
import {
  annotationTarget,
  explainNode,
} from "../apps/desktop/src/graphEvidence.ts";

const RUN = "2026-09-25-deepseek-flash-r4-s02";

// Données réelles (R4-S02, Q01) ; la copie permet d'annoter sans toucher au run.
function withStore(callback) {
  const directory = mkdtempSync(join(tmpdir(), "manwe-evidence-"));
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

test("R4.5 · « Pourquoi ? » relie chaque preuve à un épisode et à l'extrait exact", () => {
  withStore((store) => {
    const snapshot = store.snapshot();
    const hypothesis = snapshot.hypotheses.find(
      (item) => item.evidence.length > 0,
    );
    assert.ok(hypothesis);
    const reasons = explainNode(snapshot, `hypothesis:${hypothesis.id}`);
    assert.ok(reasons.length > 0);
    for (const reason of reasons) {
      assert.ok(["supports", "contradicts"].includes(reason.kind));
      assert.ok(reason.excerpts.length > 0, reason.label);
      for (const excerpt of reason.excerpts) {
        const source = snapshot.sources.find(
          (item) => item.id === excerpt.sourceId,
        );
        assert.ok(source, "source présente");
        assert.ok(
          source.content.includes(excerpt.quote),
          "extrait exact, jamais reformulé",
        );
        assert.ok(excerpt.eventId, "rattaché à un épisode");
      }
    }
    const relation = snapshot.relations.find(
      (item) => item.indicators.episodes > 0,
    );
    const roles = explainNode(snapshot, `relation:${relation.id}`);
    assert.equal(
      new Set(roles.flatMap((role) => role.excerpts.map((e) => e.eventId)))
        .size,
      relation.indicators.episodes,
      "un épisode cité par épisode compté",
    );
    assert.deepEqual(explainNode(snapshot, "self"), []);
    assert.deepEqual(explainNode(snapshot, "hypothesis:absente"), []);
  });
});

test("R4.5 · « Corriger » depuis le graphe marque l'élément et reste visible", () => {
  withStore((store) => {
    const snapshot = store.snapshot();
    const hypothesis = snapshot.hypotheses.find(
      (item) => item.evidence.length > 0,
    );
    const claimId = hypothesis.evidence[0].claimId;
    const target = annotationTarget(`claim:${claimId}`);
    assert.deepEqual(target, { kind: "claim", id: claimId });
    assert.equal(annotationTarget("self"), null);
    assert.equal(annotationTarget("relation:x"), null);
    store.annotate({
      idempotencyKey: "graph-correction",
      target,
      text: "Ce n'était pas un refus, j'avais mal compris.",
      annotationType: "factual_correction",
    });
    const after = store.snapshot();
    const reasons = explainNode(after, `hypothesis:${hypothesis.id}`);
    const corrected = reasons.find((reason) =>
      after.claims.find(
        (claim) => claim.id === claimId && claim.text === reason.label,
      ),
    );
    assert.ok(
      corrected?.contested,
      "la correction est visible dans « Pourquoi ? »",
    );
    assert.ok(
      after.annotations.some((note) => note.sourceId),
      "la correction devient une source citable",
    );
  });
});
