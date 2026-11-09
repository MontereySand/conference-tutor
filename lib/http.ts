import { z } from "zod";
import { BudgetError } from "./budget";
export class HttpError extends Error {
  constructor(public readonly status: number, public readonly code: string) { super(code); this.name = "HttpError"; }
}
export function requireSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  const url = new URL(request.url);
  const configured = process.env.PUBLIC_APP_ORIGIN?.trim();
  let allowed: string;
  if (configured) {
    let publicUrl: URL;
    try { publicUrl = new URL(configured); } catch { throw new HttpError(503, "setup"); }
    if (publicUrl.protocol !== "https:" || publicUrl.origin !== configured || publicUrl.username || publicUrl.password) throw new HttpError(503, "setup");
    allowed = configured;
  } else {
    const host = request.headers.get("host") ?? url.host;
    let localUrl: URL;
    try { localUrl = new URL(`${url.protocol}//${host}`); } catch { throw new HttpError(403, "origin"); }
    if (!["http:", "https:"].includes(localUrl.protocol) || !["localhost", "127.0.0.1", "[::1]"].includes(localUrl.hostname) || localUrl.host !== host || localUrl.username || localUrl.password || localUrl.pathname !== "/" || localUrl.search || localUrl.hash) throw new HttpError(403, "origin");
    allowed = localUrl.origin;
  }
  if (!origin || origin !== allowed) throw new HttpError(403, "origin");
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
