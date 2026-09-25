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

### Инвентаризация

Статический проход по `app/**/*.tsx` и `components/**/*.tsx` на этой ветке нашёл **146 уникальных импортируемых Lucide-компонентов**. В новый semantic-слой `AppIcon` сейчас сведена **51 продуктовая роль**; одна роль может намеренно выбирать другой glyph, поэтому это не 1:1 копия имён Lucide.

Основные места использования:

- глобальная/социальная навигация;
- настройки аккаунта;
- магазин и инвентарь;
- SuperFlip;
- профиль/визитка;
- войс;
- кланы;
- системные действия (закрыть, поиск, фильтр, сортировка, назад/вперёд).

### Карта замены для текущего релиза

| Модуль | Семантика | Было | Новый semantic icon | Статус |
|---|---|---|---|---|
| Навигация | Магазин | `ShoppingBag` напрямую | `store` | ✅ |
| Навигация | SuperFlip | `Crown` напрямую | `superflip` | ✅ |
| Магазин | Купить | текст / `ShoppingBag` | `buy` | ✅ |
| Магазин | Поиск | `Search` | `search` | ✅ |
| Магазин | Анимированный item | `Sparkles` | `animated` | ✅ |
| Инвентарь | Коллекция | `PackageOpen` | `inventory` | ✅ |
| Инвентарь | Надеть | `Check`/текст | `equip` | ✅ |
| Инвентарь | Снять | `X`/текст | `unequip` | ✅ |
| Инвентарь | Просмотр | `Eye` | `preview` | ✅ |
| SuperFlip | Premium | `Crown` | `superflip` | ✅ |
| SuperFlip | Upload | `FileUp` | `upload` | ✅ |
| SuperFlip | Messages | `MessageCircle` | `messages` | ✅ |
| SuperFlip | Style | `Palette` | `appearance` | ✅ |
| Системные | Закрыть | `X` | `close` | ✅ на мигрированных поверхностях |
| Системные | Фильтр | разрозненно | `filter` | ✅ semantic role |
| Системные | Сортировка | native select | `sort` | ✅ semantic role |

`AppIcon` является единой точкой смены визуального набора в дальнейшем. В этом PR через него уже проходят SuperFlip, Магазин, Инвентарь, Social navigation, global search, notification center, user dock и основная mobile/header navigation. Прямые Lucide-imports в старых специализированных экранах остаются совместимыми legacy-вызовами; отдельного старого asset-pack в bundle нет.

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


## 5. Финальный acceptance status

### Иконки

- ✅ Единый semantic `AppIcon` слой использует Lucide как источник glyphs, фиксированные `24×24`, `currentColor` и `strokeWidth=1.8`.
- ✅ SuperFlip, Store/Inventory, social/global navigation, account settings, notification/search surfaces и profile surfaces переведены на semantic names.
- ✅ Оставшиеся legacy Lucide SVG глобально нормализованы через `svg.lucide` до той же толщины линии и `currentColor`; отдельного старого SVG/icon-font pack в bundle нет.
- ✅ Декоративные `AppIcon` получают `aria-hidden`, функциональные icon-only кнопки сохраняют собственные `aria-label`.

### SuperFlip theme

- ✅ `data-theme="superflip"` scoped только на route root.
- ✅ Ключевые блоки используют `--sf-*` tokens и не читают `--accent` / `--theme-*`.
- ✅ Primary/secondary contrast на базовых поверхностях проверяется automated WCAG AA contract test.
- ✅ Палитра не задаётся inline-стилями в компоненте.

### Accent color

- ✅ Color picker/HEX UI удалён из пользовательских настроек.
- ✅ Runtime accent берётся из выбранной темы.
- ✅ Старые `accent_color` поля сохранены как deprecated для rollback.
- ✅ GET API больше не отдаёт user accent; PATCH игнорирует legacy `accentColor` и сохраняет accent выбранной темы.
- ✅ Старые пользовательские значения не мигрируются и визуально больше не применяются.
