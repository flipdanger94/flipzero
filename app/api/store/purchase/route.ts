import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isTrustedMutationRequest } from "@/lib/security-controls";
import { purchaseStoreItem, StoreActionError } from "@/lib/store";

export async function POST(request: Request) {
  if (!isTrustedMutationRequest(request)) return NextResponse.json({ code: "FORBIDDEN", message: "Запрос отклонён." }, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ code: "UNAUTHENTICATED", message: "Требуется вход." }, { status: 401 });
  const body = await request.json().catch(() => null);
  const itemId = typeof body?.itemId === "string" ? body.itemId.trim() : "";
  if (!itemId) return NextResponse.json({ code: "INVALID_ITEM", message: "Предмет не указан." }, { status: 400 });
  try {
    return NextResponse.json({ ok: true, inventory: await purchaseStoreItem(user.id, itemId) });
  } catch (error) {
    if (error instanceof StoreActionError) return NextResponse.json({ code: error.code, message: error.message }, { status: error.status });
    throw error;
  }
}
