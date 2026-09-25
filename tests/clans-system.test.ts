import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("clan system migration and server boundaries", () => {
  it("registers the additive clan migration as release-0020", async () => {
    const [setup, migration] = await Promise.all([
      readFile("app/api/setup/[release]/route.ts", "utf8"),
      readFile("drizzle/0019_clans.sql", "utf8"),
    ]);
    expect(setup).toContain('"release-0020"');
    expect(setup).toContain("0019_clans.sql");
    for (const table of ["clans","clan_members","clan_requests","clan_messages"]) {
      expect(migration).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }
    expect(migration).not.toMatch(/\bDROP\s+(TABLE|COLUMN|INDEX)\b/i);
  });

  it("enforces one clan per user and a hard 50-member database limit", async () => {
    const migration = await readFile("drizzle/0019_clans.sql", "utf8");
    expect(migration).toContain("CHECK (member_count >= 0 AND member_count <= 50)");
    expect(migration).toContain("CREATE UNIQUE INDEX IF NOT EXISTS clan_members_user_unique ON clan_members(user_id)");
    expect(migration).toContain("CREATE UNIQUE INDEX IF NOT EXISTS clan_requests_pending_unique");
  });

  it("keeps membership and chat authorization on server routes", async () => {
    const [membership, messages, events] = await Promise.all([
      readFile("app/api/v1/clans/[clanId]/membership/route.ts", "utf8"),
      readFile("app/api/v1/clans/[clanId]/messages/route.ts", "utf8"),
      readFile("app/api/v1/clans/[clanId]/events/route.ts", "utf8"),
    ]);
    expect(membership).toContain("lt(clans.memberCount,CLAN_MEMBER_LIMIT)");
    expect(membership).toContain("clan_members_user_unique");
    expect(messages).toContain("getClanRole(user.id,clanId)");
    expect(messages).toContain("getSuperFlipCapabilities(user.id)");
    expect(events).toContain("getClanRole(user.id,clanId)");
  });

  it("presents the clan leaderboard as responsive cards with an own-clan badge", async () => {
    const [hub, styles] = await Promise.all([
      readFile("components/clan-hub.tsx", "utf8"),
      readFile("app/clans.css", "utf8"),
    ]);
    expect(hub).toContain("clan-rank-card");
    expect(hub).toContain("Ваш клан");
    expect(hub).toContain("clan-rank-avatar");
    expect(hub).toContain("clan-rank-short-hint");
    expect(styles).toContain(".clan-rank-card:hover");
    expect(styles).toContain(".clan-rank-toolbar");
    expect(styles).toContain(".clan-rank-pages");
  });

  it("uses compact shared clan tags across members, profiles and voice", async () => {
    const [tag, shell, profile, voice, theme] = await Promise.all([
      readFile("components/clan-tag.tsx", "utf8"),
      readFile("components/flipzero-app.tsx", "utf8"),
      readFile("components/user-profile-popover.tsx", "utf8"),
      readFile("components/voice-room.tsx", "utf8"),
      readFile("app/runtime-theme.css", "utf8"),
    ]);
    expect(tag).toContain('type ClanTagVariant="inline"|"full"');
    expect(tag).toContain('variant="inline"');
    expect(tag).toContain('className="clan-tag-full"');
    expect(shell).toContain('className="member-name-row"');
    expect(shell).toContain('ClanTag tag={participant.clanTag}');
    expect(profile).toContain('className="fz-mini-name-row"');
    expect(profile).toContain('variant="full"');
    expect(voice).toContain('className="voice-tile-name"');
    expect(theme).toContain(".clan-tag-badge");
    expect(theme).toContain("font-size:10px");
  });

  it("keeps developer platform reachable after replacing the rail icon", async () => {
    const settings = await readFile("components/account-settings-dialog.tsx", "utf8");
    const shell = await readFile("components/flipzero-app.tsx", "utf8");
    expect(settings).toContain('href="/developers/console"');
    expect(shell).toContain('aria-label="Кланы"');
    expect(shell).toContain('platformView==="clans"');
  });
});
