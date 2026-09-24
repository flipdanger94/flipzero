# FlipZero для Windows на Electron

Приложение открывает production FlipZero в отдельном окне. Для входа, сообщений и голосовой связи требуется интернет.

Из папки desktop-electron запустите npm install и npm start. Workflow Electron Windows создаёт установщик NSIS в артефакте FlipZero-Electron-Windows. Установщик пока не подписан сертификатом. Текущий Tauri-клиент остаётся отдельной сборкой.

## Цифровая подпись

Для подписанного установщика добавьте в GitHub → Settings → Secrets and variables → Actions два секрета:

- `CSC_LINK` — содержимое PFX-файла, закодированное в base64, или защищённый URL PFX;
- `CSC_KEY_PASSWORD` — пароль от PFX.

Используйте действительный сертификат Code Signing, выданный для владельца приложения. Закрытый ключ и пароль нельзя добавлять в Git или пересылать в открытом сообщении. После настройки запустите workflow `Electron Windows` вручную. Он проверяет Authenticode-подпись установщика и загружает артефакт `FlipZero-Electron-Windows-Signed` лишь при статусе `Valid`. Автоматическая сборка при push остаётся неподписанной и помечена `Unsigned`.
