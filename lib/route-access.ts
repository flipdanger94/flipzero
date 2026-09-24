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


export const MUTATION_ORIGIN_EXEMPT_PATHS = ["/api/livekit/webhook"] as const;

export function isMutationOriginExempt(pathname: string) {
  return MUTATION_ORIGIN_EXEMPT_PATHS.includes(pathname as (typeof MUTATION_ORIGIN_EXEMPT_PATHS)[number]);
}
