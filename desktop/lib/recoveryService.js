/**
 * Recovery Service for Cross-Device Backup Restore
 * 
 * Problem: Current backup encryption key is stored via safeStorage (DPAPI) which is machine-bound.
 * If Computer A is lost, key is lost → backup unrecoverable.
 * 
 * Solution: Generate a recovery key that is the encryption key encoded in human-readable format.
 * User must write it down and keep it safe. On new PC, user enters recovery key to restore.
 * 
 * Security:
 * - Never expose key to renderer except when explicitly exporting recovery key (after auth)
 * - Never store recovery key plaintext
 * - Never put key in backup
 * - Never send to license server
 * - Never log key
 * - Recovery key IS the encryption key, encoded securely
 */

const crypto = require('crypto');
const { ENCRYPTION } = require('./constants');
const secureStorage = require('./secureStorage');

class RecoveryService {
  constructor(options = {}) {
    this.paths = options.paths || secureStorage.getAppDataPaths();
  }

  /**
   * Generate a new recovery key (same as backup encryption key)
   * Returns formatted recovery code for user to write down
   */
  generateRecoveryKey() {
    const key = crypto.randomBytes(ENCRYPTION.keyLength);
    const formatted = this.formatRecoveryKey(key);
    return {
      key,
      formatted,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Format key for display: grouped hex, e.g., XXXX-XXXX-XXXX-XXXX...
   * 32 bytes = 64 hex chars = 16 groups of 4
   */
  formatRecoveryKey(keyBuffer) {
    if (!Buffer.isBuffer(keyBuffer) || keyBuffer.length !== ENCRYPTION.keyLength) {
      throw new Error('Invalid key buffer');
    }
    const hex = keyBuffer.toString('hex').toUpperCase(); // 64 chars
    // Group into 16 groups of 4 chars separated by hyphen
    const groups = [];
    for (let i = 0; i < hex.length; i += 4) {
      groups.push(hex.slice(i, i + 4));
    }
    return groups.join('-'); // e.g., ABCD-EFGH-... (16 groups)
  }

  /**
   * Format with spaces for better readability and add checksum word
   * Returns: XXXX-XXXX-XXXX-XXXX-... (human readable)
   */
  formatRecoveryKeyWithChecksum(keyBuffer) {
    const formatted = this.formatRecoveryKey(keyBuffer);
    // Add simple checksum: first 4 chars of SHA256 of key
    const checksum = crypto.createHash('sha256').update(keyBuffer).digest('hex').slice(0, 4).toUpperCase();
    return `${formatted}-${checksum}`;
  }

  /**
   * Parse recovery key from user input
   * Accepts formats with or without hyphens, with or without checksum, case insensitive
   */
  parseRecoveryKey(input) {
    if (!input || typeof input !== 'string') {
      throw new Error('Recovery key is required');
    }

    // Remove all non-hex characters except we keep checksum part for validation
    const cleaned = input.toUpperCase().replace(/[^0-9A-F]/g, '');
    
    // Should be 64 hex chars (32 bytes) or 68 with checksum (64 + 4)
    let hexPart;
    let providedChecksum = null;

    if (cleaned.length === 64) {
      hexPart = cleaned;
    } else if (cleaned.length === 68) {
      hexPart = cleaned.slice(0, 64);
      providedChecksum = cleaned.slice(64, 68);
    } else if (cleaned.length > 68) {
      // Maybe user included extra, take first 64
      hexPart = cleaned.slice(0, 64);
      providedChecksum = cleaned.slice(64, 68);
    } else {
      throw new Error(`Invalid recovery key length: expected 64 hex characters, got ${cleaned.length}. Format: XXXX-XXXX-XXXX-XXXX-...`);
    }

    // Validate hex
    if (!/^[0-9A-F]{64}$/.test(hexPart)) {
      throw new Error('Invalid recovery key format: must be hexadecimal');
    }

    const keyBuffer = Buffer.from(hexPart, 'hex');
    if (keyBuffer.length !== ENCRYPTION.keyLength) {
      throw new Error('Invalid recovery key: wrong length after decoding');
    }

    // Verify checksum if provided
    if (providedChecksum) {
      const calculatedChecksum = crypto.createHash('sha256').update(keyBuffer).digest('hex').slice(0, 4).toUpperCase();
      if (calculatedChecksum !== providedChecksum) {
        throw new Error(`Recovery key checksum mismatch: expected ${calculatedChecksum}, got ${providedChecksum}. Key may be mistyped.`);
      }
    }

    return keyBuffer;
  }

  /**
   * Validate recovery key format without decoding (for UI)
   */
  validateRecoveryKeyFormat(input) {
    try {
      this.parseRecoveryKey(input);
      return { valid: true };
    } catch (e) {
      return { valid: false, error: e.message };
    }
  }

  /**
   * Get existing backup key or create new one, and return formatted recovery key
   * This should only be called when user explicitly requests to see recovery key
   */
  getOrCreateRecoveryKey() {
    const existingKey = secureStorage.getBackupKey();
    if (existingKey) {
      return {
        key: existingKey,
        formatted: this.formatRecoveryKeyWithChecksum(existingKey),
        isNew: false,
      };
    }

    // Generate new
    const generated = this.generateRecoveryKey();
    // Store it
    secureStorage.setSecureValue(secureStorage.getAppDataPaths().keyFile, {
      key: generated.key.toString('base64'),
      createdAt: generated.createdAt,
      version: 1,
    });

    return {
      key: generated.key,
      formatted: this.formatRecoveryKeyWithChecksum(generated.key),
      isNew: true,
    };
  }

  /**
   * Export recovery key for user to write down
   * Should only be allowed after authentication
   * Returns formatted key with warning
   */
  exportRecoveryKey() {
    const key = secureStorage.getBackupKey();
    if (!key) {
      throw new Error('No backup encryption key found. Create a backup first.');
    }

    return {
      formatted: this.formatRecoveryKeyWithChecksum(key),
      warning: 'IMPORTANT: Keep this recovery key safe. If you lose this computer and this key, your encrypted backups will be unrecoverable. Do not share this key. Store it offline in a secure location.',
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Import recovery key from user input (for new PC recovery)
   * Stores it via secureStorage
   */
  importRecoveryKey(formattedInput) {
    const keyBuffer = this.parseRecoveryKey(formattedInput);

    // Store via secure storage
    secureStorage.setSecureValue(secureStorage.getAppDataPaths().keyFile, {
      key: keyBuffer.toString('base64'),
      createdAt: new Date().toISOString(),
      version: 1,
      imported: true,
      importedAt: new Date().toISOString(),
    });

    return {
      success: true,
      message: 'Recovery key imported successfully. You can now restore backups from Google Drive.',
    };
  }

  /**
   * Check if recovery key exists
   * If custom paths provided (test), check only that file
   * Otherwise check secureStorage
   */
  hasRecoveryKey() {
    try {
      const fs = require('fs');
      if (this.paths && this.paths.keyFile) {
        // If custom paths (test or injected), check only that file
        return fs.existsSync(this.paths.keyFile);
      }
    } catch (e) {}
    return secureStorage.hasBackupKey();
  }

  /**
   * Delete recovery key (for testing or reset)
   */
  deleteRecoveryKey() {
    secureStorage.deleteBackupKey();
  }

  /**
   * Generate a 12-word mnemonic-like recovery phrase (alternative format)
   * For simplicity, we use hex format, but we can also support word list
   * This implementation uses a simple word list for better UX
   */
  generateMnemonicRecoveryKey() {
    // For now, use hex format as it's simpler and more secure
    // Future: implement BIP39-like word list
    return this.generateRecoveryKey();
  }
}

module.exports = RecoveryService;
