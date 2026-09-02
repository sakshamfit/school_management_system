/**
 * Production Config Separation
 * dev / staging / prod
 */

const fs = require('fs');
const path = require('path');

function getEnv() {
  const env = process.env.NODE_ENV || (process.env.ELECTRON_IS_DEV ? 'development' : 'production');
  if (env === 'production' || env === 'prod') return 'production';
  if (env === 'staging') return 'staging';
  return 'development';
}

const configs = {
  development: {
    env: 'development',
    licenseServerUrl: process.env.LICENSE_SERVER_URL || 'http://localhost:3001',
    authServerUrl: process.env.AUTH_SERVER_URL || 'http://localhost:3001',
    updateFeedUrl: process.env.UPDATE_FEED_URL || 'http://localhost:3002/updates',
    googleClientId: process.env.GOOGLE_CLIENT_ID || '',
    allowDevTools: true,
    logLevel: 'debug',
    isDev: true,
  },
  staging: {
    env: 'staging',
    licenseServerUrl: process.env.LICENSE_SERVER_URL || 'https://staging-license.mspublicschool.edu.in',
    authServerUrl: process.env.AUTH_SERVER_URL || 'https://staging-auth.mspublicschool.edu.in',
    updateFeedUrl: process.env.UPDATE_FEED_URL || 'https://staging-updates.mspublicschool.edu.in',
    googleClientId: process.env.GOOGLE_CLIENT_ID || '',
    allowDevTools: false,
    logLevel: 'info',
    isDev: false,
  },
  production: {
    env: 'production',
    licenseServerUrl: process.env.LICENSE_SERVER_URL || 'https://license.mspublicschool.edu.in',
    authServerUrl: process.env.AUTH_SERVER_URL || 'https://auth.mspublicschool.edu.in',
    updateFeedUrl: process.env.UPDATE_FEED_URL || 'https://updates.mspublicschool.edu.in',
    googleClientId: process.env.GOOGLE_CLIENT_ID || '',
    allowDevTools: false,
    logLevel: 'warn',
    isDev: false,
  }
};

let currentConfig = null;

function getConfig() {
  if (currentConfig) return currentConfig;
  const env = getEnv();
  const base = configs[env] || configs.development;
  
  // Validate prod
  if (env === 'production') {
    validateProductionConfig(base);
  }
  
  currentConfig = base;
  return currentConfig;
}

function validateProductionConfig(config) {
  const errors = [];
  
  if (config.licenseServerUrl.includes('localhost')) {
    errors.push('Production license server URL must not contain localhost');
  }
  if (config.authServerUrl.includes('localhost')) {
    errors.push('Production auth server URL must not contain localhost');
  }
  if (config.updateFeedUrl.includes('localhost')) {
    errors.push('Production update feed URL must not contain localhost');
  }
  if (!config.licenseServerUrl.startsWith('https://')) {
    errors.push('Production license server must use HTTPS');
  }
  if (!config.authServerUrl.startsWith('https://')) {
    errors.push('Production auth server must use HTTPS');
  }
  if (!config.updateFeedUrl.startsWith('https://')) {
    errors.push('Production update feed must use HTTPS');
  }
  
  if (errors.length > 0) {
    console.warn('[Config] Production validation warnings:', errors.join(', '));
    // Don't throw, but log warning - in prod build we want to catch this
    if (process.env.STRICT_PROD_VALIDATION === 'true') {
      throw new Error('Production config validation failed: ' + errors.join(', '));
    }
  }
}

function isProduction() {
  return getEnv() === 'production';
}

function isDevelopment() {
  return getEnv() === 'development';
}

module.exports = {
  getConfig,
  getEnv,
  isProduction,
  isDevelopment,
  validateProductionConfig,
  configs,
};
