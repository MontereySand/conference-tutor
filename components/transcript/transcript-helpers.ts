import type { TimedGloss } from "@/lib/types";

export function boundedSelection(value: string): string {
  return value.trim().slice(0, 1000).replace(/[\uD800-\uDBFF]$/, "");
}

export function visibleGlosses(glosses: TimedGloss[] | undefined, currentMs: number): TimedGloss[] {
  return glosses?.filter(gloss => currentMs >= gloss.startMs && currentMs < gloss.endMs) ?? [];
}
