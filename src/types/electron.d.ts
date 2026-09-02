/**
 * Type definitions for Electron API exposed via preload
 */

export interface BackupSettings {
  provider: string;
  account_email: string | null;
  account_name: string | null;
  folder_id: string | null;
  last_backup_at: string | null;
  last_backup_status: string;
  last_backup_size: number | null;
  last_backup_file_name: string | null;
  automatic_backup_enabled: boolean;
  backup_frequency: 'daily' | 'weekly' | 'manual';
  is_connected: boolean;
  has_encryption_key: boolean;
  device_id: string;
  last_error: string | null;
  pending_backup: boolean;
}

export interface BackupFile {
  id: string;
  name: string;
  size: number;
  sizeFormatted: string;
  createdTime: string;
  modifiedTime: string;
  verified: boolean;
  checksum: string | null;
  isLatest: boolean;
}

export interface BackupProgress {
  stage: string;
  message: string;
  data?: any;
  isOffline?: boolean;
}

export interface ElectronBackupAPI {
  getStatus: () => Promise<{ success: boolean; data?: BackupSettings; error?: string }>;
  connectDrive: () => Promise<{ success: boolean; data?: any; error?: string }>;
  disconnectDrive: () => Promise<{ success: boolean; data?: any; error?: string }>;
  createNow: (schoolData: any) => Promise<{ success: boolean; data?: any; error?: string; isOffline?: boolean }>;
  listBackups: () => Promise<{ success: boolean; data?: BackupFile[]; error?: string; isOffline?: boolean }>;
  restoreBackup: (fileId: string) => Promise<{ success: boolean; data?: any; error?: string }>;
  getSettings: () => Promise<{ success: boolean; data?: BackupSettings; error?: string }>;
  updateSettings: (settings: any) => Promise<{ success: boolean; data?: any; error?: string }>;
  getHistory: () => Promise<{ success: boolean; data?: any[]; error?: string }>;
  checkConnectivity: () => Promise<{ success: boolean; data?: { online: boolean; error?: string } }>;
  getAdminMetadata: () => Promise<{ success: boolean; data?: any; error?: string }>;
  createLocalBackup: (schoolData: any) => Promise<{ success: boolean; data?: any; error?: string }>;
  exportLocalBackup: (schoolData: any, fileName: string) => Promise<{ success: boolean; data?: any; error?: string }>;
}

declare global {
  interface Window {
    electronAPI?: {
      isElectron: boolean;
      platform: string;
      backup: ElectronBackupAPI;
      app: {
        getVersion: () => Promise<{ success: boolean; data?: string }>;
        getPaths: () => Promise<{ success: boolean; data?: any }>;
      };
      secure: {
        hasBackupKey: () => Promise<{ success: boolean; data?: { hasKey: boolean } }>;
        getBackupInfo: () => Promise<{ success: boolean; data?: any }>;
      };
      onBackupProgress: (callback: (data: BackupProgress) => void) => () => void;
      onBackupStatusChanged: (callback: (data: any) => void) => () => void;
    };
    desktopAPI?: {
      isDesktop: boolean;
      backup: {
        getStatus: () => Promise<any>;
        connect: () => Promise<any>;
        disconnect: () => Promise<any>;
        backupNow: (data: any) => Promise<any>;
        list: () => Promise<any>;
        restore: (id: string) => Promise<any>;
      };
    };
  }
}
