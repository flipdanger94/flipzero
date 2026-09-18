export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { logEvent } = await import("./lib/observability");
    logEvent("info", "runtime_ready", { region: process.env.VERCEL_REGION ?? "local", commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local" });
  }
}
