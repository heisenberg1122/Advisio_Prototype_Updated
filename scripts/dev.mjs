import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import net from 'node:net';
import { createRequire } from 'node:module';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const apiRequire = createRequire(path.join(root, 'apps/api/package.json'));
const dotenv = apiRequire('dotenv');
dotenv.config({ path: path.join(root, '.env') });
dotenv.config({ path: path.join(root, 'apps/api/.env'), override: true });

// Fail before launching either watcher so a second launch cannot leave a
// frontend on a different port while the API keeps failing to start.
function checkPort(port) {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', (error) => {
      reject(new Error(error.code === 'EADDRINUSE'
        ? `Port ${port} is already in use. Stop the existing server with Ctrl+C in its terminal, then run npm run dev again.`
        : `Cannot use port ${port}: ${error.message}`));
    });
    probe.listen({ port, exclusive: true }, () => probe.close(resolve));
  });
}

try {
  const apiPort = Number(process.env.PORT || 5000);
  if (!Number.isInteger(apiPort) || apiPort < 1 || apiPort > 65535) {
    throw new Error('PORT must be a number between 1 and 65535.');
  }
  const checks = await Promise.allSettled([checkPort(3000), checkPort(apiPort)]);
  const failure = checks.find((check) => check.status === 'rejected');
  if (failure) throw failure.reason;
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

if (process.platform === 'win32') {
  const database = spawnSync('powershell.exe', [
    '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File',
    path.join(root, 'scripts/start-local-db.ps1'),
  ], { cwd: root, stdio: 'inherit', windowsHide: true });
  if (database.error) {
    console.error(database.error.message);
    process.exit(1);
  }
  if (database.status !== 0) process.exit(database.status ?? 1);
}

const servers = [
  spawn(process.execPath, [path.join(root, 'node_modules/tsx/dist/cli.mjs'), 'watch', 'src/index.ts'], {
    cwd: path.join(root, 'apps/api'), stdio: 'inherit', windowsHide: true,
  }),
  spawn(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), '--port', '3000', '--strictPort'], {
    cwd: path.join(root, 'apps/web'), stdio: 'inherit', windowsHide: true,
  }),
];

let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const server of servers) {
    if (server.pid && server.exitCode === null) {
      if (process.platform === 'win32') {
        spawnSync('taskkill', ['/pid', String(server.pid), '/t', '/f'], { stdio: 'ignore', windowsHide: true });
      } else {
        server.kill('SIGTERM');
      }
    }
  }
  process.exit(code);
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
for (const server of servers) {
  server.on('error', (error) => { console.error(error); stop(1); });
  server.on('exit', (code) => stop(code ?? 1));
}
