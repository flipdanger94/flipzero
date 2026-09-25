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


export const ORIGIN_EXEMPT_MUTATION_ROUTES = ["/api/livekit/webhook"] as const;

export function isOriginExemptMutationRoute(pathname: string) {
  return ORIGIN_EXEMPT_MUTATION_ROUTES.includes(pathname as (typeof ORIGIN_EXEMPT_MUTATION_ROUTES)[number]);
}
