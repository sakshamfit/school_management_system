#!/usr/bin/env node
/**
 * SANDBOX-ONLY verification build.
 *
 * Generates the Windows installer from a non-Windows machine by skipping the
 * native-module rebuild step (better-sqlite3 cannot be cross-compiled to
 * win32 here). The resulting installer validates the NSIS/branding pipeline
 * but MUST NOT be shipped — production installers are built by
 * .github/workflows/release.yml on windows-latest, where the native module
 * is rebuilt for the Electron ABI.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));

const config = {
  ...pkg.build,
  npmRebuild: false,
};

const configFile = path.join(root, 'electron-builder.sandbox.json');
writeFileSync(configFile, JSON.stringify(config, null, 2));

const result = spawnSync('npx', ['electron-builder', '--win', '--config', configFile], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, USE_HARD_LINKS: 'false' },
});

process.exit(result.status || 0);
