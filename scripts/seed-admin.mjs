const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
if (!adminEmail) throw new Error("ADMIN_EMAIL is required");

const { default: postgres } = await import("postgres");
const client = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });
const rows = await client`UPDATE users SET platform_role = 'admin', updated_at = now() WHERE lower(email) = ${adminEmail} RETURNING id`;
await client.end();

if (!rows.length) throw new Error("Admin account was not found. Register it first, then run the seed again.");
console.log("[database] admin role assigned");
