export type FlipZeroClientOptions = { token: string; baseUrl?: string };

export type FlipZeroAuthorizationUrlOptions = {
  clientId: string;
  redirectUri: string;
  scopes?: string[];
  state?: string;
  codeChallenge?: string;
  baseUrl?: string;
};

export type FlipZeroTokenExchangeOptions = {
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
  codeVerifier?: string;
  baseUrl?: string;
};

export type FlipZeroOAuthToken = {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  scope: string;
};

export function createFlipZeroAuthorizationUrl(options: FlipZeroAuthorizationUrlOptions) {
  const baseUrl = (options.baseUrl ?? "https://flipzeroapp.vercel.app").replace(/\/$/, "");
  const url = new URL(`${baseUrl}/oauth/authorize`);
  url.searchParams.set("client_id", options.clientId);
  url.searchParams.set("redirect_uri", options.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", (options.scopes?.length ? options.scopes : ["identify"]).join(" "));
  if (options.state) url.searchParams.set("state", options.state);
  if (options.codeChallenge) {
    url.searchParams.set("code_challenge", options.codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");
  }
  return url.toString();
}

export async function exchangeFlipZeroAuthorizationCode(options: FlipZeroTokenExchangeOptions): Promise<FlipZeroOAuthToken> {
  const baseUrl = (options.baseUrl ?? "https://flipzeroapp.vercel.app/api/public/v1").replace(/\/$/, "");
  const response = await fetch(`${baseUrl}/oauth/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: options.code,
      client_id: options.clientId,
      client_secret: options.clientSecret,
      redirect_uri: options.redirectUri,
      ...(options.codeVerifier ? { code_verifier: options.codeVerifier } : {}),
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error_description ?? data?.error ?? `FlipZero OAuth error ${response.status}`);
  return data as FlipZeroOAuthToken;
}

export class FlipZeroClient {
  private token: string;
  private baseUrl: string;

  constructor(options: FlipZeroClientOptions) {
    this.token = options.token;
    this.baseUrl = (options.baseUrl ?? "https://flipzeroapp.vercel.app/api/public/v1").replace(/\/$/, "");
  }

  private async request<T>(path: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, { headers: { authorization: `Bearer ${this.token}`, accept: "application/json" } });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error?.message ?? `FlipZero API error ${response.status}`);
    return data as T;
  }

  me() {
    return this.request<{ application: { id: string; name: string }; owner: { id: string; username: string; displayName: string }; scopes: string[] }>("/me");
  }

  spaces() {
    return this.request<{ data: Array<{ id: string; name: string; slug: string; description: string | null; visibility: string; accentColor: string }>; meta: { count: number } }>("/spaces");
  }
}
