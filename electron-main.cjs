const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

let mainWindow = null;
let serverProcess = null;
const PORT = 3000;
const SERVER_URL = `http://localhost:${PORT}`;

// Kiểm tra xem server.js đã chạy trước chưa
function checkServerRunning(callback) {
  const req = http.get(`${SERVER_URL}/health`, (res) => {
    if (res.statusCode === 200) {
      callback(true);
    } else {
      callback(false);
    }
  });
  req.on('error', () => callback(false));
  req.setTimeout(1200, () => {
    req.destroy();
    callback(false);
  });
}

function startBackendServer(onReady) {
  checkServerRunning((running) => {
    if (running) {
      console.log('✔ Backend server is already running on port 3000');
      onReady();
      return;
    }

    console.log('🚀 Spawning background backend server (server.js)...');
    serverProcess = spawn('node', ['server.js'], {
      cwd: __dirname,
      stdio: 'inherit',
      shell: true,
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '' }
    });

    serverProcess.on('error', (err) => {
      console.error('Failed to spawn server.js:', err);
    });

    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      checkServerRunning((ok) => {
        if (ok || attempts >= 15) {
          clearInterval(interval);
          onReady();
        }
      });
    }, 400);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    title: 'Game Câu Cá 3D — TikTok Live Game',
    // Kích thước chuẩn tỷ lệ màn hình điện thoại dọc 9:16 (506 x 900 hoặc 540 x 960)
    width: 506,
    height: 900,
    minWidth: 360,
    minHeight: 640,
    useContentSize: true,
    autoHideMenuBar: true,
    backgroundColor: '#07141b',
    icon: path.join(__dirname, 'public/assets/Fish/thumb/Cá chép Koi.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false // Đảm bảo game chạy mượt 60fps kể cả khi cửa sổ bị khuất phía sau
    }
  });

  Menu.setApplicationMenu(null);

  const loadApp = () => {
    mainWindow.loadURL(SERVER_URL).catch(() => {
      console.log('Retrying connection to backend server...');
      setTimeout(loadApp, 1000);
    });
  };
  loadApp();

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  startBackendServer(() => {
    createWindow();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  if (serverProcess) {
    try {
      serverProcess.kill();
    } catch (_) { }
  }
});
