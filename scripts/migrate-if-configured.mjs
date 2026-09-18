import { spawnSync } from "node:child_process";
if (!process.env.DATABASE_URL) { console.log("[database] DATABASE_URL is absent; migration skipped"); process.exit(0); }
console.log("[database] synchronizing PostgreSQL schema");
const executable = process.platform === "win32" ? "drizzle-kit.cmd" : "drizzle-kit";
const result = spawnSync(executable, ["push", "--force"], { stdio: "inherit", shell: true });
if (result.status !== 0) process.exit(result.status ?? 1);
