import { z } from "zod";
import { BudgetError } from "./budget";
export class HttpError extends Error {
  constructor(public readonly status: number, public readonly code: string) { super(code); this.name = "HttpError"; }
}
export function requireSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  const url = new URL(request.url);
  const host = request.headers.get("host");
  const expected = process.env.PUBLIC_APP_ORIGIN?.trim() || (host ? url.protocol + "//" + host : url.origin);
  if (!origin || origin !== expected) throw new HttpError(403, "origin");
}
export async function parseJson<T>(request: Request, schema: z.ZodType<T>, maxBytes = 32000): Promise<T> {
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "invalid");
  const parts: Uint8Array[] = []; let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { await reader.cancel(); throw new HttpError(413, "too_large"); }
      parts.push(value);
    }
  } finally { reader.releaseLock(); }
  return schema.parse(JSON.parse(Buffer.concat(parts).toString("utf8")));
}
export function apiError(error: unknown, stage: string, turnKey?: unknown): Response {
  const name = error instanceof Error ? error.name : "Error";
  const status = error instanceof HttpError ? error.status : error instanceof BudgetError ? 429 : error instanceof z.ZodError || error instanceof SyntaxError ? 400 : ["PreparedDataMissing", "ConfigurationError"].includes(name) ? 503 : ["AbortError", "APIUserAbortError"].includes(name) ? 499 : 502;
  const code = error instanceof HttpError ? error.code : status === 429 ? "budget" : status === 400 ? "invalid" : status === 503 ? "setup" : status === 499 ? "aborted" : "unavailable";
  return Response.json({ error: { stage, code }, ...(turnKey ? { turnKey } : {}) }, { status });
}
