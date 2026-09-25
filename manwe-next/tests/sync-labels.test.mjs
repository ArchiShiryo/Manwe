import test from "node:test";
import assert from "node:assert/strict";
import { syncLabels } from "../apps/desktop/src/syncLabels.ts";

const status = (analyses) => ({
  revision: 3,
  analyses: {
    awaitingResponse: 0,
    readyForReview: 0,
    needsContext: 0,
    modes: [],
    ...analyses,
  },
});

test("R4.7 · le mode réel est affiché, sans parler d'inférence pendant une attente manuelle", () => {
  assert.equal(syncLabels("online", null).analysis, null);
  assert.match(syncLabels("reconnecting", null).connection, /reconnexion/);
  const manual = syncLabels(
    "online",
    status({ awaitingResponse: 1, modes: ["assisted"] }),
  ).analysis;
  assert.match(manual, /assistée/);
  assert.doesNotMatch(manual, /cours/);
  assert.match(
    syncLabels("online", status({ awaitingResponse: 1, modes: ["automatic"] }))
      .analysis,
    /automatique en cours/,
  );
  assert.match(
    syncLabels(
      "online",
      status({ awaitingResponse: 1, readyForReview: 2, modes: ["assisted"] }),
    ).analysis,
    /examiner \(2\)/,
  );
  assert.match(
    syncLabels("online", status({ needsContext: 1 })).analysis,
    /contexte/,
  );
});
