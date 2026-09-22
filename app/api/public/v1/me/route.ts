import { NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/api-auth";

export async function GET(request: Request) {
  const auth = await authenticateApiRequest(request);
  if (!auth) return NextResponse.json({ error: { code: "INVALID_TOKEN", message: "Передайте действующий Bearer token." } }, { status: 401 });
  if (!auth.scopes.includes("profile:read") && !auth.scopes.includes("identify")) return NextResponse.json({ error: { code: "MISSING_SCOPE", message: "Требуется scope identify или profile:read." } }, { status: 403 });
  return NextResponse.json({ application: { id: auth.appId, name: auth.appName }, owner: { id: auth.ownerId, username: auth.username, displayName: auth.displayName }, scopes: auth.scopes });
}
