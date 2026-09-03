#!/usr/bin/env node
/**
 * Writes electron/build-config.json from environment variables before an
 * installer build. This is how the production API URL enters the EXE —
 * explicitly at build time, never hard-coded in source control.
 *
 *   SMS_API_URL=https://api.example.com node scripts/write-build-config.mjs
 */

import fs from 'node:fs';
import path from 'node:path';

const out = {
  apiBaseUrl: process.env.SMS_API_URL || '',
  updateChannel: process.env.SMS_UPDATE_CHANNEL || 'stable',
  supportContact: process.env.SMS_SUPPORT_CONTACT || '',
  generatedAt: new Date().toISOString(),
};

const target = path.join(process.cwd(), 'electron', 'build-config.json');
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, JSON.stringify(out, null, 2));

if (out.apiBaseUrl) {
  console.log(`✅ electron/build-config.json written (apiBaseUrl: ${out.apiBaseUrl})`);
} else {
  console.log('ℹ️  electron/build-config.json written without apiBaseUrl (development default will be used).');
}
