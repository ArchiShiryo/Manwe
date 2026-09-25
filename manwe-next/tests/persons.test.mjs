import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parseCaptureCommand } from "../packages/domain/src/memory.ts";
import { SqliteMemoryStore } from "../packages/storage/src/sqliteStore.ts";

// D-030 : toute personne citée existe, même décrite sans nom, et son
// identité se met à jour rétrospectivement.

function withStore(run) {
  const directory = mkdtempSync(join(tmpdir(), "manwe-persons-"));
  const store = new SqliteMemoryStore(join(directory, "memory.sqlite3"), "p");
  try {
    return run(store);
  } finally {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
}

const quote = (source, text) => {
  const start = source.text.indexOf(text);
  assert.ok(start >= 0, `« ${text} » absent de la source`);
  return {
    sourceId: source.sourceId,
    contentHash: source.contentHash,
    spanStart: start,
    spanEnd: start + text.length,
    quote: text,
  };
};

const proposal = (packet, operations) => ({
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
  operations,
  clarifications: [],
  summary: "Réponse de test.",
});

test("D-030 · une personne décrite sans nom existe, rattachée, puis renommée rétroactivement", () =>
  withStore((store) => {
    store.capture(
      parseCaptureCommand({
        idempotencyKey: "p:capture:1",
        text: "Samedi, Paul est venu dîner avec la femme d'un ami ; elle m'a posé plein de questions.",
        occurredStart: "2026-03-07T20:00:00+01:00",
        temporalPrecision: "day",
      }),
    );
    // L'extraction permet désormais de créer une personne.
    const packet = store.prepareAnalysis({ task: "extract" });
    assert.ok(packet.allowedOperations.includes("propose_person"));
    const source = packet.sources[0];
    const preview = store.receiveAnalysis(
      proposal(packet, [
        {
          key: "p1",
          kind: "propose_person",
          payload: {
            mention: "Paul",
            relatedTo: null,
            relationLabel: null,
            citations: [quote(source, "Paul est venu dîner")],
          },
          rationale: "Personne nommée.",
        },
        {
          key: "p2",
          kind: "propose_person",
          payload: {
            mention: "la femme d'un ami",
            relatedTo: { mention: "Paul" },
            relationLabel: "conjointe",
            citations: [quote(source, "la femme d'un ami")],
          },
          rationale: "Personne décrite par sa relation, sans nom.",
        },
      ]),
    );
    assert.equal(preview.status, "ready_for_review", JSON.stringify(preview));
    store.applyAnalysis(preview.responseId);
    let persons = store.snapshot().persons;
    const paul = persons.find((item) => item.displayName === "Paul");
    const described = persons.find(
      (item) => item.displayName === "la femme d'un ami",
    );
    assert.ok(paul && described);
    assert.equal(paul.description, null);
    assert.equal(described.description, "la femme d'un ami");
    assert.equal(described.relatedPersonId, paul.id);
    assert.equal(described.relationLabel, "conjointe");

    // Renommage rétroactif : l'identifiant ne change pas, l'ancienne
    // description reste pour la résolution.
    store.updatePersonIdentity({
      idempotencyKey: "p:rename:1",
      personId: described.id,
      displayName: "Julie",
    });
    persons = store.snapshot().persons;
    const julie = persons.find((item) => item.id === described.id);
    assert.equal(julie.displayName, "Julie");
    assert.equal(julie.resolutionStatus, "resolved");
    assert.deepEqual(julie.formerNames, ["la femme d'un ami"]);
    assert.equal(julie.relatedPersonId, paul.id);

    // Une nouvelle analyse qui écrit encore « la femme d'un ami » désigne Julie.
    const next = store.prepareAnalysis({ task: "extract", context: "full" });
    const second = store.receiveAnalysis(
      proposal(next, [
        {
          key: "r1",
          kind: "propose_role",
          payload: {
            event: { kind: "event", id: store.snapshot().events[0].id },
            subject: { mention: "la femme d'un ami" },
            role: "initiator",
            outcome: null,
            citations: [
              quote(next.sources[0], "elle m'a posé plein de questions"),
            ],
          },
          rationale: "Elle lance l'échange.",
        },
      ]),
    );
    assert.equal(second.status, "ready_for_review", JSON.stringify(second));
    store.applyAnalysis(second.responseId);
    const snapshot = store.snapshot();
    assert.equal(snapshot.persons.length, 2, "aucune personne en double");
    assert.ok(
      snapshot.roles.some(
        (role) =>
          role.subject.kind === "person" && role.subject.personId === julie.id,
      ),
    );

    // Un nom déjà pris renvoie vers une fusion au lieu de créer un doublon.
    assert.throws(
      () =>
        store.updatePersonIdentity({
          idempotencyKey: "p:rename:2",
          personId: julie.id,
          displayName: "Paul",
        }),
      /fusionner/,
    );
  }));
