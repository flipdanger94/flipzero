import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

let database: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDatabase() {
  if (database) return database;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not configured");
  const client = postgres(connectionString, { max: 1, idle_timeout: 20, connect_timeout: 10, prepare: false });
  database = drizzle(client, { schema });
  return database;
}
