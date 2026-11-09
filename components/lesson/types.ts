import type { Lesson } from "@/lib/lesson/schema";
import type { Corrections, TurnKey } from "@/lib/types";
export type CitationSource = { chunkId: string; kind: "talk" | "reference"; title: string; url: string; startMs?: number; endMs?: number };
export type AskResult = { turnKey: TurnKey; lesson: Lesson; sources: CitationSource[]; corrections: Corrections; meta: { servedTier: string; ms: number; costUsd: number } };
export type StageError = { stage: string; code: string };
