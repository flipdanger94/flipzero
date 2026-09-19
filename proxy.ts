import { type NextRequest, NextResponse } from "next/server";
const SESSION_COOKIE = "flipzero_session";

export function proxy(request: NextRequest) {
  if (!request.cookies.has(SESSION_COOKIE)) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/app", "/channels/:path*"] };
