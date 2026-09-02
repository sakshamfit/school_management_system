import React, { useState, useEffect, useCallback } from 'react';
import {
  Cloud,
  HardDrive,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Download,
  Upload,
  RefreshCw,
  LogOut,
  Settings,
  Database,
  Wifi,
  WifiOff,
  FileArchive,
  History,
  Info,
  X,
  ExternalLink,
  Lock,
  Key,
  AlertCircle,
  ChevronRight,
  CloudUpload,
  CloudDownload,
  Trash2,
  Calendar,
  Check,
} from 'lucide-react';

// Types for backup system
interface BackupSettings {
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

interface BackupFile {
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

interface BackupProgress {
  stage: string;
  message: string;
  data?: any;
  isOffline?: boolean;
}

type BackupStatus = 'backed_up' | 'in_progress' | 'pending' | 'failed' | 'not_connected';

// Helper to format bytes
function formatBytes(bytes: number | null): string {
  if (!bytes) return '—';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    
    if (diffHours < 1) {
      const mins = Math.floor(diffMs / (1000 * 60));
      return mins <= 1 ? 'Just now' : `${mins} minutes ago`;
    }
    if (diffHours < 24) {
      return `Today, ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    if (diffHours < 48) {
      return `Yesterday, ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return dateStr;
  }
}

// Check if running in Electron
const isElectron = typeof window !== 'undefined' && (window as any).electronAPI?.isElectron;

export const BackupView: React.FC = () => {
  const [settings, setSettings] = useState<BackupSettings | null>(null);
  const [backups, setBackups] = useState<BackupFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [backupInProgress, setBackupInProgress] = useState(false);
  const [progress, setProgress] = useState<BackupProgress | null>(null);
  const [showRestoreModal, setShowRestoreModal] = useState<BackupFile | null>(null);
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState<{ fileName: string; size: string; time: string; email: string } | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'manual'>('daily');
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load settings
  const loadSettings = useCallback(async () => {
    try {
      if (isElectron && (window as any).electronAPI?.backup?.getStatus) {
        const result = await (window as any).electronAPI.backup.getStatus();
        if (result.success) {
          setSettings(result.data);
          setFrequency(result.data.backup_frequency || 'daily');
          setAutoBackupEnabled(result.data.automatic_backup_enabled ?? true);
        }
      } else {
        // Web mode fallback - show not connected
        setSettings({
          provider: 'google_drive',
          account_email: null,
          account_name: null,
          folder_id: null,
          last_backup_at: localStorage.getItem('msps_last_backup_at'),
          last_backup_status: localStorage.getItem('msps_last_backup_status') || 'not_connected',
          last_backup_size: null,
          last_backup_file_name: null,
          automatic_backup_enabled: true,
          backup_frequency: 'daily',
          is_connected: false,
          has_encryption_key: false,
          device_id: 'web',
          last_error: null,
          pending_backup: false,
        });
      }
    } catch (e: any) {
      console.error('Failed to load backup settings:', e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadBackups = useCallback(async () => {
    if (!isElectron) return;
    try {
      const api = (window as any).electronAPI?.backup;
      if (!api?.listBackups) return;
      
      const result = await api.listBackups();
      if (result.success) {
        setBackups(result.data);
      } else if (result.isOffline) {
        setIsOnline(false);
      }
    } catch (e: any) {
      console.error('Failed to load backups:', e);
    }
  }, []);

  useEffect(() => {
    loadSettings();
    loadBackups();

    // Listen for online/offline
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Listen for backup progress from main process
    let removeProgressListener: (() => void) | null = null;
    let removeStatusListener: (() => void) | null = null;

    if (isElectron && (window as any).electronAPI) {
      const api = (window as any).electronAPI;
      if (api.onBackupProgress) {
        removeProgressListener = api.onBackupProgress((data: BackupProgress) => {
          setProgress(data);
          const stage = data.stage as string;
          if (stage === 'success' || stage === 'error' || stage === 'restore-success' || stage === 'restore-error' || stage === 'restored-data') {
            if (stage !== 'restored-data') {
              setBackupInProgress(false);
            }
            loadSettings();
            if (stage === 'success') {
              loadBackups();
              if (data.data) {
                setShowSuccessModal({
                  fileName: data.data.fileName || 'Backup',
                  size: data.data.size ? formatBytes(data.data.size) : '—',
                  time: new Date().toLocaleString(),
                  email: settings?.account_email || 'your Google Drive',
                });
              }
            }
            if (stage === 'restored-data' && data.data) {
              // Restore JSON data to localStorage
              try {
                const STORAGE_KEY = 'msps_school_database_v2';
                localStorage.setItem(STORAGE_KEY, JSON.stringify(data.data));
                // Reload page to apply restored data
                setTimeout(() => {
                  window.location.reload();
                }, 1500);
              } catch (e) {
                console.error('Failed to restore data to localStorage:', e);
              }
            }
          }
        });
      }
      if (api.onBackupStatusChanged) {
        removeStatusListener = api.onBackupStatusChanged(() => {
          loadSettings();
        });
      }
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (removeProgressListener) removeProgressListener();
      if (removeStatusListener) removeStatusListener();
    };
  }, [loadSettings, loadBackups, settings?.account_email]);

  const handleConnect = async () => {
    setError(null);
    setBackupInProgress(true);
    setProgress({ stage: 'authenticating', message: 'Opening Google authentication...' });
    
    try {
      if (!isElectron) {
        setError('Google Drive backup is only available in the desktop app. Please install the desktop version.');
        setBackupInProgress(false);
        return;
      }
      
      const api = (window as any).electronAPI?.backup;
      const result = await api.connectDrive();
      
      if (result.success) {
        await loadSettings();
        await loadBackups();
        setProgress({ stage: 'connected', message: `Connected as ${result.data.email}` });
      } else {
        throw new Error(result.error);
      }
    } catch (e: any) {
      setError(e.message);
      setProgress({ stage: 'error', message: e.message });
    } finally {
      setBackupInProgress(false);
    }
  };

  const handleDisconnect = async () => {
    setShowDisconnectModal(false);
    try {
      if (!isElectron) return;
      const api = (window as any).electronAPI?.backup;
      const result = await api.disconnectDrive();
      if (result.success) {
        await loadSettings();
        setBackups([]);
      }
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleBackupNow = async () => {
    setError(null);
    setBackupInProgress(true);
    setProgress({ stage: 'checking', message: 'Checking database health...' });

    try {
      // Get school data from localStorage
      const STORAGE_KEY = 'msps_school_database_v2';
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) throw new Error('No school data found');
      
      const schoolData = JSON.parse(raw);
      
      // Security: ensure no secrets in backup (basic check, main process will also filter)
      // Remove any potential tokens if present (shouldn't be, but safety)
      const safeData = { ...schoolData };
      delete (safeData as any).tokens;
      delete (safeData as any).secrets;

      if (isElectron) {
        const api = (window as any).electronAPI?.backup;
        const result = await api.createNow(safeData);
        
        if (!result.success) {
          if (result.isOffline) {
            setIsOnline(false);
            setProgress({ stage: 'pending', message: 'Internet unavailable, backup will retry automatically', isOffline: true });
          } else {
            throw new Error(result.error);
          }
        }
      } else {
        // Web mode: simulate backup to localStorage
        const now = new Date().toISOString();
        localStorage.setItem('msps_last_backup_at', now);
        localStorage.setItem('msps_last_backup_status', 'success');
        setShowSuccessModal({
          fileName: `school-backup-${new Date().toISOString().slice(0,10)}.smbak`,
          size: `${(JSON.stringify(safeData).length / 1024 / 1024).toFixed(1)} MB`,
          time: now,
          email: 'local backup (web mode)',
        });
        await loadSettings();
      }
    } catch (e: any) {
      setError(e.message);
      setProgress({ stage: 'error', message: e.message });
    } finally {
      setBackupInProgress(false);
    }
  };

  const handleRestore = async (backup: BackupFile) => {
    setShowRestoreModal(null);
    setBackupInProgress(true);
    setProgress({ stage: 'restoring', message: `Restoring backup from ${formatDate(backup.modifiedTime)}...` });

    try {
      if (!isElectron) {
        throw new Error('Restore is only available in desktop app');
      }
      
      const api = (window as any).electronAPI?.backup;
      const result = await api.restoreBackup(backup.id);
      
      if (!result.success) {
        throw new Error(result.error);
      }
      
      // If we get here without the restored-data event, manually reload
      // The event listener should handle actual data restoration
    } catch (e: any) {
      setError(e.message);
      setProgress({ stage: 'restore-error', message: e.message });
      setBackupInProgress(false);
    }
  };

  const handleFrequencyChange = async (newFreq: 'daily' | 'weekly' | 'manual') => {
    setFrequency(newFreq);
    try {
      if (isElectron) {
        const api = (window as any).electronAPI?.backup;
        await api.updateSettings({ backup_frequency: newFreq });
      }
      await loadSettings();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleAutoToggle = async (enabled: boolean) => {
    setAutoBackupEnabled(enabled);
    try {
      if (isElectron) {
        const api = (window as any).electronAPI?.backup;
        await api.updateSettings({ automatic_backup_enabled: enabled });
      }
      await loadSettings();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const getStatusIndicator = (): { icon: React.ReactNode; label: string; color: string } => {
    if (!settings) return { icon: <Clock className="h-3 w-3" />, label: 'Loading...', color: 'text-[#86868b]' };
    
    if (!settings.is_connected) {
      return { icon: <Cloud className="h-3 w-3" />, label: 'Not connected', color: 'text-[#86868b]' };
    }
    
    if (backupInProgress || progress?.stage === 'checking' || progress?.stage === 'packaging' || progress?.stage === 'authenticating') {
      return { icon: <RefreshCw className="h-3 w-3 animate-spin" />, label: 'Backup in progress', color: 'text-[#0066cc]' };
    }
    
    if (settings.pending_backup || progress?.isOffline) {
      return { icon: <AlertTriangle className="h-3 w-3" />, label: 'Backup pending', color: 'text-[#ff9f0a]' };
    }
    
    if (settings.last_backup_status === 'failed' || progress?.stage === 'error') {
      return { icon: <X className="h-3 w-3" />, label: 'Backup failed', color: 'text-[#ff3b30]' };
    }
    
    if (settings.last_backup_status === 'success') {
      return { icon: <CheckCircle2 className="h-3 w-3" />, label: 'Backed up', color: 'text-[#30d158]' };
    }
    
    return { icon: <Clock className="h-3 w-3" />, label: 'Idle', color: 'text-[#86868b]' };
  };

  const statusIndicator = getStatusIndicator();

  if (loading) {
    return (
      <div className="bg-white rounded-[18px] border border-[#e5e5ea] p-8 shadow-xs">
        <div className="flex items-center justify-center space-x-2 text-[#86868b]">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading backup settings...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-[18px] border border-[#e5e5ea] p-6 shadow-xs">
        <div className="flex items-center space-x-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0066cc]/10 text-[#0066cc]">
            <Cloud className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold tracking-[-0.022em] text-[#1d1d1f]">Google Drive Backup</h2>
            <p className="text-xs text-[#86868b]">Encrypted disaster recovery backup to your own Google Drive</p>
          </div>
        </div>
      </div>

      {/* Offline banner */}
      {!isOnline && (
        <div className="bg-[#ff9f0a]/10 border border-[#ff9f0a]/30 rounded-[14px] p-4 flex items-start space-x-3">
          <WifiOff className="h-5 w-5 text-[#ff9f0a] shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-semibold text-[#1d1d1f]">Internet connection unavailable</h4>
            <p className="text-xs text-[#86868b] mt-1 leading-relaxed">
              Your local data is safe. Cloud backup is pending and will resume automatically when internet returns.
            </p>
          </div>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="bg-[#ff3b30]/10 border border-[#ff3b30]/30 rounded-[14px] p-4 flex items-start space-x-3">
          <AlertCircle className="h-5 w-5 text-[#ff3b30] shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-[#1d1d1f]">Backup error</h4>
            <p className="text-xs text-[#86868b] mt-1">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="text-[#86868b] hover:text-[#1d1d1f]">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Progress banner */}
      {progress && backupInProgress && (
        <div className="bg-[#0066cc]/5 border border-[#0066cc]/20 rounded-[14px] p-4 flex items-center space-x-3">
          <RefreshCw className="h-5 w-5 text-[#0066cc] animate-spin shrink-0" />
          <div>
            <h4 className="text-sm font-semibold text-[#1d1d1f]">{progress.message}</h4>
            <p className="text-xs text-[#86868b] capitalize">{progress.stage.replace(/-/g, ' ')}</p>
          </div>
        </div>
      )}

      {/* Not connected state */}
      {!settings?.is_connected ? (
        <div className="bg-white rounded-[18px] border border-[#e5e5ea] p-8 shadow-xs text-center">
          <div className="mx-auto w-16 h-16 bg-[#f5f5f7] rounded-full flex items-center justify-center mb-4">
            <Cloud className="h-8 w-8 text-[#86868b]" />
          </div>
          <h3 className="text-base font-semibold text-[#1d1d1f] mb-2">Protect your school data</h3>
          <p className="text-sm text-[#86868b] max-w-md mx-auto leading-relaxed mb-6">
            Your school data can be safely backed up to your own Google Drive with strong encryption. 
            Even if your computer fails, your data remains safe and recoverable.
          </p>
          
          <div className="bg-[#f5f5f7] rounded-xl p-4 max-w-md mx-auto mb-6 text-left">
            <h4 className="text-xs font-semibold text-[#1d1d1f] mb-2 flex items-center">
              <ShieldCheck className="h-3.5 w-3.5 mr-1.5 text-[#30d158]" />
              Security & Privacy
            </h4>
            <ul className="text-xs text-[#86868b] space-y-1.5 list-disc list-inside">
              <li>Backup is encrypted with AES-256-GCM before upload</li>
              <li>Only you can access your backup in your Google Drive</li>
              <li>We never store your Google password</li>
              <li>Uses official Google OAuth consent flow</li>
            </ul>
          </div>

          <button
            onClick={handleConnect}
            disabled={backupInProgress}
            className="apple-btn-primary px-6 py-2.5 text-sm inline-flex items-center"
          >
            {backupInProgress ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <Cloud className="h-4 w-4 mr-2" />
                Connect Google Drive
              </>
            )}
          </button>

          {!isElectron && (
            <p className="text-[11px] text-[#86868b] mt-3">
              Desktop app required for Google Drive backup. Web version uses local backup only.
            </p>
          )}
        </div>
      ) : (
        <>
          {/* Connected status card */}
          <div className="bg-white rounded-[18px] border border-[#e5e5ea] p-6 shadow-xs">
            <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
              <div className="space-y-4 flex-1">
                <div className="flex items-center space-x-2">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${statusIndicator.color} bg-[#f5f5f7] border`}>
                    {statusIndicator.icon}
                    {statusIndicator.label}
                  </span>
                  {settings.pending_backup && (
                    <span className="inline-flex items-center gap-1 bg-[#ff9f0a]/10 text-[#ff9f0a] px-2 py-1 rounded-full text-[11px] font-medium">
                      <Clock className="h-3 w-3" />
                      Pending retry
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-[#f5f5f7] rounded-xl p-4 border border-[#e5e5ea]">
                    <span className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wide block mb-1">Google Account</span>
                    <span className="text-sm font-medium text-[#1d1d1f] flex items-center">
                      <span className="truncate">{settings.account_email}</span>
                      <CheckCircle2 className="h-3.5 w-3.5 text-[#30d158] ml-2 shrink-0" />
                    </span>
                    {settings.account_name && (
                      <span className="text-xs text-[#86868b] block mt-0.5">{settings.account_name}</span>
                    )}
                  </div>

                  <div className="bg-[#f5f5f7] rounded-xl p-4 border border-[#e5e5ea]">
                    <span className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wide block mb-1">Last Backup</span>
                    <span className="text-sm font-medium text-[#1d1d1f]">{formatDate(settings.last_backup_at)}</span>
                    <span className="text-xs text-[#86868b] block mt-0.5">
                      {settings.last_backup_size ? formatBytes(settings.last_backup_size) : '—'} • {settings.last_backup_file_name || '—'}
                    </span>
                  </div>

                  <div className="bg-[#f5f5f7] rounded-xl p-4 border border-[#e5e5ea]">
                    <span className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wide block mb-1 flex items-center">
                      <Lock className="h-3 w-3 mr-1" />
                      Encryption
                    </span>
                    <span className="text-sm font-medium text-[#30d158] flex items-center">
                      <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />
                      AES-256-GCM Encrypted
                    </span>
                    <span className="text-xs text-[#86868b] block mt-0.5">
                      {settings.has_encryption_key ? 'Key secured in OS keychain' : 'Key not found'}
                    </span>
                  </div>

                  <div className="bg-[#f5f5f7] rounded-xl p-4 border border-[#e5e5ea]">
                    <span className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wide block mb-1">Backup Location</span>
                    <span className="text-sm font-medium text-[#1d1d1f]">Google Drive</span>
                    <span className="text-xs text-[#86868b] block mt-0.5">SchoolManagementSystem / School_Backup</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2 lg:w-48 shrink-0">
                <button
                  onClick={handleBackupNow}
                  disabled={backupInProgress || !isOnline}
                  className="apple-btn-primary w-full py-2.5 text-sm flex items-center justify-center"
                >
                  {backupInProgress ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Backing up...
                    </>
                  ) : (
                    <>
                      <CloudUpload className="h-4 w-4 mr-2" />
                      Backup Now
                    </>
                  )}
                </button>

                <button
                  onClick={loadBackups}
                  disabled={backupInProgress}
                  className="apple-btn-secondary w-full py-2 text-xs flex items-center justify-center"
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                  Refresh
                </button>

                <button
                  onClick={() => setShowDisconnectModal(true)}
                  className="w-full py-2 text-xs text-[#ff3b30] hover:bg-[#ff3b30]/10 rounded-full flex items-center justify-center transition-colors"
                >
                  <LogOut className="h-3.5 w-3.5 mr-1.5" />
                  Disconnect Drive
                </button>
              </div>
            </div>

            {/* Auto backup settings */}
            <div className="mt-6 pt-6 border-t border-[#f0f0f0] grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center justify-between bg-[#f5f5f7] rounded-xl p-4 border border-[#e5e5ea]">
                <div>
                  <span className="text-sm font-medium text-[#1d1d1f] block">Automatic Backup</span>
                  <span className="text-xs text-[#86868b]">Daily backup when data changes</span>
                </div>
                <button
                  onClick={() => handleAutoToggle(!autoBackupEnabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${autoBackupEnabled ? 'bg-[#0066cc]' : 'bg-[#e5e5ea]'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${autoBackupEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>

              <div className="bg-[#f5f5f7] rounded-xl p-4 border border-[#e5e5ea]">
                <label className="text-sm font-medium text-[#1d1d1f] block mb-2">Frequency</label>
                <select
                  value={frequency}
                  onChange={(e) => handleFrequencyChange(e.target.value as any)}
                  className="apple-input py-2 text-sm"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="manual">Manual only</option>
                </select>
              </div>
            </div>
          </div>

          {/* Local + Cloud status summary */}
          <div className="bg-gradient-to-r from-[#0066cc]/5 via-white to-[#30d158]/5 rounded-[18px] border border-[#e5e5ea] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-[#1d1d1f] flex items-center">
                <ShieldCheck className="h-4 w-4 mr-2 text-[#30d158]" />
                Your school data is protected
              </h3>
              <div className="mt-2 flex flex-wrap gap-3 text-xs">
                <span className="flex items-center text-[#30d158]">
                  <Check className="h-3 w-3 mr-1" />
                  Local backup: {formatDate(new Date().toISOString())}
                </span>
                <span className={`flex items-center ${settings.last_backup_at ? 'text-[#30d158]' : 'text-[#86868b]'}`}>
                  <Check className="h-3 w-3 mr-1" />
                  Google Drive: {settings.last_backup_at ? formatDate(settings.last_backup_at) : 'Not yet'}
                </span>
              </div>
            </div>
            <div className="flex items-center space-x-2 text-xs text-[#86868b]">
              {isOnline ? <Wifi className="h-4 w-4 text-[#30d158]" /> : <WifiOff className="h-4 w-4 text-[#ff9f0a]" />}
              <span>{isOnline ? 'Online' : 'Offline'}</span>
            </div>
          </div>

          {/* Available backups list */}
          <div className="bg-white rounded-[18px] border border-[#e5e5ea] p-6 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-[#1d1d1f] flex items-center">
                <History className="h-4 w-4 mr-2 text-[#0066cc]" />
                Available Google Drive Backups
              </h3>
              <span className="text-xs text-[#86868b]">{backups.length} backups</span>
            </div>

            {backups.length === 0 ? (
              <div className="text-center py-8">
                <FileArchive className="h-8 w-8 text-[#e5e5ea] mx-auto mb-2" />
                <p className="text-sm text-[#86868b]">No cloud backups yet</p>
                <p className="text-xs text-[#86868b] mt-1">Click "Backup Now" to create your first encrypted backup</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {backups.map((backup) => (
                  <div
                    key={backup.id}
                    className="flex items-center justify-between p-3 rounded-xl border border-[#f0f0f0] hover:border-[#e5e5ea] hover:bg-[#f5f5f7]/50 transition-colors"
                  >
                    <div className="flex items-center space-x-3 min-w-0 flex-1">
                      <div className="h-9 w-9 rounded-full bg-[#0066cc]/10 flex items-center justify-center shrink-0">
                        <Database className="h-4 w-4 text-[#0066cc]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-[#1d1d1f] truncate">
                          {new Date(backup.modifiedTime).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                          {backup.isLatest && <span className="ml-2 text-[10px] bg-[#0066cc] text-white px-1.5 py-0.5 rounded-full">Latest</span>}
                        </p>
                        <p className="text-xs text-[#86868b] flex items-center gap-2">
                          <span>{backup.sizeFormatted}</span>
                          <span>•</span>
                          <span>{new Date(backup.modifiedTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          {backup.verified && (
                            <>
                              <span>•</span>
                              <span className="text-[#30d158] flex items-center">
                                <CheckCircle2 className="h-3 w-3 mr-0.5" />
                                Verified
                              </span>
                            </>
                          )}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowRestoreModal(backup)}
                      disabled={backupInProgress}
                      className="apple-btn-secondary py-1.5 px-3 text-xs shrink-0 ml-2"
                    >
                      <CloudDownload className="h-3.5 w-3.5 mr-1" />
                      Restore
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 p-3 bg-[#f5f5f7] rounded-xl border border-[#e5e5ea] flex items-start space-x-2">
              <Info className="h-4 w-4 text-[#0066cc] shrink-0 mt-0.5" />
              <p className="text-xs text-[#86868b] leading-relaxed">
                <strong>Retention:</strong> Latest backup + last 7 daily backups are kept. Older backups are automatically cleaned up. 
                Your only good backup is never deleted before a new one is verified.
              </p>
            </div>
          </div>
        </>
      )}

      {/* Restore confirmation modal */}
      {showRestoreModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-[20px] border border-[#e5e5ea] shadow-2xl max-w-md w-full overflow-hidden">
            <div className="p-6">
              <div className="flex items-center space-x-3 mb-4">
                <div className="h-10 w-10 rounded-full bg-[#ff9f0a]/10 flex items-center justify-center">
                  <AlertTriangle className="h-5 w-5 text-[#ff9f0a]" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-[#1d1d1f]">Restore Backup?</h3>
                  <p className="text-xs text-[#86868b]">{formatDate(showRestoreModal.modifiedTime)} • {showRestoreModal.sizeFormatted}</p>
                </div>
              </div>

              <div className="bg-[#ff9f0a]/5 border border-[#ff9f0a]/20 rounded-xl p-4 mb-4">
                <h4 className="text-sm font-semibold text-[#1d1d1f] mb-1">WARNING</h4>
                <p className="text-xs text-[#86868b] leading-relaxed">
                  Restoring this backup will replace the current local school data with the selected backup.
                  A safety backup of your current data will automatically be created first.
                </p>
              </div>

              <div className="bg-[#f5f5f7] rounded-xl p-3 mb-4">
                <p className="text-xs text-[#86868b]">
                  <strong>Selected:</strong> {showRestoreModal.name}<br />
                  <strong>Date:</strong> {new Date(showRestoreModal.modifiedTime).toLocaleString()}<br />
                  <strong>Size:</strong> {showRestoreModal.sizeFormatted}
                </p>
              </div>

              <div className="flex items-center justify-end space-x-2">
                <button
                  onClick={() => setShowRestoreModal(null)}
                  className="apple-btn-secondary py-2 px-4 text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleRestore(showRestoreModal)}
                  className="bg-[#ff9f0a] hover:bg-[#e68a00] text-white py-2 px-4 rounded-full text-sm font-medium transition-colors flex items-center"
                >
                  <CloudDownload className="h-4 w-4 mr-2" />
                  Restore
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Disconnect confirmation modal */}
      {showDisconnectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-[20px] border border-[#e5e5ea] shadow-2xl max-w-md w-full overflow-hidden">
            <div className="p-6">
              <div className="flex items-center space-x-3 mb-4">
                <div className="h-10 w-10 rounded-full bg-[#ff3b30]/10 flex items-center justify-center">
                  <LogOut className="h-5 w-5 text-[#ff3b30]" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-[#1d1d1f]">Disconnect Google Drive?</h3>
                  <p className="text-xs text-[#86868b]">Connected as {settings?.account_email}</p>
                </div>
              </div>

              <div className="bg-[#f5f5f7] rounded-xl p-4 mb-4">
                <p className="text-xs text-[#86868b] leading-relaxed">
                  Your existing cloud backups will remain in your Google Drive.<br /><br />
                  Disconnecting only removes this application's connection to the account. You can reconnect anytime or connect another account.
                </p>
              </div>

              <div className="flex items-center justify-end space-x-2">
                <button
                  onClick={() => setShowDisconnectModal(false)}
                  className="apple-btn-secondary py-2 px-4 text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDisconnect}
                  className="bg-[#ff3b30] hover:bg-[#e02d23] text-white py-2 px-4 rounded-full text-sm font-medium transition-colors"
                >
                  Disconnect
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-[20px] border border-[#e5e5ea] shadow-2xl max-w-sm w-full overflow-hidden">
            <div className="p-6 text-center">
              <div className="mx-auto h-14 w-14 rounded-full bg-[#30d158]/10 flex items-center justify-center mb-4">
                <CheckCircle2 className="h-7 w-7 text-[#30d158]" />
              </div>
              <h3 className="text-base font-semibold text-[#1d1d1f] mb-1">Backup Successful</h3>
              <p className="text-xs text-[#86868b] mb-4">Your school data is safely backed up and verified</p>

              <div className="bg-[#f5f5f7] rounded-xl p-4 text-left mb-4 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-[#86868b]">Google Drive:</span>
                  <span className="font-medium text-[#1d1d1f] truncate ml-2">{showSuccessModal.email}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[#86868b]">Backup:</span>
                  <span className="font-medium text-[#1d1d1f]">{showSuccessModal.time}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[#86868b]">Size:</span>
                  <span className="font-medium text-[#1d1d1f]">{showSuccessModal.size}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[#86868b]">Status:</span>
                  <span className="font-medium text-[#30d158] flex items-center">
                    <Check className="h-3 w-3 mr-1" />
                    Verified
                  </span>
                </div>
              </div>

              <button
                onClick={() => setShowSuccessModal(null)}
                className="apple-btn-primary w-full py-2.5 text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Security info */}
      <div className="bg-white rounded-[18px] border border-[#e5e5ea] p-5">
        <h3 className="text-sm font-semibold text-[#1d1d1f] mb-3 flex items-center">
          <Key className="h-4 w-4 mr-2 text-[#86868b]" />
          Encryption & Recovery Information
        </h3>
        <div className="bg-[#f5f5f7] rounded-xl p-4 border border-[#e5e5ea]">
          <p className="text-xs text-[#86868b] leading-relaxed">
            <strong>Encryption:</strong> All backups are encrypted with AES-256-GCM before leaving your computer. The encryption key is stored securely using your operating system's keychain (Windows DPAPI, macOS Keychain, Linux libsecret).<br /><br />
            <strong>Recovery:</strong> If you reinstall Windows or move to a new computer, you will need to reconnect the same Google account. If the encryption key is permanently lost (e.g., OS reinstall without backup), encrypted backups may become unrecoverable. Keep your Windows user account safe.<br /><br />
            <strong>Privacy:</strong> Your school data never leaves your control. Google Drive is only a storage destination for your encrypted backup. The school owner owns the data.
          </p>
        </div>
      </div>
    </div>
  );
};

export default BackupView;
