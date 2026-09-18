export type FlipZeroClientOptions = { token: string; baseUrl?: string };

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
