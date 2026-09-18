import { asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { members, spaces } from "@/db/schema";
import { authenticateApiRequest } from "@/lib/api-auth";

export async function GET(request: Request) {
  const auth = await authenticateApiRequest(request);
  if (!auth) return NextResponse.json({ error: { code: "INVALID_TOKEN", message: "Передайте действующий Bearer token." } }, { status: 401 });
  if (!auth.scopes.includes("spaces:read")) return NextResponse.json({ error: { code: "MISSING_SCOPE", message: "Требуется scope spaces:read." } }, { status: 403 });
  const items = await getDatabase().select({ id: spaces.id, name: spaces.name, slug: spaces.slug, description: spaces.description, visibility: spaces.visibility, accentColor: spaces.accentColor }).from(members).innerJoin(spaces, eq(spaces.id, members.spaceId)).where(eq(members.userId, auth.ownerId)).orderBy(asc(members.joinedAt));
  return NextResponse.json({ data: items, meta: { count: items.length } });
}
