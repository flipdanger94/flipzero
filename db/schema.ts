import { bigint, boolean, customType, index, integer, jsonb, pgEnum, pgTable, primaryKey, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const presenceStatus = pgEnum("presence_status", ["online", "idle", "dnd", "offline"]);
export const spaceVisibility = pgEnum("space_visibility", ["private", "application", "public", "invite_only"]);
export const channelKind = pgEnum("channel_kind", ["text", "forum", "voice", "stage", "announcement", "board"]);
export const moderationAction = pgEnum("moderation_action", ["warn", "timeout", "kick", "ban", "unban"]);
export const progressPath = pgEnum("progress_path", ["social", "voice", "organizer", "creator"]);
export const achievementRarity = pgEnum("achievement_rarity", ["common", "rare", "epic", "legendary"]);
export const platformRole = pgEnum("platform_role", ["user", "admin"]);
export const superflipSource = pgEnum("superflip_source", ["purchase", "gift"]);
export const friendRequestStatus = pgEnum("friend_request_status", ["pending", "accepted", "declined"]);

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
  platformRole: platformRole("platform_role").default("user").notNull(),
  bannedAt: timestamp("banned_at", { withTimezone: true }),
  banReason: text("ban_reason"),
  ...timestamps,
}, (table) => [uniqueIndex("users_email_unique").on(table.email), uniqueIndex("users_username_unique").on(table.username)]);

