import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "../proxy";
import { POST } from "../app/api/access/route";
import { ACCESS_ATTEMPTS_PER_MINUTE, admitAccessAttempt, createJudgeSession, getJudgeAccess, JUDGE_COOKIE, JUDGE_SESSION_SECONDS, matchesJudgeCode, validJudgeSession } from "./judge-access";

const now = 1_800_000_000_000;
const config = { mode: "hosted" as const, origin: "https://judges.example", code: "test-code-A7b9C2d4E6f8", secret: "test-session-secret-X7c9V2n4B6m8Q0p3R5s1" };
const env = { JUDGE_ACCESS_REQUIRED: "1", PUBLIC_APP_ORIGIN: config.origin, JUDGE_ACCESS_CODE: config.code, JUDGE_SESSION_SECRET: config.secret };

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(now);
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
  admitAccessAttempt(now - 60_000);
});
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });

test("signed sessions have a fixed expiry and reject edits, future issuance, and credential rotation", () => {
  const cookie = createJudgeSession(config, now);
  expect(validJudgeSession(cookie, config, now)).toBe(true);
  expect(validJudgeSession(cookie, config, now + JUDGE_SESSION_SECONDS * 1000 - 1)).toBe(true);
  expect(validJudgeSession(cookie, config, now + JUDGE_SESSION_SECONDS * 1000)).toBe(false);
  expect(validJudgeSession(cookie, config, now - 1000)).toBe(false);
  for (const invalid of [undefined, "", cookie.replace("v1.", "v2."), cookie.slice(0, -1) + (cookie.endsWith("A") ? "B" : "A"), cookie + "x", cookie.replace(String(now / 1000), "1800000001")]) {
    expect(validJudgeSession(invalid, config, now)).toBe(false);
  }
  expect(validJudgeSession(cookie, { ...config, code: config.code + "x" }, now)).toBe(false);
  expect(validJudgeSession(cookie, { ...config, secret: config.secret + "x" }, now)).toBe(false);
  expect(validJudgeSession(cookie, { ...config, origin: "https://other.example" }, now)).toBe(false);
  expect(matchesJudgeCode(config.code, config.code)).toBe(true);
  expect(matchesJudgeCode("wrong", config.code)).toBe(false);
});

test("only completely unconfigured loopback requests have local access", () => {
  for (const host of ["localhost:3000", "127.0.0.1:3000", "[::1]:3000"]) {
    expect(getJudgeAccess(new Request("http://localhost:3000/", { headers: { host } }), undefined, {})).toEqual({ mode: "local" });
  }
  expect(getJudgeAccess(new Request("https://outside.example/"), undefined, {})).toEqual({ mode: "unavailable" });
  expect(getJudgeAccess(new Request("http://localhost:3000/", { headers: { host: "outside.example" } }), undefined, {})).toEqual({ mode: "unavailable" });
  expect(getJudgeAccess(new Request("https://outside.example/", { headers: { host: "127.0.0.1:3000" } }), undefined, {})).toEqual({ mode: "local" });
});

test("standalone trusts only a canonical loopback Host, falling back to the URL only when absent", () => {
  for (const host of ["127.0.0.1:3010", "localhost:3010", "[::1]:3010"]) {
    const request = new Request("http://0.0.0.0:3000/api/ask", { headers: { host } });
    expect(getJudgeAccess(request, undefined, {})).toEqual({ mode: "local" });
    expect(getJudgeAccess(request, undefined, { JUDGE_ACCESS_REQUIRED: "1" })).toEqual({ mode: "unavailable" });
  }
  for (const host of ["evil.example:3010", "127.0.0.1.evil.example:3010", "127.1:3010", "LOCALHOST:3010", "user@localhost:3010", "localhost:3010/path", "localhost:3010?x=y", "localhost:3010#x", "localhost:bad", ""]) {
    const request = new Request("http://127.0.0.1:3000/", { headers: { host, "x-forwarded-host": "127.0.0.1:3010" } });
    expect(getJudgeAccess(request, undefined, {})).toEqual({ mode: "unavailable" });
  }
  expect(getJudgeAccess(new Request("http://127.0.0.1:3010/"), undefined, {})).toEqual({ mode: "local" });
  expect(getJudgeAccess(new Request("http://0.0.0.0:3000/"), undefined, {})).toEqual({ mode: "unavailable" });
});

