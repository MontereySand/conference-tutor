import { expect, test } from "vitest";
import { fuseRanks, retrievalQueries } from "./search.ts";
test("a passage supported by both branches outranks a first hit from only one", () => {
  expect(fuseRanks([[{ chunkId: "a" }, { chunkId: "both" }], [{ chunkId: "b" }, { chunkId: "both" }]], 3).map((x) => x.chunkId)).toEqual(["both", "a", "b"]);
});
test("source authorization is applied before both candidate sets", () => {
  const queries = retrievalQueries("permissions", "es", ["omnigent", "omnigent-reference"]);
  expect(queries.lexical.bool?.filter).toEqual([{ terms: { source_id: ["omnigent", "omnigent-reference"] } }]);
  expect(queries.semantic.bool?.filter).toEqual(queries.lexical.bool?.filter);
});
