import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("XP ledger migration contract", () => {
  it("enforces one progress row per user and scoped event idempotency", async () => {
    const sql = await readFile("drizzle/0030_user_progress_ledger.sql", "utf8");
    expect(sql).toContain("user_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE");
    expect(sql).toContain("CHECK (total_xp >= 0)");
    expect(sql).toContain("xp_events_user_source_dedupe_unique");
    expect(sql).toContain("ON xp_events(user_id, source, dedupe_key)");
    expect(sql).toContain("xp_events_duplicates_archive");
  });

  it("does not auto-apply the XP migration in the build migration script", async () => {
    const source = await readFile("scripts/apply-clans-migration.mjs", "utf8");
    expect(source).not.toContain("0030_user_progress_ledger.sql");
  });
});
