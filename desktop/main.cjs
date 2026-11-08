const { app, BrowserWindow, protocol, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

protocol.registerSchemesAsPrivileged([{
  scheme: 'app',
  privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true },
}]);

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function registerAppFiles() {
  const root = path.resolve(app.getAppPath(), 'frontend', 'dist');
  protocol.handle('app', (request) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response(null, { status: 405 });
    let requested;
    try { requested = decodeURIComponent(new URL(request.url).pathname); }
    catch { return new Response('Bad path', { status: 400 }); }
    const target = path.resolve(root, `.${requested}`);
    if (target !== root && !target.startsWith(`${root}${path.sep}`)) return new Response('Forbidden', { status: 403 });
    let stat;
    try { stat = fs.statSync(target); }
    catch { return new Response('Not found', { status: 404 }); }
    if (!stat.isFile()) return new Response('Not found', { status: 404 });
    const headers = {
      'Content-Type': mime[path.extname(target)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    };
    if (path.basename(target) === 'index.html') {
      headers['Content-Security-Policy'] = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: https://www.isro.gov.in; connect-src 'self' https://raw.githubusercontent.com; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'";
    }
    return new Response(request.method === 'HEAD' ? null : fs.readFileSync(target), { status: 200, headers });
  });
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1600,
    height: 980,
    minWidth: 1040,
    minHeight: 700,
    title: 'India Orbit Watch',
    backgroundColor: '#08131c',
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url);
    return { action: 'deny' };
  });
  void window.loadURL('app://orbit-watch/index.html');
}

app.whenReady().then(() => {
  registerAppFiles();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
