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

Одноразовый защищённый мастер `/setup/release-0010` применяет идемпотентную миграцию и admin seed только после входа в аккаунт, email которого совпадает с серверным `ADMIN_EMAIL`. Общий небезопасный `drizzle-kit push --force` при сборке не используется.

- `GET|PATCH /api/admin/dashboard` — пользователи, бан, роль, сброс пароля, журналы и модерация;
- панель открывается встроенной кнопкой, которая возвращается в `/api/v1/auth/me` только пользователю с ролью admin.

## Windows-клиент

Клиент находится в `src-tauri` и загружает production-интерфейс `https://flipzeroapp.vercel.app/app`. Сборка:

```bash
pnpm desktop:dev
pnpm desktop:build
```

Workflow `.github/workflows/windows-desktop.yml` автоматически собирает NSIS `.exe` при изменениях десктопного клиента в `main`, создаёт GitHub Release `desktop-v<version>` и публикует файл `FlipZero_<version>_x64-setup.exe`. Его также можно запустить вручную через GitHub Actions. Страница загрузки: `/download`.

## Тесты

```bash
pnpm test
pnpm lint
pnpm build
```


## UI reference implementation (22.09.2026)

Ветка `feat/reference-ui-2026-09-22` используется для внедрения нового интерфейса FlipZero по утверждённым макетам. Целевые поверхности:

- профиль пользователя: баннер, аватар, статус, роли, награды, статистика, активность, медиа и общие серверы/друзья;
- Обзор: hero-блок, категории, карточки рекомендуемых/популярных серверов и фильтры;
- сервер/чат: rail серверов, каналы, голосовые комнаты с видимыми участниками, чат, реакции, список участников;
- Админ-панель: метрики, пользователи, роли, блокировки, SuperFlip, аудит и системные статусы;
- SuperFlip: промо-hero, преимущества, состояние подписки и тарифы;
- Сообщения/друзья: список диалогов, чат, карточка профиля собеседника, поиск и заявки в друзья.

### Как опубликовать изменения в `main`

После проверки ветки создайте Pull Request из `feat/reference-ui-2026-09-22` в `main`, дождитесь успешных проверок и выполните squash merge. Локально эквивалентный поток:

```bash
git fetch origin
git checkout feat/reference-ui-2026-09-22
pnpm install
pnpm lint
pnpm test
pnpm build

git checkout main
git pull --ff-only origin main
git merge --no-ff feat/reference-ui-2026-09-22
git push origin main
```

### Деплой на Vercel

1. В Vercel импортируйте репозиторий `flipdanger94/flipzero`.
2. Framework Preset: Next.js.
3. Production Branch: `main`.
4. Install Command: `pnpm install`.
5. Build Command: `pnpm build`.
6. Добавьте переменные окружения из `.env.example` и production-значения `DATABASE_URL`, `ADMIN_EMAIL`, LiveKit и остальных используемых интеграций.
7. После merge в `main` Vercel автоматически создаст production deployment, если Git Integration включена.
8. Для ручной публикации: Vercel → Project → Deployments → Redeploy последнего deployment из `main`.

Перед production-deploy обязательно выполните `pnpm lint && pnpm test && pnpm build`.

### Восстановление пароля

После обновления кода администратор применяет `/setup/release-0017` (после `/setup/release-0016`). Для писем настройте в Vercel серверные переменные `RESEND_API_KEY` и `RESET_EMAIL_FROM` (подтверждённый адрес отправителя), а также `PASSWORD_RESET_BASE_URL=https://flipzeroapp.vercel.app`. Ссылка действует 30 минут и используется один раз. Смена пароля завершает все старые сеансы. До настройки отправителя форма возвращает сообщение о недоступности отправки писем.

<!-- deployment pipeline check: 2026-09-22 -->
