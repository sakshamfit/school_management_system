#!/usr/bin/env node
/**
 * Desktop development launcher.
 *
 * Starts Vite (renderer HMR) and then Electron pointed at the dev server.
 * Usage: npm run desktop:dev
 *
 * Environment overrides:
 *   SMS_LICENSE_SERVER_URL  point the desktop shell at a local license server
 *                           (e.g. http://127.0.0.1:8787 — run `npm run license-server`)
 *   SMS_ENV                 development | staging | production
 */

import { spawn } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.VITE_PORT || '3000';

const vite = spawn('npx', ['vite', '--port', PORT, '--host=0.0.0.0'], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env },
});

function waitForServer(url, timeoutMs = 60000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve();
      });
      req.on('error', () => {
        if (Date.now() - started > timeoutMs) reject(new Error('Vite dev server did not start'));
        else setTimeout(tick, 700);
      });
    };
    tick();
  });
}

let electron = null;

async function main() {
  await waitForServer(`http://127.0.0.1:${PORT}/`);
  // eslint-disable-next-line no-console
  console.log('[dev-desktop] Vite ready — launching Electron…');

  electron = spawn('npx', ['electron', '.'], {
    cwd: root,
    stdio: 'inherit',
    env: {
      ...process.env,
      VITE_DEV_SERVER_URL: `http://localhost:${PORT}`,
      SMS_ENV: process.env.SMS_ENV || 'development',
    },
  });

  electron.on('exit', () => {
    vite.kill();
    process.exit(0);
  });
}

function shutdown() {
  if (electron) electron.kill();
  vite.kill();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

main().catch((err) => {
  console.error('[dev-desktop]', err);
  shutdown();
});
