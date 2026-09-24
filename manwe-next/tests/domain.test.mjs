import test from "node:test";
import assert from "node:assert/strict";
import {
  addAnnotation,
  answerQuestion,
  captureNote,
  createDemo,
  getHypothesis,
  selectionTitle,
  validateDemo,
} from "../packages/domain/src/demo.ts";

const date = "2026-09-14T10:00:00.000Z";

test("le scénario est valide, ses preuves sont résolubles", () => {
  const state = createDemo();
  assert.ok(validateDemo(state));
  for (const id of [
    ...getHypothesis(state).supporting,
    ...getHypothesis(state).against,
  ]) {
    assert.ok(state.events.some((e) => e.id === id));
  }
});
test("une note négative est conservée littéralement, sans extraire une invitation", () => {
  const original = createDemo();
  const text =
    "Marc ne m’a pas invité à jouer. Je ne pense pas que notre lien se renforce.";
  const next = captureNote(original, `  ${text}  `, "negative-note", date);
  assert.equal(next.events[0].text, text);
  assert.equal(next.events[0].category, "note");
  assert.deepEqual(next.events[0].personIds, []);
  assert.equal(next.events.length, original.events.length + 1);
  assert.deepEqual(getHypothesis(next), getHypothesis(original));
  assert.equal(original.revision, 1);
});
test("une saisie vide ne change pas la mémoire", () => {
  const state = createDemo();
  assert.equal(captureNote(state, " \n ", "empty", date), state);
  assert.equal(
    addAnnotation(state, { kind: "person", id: "marc" }, "  ", "empty", date),
    state,
  );
});
test("une nuance sur une source entraîne une revue, sans supprimer la source", () => {
  const original = createDemo();
  const next = addAnnotation(
    original,
    { kind: "event", id: "invite" },
    "Il avait invité tout le groupe.",
    "nuance",
    date,
  );
  assert.equal(getHypothesis(next).status, "À réexaminer");
  assert.equal(next.annotations[0].target.id, "invite");
  assert.deepEqual(next.events, original.events);
  assert.ok(validateDemo(next));
});
test("une nuance sur Claire ne requalifie pas le lien avec Marc", () => {
  const state = createDemo();
  const next = addAnnotation(
    state,
    { kind: "person", id: "claire" },
    "Elle était en déplacement.",
    "claire-context",
    date,
  );
  assert.equal(getHypothesis(next).status, "Plausible");
});
test("changer de réponse remplace son élément, sans accumulation", () => {
  const yes = answerQuestion(createDemo(), "yes", date);
  assert.ok(getHypothesis(yes).supporting.includes("question-answer"));
  const activity = answerQuestion(yes, "activity", date);
  assert.equal(
    activity.events.filter((e) => e.id === "question-answer").length,
    1,
  );
  assert.ok(getHypothesis(activity).against.includes("question-answer"));
  assert.ok(!getHypothesis(activity).supporting.includes("question-answer"));
  const unknown = answerQuestion(activity, "unknown", date);
  assert.equal(unknown.questionAnswer, "unknown");
  assert.equal(getHypothesis(unknown).status, "Plausible");
  assert.equal(unknown.events[0].category, "note");
});
test("une réponse du scénario ne gomme pas un désaccord conservé", () => {
  const corrected = addAnnotation(
    createDemo(),
    { kind: "hypothesis", id: "closeness" },
    "Cette lecture manque de contexte.",
    "review",
    date,
  );
  assert.equal(
    getHypothesis(answerQuestion(corrected, "yes", date)).status,
    "À réexaminer",
  );
});
test("aller-retour JSON conserve la révision, la note, la réponse et la nuance", () => {
  let state = captureNote(createDemo(), "Une note personnelle.", "note", date);
  state = answerQuestion(state, "unknown", date);
  state = addAnnotation(
    state,
    { kind: "event", id: "note" },
    "Une précision.",
    "a",
    date,
  );
  const restored = JSON.parse(JSON.stringify(state));
  assert.ok(validateDemo(restored));
  assert.deepEqual(restored, state);
});
test("les données corrompues, références absentes et dates invalides sont rejetées", () => {
  for (const value of [
    null,
    {},
    [],
    { ...createDemo(), version: 2 },
    { ...createDemo(), revision: -1 },
    { ...createDemo(), events: [] },
    { ...createDemo(), questionAnswer: "invalid" },
  ])
    assert.equal(validateDemo(value), false);
  const badDate = addAnnotation(
    createDemo(),
    { kind: "person", id: "marc" },
    "Nuance",
    "a",
    "invalid",
  );
  assert.equal(validateDemo(badDate), false);
  const badRef = addAnnotation(
    createDemo(),
    { kind: "event", id: "missing" },
    "Nuance",
    "a",
    date,
  );
  assert.equal(validateDemo(badRef), false);
  const duplicates = createDemo();
  duplicates.events.push(duplicates.events[0]);
  assert.equal(validateDemo(duplicates), false);
});
test("les titres des vues reflètent le même état dérivé", () => {
  const state = answerQuestion(createDemo(), "activity", date);
  assert.equal(
    selectionTitle({ kind: "hypothesis", id: "closeness" }, state),
    getHypothesis(state).title,
  );
  assert.equal(
    selectionTitle({ kind: "goal", id: "friendship" }, state),
    state.goalText,
  );
});
