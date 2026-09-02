/**
 * Constants for Google Drive Backup System
 * Production-quality constants with secure defaults
 */

const path = require('path');
const os = require('os');

// App identifiers
const APP_NAME = 'SchoolManagementSystem';
const APP_FOLDER_NAME = 'SchoolManagementSystem';
const BACKUP_SUBFOLDER_NAME = 'School_Backup';
const BACKUP_FILE_PREFIX = 'school-backup';
const BACKUP_FILE_EXTENSION = '.smbak';
const LATEST_BACKUP_NAME = `school-backup-latest${BACKUP_FILE_EXTENSION}`;

// Backup format version
const FORMAT_VERSION = 1;

// Retention defaults
const DEFAULT_RETENTION = {
  keepLatest: true,
  keepDaily: 7,
  keepWeekly: 4, // optional future
};

// Frequency options
const BACKUP_FREQUENCY = {
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MANUAL: 'manual',
};

// Google Drive OAuth scopes - minimal required
const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/drive.file', // Only files created by app
  'https://www.googleapis.com/auth/userinfo.email', // To display connected account
];

// Google OAuth config - client ID only, no secret shipped in renderer
// For desktop apps, Google recommends using installed app flow without client secret,
// or using loopback IP. Client ID is considered public but we load from env if available.
function getGoogleClientConfig() {
  // Allow override via environment or external config file
  const clientId = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || '';
  // For installed apps, redirect URI is loopback
  // We use dynamic port, so base is http://127.0.0.1:{port}/callback
  // For production, this will be set at runtime
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://127.0.0.1/callback';
  
  return {
    clientId,
    redirectUri,
    scopes: GOOGLE_SCOPES,
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
    driveApiBase: 'https://www.googleapis.com/drive/v3',
    uploadApiBase: 'https://www.googleapis.com/upload/drive/v3',
  };
}

// Paths
function getAppDataPaths() {
  // In Electron, app.getPath('userData') is preferred, but we provide fallback
  const base = process.env.APPDATA 
    ? path.join(process.env.APPDATA, APP_NAME)
    : path.join(os.homedir(), `.${APP_NAME}`);

  return {
    base,
    database: path.join(base, 'database'),
    backups: path.join(base, 'backups'),
    secure: path.join(base, 'secure'),
    temp: path.join(base, 'temp'),
    sqliteFile: path.join(base, 'database', 'school.sqlite'),
    metadataFile: path.join(base, 'backup', 'metadata.json'),
    historyFile: path.join(base, 'backup', 'history.json'),
    tokensFile: path.join(base, 'secure', 'gdrive_tokens.enc'),
    keyFile: path.join(base, 'secure', 'backup_key.enc'),
    localBackupDir: path.join(base, 'backups'),
  };
}

// Encryption
const ENCRYPTION = {
  algorithm: 'aes-256-gcm',
  keyLength: 32,
  ivLength: 12,
  authTagLength: 16,
  // Format: [version:1][iv:12][authTag:16][ciphertext]
  currentVersion: 1,
};

// Limits and safety
const SAFETY_LIMITS = {
  maxBackupSizeBytes: 500 * 1024 * 1024, // 500 MB
  maxExtractedSizeBytes: 1024 * 1024 * 1024, // 1 GB max after extraction
  maxFilesInArchive: 10000,
  maxFileNameLength: 255,
  maxManifestSize: 1024 * 1024, // 1 MB
};

// Backup status
const BACKUP_STATUS = {
  SUCCESS: 'success',
  FAILED: 'failed',
  IN_PROGRESS: 'in_progress',
  PENDING: 'pending',
  NOT_CONNECTED: 'not_connected',
};

module.exports = {
  APP_NAME,
  APP_FOLDER_NAME,
  BACKUP_SUBFOLDER_NAME,
  BACKUP_FILE_PREFIX,
  BACKUP_FILE_EXTENSION,
  LATEST_BACKUP_NAME,
  FORMAT_VERSION,
  DEFAULT_RETENTION,
  BACKUP_FREQUENCY,
  GOOGLE_SCOPES,
  getGoogleClientConfig,
  getAppDataPaths,
  ENCRYPTION,
  SAFETY_LIMITS,
  BACKUP_STATUS,
};
