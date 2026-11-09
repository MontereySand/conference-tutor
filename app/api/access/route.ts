import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, HttpError, parseJson, requireSameOrigin } from "../../../lib/http";
import { admitAccessAttempt, createJudgeSession, getJudgeAccess, JUDGE_COOKIE, JUDGE_SESSION_SECONDS, matchesJudgeCode, PRIVATE_HEADERS } from "../../../lib/judge-access";

const Login = z.object({ code: z.string().min(1).max(256) }).strict();

export async function POST(request: Request) {
  try {
    const access = getJudgeAccess(request);
    if (access.mode === "unavailable") throw new HttpError(503, "setup");
    requireSameOrigin(request);
    if (new URL(request.url).search) throw new HttpError(400, "invalid");
    if (!admitAccessAttempt()) throw new HttpError(429, "rate");
    if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") throw new HttpError(415, "invalid");
    const { code } = await parseJson(request, Login, 4096);
    if (access.mode === "local") return NextResponse.json({ ok: true }, { headers: PRIVATE_HEADERS });
    if (!matchesJudgeCode(code, access.code)) throw new HttpError(401, "passcode");
    const now = Date.now();
    const response = NextResponse.json({ ok: true }, { headers: PRIVATE_HEADERS });
    response.cookies.set(JUDGE_COOKIE, createJudgeSession(access, now), {
      httpOnly: true, secure: true, sameSite: "lax", path: "/",
      maxAge: JUDGE_SESSION_SECONDS, expires: new Date(now + JUDGE_SESSION_SECONDS * 1000),
    });
    return response;
  } catch (error) {
    const response = apiError(error, "access");
    for (const [key, value] of Object.entries(PRIVATE_HEADERS)) response.headers.set(key, value);
    if (response.status === 429) response.headers.set("Retry-After", "60");
    return response;
  }
}
