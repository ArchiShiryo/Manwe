import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parseCaptureCommand } from "../packages/domain/src/memory.ts";
import { SqliteMemoryStore } from "../packages/storage/src/sqliteStore.ts";
import { projectGraph } from "../packages/cognition/src/projection.ts";

// Diagnostic du graphe vide : dès l'extraction, un lien déclaré (« ma
// colocataire Inès ») et deux acteurs d'un même épisode forment une dyade.

const quote = (source, text) => {
  const start = source.text.indexOf(text);
  return {
    sourceId: source.sourceId,
    contentHash: source.contentHash,
    spanStart: start,
    spanEnd: start + text.length,
    quote: text,
  };
};

test("liens dès l'extraction : déclaré par la note, ou observé dans un épisode", () => {
  const directory = mkdtempSync(join(tmpdir(), "manwe-links-"));
  const store = new SqliteMemoryStore(join(directory, "m.sqlite3"), "l");
  try {
    store.capture(
      parseCaptureCommand({
        idempotencyKey: "l:capture:1",
        text: "Je vis en coloc avec Inès. Au boulot, Karim me propose de déjeuner presque tous les midis.",
      }),
    );
    const packet = store.prepareAnalysis({ task: "extract" });
    const source = packet.sources[0];
    const preview = store.receiveAnalysis({
      schemaVersion: "1.8",
      requestId: packet.requestId,
      workspaceId: packet.workspaceId,
      baseRevision: packet.baseRevision,
      contextHash: packet.contextHash,
      modelDeclaration: {
        declaredModel: "Test",
        role: "analyst",
        technicalId: null,
      },
      outcome: "proposed",
      operations: [
        {
          key: "p1",
          kind: "propose_person",
          payload: {
            mention: "Inès",
            relatedTo: { self: true },
            relationLabel: "colocataire",
            citations: [quote(source, "Je vis en coloc avec Inès")],
          },
          rationale: "Lien déclaré.",
        },
        {
          key: "e1",
          kind: "propose_event",
          payload: {
            title: "Déjeuners avec Karim",
            text: "Karim propose de déjeuner presque tous les midis.",
            category: "explicit_statement",
            occurredStart: null,
            occurredEnd: null,
            temporalPrecision: "unknown",
            context: "travail",
            citations: [
              quote(
                source,
                "Karim me propose de déjeuner presque tous les midis",
              ),
            ],
          },
          rationale: "Habitude racontée.",
        },
        {
          key: "r1",
          kind: "propose_role",
          payload: {
            event: { proposalKey: "e1" },
            subject: { mention: "Karim" },
            role: "initiator",
            outcome: null,
            citations: [quote(source, "Karim me propose")],
          },
          rationale: "Il propose.",
        },
        {
          key: "r2",
          kind: "propose_role",
          payload: {
            event: { proposalKey: "e1" },
            subject: { self: true },
            role: "recipient",
            outcome: null,
            citations: [quote(source, "me propose de déjeuner")],
          },
          rationale: "L'utilisateur reçoit.",
        },
      ],
      clarifications: [],
      summary: "Liens.",
    });
    assert.equal(
      preview.status,
      "ready_for_review",
      JSON.stringify(preview.errors),
    );
    store.applyAnalysis(preview.responseId);
    const snapshot = store.snapshot();
    const name = (member) =>
      member.kind === "self"
        ? "moi"
        : snapshot.persons.find((p) => p.id === member.personId)?.displayName;
    const dyads = snapshot.relations.map((r) =>
      r.members.map(name).sort().join("+"),
    );
    assert.ok(dyads.includes("Inès+moi"), `lien déclaré (${dyads})`);
    assert.ok(dyads.includes("Karim+moi"), `lien observé (${dyads})`);
    const graph = projectGraph(snapshot, { kind: "self", id: "self" });
    assert.equal(
      graph.nodes.filter((node) => node.kind === "relation").length,
      2,
      "deux liens visibles autour de vous",
    );
  } finally {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("une description composée est acceptée si ses mots sont dans la citation ; un prénom inventé, non", () => {
  const directory = mkdtempSync(join(tmpdir(), "manwe-links-"));
  const store = new SqliteMemoryStore(join(directory, "m.sqlite3"), "l2");
  try {
    store.capture(
      parseCaptureCommand({
        idempotencyKey: "l2:capture:1",
        text: "Samedi j'étais invité chez mon frère Théo et sa femme. Sa femme m'a demandé si j'avais quelqu'un.",
      }),
    );
    const packet = store.prepareAnalysis({ task: "extract" });
    const source = packet.sources[0];
    const person = (key, mention, citation) => ({
      key,
      kind: "propose_person",
      payload: {
        mention,
        relatedTo: { mention: "Théo" },
        relationLabel: "conjointe",
        citations: [quote(source, citation)],
      },
      rationale: "Citée.",
    });
    const preview = store.receiveAnalysis({
      schemaVersion: "1.8",
      requestId: packet.requestId,
      workspaceId: packet.workspaceId,
      baseRevision: packet.baseRevision,
      contextHash: packet.contextHash,
      modelDeclaration: {
        declaredModel: "Test",
        role: "analyst",
        technicalId: null,
      },
      outcome: "proposed",
      operations: [
        person("p0", "Théo", "mon frère Théo"),
        person("p1", "la femme de Théo", "mon frère Théo et sa femme"),
        person("p2", "Julie", "mon frère Théo et sa femme"),
        ...[
          "j'étais invité chez mon frère",
          "Sa femme m'a demandé",
          "si j'avais quelqu'un",
        ].map((text, index) => ({
          key: `c${index}`,
          kind: "propose_claim",
          payload: {
            text,
            category: "explicit_statement",
            modality: "actual",
            validFrom: null,
            validTo: null,
            citations: [quote(source, text)],
          },
          rationale: "Fait rapporté.",
        })),
      ],
      clarifications: [],
      summary: "Personnes.",
    });
    assert.equal(
      preview.status,
      "ready_for_review",
      JSON.stringify(preview.errors),
    );
    const result = store.applyAnalysis(preview.responseId);
    const names = store
      .snapshot()
      .persons.map((p) => p.displayName)
      .sort();
    assert.deepEqual(names, ["Théo", "la femme de Théo"]);
    assert.ok(
      result.warnings.some((w) => /Julie/.test(w.message)),
      "le prénom inventé est écarté, signalé",
    );
  } finally {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
