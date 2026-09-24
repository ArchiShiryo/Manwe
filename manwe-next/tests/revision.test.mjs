import test from "node:test";
import assert from "node:assert/strict";
import {
  checkStatus,
  dependentHypotheses,
  disagreementAddressed,
  independentUnits,
  isDuplicateQuestion,
  maxConfidence,
  normalizeQuestion,
} from "../packages/cognition/src/revision.ts";

let counter = 0;
function fact(unitKey, occurredAt, overrides = {}) {
  counter += 1;
  return {
    claimId: `claim-${counter}`,
    stance: "supports",
    category: "sourced_observation",
    contested: false,
    unitKey,
    occurredAt,
    ...overrides,
  };
}

test("trois indices d'un même épisode et deux copies d'un message comptent pour une unité chacun", () => {
  const summary = independentUnits([
    fact("episode:dejeuner", "2026-04-15T12:00:00-03:00"),
    fact("episode:dejeuner", "2026-04-15T12:00:00-03:00"),
    fact("episode:dejeuner", "2026-04-15T12:00:00-03:00"),
    fact("hash:message", "2026-04-06T12:00:00-03:00"),
    fact("hash:message", "2026-04-06T12:00:00-03:00"),
  ]);
  assert.equal(summary.supports.length, 2);
  assert.equal(summary.anchoredSupports, 2);
});

test("une hypothèse appuyée seulement sur des inférences n'a aucun ancrage", () => {
  const summary = independentUnits([
    fact("hash:a", "2026-01-01T12:00:00Z", { category: "inference" }),
    fact("hash:b", "2026-03-01T12:00:00Z", { category: "inference" }),
  ]);
  assert.equal(summary.anchoredSupports, 0);
  assert.equal(
    checkStatus(
      "plausible",
      { depth: "D1", hasActiveAlternative: false },
      summary,
    ).allowed,
    false,
  );
});

test("un claim contesté par l'utilisateur cesse de compter comme ancrage", () => {
  const before = independentUnits([
    fact("hash:a", "2026-03-03T12:00:00Z"),
    fact("hash:b", "2026-03-21T12:00:00Z"),
  ]);
  const after = independentUnits([
    fact("hash:a", "2026-03-03T12:00:00Z"),
    fact("hash:b", "2026-03-21T12:00:00Z", { contested: true }),
  ]);
  const d2 = { depth: "D2", hasActiveAlternative: false };
  assert.equal(checkStatus("plausible", d2, before).allowed, true);
  assert.equal(checkStatus("plausible", d2, after).allowed, false);
});

test("une contre-preuve ancrée retire le droit au statut plausible", () => {
  const d1 = { depth: "D1", hasActiveAlternative: false };
  const support = [fact("hash:a", "2026-05-02T12:00:00Z")];
  assert.equal(
    checkStatus("plausible", d1, independentUnits(support)).allowed,
    true,
  );
  const withContra = independentUnits([
    ...support,
    fact("hash:b", "2026-06-30T12:00:00Z", { stance: "contradicts" }),
  ]);
  assert.equal(checkStatus("plausible", d1, withContra).allowed, false);
  assert.equal(checkStatus("contradicted", d1, withContra).allowed, true);
});

test("D4 est accepté en brouillon mais plausible exige 3 épisodes sur 30 jours et une alternative", () => {
  const deep = { depth: "D4", hasActiveAlternative: true };
  const crisis = independentUnits([
    fact("hash:a", "2026-07-01T12:00:00Z"),
    fact("hash:b", "2026-07-04T12:00:00Z"),
    fact("hash:c", "2026-07-09T12:00:00Z"),
    fact("hash:d", "2026-07-12T12:00:00Z"),
  ]);
  assert.equal(checkStatus("draft", deep, crisis).allowed, true);
  assert.equal(checkStatus("plausible", deep, crisis).allowed, false);
  const pattern = independentUnits([
    fact("hash:a", "2026-01-15T12:00:00Z"),
    fact("hash:b", "2026-03-27T12:00:00Z"),
    fact("hash:c", "2026-05-06T12:00:00Z"),
  ]);
  assert.equal(checkStatus("plausible", deep, pattern).allowed, true);
  assert.equal(
    checkStatus(
      "plausible",
      { depth: "D4", hasActiveAlternative: false },
      pattern,
    ).allowed,
    false,
  );
});

test("le plafond de confiance suit les ancrages nets et leur étendue", () => {
  assert.equal(
    maxConfidence(independentUnits([fact("hash:a", "2026-01-01T12:00:00Z")])),
    "low",
  );
  assert.equal(
    maxConfidence(
      independentUnits([
        fact("hash:a", "2026-01-01T12:00:00Z"),
        fact("hash:b", "2026-01-05T12:00:00Z"),
        fact("hash:c", "2026-01-09T12:00:00Z"),
      ]),
    ),
    "moderate",
  );
  assert.equal(
    maxConfidence(
      independentUnits([
        fact("hash:a", "2026-01-01T12:00:00Z"),
        fact("hash:b", "2026-02-05T12:00:00Z"),
        fact("hash:c", "2026-03-09T12:00:00Z"),
      ]),
    ),
    "high",
  );
});

test("les hypothèses dépendantes d'un claim modifié sont identifiées", () => {
  assert.deepEqual(
    dependentHypotheses(
      ["c2"],
      [
        { hypothesisId: "h1", claimId: "c1" },
        { hypothesisId: "h2", claimId: "c2" },
        { hypothesisId: "h3", claimId: "c2" },
      ],
    ),
    ["h2", "h3"],
  );
});

test("une question déjà posée est reconnue malgré casse, accents et ponctuation", () => {
  assert.equal(
    normalizeQuestion("  Karim répond-il TARD aux autres ? "),
    "karim repond il tard aux autres",
  );
  const existing = [
    {
      normalizedText: normalizeQuestion("Karim répond-il tard aux autres ?"),
      targets: ["h1", "h2"],
    },
  ];
  assert.equal(
    isDuplicateQuestion(
      { text: "karim repond il tard aux autres", targets: ["h2", "h1"] },
      existing,
    ),
    true,
  );
  assert.equal(
    isDuplicateQuestion(
      { text: "Karim répond-il tard aux autres ?", targets: ["h1"] },
      existing,
    ),
    false,
  );
});

test("un désaccord exige une alternative, une contre-preuve ou l'abandon", () => {
  const base = {
    hasActiveAlternative: false,
    addsContradiction: false,
    newStatus: "draft",
  };
  assert.equal(disagreementAddressed(base), false);
  assert.equal(
    disagreementAddressed({ ...base, hasActiveAlternative: true }),
    true,
  );
  assert.equal(
    disagreementAddressed({ ...base, addsContradiction: true }),
    true,
  );
  assert.equal(
    disagreementAddressed({ ...base, newStatus: "superseded" }),
    true,
  );
});
