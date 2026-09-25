import test from "node:test";
import assert from "node:assert/strict";
import {
  contextKey,
  personContexts,
  workspaceContexts,
} from "../apps/desktop/src/jewelTheme.ts";

test("thème Jewel case · le contexte libre d'une note donne une couleur stable", () => {
  assert.equal(contextKey("Club"), "play");
  assert.equal(contextKey("Coloc"), "voisin");
  assert.equal(contextKey("Amis"), "close");
  assert.equal(contextKey("Travail"), "work");
  assert.equal(contextKey("Famille"), "kin");
  assert.equal(contextKey(null), "close");
  // Un contexte inconnu reçoit toujours la même couleur.
  assert.equal(contextKey("Chorale"), contextKey("chorale"));
  // « pro » seul désigne le travail, pas « proches ».
  assert.equal(contextKey("Rendez-vous pro"), "work");
  assert.equal(contextKey("Proches"), "close");
});

test("thème Jewel case · parts de contexte d'une personne selon ses épisodes", () => {
  const snapshot = {
    events: [
      { id: "e1", context: "Club" },
      { id: "e2", context: "Club" },
      { id: "e3", context: "Amis" },
      { id: "e4", context: "Travail" },
    ],
    roles: [
      { eventId: "e1", subject: { kind: "person", personId: "p" } },
      { eventId: "e2", subject: { kind: "person", personId: "p" } },
      { eventId: "e3", subject: { kind: "person", personId: "p" } },
      { eventId: "e4", subject: { kind: "person", personId: "q" } },
    ],
  };
  assert.deepEqual(personContexts(snapshot, "p"), [
    { key: "play", share: 2 / 3 },
    { key: "close", share: 1 / 3 },
  ]);
  assert.deepEqual(personContexts(snapshot, "absent"), []);
  const counts = Object.fromEntries(
    workspaceContexts(snapshot).map((item) => [item.key, item.count]),
  );
  assert.equal(counts.play, 2);
  assert.equal(counts.work, 1);
  assert.equal(counts.kin, 0);
});
