import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { generateDrizzleJson, generateMigration } from "drizzle-kit/api";
import { eq } from "drizzle-orm";
import * as schema from "../db/schema";
import * as developerSchema from "../db/developer-schema";
import { Permission } from "../lib/permissions";
import { decodeDirectMessage, encodeDirectMessage, type DirectAttachment } from "../lib/direct-message";

const state = vi.hoisted(() => ({ viewer: "a" as string | null, database: null as unknown, viewers: [] as string[] }));
vi.mock("../db/client", () => ({ getDatabase: () => state.database }));
vi.mock("../lib/auth", () => ({
  getCurrentUser: async () => {
    const id = state.viewers.length ? state.viewers.shift()! : state.viewer;
    return id ? { id, username: id, displayName: id } : null;
  },
}));
vi.mock("../lib/superflip", () => ({ getSuperFlipCapabilities: async () => ({ capabilities: { directMessageLimit: 1000 } }) }));
vi.mock("../lib/presentation", () => ({ presentationForUsers: async () => new Map() }));
vi.mock("../lib/clan-tags", () => ({ clanTagsForUsers: async () => new Map() }));

import { GET as readMedia } from "../app/api/v1/media/[id]/route";
import { GET as readHistory } from "../app/api/v1/channels/[channelId]/messages/route";
import { POST as callAction } from "../app/api/v1/direct-calls/incoming/route";
import { POST as eventAction } from "../app/api/v1/spaces/[spaceId]/events/route";
import { authenticateApiRequest } from "../lib/api-auth";
import { attachMedia, InvalidAttachmentError } from "../lib/media-access";
import { cleanupPendingAttachments, storeAttachment } from "../lib/media-upload";
import type { XpTransaction } from "../lib/xp";
import { applyVersionedMigration } from "../scripts/versioned-migration.mjs";

let pg: PGlite;
let db: ReturnType<typeof drizzle<typeof schema>>;
const request = (body: unknown) => new Request("https://flipzero.test/api", {
  method: "POST", headers: { origin: "https://flipzero.test", "content-type": "application/json" }, body: JSON.stringify(body),
});
const getFile = (id: string) => readMedia(new Request("https://flipzero.test/api"), { params: Promise.resolve({ id }) });

async function spaceFixture() {
  await db.insert(schema.spaces).values({ id: "space", ownerId: "a", name: "Test", slug: "test" });
  await db.insert(schema.members).values(["a", "b", "c"].map(userId => ({ userId, spaceId: "space" })));
  await db.insert(schema.channels).values({ id: "channel", spaceId: "space", name: "chat", kind: "text" });
  await db.insert(schema.roles).values({ id: "role", spaceId: "space", name: "Member", permissions: Permission.ViewChannels | Permission.ReadHistory });
  await db.insert(schema.memberRoles).values(["b", "c"].map(userId => ({ userId, spaceId: "space", roleId: "role" })));
}

async function uploaded(ownerId = "a", extra: Partial<typeof schema.mediaAssets.$inferInsert> = {}) {
  const id = randomUUID();
  await db.insert(schema.mediaAssets).values({ id, ownerId, purpose: "attachment", contentType: "text/plain", bytes: Buffer.from("secret"), ...extra });
  return { id, attachment: { type: "file", url: `/api/v1/attachments/${id}`, name: "secret.txt", mimeType: "text/plain", size: 6 } satisfies DirectAttachment };
}

async function directFixture() {
  const file = await uploaded();
  const id = randomUUID();
  await db.insert(schema.directConversations).values({ id: "direct" });
  await db.insert(schema.directConversationMembers).values(["a", "b"].map(userId => ({ conversationId: "direct", userId })));
  await db.transaction(async tx => {
    await attachMedia(tx as unknown as XpTransaction, "a", [file.attachment], "direct", "direct", id);
    await tx.insert(schema.directMessages).values({ id, conversationId: "direct", senderId: "a", receiverId: "b", text: encodeDirectMessage("", [file.attachment]) });
  });
  return { ...file, messageId: id };
}

beforeAll(async () => {
  pg = new PGlite();
  db = drizzle(pg, { schema });
  state.database = db;
  const statements = await generateMigration(generateDrizzleJson({}), generateDrizzleJson({ ...schema, ...developerSchema }));
  await pg.exec(statements.join(";\n"));
}, 30_000);

