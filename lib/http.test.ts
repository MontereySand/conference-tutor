import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { z } from "zod";
import { requireSameOrigin, parseJson, HttpError } from "./http";
beforeEach(() => { vi.stubEnv("PUBLIC_APP_ORIGIN", ""); });
afterEach(() => { vi.unstubAllEnvs(); });
test("foreign and absent origins fail before request handling", () => {
  for (const origin of [undefined, "https://foreign.example"]) {
    const request = new Request("http://localhost:3000/api/ask", { method: "POST", headers: origin ? { origin } : {} });
    try { requireSameOrigin(request); throw new Error("accepted"); } catch (error) { expect(error).toBeInstanceOf(HttpError); expect((error as HttpError).status).toBe(403); }
  }
  requireSameOrigin(new Request("http://localhost:3000/api/ask", { headers: { origin: "http://localhost:3000" } }));
});
test("uses the actual Host when Next normalizes a loopback URL to localhost", () => {
  requireSameOrigin(new Request("http://localhost:3000/api/ask", { headers: { host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000" } }));
  expect(() => requireSameOrigin(new Request("http://localhost:3000/api/ask", { headers: { host: "127.0.0.1:3000", origin: "https://foreign.example" } }))).toThrow(HttpError);
});
test("uses the browser-facing forwarded port and exact loopback host", () => {
  for (const host of ["127.0.0.1:3010", "[::1]:3010", "localhost:3010"]) {
    requireSameOrigin(new Request("http://localhost:3000/api/ask", { headers: { host, origin: `http://${host}` } }));
    expect(() => requireSameOrigin(new Request("http://localhost:3000/api/ask", { headers: { host, origin: "http://localhost:3000" } }))).toThrow(HttpError);
  }
});
test("rejects malformed and noncanonical loopback hosts rather than trusting normalization", () => {
  for (const host of ["127.1:3010", "localhost.:3010", "user@localhost:3010", "localhost:3010/path", "localhost:3010?x", "localhost:3010#x"]) {
    expect(() => requireSameOrigin(new Request("http://localhost:3000/api/ask", { headers: { host, origin: new URL(`http://${host}`).origin } }))).toThrow(HttpError);
  }
  expect(() => requireSameOrigin(new Request("http://localhost:3000/api/ask", { headers: { host: "evil.example", "x-forwarded-host": "localhost:3000", origin: "http://localhost:3000" } }))).toThrow(HttpError);
});
test("configured HTTPS accepts only its exact origin", () => {
  vi.stubEnv("PUBLIC_APP_ORIGIN", "https://judge.example");
  requireSameOrigin(new Request("http://localhost:3000/api/ask", { headers: { origin: "https://judge.example" } }));
  for (const origin of ["http://judge.example", "https://judge.example:443", "https://alias.example", "http://localhost:3000"]) {
    expect(() => requireSameOrigin(new Request("http://localhost:3000/api/ask", { headers: { origin } }))).toThrow(HttpError);
  }
});
test("invalid configured origins fail closed", () => {
  for (const configured of ["http://judge.example", "https://user:password@judge.example", "https://judge.example/path", "invalid"]) {
    vi.stubEnv("PUBLIC_APP_ORIGIN", configured);
    expect(() => requireSameOrigin(new Request("http://localhost:3000/api/ask", { headers: { origin: configured } }))).toThrow(expect.objectContaining({ status: 503 }));
  }
});
test("matching attacker-controlled Host and Origin cannot authorize a DNS-rebound request", () => {
  expect(() => requireSameOrigin(new Request("http://evil.example:3000/api/ask", { headers: { host: "evil.example:3000", origin: "http://evil.example:3000" } }))).toThrow(HttpError);
});
test("actual streamed bytes are bounded even without a content length", async () => {
  const request = new Request("http://localhost:3000/api/ask", { method: "POST", body: JSON.stringify({ question: "x".repeat(40) }) });
  await expect(parseJson(request, z.object({ question: z.string() }), 20)).rejects.toMatchObject({ status: 413 });
});
