# AUDIT_ICONS_THEME.md

Дата: 26 сентября 2026  
Ветка: `feat/icons-superflip-theme-fixed-accent`

## 1. Иконки

### Текущий источник

Функциональные UI-иконки проекта приходят из npm-пакета `lucide-react` (`package.json`: `^1.31.0`). Отдельного icon-font, SVG sprite или параллельного набора UI-иконок в репозитории нет.

Локальные графические ассеты в `public/` — это бренд/PWA, а не набор интерфейсных иконок:

- `public/brand-mark.svg`
- `public/favicon.svg`
- `public/apple-touch-icon.png`
- `public/pwa-icon-192.{png,svg}`
- `public/pwa-icon-512.{png,svg}`
- `public/pwa-icon-maskable.{png,svg}`

Следовательно, миграция — **структурная поверх существующей библиотеки**: вводится единый semantic `AppIcon`-компонент с фиксированными `24×24`, `currentColor` и `strokeWidth`, а ключевые продуктовые поверхности переводятся на семантические имена. Старые локальные SVG удалять не требуется — отдельного старого UI-pack нет.

### Основные места использования

- глобальная/социальная навигация;
- настройки аккаунта;
- магазин и инвентарь;
- SuperFlip;
- профиль/визитка;
- войс;
- кланы;
- системные действия (закрыть, поиск, фильтр, сортировка, назад/вперёд).

### Карта замены для текущего релиза

| Модуль | Семантика | Было | Новый semantic icon |
|---|---|---|---|
| Навигация | Магазин | `ShoppingBag` напрямую | `store` |
| Навигация | SuperFlip | `Crown` напрямую | `superflip` |
| Магазин | Купить | текст / `ShoppingBag` | `buy` |
| Магазин | Поиск | `Search` | `search` |
| Магазин | Анимированный item | `Sparkles` | `animated` |
| Инвентарь | Коллекция | `PackageOpen` | `inventory` |
| Инвентарь | Надеть | `Check`/текст | `equip` |
| Инвентарь | Снять | `X`/текст | `unequip` |
| Инвентарь | Просмотр | `Eye` | `preview` |
| SuperFlip | Premium | `Crown` | `superflip` |
| SuperFlip | Upload | `FileUp` | `upload` |
| SuperFlip | Messages | `MessageCircle` | `messages` |
| SuperFlip | Style | `Palette` | `appearance` |
| Системные | Закрыть | `X` | `close` |
| Системные | Фильтр | разрозненно | `filter` |
| Системные | Сортировка | native select | `sort` |

`AppIcon` является единой точкой смены визуального набора в дальнейшем. Все новые/переделываемые экраны в этом PR используют его вместо прямых imports из `lucide-react`.

## 2. Accent color

Сейчас есть **два устаревающих хранилища цвета**:

1. `user_preferences.accent_color` — runtime accent темы, читается `PreferencesProvider` и редактируется в `PersonalizationSettings`.
2. `users.accent_color` — исторический профильный accent, отдаётся public-profile API и прокидывается в `--profile-accent`.

Runtime UI использует `--accent` в `app/themes.css` / `app/runtime-theme.css`. Встроенные темы уже содержат собственный `accent` в `config/themes.json`.

Решение релиза:

- оба DB-поля **не удаляются** для rollback/backward compatibility;
- frontend перестаёт читать пользовательский accent;
- `user_preferences.accent_color` остаётся deprecated и при сохранении синхронизируется с `theme.accent`;
- старые клиенты могут продолжать присылать `accentColor` — поле игнорируется;
- профильные поверхности используют `var(--accent)`, а не `users.accent_color`;
- color picker / HEX input удаляются из настроек.

## 3. Темы

Основная система тем:

- built-ins: `config/themes.json`;
- runtime loader: `PreferencesProvider`;
- CSS bridge: `app/themes.css` + `app/runtime-theme.css`;
- выбранная тема хранится в `user_preferences.theme`.

SuperFlip сейчас использует CSS Module, но его цвета захардкожены непосредственно в `superflip.module.css`. Отдельного theme layer нет.

Решение:

- корень `/superflip` получает `data-theme="superflip"`;
- все семь ключевых блоков страницы переводятся на scoped `--sf-*` tokens;
- переменные объявляются только внутри `.page[data-theme="superflip"]`, поэтому не протекают в основной интерфейс;
- SuperFlip не читает `--accent` основной темы;
- контраст primary/secondary text проверяется contract-тестом.

## 4. Риски / совместимость

- DB-миграция для удаления accent не требуется в этом релизе.
- API старых клиентов не должен падать, если они по-прежнему присылают `accentColor`.
- `users.accent_color` сохраняется в данных, но становится визуально неактивным.
- Brand/PWA SVG не относятся к UI icon migration и сохраняются.
