import { bigint, boolean, index, integer, jsonb, pgEnum, pgTable, primaryKey, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const presenceStatus = pgEnum("presence_status", ["online", "idle", "dnd", "offline"]);
export const spaceVisibility = pgEnum("space_visibility", ["private", "application", "public", "invite_only"]);
export const channelKind = pgEnum("channel_kind", ["text", "forum", "voice", "stage", "announcement", "board"]);
export const moderationAction = pgEnum("moderation_action", ["warn", "timeout", "kick", "ban", "unban"]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
};

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  username: text("username").notNull(),
  displayName: text("display_name").notNull(),
  passwordHash: text("password_hash"),
  avatarUrl: text("avatar_url"),
  bannerUrl: text("banner_url"),
  bio: text("bio"),
  accentColor: text("accent_color").default("#ff5c70").notNull(),
  presence: presenceStatus("presence").default("offline").notNull(),
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
  globalXp: bigint("global_xp", { mode: "number" }).default(0).notNull(),
  globalLevel: integer("global_level").default(1).notNull(),
  ...timestamps,
}, (table) => [uniqueIndex("users_email_unique").on(table.email), uniqueIndex("users_username_unique").on(table.username)]);

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  userAgent: text("user_agent"),
  ipHash: text("ip_hash"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [uniqueIndex("sessions_token_hash_unique").on(table.tokenHash), index("sessions_user_idx").on(table.userId)]);

export const spaces = pgTable("spaces", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  description: text("description"),
  iconUrl: text("icon_url"),
  bannerUrl: text("banner_url"),
  visibility: spaceVisibility("visibility").default("invite_only").notNull(),
  accentColor: text("accent_color").default("#ff5c70").notNull(),
  ...timestamps,
}, (table) => [uniqueIndex("spaces_slug_unique").on(table.slug), index("spaces_owner_idx").on(table.ownerId)]);

export const roles = pgTable("roles", {
  id: text("id").primaryKey(),
  spaceId: text("space_id").notNull().references(() => spaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  color: text("color").default("#918d9d").notNull(),
  position: integer("position").default(0).notNull(),
  permissions: bigint("permissions", { mode: "number" }).default(0).notNull(),
  isManaged: boolean("is_managed").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("roles_space_position_idx").on(table.spaceId, table.position)]);

export const members = pgTable("members", {
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  spaceId: text("space_id").notNull().references(() => spaces.id, { onDelete: "cascade" }),
  nickname: text("nickname"),
  xp: bigint("xp", { mode: "number" }).default(0).notNull(),
  level: integer("level").default(1).notNull(),
  joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [primaryKey({ columns: [table.userId, table.spaceId] }), index("members_space_level_idx").on(table.spaceId, table.level)]);

export const memberRoles = pgTable("member_roles", {
  userId: text("user_id").notNull(),
  spaceId: text("space_id").notNull(),
  roleId: text("role_id").notNull().references(() => roles.id, { onDelete: "cascade" }),
}, (table) => [primaryKey({ columns: [table.userId, table.spaceId, table.roleId] })]);

export const channels = pgTable("channels", {
  id: text("id").primaryKey(),
  spaceId: text("space_id").notNull().references(() => spaces.id, { onDelete: "cascade" }),
  parentId: text("parent_id"),
  name: text("name").notNull(),
  topic: text("topic"),
  kind: channelKind("kind").default("text").notNull(),
  position: integer("position").default(0).notNull(),
  isNsfw: boolean("is_nsfw").default(false).notNull(),
  slowmodeSeconds: integer("slowmode_seconds").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("channels_space_position_idx").on(table.spaceId, table.position)]);

export const channelOverrides = pgTable("channel_overrides", {
  channelId: text("channel_id").notNull().references(() => channels.id, { onDelete: "cascade" }),
  targetId: text("target_id").notNull(),
  targetType: text("target_type").notNull(),
  allow: bigint("allow", { mode: "number" }).default(0).notNull(),
  deny: bigint("deny", { mode: "number" }).default(0).notNull(),
}, (table) => [primaryKey({ columns: [table.channelId, table.targetId] })]);

export const messages = pgTable("messages", {
  id: text("id").primaryKey(),
  channelId: text("channel_id").notNull().references(() => channels.id, { onDelete: "cascade" }),
  authorId: text("author_id").notNull().references(() => users.id),
  replyToId: text("reply_to_id"),
  content: text("content").notNull(),
  attachments: jsonb("attachments").default([]).notNull(),
  editedAt: timestamp("edited_at", { withTimezone: true }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("messages_channel_created_idx").on(table.channelId, table.createdAt), index("messages_author_idx").on(table.authorId)]);

export const reactions = pgTable("reactions", {
  messageId: text("message_id").notNull().references(() => messages.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  emoji: text("emoji").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [primaryKey({ columns: [table.messageId, table.userId, table.emoji] })]);

export const invites = pgTable("invites", {
  code: text("code").primaryKey(),
  spaceId: text("space_id").notNull().references(() => spaces.id, { onDelete: "cascade" }),
  channelId: text("channel_id").references(() => channels.id, { onDelete: "set null" }),
  creatorId: text("creator_id").notNull().references(() => users.id),
  maxUses: integer("max_uses"),
  uses: integer("uses").default(0).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("invites_space_idx").on(table.spaceId)]);

export const moderationCases = pgTable("moderation_cases", {
  id: text("id").primaryKey(),
  spaceId: text("space_id").notNull().references(() => spaces.id, { onDelete: "cascade" }),
  targetUserId: text("target_user_id").notNull().references(() => users.id),
  moderatorId: text("moderator_id").notNull().references(() => users.id),
  action: moderationAction("action").notNull(),
  reason: text("reason"),
  metadata: jsonb("metadata").default({}).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("moderation_space_target_idx").on(table.spaceId, table.targetUserId)]);

export const xpEvents = pgTable("xp_events", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  spaceId: text("space_id").references(() => spaces.id, { onDelete: "cascade" }),
  source: text("source").notNull(),
  amount: integer("amount").notNull(),
  idempotencyKey: text("idempotency_key").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [uniqueIndex("xp_events_idempotency_unique").on(table.idempotencyKey), index("xp_events_user_created_idx").on(table.userId, table.createdAt)]);
