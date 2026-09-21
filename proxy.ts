import { type NextRequest, NextResponse } from "next/server";
const SESSION_COOKIE = "flipzero_session";

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/") && !["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    const fetchSite = request.headers.get("sec-fetch-site");
    const origin = request.headers.get("origin");
    const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
    const expectedHost = forwardedHost || request.nextUrl.host;
    let trusted = fetchSite !== "cross-site";
    if (origin) {
      try { trusted = trusted && new URL(origin).host === expectedHost; }
      catch { trusted = false; }
    }
    if (!trusted) return NextResponse.json({ code: "UNTRUSTED_ORIGIN", message: "Запрос отклонён." }, { status: 403 });
  }
  if (!request.nextUrl.pathname.startsWith("/app") && !request.nextUrl.pathname.startsWith("/channels/")) return NextResponse.next();
  if (!request.cookies.has(SESSION_COOKIE)) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/app", "/channels/:path*", "/api/:path*"] };
