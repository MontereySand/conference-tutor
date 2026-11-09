import type { Intent } from "../decide";
import type { AskRequestKind, Corrections } from "../types";

export function correctionsForIntent(current: Corrections, intent: Intent, kind: AskRequestKind): Corrections {
  if (kind === "regenerate") return current;
  if (intent === "analogy_unhelpful") return { ...current, noAnalogy: true };
  if (intent === "simpler") return { ...current, depth: "simple" };
  if (intent === "deeper") return { ...current, depth: "deep" };
  return current;
}