beforeEach(async () => {
  await pg.exec("TRUNCATE users CASCADE; TRUNCATE direct_conversations CASCADE; TRUNCATE password_reset_attempts;");
  await db.insert(schema.users).values(["a", "b", "c"].map(id => ({ id, email: `${id}@test.invalid`, username: id, displayName: id })));
  state.viewer = "a";
  state.viewers = [];
  process.env.LIVEKIT_URL = "wss://voice.test.invalid";
  process.env.LIVEKIT_API_KEY = "test-key";
  process.env.LIVEKIT_API_SECRET = "test-secret-for-signing";
});
afterAll(async () => { await pg?.close(); });

describe("private attachment access with PostgreSQL", () => {
  it("repairs legacy member history access without widening custom roles or overriding channel denies", async () => {
    await spaceFixture();
    await db.update(schema.roles).set({ permissions: 3139, isManaged: true, position: 0 }).where(eq(schema.roles.id, "role"));
    await db.insert(schema.roles).values([
      { id: "custom", spaceId: "space", name: "Custom", permissions: 3139, isManaged: false },
      { id: "restricted", spaceId: "space", name: "Restricted", permissions: Permission.ViewChannels, isManaged: true, position: 0 },
    ]);
    state.viewer = "b";
    const params = { params: Promise.resolve({ channelId: "channel" }) };
    expect((await readHistory(new Request("https://flipzero.test/api"), params))?.status).toBe(403);
    const sql = await readFile(new URL("../drizzle/0035_legacy_member_history.sql", import.meta.url), "utf8");
    await pg.exec(sql);
    await pg.exec(sql);
    expect((await readHistory(new Request("https://flipzero.test/api"), params))?.status).toBe(200);
    const custom = await db.select().from(schema.roles).where(eq(schema.roles.id, "custom"));
    const restricted = await db.select().from(schema.roles).where(eq(schema.roles.id, "restricted"));
    expect(Number(custom[0].permissions)).toBe(3139);
    expect(Number(restricted[0].permissions)).toBe(Permission.ViewChannels);
    await db.insert(schema.channelOverrides).values({ channelId: "channel", targetType: "member", targetId: "b", allow: 0, deny: Permission.ReadHistory });
    expect((await readHistory(new Request("https://flipzero.test/api"), params))?.status).toBe(403);
    state.viewer = "c";
    expect((await readHistory(new Request("https://flipzero.test/api"), params))?.status).toBe(200);
    await db.delete(schema.members).where(eq(schema.members.userId, "c"));
    expect((await readHistory(new Request("https://flipzero.test/api"), params))?.status).toBe(403);
  });

  it("permits only the uploader to preview a pending file and never caches a denial", async () => {
    const { id } = await uploaded();
    expect((await getFile(id)).status).toBe(200);
    state.viewer = "b";
    expect((await getFile(id)).status).toBe(404);
    state.viewer = null;
    const response = await getFile(id);
    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("keeps a DM attachment private and revokes access after blocking or deletion", async () => {
    const { id, messageId } = await directFixture();
    state.viewer = "b";
    const response = await getFile(id);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("secret");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    state.viewer = "c";
    expect((await getFile(id)).status).toBe(404);
    state.viewer = "b";
    await db.insert(schema.userBlocks).values({ blockerId: "b", blockedId: "a" });
    expect((await getFile(id)).status).toBe(404);
    await db.delete(schema.userBlocks);
    await db.update(schema.directMessages).set({ deletedAt: new Date() }).where(eq(schema.directMessages.id, messageId));
    expect((await getFile(id)).status).toBe(404);
  });

  it("rejects borrowed files and forged size without creating links", async () => {
    const file = await uploaded();
    await expect(db.transaction(tx => attachMedia(tx as unknown as XpTransaction, "b", [file.attachment], "direct", "direct", randomUUID()))).rejects.toBeInstanceOf(InvalidAttachmentError);
    await expect(db.transaction(tx => attachMedia(tx as unknown as XpTransaction, "a", [{ ...file.attachment, size: 1 }], "direct", "direct", randomUUID()))).rejects.toBeInstanceOf(InvalidAttachmentError);
    expect(await db.select().from(schema.mediaAttachmentLinks)).toHaveLength(0);
  });

  it("honours channel history denial for both messages and attachments", async () => {
    await spaceFixture();
    const file = await uploaded();
    const messageId = randomUUID();
    await db.transaction(async tx => {
      await attachMedia(tx as unknown as XpTransaction, "a", [file.attachment], "channel", "channel", messageId);
      await tx.insert(schema.messages).values({ id: messageId, channelId: "channel", authorId: "a", content: "private", attachments: [file.attachment] });
    });
    state.viewer = "b";
    expect((await getFile(file.id)).status).toBe(200);
    await db.insert(schema.channelOverrides).values({ channelId: "channel", targetType: "member", targetId: "b", allow: 0, deny: Permission.ReadHistory });
    const response = await readHistory(new Request("https://flipzero.test/api?pinned=1"), { params: Promise.resolve({ channelId: "channel" }) });
    expect(response?.status).toBe(403);
    expect((await getFile(file.id)).status).toBe(404);
    state.viewer = "a";
    expect((await readHistory(new Request("https://flipzero.test/api"), { params: Promise.resolve({ channelId: "channel" }) }))?.status).toBe(200);
    expect((await getFile(file.id)).status).toBe(200);
    await db.delete(schema.members).where(eq(schema.members.userId, "b"));
    state.viewer = "b";
    expect((await getFile(file.id)).status).toBe(404);
  });

  it("cleans up only old pending files, preserving attached files and public avatars", async () => {
    const old = new Date(Date.now() - 25 * 3600_000);
    const pending = await uploaded("a", { createdAt: old });
    const { id } = await directFixture();
    await db.update(schema.mediaAssets).set({ createdAt: old }).where(eq(schema.mediaAssets.id, id));
    const avatar = await uploaded("a", { createdAt: old, purpose: "public" });
    await cleanupPendingAttachments();
    expect((await getFile(pending.id)).status).toBe(404);
    expect((await getFile(id)).status).toBe(200);
    state.viewer = null;
    expect((await getFile(avatar.id)).status).toBe(200);
  });

  it("limits uploads per user and enforces the storage quota", async () => {
    for (let i = 0; i < 20; i++) expect((await storeAttachment("a", randomUUID(), Buffer.from("x"), "text/plain", false)).ok).toBe(true);
    expect(await storeAttachment("a", randomUUID(), Buffer.from("x"), "text/plain", false)).toMatchObject({ ok: false, reason: "rate" });
    await pg.query("INSERT INTO media_assets(id,owner_id,purpose,content_type,bytes) VALUES($1,'b','attachment','application/zip', repeat('x', 67108864)::bytea)", [randomUUID()]);
    expect(await storeAttachment("b", randomUUID(), Buffer.from("x"), "text/plain", false)).toMatchObject({ ok: false, reason: "quota" });
  }, 15_000);
});

describe("atomic state changes", () => {
  it("issues only one token for concurrent accepts and does not resurrect a cancelled call", async () => {
    const id = randomUUID();
    await db.insert(schema.directCallSessions).values({ id, callerId: "a", receiverId: "b", roomName: "dm:test", expiresAt: new Date(Date.now() + 40_000) });
    state.viewer = "b";
    const responses = await Promise.all([callAction(request({ callId: id, action: "accept" })), callAction(request({ callId: id, action: "accept" }))]);
    expect(responses.map(r => r.status).sort()).toEqual([200, 409]);
    const next = randomUUID();
    await db.insert(schema.directCallSessions).values({ id: next, callerId: "a", receiverId: "b", roomName: "dm:test", expiresAt: new Date(Date.now() + 40_000), status: "cancelled" });
    expect((await callAction(request({ callId: next, action: "accept" }))).status).toBe(409);
    expect((await db.select().from(schema.directCallSessions).where(eq(schema.directCallSessions.id, next)))[0].status).toBe("cancelled");
  });

  it("fills the last event seat only once and makes repeated attendance idempotent", async () => {
    await spaceFixture();
    await db.insert(schema.communityEvents).values({ id: "event", spaceId: "space", creatorId: "a", title: "Test", capacity: 1, startsAt: new Date(Date.now() + 3600_000) });
    const params = { params: Promise.resolve({ spaceId: "space" }) };
    state.viewers = ["b", "c"];
    const first = eventAction(request({ action: "attend", eventId: "event" }), params);
    const second = eventAction(request({ action: "attend", eventId: "event" }), params);
    const responses = await Promise.all([first, second]);
    expect(responses.map(r => r!.status).sort()).toEqual([200, 409]);
    const guests = await db.select().from(schema.eventAttendees);
    expect(guests).toHaveLength(1);
    state.viewer = guests[0].userId;
    expect((await eventAction(request({ action: "attend", eventId: "event" }), params))!.status).toBe(200);
  });
});

describe("Bearer bans and legacy migration", () => {
  it("journals the migration transaction and skips its data rewrite on a second build", async () => {
    const client = {
      begin: async (run: (tx: unknown) => Promise<void>) => pg.transaction(async transaction => {
        const tx = Object.assign(async (strings: TemplateStringsArray, ...values: unknown[]) => {
          const text = strings.reduce((query, part, index) => query + (index ? `$${index}` : "") + part, "");
          return (await transaction.query(text, values)).rows;
        }, { unsafe: async (sql: string) => transaction.exec(sql) });
        return run(tx);
      }),
    };
    const url = new URL("../drizzle/0034_private_attachments.sql", import.meta.url);
    await applyVersionedMigration(client, "0034_private_attachments", url);
    const avatar = await uploaded("a", { purpose: null });
    await db.update(schema.users).set({ avatarUrl: `/api/v1/media/${avatar.id}` }).where(eq(schema.users.id, "a"));
    await applyVersionedMigration(client, "0034_private_attachments", url);
    const [asset] = await db.select().from(schema.mediaAssets).where(eq(schema.mediaAssets.id, avatar.id));
    expect(asset.purpose).toBeNull(); // A repeated data rewrite would mark this public.
    expect(await db.select().from(schema.appSchemaMigrations)).toHaveLength(1);
  });

  it("rejects both live and OAuth credentials belonging to banned users", async () => {
    await db.insert(schema.developerApps).values({ id: "app", ownerId: "a", name: "Test" });
    const live = "fz_live_" + "a".repeat(40), oauth = "fz_oauth_" + "b".repeat(40);
    const hash = (token: string) => createHash("sha256").update(token).digest("hex");
    await db.insert(schema.apiTokens).values({ id: "live", appId: "app", name: "test", tokenHash: hash(live), prefix: "fz_live_" });
    await db.insert(developerSchema.developerOauthAccessTokens).values({ id: "oauth", appId: "app", userId: "a", tokenHash: hash(oauth), prefix: "fz_oauth_", scopes: ["identify"], expiresAt: new Date(Date.now() + 3600_000) });
    for (const token of [live, oauth]) expect(await authenticateApiRequest(new Request("https://flipzero.test/api", { headers: { authorization: `Bearer ${token}` } }))).not.toBeNull();
    await db.update(schema.users).set({ bannedAt: new Date() }).where(eq(schema.users.id, "a"));
    for (const token of [live, oauth]) expect(await authenticateApiRequest(new Request("https://flipzero.test/api", { headers: { authorization: `Bearer ${token}` } }))).toBeNull();
  });

  it("backfills legacy file links and public avatars without altering malformed envelopes", async () => {
    const file = await uploaded("a", { ownerId: null, purpose: null });
    const avatar = await uploaded("a", { ownerId: null, purpose: null });
    await db.update(schema.users).set({ avatarUrl: `/api/v1/media/${avatar.id}` }).where(eq(schema.users.id, "a"));
    await db.insert(schema.directConversations).values({ id: "legacy" });
    const legacyAttachment = { ...file.attachment, url: `/api/v1/media/${file.id}` };
    await db.insert(schema.directMessages).values([
      { id: "legacy-message", conversationId: "legacy", senderId: "a", receiverId: "b", text: encodeDirectMessage("hello", [legacyAttachment]) },
      { id: "malformed", conversationId: "legacy", senderId: "a", receiverId: "b", text: "__FZDM1__:bad json" },
    ]);
    const migration = await readFile("drizzle/0034_private_attachments.sql", "utf8");
    await pg.exec("BEGIN;\n" + migration + "\nCOMMIT;");
    await pg.exec("BEGIN;\n" + migration + "\nCOMMIT;");
    const [asset] = await db.select().from(schema.mediaAssets).where(eq(schema.mediaAssets.id, file.id));
    expect(asset).toMatchObject({ ownerId: "a", purpose: "attachment" });
    expect(asset.attachedAt).not.toBeNull();
    expect(await db.select().from(schema.mediaAttachmentLinks)).toHaveLength(1);
    const rows = await db.select().from(schema.directMessages);
    expect(decodeDirectMessage(rows.find(r => r.id === "legacy-message")!.text)).toMatchObject({ text: "hello", attachments: [{ url: `/api/v1/attachments/${file.id}` }] });
    expect(rows.find(r => r.id === "malformed")!.text).toBe("__FZDM1__:bad json");
    state.viewer = null;
    expect((await getFile(avatar.id)).status).toBe(200);
    expect((await getFile(file.id)).status).toBe(404);
  });
});
