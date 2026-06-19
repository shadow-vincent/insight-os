// Insight Asset OS — Electron main process
// 流程：app.whenReady() → 启动 next start 子进程 → 等 3000 ready → BrowserWindow 加载 3000
// 退出：kill next start

const { app, BrowserWindow, shell } = require('electron');
const { spawn } = require('child_process');
const net = require('net');
const path = require('path');

const PORT = 3000;
const isDev = process.argv.includes('--dev');
const isPackaged = !process.defaultApp;

// In dev: __dirname = apps/desktop, web is at ../web
// In packaged: __dirname = asar://, web resources are at Resources/.next
const WEB_DIR = isPackaged
  ? path.join(process.resourcesPath, 'web-pkg')
  : path.join(__dirname, '..', 'web');

let mainWindow = null;
let nextServer = null;

function waitForPort(port, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    function attempt() {
      const socket = new net.Socket();
      const timer = setTimeout(() => { socket.destroy(); retry(); }, 500);
      socket.once('connect', () => { clearTimeout(timer); socket.destroy(); resolve(); });
      socket.once('error', () => { clearTimeout(timer); socket.destroy(); retry(); });
      socket.connect(port, '127.0.0.1');
    }
    function retry() {
      if (Date.now() - start > timeoutMs) return reject(new Error('next start timeout'));
      setTimeout(attempt, 250);
    }
    attempt();
  });
}

async function startNextServer() {
  let cmd, args, cwd;
  if (isDev) {
    cmd = 'npx';
    args = ['next', 'dev', '--port', String(PORT)];
    cwd = WEB_DIR;
  } else {
    // Packaged: use Electron's bundled node (ELECTRON_RUN_AS_NODE) to run next binary
    cmd = process.execPath;
    args = [path.join(WEB_DIR, 'node_modules', 'next', 'dist', 'bin', 'next'), 'start', '--port', String(PORT)];
    cwd = WEB_DIR;
  }

  const env = { ...process.env, PORT: String(PORT), HOSTNAME: '127.0.0.1', NODE_ENV: isDev ? 'development' : 'production' };
  if (!isDev) {
    env.ELECTRON_RUN_AS_NODE = '1';
  }

  nextServer = spawn(cmd, args, {
    cwd,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  nextServer.stdout.on('data', (data) => {
    process.stdout.write(`[next] ${data}`);
  });
  nextServer.stderr.on('data', (data) => {
    process.stderr.write(`[next] ${data}`);
  });
  nextServer.on('exit', (code) => {
    console.log(`[next] exited with code ${code}`);
  });

  await waitForPort(PORT);
  console.log(`[main] next server ready on port ${PORT}`);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'Insight OS',
    backgroundColor: '#0a0e1a',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadURL(`http://127.0.0.1:${PORT}`);

  // 打开新窗口时用系统浏览器（不让 Electron 内部开新窗口）
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function killNextServer() {
  if (nextServer && !nextServer.killed) {
    console.log('[main] killing next server');
    try {
      nextServer.kill('SIGTERM');
    } catch (e) {
      console.error('[main] failed to kill next server:', e);
    }
  }
}

app.whenReady().then(async () => {
  try {
    await startNextServer();
    createWindow();
  } catch (err) {
    console.error('[main] failed to start:', err);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  killNextServer();
  app.quit();
});

app.on('before-quit', () => {
  killNextServer();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
