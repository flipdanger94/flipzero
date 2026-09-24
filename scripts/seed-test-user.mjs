const isCodespaces = process.env.CODESPACES === "true";
const explicitlyAllowed = process.env.ALLOW_TEST_USER_SEED === "1";

if (!isCodespaces && !explicitlyAllowed) {
  throw new Error("Test-user seed is disabled outside GitHub Codespaces. Set ALLOW_TEST_USER_SEED=1 only for an isolated test database.");
}
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

const email = (process.env.TEST_USER_EMAIL || "test@flipzero.local").trim().toLowerCase();
const username = (process.env.TEST_USER_USERNAME || "flipzero_test").trim();
const displayName = (process.env.TEST_USER_DISPLAY_NAME || "FlipZero Test").trim();
const password = process.env.TEST_USER_PASSWORD || "Test123456!";

if (password.length < 10) throw new Error("TEST_USER_PASSWORD must be at least 10 characters");

const [{ default: postgres }, { hash }] = await Promise.all([
  import("postgres"),
  import("bcryptjs"),
]);

const client = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });
const passwordHash = await hash(password, 12);

try {
  const existing = await client`
    SELECT id, email, username
    FROM users
    WHERE lower(email) = ${email} OR username = ${username}
    LIMIT 1
  `;

  if (existing.length) {
    await client`
      UPDATE users
      SET
        email = ${email},
        username = ${username},
        display_name = ${displayName},
        password_hash = ${passwordHash},
        banned_at = NULL,
        ban_reason = NULL,
        onboarding_completed = true,
        onboarding_step = 999,
        updated_at = now()
      WHERE id = ${existing[0].id}
    `;
    console.log("[database] test user updated");
  } else {
    const { randomUUID } = await import("node:crypto");
    await client`
      INSERT INTO users (
        id, email, username, display_name, password_hash,
        onboarding_completed, onboarding_step, created_at, updated_at
      )
      VALUES (
        ${randomUUID()}, ${email}, ${username}, ${displayName}, ${passwordHash},
        true, 999, now(), now()
      )
    `;
    console.log("[database] test user created");
  }

  console.log("[database] login email:", email);
  console.log("[database] login username:", username);
  console.log("[database] password: use TEST_USER_PASSWORD or the local default documented in README");
} finally {
  await client.end();
}
