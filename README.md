# FlipZero

FlipZero — платформа для сообществ с текстовыми и голосовыми каналами, профилями, уровнями и достижениями.

## Первый этап

- адаптивный интерфейс пространства сообщества;
- навигация по сообществам и каналам;
- лента сообщений и карточка еженедельного задания;
- профиль, уровень, XP и список участников;
- собственная тёмная дизайн-система и доступные состояния фокуса.

## Локальный запуск

Требуется Node.js 22.13 или новее.

```bash
pnpm install
pnpm dev
```

## Архитектура

Веб-клиент построен на Next.js 16, React 19 и TypeScript. Серверная часть работает на Next.js Route Handlers, данные хранятся в PostgreSQL через Drizzle ORM, production размещён на Vercel. Авторизация использует HttpOnly cookie-сессии (`users` + `sessions`). Голосовые комнаты работают через LiveKit.

Подробности: [архитектура](docs/ARCHITECTURE.md) и [дорожная карта](docs/ROADMAP.md).

## Проверка API

```bash
curl http://localhost:3000/api/health
```

## SuperFlip

SuperFlip подготовлен как подписка за `$4.99/месяц`. До подключения платёжного провайдера кнопка добавляет пользователя в лист ожидания.

- `GET /api/superflip/status` — статус текущего пользователя;
- `POST /api/superflip/purchase` — временная заглушка покупки / вступление в waitlist;
- `POST /api/admin/superflip/grant` — подарочная выдача администратором;
- `DELETE /api/admin/superflip/grant` — отзыв активных выдач.

## Друзья и личные сообщения

- `GET|POST|PATCH|DELETE /api/friends` — список, заявки, принятие/отклонение, удаление;
- `GET /api/users/search?q=...` — поиск по username;
- `GET|POST /api/messages` — диалоги и отправка личных сообщений. Клиент использует короткий polling-интервал 4 секунды, совместимый с Vercel Functions.

Канальные сообщения остаются в `messages`; личные сообщения изолированы в `direct_conversations`, `direct_conversation_members`, `direct_messages`.

## Администратор

Все административные API проверяют `users.platform_role` на сервере. Задайте `ADMIN_EMAIL` только в серверном окружении и один раз выполните `pnpm db:seed-admin` с доступом к production `DATABASE_URL`. Идемпотентный seed присвоит совпавшему существующему аккаунту роль `admin`; email не попадает в клиентский bundle или репозиторий.

Перед первым запуском этой версии примените `drizzle/0010_superflip_social_admin.sql` к PostgreSQL в отдельном контролируемом шаге. Production build намеренно не выполняет `push --force` и не изменяет БД автоматически.

- `GET|PATCH /api/admin/dashboard` — пользователи, бан, роль, сброс пароля, журналы и модерация;
- панель открывается встроенной кнопкой, которая возвращается в `/api/v1/auth/me` только пользователю с ролью admin.

## Windows-клиент

Клиент находится в `src-tauri` и загружает production-интерфейс `https://flipzero.app`. Сборка:

```bash
pnpm desktop:dev
pnpm desktop:build
```

Workflow `.github/workflows/windows-desktop.yml` собирает NSIS `.exe` на Windows при публикации тега `desktop-v*` и сохраняет установщик в GitHub Releases. Страница загрузки: `/download`.

## Тесты

```bash
pnpm test
pnpm lint
pnpm build
```
