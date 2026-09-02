/**
 * Google Drive Client
 * Handles Drive API operations with minimal permissions (drive.file scope)
 * 
 * Features:
 * - Folder discovery/creation
 * - File upload with resumable fallback
 * - File listing, download, deletion
 * - Safe retry logic
 * - Offline detection
 */

const fs = require('fs');
const path = require('path');
const { getGoogleClientConfig, APP_FOLDER_NAME, BACKUP_SUBFOLDER_NAME, BACKUP_FILE_EXTENSION } = require('./constants');

class GoogleDriveClient {
  constructor(authManager, options = {}) {
    this.authManager = authManager;
    this.config = options.config || getGoogleClientConfig();
    this.folderCache = null; // { rootFolderId, backupFolderId }
  }

  /**
   * Make authenticated request to Drive API
   */
  async authenticatedFetch(url, options = {}) {
    const accessToken = await this.authManager.getValidAccessToken();
    
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      ...options.headers,
    };

    // Never log tokens
    const safeUrl = url.replace(/access_token=[^&]+/, 'access_token=REDACTED');
    
    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (response.status === 401) {
        // Token might be expired, try refresh once
        try {
          const newToken = await this.authManager.getValidAccessToken();
          headers.Authorization = `Bearer ${newToken}`;
          const retryResponse = await fetch(url, {
            ...options,
            headers,
          });
          return retryResponse;
        } catch (refreshErr) {
          throw new Error(`Authentication failed: ${refreshErr.message}`);
        }
      }

