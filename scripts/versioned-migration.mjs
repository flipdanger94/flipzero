import { readFile } from "node:fs/promises";

export async function applyVersionedMigration(client, name, url) {
  const sql = (await readFile(url, "utf8")).replace(/^\s*BEGIN;\s*/i, "").replace(/\s*COMMIT;\s*$/i, "");
  await client.begin(async tx => {
    await tx`SELECT pg_advisory_xact_lock(hashtext('flipzero-versioned-migrations'))`;
    await tx`CREATE TABLE IF NOT EXISTS app_schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`;
    const [applied] = await tx`SELECT name FROM app_schema_migrations WHERE name = ${name}`;
    if (applied) return;
    await tx.unsafe(sql);
    await tx`INSERT INTO app_schema_migrations(name) VALUES (${name})`;
  });
}
