export function hasAdminRole(user: { platformRole?: string } | null) {
  return user?.platformRole === "admin";
}
