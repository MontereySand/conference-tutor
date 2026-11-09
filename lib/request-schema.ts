import { z } from "zod";
import { LangSchema } from "./data-schema";
export const Text = z.string().trim().min(1).max(2000);
export const TurnKeySchema = z.object({ sourceId: z.string().min(1).max(100), profileId: z.string().min(1).max(100).nullable(), lang: LangSchema, version: z.number().int().nonnegative(), turnId: z.string().min(1).max(100) });
export const CorrectionsSchema = z.object({ depth: z.enum(["simple", "standard", "deep"]), noAnalogy: z.boolean() });
export const AskSchema = z.object({ turnKey: TurnKeySchema, question: Text, currentMs: z.number().finite(), corrections: CorrectionsSchema, history: z.array(z.object({ question: Text, answer: Text })).max(2) });
export const CheckSchema = z.object({ turnKey: TurnKeySchema, attempt: Text, prediction: z.object({ prompt: Text, expected: Text, cites: z.array(z.string().min(1).max(100)).min(1).max(12) }) });
export const SearchSchema = z.object({ question: Text, lang: LangSchema });