test("standalone forwarded local requests reach origin validation rather than setup failure", async () => {
  for (const key of Object.keys(env)) vi.stubEnv(key, "");
  const request = (origin?: string) => new Request("http://0.0.0.0:3000/api/access", {
    method: "POST",
    headers: { host: "127.0.0.1:3010", "content-type": "application/json", ...(origin ? { origin } : {}) },
    body: JSON.stringify({ code: "local-fixture" }),
  });
  expect((await POST(request("http://127.0.0.1:3010"))).status).toBe(200);
  for (const origin of ["https://evil.example", undefined]) {
    const response = await POST(request(origin));
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: { stage: "access", code: "origin" } });
  }
});

test("required, partial, weak, and noncanonical configuration fails closed even for loopback", () => {
  const request = new Request(config.origin + "/");
  const invalidEnvironments = [
    { JUDGE_ACCESS_REQUIRED: "1" }, { PUBLIC_APP_ORIGIN: config.origin },
    { ...env, JUDGE_ACCESS_CODE: "" }, { ...env, JUDGE_SESSION_SECRET: "" },
    { ...env, JUDGE_ACCESS_CODE: "a".repeat(32) }, { ...env, JUDGE_SESSION_SECRET: "short" },
    { ...env, JUDGE_SESSION_SECRET: config.code }, { ...env, JUDGE_ACCESS_REQUIRED: "0" },
    ...["http://judges.example", config.origin + "/", config.origin + "/path", config.origin + "?x=y", config.origin + "#x", "https://user@judges.example"].map(origin => ({ ...env, PUBLIC_APP_ORIGIN: origin })),
  ];
  for (const invalid of invalidEnvironments) expect(getJudgeAccess(request, undefined, invalid)).toEqual({ mode: "unavailable" });
  expect(getJudgeAccess(new Request("http://localhost:3000/"), createJudgeSession(config, now), { JUDGE_ACCESS_REQUIRED: "1" })).toEqual({ mode: "unavailable" });
});

test("host spoofing never bypasses a required gate, even with a valid cookie", () => {
  const cookie = createJudgeSession(config, now);
  for (const host of ["127.0.0.1:3000", "localhost", "evil.example"]) {
    const request = new Request(config.origin, { headers: { host, "x-forwarded-host": "judges.example", "x-forwarded-proto": "https" } });
    expect(getJudgeAccess(request, cookie, env, now)).toEqual({ mode: "unavailable" });
  }
  expect(getJudgeAccess(new Request("http://internal:3000/", { headers: { host: "judges.example" } }), cookie, env, now)).toMatchObject({ mode: "hosted", authenticated: true });
  expect(getJudgeAccess(new Request(config.origin), undefined, env, now)).toMatchObject({ mode: "hosted", authenticated: false });
});

