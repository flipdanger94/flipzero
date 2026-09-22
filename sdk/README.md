# FlipZero TypeScript SDK

## API key

```ts
import { FlipZeroClient } from "./flipzero";

const flipzero = new FlipZeroClient({ token: process.env.FLIPZERO_API_TOKEN! });
const profile = await flipzero.me();
const spaces = await flipzero.spaces();
```

Никогда не помещайте API-ключ в браузерный JavaScript. Храните его в переменной окружения.

Доступные API scopes:

- `profile:read` — сведения о приложении и владельце;
- `spaces:read` — список сообществ владельца приложения.

## OAuth Authorization Code

```ts
import {
  createFlipZeroAuthorizationUrl,
  exchangeFlipZeroAuthorizationCode,
  FlipZeroClient,
} from "./flipzero";

const authorizationUrl = createFlipZeroAuthorizationUrl({
  clientId: process.env.FLIPZERO_CLIENT_ID!,
  redirectUri: "https://example.com/oauth/callback",
  scopes: ["identify", "spaces:read"],
  state: "csrf-state-from-your-session",
});

// После возврата пользователя на callback:
const oauth = await exchangeFlipZeroAuthorizationCode({
  clientId: process.env.FLIPZERO_CLIENT_ID!,
  clientSecret: process.env.FLIPZERO_CLIENT_SECRET!,
  code: callbackCode,
  redirectUri: "https://example.com/oauth/callback",
});

const flipzero = new FlipZeroClient({ token: oauth.access_token });
const profile = await flipzero.me();
```

Для публичных клиентов используйте PKCE S256: передайте `codeChallenge` в authorization URL и соответствующий `codeVerifier` при обмене кода. Authorization code одноразовый и короткоживущий.

OAuth scopes:

- `identify` — ID, username и display name пользователя;
- `profile:read` — базовый профиль;
- `spaces:read` — список сообществ пользователя.
