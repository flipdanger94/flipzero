import { createHash, randomBytes, randomUUID } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { developerWebhookDeliveries, developerWebhooks } from "@/db/developer-schema";
import { developerApps } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { encryptDeveloperSecret } from "@/lib/developer-secret";
import { testDeveloperWebhook } from "@/lib/developer-webhooks";
import { normalizeWebhookEvents, validateWebhookUrl } from "@/lib/developer-validation";

async function requireOwnedApp(appId: string | null) {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ code: "UNAUTHENTICATED", message: "Требуется вход." }, { status: 401 }) } as const;
  if (!appId) return { error: NextResponse.json({ code: "INVALID_INPUT", message: "Приложение не выбрано." }, { status: 400 }) } as const;
  const database = getDatabase();
  const [app] = await database.select({ id: developerApps.id }).from(developerApps)
    .where(and(eq(developerApps.id, appId), eq(developerApps.ownerId, user.id))).limit(1);
  if (!app) return { error: NextResponse.json({ code: "NOT_FOUND", message: "Приложение не найдено." }, { status: 404 }) } as const;
  return { user, database, app } as const;
}

function createSecret() {
  const secret = `fz_whsec_${randomBytes(32).toString("base64url")}`;
  return { secret, hash: createHash("sha256").update(secret).digest("hex"), prefix: `${secret.slice(0, 18)}…` };
}

async function findOwnedWebhook(database: ReturnType<typeof getDatabase>, appId: string, webhookId: string) {
  const [webhook] = await database.select({ id: developerWebhooks.id }).from(developerWebhooks)
    .where(and(eq(developerWebhooks.id, webhookId), eq(developerWebhooks.appId, appId))).limit(1);
  return webhook ?? null;
}

