export type Snowflake = string;

export type PresenceStatus = "online" | "idle" | "dnd" | "offline";
export type ChannelKind = "text" | "forum" | "voice" | "stage" | "announcement" | "board";
export type SpaceVisibility = "private" | "application" | "public" | "invite_only";

export interface User {
  id: Snowflake;
  username: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
  bio: string | null;
  accentColor: string;
  presence: PresenceStatus;
  globalXp: number;
  globalLevel: number;
  createdAt: string;
}

export interface Space {
  id: Snowflake;
  ownerId: Snowflake;
  name: string;
  slug: string;
  description: string | null;
  iconUrl: string | null;
  bannerUrl: string | null;
  visibility: SpaceVisibility;
  accentColor: string;
  memberCount: number;
  createdAt: string;
}

export interface Channel {
  id: Snowflake;
  spaceId: Snowflake;
  categoryId: Snowflake | null;
  name: string;
  topic: string | null;
  kind: ChannelKind;
  position: number;
  isNsfw: boolean;
  slowmodeSeconds: number;
}

export interface Message {
  id: Snowflake;
  channelId: Snowflake;
  authorId: Snowflake;
  content: string;
  replyToId: Snowflake | null;
  editedAt: string | null;
  createdAt: string;
}

export interface Member {
  userId: Snowflake;
  spaceId: Snowflake;
  nickname: string | null;
  roleIds: Snowflake[];
  xp: number;
  level: number;
  joinedAt: string;
}

export interface Role {
  id: Snowflake;
  spaceId: Snowflake;
  name: string;
  color: string;
  position: number;
  permissions: number;
  isManaged: boolean;
}

export interface ApiError {
  code: string;
  message: string;
  requestId: string;
  details?: Record<string, unknown>;
}

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}
