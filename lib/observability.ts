type LogLevel = "info" | "warn" | "error";

export function logEvent(level: LogLevel, message: string, fields: Record<string, unknown> = {}) {
  const payload = JSON.stringify({ level, message, service: "flipzero-web", timestamp: new Date().toISOString(), ...fields });
  if (level === "error") console.error(payload);
  else if (level === "warn") console.warn(payload);
  else console.log(payload);
}

export function requestId(request: Request) {
  return request.headers.get("x-vercel-id") ?? request.headers.get("x-request-id") ?? crypto.randomUUID();
}