      return response;
    } catch (e) {
      if (e.message.includes('fetch failed') || e.message.includes('ENOTFOUND') || e.message.includes('ECONNREFUSED')) {
        throw new Error('INTERNET_UNAVAILABLE: No internet connection');
      }
      throw e;
    }
  }

  /**
   * Find folder by name in parent
   */
  async findFolderByName(name, parentId = null) {
    let query = `mimeType='application/vnd.google-apps.folder' and name='${name.replace(/'/g, "\\'")}' and trashed=false`;
    if (parentId) {
      query += ` and '${parentId}' in parents`;
    }

    const url = `${this.config.driveApiBase}/files?q=${encodeURIComponent(query)}&fields=files(id,name,parents)&pageSize=10`;
    
    const response = await this.authenticatedFetch(url);
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to search folder: ${response.status} ${text}`);
    }

    const data = await response.json();
    return data.files && data.files.length > 0 ? data.files[0] : null;
  }

  /**
   * Create folder
   */
  async createFolder(name, parentId = null) {
    const metadata = {
      name: name,
      mimeType: 'application/vnd.google-apps.folder',
    };
    if (parentId) {
      metadata.parents = [parentId];
    }

    const url = `${this.config.driveApiBase}/files?fields=id,name`;
    const response = await this.authenticatedFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(metadata),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to create folder ${name}: ${response.status} ${text}`);
    }

    return await response.json();
  }

  /**
   * Ensure backup folder structure exists
   * SchoolManagementSystem/
   *   School_Backup/
   */
  async ensureBackupFolder() {
    if (this.folderCache && this.folderCache.backupFolderId) {
      // Verify cache still valid
      try {
        const meta = await this.getFileMetadata(this.folderCache.backupFolderId);
        if (meta && !meta.trashed) {
          return this.folderCache;
        }
      } catch (e) {
        // Cache invalid, recreate
        this.folderCache = null;
      }
    }

    // Find or create root folder
    let rootFolder = await this.findFolderByName(APP_FOLDER_NAME);
    if (!rootFolder) {
      rootFolder = await this.createFolder(APP_FOLDER_NAME);
    }

    // Find or create backup subfolder
    let backupFolder = await this.findFolderByName(BACKUP_SUBFOLDER_NAME, rootFolder.id);
    if (!backupFolder) {
      backupFolder = await this.createFolder(BACKUP_SUBFOLDER_NAME, rootFolder.id);
    }

    this.folderCache = {
      rootFolderId: rootFolder.id,
      backupFolderId: backupFolder.id,
    };

    return this.folderCache;
  }

  /**
   * List backup files in backup folder
   */
  async listBackupFiles() {
    const { backupFolderId } = await this.ensureBackupFolder();

    let allFiles = [];
    let pageToken = null;

    do {
      let url = `${this.config.driveApiBase}/files?q=${encodeURIComponent(`'${backupFolderId}' in parents and trashed=false`)}&fields=nextPageToken,files(id,name,size,createdTime,modifiedTime,md5Checksum)&orderBy=modifiedTime desc&pageSize=100`;
      if (pageToken) {
        url += `&pageToken=${pageToken}`;
      }

      const response = await this.authenticatedFetch(url);
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to list backup files: ${response.status} ${text}`);
      }

      const data = await response.json();
      if (data.files) {
        allFiles = allFiles.concat(data.files);
      }
      pageToken = data.nextPageToken;
    } while (pageToken);

    // Filter only .smbak files and sort by modifiedTime desc
    const backupFiles = allFiles
      .filter(f => f.name.endsWith(BACKUP_FILE_EXTENSION))
      .sort((a, b) => new Date(b.modifiedTime) - new Date(a.modifiedTime));

    return backupFiles;
  }

  /**
   * Upload file to Drive
   * Uses multipart upload for small files, resumable for large
   */
  async uploadFile(folderId, fileName, fileBuffer, options = {}) {
    if (!Buffer.isBuffer(fileBuffer)) {
      throw new Error('File data must be Buffer');
    }

    const mimeType = options.mimeType || 'application/octet-stream';
    const existingFileId = options.existingFileId || null;

    // For files < 5MB, use multipart upload
    // For larger, use resumable (simplified here as multipart still works up to 5MB, but we support larger via resumable)
    if (fileBuffer.length < 5 * 1024 * 1024 && !options.forceResumable) {
      return await this.uploadMultipart(folderId, fileName, fileBuffer, mimeType, existingFileId);
    } else {
      return await this.uploadResumable(folderId, fileName, fileBuffer, mimeType, existingFileId);
    }
  }

  async uploadMultipart(folderId, fileName, fileBuffer, mimeType, existingFileId) {
    const metadata = {
      name: fileName,
      parents: existingFileId ? undefined : [folderId],
    };

    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const metadataPart = `Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}`;
    const filePartHeader = `Content-Type: ${mimeType}\r\n\r\n`;

    // Build multipart body
    const bodyStart = Buffer.from(delimiter + metadataPart + delimiter + filePartHeader, 'utf8');
    const bodyEnd = Buffer.from(closeDelimiter, 'utf8');
    const body = Buffer.concat([bodyStart, fileBuffer, bodyEnd]);

    let url;
    let method;
    if (existingFileId) {
      // Update existing file
      url = `${this.config.uploadApiBase}/files/${existingFileId}?uploadType=multipart&fields=id,name,size,modifiedTime`;
      method = 'PATCH';
    } else {
      url = `${this.config.uploadApiBase}/files?uploadType=multipart&fields=id,name,size,modifiedTime`;
      method = 'POST';
    }

    const response = await this.authenticatedFetch(url, {
      method,
      headers: {
        'Content-Type': `multipart/related; boundary=${boundary}`,
        'Content-Length': body.length.toString(),
      },
      body: body,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Upload failed: ${response.status} ${text}`);
    }

    return await response.json();
  }

  async uploadResumable(folderId, fileName, fileBuffer, mimeType, existingFileId) {
    // Initiate resumable upload
    const metadata = {
      name: fileName,
      parents: existingFileId ? undefined : [folderId],
    };

    let initiateUrl;
    let method;
    if (existingFileId) {
      initiateUrl = `${this.config.uploadApiBase}/files/${existingFileId}?uploadType=resumable&fields=id,name,size,modifiedTime`;
      method = 'PATCH';
    } else {
      initiateUrl = `${this.config.uploadApiBase}/files?uploadType=resumable&fields=id,name,size,modifiedTime`;
      method = 'POST';
    }

    const initResponse = await this.authenticatedFetch(initiateUrl, {
      method,
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': mimeType,
        'X-Upload-Content-Length': fileBuffer.length.toString(),
      },
      body: JSON.stringify(metadata),
    });

    if (!initResponse.ok) {
      const text = await initResponse.text();
      throw new Error(`Resumable upload initiation failed: ${initResponse.status} ${text}`);
    }

    const resumableUri = initResponse.headers.get('Location');
    if (!resumableUri) {
      throw new Error('No resumable URI returned');
    }

    // Upload the file
    const uploadResponse = await this.authenticatedFetch(resumableUri, {
      method: 'PUT',
      headers: {
        'Content-Type': mimeType,
        'Content-Length': fileBuffer.length.toString(),
      },
      body: fileBuffer,
    });

    if (!uploadResponse.ok) {
      const text = await uploadResponse.text();
      throw new Error(`Resumable upload failed: ${uploadResponse.status} ${text}`);
    }

    return await uploadResponse.json();
  }

  /**
   * Safe upload with temporary file then rename/verify
   */
  async safeUploadBackup(fileName, fileBuffer) {
    const { backupFolderId } = await this.ensureBackupFolder();

    // Upload as temporary file first
    const tempName = `${fileName}.tmp-${Date.now()}`;
    let tempFile;
    try {
      tempFile = await this.uploadFile(backupFolderId, tempName, fileBuffer, {
        mimeType: 'application/octet-stream',
      });
    } catch (e) {
      throw new Error(`Temporary upload failed: ${e.message}`);
    }

    // Verify upload by checking size
    try {
      const meta = await this.getFileMetadata(tempFile.id);
      if (parseInt(meta.size) !== fileBuffer.length) {
        // Cleanup temp file
        try { await this.deleteFile(tempFile.id); } catch (cleanupErr) {}
        throw new Error('Upload verification failed: size mismatch');
      }
    } catch (e) {
      try { await this.deleteFile(tempFile.id); } catch (cleanupErr) {}
      throw e;
    }

    // Now upload final file (or rename by creating new and deleting temp)
    // Drive doesn't have rename via upload, so we upload final and delete temp after verification
    let finalFile;
    let existingFile = null;

    // Check if file with same name exists (for latest backup)
    try {
      const existing = await this.findFileByName(fileName, backupFolderId);
      if (existing) existingFile = existing;
    } catch (e) {}

    try {
      if (existingFile) {
        finalFile = await this.uploadFile(backupFolderId, fileName, fileBuffer, {
          mimeType: 'application/octet-stream',
          existingFileId: existingFile.id,
        });
      } else {
        finalFile = await this.uploadFile(backupFolderId, fileName, fileBuffer, {
          mimeType: 'application/octet-stream',
        });
      }
    } catch (e) {
      try { await this.deleteFile(tempFile.id); } catch (cleanupErr) {}
      throw new Error(`Final upload failed: ${e.message}`);
    }

    // Verify final upload
    try {
      const finalMeta = await this.getFileMetadata(finalFile.id);
      if (parseInt(finalMeta.size) !== fileBuffer.length) {
        try { await this.deleteFile(finalFile.id); } catch (cleanupErr) {}
        throw new Error('Final upload verification failed');
      }
    } catch (e) {
      throw e;
    } finally {
      // Cleanup temp file
      try { await this.deleteFile(tempFile.id); } catch (cleanupErr) {}
    }

    return finalFile;
  }

  async findFileByName(name, parentId) {
    const query = `name='${name.replace(/'/g, "\\'")}' and '${parentId}' in parents and trashed=false`;
    const url = `${this.config.driveApiBase}/files?q=${encodeURIComponent(query)}&fields=files(id,name,size,modifiedTime)&pageSize=10`;
    
    const response = await this.authenticatedFetch(url);
    if (!response.ok) return null;
    
    const data = await response.json();
    return data.files && data.files.length > 0 ? data.files[0] : null;
  }

  /**
   * Download file
   */
  async downloadFile(fileId) {
    const url = `${this.config.driveApiBase}/files/${fileId}?alt=media`;
    const response = await this.authenticatedFetch(url);
    
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Download failed: ${response.status} ${text}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(fileId) {
    const url = `${this.config.driveApiBase}/files/${fileId}?fields=id,name,size,createdTime,modifiedTime,md5Checksum,trashed`;
    const response = await this.authenticatedFetch(url);
    
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to get file metadata: ${response.status} ${text}`);
    }

    return await response.json();
  }

  /**
   * Delete file
   */
  async deleteFile(fileId) {
    const url = `${this.config.driveApiBase}/files/${fileId}`;
    const response = await this.authenticatedFetch(url, { method: 'DELETE' });
    
    if (!response.ok && response.status !== 204) {
      const text = await response.text();
      throw new Error(`Failed to delete file: ${response.status} ${text}`);
    }

    return true;
  }

  /**
   * Check internet connectivity
   */
  async checkConnectivity() {
    try {
      // Try to fetch Google's connectivity check
      const response = await fetch('https://www.googleapis.com/generate_204', { 
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      return response.ok || response.status === 204;
    } catch (e) {
      return false;
    }
  }

  clearCache() {
    this.folderCache = null;
  }
}

module.exports = GoogleDriveClient;
