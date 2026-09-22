import "server-only";
import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { getDatabase } from "@/db/client";
import { developerWebhooks } from "@/db/developer-schema";
import { developerApps, spaces } from "@/db/schema";
import { decryptDeveloperSecret, signDeveloperPayload } from "@/lib/developer-secret";

export type DeveloperWebhookEvent = "message.created" | "member.joined" | "member.left" | "space.updated";

type WebhookEnvelope = {
  id: string;
  event: DeveloperWebhookEvent;
  createdAt: string;
  data: Record<string, unknown>;
};

export async function dispatchDeveloperEvent(spaceId: string, event: DeveloperWebhookEvent, data: Record<string, unknown>) {
  const database = getDatabase();
  const [space] = await database.select({ ownerId: spaces.ownerId }).from(spaces).where(eq(spaces.id, spaceId)).limit(1);
  if (!space) return { attempted: 0, delivered: 0 };

  const endpoints = await database
    .select({
      id: developerWebhooks.id,
      url: developerWebhooks.url,
      eventTypes: developerWebhooks.eventTypes,
      secretCiphertext: developerWebhooks.secretCiphertext,
    })
    .from(developerWebhooks)
    .innerJoin(developerApps, eq(developerApps.id, developerWebhooks.appId))
    .where(and(eq(developerApps.ownerId, space.ownerId), eq(developerWebhooks.enabled, true)));

  const matching = endpoints.filter((endpoint) => endpoint.eventTypes.includes(event));
  if (!matching.length) return { attempted: 0, delivered: 0 };

  const envelope: WebhookEnvelope = {
    id: randomUUID(),
    event,
    createdAt: new Date().toISOString(),
    data,
  };
  const payload = JSON.stringify(envelope);
  const timestamp = Math.floor(Date.now() / 1000).toString();

  const results = await Promise.allSettled(matching.map(async (endpoint) => {
    const secret = decryptDeveloperSecret(endpoint.secretCiphertext);
    const signature = signDeveloperPayload(secret, `${timestamp}.${payload}`);
    const response = await fetch(endpoint.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": "FlipZero-Webhooks/1.0",
        "x-flipzero-event": event,
        "x-flipzero-delivery": envelope.id,
        "x-flipzero-timestamp": timestamp,
        "x-flipzero-signature": `sha256=${signature}`,
      },
      body: payload,
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) throw new Error(`Webhook ${endpoint.id} returned ${response.status}`);
  }));

  return {
    attempted: matching.length,
    delivered: results.filter((result) => result.status === "fulfilled").length,
  };
}
