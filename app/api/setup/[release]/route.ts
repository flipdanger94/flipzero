import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { and, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { sessions, users } from "@/db/schema";
import { SESSION_COOKIE } from "@/lib/auth";

const releases: Record<string, { migrationUrl: URL; title: string; check: string }> = {
  "release-0000": { migrationUrl: new URL("../../../../drizzle/0000_phase_zero.sql", import.meta.url), title: "Phase Zero", check: "SELECT to_regclass('public.users') IS NOT NULL AS applied" },
  "release-0001": { migrationUrl: new URL("../../../../drizzle/0001_channel_categories.sql", import.meta.url), title: "Категории каналов", check: "SELECT EXISTS(SELECT 1 FROM pg_constraint WHERE conname = 'channels_parent_id_channel_categories_id_fk') AS applied" },
  "release-0002": { migrationUrl: new URL("../../../../drizzle/0002_gamification.sql", import.meta.url), title: "Геймификация", check: "SELECT to_regclass('public.profile_cosmetics') IS NOT NULL AS applied" },
  "release-0003": { migrationUrl: new URL("../../../../drizzle/0003_messaging.sql", import.meta.url), title: "Messaging", check: "SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='messages' AND column_name='thread_root_id') AS applied" },
  "release-0004": { migrationUrl: new URL("../../../../drizzle/0004_channel_formats.sql", import.meta.url), title: "Форматы каналов", check: "SELECT to_regclass('public.board_items') IS NOT NULL AS applied" },
  "release-0005": { migrationUrl: new URL("../../../../drizzle/0005_community_events.sql", import.meta.url), title: "События сообщества", check: "SELECT to_regclass('public.community_events') IS NOT NULL AS applied" },
  "release-0006": { migrationUrl: new URL("../../../../drizzle/0006_wiki.sql", import.meta.url), title: "Wiki", check: "SELECT to_regclass('public.wiki_pages') IS NOT NULL AS applied" },
  "release-0007": { migrationUrl: new URL("../../../../drizzle/0007_developer_platform.sql", import.meta.url), title: "Developer Platform", check: "SELECT to_regclass('public.developer_apps') IS NOT NULL AS applied" },
  "release-0008": { migrationUrl: new URL("../../../../drizzle/0008_trust_safety.sql", import.meta.url), title: "Trust & Safety", check: "SELECT to_regclass('public.moderation_flags') IS NOT NULL AS applied" },
  "release-0009": { migrationUrl: new URL("../../../../drizzle/0009_space_placements.sql", import.meta.url), title: "Space placements", check: "SELECT to_regclass('public.space_placements') IS NOT NULL AS applied" },
  "release-0013": { migrationUrl: new URL("../../../../drizzle/0012_user_profiles.sql", import.meta.url), title: "Профили пользователей", check: "SELECT COUNT(*) = 3 AS applied FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name IN ('profile_location','profile_status','profile_links')" },
  "release-0014": { migrationUrl: new URL("../../../../drizzle/0013_voice_states.sql", import.meta.url), title: "Voice states", check: "SELECT to_regclass('public.voice_states') IS NOT NULL AS applied" },
};

export async function POST(_request: Request, context: { params: Promise<{ release: string }> }) {
  const { release } = await context.params;
  const config = releases[release];
  if (!config) return NextResponse.json({ message: "Неизвестная миграция." }, { status: 404 });

  const expectedEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const databaseUrl = process.env.DATABASE_URL;
  if (!expectedEmail || !databaseUrl) return NextResponse.json({ message: "Переменные окружения не настроены." }, { status: 503 });

  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ message: "Сначала войдите в аккаунт администратора." }, { status: 401 });

  const database = getDatabase();
  const [account] = await database
    .select({ email: users.email })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.tokenHash, createHash("sha256").update(token).digest("hex")), gt(sessions.expiresAt, new Date())))
    .limit(1);

  if (!account || account.email.toLowerCase() !== expectedEmail) return NextResponse.json({ message: "Этот аккаунт не может выполнить установку." }, { status: 403 });

  const { default: postgres } = await import("postgres");
  const client = postgres(databaseUrl, { max: 1, prepare: false });

  try {
    const checkResult = await client.unsafe(config.check);
    if (Boolean(checkResult[0]?.applied)) {
      return NextResponse.json({ ok: true, alreadyApplied: true, message: `${config.title}: миграция уже применена, повторный запуск не требуется.` });
    }

    const migration = await readFile(fileURLToPath(config.migrationUrl), "utf8");
    await client.unsafe(migration);
    return NextResponse.json({ ok: true, message: `${config.title}: миграция успешно применена.` });
  } finally {
    await client.end();
  }
}
