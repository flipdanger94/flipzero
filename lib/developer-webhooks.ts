import "server-only";
import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { getDatabase } from "@/db/client";
import { developerAppInstallations, developerWebhookDeliveries, developerWebhooks } from "@/db/developer-schema";
import { developerApps } from "@/db/schema";
import { decryptDeveloperSecret, signDeveloperPayload } from "@/lib/developer-secret";

export type DeveloperWebhookEvent = "message.created" | "member.joined" | "member.left" | "space.updated";
type DeliverableEvent = DeveloperWebhookEvent | "webhook.test";
type Endpoint = { id: string; url: string; secretCiphertext: string };

export function isPrivateWebhookIp(address: string) {
  if (isIP(address) === 4) {
    const octets = address.split(".").map(Number);
    const [a, b] = octets;
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
  }
  const normalized = address.toLowerCase();
  if (normalized === "::1" || normalized === "::") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb")) return true;
  if (normalized.startsWith("::ffff:")) {
    const mapped = normalized.slice(7);
    return isIP(mapped) === 4 ? isPrivateWebhookIp(mapped) : true;
  }
  return false;
}

async function assertPublicWebhookTarget(rawUrl: string) {
  const url = new URL(rawUrl);
  const addresses = await lookup(url.hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(({ address }) => isPrivateWebhookIp(address))) {
    throw new Error("Webhook target resolved to a private or reserved address");
  }
}

async function deliverEndpoint(endpoint: Endpoint, event: DeliverableEvent, data: Record<string, unknown>, eventId = randomUUID()) {
  const database = getDatabase();
  const deliveryId = randomUUID();
  const startedAt = Date.now();
  await database.insert(developerWebhookDeliveries).values({
    id: deliveryId,
    webhookId: endpoint.id,
    eventId,
    eventType: event,
    status: "pending",
  });

  try {
    await assertPublicWebhookTarget(endpoint.url);
    const envelope = { id: eventId, event, createdAt: new Date().toISOString(), data };
    const payload = JSON.stringify(envelope);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const secret = decryptDeveloperSecret(endpoint.secretCiphertext);
    const signature = signDeveloperPayload(secret, `${timestamp}.${payload}`);
    const response = await fetch(endpoint.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": "FlipZero-Webhooks/1.0",
        "x-flipzero-event": event,
        "x-flipzero-delivery": eventId,
        "x-flipzero-timestamp": timestamp,
        "x-flipzero-signature": `sha256=${signature}`,
      },
      body: payload,
      signal: AbortSignal.timeout(5_000),
    });

    const durationMs = Date.now() - startedAt;
    await database.update(developerWebhookDeliveries).set({
      status: response.ok ? "delivered" : "failed",
      responseStatus: response.status,
      durationMs,
      error: response.ok ? null : `Endpoint returned HTTP ${response.status}`,
      completedAt: new Date(),
    }).where(eq(developerWebhookDeliveries.id, deliveryId));
    return response.ok;
  } catch (error) {
    await database.update(developerWebhookDeliveries).set({
      status: "failed",
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message.slice(0, 1000) : "Unknown webhook delivery error",
      completedAt: new Date(),
    }).where(eq(developerWebhookDeliveries.id, deliveryId));
    return false;
  }
}

export async function testDeveloperWebhook(webhookId: string) {
  const database = getDatabase();
  const [endpoint] = await database.select({
    id: developerWebhooks.id,
    url: developerWebhooks.url,
    secretCiphertext: developerWebhooks.secretCiphertext,
  }).from(developerWebhooks).where(eq(developerWebhooks.id, webhookId)).limit(1);
  if (!endpoint) return { ok: false, reason: "not_found" as const };

  const ok = await deliverEndpoint(endpoint, "webhook.test", {
    message: "FlipZero test delivery",
    webhookId,
  });
  return { ok };
}

export async function dispatchDeveloperEvent(spaceId: string, event: DeveloperWebhookEvent, data: Record<string, unknown>) {
  const database = getDatabase();
  const endpoints = await database
    .select({
      id: developerWebhooks.id,
      url: developerWebhooks.url,
      eventTypes: developerWebhooks.eventTypes,
      secretCiphertext: developerWebhooks.secretCiphertext,
    })
    .from(developerWebhooks)
    .innerJoin(developerApps, eq(developerApps.id, developerWebhooks.appId))
    .innerJoin(developerAppInstallations, eq(developerAppInstallations.appId, developerApps.id))
    .where(and(
      eq(developerAppInstallations.spaceId, spaceId),
      eq(developerWebhooks.enabled, true),
    ));

  const matching = endpoints.filter((endpoint) => endpoint.eventTypes.includes(event));
  if (!matching.length) return { attempted: 0, delivered: 0 };

  const eventId = randomUUID();
  const results = await Promise.all(matching.map((endpoint) => deliverEndpoint(endpoint, event, data, eventId)));
  return {
    attempted: matching.length,
    delivered: results.filter(Boolean).length,
  };
}