const imageBytes = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => "bytea" });
export const mediaAssets = pgTable("media_assets", {
  id: text("id").primaryKey(),
  contentType: text("content_type").notNull(),
  bytes: imageBytes("bytes").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const superflipPurchases = pgTable("superflip_purchases", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  grantedBy: text("granted_by").references(() => users.id, { onDelete: "set null" }),
  grantedAt: timestamp("granted_at", { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  source: superflipSource("source").notNull(),
  reason: text("reason"),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
}, (table) => [index("superflip_user_status_idx").on(table.userId, table.expiresAt, table.revokedAt)]);

export const superflipWaitlist = pgTable("superflip_waitlist", {
  userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),
});

export const directConversations = pgTable("direct_conversations", {
  id: text("id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const directConversationMembers = pgTable("direct_conversation_members", {
  conversationId: text("conversation_id").notNull().references(() => directConversations.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [primaryKey({ columns: [table.conversationId, table.userId] }), index("direct_members_user_idx").on(table.userId)]);

export const directMessages = pgTable("direct_messages", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id").notNull().references(() => directConversations.id, { onDelete: "cascade" }),
  senderId: text("sender_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  receiverId: text("receiver_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  readAt: timestamp("read_at", { withTimezone: true }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [index("direct_messages_conversation_idx").on(table.conversationId, table.createdAt), index("direct_messages_receiver_unread_idx").on(table.receiverId, table.readAt)]);

export const friendRequests = pgTable("friend_requests", {
  id: text("id").primaryKey(),
  fromId: text("from_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  toId: text("to_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  status: friendRequestStatus("status").default("pending").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  respondedAt: timestamp("responded_at", { withTimezone: true }),
}, (table) => [uniqueIndex("friend_requests_pair_unique").on(table.fromId, table.toId), index("friend_requests_to_status_idx").on(table.toId, table.status)]);

export const friends = pgTable("friends", {
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  friendId: text("friend_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [primaryKey({ columns: [table.userId, table.friendId] }), index("friends_friend_idx").on(table.friendId)]);

export const adminAuditLogs = pgTable("admin_audit_logs", {
  id: text("id").primaryKey(),
  adminId: text("admin_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  action: text("action").notNull(),
  targetUserId: text("target_user_id").references(() => users.id, { onDelete: "set null" }),
  metadata: jsonb("metadata").default({}).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("admin_audit_created_idx").on(table.createdAt)]);

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

export const spacePlacements = pgTable("space_placements", {
  spaceId: text("space_id").primaryKey().references(() => spaces.id, { onDelete: "cascade" }),
  shardId: text("shard_id").default("primary").notNull(),
  homeRegion: text("home_region").default("global").notNull(),
  state: text("state").default("active").notNull(),
  version: integer("version").default(1).notNull(),
  ...timestamps,
}, (table) => [index("space_placements_shard_state_idx").on(table.shardId, table.state)]);

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

export const channelCategories = pgTable("channel_categories", {
  id: text("id").primaryKey(),
  spaceId: text("space_id").notNull().references(() => spaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  position: integer("position").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("channel_categories_space_position_idx").on(table.spaceId, table.position)]);

export const channels = pgTable("channels", {
  id: text("id").primaryKey(),
  spaceId: text("space_id").notNull().references(() => spaces.id, { onDelete: "cascade" }),
  parentId: text("parent_id").references(() => channelCategories.id, { onDelete: "set null" }),
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
  threadRootId: text("thread_root_id"),
  content: text("content").notNull(),
  attachments: jsonb("attachments").default([]).notNull(),
  editedAt: timestamp("edited_at", { withTimezone: true }),
  pinnedAt: timestamp("pinned_at", { withTimezone: true }),
  pinnedById: text("pinned_by_id").references(() => users.id, { onDelete: "set null" }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("messages_channel_created_idx").on(table.channelId, table.createdAt), index("messages_author_idx").on(table.authorId)]);

export const channelNotificationSettings = pgTable("channel_notification_settings", {
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  channelId: text("channel_id").notNull().references(() => channels.id, { onDelete: "cascade" }),
  mode: text("mode").default("mentions").notNull(),
  mutedUntil: timestamp("muted_until", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [primaryKey({ columns: [table.userId, table.channelId] })]);

export const boardItems = pgTable("board_items", {
  id: text("id").primaryKey(),
  channelId: text("channel_id").notNull().references(() => channels.id, { onDelete: "cascade" }),
  authorId: text("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").default("todo").notNull(),
  position: integer("position").default(0).notNull(),
  dueAt: timestamp("due_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("board_items_channel_status_idx").on(table.channelId, table.status, table.position)]);

export const communityEvents = pgTable("community_events", {
  id: text("id").primaryKey(),
  spaceId: text("space_id").notNull().references(() => spaces.id, { onDelete: "cascade" }),
  creatorId: text("creator_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  location: text("location"),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  capacity: integer("capacity"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("community_events_space_start_idx").on(table.spaceId, table.startsAt)]);

export const eventAttendees = pgTable("event_attendees", {
  eventId: text("event_id").notNull().references(() => communityEvents.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [primaryKey({ columns: [table.eventId, table.userId] }), index("event_attendees_user_idx").on(table.userId)]);

export const wikiPages = pgTable("wiki_pages", {
  id: text("id").primaryKey(),
  spaceId: text("space_id").notNull().references(() => spaces.id, { onDelete: "cascade" }),
  authorId: text("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  slug: text("slug").notNull(),
  title: text("title").notNull(),
  summary: text("summary"),
  content: text("content").notNull(),
  revision: integer("revision").default(1).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [uniqueIndex("wiki_pages_space_slug_unique").on(table.spaceId, table.slug), index("wiki_pages_space_updated_idx").on(table.spaceId, table.updatedAt)]);

export const wikiRevisions = pgTable("wiki_revisions", {
  id: text("id").primaryKey(),
  pageId: text("page_id").notNull().references(() => wikiPages.id, { onDelete: "cascade" }),
  editorId: text("editor_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  revision: integer("revision").notNull(),
  title: text("title").notNull(),
  summary: text("summary"),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [uniqueIndex("wiki_revisions_page_revision_unique").on(table.pageId, table.revision), index("wiki_revisions_page_idx").on(table.pageId)]);

export const developerApps = pgTable("developer_apps", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("developer_apps_owner_idx").on(table.ownerId)]);

export const apiTokens = pgTable("api_tokens", {
  id: text("id").primaryKey(),
  appId: text("app_id").notNull().references(() => developerApps.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  tokenHash: text("token_hash").notNull(),
  prefix: text("prefix").notNull(),
  scopes: jsonb("scopes").default(["profile:read", "spaces:read"]).notNull(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [uniqueIndex("api_tokens_hash_unique").on(table.tokenHash), index("api_tokens_app_idx").on(table.appId)]);

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

export const moderationFlags = pgTable("moderation_flags", {
  id: text("id").primaryKey(),
  spaceId: text("space_id").notNull().references(() => spaces.id, { onDelete: "cascade" }),
  channelId: text("channel_id").notNull().references(() => channels.id, { onDelete: "cascade" }),
  messageId: text("message_id").notNull().references(() => messages.id, { onDelete: "cascade" }),
  authorId: text("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  category: text("category").notNull(),
  severity: text("severity").notNull(),
  confidence: integer("confidence").notNull(),
  summary: text("summary").notNull(),
  evidence: jsonb("evidence").default([]).notNull(),
  status: text("status").default("pending").notNull(),
  autoHidden: boolean("auto_hidden").default(false).notNull(),
  reviewedById: text("reviewed_by_id").references(() => users.id, { onDelete: "set null" }),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [uniqueIndex("moderation_flags_message_unique").on(table.messageId), index("moderation_flags_space_status_idx").on(table.spaceId, table.status, table.createdAt)]);

export const xpEvents = pgTable("xp_events", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  spaceId: text("space_id").references(() => spaces.id, { onDelete: "cascade" }),
  source: text("source").notNull(),
  amount: integer("amount").notNull(),
  idempotencyKey: text("idempotency_key").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [uniqueIndex("xp_events_idempotency_unique").on(table.idempotencyKey), index("xp_events_user_created_idx").on(table.userId, table.createdAt)]);

export const pathProgress = pgTable("path_progress", {
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  scopeId: text("scope_id").default("global").notNull(),
  path: progressPath("path").notNull(),
  xp: bigint("xp", { mode: "number" }).default(0).notNull(),
  level: integer("level").default(1).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [primaryKey({ columns: [table.userId, table.scopeId, table.path] }), index("path_progress_user_idx").on(table.userId)]);

export const achievementDefinitions = pgTable("achievement_definitions", {
  id: text("id").primaryKey(),
  spaceId: text("space_id").references(() => spaces.id, { onDelete: "cascade" }),
  key: text("key").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  icon: text("icon").default("✦").notNull(),
  rarity: achievementRarity("rarity").default("common").notNull(),
  eventSource: text("event_source").notNull(),
  target: integer("target").notNull(),
  xpReward: integer("xp_reward").default(0).notNull(),
  isSecret: boolean("is_secret").default(false).notNull(),
  createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [uniqueIndex("achievement_definitions_scope_key_unique").on(table.spaceId, table.key), index("achievement_definitions_space_idx").on(table.spaceId)]);

export const userAchievements = pgTable("user_achievements", {
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  achievementId: text("achievement_id").notNull().references(() => achievementDefinitions.id, { onDelete: "cascade" }),
  progress: integer("progress").default(0).notNull(),
  unlockedAt: timestamp("unlocked_at", { withTimezone: true }),
  isShowcased: boolean("is_showcased").default(false).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [primaryKey({ columns: [table.userId, table.achievementId] }), index("user_achievements_showcase_idx").on(table.userId, table.isShowcased)]);

export const profileCosmetics = pgTable("profile_cosmetics", {
  userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").default("Путешественник").notNull(),
  avatarFrame: text("avatar_frame").default("coral").notNull(),
  profileEffect: text("profile_effect").default("glow").notNull(),
  showcasedPath: progressPath("showcased_path").default("social").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
