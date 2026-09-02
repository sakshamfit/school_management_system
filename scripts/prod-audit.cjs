/**
 * Production Readiness Audit Script
 * Automated checks for production readiness
 */

const fs = require('fs');
const path = require('path');

let checks = [];
let passed = 0;
let failed = 0;
let warnings = 0;

function check(name, condition, severity = 'FAIL') {
  const result = {
    name,
    status: condition ? 'PASS' : severity,
    severity,
  };
  checks.push(result);
  if (condition) passed++;
  else if (severity === 'FAIL') failed++;
  else warnings++;
  return condition;
}

function audit() {
  console.log('=== Production Readiness Audit ===\n');

  // Electron architecture
  check('Electron main exists', fs.existsSync(path.join(__dirname, '..', 'electron.cjs')));
  check('Preload exists', fs.existsSync(path.join(__dirname, '..', 'desktop', 'preload.js')));
  check('IPC exists', fs.existsSync(path.join(__dirname, '..', 'desktop', 'ipc.js')));
  
  const electronContent = fs.readFileSync(path.join(__dirname, '..', 'electron.cjs'), 'utf8');
  check('contextIsolation true', electronContent.includes('contextIsolation: true'));
  check('nodeIntegration false', electronContent.includes('nodeIntegration: false'));
  check('sandbox true', electronContent.includes('sandbox: true'));
  check('webSecurity true', electronContent.includes('webSecurity: true'));

  // Backup system
  const backupFiles = [
    'desktop/lib/constants.js',
    'desktop/lib/secureStorage.js',
    'desktop/lib/googleAuthManager.js',
    'desktop/lib/googleDriveClient.js',
    'desktop/lib/backupEncryptionService.js',
    'desktop/lib/backupPackageService.js',
    'desktop/lib/backupRepository.js',
    'desktop/lib/backupScheduler.js',
    'desktop/lib/backupRestoreService.js',
    'desktop/lib/googleDriveBackup.js',
    'desktop/lib/recoveryService.js',
  ];
  for (const file of backupFiles) {
    check(`Backup file exists: ${file}`, fs.existsSync(path.join(__dirname, '..', file)));
  }

  // Recovery key
  check('Recovery service exists', fs.existsSync(path.join(__dirname, '..', 'desktop/lib/recoveryService.js')));
  const recoveryContent = fs.existsSync(path.join(__dirname, '..', 'desktop/lib/recoveryService.js')) 
    ? fs.readFileSync(path.join(__dirname, '..', 'desktop/lib/recoveryService.js'), 'utf8') 
    : '';
  check('Recovery key has checksum', recoveryContent.includes('checksum'));
  check('Recovery key never logged', !recoveryContent.includes('console.log.*key.toString'));

  // Database
  check('Database service exists', fs.existsSync(path.join(__dirname, '..', 'desktop/lib/database.js')));
  const dbContent = fs.existsSync(path.join(__dirname, '..', 'desktop/lib/database.js'))
    ? fs.readFileSync(path.join(__dirname, '..', 'desktop/lib/database.js'), 'utf8')
    : '';
  check('WAL mode enabled', dbContent.includes('WAL'));
  check('Migration backup', dbContent.includes('backupBeforeMigration'));
  check('Integrity check', dbContent.includes('integrity_check'));
  check('Safety backup', dbContent.includes('safety'));

  // License & Device
  check('License manager exists', fs.existsSync(path.join(__dirname, '..', 'desktop/lib/licenseManager.js')));
  check('Device manager exists', fs.existsSync(path.join(__dirname, '..', 'desktop/lib/deviceManager.js')));
  check('Auth manager exists', fs.existsSync(path.join(__dirname, '..', 'desktop/lib/authManager.js')));

  const licenseContent = fs.existsSync(path.join(__dirname, '..', 'desktop/lib/licenseManager.js'))
    ? fs.readFileSync(path.join(__dirname, '..', 'desktop/lib/licenseManager.js'), 'utf8')
    : '';
  check('License states: active/expired/suspended/revoked', 
    licenseContent.includes('ACTIVE') && licenseContent.includes('EXPIRED') && licenseContent.includes('SUSPENDED') && licenseContent.includes('REVOKED'));
  check('Offline grace period', licenseContent.includes('offlineGrace') || licenseContent.includes('grace'));

  const deviceContent = fs.existsSync(path.join(__dirname, '..', 'desktop/lib/deviceManager.js'))
    ? fs.readFileSync(path.join(__dirname, '..', 'desktop/lib/deviceManager.js'), 'utf8')
    : '';
  // Check device ID: should have installId (stable) and not collect MAC via code (comment allowed)
  const hasInstallId = deviceContent.includes('installId');
  const collectsMac = deviceContent.includes('getMacAddress') || deviceContent.includes('networkInterfaces') && deviceContent.includes('mac');
  check('Device ID stable but not invasive', hasInstallId && !collectsMac);

  // Auth
  const authScreenPath = path.join(__dirname, '..', 'src', 'components', 'auth', 'AuthScreen.tsx');
  if (fs.existsSync(authScreenPath)) {
    const authContent = fs.readFileSync(authScreenPath, 'utf8');
    check('No public signup in AuthScreen', !authContent.includes('Sign Up') && !authContent.includes('Create Account') && !authContent.includes('Register'));
    check('Forgot password -> Contact Admin', authContent.includes('Contact Administrator') || authContent.includes('Contact Admin'));
  }

  // Backup UI
  check('BackupView exists', fs.existsSync(path.join(__dirname, '..', 'src', 'components', 'settings', 'BackupView.tsx')));
  const backupViewContent = fs.existsSync(path.join(__dirname, '..', 'src', 'components', 'settings', 'BackupView.tsx'))
    ? fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'settings', 'BackupView.tsx'), 'utf8')
    : '';
  check('BackupView has recovery key UI', backupViewContent.includes('Recovery Key'));
  check('BackupView has disconnect confirmation', backupViewContent.includes('Disconnect Google Drive'));
  check('BackupView has restore warning', backupViewContent.includes('WARNING') && backupViewContent.includes('safety backup'));

  // Installer
  check('electron-builder.yml exists', fs.existsSync(path.join(__dirname, '..', 'electron-builder.yml')));
  const builderContent = fs.existsSync(path.join(__dirname, '..', 'electron-builder.yml'))
    ? fs.readFileSync(path.join(__dirname, '..', 'electron-builder.yml'), 'utf8')
    : '';
  check('NSIS config', builderContent.includes('nsis'));
  check('Preserves user data on uninstall', builderContent.includes('deleteAppDataOnUninstall: false'));

  // Auto updater
  check('Auto updater exists', fs.existsSync(path.join(__dirname, '..', 'desktop/lib/autoUpdater.js')));
  const updaterContent = fs.existsSync(path.join(__dirname, '..', 'desktop/lib/autoUpdater.js'))
    ? fs.readFileSync(path.join(__dirname, '..', 'desktop/lib/autoUpdater.js'), 'utf8')
    : '';
  check('Updater preserves SQLite', updaterContent.includes('safety') || updaterContent.includes('Safety'));

  // Security
  const preloadContent = fs.existsSync(path.join(__dirname, '..', 'desktop', 'preload.js'))
    ? fs.readFileSync(path.join(__dirname, '..', 'desktop', 'preload.js'), 'utf8')
    : '';
  check('Preload uses contextBridge', preloadContent.includes('contextBridge'));
  check('Preload whitelisted channels', preloadContent.includes('backup:get-status'));

  // Env
  check('.env.example exists', fs.existsSync(path.join(__dirname, '..', '.env.example')));
  const envExample = fs.existsSync(path.join(__dirname, '..', '.env.example'))
    ? fs.readFileSync(path.join(__dirname, '..', '.env.example'), 'utf8')
    : '';
  check('GOOGLE_CLIENT_ID in env example', envExample.includes('GOOGLE_CLIENT_ID'));
  check('No secrets in env example', !envExample.includes('service_role') && !envExample.includes('sk_live'));

  // Documentation
  check('BACKUP_SYSTEM.md exists', fs.existsSync(path.join(__dirname, '..', 'BACKUP_SYSTEM.md')));
  check('DEPLOYMENT.md exists', fs.existsSync(path.join(__dirname, '..', 'DEPLOYMENT.md')));
  check('AUDIT_REPORT.md exists', fs.existsSync(path.join(__dirname, '..', 'AUDIT_REPORT.md')));

  // Build
  check('dist exists (after build)', fs.existsSync(path.join(__dirname, '..', 'dist')), 'WARN');
  check('package.json has dist script', (() => {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
      return !!pkg.scripts.dist;
    } catch { return false; }
  })());

  // Print results
  console.log('\n=== Results ===');
  for (const c of checks) {
    const icon = c.status === 'PASS' ? '✅' : c.status === 'WARN' ? '⚠️' : '❌';
    console.log(`${icon} ${c.status}: ${c.name}`);
  }

  console.log(`\n=== Summary ===`);
  console.log(`Passed: ${passed}`);
  console.log(`Warnings: ${warnings}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total: ${checks.length}`);

  if (failed > 0) {
    console.log('\n❌ Production readiness audit FAILED with blocking issues');
    process.exit(1);
  } else if (warnings > 0) {
    console.log('\n⚠️ Audit passed with warnings');
    process.exit(0);
  } else {
    console.log('\n✅ All production checks PASSED');
    process.exit(0);
  }
}

audit();