test("private HTML, RSC, and APIs stop before rendering; redirects carry no private query or destination", () => {
  for (const path of ["/", "/watch/example", "/watch/example.svg", "/_next/image?url=%2Fprivate"]) {
    const response = proxy(new NextRequest(config.origin + path + (path.includes("?") ? "&" : "?") + "lang=es&code=do-not-echo&next=https://evil.example&profile=private", { headers: { RSC: "1" } }));
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(config.origin + "/login?lang=es");
    expect(response.headers.get("cache-control")).toContain("private, no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  }
  for (const path of ["/api/ask", "/api/search", "/api/rum-config", "/api/access/child", "/api/healthz"]) {
    expect(proxy(new NextRequest(config.origin + path)).status).toBe(401);
  }
  expect(proxy(new NextRequest(config.origin + "/api/health", { method: "POST" })).status).toBe(401);
  const cookie = createJudgeSession(config, now);
  const accepted = proxy(new NextRequest(config.origin + "/watch/example", { headers: { cookie: JUDGE_COOKIE + "=" + cookie } }));
  expect(accepted.headers.get("x-middleware-next")).toBe("1");
  expect(accepted.headers.get("cache-control")).toContain("no-store");
});

test("public exceptions remain narrow, and missing hosted configuration returns unavailable", () => {
  vi.stubEnv("JUDGE_ACCESS_CODE", "");
  for (const path of ["/api/health", "/favicon.ico", "/_next/static/chunks/test.js"]) {
    expect(proxy(new NextRequest(config.origin + path)).headers.get("x-middleware-next")).toBe("1");
  }
  for (const path of ["/", "/login?lang=es", "/api/ask", "/api/access"]) expect(proxy(new NextRequest(config.origin + path)).status).toBe(503);
  vi.stubEnv("JUDGE_ACCESS_CODE", config.code);
  const login = proxy(new NextRequest(config.origin + "/login?lang=es"));
  expect(login.headers.get("x-middleware-next")).toBe("1");
  expect(login.headers.get("content-security-policy")).toContain("connect-src 'self'");
  expect(proxy(new NextRequest(config.origin + "/login?lang=es&code=never-reflect")).headers.get("location")).toBe(config.origin + "/login?lang=es");
});

test("login rejects foreign origins, oversized bodies and wrong passcodes; success sets a secure bounded cookie", async () => {
  const loginRequest = (body: string, origin: string | undefined = config.origin) => new Request(config.origin + "/api/access", {
    method: "POST", headers: { "Content-Type": "application/json", ...(origin ? { origin } : {}) }, body,
  });
  for (const origin of ["https://evil.example", ""]) expect((await POST(loginRequest(JSON.stringify({ code: config.code }), origin))).status).toBe(403);
  const oversized = await POST(loginRequest(JSON.stringify({ code: "x".repeat(4096) })));
  expect(oversized.status).toBe(413);
  const rejected = await POST(loginRequest(JSON.stringify({ code: "not-the-passcode" })));
  expect(rejected.status).toBe(401);
  expect(await rejected.text()).not.toContain("not-the-passcode");
  expect((await POST(loginRequest("not json"))).status).toBe(400);
  const response = await POST(loginRequest(JSON.stringify({ code: config.code })));
  expect(response.status).toBe(200);
  const setCookie = response.headers.get("set-cookie")!;
  expect(setCookie).toContain(JUDGE_COOKIE + "=");
  for (const flag of ["HttpOnly", "Secure", "SameSite=lax", "Path=/", "Max-Age=" + JUDGE_SESSION_SECONDS]) expect(setCookie).toContain(flag);
  expect(setCookie).not.toContain("Domain=");
  expect(setCookie).not.toContain(config.code);
  expect(validJudgeSession(setCookie.split(";")[0].split("=")[1], config, now)).toBe(true);
  expect(response.headers.get("cache-control")).toContain("private, no-store");
  expect(await response.text()).not.toContain(config.code);
});

test("one-pod attempt admission is bounded and recovers at the next window", async () => {
  for (let i = 0; i < ACCESS_ATTEMPTS_PER_MINUTE; i++) expect(admitAccessAttempt(now)).toBe(true);
  expect(admitAccessAttempt(now)).toBe(false);
  const response = await POST(new Request(config.origin + "/api/access", {
    method: "POST", headers: { origin: config.origin, "content-type": "application/json" }, body: JSON.stringify({ code: config.code }),
  }));
  expect(response.status).toBe(429);
  expect(response.headers.get("retry-after")).toBe("60");
  expect(admitAccessAttempt(now + 60_000)).toBe(true);
});
