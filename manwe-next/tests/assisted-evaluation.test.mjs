import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  cognitionHash,
  parseCognitiveProposal,
} from "../packages/cognition/src/contract.ts";

const root = join(
  process.cwd(),
  "packages",
  "evaluation",
  "runs",
  "2026-09-14-assisted",
);

const cases = [
  ["01-negation", "proposed", 1],
  ["02-conditionnel", "no_change", 0],
  ["03-propos-rapporte", "proposed", 1],
];

for (const [folder, expectedOutcome, expectedOperations] of cases) {
  test(`la preuve Sol ${folder} conserve un paquet et une proposition cohérents`, () => {
    const context = JSON.parse(
      readFileSync(join(root, folder, "context.json"), "utf8"),
    );
    const rawProposal = JSON.parse(
      readFileSync(join(root, folder, "proposal.raw.json"), "utf8"),
    );
    const { contextHash, ...unsignedContext } = context;
    assert.equal(cognitionHash(unsignedContext), contextHash);

    const proposal = parseCognitiveProposal(rawProposal);
    assert.equal(proposal.requestId, context.requestId);
    assert.equal(proposal.workspaceId, context.workspaceId);
    assert.equal(proposal.baseRevision, context.baseRevision);
    assert.equal(proposal.contextHash, context.contextHash);
    assert.equal(proposal.outcome, expectedOutcome);
    assert.equal(proposal.operations.length, expectedOperations);

    for (const operation of proposal.operations) {
      for (const citation of operation.payload.citations) {
        const source = context.sources.find(
          (item) => item.sourceId === citation.sourceId,
        );
        assert.ok(source);
        assert.equal(citation.contentHash, source.contentHash);
        assert.equal(
          source.text.slice(citation.spanStart, citation.spanEnd),
          citation.quote,
        );
      }
    }
  });
}

test("les reçus assistés distinguent application, no_change et rejeu", () => {
  const results = JSON.parse(readFileSync(join(root, "results.json"), "utf8"));
  assert.equal(results.mode, "assisted");
  assert.equal(results.automaticProviderCall, false);
  assert.equal(results.blindEvaluation, false);
  assert.deepEqual(
    results.runs.map((run) => [
      run.applicationStatus,
      run.resultRevision,
      run.persistedClaimCount,
      run.exactReimportReplayed,
    ]),
    [
      ["applied", 2, 1, true],
      ["no_change", 1, 0, true],
      ["applied", 2, 1, true],
    ],
  );
});
