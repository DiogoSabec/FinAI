const { app, BrowserWindow, shell, Menu } = require('electron');
const path = require('path');
const net = require('net');
const { pathToFileURL } = require('url');

const isDev = !app.isPackaged;

function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

async function waitForServer(port, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`http://localhost:${port}/api/health`);
      if (res.ok) return;
    } catch {
      // not yet listening
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`Embedded API server did not become ready within ${timeoutMs}ms`);
}

async function startEmbeddedServer() {
  const port = await getFreePort();
  process.env.PORT = String(port);
  process.env.FINAI_ELECTRON = '1';
  process.env.FINAI_DB_PATH = path.join(app.getPath('userData'), 'finances.db');
  process.env.FINAI_CLIENT_DIST = path.join(app.getAppPath(), 'client', 'dist');

  const serverEntry = path.join(app.getAppPath(), 'server', 'index.js');
  await import(pathToFileURL(serverEntry).href);

  await waitForServer(port);
  return port;
}

async function loadWithRetry(win, url, attempts = 50, delay = 200) {
  for (let i = 0; i < attempts; i++) {
    try {
      await win.loadURL(url);
      return;
    } catch (error) {
      if (i === attempts - 1) throw error;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

function createWindow(url) {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#0f0e0d',
    title: 'FinAI',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (process.platform !== 'darwin') {
    Menu.setApplicationMenu(null);
  }

  loadWithRetry(win, url).catch((err) => {
    console.error('Failed to load app URL:', err);
  });

  win.webContents.setWindowOpenHandler(({ url: target }) => {
    if (/^https?:\/\//i.test(target)) {
      shell.openExternal(target);
      return { action: 'deny' };
    }
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, target) => {
    const allowedHost = new URL(url).host;
    try {
      const targetHost = new URL(target).host;
      if (targetHost !== allowedHost) {
        event.preventDefault();
        shell.openExternal(target);
      }
    } catch {
      event.preventDefault();
    }
  });

  return win;
}

app.whenReady().then(async () => {
  let appUrl;

  if (isDev) {
    appUrl = process.env.FINAI_DEV_URL || 'http://localhost:5173';
  } else {
    const port = await startEmbeddedServer();
    appUrl = `http://localhost:${port}`;
  }

  createWindow(appUrl);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow(appUrl);
  });
}).catch((err) => {
  console.error('Electron failed to start:', err);
  app.quit();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
