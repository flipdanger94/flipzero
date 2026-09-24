import { spawnSync } from "node:child_process";
if (!process.env.DATABASE_URL) { console.log("[database] DATABASE_URL is absent; migration skipped"); process.exit(0); }
console.log("[database] synchronizing PostgreSQL schema");
const npmExecutable = process.platform === "win32" ? "npm.cmd" : "npm";
const result = spawnSync(npmExecutable, ["exec", "drizzle-kit", "--", "push", "--force"], { stdio: "inherit" });
if (result.status !== 0) process.exit(result.status ?? 1);
const { default: postgres } = await import("postgres");
const client = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });
await client`
  INSERT INTO space_placements (space_id, shard_id, home_region, state, version)
  SELECT id, 'primary', ${process.env.VERCEL_REGION ?? "global"}, 'active', 1 FROM spaces
  ON CONFLICT (space_id) DO NOTHING
`;
await client.end();
console.log("[database] space placement catalog synchronized");
