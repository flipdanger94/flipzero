import { type NextRequest, NextResponse } from "next/server";
const SESSION_COOKIE = "flipzero_session";

export function proxy(request: NextRequest) {
  if (!request.cookies.has(SESSION_COOKIE)) return NextResponse.redirect(new URL("/login", request.url));
  return NextResponse.next();
}

export const config = { matcher: ["/app", "/channels/:path*"] };
