import React, { useCallback, useEffect, useState } from 'react';
import {
  Info,
  GraduationCap,
  RefreshCw,
  Download,
  Stethoscope,
  Headset,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { getSchoolApp } from '../../services/desktopBridge';

export const AboutView: React.FC = () => {
  const app = getSchoolApp();

  const [info, setInfo] = useState<any>(null);
  const [updateState, setUpdateState] = useState<{ state: string; version?: string; percent?: number; message?: string }>({
    state: 'idle',
  });
  const [checking, setChecking] = useState(false);
  const [diagnostics, setDiagnostics] = useState<string | null>(null);
  const [diagBusy, setDiagBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    if (!app) return;
    app.system.info().then(setInfo);
    const off = app.updater.onStatus(status => {
      if (status && status.state) setUpdateState(status);
    });
    return () => off();
  }, [app]);

  const checkForUpdates = useCallback(async () => {
    if (!app || checking) return;
    setChecking(true);
    setMessage(null);
    try {
      const res = await app.updater.check();
      if (res && res.ok === false) {
        setMessage({ kind: 'err', text: 'Could not check for updates. The application will retry automatically.' });
      }
    } finally {
      setChecking(false);
    }
  }, [app, checking]);

  const installUpdate = () => {
    if (!app) return;
    app.updater.install();
  };

  const exportDiagnostics = useCallback(async () => {
    if (!app || diagBusy) return;
    setDiagBusy(true);
    setMessage(null);
    try {
      const res = await app.system.diagnostics();
      if (res && res.ok) {
        const text = JSON.stringify(res.report, null, 2);
        setDiagnostics(text);
        // Copy for easy sharing with support (contains no secrets or student data).
        try {
          await navigator.clipboard.writeText(text);
          setMessage({ kind: 'ok', text: 'Diagnostic report copied to clipboard. Paste it into your support request.' });
        } catch {
          setMessage({ kind: 'ok', text: 'Diagnostic report generated below.' });
        }
      }
    } catch (e: any) {
      setMessage({ kind: 'err', text: e.message || 'Could not generate diagnostics.' });
    } finally {
      setDiagBusy(false);
    }
  }, [app, diagBusy]);

  return (
    <div className="space-y-6 pb-16 text-[#1d1d1f]">
      {/* Brand header */}
      <div className="bg-white rounded-[18px] border border-[#e5e5ea] p-8 shadow-xs text-center">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-[#0066cc] text-white mb-4 shadow-md">
          <GraduationCap className="h-8 w-8 text-white" />
        </div>
        <h2 className="text-xl font-semibold tracking-[-0.022em]">School Management System</h2>
        <p className="text-xs text-[#86868b] mt-1">Windows Desktop Edition</p>
        {info && (
          <div className="mt-3 inline-flex items-center space-x-2 bg-[#f5f5f7] px-4 py-1.5 rounded-full text-xs font-semibold border border-[#e5e5ea]">
            <span>Version {info.appVersion}</span>
          </div>
        )}
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

      {/* Updates */}
      <div className="bg-white rounded-[18px] border border-[#e5e5ea] p-6 shadow-xs">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center space-x-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0066cc]/10 text-[#0066cc]">
              <RefreshCw className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Application Updates</h3>
              <p className="text-xs text-[#86868b]">
                {updateState.state === 'available' && `Version ${updateState.version} is available.`}
                {updateState.state === 'downloading' && `Downloading update… ${updateState.percent ?? 0}%`}
                {updateState.state === 'downloaded' && `Version ${updateState.version} is ready to install.`}
                {updateState.state === 'up-to-date' && 'You are on the latest version.'}
                {updateState.state === 'checking' && 'Checking for updates…'}
                {(updateState.state === 'idle' || updateState.state === 'error') &&
                  'Updates keep your school data safe and are installed automatically.'}
              </p>
            </div>
          </div>
          {updateState.state === 'downloaded' ? (
            <button onClick={installUpdate} className="apple-btn-primary py-2 px-4 text-xs flex items-center space-x-2">
              <Download className="h-3.5 w-3.5" />
              <span>Restart &amp; Install</span>
            </button>
          ) : (
            <button
              onClick={checkForUpdates}
              disabled={checking || updateState.state === 'downloading'}
              className="apple-btn-secondary py-2 px-4 text-xs flex items-center space-x-2 disabled:opacity-60"
            >
              {checking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              <span>Check for Updates</span>
            </button>
          )}
        </div>
      </div>

      {/* Diagnostics */}
      <div className="bg-white rounded-[18px] border border-[#e5e5ea] p-6 shadow-xs">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center space-x-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#af52de]/10 text-[#af52de]">
              <Stethoscope className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">System Diagnostics</h3>
              <p className="text-xs text-[#86868b]">
                Safe to share with support — contains no passwords, tokens or student information.
              </p>
            </div>
          </div>
          <button
            onClick={exportDiagnostics}
            disabled={diagBusy}
            className="apple-btn-secondary py-2 px-4 text-xs flex items-center space-x-2 disabled:opacity-60"
          >
            {diagBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Stethoscope className="h-3.5 w-3.5" />}
            <span>Export Diagnostic Report</span>
          </button>
        </div>
        {diagnostics && (
          <pre className="mt-4 text-[10px] leading-relaxed bg-[#f5f5f7] border border-[#e5e5ea] rounded-xl p-4 max-h-64 overflow-auto font-mono whitespace-pre-wrap">
            {diagnostics}
          </pre>
        )}
      </div>

      {/* Version details */}
      {info && (
        <div className="bg-white rounded-[18px] border border-[#e5e5ea] p-6 shadow-xs">
          <div className="flex items-center space-x-2 mb-3">
            <Info className="h-4 w-4 text-[#86868b]" />
            <h3 className="font-semibold text-sm">Technical Details</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
            <Detail label="Application" value={info.appVersion} />
            <Detail label="Platform" value={info.platform} />
            <Detail label="Device" value={info.deviceName} />
          </div>
        </div>
      )}

      {/* Support */}
      <div className="bg-white rounded-[18px] border border-[#e5e5ea] p-6 shadow-xs">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center space-x-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#30a14e]/10 text-[#30a14e]">
              <Headset className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Contact Support</h3>
              <p className="text-xs text-[#86868b]">Reach your software administrator for license or technical help.</p>
            </div>
          </div>
          <SupportButton />
        </div>
      </div>
    </div>
  );
};

const Detail: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="bg-[#f5f5f7] p-3 rounded-xl border border-[#e5e5ea]">
    <span className="text-[11px] text-[#86868b] block">{label}</span>
    <span className="font-semibold text-[#1d1d1f] mt-0.5 block">{value}</span>
  </div>
);

const SupportButton: React.FC = () => {
  const [support, setSupport] = useState<{ url?: string; email?: string; phone?: string } | null>(null);
  const app = getSchoolApp();

  useEffect(() => {
    if (!app) return;
    app.auth.getSupport().then(res => {
      if (res && res.support) setSupport(res.support);
    });
  }, [app]);

  if (!app) return null;
  const target = support?.email ? `mailto:${support.email}` : support?.url;
  if (!target) return null;

  return (
    <button
      onClick={() => app.system.openExternal(target)}
      className="apple-btn-primary py-2 px-4 text-xs flex items-center space-x-2"
    >
      <Headset className="h-3.5 w-3.5" />
      <span>Get Support</span>
    </button>
  );
};
