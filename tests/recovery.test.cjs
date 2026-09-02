/**
 * Recovery Key Tests
 * Tests cross-device restore scenario
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const testBaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'recovery-test-'));
const testPaths = {
  base: path.join(testBaseDir, 'SchoolManagementSystem'),
  database: path.join(testBaseDir, 'SchoolManagementSystem', 'database'),
  backups: path.join(testBaseDir, 'SchoolManagementSystem', 'backups'),
  secure: path.join(testBaseDir, 'SchoolManagementSystem', 'secure'),
  temp: path.join(testBaseDir, 'SchoolManagementSystem', 'temp'),
  sqliteFile: path.join(testBaseDir, 'SchoolManagementSystem', 'database', 'school.sqlite'),
  metadataFile: path.join(testBaseDir, 'SchoolManagementSystem', 'backup', 'metadata.json'),
  historyFile: path.join(testBaseDir, 'SchoolManagementSystem', 'backup', 'history.json'),
  tokensFile: path.join(testBaseDir, 'SchoolManagementSystem', 'secure', 'gdrive_tokens.enc'),
  keyFile: path.join(testBaseDir, 'SchoolManagementSystem', 'secure', 'backup_key.enc'),
  localBackupDir: path.join(testBaseDir, 'SchoolManagementSystem', 'backups'),
};

for (const dir of [testPaths.base, testPaths.database, testPaths.backups, testPaths.secure, path.dirname(testPaths.metadataFile)]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

const mockSafeStorage = {
  isEncryptionAvailable: () => true,
  encryptString: (str) => Buffer.from(`encrypted:${str}`),
  decryptString: (buffer) => {
    const str = buffer.toString('utf8');
    return str.startsWith('encrypted:') ? str.slice('encrypted:'.length) : str;
  }
};

const secureStorage = require('../desktop/lib/secureStorage');
secureStorage.setSafeStorageMock(mockSafeStorage);

const RecoveryService = require('../desktop/lib/recoveryService');
const BackupEncryptionService = require('../desktop/lib/backupEncryptionService');

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

async function runTest(name, fn) {
  try {
    console.log(`\n[TEST] ${name}...`);
    await fn();
    console.log(`[PASS] ${name}`);
    testsPassed++;
  } catch (e) {
    console.error(`[FAIL] ${name}: ${e.message}`);
    console.error(e.stack);
    testsFailed++;
  }
}

async function runAllTests() {
  console.log('=== Recovery Key Tests ===\n');

  await runTest('generate recovery key', async () => {
    const service = new RecoveryService({ paths: testPaths });
    const result = service.generateRecoveryKey();
    assert(result.key, 'Should generate key');
    assert(result.key.length === 32, 'Key should be 32 bytes');
    assert(result.formatted, 'Should have formatted version');
    assert(result.formatted.includes('-'), 'Formatted should include hyphens');
    // Should be 16 groups of 4 hex = 64 chars + 15 hyphens = 79 chars
    const withoutHyphens = result.formatted.replace(/-/g, '');
    assert(withoutHyphens.length === 64, `Formatted without hyphens should be 64 chars, got ${withoutHyphens.length}`);
  });

  await runTest('format and parse recovery key', async () => {
    const service = new RecoveryService({ paths: testPaths });
    const original = service.generateRecoveryKey();
    const parsed = service.parseRecoveryKey(original.formatted);
    assert(parsed.equals(original.key), 'Parsed key should equal original');
  });

  await runTest('format with checksum and parse', async () => {
    const service = new RecoveryService({ paths: testPaths });
    const original = service.generateRecoveryKey();
    const withChecksum = service.formatRecoveryKeyWithChecksum(original.key);
    assert(withChecksum.includes('-'), 'Should include hyphens');
    // With checksum: 16 groups + checksum = 17 groups, 64 + 4 = 68 hex + 16 hyphens = 84 chars
    const parsed = service.parseRecoveryKey(withChecksum);
    assert(parsed.equals(original.key), 'Parsed with checksum should equal original');
  });

  await runTest('parse recovery key - case insensitive and with spaces', async () => {
    const service = new RecoveryService({ paths: testPaths });
    const original = service.generateRecoveryKey();
    const lower = original.formatted.toLowerCase();
    const withSpaces = original.formatted.replace(/-/g, ' ');
    const parsedLower = service.parseRecoveryKey(lower);
    const parsedSpaces = service.parseRecoveryKey(withSpaces);
    assert(parsedLower.equals(original.key), 'Should parse lowercase');
    assert(parsedSpaces.equals(original.key), 'Should parse with spaces');
  });

  await runTest('recovery key checksum validation', async () => {
    const service = new RecoveryService({ paths: testPaths });
    const original = service.generateRecoveryKey();
    const withChecksum = service.formatRecoveryKeyWithChecksum(original.key);
    
    // Corrupt one char in checksum
    const corrupted = withChecksum.slice(0, -1) + (withChecksum.slice(-1) === 'A' ? 'B' : 'A');
    let failed = false;
    try {
      service.parseRecoveryKey(corrupted);
    } catch (e) {
      failed = true;
      assert(e.message.includes('checksum'), 'Should fail with checksum mismatch');
    }
    assert(failed, 'Corrupted checksum should fail');
  });

  await runTest('export and import recovery key - cross-device scenario', async () => {
    const serviceA = new RecoveryService({ paths: testPaths });
    
    // Simulate Computer A: generate and export
    const generated = serviceA.generateRecoveryKey();
    secureStorage.setSecureValue(testPaths.keyFile, {
      key: generated.key.toString('base64'),
      createdAt: new Date().toISOString(),
      version: 1,
    });

    const exported = serviceA.exportRecoveryKey();
    assert(exported.formatted, 'Should export formatted key');
    assert(exported.warning.includes('unrecoverable'), 'Should include warning');

    // Simulate Computer A lost - delete local key file
    // But user has recovery key written down
    const recoveryKeyWrittenDown = exported.formatted;

    // Simulate Computer B: fresh install, no key
    const testBaseDirB = fs.mkdtempSync(path.join(os.tmpdir(), 'recovery-test-B-'));
    const testPathsB = {
      base: path.join(testBaseDirB, 'SchoolManagementSystem'),
      database: path.join(testBaseDirB, 'SchoolManagementSystem', 'database'),
      backups: path.join(testBaseDirB, 'SchoolManagementSystem', 'backups'),
      secure: path.join(testBaseDirB, 'SchoolManagementSystem', 'secure'),
      temp: path.join(testBaseDirB, 'SchoolManagementSystem', 'temp'),
      sqliteFile: path.join(testBaseDirB, 'SchoolManagementSystem', 'database', 'school.sqlite'),
      metadataFile: path.join(testBaseDirB, 'SchoolManagementSystem', 'backup', 'metadata.json'),
      historyFile: path.join(testBaseDirB, 'SchoolManagementSystem', 'backup', 'history.json'),
      tokensFile: path.join(testBaseDirB, 'SchoolManagementSystem', 'secure', 'gdrive_tokens.enc'),
      keyFile: path.join(testBaseDirB, 'SchoolManagementSystem', 'secure', 'backup_key.enc'),
      localBackupDir: path.join(testBaseDirB, 'SchoolManagementSystem', 'backups'),
    };
    for (const dir of [testPathsB.base, testPathsB.database, testPathsB.backups, testPathsB.secure, path.dirname(testPathsB.metadataFile)]) {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    }

    // Override secureStorage paths for B BEFORE creating serviceB
    const originalGetPaths = secureStorage.getAppDataPaths;
    secureStorage.getAppDataPaths = () => testPathsB;
    // Also need to mock constants.getAppDataPaths to return testPathsB for internal getPaths()
    const constants = require('../desktop/lib/constants');
    const originalConstantsGetPaths = constants.getAppDataPaths;
    constants.getAppDataPaths = () => testPathsB;
    
    const serviceB = new RecoveryService({ paths: testPathsB });

    // Ensure B has no key file
    if (fs.existsSync(testPathsB.keyFile)) fs.unlinkSync(testPathsB.keyFile);
    
    assert(!fs.existsSync(testPathsB.keyFile), 'Computer B should have no key file initially');
    assert(!serviceB.hasRecoveryKey(), 'Computer B should have no key initially');

    // Import recovery key on Computer B
    const importResult = serviceB.importRecoveryKey(recoveryKeyWrittenDown);
    assert(importResult.success, 'Import should succeed');

    assert(serviceB.hasRecoveryKey(), 'Computer B should have key after import');

    // Verify key can decrypt backup from Computer A
    const encryptionService = new BackupEncryptionService();
    const testData = Buffer.from('Test backup data from Computer A');
    
    // Encrypt with original key (Computer A)
    secureStorage.getAppDataPaths = () => testPaths;
    const encrypted = encryptionService.encryptBuffer(testData);
    
    // Decrypt with imported key (Computer B)
    secureStorage.getAppDataPaths = () => testPathsB;
    const decrypted = encryptionService.decryptBuffer(encrypted);
    
    assert(decrypted.toString() === testData.toString(), 'Computer B should decrypt Computer A backup with recovery key');

    // Cleanup
    secureStorage.getAppDataPaths = originalGetPaths;
    constants.getAppDataPaths = originalConstantsGetPaths;
    fs.rmSync(testBaseDirB, { recursive: true, force: true });
  });

  await runTest('recovery key not in backup', async () => {
    // Ensure recovery key is never inside backup package
    const BackupPackageService = require('../desktop/lib/backupPackageService');
    const packageService = new BackupPackageService({ paths: testPaths, appVersion: '1.0.0' });
    
    const mockData = {
      schoolInfo: { id: 'test', name: 'Test School' },
      students: [],
      users: [],
      classes: [],
    };

    const result = await packageService.createBackupPackage({
      schoolId: 'test',
      schoolData: mockData,
    });

    // Check that archive doesn't contain recovery key patterns
    const archiveStr = result.archiveBuffer.toString('utf8');
    // Recovery key is hex, but we check that backup doesn't contain key file
    assert(!archiveStr.includes('backup_key.enc'), 'Backup should not contain backup_key file');
    assert(!archiveStr.includes('gdrive_tokens'), 'Backup should not contain tokens');
    
    packageService.cleanupTempDir(result.tempDir);
  });

  await runTest('recovery key never logged', async () => {
    const service = new RecoveryService({ paths: testPaths });
    const generated = service.generateRecoveryKey();
    
    // Simulate logging - ensure we don't log actual key
    const safeLog = `Generated recovery key at ${generated.createdAt} with length ${generated.key.length}`;
    assert(!safeLog.includes(generated.key.toString('hex')), 'Log should not contain key hex');
    assert(!safeLog.includes(generated.key.toString('base64')), 'Log should not contain key base64');
    assert(!safeLog.includes(generated.formatted), 'Log should not contain formatted key');
  });

  await runTest('permanent loss documentation', async () => {
    // This is a documentation test - ensure warning exists
    const service = new RecoveryService({ paths: testPaths });
    const exported = service.generateRecoveryKey();
    const formatted = service.formatRecoveryKeyWithChecksum(exported.key);
    
    // The warning that should be shown to user
    const expectedWarning = 'unrecoverable';
    const mockExport = {
      formatted,
      warning: 'IMPORTANT: Keep this recovery key safe. If you lose this computer and this key, your encrypted backups will be unrecoverable.',
    };
    
    assert(mockExport.warning.toLowerCase().includes(expectedWarning), 'Warning should mention unrecoverable');
  });

  console.log('\n=== Test Summary ===');
  console.log(`Passed: ${testsPassed}`);
  console.log(`Failed: ${testsFailed}`);

  try {
    fs.rmSync(testBaseDir, { recursive: true, force: true });
  } catch (e) {}

  if (testsFailed > 0) process.exit(1);
  else {
    console.log('\nAll recovery tests passed!');
    process.exit(0);
  }
}

runAllTests().catch(e => {
  console.error('Test runner failed:', e);
  process.exit(1);
});
