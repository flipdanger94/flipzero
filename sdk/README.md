# FlipZero TypeScript SDK

```ts
import { FlipZeroClient } from "./flipzero";

const flipzero = new FlipZeroClient({ token: process.env.FLIPZERO_API_TOKEN! });
const profile = await flipzero.me();
const spaces = await flipzero.spaces();
```

Никогда не помещайте API-ключ в браузерный JavaScript. Используйте SDK только на сервере и храните ключ в переменной окружения `FLIPZERO_API_TOKEN`.

Доступные scopes:

- `profile:read` — сведения о приложении и владельце;
- `spaces:read` — список сообществ владельца приложения.
