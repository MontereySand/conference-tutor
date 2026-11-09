import { z } from "zod";
const Cites = z.array(z.string().min(1)).max(12);
export const LessonSchema = z.object({
  answer: z.string().max(2400),
  bridge: z.object({ anchorId: z.string(), text: z.string().max(1200), limit: z.string().max(600) }).nullable(),
  steps: z.array(z.object({ text: z.string().max(1200), cites: Cites })).max(4),
  cites: Cites,
  referenceNotes: z.array(z.object({ refChunkId: z.string(), text: z.string().max(1200) })).max(2),
  boundary: z.object({ reason: z.string().max(1200), nearbyQuestion: z.string().max(600) }).nullable(),
  prediction: z.object({ prompt: z.string().max(1200), expected: z.string().max(2000), cites: Cites }).nullable(),
});
export type Lesson = z.infer<typeof LessonSchema>;
export type CitationSource = { chunkId: string; kind: "talk" | "reference"; title: string; url: string; startMs?: number; endMs?: number };
