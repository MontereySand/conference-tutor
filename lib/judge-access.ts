import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const JUDGE_COOKIE = "__Host-ct-judge";
export const JUDGE_SESSION_SECONDS = 8 * 60 * 60;
export const ACCESS_ATTEMPTS_PER_MINUTE = 20;
export const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
};

type HostedAccess = { mode: "hosted"; origin: string; code: string; secret: string };
type Access = { mode: "local" } | { mode: "unavailable" } | (HostedAccess & { authenticated: boolean });
type AccessEnvironment = Record<string, string | undefined>;

function loopback(host: string): boolean {
  try {
    const url = new URL("http://" + host);
    return url.host === host && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  } catch { return false; }
}

function strongSecret(value: string, minLength: number): boolean {
  return value.length >= minLength && value.length <= 256 && /^[A-Za-z0-9_-]+$/.test(value) && new Set(value).size >= 8;
}

/** No Host or forwarded header can disable a configured/required gate. */
export function getJudgeAccess(request: Request, cookie?: string, env: AccessEnvironment = process.env, now = Date.now()): Access {
  const required = env.JUDGE_ACCESS_REQUIRED ?? "";
  const code = env.JUDGE_ACCESS_CODE ?? "";
  const secret = env.JUDGE_SESSION_SECRET ?? "";
  const origin = env.PUBLIC_APP_ORIGIN ?? "";
  const url = new URL(request.url);
  const host = request.headers.get("host") ?? url.host;
  if (![required, code, secret, origin].some(Boolean)) {
    // Standalone may use 0.0.0.0 internally; validate the browser-facing Host instead.
    return { mode: loopback(host) ? "local" : "unavailable" };
  }
  try {
    const canonical = new URL(origin);
    if ((required && required !== "1") || canonical.protocol !== "https:" || canonical.origin !== origin ||
        canonical.username || canonical.password || canonical.host !== host ||
        !strongSecret(code, 16) || !strongSecret(secret, 32) || code === secret) return { mode: "unavailable" };
  } catch { return { mode: "unavailable" }; }
  const config: HostedAccess = { mode: "hosted", origin, code, secret };
  return { ...config, authenticated: validJudgeSession(cookie, config, now) };
}

export function matchesJudgeCode(candidate: string, expected: string): boolean {
  return timingSafeEqual(createHash("sha256").update(candidate).digest(), createHash("sha256").update(expected).digest());
}

function signature(payload: string, config: HostedAccess): Buffer {
  // Bind sessions to the origin and current passcode so either rotation revokes them.
  return createHmac("sha256", config.secret).update("ct-judge-session\0" + config.origin + "\0" + config.code + "\0" + payload).digest();
}

export function createJudgeSession(config: HostedAccess, now = Date.now()): string {
  const issued = Math.floor(now / 1000);
  const payload = `v1.${issued}.${issued + JUDGE_SESSION_SECONDS}`;
  return payload + "." + signature(payload, config).toString("base64url");
}

export function validJudgeSession(cookie: string | undefined, config: HostedAccess, now = Date.now()): boolean {
  if (!cookie || cookie.length > 128) return false;
  const match = /^(v1\.(\d{1,12})\.(\d{1,12}))\.([A-Za-z0-9_-]{43})$/.exec(cookie);
  if (!match) return false;
  const actual = Buffer.from(match[4], "base64url");
  const expected = signature(match[1], config);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected) || actual.toString("base64url") !== match[4]) return false;
  const issued = Number(match[2]), expires = Number(match[3]), seconds = Math.floor(now / 1000);
  return expires - issued === JUDGE_SESSION_SECONDS && issued <= seconds && expires > seconds;
}

// shortcut: one shared process window; use an ingress/distributed limiter before adding pods.
let attemptWindow = { start: 0, count: 0 };
export function admitAccessAttempt(now = Date.now()): boolean {
  if (now - attemptWindow.start >= 60_000 || now < attemptWindow.start) attemptWindow = { start: now, count: 0 };
  if (attemptWindow.count >= ACCESS_ATTEMPTS_PER_MINUTE) return false;
  attemptWindow.count++;
  return true;
}
