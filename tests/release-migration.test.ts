import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const expectedTables = [
  "developer_oauth_clients",
  "developer_webhooks",
  "developer_oauth_authorization_codes",
  "developer_oauth_access_tokens",
  "developer_app_installations",
  "developer_webhook_deliveries",
] as const;

describe("release-0015 developer integrations migration", () => {
  it("keeps the setup route and migration table contract aligned", async () => {
    const [setupRoute, migration] = await Promise.all([
      readFile("app/api/setup/[release]/route.ts", "utf8"),
      readFile("drizzle/0014_developer_integrations.sql", "utf8"),
    ]);

    expect(setupRoute).toContain('"release-0015"');
    expect(setupRoute).toContain("0014_developer_integrations.sql");

    for (const table of expectedTables) {
      expect(setupRoute).toContain(`public.${table}`);
      expect(migration).toContain(`CREATE TABLE IF NOT EXISTS "${table}"`);
    }
  });

  it("uses idempotent table and index creation for the additive migration", async () => {
    const migration = await readFile("drizzle/0014_developer_integrations.sql", "utf8");

    expect((migration.match(/CREATE TABLE IF NOT EXISTS/g) ?? []).length).toBe(expectedTables.length);
    expect(migration).not.toMatch(/\bDROP\s+(TABLE|COLUMN|INDEX)\b/i);

    const indexStatements = migration.match(/CREATE (?:UNIQUE )?INDEX[^;]+;/g) ?? [];
    expect(indexStatements.length).toBeGreaterThan(0);
    for (const statement of indexStatements) {
      expect(statement).toContain("IF NOT EXISTS");
    }
  });

  it("keeps destructive cascades scoped to child developer integration records", async () => {
    const migration = await readFile("drizzle/0014_developer_integrations.sql", "utf8");

    expect(migration).toContain('REFERENCES "developer_apps"("id") ON DELETE cascade');
    expect(migration).toContain('REFERENCES "users"("id") ON DELETE cascade');
    expect(migration).toContain('REFERENCES "spaces"("id") ON DELETE cascade');
    expect(migration).not.toMatch(/DELETE FROM|TRUNCATE/i);
  });
});
