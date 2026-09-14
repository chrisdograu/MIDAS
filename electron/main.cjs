// Rodada 18 — empacotamento do Backoffice (Desktop) com Electron.
// Dev:  npm run build && npx electron electron/main.cjs
// Dist: npx electron-builder  (gera .exe / .dmg / .AppImage)
const { app, BrowserWindow, shell, Menu } = require('electron');
const path = require('node:path');

const DEV_URL = process.env.MIDIAS_DEV_URL || '';

// Rodada 24 · item 6 — remove o menu nativo do Electron (File/Edit/View/Window),
// que não faz parte da identidade visual do MIDIAS.
Menu.setApplicationMenu(null);

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    backgroundColor: '#0b0f14',
    title: 'MIDIAS — Backoffice',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (DEV_URL) {
    win.loadURL(`${DEV_URL.replace(/\/$/, '')}/desktop`);
  } else {
    // build estático: entrada forçada em /desktop
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { hash: '/desktop' });
  }

  // Links externos abrem no navegador do sistema, nunca dentro da janela.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
