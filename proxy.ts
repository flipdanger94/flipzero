import { type NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth-constants";
import { isProtectedRoute, loginPathFor } from "@/lib/route-access";

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/") && !["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    const fetchSite = request.headers.get("sec-fetch-site");
    const origin = request.headers.get("origin");

    // Browser-confirmed same-origin requests are authoritative here. Reverse
    // proxies such as GitHub Codespaces can rewrite Host/request.nextUrl to an
    // internal address even though the browser request is genuinely same-origin.
    let trusted = fetchSite === "same-origin";

    if (!trusted) {
      trusted = fetchSite !== "cross-site";
      if (origin) {
        const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
        const host = request.headers.get("host")?.trim();
        const expectedHosts = new Set(
          [forwardedHost, host, request.nextUrl.host].filter((value): value is string => Boolean(value)),
        );
        try { trusted = trusted && expectedHosts.has(new URL(origin).host); }
        catch { trusted = false; }
      }
    }

    if (!trusted) return NextResponse.json({ code: "UNTRUSTED_ORIGIN", message: "Запрос отклонён." }, { status: 403 });
  }

  if (!isProtectedRoute(request.nextUrl.pathname)) return NextResponse.next();
  if (request.cookies.get(SESSION_COOKIE)?.value) return NextResponse.next();

  return NextResponse.redirect(
    new URL(
      loginPathFor(request.nextUrl.pathname, request.nextUrl.search),
      request.url,
    ),
  );
}

export const config = {
  matcher: [
    "/app/:path*",
    "/channels/:path*",
    "/communities/:path*",
    "/invite/:path*",
    "/setup/:path*",
    "/oauth/:path*",
    "/api/:path*",
  ],
};
