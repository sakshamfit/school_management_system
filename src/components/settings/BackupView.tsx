import React, { useCallback, useEffect, useState } from 'react';
import {
  DatabaseBackup,
  Save,
  RotateCcw,
  FolderOpen,
  HardDrive,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Trash2,
} from 'lucide-react';
import { getSchoolApp, DesktopBackupInfo } from '../../services/desktopBridge';

function formatSize(bytes: number): string {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export const BackupView: React.FC = () => {
  const [backups, setBackups] = useState<DesktopBackupInfo[]>([]);
  const [externalDir, setExternalDir] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | 'create' | 'restore' | 'dir'>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<string | null>(null);

  const app = getSchoolApp();

  const refresh = useCallback(async () => {
    if (!app) return;
    try {
      const res = await app.backup.list();
      if (res && res.ok) {
        setBackups(res.backups || []);
        setExternalDir(res.externalDir || null);
      }
    } catch {
      /* ignore */
    }
  }, [app]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleBackupNow = async () => {
    if (!app || busy) return;
    setBusy('create');
    setMessage(null);
    try {
      const res = await app.backup.create();
      if (res && res.error) {
        setMessage({ kind: 'err', text: res.message || 'Backup failed.' });
      } else {
        setMessage({
          kind: 'ok',
          text: `Backup created${res.mirrored ? ' (also copied to your external folder)' : ''}.`,
        });
        await refresh();
      }
    } catch (e: any) {
      setMessage({ kind: 'err', text: e.message || 'Backup failed.' });
    } finally {
      setBusy(null);
    }
  };

  const handleRestore = async () => {
    if (!app || busy || !restoreTarget) return;
    setBusy('restore');
    setMessage(null);
    try {
      const res = await app.backup.restore(restoreTarget);
      if (res && res.error) {
        setMessage({ kind: 'err', text: res.message || 'Restore failed.' });
      } else {
        setMessage({
          kind: 'ok',
          text: 'Backup restored successfully. The application will now reload your school data.',
        });
        setRestoreTarget(null);
        setTimeout(() => window.location.reload(), 1400);
      }
    } catch (e: any) {
      setMessage({ kind: 'err', text: e.message || 'Restore failed.' });
    } finally {
      setBusy(null);
    }
  };

  const handleChooseExternalDir = async () => {
    if (!app || busy) return;
    setBusy('dir');
    setMessage(null);
    try {
      const chosen = await app.backup.chooseExternalDir();
      if (chosen && chosen.ok && chosen.dir) {
        const set = await app.backup.setExternalDir(chosen.dir);
        if (set && set.error) {
          setMessage({ kind: 'err', text: set.message || 'Could not use that folder.' });
        } else {
          setMessage({ kind: 'ok', text: 'External backup folder configured. New backups will also be copied there.' });
          await refresh();
        }
      }
    } catch (e: any) {
      setMessage({ kind: 'err', text: e.message || 'Could not choose a folder.' });
    } finally {
      setBusy(null);
    }
  };

  const handleClearExternalDir = async () => {
    if (!app) return;
    setMessage(null);
    try {
      await app.backup.setExternalDir(null);
      setMessage({ kind: 'ok', text: 'External backup folder removed.' });
      await refresh();
    } catch (e: any) {
      setMessage({ kind: 'err', text: e.message || 'Could not clear folder.' });
    }
  };

  return (
    <div className="space-y-6 pb-16 text-[#1d1d1f]">
      <div className="bg-white rounded-[18px] border border-[#e5e5ea] p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#30a14e]/10 text-[#30a14e]">
            <DatabaseBackup className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold tracking-[-0.022em]">Backup &amp; Restore</h2>
            <p className="text-xs text-[#86868b]">Protect your school data with local and external backups</p>
          </div>
        </div>
        <button
          onClick={handleBackupNow}
          disabled={busy !== null}
          className="apple-btn-primary py-2.5 px-4 text-xs shrink-0 flex items-center space-x-2 disabled:opacity-60"
        >
          {busy === 'create' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          <span>Backup Now</span>
        </button>
      </div>

      {message && (
        <div
          className={`rounded-xl p-4 text-xs font-semibold flex items-center space-x-2 ${
            message.kind === 'ok'
              ? 'bg-[#30d158]/10 border border-[#30d158]/30 text-[#1e7e34]'
              : 'bg-[#ff3b30]/10 border border-[#ff3b30]/30 text-[#ff3b30]'
          }`}
        >
          {message.kind === 'ok' ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
          <span>{message.text}</span>
        </div>
      )}

      <div className="bg-white rounded-[18px] border border-[#e5e5ea] p-6 shadow-xs">
        <div className="flex items-center justify-between pb-4 border-b border-[#f0f0f0]">
          <div className="flex items-center space-x-2">
            <HardDrive className="h-4 w-4 text-[#0066cc]" />
            <h3 className="font-semibold text-sm">Backup History</h3>
          </div>
          <button
            onClick={() => app?.backup.openFolder()}
            className="apple-btn-secondary py-1.5 px-3 text-xs flex items-center space-x-1.5"
          >
            <FolderOpen className="h-3.5 w-3.5" />
            <span>Open Backup Folder</span>
          </button>
        </div>

        {backups.length === 0 ? (
          <p className="text-xs text-[#86868b] py-6 text-center">No backups yet. Create your first backup now.</p>
        ) : (
          <div className="mt-2 divide-y divide-[#f0f0f0]">
            {backups.map(b => (
              <div key={b.file} className="flex items-center justify-between py-3 gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-semibold truncate">{b.file}</div>
                  <div className="text-[11px] text-[#86868b] mt-0.5">
                    {new Date(b.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} · {formatSize(b.size)}
                  </div>
                </div>
                <button
                  onClick={() => setRestoreTarget(b.file)}
                  className="apple-btn-secondary py-1.5 px-3 text-xs flex items-center space-x-1.5 shrink-0"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Restore</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-[18px] border border-[#e5e5ea] p-6 shadow-xs">
        <h3 className="font-semibold text-sm mb-1">External Backup Folder</h3>
        <p className="text-xs text-[#86868b] mb-3">
          Copy every new backup to a separate drive or network location for extra safety.
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="text-xs font-mono bg-[#f5f5f7] border border-[#e5e5ea] rounded-lg px-3 py-2 flex-1 min-w-[200px] truncate">
            {externalDir || 'No external folder configured'}
          </div>
          <button
            onClick={handleChooseExternalDir}
            disabled={busy !== null}
            className="apple-btn-secondary py-2 px-3 text-xs flex items-center space-x-1.5 disabled:opacity-60"
          >
            {busy === 'dir' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <HardDrive className="h-3.5 w-3.5" />}
            <span>Choose…</span>
          </button>
          {externalDir && (
            <button
              onClick={handleClearExternalDir}
              className="apple-btn-secondary py-2 px-3 text-xs flex items-center space-x-1.5 text-[#ff3b30]"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Remove</span>
            </button>
          )}
        </div>
      </div>

      {restoreTarget && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[20px] border border-[#e5e5ea] p-6 max-w-md w-full shadow-xl">
            <div className="flex items-center space-x-3 pb-4 border-b border-[#f0f0f0]">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#ff9500]/15 text-[#ff9500]">
                <RotateCcw className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Restore this backup?</h3>
                <p className="text-xs text-[#86868b] font-mono truncate">{restoreTarget}</p>
              </div>
            </div>
            <p className="text-xs text-[#86868b] mt-4 leading-relaxed">
              Your current data will be backed up first, then replaced with this backup. Any changes made after the backup
              was created will be lost. The application will reload when finished.
            </p>
            <div className="flex justify-end space-x-2 mt-5">
              <button onClick={() => setRestoreTarget(null)} className="apple-btn-secondary py-2 px-4 text-xs" disabled={busy === 'restore'}>
                Cancel
              </button>
              <button
                onClick={handleRestore}
                disabled={busy === 'restore'}
                className="apple-btn-primary py-2 px-4 text-xs flex items-center space-x-2 disabled:opacity-60"
              >
                {busy === 'restore' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                <span>Restore Backup</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
