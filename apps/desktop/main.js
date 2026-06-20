// Insight Asset OS — Electron main process
// 流程：app.whenReady() → 设 userData env → 启动 next start 子进程 → 等 3000 ready → BrowserWindow 加载 3000
// 退出：kill next start

const { app, BrowserWindow, shell } = require('electron');
const { spawn } = require('child_process');
const net = require('net');
const path = require('path');
const fs = require('fs');

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

/**
 * 设 userData 路径给 packaged 模式
 *
 * 关键修复（v1.1.1）：
 * v1.0 / v1.1.0 桌面 .app 启动时没设 INSIGHT_APP_DATA_DIR，导致 db 写到
 * .app bundle 内（process.resourcesPath/web-pkg/storage/insight.db）。
 * 升级 .app 时老 bundle 被删，老 db 跟着没。
 *
 * 修法：packaged 模式启动时强制用 app.getPath('userData')/storage/，
 * 同步设 INSIGHT_APP_DATA_DIR env 给 next start 子进程。
 *
 * 同时：自动迁移老 .app bundle 内的 db（v1.0 / v1.1.0 残留数据）
 */
function setupUserDataDir() {
  if (isDev) return;

  const userDataDir = app.getPath('userData');
  const storageDir = path.join(userDataDir, 'storage');
  fs.mkdirSync(storageDir, { recursive: true });

  // v1.1.1 修复：强制写到 userData，不写到 .app bundle
  process.env.INSIGHT_APP_DATA_DIR = storageDir;

  // 自动迁移：老 .app bundle 内的 db（如果存在）拷到 userData
  // v1.0 / v1.1.0 写过两个位置（client.ts 的 fallback candidates）：
  //   - WEB_DIR/storage/insight.db        (cwd/storage)
  //   - WEB_DIR/apps/web/storage/insight.db (cwd/apps/web/storage, 这是 .app bundle 内)
  // 都要检查（.app bundle 是只读覆盖，但 v1.1.1 第一次启动时还能读）
  const newDb = path.join(storageDir, 'insight.db');
  if (fs.existsSync(newDb)) {
    console.log(`[main] userData db exists, skip migration: ${newDb}`);
    return;
  }

  const candidates = [
    path.join(WEB_DIR, 'apps', 'web', 'storage', 'insight.db'),
    path.join(WEB_DIR, 'storage', 'insight.db'),
  ];

  for (const oldDb of candidates) {
    if (!fs.existsSync(oldDb)) continue;
    console.log(`[migrate] copying db from .app bundle to userData: ${oldDb} -> ${newDb}`);
    try {
      fs.copyFileSync(oldDb, newDb);
      const wal = oldDb + '-wal';
      const shm = oldDb + '-shm';
      if (fs.existsSync(wal)) fs.copyFileSync(wal, newDb + '-wal');
      if (fs.existsSync(shm)) fs.copyFileSync(shm, newDb + '-shm');
      console.log('[migrate] db migration complete');
      break;
    } catch (e) {
      console.error('[migrate] failed:', e.message);
    }
  }

  console.log(`[main] userData dir: ${storageDir}`);
}

app.whenReady().then(async () => {
  try {
    setupUserDataDir();
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
