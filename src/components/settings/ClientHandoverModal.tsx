import React, { useState, useEffect } from 'react';
import {
  X,
  Monitor,
  Download,
  Upload,
  Copy,
  Check,
  ShieldCheck,
  Server,
  Smartphone,
  ExternalLink,
  Laptop,
  CheckCircle2,
  AlertCircle,
  FileCode,
  Sparkles,
  MessageSquare,
} from 'lucide-react';
import { useSchool } from '../../context/SchoolContext';
import { exportDatabaseToJson } from '../../utils/helpers';

interface ClientHandoverModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ClientHandoverModal: React.FC<ClientHandoverModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { db, importFullDatabase, isCloudConnected, lastCloudSyncTime } = useSchool();
  const [activeTab, setActiveTab] = useState<'desktop' | 'credentials' | 'backup' | 'deployment'>('desktop');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [importStatus, setImportStatus] = useState<{ success?: boolean; message?: string } | null>(null);

  useEffect(() => {
    // Capture beforeinstallprompt event for PWA Desktop installation
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    // Check if app is already running in standalone/desktop mode
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
      setIsInstalled(true);
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  if (!isOpen) return null;

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
    } else {
      alert(
        'To install as a Desktop App on Windows/Mac:\n1. Click the (Install/Download) icon in your browser address bar (top right in Chrome/Edge).\n2. Or open Browser Menu (⋮) -> "Install M.S. Public School" -> Click Install.\n3. The app will launch in a dedicated desktop window with desktop shortcut!'
      );
    }
  };

  const copyText = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleExportBackup = () => {
    const filename = `MSPS_School_Database_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    exportDatabaseToJson(db, filename);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = event => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        const res = importFullDatabase(parsed);
        if (res.success) {
          setImportStatus({ success: true, message: 'Database successfully imported and restored.' });
        } else {
          setImportStatus({ success: false, message: res.error || 'Failed to parse database file.' });
        }
      } catch (err: any) {
        setImportStatus({ success: false, message: 'Invalid JSON file: ' + err.message });
      }
    };
    reader.readAsText(file);
  };

  const activeTeachers = db.users.filter(u => u.role === 'teacher' && u.status === 'active');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 sm:p-4 backdrop-blur-sm animate-in fade-in overflow-y-auto">
      <div className="w-full max-w-3xl bg-white rounded-[20px] border border-[#e5e5ea] shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col text-[#1d1d1f]">
        {/* Header */}
        <div className="flex items-center justify-between bg-white p-5 border-b border-[#f0f0f0] shrink-0">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0066cc]/10 text-[#0066cc]">
              <Laptop className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-semibold tracking-[-0.022em] text-[#1d1d1f]">
                  Desktop App & Client Handover Hub
                </h3>
                <span className="bg-[#30d158]/10 text-[#30d158] text-[10px] font-semibold px-2 py-0.5 rounded-full">
                  Production Ready
                </span>
              </div>
              <p className="text-xs text-[#86868b]">
                Client setup instructions, desktop packaging, credentials & offline backups
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#f5f5f7] text-[#86868b] hover:text-[#1d1d1f] flex items-center justify-center transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center px-6 pt-3 border-b border-[#f0f0f0] gap-2 overflow-x-auto shrink-0 bg-[#fafafc]">
          <button
            onClick={() => setActiveTab('desktop')}
            className={`pb-3 text-xs font-semibold border-b-2 flex items-center space-x-1.5 transition-all ${
              activeTab === 'desktop'
                ? 'border-[#0066cc] text-[#0066cc]'
                : 'border-transparent text-[#86868b] hover:text-[#1d1d1f]'
            }`}
          >
            <Monitor className="h-3.5 w-3.5 shrink-0" />
            <span>1. Desktop App</span>
          </button>

          <button
            onClick={() => setActiveTab('credentials')}
            className={`pb-3 text-xs font-semibold border-b-2 flex items-center space-x-1.5 transition-all ${
              activeTab === 'credentials'
                ? 'border-[#0066cc] text-[#0066cc]'
                : 'border-transparent text-[#86868b] hover:text-[#1d1d1f]'
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
            <span>2. Client Credentials</span>
          </button>

          <button
            onClick={() => setActiveTab('deployment')}
            className={`pb-3 text-xs font-semibold border-b-2 flex items-center space-x-1.5 transition-all ${
              activeTab === 'deployment'
                ? 'border-[#0066cc] text-[#0066cc]'
                : 'border-transparent text-[#86868b] hover:text-[#1d1d1f]'
            }`}
          >
            <Server className="h-3.5 w-3.5 shrink-0" />
            <span>3. Build & Deployment</span>
          </button>

          <button
            onClick={() => setActiveTab('backup')}
            className={`pb-3 text-xs font-semibold border-b-2 flex items-center space-x-1.5 transition-all ${
              activeTab === 'backup'
                ? 'border-[#0066cc] text-[#0066cc]'
                : 'border-transparent text-[#86868b] hover:text-[#1d1d1f]'
            }`}
          >
            <Download className="h-3.5 w-3.5 shrink-0" />
            <span>4. Database Backup & Restore</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* TAB 1: DESKTOP APP */}
          {activeTab === 'desktop' && (
            <div className="space-y-4">
              {/* Highlight Hero Card */}
              <div className="bg-gradient-to-br from-[#0066cc]/5 to-[#0066cc]/15 p-5 rounded-2xl border border-[#0066cc]/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="flex h-2 w-2 rounded-full bg-[#30d158]"></span>
                    <h4 className="font-semibold text-sm text-[#1d1d1f]">
                      1-Click Desktop App (Windows & Mac)
                    </h4>
                  </div>
                  <p className="text-xs text-[#86868b] max-w-md leading-relaxed">
                    Install this portal as a native desktop application on the school computer. Launches in a dedicated window, creates a desktop icon, and works offline with automatic cloud sync.
                  </p>
                </div>
                <button
                  onClick={handleInstallClick}
                  className="apple-btn-primary py-2.5 px-5 text-xs whitespace-nowrap shadow-sm"
                >
                  <Download className="h-4 w-4 mr-2 shrink-0" />
                  <span>{isInstalled ? 'App Already Running' : 'Install Desktop App'}</span>
                </button>
              </div>

              {/* Easy Instructions for Client */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-[#f5f5f7] p-4 rounded-xl border border-[#e5e5ea]">
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0066cc] text-white text-xs font-bold">
                      A
                    </span>
                    <h5 className="font-semibold text-xs text-[#1d1d1f]">Google Chrome / Microsoft Edge</h5>
                  </div>
                  <ol className="text-xs text-[#86868b] space-y-1.5 list-decimal list-inside leading-relaxed">
                    <li>Open the school portal URL in Chrome or Edge.</li>
                    <li>Click the <strong>Install App icon (⊕)</strong> in the top-right address bar.</li>
                    <li>Click <strong>Install</strong>. A desktop shortcut will be placed on your PC desktop!</li>
                  </ol>
                </div>

                <div className="bg-[#f5f5f7] p-4 rounded-xl border border-[#e5e5ea]">
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#af52de] text-white text-xs font-bold">
                      B
                    </span>
                    <h5 className="font-semibold text-xs text-[#1d1d1f]">Apple macOS (Safari)</h5>
                  </div>
                  <ol className="text-xs text-[#86868b] space-y-1.5 list-decimal list-inside leading-relaxed">
                    <li>Open the school portal in Safari.</li>
                    <li>Click <strong>File → Add to Dock...</strong> from the top menu bar.</li>
                    <li>Click <strong>Add</strong>. It will appear directly in your Mac Dock and Applications folder!</li>
                  </ol>
                </div>
              </div>

              {/* Native Electron Executable Option */}
              <div className="bg-white p-4 rounded-xl border border-[#e5e5ea]">
                <div className="flex items-center space-x-2 mb-1.5">
                  <FileCode className="h-4 w-4 text-[#0066cc] shrink-0" />
                  <h5 className="font-semibold text-xs text-[#1d1d1f]">
                    Native Executable Packaging (.exe / .dmg)
                  </h5>
                </div>
                <p className="text-xs text-[#86868b] mb-3">
                  You can also bundle this project into a standalone Windows installer (.exe) or Mac (.dmg) using Electron:
                </p>
                <div className="bg-[#1d1d1f] text-white p-3 rounded-lg font-mono text-[11px] space-y-1 overflow-x-auto">
                  <p className="text-[#86868b]"># 1. Build production static bundle</p>
                  <p className="text-[#30d158]">npm run build</p>
                  <p className="text-[#86868b] mt-2"># 2. Package Windows .exe installer</p>
                  <p className="text-[#2997ff]">npm run desktop:win</p>
                  <p className="text-[#86868b] mt-2"># 3. Package macOS .dmg installer</p>
                  <p className="text-[#af52de]">npm run desktop:mac</p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CLIENT CREDENTIALS */}
          {activeTab === 'credentials' && (
            <div className="space-y-4">
              <div className="bg-white p-4 rounded-xl border border-[#e5e5ea]">
                <div className="flex items-center justify-between pb-3 border-b border-[#f0f0f0] mb-3">
                  <div className="flex items-center space-x-2">
                    <ShieldCheck className="h-4 w-4 text-[#0066cc] shrink-0" />
                    <h5 className="font-semibold text-xs text-[#1d1d1f]">
                      Principal / Headmaster Super Admin Access
                    </h5>
                  </div>
                  <span className="text-[11px] bg-[#0066cc]/10 text-[#0066cc] font-semibold px-2 py-0.5 rounded-full">
                    Primary Login
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-3 text-xs">
                  <div className="bg-[#f5f5f7] p-3 rounded-xl flex items-center justify-between border border-[#e5e5ea]">
                    <div>
                      <span className="text-[10px] text-[#86868b] block font-semibold">LOGIN EMAIL</span>
                      <span className="font-mono text-[#1d1d1f] font-semibold">mozammilalam1996@gmail.com</span>
                    </div>
                    <button
                      onClick={() => copyText('mozammilalam1996@gmail.com', 'p_email')}
                      className="text-[#0066cc] hover:underline text-[11px] font-semibold ml-2"
                    >
                      {copiedField === 'p_email' ? <Check className="h-3.5 w-3.5 text-[#30d158]" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>

                  <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200 text-emerald-800">
                    <span className="text-[10px] block font-semibold">LOGIN PASSWORD</span>
                    <p className="mt-1 text-[11px] leading-relaxed">
                      Managed securely in <span className="font-semibold">Firebase Authentication</span> —
                      it is never stored in this app, the database, or this handover sheet. Reset it via
                      the normal email/password reset flow if needed. Hand over credentials using a
                      secure channel only, never in screenshots or group chats.
                    </p>
                  </div>
                </div>
              </div>

              {/* Faculty Access Codes */}
              <div className="bg-white p-4 rounded-xl border border-[#e5e5ea]">
                <div className="flex items-center justify-between pb-3 border-b border-[#f0f0f0] mb-3">
                  <div className="flex items-center space-x-2">
                    <Smartphone className="h-4 w-4 text-[#af52de] shrink-0" />
                    <h5 className="font-semibold text-xs text-[#1d1d1f]">
                      Teacher 6-Digit Access Codes (Classroom Portals)
                    </h5>
                  </div>
                  <span className="text-[11px] text-[#86868b]">
                    {activeTeachers.length} Active Staff Members
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-60 overflow-y-auto pr-1">
                  {activeTeachers.map(t => (
                    <div
                      key={t.id}
                      className="bg-[#f5f5f7] p-3 rounded-xl flex items-center justify-between border border-[#e5e5ea] text-xs"
                    >
                      <div>
                        <p className="font-semibold text-[#1d1d1f]">{t.name}</p>
                        <p className="text-[11px] text-[#86868b]">{t.assignedClassName || 'Class 5'} • {t.subject || 'All Subjects'}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-bold text-[#0066cc] bg-white px-2.5 py-1 rounded-md border border-[#e5e5ea]">
                          {t.teacherCode || '501001'}
                        </span>
                        <button
                          onClick={() => copyText(t.teacherCode || '501001', t.id)}
                          className="text-[#86868b] hover:text-[#1d1d1f]"
                          title="Copy Code"
                        >
                          {copiedField === t.id ? <Check className="h-3.5 w-3.5 text-[#30d158]" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: BUILD & DEPLOYMENT */}
          {activeTab === 'deployment' && (
            <div className="space-y-4">
              <div className="bg-white p-4 rounded-xl border border-[#e5e5ea] space-y-3 text-xs">
                <div className="flex items-center space-x-2">
                  <Server className="h-4 w-4 text-[#0066cc] shrink-0" />
                  <h5 className="font-semibold text-xs text-[#1d1d1f]">
                    Production Web Deployment (For Giving Live URL to Client)
                  </h5>
                </div>
                <p className="text-xs text-[#86868b] leading-relaxed">
                  The client and teachers can access the app from any phone, tablet, laptop, or desktop via the web address without installing anything:
                </p>

                <div className="bg-[#1d1d1f] text-white p-3.5 rounded-xl font-mono text-[11px] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[#30d158] font-bold"># Option 1: Standard Static / Vercel / Netlify Deploy</span>
                    <button
                      onClick={() => copyText('npm run build', 'deploy_cmd_1')}
                      className="text-white/60 hover:text-white"
                    >
                      {copiedField === 'deploy_cmd_1' ? <Check className="h-3.5 w-3.5 text-[#30d158]" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                  <p className="text-white">npm run build</p>
                  <p className="text-[#86868b]"># Outputs optimized production files in /dist directory</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div className="bg-[#f5f5f7] p-3 rounded-xl border border-[#e5e5ea]">
                    <h6 className="font-semibold text-xs text-[#1d1d1f] mb-1">Vercel / Netlify / Cloud Run</h6>
                    <p className="text-[11px] text-[#86868b]">
                      Point the repository to the build command <code className="text-[#0066cc]">npm run build</code> and publish directory <code className="text-[#0066cc]">dist</code>.
                    </p>
                  </div>

                  <div className="bg-[#f5f5f7] p-3 rounded-xl border border-[#e5e5ea]">
                    <h6 className="font-semibold text-xs text-[#1d1d1f] mb-1">Firebase Hosting</h6>
                    <p className="text-[11px] text-[#86868b]">
                      Run <code className="text-[#0066cc]">firebase deploy --only hosting</code> to deploy instantly with free SSL certificate.
                    </p>
                  </div>
                </div>
              </div>

              {/* WhatsApp Notification Integration Setup */}
              <div className="bg-[#30d158]/5 border border-[#30d158]/20 p-4 rounded-xl space-y-2">
                <div className="flex items-center space-x-2">
                  <span className="text-base">💬</span>
                  <h5 className="font-semibold text-xs text-[#1d1d1f]">
                    WhatsApp Automation & Fee Receipt System
                  </h5>
                </div>
                <p className="text-xs text-[#86868b] leading-relaxed">
                  The system automatically generates formatted WhatsApp fee receipts, roll-call attendance alerts, and exam report cards directly addressed to parents. Works instantly on mobile and desktop via WhatsApp Web.
                </p>
              </div>
            </div>
          )}

          {/* TAB 4: DATABASE BACKUP & RESTORE */}
          {activeTab === 'backup' && (
            <div className="space-y-4">
              {importStatus && (
                <div
                  className={`p-3.5 rounded-xl border flex items-center space-x-2 text-xs font-semibold animate-in fade-in ${
                    importStatus.success
                      ? 'bg-[#30d158]/10 border-[#30d158]/30 text-[#30d158]'
                      : 'bg-[#ff3b30]/10 border-[#ff3b30]/30 text-[#ff3b30]'
                  }`}
                >
                  {importStatus.success ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                  ) : (
                    <AlertCircle className="h-4 w-4 shrink-0" />
                  )}
                  <span>{importStatus.message}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Export Card */}
                <div className="bg-white p-5 rounded-xl border border-[#e5e5ea] flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center space-x-2 mb-1.5">
                      <Download className="h-4 w-4 text-[#0066cc] shrink-0" />
                      <h5 className="font-semibold text-xs text-[#1d1d1f]">
                        Export Complete School Backup
                      </h5>
                    </div>
                    <p className="text-xs text-[#86868b] leading-relaxed">
                      Download the full offline JSON file containing all students, classes, fee ledgers, exam marks, and teacher accounts.
                    </p>
                  </div>
                  <button
                    onClick={handleExportBackup}
                    className="apple-btn-primary py-2.5 px-4 text-xs w-full"
                  >
                    <Download className="h-3.5 w-3.5 mr-1.5 shrink-0" />
                    <span>Download JSON Backup</span>
                  </button>
                </div>

                {/* Import Card */}
                <div className="bg-white p-5 rounded-xl border border-[#e5e5ea] flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center space-x-2 mb-1.5">
                      <Upload className="h-4 w-4 text-[#30d158] shrink-0" />
                      <h5 className="font-semibold text-xs text-[#1d1d1f]">
                        Restore / Import Database
                      </h5>
                    </div>
                    <p className="text-xs text-[#86868b] leading-relaxed">
                      Restore school records from a previously downloaded JSON backup file. Re-syncs instantly to Cloud Firestore.
                    </p>
                  </div>
                  <label className="apple-btn-secondary py-2.5 px-4 text-xs w-full cursor-pointer text-center flex items-center justify-center">
                    <Upload className="h-3.5 w-3.5 mr-1.5 shrink-0" />
                    <span>Upload & Restore Backup</span>
                    <input
                      type="file"
                      accept=".json,application/json"
                      onChange={handleImportFile}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Cloud Sync Status Info */}
              <div className="bg-[#f5f5f7] p-3.5 rounded-xl border border-[#e5e5ea] flex items-center justify-between text-xs">
                <span className="text-[#86868b]">Cloud Firestore Sync Status:</span>
                <span className="font-semibold text-[#30d158] flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-[#30d158] animate-pulse"></span>
                  {isCloudConnected ? 'Connected & Live' : 'Offline Cache Active'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-white border-t border-[#f0f0f0] flex items-center justify-between shrink-0">
          <span className="text-xs text-[#86868b]">
            M.S. Public School • Version 1.0.0
          </span>
          <button
            onClick={onClose}
            className="apple-btn-primary py-2 px-5 text-xs"
          >
            Close Hub
          </button>
        </div>
      </div>
    </div>
  );
};
