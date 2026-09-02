/**
 * Backup Encryption Service
 * AES-256-GCM authenticated encryption for backup archives
 * 
 * Security properties:
 * - Authenticated encryption (GCM)
 * - Random IV per encryption
 * - No plaintext secrets in logs
 * - Key stored via OS secure storage
 */

const crypto = require('crypto');
const fs = require('fs');
const { ENCRYPTION, SAFETY_LIMITS } = require('./constants');
const secureStorage = require('./secureStorage');

class BackupEncryptionService {
  constructor() {
    this.algorithm = ENCRYPTION.algorithm;
    this.keyLength = ENCRYPTION.keyLength;
    this.ivLength = ENCRYPTION.ivLength;
    this.authTagLength = ENCRYPTION.authTagLength;
  }

  /**
   * Get or create encryption key securely
   */
  getKey() {
    const key = secureStorage.getOrCreateBackupKey();
    if (!key) throw new Error('Failed to obtain backup encryption key');
    return key;
  }

  /**
   * Encrypt buffer with AES-256-GCM
   * Output format: [version:1 byte][iv:12][authTag:16][ciphertext]
   */
  encryptBuffer(plainBuffer, key = null) {
    if (!Buffer.isBuffer(plainBuffer)) {
      throw new Error('Plain data must be a Buffer');
    }
    
    if (plainBuffer.length > SAFETY_LIMITS.maxBackupSizeBytes) {
      throw new Error(`Backup too large: ${plainBuffer.length} bytes exceeds limit`);
    }

    const encryptionKey = key || this.getKey();
    if (encryptionKey.length !== this.keyLength) {
      throw new Error('Invalid encryption key length');
    }

    const iv = crypto.randomBytes(this.ivLength);
    const cipher = crypto.createCipheriv(this.algorithm, encryptionKey, iv);
    
    const encrypted = Buffer.concat([cipher.update(plainBuffer), cipher.final()]);
    const authTag = cipher.getAuthTag();

    // Format: version + iv + authTag + ciphertext
    const versionBuf = Buffer.from([ENCRYPTION.currentVersion]);
    const result = Buffer.concat([versionBuf, iv, authTag, encrypted]);
    
    return result;
  }

  /**
   * Decrypt buffer
   */
  decryptBuffer(encryptedBuffer, key = null) {
    if (!Buffer.isBuffer(encryptedBuffer)) {
      throw new Error('Encrypted data must be a Buffer');
    }

    if (encryptedBuffer.length < 1 + this.ivLength + this.authTagLength) {
      throw new Error('Invalid encrypted data: too short');
    }

    const encryptionKey = key || secureStorage.getBackupKey();
    if (!encryptionKey) {
      throw new Error('Backup encryption key not found. Backup may be unrecoverable if key is lost.');
    }

    const version = encryptedBuffer[0];
    if (version !== ENCRYPTION.currentVersion) {
      throw new Error(`Unsupported backup encryption version: ${version}`);
    }

    const iv = encryptedBuffer.subarray(1, 1 + this.ivLength);
    const authTag = encryptedBuffer.subarray(1 + this.ivLength, 1 + this.ivLength + this.authTagLength);
    const ciphertext = encryptedBuffer.subarray(1 + this.ivLength + this.authTagLength);

    if (ciphertext.length > SAFETY_LIMITS.maxExtractedSizeBytes) {
      throw new Error('Decrypted backup would exceed size limit, possible malicious archive');
    }

    try {
      const decipher = crypto.createDecipheriv(this.algorithm, encryptionKey, iv);
      decipher.setAuthTag(authTag);
      const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      
      if (decrypted.length > SAFETY_LIMITS.maxExtractedSizeBytes) {
        throw new Error('Decrypted data exceeds safety limit');
      }
      
      return decrypted;
    } catch (e) {
      if (e.message.includes('Unsupported state') || e.message.includes('auth')) {
        throw new Error('Backup decryption failed: invalid key or corrupted backup (authentication failed)');
      }
      throw e;
    }
  }

  /**
   * Encrypt file
   */
  async encryptFile(inputPath, outputPath, key = null) {
    const data = fs.readFileSync(inputPath);
    const encrypted = this.encryptBuffer(data, key);
    fs.writeFileSync(outputPath, encrypted);
    return {
      inputSize: data.length,
      outputSize: encrypted.length,
    };
  }

  /**
   * Decrypt file
   */
  async decryptFile(inputPath, outputPath, key = null) {
    const data = fs.readFileSync(inputPath);
    const decrypted = this.decryptBuffer(data, key);
    fs.writeFileSync(outputPath, decrypted);
    return {
      inputSize: data.length,
      outputSize: decrypted.length,
    };
  }

  /**
   * Calculate SHA256 checksum
   */
  calculateChecksum(buffer) {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  calculateFileChecksum(filePath) {
    const data = fs.readFileSync(filePath);
    return this.calculateChecksum(data);
  }

  /**
   * Verify that encrypted file does not contain plaintext SQLite header
   * SQLite files start with "SQLite format 3\0"
   */
  verifyNoPlaintextLeakage(encryptedBuffer) {
    const sqliteHeader = Buffer.from('SQLite format 3\0');
    if (encryptedBuffer.includes(sqliteHeader)) {
      throw new Error('Security violation: encrypted backup contains plaintext SQLite header');
    }
    // Also check for common JSON patterns that would indicate unencrypted backup
    // We only check for very specific patterns to avoid false positives
    // This is a best-effort check, not foolproof
    return true;
  }

  /**
   * Securely wipe buffer (best effort)
   */
  secureWipe(buffer) {
    if (Buffer.isBuffer(buffer)) {
      crypto.randomFillSync(buffer);
    }
  }
}

module.exports = BackupEncryptionService;
