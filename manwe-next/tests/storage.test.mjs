import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { DatabaseSync } from "node:sqlite";
import {
  parseAnnotationCommand,
  parseCaptureCommand,
  parseGoalCommand,
  parseImportCommand,
  parseResolveIdentityCommand,
} from "../packages/domain/src/memory.ts";
import { SqliteMemoryStore } from "../packages/storage/src/sqliteStore.ts";

const referenceCorpus = JSON.parse(
  readFileSync(
    new URL(
      "../packages/evaluation/fixtures/r1-reference.json",
      import.meta.url,
    ),
    "utf8",
  ),
);

function withDatabase(run) {
  const directory = mkdtempSync(join(tmpdir(), "manwe-memory-"));
  const path = join(directory, "memory.sqlite3");
  try {
    return run(path);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test("un espace personnel neuf ne contient pas le scénario de démonstration", () =>
  withDatabase((path) => {
    const store = new SqliteMemoryStore(path);
    const snapshot = store.snapshot();
    assert.equal(snapshot.workspace.revision, 0);
    assert.deepEqual(snapshot.events, []);
    assert.deepEqual(snapshot.sources, []);
    assert.deepEqual(snapshot.annotations, []);
    store.close();
  }));

test("la capture conserve le texte littéral sans extraction sémantique", () =>
  withDatabase((path) => {
    const store = new SqliteMemoryStore(path);
    const result = store.capture(
      parseCaptureCommand({
        idempotencyKey: "capture:negative:0001",
        text: "Marc ne m’a pas invité à jouer.",
        recordedAt: "2026-09-14T12:00:00-03:00",
      }),
    );
    const snapshot = store.snapshot();
    assert.equal(result.revision, 1);
    assert.equal(snapshot.events[0].text, "Marc ne m’a pas invité à jouer.");
    assert.equal(snapshot.events[0].category, "unclassified_note");
    assert.equal(snapshot.events[0].occurredStart, null);
    assert.equal(snapshot.sources[0].content, snapshot.events[0].text);
    assert.match(snapshot.sources[0].contentHash, /^[a-f0-9]{64}$/);
    store.close();
  }));

test("la même commande est idempotente et une réutilisation différente est refusée", () =>
  withDatabase((path) => {
    const store = new SqliteMemoryStore(path);
    const command = parseCaptureCommand({
      idempotencyKey: "capture:idem:0001",
      text: "Un récit précis.",
    });
    const first = store.capture(command);
    const replay = store.capture(command);
    assert.equal(first.replayed, false);
    assert.equal(replay.replayed, true);
    assert.equal(replay.revision, first.revision);
    assert.equal(store.snapshot().events.length, 1);
    assert.throws(
      () => store.capture({ ...command, text: "Un autre récit." }),
      (error) => error.code === "idempotency_conflict",
    );
    store.close();
  }));

test("une annotation est liée à sa cible et survit à la réouverture", () =>
  withDatabase((path) => {
    let store = new SqliteMemoryStore(path);
    const capture = store.capture(
      parseCaptureCommand({
        idempotencyKey: "capture:restart:01",
        text: "Une rencontre racontée.",
      }),
    );
    const event = capture.created.find((ref) => ref.kind === "event");
    assert.ok(event);
    const annotation = store.annotate(
      parseAnnotationCommand({
        idempotencyKey: "annotate:restart:01",
        target: event,
        annotationType: "context",
        text: "La rencontre était organisée par le groupe.",
      }),
    );
    assert.equal(annotation.revision, 2);
    store.close();

    store = new SqliteMemoryStore(path);
    const snapshot = store.snapshot();
    assert.equal(snapshot.workspace.revision, 2);
    assert.equal(snapshot.annotations[0].target.id, event.id);
    assert.equal(
      snapshot.annotations[0].text,
      "La rencontre était organisée par le groupe.",
    );
    assert.deepEqual(
      snapshot.revisions.map((entry) => entry.commandType),
      ["capture", "annotate"],
    );
    store.close();
  }));

test("une cible absente et une saisie invalide ne laissent aucun état partiel", () =>
  withDatabase((path) => {
    const store = new SqliteMemoryStore(path);
    assert.throws(
      () =>
        store.annotate(
          parseAnnotationCommand({
            idempotencyKey: "annotate:missing:01",
            target: { kind: "event", id: "absent" },
            annotationType: "factual_correction",
            text: "Correction.",
          }),
        ),
      (error) => error.code === "target_not_found",
    );
    assert.equal(store.revision, 0);
    assert.deepEqual(store.snapshot().annotations, []);
    assert.throws(
      () => parseCaptureCommand({ idempotencyKey: "short", text: "ok" }),
      (error) => error.code === "invalid_idempotency_key",
    );
    store.close();
  }));

test("une intention utilisateur peut être créée puis modifiée avec historique", () =>
  withDatabase((path) => {
    const store = new SqliteMemoryStore(path);
    const created = store.updateGoal(
      parseGoalCommand({
        idempotencyKey: "goal:create:0001",
        text: "Voir plus clairement mes liens",
      }),
    );
    const goalId = created.created[0].id;
    const updated = store.updateGoal(
      parseGoalCommand({
        idempotencyKey: "goal:update:0001",
        goalId,
        text: "Prendre soin de mes liens",
      }),
    );
    assert.equal(updated.revision, 2);
    assert.equal(store.snapshot().goals[0].text, "Prendre soin de mes liens");
    assert.equal(store.snapshot().goals[0].confirmedByUser, true);
    store.close();
  }));

test("la recherche retrouve le texte sans modifier la mémoire", () =>
  withDatabase((path) => {
    const store = new SqliteMemoryStore(path);
    store.capture(
      parseCaptureCommand({
        idempotencyKey: "capture:search:01",
        text: "Claire a parlé de son voyage.",
      }),
    );
    store.capture(
      parseCaptureCommand({
        idempotencyKey: "capture:search:02",
        text: "Une autre note.",
      }),
    );
    const revision = store.revision;
    assert.equal(store.search("voyage").length, 1);
    assert.equal(store.search("%_").length, 0);
    assert.equal(store.revision, revision);
    store.close();
  }));

test("une sauvegarde se restaure dans une base séparée", () =>
  withDatabase((path) => {
    const store = new SqliteMemoryStore(path);
    store.capture(
      parseCaptureCommand({
        idempotencyKey: "capture:backup:001",
        text: "Un souvenir à retrouver après sauvegarde.",
      }),
    );
    const backupPath = join(path, "..", "backups", "memory-copy.sqlite3");
    assert.equal(store.backup(backupPath), backupPath);
    assert.equal(existsSync(backupPath), true);
    assert.throws(
      () => store.backup(backupPath),
      (error) => error.code === "backup_exists",
    );
    store.close();

    const restored = new SqliteMemoryStore(backupPath);
    const snapshot = restored.snapshot();
    assert.equal(snapshot.workspace.revision, 1);
    assert.equal(
      snapshot.events[0].text,
      "Un souvenir à retrouver après sauvegarde.",
    );
    restored.close();
  }));

test("les dates du récit et de l’événement restent distinctes et les intervalles sont validés", () =>
  withDatabase((path) => {
    const store = new SqliteMemoryStore(path);
    store.capture(
      parseCaptureCommand({
        idempotencyKey: "capture:dates:0001",
        text: "La situation a duré quelques jours.",
        recordedAt: "2026-09-14T18:00:00-03:00",
        narratedAt: "2026-09-13T18:00:00-03:00",
        occurredStart: "2026-08-01T00:00:00-03:00",
        occurredEnd: "2026-08-05T23:59:59-03:00",
        temporalPrecision: "interval",
        context: "Vacances",
      }),
    );
    const snapshot = store.snapshot();
    assert.equal(snapshot.sources[0].recordedAt, "2026-09-14T18:00:00-03:00");
    assert.equal(snapshot.sources[0].narratedAt, "2026-09-13T18:00:00-03:00");
    assert.equal(snapshot.events[0].occurredStart, "2026-08-01T00:00:00-03:00");
    assert.equal(snapshot.events[0].occurredEnd, "2026-08-05T23:59:59-03:00");
    assert.equal(snapshot.events[0].temporalPrecision, "interval");
    assert.throws(
      () =>
        parseCaptureCommand({
          idempotencyKey: "capture:dates:0002",
          text: "Intervalle incomplet.",
          occurredStart: "2026-08-05T00:00:00-03:00",
          temporalPrecision: "interval",
        }),
      (error) => error.code === "invalid_interval",
    );
    store.close();
  }));

test("le corpus de vingt récits survit au redémarrage et son réimport est idempotent", () =>
  withDatabase((path) => {
    let store = new SqliteMemoryStore(path);
    const commands = referenceCorpus.events.map((fixture) =>
      parseCaptureCommand(fixture.command),
    );
    assert.equal(commands.length, 20);
    const episodeEventIds = referenceCorpus.episodes.flatMap(
      (episode) => episode.eventIds,
    );
    assert.equal(referenceCorpus.episodes.length, 5);
    assert.equal(new Set(episodeEventIds).size, 20);
    assert.deepEqual(
      new Set(episodeEventIds),
      new Set(referenceCorpus.events.map((fixture) => fixture.id)),
    );
    for (const command of commands)
      assert.equal(store.capture(command).replayed, false);
    assert.equal(store.revision, 20);
    for (const command of commands)
      assert.equal(store.capture(command).replayed, true);
    assert.equal(store.revision, 20);
    store.close();

    store = new SqliteMemoryStore(path);
    const snapshot = store.snapshot();
    assert.equal(snapshot.events.length, 20);
    assert.equal(snapshot.sources.length, 20);
    assert.equal(snapshot.revisions.length, 20);
    assert.equal(store.search({ context: "Travail" }).length, 6);
    const june = store.search({
      occurredFrom: "2026-06-01T00:00:00-03:00",
      occurredTo: "2026-06-30T23:59:59-03:00",
    });
    assert.equal(june.length, 1);
    assert.equal(june[0].source.content, june[0].event.text);
    store.close();
  }));

test("la recherche filtre une personne liée et restitue sa source exacte", () =>
  withDatabase((path) => {
    let store = new SqliteMemoryStore(path);
    const capture = store.capture(
      parseCaptureCommand({
        idempotencyKey: "capture:person:001",
        text: "Événement lié à une identité confirmée.",
      }),
    );
    const eventId = capture.created.find((ref) => ref.kind === "event").id;
    store.close();

    const database = new DatabaseSync(path);
    database.exec("PRAGMA foreign_keys = ON");
    database
      .prepare(
        "INSERT INTO persons(id, workspace_id, display_name, resolution_status, row_version, created_at, updated_at) VALUES (?, 'personal', ?, 'resolved', 1, ?, ?)",
      )
      .run(
        "person-confirmed",
        "Camille",
        "2026-09-14T18:00:00Z",
        "2026-09-14T18:00:00Z",
      );
    database
      .prepare(
        "INSERT INTO event_participants(event_id, person_id, role) VALUES (?, ?, ?)",
      )
      .run(eventId, "person-confirmed", "participant");
    database.close();

    store = new SqliteMemoryStore(path);
    const results = store.search({ personId: "person-confirmed" });
    assert.equal(results.length, 1);
    assert.equal(results[0].participants[0].displayName, "Camille");
    assert.equal(results[0].source.content, results[0].event.text);
    assert.deepEqual(store.search({ personId: "person-absent" }), []);
    store.close();
  }));

test("un import JSON est atomique, rejeuable et conserve une ambiguïté d’identité", () =>
  withDatabase((path) => {
    let store = new SqliteMemoryStore(path);
    const content = JSON.stringify({
      events: [
        {
          text: "Marc du travail a présenté le dossier.",
          occurredStart: "2026-09-10T09:00:00-03:00",
          temporalPrecision: "exact",
          context: "Travail",
          participants: [{ name: "Marc", identityKey: "marc-work" }],
        },
        {
          text: "Marc du club a organisé la sortie.",
          occurredStart: "2026-09-11T18:00:00-03:00",
          temporalPrecision: "exact",
          context: "Club",
          participants: [{ name: "Marc", identityKey: "marc-club" }],
        },
        {
          text: "Marc a ensuite envoyé un message.",
          context: "Inconnu",
          participants: ["Marc"],
        },
      ],
    });
    const command = parseImportCommand({
      idempotencyKey: "import:identities:0001",
      format: "json",
      content,
      sourceName: "identites.json",
      sourceSystem: "fixture-identities",
      importedAt: "2026-09-14T18:00:00-03:00",
    });
    const result = store.importData(command);
    assert.equal(result.replayed, false);
    assert.equal(result.importedEvents, 3);
    assert.equal(result.createdPeople, 2);
    assert.equal(result.linkedParticipants, 2);
    assert.equal(result.ambiguities.length, 1);
    assert.equal(result.ambiguities[0].mention, "Marc");
    assert.equal(result.ambiguities[0].candidatePersonIds.length, 2);
    assert.equal(store.revision, 1);

    const replayWithAnotherCommand = store.importData(
      parseImportCommand({
        ...command,
        idempotencyKey: "import:identities:0002",
      }),
    );
    assert.equal(replayWithAnotherCommand.replayed, true);
    assert.equal(store.revision, 1);
    assert.equal(store.snapshot().events.length, 3);
    const ambiguityPacket = store.prepareAnalysis({
      task: "extract",
      focus: [{ kind: "event", id: result.ambiguities[0].eventId }],
    });
    assert.equal(
      ambiguityPacket.entities.filter(
        (entity) => entity.id === result.ambiguities[0].ambiguityId,
      ).length,
      1,
    );
    for (const candidateId of result.ambiguities[0].candidatePersonIds)
      assert.ok(
        ambiguityPacket.entities.some((entity) => entity.id === candidateId),
      );
    assert.throws(
      () =>
        store.resolveIdentity(
          parseResolveIdentityCommand({
            idempotencyKey: "identity:resolve:invalid",
            ambiguityId: result.ambiguities[0].ambiguityId,
            personId: "person-not-a-candidate",
          }),
        ),
      (error) => error.code === "invalid_identity_candidate",
    );
    assert.equal(store.revision, 1);
    const resolutionCommand = parseResolveIdentityCommand({
      idempotencyKey: "identity:resolve:0001",
      ambiguityId: result.ambiguities[0].ambiguityId,
      personId: result.ambiguities[0].candidatePersonIds[0],
    });
    assert.equal(store.resolveIdentity(resolutionCommand).revision, 2);
    assert.equal(store.resolveIdentity(resolutionCommand).replayed, true);
    assert.equal(
      store.search({
        personId: result.ambiguities[0].candidatePersonIds[0],
      }).length,
      2,
    );
    store.close();

    store = new SqliteMemoryStore(path);
    const snapshot = store.snapshot();
    assert.equal(snapshot.persons.length, 2);
    assert.equal(snapshot.identityAmbiguities.length, 1);
    assert.equal(snapshot.identityAmbiguities[0].status, "resolved");
    assert.deepEqual(
      snapshot.revisions.map((entry) => entry.commandType),
      ["import", "identity.resolve"],
    );
    store.close();
  }));

test("un CSV cité est importé et une ligne invalide ne laisse aucun état partiel", () =>
  withDatabase((path) => {
    const store = new SqliteMemoryStore(path);
    const content = [
      "text,occurredStart,temporalPrecision,context,participants",
      '"Claire a dit, ""bonjour"".",2026-09-12T09:00:00-03:00,day,Travail,Claire|Léa',
    ].join("\n");
    const result = store.importData(
      parseImportCommand({
        idempotencyKey: "import:csv:valid:01",
        format: "csv",
        content,
      }),
    );
    assert.equal(result.importedEvents, 1);
    assert.equal(result.createdPeople, 2);
    assert.equal(store.snapshot().sources[0].kind, "import");
    assert.equal(store.snapshot().events[0].text, 'Claire a dit, "bonjour".');
    const revision = store.revision;
    assert.throws(
      () =>
        store.importData(
          parseImportCommand({
            idempotencyKey: "import:csv:invalid:01",
            format: "csv",
            content: "text,unknown\nUne ligne,interdite",
          }),
        ),
      (error) => error.code === "unknown_import_field",
    );
    assert.equal(store.revision, revision);
    assert.equal(store.snapshot().events.length, 1);
    store.close();
  }));
