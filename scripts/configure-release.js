#!/usr/bin/env node
'use strict';

/**
 * Release configuration.
 *
 * Writes the production license-server URL into desktop/defaultConfig.json so
 * packaged builds point at the real central service — never at development.
 *
 * Usage:
 *   node scripts/configure-release.js --license-server-url https://license.yourcompany.com
 *   LICENSE_SERVER_URL=https://license.yourcompany.com node scripts/configure-release.js
 *
 * Run this BEFORE `npm run dist` (CI does it automatically).
 */

const fs = require('fs');
const path = require('path');

function argValue(name) {
  const idx = process.argv.indexOf(name);
  return idx >= 0 ? process.argv[idx + 1] : undefined;
}

const url =
  argValue('--license-server-url') ||
  process.env.LICENSE_SERVER_URL ||
  '';

if (!url || !/^https:\/\/[a-z0-9.-]+(:\d+)?(\/.*)?$/i.test(url)) {
  console.error('');
  console.error('A valid HTTPS license server URL is required for production builds.');
  console.error('');
  console.error('  node scripts/configure-release.js --license-server-url https://license.yourcompany.com');
  console.error('');
  process.exit(1);
}

const file = path.join(__dirname, '..', 'desktop', 'defaultConfig.json');
const config = {
  licenseServerUrl: url.replace(/\/+$/, ''),
  environment: 'production',
};
fs.writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`);
console.log(`✔ desktop/defaultConfig.json configured for production:`);
console.log(`  licenseServerUrl: ${config.licenseServerUrl}`);
