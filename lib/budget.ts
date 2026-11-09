import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";

export type PaidKind = "lesson" | "decision" | "transcription" | "narration" | "translation" | "embedding";
export type Usage = { inputTokens?: number; outputTokens?: number; fast?: boolean; seconds?: number; audioOutputTokens?: number };
export type Hold = { id: string; kind: PaidKind; maxUsd: number };
const EntrySchema = z.object({ event: z.enum(["hold", "record"]), id: z.string().min(1), kind: z.enum(["lesson", "decision", "transcription", "narration", "translation", "embedding"]), usd: z.number().finite().nonnegative(), at: z.number().finite().nonnegative() });
type Entry = z.infer<typeof EntrySchema>;
// List prices checked 2026-11-09. Cached tokens are conservatively billed as uncached.
export function costOf(kind: PaidKind, usage: Usage): number {
  const values = Object.values(usage).filter((v) => typeof v === "number");
  if (values.some((v) => !Number.isFinite(v) || v < 0)) throw new Error("Invalid usage");
  if (kind === "transcription") return (usage.seconds ?? 0) * 0.006 / 60;
  if (kind === "narration") return ((usage.inputTokens ?? 0) * 0.60 + (usage.audioOutputTokens ?? 0) * 20) / 1e6;
  if (kind === "embedding") return (usage.inputTokens ?? 0) * 0.02 / 1e6;
  return ((usage.inputTokens ?? 0) * (usage.fast ? 0.20 : 0.10) + (usage.outputTokens ?? 0) * (usage.fast ? 1 : 0.50)) / 1e6;
}
export class BudgetError extends Error {
  status = 429;
  constructor(message = "Budget reached") { super(message); this.name = "BudgetError"; }
}
export class Budget {
  private path: string;
  private cap: number;
  private entries: Entry[];
  private charges = new Map<string, number>();
  private open = new Map<string, Hold>();
  constructor(path = resolve("data/runtime/ledger.jsonl"), cap = Number(process.env.SPEND_CAP_USD ?? 25)) {
    if (!Number.isFinite(cap) || cap < 0) throw new Error("Invalid spend cap");
    this.path = path; this.cap = cap;
    this.entries = existsSync(path) ? readFileSync(path, "utf8").split("\n").filter(Boolean).map((line) => {
      return EntrySchema.parse(JSON.parse(line));
    }) : [];
    for (const row of this.entries) this.charges.set(row.id, row.usd);
  }
  get spentUsd(): number { return Array.from(this.charges.values()).reduce((a, b) => a + b, 0); }
  admit(kind: PaidKind, maxUsd: number, now = Date.now()): Hold {
    if (!Number.isFinite(maxUsd) || maxUsd <= 0) throw new Error("Invalid budget hold");
    if (this.spentUsd + maxUsd > this.cap + Number.EPSILON) throw new BudgetError();
    if (this.entries.filter((e) => e.event === "hold" && now - e.at < 60000).length >= 20) throw new BudgetError("Paid call rate reached");
    const hold = { id: randomUUID(), kind, maxUsd };
    this.append({ event: "hold", id: hold.id, kind, usd: maxUsd, at: now });
    this.open.set(hold.id, hold); this.charges.set(hold.id, maxUsd);
    return hold;
  }
  record(hold: Hold, usage: Usage): number {
    if (!this.open.has(hold.id)) throw new Error("Unknown or settled budget hold");
    const usd = costOf(hold.kind, usage);
    this.append({ event: "record", id: hold.id, kind: hold.kind, usd, at: Date.now() });
    this.charges.set(hold.id, usd); this.open.delete(hold.id);
    return usd;
  }
  private append(row: Entry): void {
    mkdirSync(dirname(this.path), { recursive: true, mode: 0o700 });
    appendFileSync(this.path, JSON.stringify(row) + "\n", { mode: 0o600 });
    this.entries.push(row);
  }
}
let singleton: Budget | undefined;
export function getBudget(): Budget { return singleton ??= new Budget(); }