export async function GET(request: Request) {
  const appId = new URL(request.url).searchParams.get("appId");
  const access = await requireOwnedApp(appId);
  if ("error" in access) return access.error;
  const webhooks = await access.database.select({
    id: developerWebhooks.id,
    appId: developerWebhooks.appId,
    name: developerWebhooks.name,
    url: developerWebhooks.url,
    eventTypes: developerWebhooks.eventTypes,
    secretPrefix: developerWebhooks.secretPrefix,
    enabled: developerWebhooks.enabled,
    createdAt: developerWebhooks.createdAt,
    updatedAt: developerWebhooks.updatedAt,
  }).from(developerWebhooks).where(eq(developerWebhooks.appId, access.app.id)).orderBy(desc(developerWebhooks.createdAt));
  const deliveries = webhooks.length ? await access.database.select({
    id: developerWebhookDeliveries.id,
    webhookId: developerWebhookDeliveries.webhookId,
    eventId: developerWebhookDeliveries.eventId,
    eventType: developerWebhookDeliveries.eventType,
    status: developerWebhookDeliveries.status,
    responseStatus: developerWebhookDeliveries.responseStatus,
    durationMs: developerWebhookDeliveries.durationMs,
    error: developerWebhookDeliveries.error,
    createdAt: developerWebhookDeliveries.createdAt,
    completedAt: developerWebhookDeliveries.completedAt,
  }).from(developerWebhookDeliveries)
    .innerJoin(developerWebhooks, eq(developerWebhooks.id, developerWebhookDeliveries.webhookId))
    .where(eq(developerWebhooks.appId, access.app.id))
    .orderBy(desc(developerWebhookDeliveries.createdAt))
    .limit(100) : [];
  return NextResponse.json({ webhooks: webhooks.map((webhook) => ({ ...webhook, deliveries: deliveries.filter((delivery) => delivery.webhookId === webhook.id).slice(0, 5) })) });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const appId = typeof body?.appId === "string" ? body.appId : null;
  const access = await requireOwnedApp(appId);
  if ("error" in access) return access.error;

  if (body?.action === "test_delivery") {
    if (typeof body.webhookId !== "string") return NextResponse.json({ code: "INVALID_INPUT", message: "Webhook не выбран." }, { status: 400 });
    const webhook = await findOwnedWebhook(access.database, access.app.id, body.webhookId);
    if (!webhook) return NextResponse.json({ code: "NOT_FOUND", message: "Webhook не найден." }, { status: 404 });
    const result = await testDeveloperWebhook(webhook.id);
    return NextResponse.json({ delivered: result.ok, message: result.ok ? "Тестовый webhook доставлен." : "Endpoint не подтвердил доставку." });
  }

  if (body?.action === "regenerate_secret") {
    if (typeof body.webhookId !== "string") return NextResponse.json({ code: "INVALID_INPUT", message: "Webhook не выбран." }, { status: 400 });
    const webhook = await findOwnedWebhook(access.database, access.app.id, body.webhookId);
    if (!webhook) return NextResponse.json({ code: "NOT_FOUND", message: "Webhook не найден." }, { status: 404 });
    const generated = createSecret();
    const [updated] = await access.database.update(developerWebhooks).set({ secretHash: generated.hash, secretCiphertext: encryptDeveloperSecret(generated.secret), secretPrefix: generated.prefix, updatedAt: new Date() })
      .where(eq(developerWebhooks.id, webhook.id)).returning({ id: developerWebhooks.id, secretPrefix: developerWebhooks.secretPrefix, updatedAt: developerWebhooks.updatedAt });
    return NextResponse.json({ webhook: updated, secret: generated.secret });
  }

  const [{ count }] = await access.database.select({ count: sql<number>`count(*)::int` }).from(developerWebhooks).where(eq(developerWebhooks.appId, access.app.id));
  if (count >= 10) return NextResponse.json({ code: "WEBHOOK_LIMIT", message: "Для одного приложения доступно не более 10 webhook." }, { status: 409 });

  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 60) : "";
  if (name.length < 2) return NextResponse.json({ code: "INVALID_INPUT", message: "Укажите название webhook." }, { status: 400 });
  const url = validateWebhookUrl(body?.url);
  if (!url.ok) return NextResponse.json({ code: "INVALID_INPUT", message: url.message }, { status: 400 });
  const eventTypes = normalizeWebhookEvents(body?.eventTypes);
  if (!eventTypes.length) return NextResponse.json({ code: "INVALID_INPUT", message: "Выберите хотя бы одно событие." }, { status: 400 });

  const generated = createSecret();
  const [webhook] = await access.database.insert(developerWebhooks).values({
    id: randomUUID(),
    appId: access.app.id,
    name,
    url: url.value,
    eventTypes,
    secretHash: generated.hash,
    secretCiphertext: encryptDeveloperSecret(generated.secret),
    secretPrefix: generated.prefix,
  }).returning({
    id: developerWebhooks.id,
    appId: developerWebhooks.appId,
    name: developerWebhooks.name,
    url: developerWebhooks.url,
    eventTypes: developerWebhooks.eventTypes,
    secretPrefix: developerWebhooks.secretPrefix,
    enabled: developerWebhooks.enabled,
    createdAt: developerWebhooks.createdAt,
    updatedAt: developerWebhooks.updatedAt,
  });
  return NextResponse.json({ webhook, secret: generated.secret }, { status: 201 });
}

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null);
  const appId = typeof body?.appId === "string" ? body.appId : null;
  const access = await requireOwnedApp(appId);
  if ("error" in access) return access.error;
  if (typeof body?.webhookId !== "string") return NextResponse.json({ code: "INVALID_INPUT", message: "Webhook не выбран." }, { status: 400 });
  const webhook = await findOwnedWebhook(access.database, access.app.id, body.webhookId);
  if (!webhook) return NextResponse.json({ code: "NOT_FOUND", message: "Webhook не найден." }, { status: 404 });

  const updates: Partial<typeof developerWebhooks.$inferInsert> = { updatedAt: new Date() };
  if (typeof body.name === "string") {
    const name = body.name.trim().slice(0, 60);
    if (name.length < 2) return NextResponse.json({ code: "INVALID_INPUT", message: "Название слишком короткое." }, { status: 400 });
    updates.name = name;
  }
  if (body.url !== undefined) {
    const url = validateWebhookUrl(body.url);
    if (!url.ok) return NextResponse.json({ code: "INVALID_INPUT", message: url.message }, { status: 400 });
    updates.url = url.value;
  }
  if (body.eventTypes !== undefined) {
    const eventTypes = normalizeWebhookEvents(body.eventTypes);
    if (!eventTypes.length) return NextResponse.json({ code: "INVALID_INPUT", message: "Выберите хотя бы одно событие." }, { status: 400 });
    updates.eventTypes = eventTypes;
  }
  if (typeof body.enabled === "boolean") updates.enabled = body.enabled;

  const [updated] = await access.database.update(developerWebhooks).set(updates).where(eq(developerWebhooks.id, webhook.id)).returning({
    id: developerWebhooks.id,
    appId: developerWebhooks.appId,
    name: developerWebhooks.name,
    url: developerWebhooks.url,
    eventTypes: developerWebhooks.eventTypes,
    secretPrefix: developerWebhooks.secretPrefix,
    enabled: developerWebhooks.enabled,
    createdAt: developerWebhooks.createdAt,
    updatedAt: developerWebhooks.updatedAt,
  });
  return NextResponse.json({ webhook: updated });
}

export async function DELETE(request: Request) {
  const params = new URL(request.url).searchParams;
  const access = await requireOwnedApp(params.get("appId"));
  if ("error" in access) return access.error;
  const webhookId = params.get("webhookId");
  if (!webhookId) return NextResponse.json({ code: "INVALID_INPUT", message: "Webhook не выбран." }, { status: 400 });
  const webhook = await findOwnedWebhook(access.database, access.app.id, webhookId);
  if (!webhook) return NextResponse.json({ code: "NOT_FOUND", message: "Webhook не найден." }, { status: 404 });
  await access.database.delete(developerWebhooks).where(eq(developerWebhooks.id, webhook.id));
  return NextResponse.json({ ok: true });
}
