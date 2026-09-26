# AUDIT_STREAMING.md

## Scope

Аудит выполнен перед реализацией ТЗ «Стрим/скриншеринг в стиле Discord (полноэкранный просмотр, без записи)».

## Текущая инфраструктура

- Голос/видео уже построены на **LiveKit**; отдельный WebRTC/SFU с нуля проектировать не требуется.
- Канальные комнаты используют `VoiceRoom` и LiveKit room/participant state.
- Screen share публикуется отдельным `Track.Source.ScreenShare`; камера и screen share могут существовать параллельно.
- `participant.isScreenShareEnabled` уже входит в live snapshot участника, поэтому новый зритель видит активный стрим после подключения.
- Для screen-share треков уже используется selective subscription: невыбранные удалённые screen-share дорожки отписываются, выбранная подписывается при открытии стрима.
- Остановка/отвал стрима обрабатывается через `TrackUnpublished`: выбранный stream сбрасывается, fullscreen/focus закрывается.

## Найденная запись

Полноценного server-side recording pipeline/хранилища записей в текущем runtime не найдено. В `VoiceRoom` существовал UI «Запись» и LiveKit data-message протокол `recording-consent`, который запрашивал согласие участников, но сам поток не записывал.

В рамках этой задачи удалены:
- кнопка «Запись»;
- panel/notification согласия;
- data-message topic `recording-consent`;
- состояния и обработчики recording consent.

Таким образом активного пользовательского пути записи в voice UI больше нет.

## Реализация fullscreen

Добавлен application fullscreen viewer:
- открывается по клику «Открыть на весь экран» у активного screen share;
- выбранный screen share занимает всю площадь приложения;
- overlay показывает имя стримера;
- при нескольких стримах доступно переключение без выхода;
- доступны микрофон, системный fullscreen и закрытие;
- `Esc` возвращает обычный вид;
- stop/unpublish выбранного стрима автоматически закрывает viewer;
- мобильная версия учитывает safe-area.

## Оставшиеся границы

- Browser source picker (экран/окно/вкладка) контролируется системным `getDisplayMedia` UI браузера.
- Качество зависит от LiveKit adaptive stream/dynacast и браузерной реализации screen capture.
- Direct-call overlay пока не использует тот же расширенный screen-share viewer; данное ТЗ применено к канальному/клановому `VoiceRoom`.
