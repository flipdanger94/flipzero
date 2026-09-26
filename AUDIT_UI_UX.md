# AUDIT_UI_UX.md

## Scope

Аудит выполнен по ТЗ «UI/UX профиля, тематические анимированные предметы магазина, UI/UX всего приложения» с приоритетом: профиль → магазин/инвентарь → общий фундамент.

## Дизайн-система

До задачи в проекте уже существовали theme variables (`--bg`, `--panel`, `--deep`, `--raised`, `--text`, `--muted`, `--border`, `--accent`), но не было полного семантического слоя из ТЗ.

Добавлен семантический слой:
- colors: `--color-bg-*`, `--color-text-*`, `--color-border`, `--color-accent`, success/warning/danger;
- typography scale `--text-xs … --text-4xl`;
- spacing `--space-1 … --space-12`;
- radii `--radius-sm/md/lg/pill`;
- shadows `--shadow-card/elevated/glow`;
- motion `--ease-standard`, `--duration-*`;
- единый visible focus outline для интерактивных элементов;
- reduced-motion fallback.

## Полный профиль

Подтверждённые проблемы:
- modal был жёстко ограничен `980×700` и колонкой `340px`, из-за чего на промежуточных размерах возникал визуальный дисбаланс и большое пустое поле;
- основной контент имел большой верхний padding и не использовал доступную высоту;
- mobile layout ограничивал aside через `max-height`, создавая две конкурирующие scroll areas;
- экипированные предметы были показаны частично: avatar frame/banner/nameplate/badge/profile effect были разбросаны по header, но не было единой витрины и реального preview chat style.

Исправлено:
- modal расширяется до `1180×820` и лучше использует viewport;
- main получил собственный стабильный scroll и нормальный вертикальный ритм;
- tabs sticky внутри main;
- empty/activity state стал явной карточкой вместо пустого пространства;
- mobile profile разбит на предсказуемые header/content rows с safe-area;
- добавлена витрина всех шести профильных слотов: avatar decoration, profile effect, banner, nameplate, badge, chat style.

## Магазин / тематические предметы

Существующая база уже поддерживает:
- `previewImage` + `previewAnimation`;
- CSS/WebM/MP4/JSON animation sources;
- live preview только при активном/hover контексте;
- pause для анимации вне live режима.

Добавлена коллекция **«Птицы»**:
- avatar decoration «Небесная птица»;
- profile effect «Перо»;
- banner «Полёт на рассвете»;
- badge «Синее крыло»;
- bundle «Птицы».

Анимации CSS-based, имеют статичное первое состояние без JS, seamless/subtle idle loops и запускаются только в live-preview контексте.

## Общий UI/UX

Текущий код всё ещё содержит большое количество legacy hardcoded цветов/px в старых CSS-файлах. Полная миграция каждого экрана на новые токены — отдельный горизонтальный проход. В этой ветке добавлен фундамент и исправлены приоритетные поверхности из ТЗ; последующий проход должен последовательно заменить legacy hardcodes в settings/onboarding/system states без визуального регресса.
