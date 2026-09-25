import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isTrustedMutationRequest } from "@/lib/security-controls";
import {
  equipInventoryItem,
  getInventorySnapshot,
  getStoreSnapshot,
  purchaseStoreItem,
  StoreActionError,
} from "@/lib/store";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: "Требуется вход." }, { status: 401 });
  const [store, inventory] = await Promise.all([
    getStoreSnapshot(user.id, { limit: 100 }),
    getInventorySnapshot(user.id),
  ]);
  return NextResponse.json({
    items: store.items.map((item) => ({
      ...item,
      price: item.priceOrbs,
      preview: item.preview,
    })),
    inventory: inventory.items.map((item) => ({ itemId: item.id, acquiredAt: item.acquiredAt, source: item.source })),
    equipped: Object.entries(inventory.equipped).map(([slot, itemId]) => ({ slot, category: slot, itemId })),
    balance: store.balance,
    superflipActive: store.superflipActive,
  });
}

export async function POST(request: Request) {
  if (!isTrustedMutationRequest(request)) return NextResponse.json({ message: "Запрос отклонён." }, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: "Требуется вход." }, { status: 401 });
  const body = await request.json().catch(() => null);
  const itemId = typeof body?.itemId === "string" ? body.itemId.trim() : "";
  if (!itemId || !["purchase", "equip"].includes(body?.action)) return NextResponse.json({ message: "Некорректный запрос." }, { status: 400 });
  try {
    const inventory = body.action === "purchase"
      ? await purchaseStoreItem(user.id, itemId)
      : await equipInventoryItem(user.id, itemId);
    return NextResponse.json({ ok: true, inventory });
  } catch (error) {
    if (error instanceof StoreActionError) return NextResponse.json({ code: error.code, message: error.message }, { status: error.status });
    throw error;
  }
}
