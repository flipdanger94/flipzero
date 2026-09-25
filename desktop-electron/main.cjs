/* eslint-disable @typescript-eslint/no-require-imports */
const { app, BrowserWindow, desktopCapturer, session, shell, Tray, Menu, nativeImage } = require('electron');
const path = require('node:path');
const ORIGIN = 'https://flipzeroapp.vercel.app';
const URL_APP = ORIGIN + '/app';
let win, tray, quitting = false;
function trusted(url) { try { return new URL(url).origin === ORIGIN && url.startsWith('https:'); } catch { return false; } }
function external(url) { try { if (['https:', 'mailto:'].includes(new URL(url).protocol)) shell.openExternal(url); } catch {} }
function createWindow() {
  win = new BrowserWindow({ width: 1320, height: 840, minWidth: 900, minHeight: 600, title: 'FlipZero', backgroundColor: '#151319', show: false, autoHideMenuBar: true, webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true } });
  win.once('ready-to-show', () => win.show());
  win.webContents.setWindowOpenHandler(({ url }) => { if (trusted(url)) win.loadURL(url); else external(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (event, url) => { if (!trusted(url)) { event.preventDefault(); external(url); } });
  win.webContents.on('did-fail-load', (_event, code, _description, url, mainFrame) => { if (mainFrame && code !== -3 && trusted(url)) win.loadFile(path.join(__dirname, 'offline.html')); });
  win.on('close', event => { if (tray && !quitting) { event.preventDefault(); win.hide(); } });
  win.on('closed', () => { win = null; });
  win.loadURL(URL_APP);
}
function createTray() {
  const icon = nativeImage.createFromPath(path.join(process.resourcesPath, 'icon.png'));
  if (icon.isEmpty()) return;
  tray = new Tray(icon.resize({ width: 32, height: 32 }));
  tray.setToolTip('FlipZero');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Открыть FlipZero', click: () => win?.show() },
    { label: 'Перезагрузить', click: () => win?.loadURL(URL_APP) },
    { type: 'separator' },
    { label: 'Выход', click: () => { quitting = true; app.quit(); } }
  ]));
  tray.on('double-click', () => win?.show());
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { win?.show(); win?.focus(); });
  app.whenReady().then(() => {
    session.defaultSession.setPermissionCheckHandler((_wc, permission, origin) => trusted(origin) && ['media', 'notifications', 'fullscreen'].includes(permission));
    session.defaultSession.setPermissionRequestHandler((wc, permission, callback) => callback(trusted(wc.getURL()) && ['media', 'notifications', 'fullscreen'].includes(permission)));
    session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
      const origin = request.frame?.url || request.securityOrigin || '';
      if (!trusted(origin)) { callback({}); return; }
      try {
        const sources = await desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize: { width: 320, height: 180 }, fetchWindowIcons: true });
        if (!sources.length) { callback({}); return; }
        let settled = false;
        const choose = (source) => {
          if (settled) return;
          settled = true;
          callback({ video: source, ...(request.audioRequested && process.platform === 'win32' ? { audio: 'loopback' } : {}) });
        };
        const menu = Menu.buildFromTemplate(sources.slice(0, 20).map(source => ({ label: source.name || 'Экран', click: () => choose(source) })));
        menu.once('menu-will-close', () => { setTimeout(() => { if (!settled) { settled = true; callback({}); } }, 0); });
        menu.popup({ window: win || undefined });
      } catch {
        callback({});
      }
    });
    createWindow(); createTray();
  });
}
app.on('before-quit', () => { quitting = true; });
app.on('window-all-closed', () => { if (!tray) app.quit(); });
