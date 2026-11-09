import { NextResponse, type NextRequest } from "next/server";
import { getJudgeAccess, JUDGE_COOKIE, PRIVATE_HEADERS } from "./lib/judge-access";
import { parseLang, t } from "./lib/i18n";

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const read = request.method === "GET" || request.method === "HEAD";
  if (read && (path === "/api/health" || path === "/favicon.ico" || path.startsWith("/_next/static/"))) return NextResponse.next();

  const access = getJudgeAccess(request, request.cookies.get(JUDGE_COOKIE)?.value);
  let response: NextResponse;
  if (access.mode === "unavailable") {
    response = path.startsWith("/api/")
      ? NextResponse.json({ error: { stage: "access", code: "setup" } }, { status: 503 })
      : new NextResponse(t(parseLang(request.nextUrl.searchParams.get("lang"))).loginUnavailable, { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  } else if (path === "/login" && read) {
    const lang = parseLang(request.nextUrl.searchParams.get("lang"));
    const canonical = new URL("/login?lang=" + lang, access.mode === "hosted" ? access.origin : request.url);
    if (access.mode === "local" || access.authenticated) {
      response = NextResponse.redirect(new URL("/?lang=" + lang, access.mode === "hosted" ? access.origin : request.url), 303);
    } else if (request.nextUrl.search !== canonical.search) {
      response = NextResponse.redirect(canonical, 303);
    } else {
      response = NextResponse.next();
    }
    // Do not allow telemetry exports or third-party embeds from the passcode surface.
    response.headers.set("Content-Security-Policy", "connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'self'");
  } else if (path === "/api/access" && request.method === "POST") {
    response = NextResponse.next();
  } else if (access.mode === "local" || access.authenticated) {
    response = NextResponse.next();
  } else if (path.startsWith("/api/") || !read) {
    response = NextResponse.json({ error: { stage: "access", code: "unauthenticated" } }, { status: 401 });
  } else {
    response = NextResponse.redirect(new URL("/login?lang=" + parseLang(request.nextUrl.searchParams.get("lang")), access.origin), 303);
  }
  for (const [key, value] of Object.entries(PRIVATE_HEADERS)) response.headers.set(key, value);
  return response;
}
