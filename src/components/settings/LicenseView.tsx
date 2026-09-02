import React, { useCallback, useEffect, useState } from 'react';
import {
  ShieldCheck,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  MonitorSmartphone,
  Headset,
} from 'lucide-react';
import { useSchool } from '../../context/SchoolContext';
import { getSchoolApp } from '../../services/desktopBridge';

const STATUS_UI: Record<string, { color: string; label: string; icon: any }> = {
  ACTIVE: { color: '#30a14e', label: 'Active', icon: CheckCircle2 },
  EXPIRED: { color: '#b7791f', label: 'Expired', icon: AlertTriangle },
  SUSPENDED: { color: '#b7791f', label: 'Suspended', icon: AlertTriangle },
  REVOKED: { color: '#d0342c', label: 'Revoked', icon: XCircle },
};

export const LicenseView: React.FC = () => {
  const { desktopSession, refreshDesktopSession } = useSchool();
  const [validating, setValidating] = useState(false);
  const [validateMessage, setValidateMessage] = useState<string | null>(null);

  const license = desktopSession?.license || null;
  const school = desktopSession?.school || null;
  const status = license ? STATUS_UI[license.effectiveStatus] || STATUS_UI.REVOKED : null;
  const StatusIcon = status?.icon || ShieldCheck;

  const daysRemaining = license
    ? Math.ceil((new Date(license.expiresAt).getTime() - Date.now()) / 86400000)
    : null;

  const validateNow = useCallback(async () => {
    const app = getSchoolApp();
    if (!app || validating) return;
    setValidating(true);
    setValidateMessage(null);
    try {
      const res = await app.auth.validateNow();
      if (res && res.ok) {
        setValidateMessage(`License verified online — valid for ${res.daysRemaining} more day(s).`);
      } else {
        setValidateMessage(res?.message || 'License verification failed.');
      }
      await refreshDesktopSession();
    } finally {
      setValidating(false);
    }
  }, [validating, refreshDesktopSession]);

  useEffect(() => {
    // License warnings: 30 days / 7 days.
  }, [daysRemaining]);

  return (
    <div className="space-y-6 pb-16 text-[#1d1d1f]">
      <div className="bg-white rounded-[18px] border border-[#e5e5ea] p-6 shadow-xs flex items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0066cc]/10 text-[#0066cc]">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold tracking-[-0.022em]">License</h2>
            <p className="text-xs text-[#86868b]">Your school's activation and subscription status</p>
          </div>
        </div>
        <button onClick={validateNow} disabled={validating} className="apple-btn-secondary py-2 px-4 text-xs flex items-center space-x-2 disabled:opacity-60">
          {validating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          <span>Verify Online</span>
        </button>
      </div>

      {validateMessage && (
        <div className="bg-[#0066cc]/8 border border-[#0066cc]/25 rounded-xl p-4 text-xs font-semibold text-[#0066cc]">
          {validateMessage}
        </div>
      )}

      {license && status ? (
        <>
          <div className="bg-white rounded-[18px] border border-[#e5e5ea] p-6 shadow-xs">
            <div className="flex items-center justify-between pb-4 border-b border-[#f0f0f0]">
              <div className="flex items-center space-x-2">
                <StatusIcon className="h-5 w-5" style={{ color: status.color }} />
                <span className="text-sm font-bold" style={{ color: status.color }}>
                  License {status.label}
                </span>
              </div>
              {daysRemaining !== null && daysRemaining > 0 && license.effectiveStatus === 'ACTIVE' && (
                <span
                  className={`text-xs font-semibold px-3 py-1 rounded-full ${
                    daysRemaining <= 7 ? 'bg-[#ff3b30]/10 text-[#ff3b30]' : daysRemaining <= 30 ? 'bg-[#ff9500]/10 text-[#b7791f]' : 'bg-[#30d158]/10 text-[#30a14e]'
                  }`}
                >
                  {daysRemaining} days remaining
                </span>
              )}
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <Info label="School" value={school?.name || '—'} />
              <Info label="School ID" value={school?.schoolCode || '—'} mono />
              <Info label="License Key" value={license.licenseKey} mono />
              <Info label="Expires" value={new Date(license.expiresAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })} />
              <Info label="Devices" value={`${license.devicesUsed} / ${license.maxDevices}`} />
              <Info
                label="Last Verification"
                value={
                  desktopSession?.lastVerifiedAt
                    ? new Date(desktopSession.lastVerifiedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                    : '—'
                }
              />
            </div>
          </div>

          {license.effectiveStatus !== 'ACTIVE' && (
            <div className="bg-[#ff3b30]/8 border border-[#ff3b30]/25 rounded-[18px] p-6">
              <div className="flex items-start space-x-3">
                <AlertTriangle className="h-5 w-5 text-[#ff3b30] shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-bold text-[#ff3b30]">
                    {license.effectiveStatus === 'EXPIRED' ? 'Your school license has expired.' : `License ${status.label.toLowerCase()}.`}
                  </h3>
                  <p className="text-xs text-[#1d1d1f] mt-1">
                    Please contact the administrator to renew or restore access. Your local school data remains safe on this computer.
                  </p>
                  <ContactSupport />
                </div>
              </div>
            </div>
          )}

          {desktopSession?.mode === 'offline' && license.effectiveStatus === 'ACTIVE' && (
            <div className="bg-[#ff9500]/8 border border-[#ff9500]/30 rounded-[18px] p-4 text-xs text-[#1d1d1f] flex items-start space-x-2">
              <AlertTriangle className="h-4 w-4 text-[#b7791f] shrink-0 mt-0.5" />
              <span>
                You are working offline. The license will be re-verified automatically when the internet connection returns
                (offline access is allowed for {license.offlineGraceDays} days after the last verification).
              </span>
            </div>
          )}
        </>
      ) : (
        <div className="bg-white rounded-[18px] border border-[#e5e5ea] p-8 text-center text-sm text-[#86868b]">
          License information is unavailable right now.
        </div>
      )}

      <div className="bg-white rounded-[18px] border border-[#e5e5ea] p-6 shadow-xs">
        <h3 className="text-sm font-semibold mb-2 flex items-center space-x-2">
          <MonitorSmartphone className="h-4 w-4 text-[#0066cc]" />
          <span>About device activation</span>
        </h3>
        <p className="text-xs text-[#86868b] leading-relaxed">
          This computer uses one of your school's licensed device slots. To move the software to a different computer,
          ask your software administrator to deactivate this device — then sign in on the new computer to activate it.
        </p>
      </div>
    </div>
  );
};

const Info: React.FC<{ label: string; value: string; mono?: boolean }> = ({ label, value, mono }) => (
  <div className="bg-[#f5f5f7] p-3.5 rounded-xl border border-[#e5e5ea]">
    <span className="text-[11px] text-[#86868b] block">{label}</span>
    <span className={`font-semibold text-[#1d1d1f] mt-1 block text-xs ${mono ? 'font-mono' : ''}`}>{value}</span>
  </div>
);

const ContactSupport: React.FC = () => {
  const { desktopSession } = useSchool();
  const support = desktopSession?.support;
  const app = getSchoolApp();
  if (!app || !support || (!support.email && !support.url)) return null;
  const target = support.email ? `mailto:${support.email}` : support.url!;
  return (
    <button
      onClick={() => app.system.openExternal(target)}
      className="mt-3 apple-btn-primary py-2 px-4 text-xs inline-flex items-center space-x-2"
    >
      <Headset className="h-3.5 w-3.5" />
      <span>Contact Administrator</span>
    </button>
  );
};
