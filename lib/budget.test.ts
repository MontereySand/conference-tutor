import { afterEach, expect, test } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Budget, costOf } from "./budget.ts";
const dirs: string[] = [];
function ledger() { const dir = mkdtempSync(join(tmpdir(), "ct-budget-")); dirs.push(dir); return join(dir, "ledger.jsonl"); }
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });
test("concurrent holds reserve the cap and abandoned calls remain charged after restart", () => {
  const path = ledger(); const budget = new Budget(path, 0.02);
  budget.admit("lesson", 0.01); budget.admit("lesson", 0.01);
  expect(() => budget.admit("decision", 0.002)).toThrow("Budget reached");
  expect(new Budget(path, 0.02).spentUsd).toBeCloseTo(0.02);
});
test("a recorded actual cost releases unused hold exactly once", () => {
  const path = ledger(); const budget = new Budget(path, 0.01);
  const hold = budget.admit("lesson", 0.01);
  expect(budget.record(hold, { inputTokens: 1000, outputTokens: 1000, fast: true })).toBeCloseTo(0.0012);
  expect(new Budget(path, 0.01).spentUsd).toBeCloseTo(0.0012);
  expect(() => budget.record(hold, {})).toThrow("Unknown or settled");
  expect(() => budget.admit("lesson", 0.008)).not.toThrow();
});
test("twentieth call is allowed but the next call in the minute is refused", () => {
  const budget = new Budget(ledger(), 5); const now = Date.now();
  for (let i = 0; i < 20; i++) budget.admit("decision", 0.002, now);
  expect(() => budget.admit("decision", 0.002, now + 59999)).toThrow("Paid call rate");
  expect(() => budget.admit("decision", 0.002, now + 60000)).not.toThrow();
});
test("speech is billed by duration and invalid usage is refused", () => {
  expect(costOf("transcription", { seconds: 30 })).toBeCloseTo(0.003);
  expect(() => costOf("translation", { inputTokens: -1 })).toThrow("Invalid usage");
});
