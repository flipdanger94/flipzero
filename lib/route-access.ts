export const PROTECTED_ROUTE_PREFIXES = [
  "/app",
  "/channels",
  "/communities",
  "/invite",
  "/setup",
  "/oauth",
] as const;

export function isProtectedRoute(pathname: string) {
  return PROTECTED_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function loginPathFor(pathname: string, search = "") {
  const destination = `${pathname}${search}`;
  return `/login?next=${encodeURIComponent(destination)}`;
}
