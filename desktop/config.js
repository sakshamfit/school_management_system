'use strict';

/**
 * Runtime configuration for the desktop shell.
 *
 * Precedence (highest wins):
 *   1. Process environment (SMS_LICENSE_SERVER_URL, SMS_ENV) — developer use.
 *   2. Per-machine override file: <AppData>/SchoolManagementSystem/config/server.json
 *   3. Built-in defaultConfig.json (rewritten at release time by CI).
 *
 * Environments: development | staging | production. A production build must
 * never talk to a development license server — the environment is explicit.
 */

const fs = require('fs');
const path = require('path');

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function resolveConfig(paths) {
  const defaults = readJson(path.join(__dirname, 'defaultConfig.json')) || {};

  let machineOverride = null;
  try {
    machineOverride = readJson(paths.serverOverrideFile());
  } catch {
    machineOverride = null;
  }

  const environment = process.env.SMS_ENV || defaults.environment || 'production';
  const licenseServerUrl =
    process.env.SMS_LICENSE_SERVER_URL ||
    (machineOverride && machineOverride.licenseServerUrl) ||
    defaults.licenseServerUrl ||
    '';

  return {
    environment,
    licenseServerUrl: String(licenseServerUrl).replace(/\/+$/, ''),
    appVersion: getAppVersion(),
  };
}

function getAppVersion() {
  try {
    const pkg = readJson(path.join(__dirname, '..', 'package.json'));
    return pkg ? pkg.version : '0.0.0';
  } catch {
    return '0.0.0';
  }
}

module.exports = { resolveConfig, getAppVersion };
