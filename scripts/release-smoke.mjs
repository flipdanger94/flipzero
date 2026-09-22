const baseUrl = (process.argv[2] ?? process.env.FLIPZERO_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");

const checks = [];

async function request(path, expectedStatus) {
  const startedAt = Date.now();
  const response = await fetch(`${baseUrl}${path}`, {
    redirect: "manual",
    headers: { "user-agent": "flipzero-release-smoke/1.0" },
  });
  const durationMs = Date.now() - startedAt;
  const body = await response.text();

  if (response.status !== expectedStatus) {
    throw new Error(`${path}: expected HTTP ${expectedStatus}, got ${response.status}. Body: ${body.slice(0, 300)}`);
  }

  checks.push({ path, status: response.status, durationMs });
  return { response, body };
}

async function main() {
  const health = await request("/api/health", 200);
  const healthJson = JSON.parse(health.body);

  if (healthJson.service !== "flipzero-web" || healthJson.status !== "ok") {
    throw new Error(`/api/health: unexpected payload ${health.body.slice(0, 500)}`);
  }

  if (healthJson.checks?.database?.status !== "ok") {
    throw new Error("/api/health: database check is not ok");
  }

  await request("/", 200);
  await request("/login", 200);

  // Security boundaries: anonymous callers must not receive private developer/user data.
  await request("/api/public/v1/me", 401);
  await request("/api/v1/developer/apps", 401);

  console.table(checks);
  console.log(`Release smoke passed for ${baseUrl}`);
}

main().catch((error) => {
  console.error("Release smoke failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
