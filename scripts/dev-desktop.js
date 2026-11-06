/**
 * OrbitGuard Desktop Development Launcher
 * Starts Vite dev server, waits for port 5173, compiles desktop TS, and launches Electron.
 */

const { spawn } = require('child_process');
const http = require('http');

console.log('[Dev-Desktop] Starting Vite renderer dev server...');
const vite = spawn('npm', ['run', 'dev', '--prefix', 'frontend'], {
  stdio: 'inherit',
  shell: true,
});

function waitForVite(callback, attempts = 0) {
  if (attempts > 30) {
    console.error('[Dev-Desktop] Timed out waiting for Vite dev server.');
    process.exit(1);
  }

  const req = http.get('http://localhost:5173', (res) => {
    callback();
  });

  req.on('error', () => {
    setTimeout(() => waitForVite(callback, attempts + 1), 500);
  });
}

waitForVite(() => {
  console.log('[Dev-Desktop] Vite dev server ready at http://localhost:5173. Compiling Electron main process...');

  const tsup = spawn(
    'npx',
    [
      'tsup',
      'desktop/main/index.ts',
      '--out-dir',
      'desktop/dist/main',
      '--format',
      'cjs',
      '--target',
      'node20',
      '&&',
      'npx',
      'tsup',
      'desktop/preload/index.ts',
      '--out-dir',
      'desktop/dist/preload',
      '--format',
      'cjs',
      '--target',
      'node20',
    ],
    { stdio: 'inherit', shell: true }
  );

  tsup.on('exit', (code) => {
    if (code !== 0) {
      console.error('[Dev-Desktop] Electron compilation failed.');
      process.exit(code);
    }

    console.log('[Dev-Desktop] Launching Electron...');
    const electron = spawn('npx', ['electron', '.'], {
      stdio: 'inherit',
      shell: true,
      env: { ...process.env, NODE_ENV: 'development', VITE_DEV_SERVER_URL: 'http://localhost:5173' },
    });

    electron.on('exit', () => {
      vite.kill();
      process.exit(0);
    });
  });
});

process.on('SIGINT', () => {
  vite.kill();
  process.exit(0);
});
