import "server-only";
import { lookup } from "node:dns/promises";
import { request as httpsRequest } from "node:https";
import { isPrivateWebhookIp, validateWebhookUrl } from "@/lib/developer-validation";

export async function postPublicWebhook(rawUrl: string, payload: string, headers: Record<string, string>) {
  const valid = validateWebhookUrl(rawUrl);
  if (!valid.ok) throw new Error(valid.message);
  const url = new URL(valid.value);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const addresses = await Promise.race([
    lookup(url.hostname, { all: true, verbatim: true }),
    new Promise<never>((_resolve, reject) => { timer = setTimeout(() => reject(new Error("Webhook DNS lookup timed out")), 2_000); }),
  ]).finally(() => clearTimeout(timer));
  if (!addresses.length || addresses.some(({ address }) => isPrivateWebhookIp(address))) {
    throw new Error("Webhook target resolved to a private or reserved address");
  }
  const target = addresses[0];
  return new Promise<{ ok: boolean; status: number }>((resolve, reject) => {
    // Connect only to the address we checked, while retaining the original Host
    // and TLS servername. Node HTTPS does not follow redirects.
    const request = httpsRequest(url, {
      method: "POST",
      headers: { ...headers, "content-length": Buffer.byteLength(payload).toString() },
      agent: false,
      family: target.family,
      lookup: (_hostname, _options, callback) => callback(null, target.address, target.family),
      signal: AbortSignal.timeout(5_000),
    }, response => {
      const status = response.statusCode ?? 0;
      // Only headers are needed. Do not buffer an unbounded endpoint response.
      response.destroy();
      resolve({ ok: status >= 200 && status < 300, status });
    });
    request.on("error", reject);
    request.end(payload);
  });
}
