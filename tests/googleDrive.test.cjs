/**
 * Google Drive Client Tests
 * Tests authentication, folder creation, upload, listing, download, deletion, etc.
 * Uses mocks to avoid real API calls
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Mock fetch for Drive API
global.fetch = async (url, options = {}) => {
  // Mock responses based on URL
  if (url.includes('oauth2.googleapis.com/token')) {
    return {
      ok: true,
      json: async () => ({
        access_token: 'mock_access_token_123',
        refresh_token: 'mock_refresh_token_456',
        expires_in: 3600,
        token_type: 'Bearer',
        scope: 'https://www.googleapis.com/auth/drive.file',
      }),
      text: async () => JSON.stringify({}),
      headers: { get: () => null },
    };
  }

  if (url.includes('userinfo')) {
    return {
      ok: true,
      json: async () => ({
        email: 'test@gmail.com',
        name: 'Test User',
        id: 'user_123',
      }),
      text: async () => '',
      headers: { get: () => null },
    };
  }

  if (url.includes('/drive/v3/files') && options.method === 'POST') {
    // Create folder or file
    return {
      ok: true,
      json: async () => ({
        id: `mock_file_${Date.now()}`,
        name: 'Test Folder',
        size: '1024',
        modifiedTime: new Date().toISOString(),
        createdTime: new Date().toISOString(),
      }),
      text: async () => '',
      headers: { get: (name) => name === 'Location' ? 'https://mock-resumable-uri' : null },
    };
  }

  if (url.includes('/drive/v3/files') && url.includes('q=')) {
    // List/search
    return {
      ok: true,
      json: async () => ({
        files: [
          {
            id: 'file_1',
            name: 'school-backup-2026-09-02.smbak',
            size: '1024000',
            modifiedTime: new Date().toISOString(),
            createdTime: new Date().toISOString(),
          },
          {
            id: 'file_2',
            name: 'school-backup-latest.smbak',
            size: '1024000',
            modifiedTime: new Date().toISOString(),
            createdTime: new Date().toISOString(),
          }
        ],
        nextPageToken: null,
      }),
      text: async () => '',
      headers: { get: () => null },
    };
  }

  if (url.includes('/drive/v3/files/') && url.includes('?fields=')) {
    // Get metadata
    return {
      ok: true,
      json: async () => ({
        id: 'file_123',
        name: 'school-backup-2026-09-02.smbak',
        size: '1024000',
        modifiedTime: new Date().toISOString(),
        createdTime: new Date().toISOString(),
        trashed: false,
      }),
      text: async () => '',
      headers: { get: () => null },
    };
  }

  if (url.includes('alt=media')) {
    // Download
    return {
      ok: true,
      arrayBuffer: async () => Buffer.from('mock file content').buffer,
      text: async () => 'mock file content',
      headers: { get: () => null },
    };
  }

  if (url.includes('/upload/drive/v3/files')) {
    // Upload
    return {
      ok: true,
      json: async () => ({
        id: `uploaded_${Date.now()}`,
        name: 'school-backup-2026-09-02.smbak',
        size: '1024000',
        modifiedTime: new Date().toISOString(),
      }),
      text: async () => '',
      headers: { get: (name) => name === 'Location' ? 'https://mock-resumable-uri' : null },
    };
  }

  if (url.includes('generate_204')) {
    return {
      ok: true,
      status: 204,
      text: async () => '',
      headers: { get: () => null },
    };
  }

  // Default mock
  return {
    ok: true,
    json: async () => ({}),
    text: async () => '',
    arrayBuffer: async () => Buffer.alloc(0).buffer,
    headers: { get: () => null },
  };
};

const testBaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gdrive-test-'));
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

// Mock safeStorage
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

const GoogleAuthManager = require('../desktop/lib/googleAuthManager');
const GoogleDriveClient = require('../desktop/lib/googleDriveClient');

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
  console.log('=== Google Drive Client Tests ===\n');

  await runTest('authentication - token exchange', async () => {
    const authManager = new GoogleAuthManager({
      config: {
        clientId: 'test_client_id',
        authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
        driveApiBase: 'https://www.googleapis.com/drive/v3',
        uploadApiBase: 'https://www.googleapis.com/upload/drive/v3',
        scopes: ['https://www.googleapis.com/auth/drive.file'],
      },
      paths: testPaths,
    });

    const tokens = await authManager.exchangeCodeForTokens('test_code', 'test_verifier', 12345);
    assert(tokens.access_token === 'mock_access_token_123', 'Should get access token');
    assert(tokens.refresh_token === 'mock_refresh_token_456', 'Should get refresh token');
  });

  await runTest('authentication - token refresh', async () => {
    const authManager = new GoogleAuthManager({
      config: {
        clientId: 'test_client_id',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
        driveApiBase: 'https://www.googleapis.com/drive/v3',
        uploadApiBase: 'https://www.googleapis.com/upload/drive/v3',
        scopes: ['https://www.googleapis.com/auth/drive.file'],
      },
      paths: testPaths,
    });

    const newTokens = await authManager.refreshAccessToken('old_refresh_token');
    assert(newTokens.access_token, 'Should get new access token after refresh');
  });

  await runTest('authentication - user info', async () => {
    const authManager = new GoogleAuthManager({
      config: {
        clientId: 'test_client_id',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
        driveApiBase: 'https://www.googleapis.com/drive/v3',
        uploadApiBase: 'https://www.googleapis.com/upload/drive/v3',
        scopes: ['https://www.googleapis.com/auth/drive.file'],
      },
      paths: testPaths,
    });

    const userInfo = await authManager.getUserInfo('mock_token');
    assert(userInfo.email === 'test@gmail.com', 'Should get user email');
  });

  await runTest('authentication - secure storage', async () => {
    const authManager = new GoogleAuthManager({
      config: {
        clientId: 'test_client_id',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
        driveApiBase: 'https://www.googleapis.com/drive/v3',
        uploadApiBase: 'https://www.googleapis.com/upload/drive/v3',
        scopes: ['https://www.googleapis.com/auth/drive.file'],
      },
      paths: testPaths,
    });

    const testTokens = {
      access_token: 'test_access',
      refresh_token: 'test_refresh',
      expires_in: 3600,
      obtained_at: Date.now(),
      userInfo: { email: 'test@gmail.com' },
    };

    authManager.storeTokens(testTokens);
    const loaded = authManager.loadTokens();
    assert(loaded.access_token === 'test_access', 'Should load stored tokens');
    assert(loaded.refresh_token === 'test_refresh', 'Should preserve refresh token');

    authManager.clearTokens();
    const afterClear = authManager.loadTokens();
    assert(!afterClear, 'Tokens should be cleared');
  });

  await runTest('authentication - expired token detection', async () => {
    const authManager = new GoogleAuthManager({
      config: {
        clientId: 'test',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
        driveApiBase: 'https://www.googleapis.com/drive/v3',
        uploadApiBase: 'https://www.googleapis.com/upload/drive/v3',
        scopes: ['https://www.googleapis.com/auth/drive.file'],
      },
      paths: testPaths,
    });

    const expiredTokens = {
      access_token: 'expired',
      expires_in: 3600,
      obtained_at: Date.now() - 4000 * 1000, // 4000 seconds ago, expired
    };

    assert(authManager.isTokenExpired(expiredTokens), 'Expired token should be detected');

    const validTokens = {
      access_token: 'valid',
      expires_in: 3600,
      obtained_at: Date.now(),
    };

    assert(!authManager.isTokenExpired(validTokens), 'Valid token should not be expired');
  });

  await runTest('drive - folder creation', async () => {
    const authManager = new GoogleAuthManager({
      config: {
        clientId: 'test',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
        driveApiBase: 'https://www.googleapis.com/drive/v3',
        uploadApiBase: 'https://www.googleapis.com/upload/drive/v3',
        scopes: ['https://www.googleapis.com/auth/drive.file'],
      },
      paths: testPaths,
    });

    // Mock valid token
    authManager.loadTokens = () => ({
      access_token: 'mock_token',
      obtained_at: Date.now(),
      expires_in: 3600,
    });
    authManager.getValidAccessToken = async () => 'mock_token';

    const driveClient = new GoogleDriveClient(authManager, {
      config: {
        driveApiBase: 'https://www.googleapis.com/drive/v3',
        uploadApiBase: 'https://www.googleapis.com/upload/drive/v3',
      }
    });

    const folder = await driveClient.createFolder('TestFolder');
    assert(folder.id, 'Folder should have ID');
    assert(folder.name, 'Folder should have name');
  });

  await runTest('drive - folder discovery', async () => {
    const authManager = new GoogleAuthManager({
      config: {
        clientId: 'test',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
        driveApiBase: 'https://www.googleapis.com/drive/v3',
        uploadApiBase: 'https://www.googleapis.com/upload/drive/v3',
        scopes: ['https://www.googleapis.com/auth/drive.file'],
      },
      paths: testPaths,
    });

    authManager.getValidAccessToken = async () => 'mock_token';

    const driveClient = new GoogleDriveClient(authManager, {
      config: {
        driveApiBase: 'https://www.googleapis.com/drive/v3',
        uploadApiBase: 'https://www.googleapis.com/upload/drive/v3',
      }
    });

    // Mock findFolder to return null first, then folder
    const folders = await driveClient.ensureBackupFolder();
    assert(folders.rootFolderId, 'Should have root folder ID');
    assert(folders.backupFolderId, 'Should have backup folder ID');
  });

  await runTest('drive - upload', async () => {
    const authManager = new GoogleAuthManager({
      config: {
        clientId: 'test',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
        driveApiBase: 'https://www.googleapis.com/drive/v3',
        uploadApiBase: 'https://www.googleapis.com/upload/drive/v3',
        scopes: ['https://www.googleapis.com/auth/drive.file'],
      },
      paths: testPaths,
    });

    authManager.getValidAccessToken = async () => 'mock_token';

    const driveClient = new GoogleDriveClient(authManager, {
      config: {
        driveApiBase: 'https://www.googleapis.com/drive/v3',
        uploadApiBase: 'https://www.googleapis.com/upload/drive/v3',
      }
    });

    const buffer = Buffer.from('test backup content');
    const result = await driveClient.uploadFile('folder_123', 'test.smbak', buffer);
    assert(result.id, 'Upload should return file ID');
  });

  await runTest('drive - listing', async () => {
    const authManager = new GoogleAuthManager({
      config: {
        clientId: 'test',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
        driveApiBase: 'https://www.googleapis.com/drive/v3',
        uploadApiBase: 'https://www.googleapis.com/upload/drive/v3',
        scopes: ['https://www.googleapis.com/auth/drive.file'],
      },
      paths: testPaths,
    });

    authManager.getValidAccessToken = async () => 'mock_token';

    const driveClient = new GoogleDriveClient(authManager, {
      config: {
        driveApiBase: 'https://www.googleapis.com/drive/v3',
        uploadApiBase: 'https://www.googleapis.com/upload/drive/v3',
      }
    });

    // Mock ensureBackupFolder
    driveClient.ensureBackupFolder = async () => ({
      rootFolderId: 'root_123',
      backupFolderId: 'backup_123',
    });

    const files = await driveClient.listBackupFiles();
    assert(Array.isArray(files), 'Should return array of files');
    assert(files.length >= 1, 'Should have at least one backup file');
  });

  await runTest('drive - download', async () => {
    const authManager = new GoogleAuthManager({
      config: {
        clientId: 'test',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
        driveApiBase: 'https://www.googleapis.com/drive/v3',
        uploadApiBase: 'https://www.googleapis.com/upload/drive/v3',
        scopes: ['https://www.googleapis.com/auth/drive.file'],
      },
      paths: testPaths,
    });

    authManager.getValidAccessToken = async () => 'mock_token';

    const driveClient = new GoogleDriveClient(authManager, {
      config: {
        driveApiBase: 'https://www.googleapis.com/drive/v3',
        uploadApiBase: 'https://www.googleapis.com/upload/drive/v3',
      }
    });

    const data = await driveClient.downloadFile('file_123');
    assert(Buffer.isBuffer(data), 'Download should return Buffer');
  });

  await runTest('drive - account disconnect and reconnect', async () => {
    const authManager = new GoogleAuthManager({
      config: {
        clientId: 'test',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
        driveApiBase: 'https://www.googleapis.com/drive/v3',
        uploadApiBase: 'https://www.googleapis.com/upload/drive/v3',
        scopes: ['https://www.googleapis.com/auth/drive.file'],
      },
      paths: testPaths,
    });

    // Store tokens
    authManager.storeTokens({
      access_token: 'test_token',
      refresh_token: 'refresh_token',
      expires_in: 3600,
      obtained_at: Date.now(),
      userInfo: { email: 'test@gmail.com' },
    });

    assert(authManager.isConnected(), 'Should be connected after storing tokens');

    // Disconnect
    authManager.clearTokens();
    assert(!authManager.isConnected(), 'Should not be connected after clearing tokens');

    // Reconnect
    authManager.storeTokens({
      access_token: 'new_token',
      refresh_token: 'new_refresh',
      expires_in: 3600,
      obtained_at: Date.now(),
      userInfo: { email: 'new@gmail.com' },
    });

    assert(authManager.isConnected(), 'Should be connected after reconnect');
    const account = authManager.getConnectedAccount();
    assert(account.email === 'new@gmail.com', 'Should have new account email');
  });

  await runTest('drive - expired OAuth token handling', async () => {
    const authManager = new GoogleAuthManager({
      config: {
        clientId: 'test',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
        driveApiBase: 'https://www.googleapis.com/drive/v3',
        uploadApiBase: 'https://www.googleapis.com/upload/drive/v3',
        scopes: ['https://www.googleapis.com/auth/drive.file'],
      },
      paths: testPaths,
    });

    // Store expired token with refresh token
    authManager.storeTokens({
      access_token: 'expired_token',
      refresh_token: 'valid_refresh',
      expires_in: 3600,
      obtained_at: Date.now() - 5000 * 1000, // Expired
      userInfo: { email: 'test@gmail.com' },
    });

    // Should attempt refresh
    const token = await authManager.getValidAccessToken();
    assert(token === 'mock_access_token_123', 'Should refresh and get new token');
  });

  await runTest('drive - revoked authorization handling', async () => {
    // Mock fetch to return 401 for refresh
    const originalFetch = global.fetch;
    global.fetch = async (url) => {
      if (url.includes('oauth2.googleapis.com/token')) {
        return {
          ok: false,
          status: 400,
          text: async () => 'invalid_grant',
          json: async () => ({ error: 'invalid_grant' }),
          headers: { get: () => null },
        };
      }
      return originalFetch(url);
    };

    const authManager = new GoogleAuthManager({
      config: {
        clientId: 'test',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
        driveApiBase: 'https://www.googleapis.com/drive/v3',
        uploadApiBase: 'https://www.googleapis.com/upload/drive/v3',
        scopes: ['https://www.googleapis.com/auth/drive.file'],
      },
      paths: testPaths,
    });

    authManager.storeTokens({
      access_token: 'expired',
      refresh_token: 'revoked_refresh',
      expires_in: 3600,
      obtained_at: Date.now() - 5000 * 1000,
      userInfo: { email: 'test@gmail.com' },
    });

    let failed = false;
    try {
      await authManager.getValidAccessToken();
    } catch (e) {
      failed = true;
      assert(e.message.includes('revoked') || e.message.includes('REFRESH_TOKEN_INVALID') || e.message.includes('reconnect'), 'Should detect revoked token');
    }
    assert(failed, 'Should fail when refresh token revoked');

    // Restore fetch
    global.fetch = originalFetch;
  });

  console.log('\n=== Test Summary ===');
  console.log(`Passed: ${testsPassed}`);
  console.log(`Failed: ${testsFailed}`);

  try {
    fs.rmSync(testBaseDir, { recursive: true, force: true });
  } catch (e) {}

  if (testsFailed > 0) {
    process.exit(1);
  } else {
    console.log('\nAll Google Drive tests passed!');
    process.exit(0);
  }
}

runAllTests().catch(e => {
  console.error('Test runner failed:', e);
  process.exit(1);
});
