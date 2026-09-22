import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { and, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { sessions, users } from "@/db/schema";
import { SESSION_COOKIE } from "@/lib/auth";

const releases: Record<string, { file: string; title: string; check: string }> = {
  "release-0000": { file: "0000_phase_zero.sql", title: "Phase Zero", check: "SELECT to_regclass('public.users') IS NOT NULL AS applied" },
  "release-0001": { file: "0001_channel_categories.sql", title: "Категории каналов", check: "SELECT EXISTS(SELECT 1 FROM pg_constraint WHERE conname = 'channels_parent_id_channel_categories_id_fk') AS applied" },
  "release-0002": { file: "0002_gamification.sql", title: "Геймификация", check: "SELECT to_regclass('public.profile_cosmetics') IS NOT NULL AS applied" },
  "release-0003": { file: "0003_messaging.sql", title: "Messaging", check: "SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='messages' AND column_name='thread_root_id') AS applied" },
  "release-0004": { file: "0004_channel_formats.sql", title: "Форматы каналов", check: "SELECT to_regclass('public.board_items') IS NOT NULL AS applied" },
  "release-0005": { file: "0005_community_events.sql", title: "События сообщества", check: "SELECT to_regclass('public.community_events') IS NOT NULL AS applied" },
  "release-0006": { file: "0006_wiki.sql", title: "Wiki", check: "SELECT to_regclass('public.wiki_pages') IS NOT NULL AS applied" },
  "release-0007": { file: "0007_developer_platform.sql", title: "Developer Platform", check: "SELECT to_regclass('public.developer_apps') IS NOT NULL AS applied" },
  "release-0008": { file: "0008_trust_safety.sql", title: "Trust & Safety", check: "SELECT to_regclass('public.moderation_flags') IS NOT NULL AS applied" },
  "release-0009": { file: "0009_space_placements.sql", title: "Space placements", check: "SELECT to_regclass('public.space_placements') IS NOT NULL AS applied" },
  "release-0013": { file: "0012_user_profiles.sql", title: "Профили пользователей", check: "SELECT COUNT(*) = 3 AS applied FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name IN ('profile_location','profile_status','profile_links')" },
  "release-0014": { file: "0013_voice_states.sql", title: "Voice states", check: "SELECT to_regclass('public.voice_states') IS NOT NULL AS applied" },
};

export async function POST(_request: Request, context: { params: Promise<{ release: string }> }) {
  const { release } = await context.params;
  const config = releases[release];
  if (!config) return NextResponse.json({ message: "Неизвестная миграция." }, { status: 404 });

  const expectedEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!expectedEmail || !process.env.DATABASE_URL) return NextResponse.json({ message: "Переменные окружения не настроены." }, { status: 503 });

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
  const client = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });

  try {
    const checkResult = await client.unsafe(config.check);
    if (Boolean(checkResult[0]?.applied)) {
      return NextResponse.json({ ok: true, alreadyApplied: true, message: `${config.title}: миграция уже применена, повторный запуск не требуется.` });
    }

    const migration = await readFile(fileURLToPath(new URL(`../../../../drizzle/${config.file}`, import.meta.url)), "utf8");
    await client.unsafe(migration);
    return NextResponse.json({ ok: true, message: `${config.title}: миграция успешно применена.` });
  } finally {
    await client.end();
  }
}
