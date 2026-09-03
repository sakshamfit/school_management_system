/**
 * LicenseGate — the desktop app's commercial authorization gate.
 *
 * Wraps the whole application when running inside Electron:
 *   - no session            → customer login (no signup anywhere, by design)
 *   - authorized online     → app
 *   - offline within grace  → app + offline banner
 *   - offline past grace    → clear reconnect screen (data untouched)
 *   - license/device issue  → blocking screen with product copy
 *   - server unreachable    → offline-policy screen with last verification
 *
 * DATA SAFETY: this component renders screens only. It never deletes,
 * locks, or encrypts customer data — license state changes what the UI
 * shows, never what exists on disk.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ShieldCheck,
  WifiOff,
  AlertTriangle,
  Clock,
  KeyRound,
  RefreshCw,
  LogIn,
  ServerCrash,
  BadgeCheck,
} from 'lucide-react';
import {
  ControlPlaneState,
  getControlPlane,
} from '../../services/controlPlane';

/* ------------------------------ UI helpers ------------------------------ */

const Shell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="min-h-screen flex flex-col justify-center items-center p-4 bg-[#f5f5f7] text-[#1d1d1f]">
    <div className="w-full max-w-md">{children}</div>
  </div>
);

const Card: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="bg-white rounded-[20px] border border-[#e5e5ea] shadow-xs p-6">{children}</div>
);

function fmtDateTime(iso?: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function SupportFooter({ state }: { state: ControlPlaneState }) {
  return (
    <p className="text-center text-[11px] text-[#86868b] mt-4 leading-relaxed">
      Device {state.deviceIdentity.deviceUid.slice(0, 13)} • v{state.appVersion} •{' '}
      {state.serverUrlDisplay}
      <br />
      Need help? Contact your software provider and quote the device reference above.
    </p>
  );
}

/* ------------------------------- Login view ------------------------------ */

function LoginView({
  state,
  onLoggedIn,
}: {
  state: ControlPlaneState;
  onLoggedIn: (s: ControlPlaneState) => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [schoolCode, setSchoolCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cp = getControlPlane();
    if (!cp) return;
    setBusy(true);
    setError(null);
    try {
      const result = await cp.login({
        email: email.trim(),
        password,
        schoolCode: schoolCode.trim() || undefined,
      });
      if (!result.ok) {
        setError(result.message || 'Sign-in failed. Please try again.');
        if (result.state) onLoggedIn(result.state);
      } else {
        onLoggedIn(result.state);
      }
    } catch (err: any) {
      setError(err?.message || 'Sign-in failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell>
      <div className="text-center mb-7">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0066cc] text-white mb-3 shadow-md">
          <ShieldCheck className="h-7 w-7" />
        </div>
        <h1 className="text-xl font-semibold tracking-[-0.022em]">School Management System</h1>
        <p className="text-xs text-[#86868b] mt-1">
          Sign in with the credentials issued by your administrator
        </p>
      </div>

      <Card>
        <form onSubmit={submit} className="space-y-4">
          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700 whitespace-pre-line">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-[#86868b] mb-1">Email</label>
            <input
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full rounded-xl border border-[#d2d2d7] bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[#0066cc] focus:ring-2 focus:ring-[#0066cc]/15 transition"
              placeholder="you@school.com"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#86868b] mb-1">Password</label>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full rounded-xl border border-[#d2d2d7] bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[#0066cc] focus:ring-2 focus:ring-[#0066cc]/15 transition"
              placeholder="Your account password"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#86868b] mb-1">
              School ID <span className="font-normal text-[#b0b0b5]">(optional — extra verification)</span>
            </label>
            <input
              type="text"
              value={schoolCode}
              onChange={e => setSchoolCode(e.target.value.toUpperCase())}
              className="w-full rounded-xl border border-[#d2d2d7] bg-white px-3.5 py-2.5 text-sm font-mono outline-none focus:border-[#0066cc] focus:ring-2 focus:ring-[#0066cc]/15 transition"
              placeholder="SCH-0000"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#0066cc] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0055b3] active:bg-[#004a9e] transition disabled:opacity-50"
          >
            <LogIn className="h-4 w-4" />
            {busy ? 'Signing in…' : 'Sign in & activate this device'}
          </button>
          {!state.secureStoragePersistent && (
            <p className="text-[11px] text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              System keychain is unavailable: your session will not persist across restarts on
              this computer.
            </p>
          )}
        </form>
      </Card>
      <SupportFooter state={state} />
    </Shell>
  );
}

/* ------------------------- Blocking status screens ------------------------ */

function BlockedView({
  state,
  onRetry,
}: {
  state: ControlPlaneState;
  onRetry: () => void;
}) {
  const cp = getControlPlane();
  const reason = state.blockReason;

  const content: Record<string, { title: string; body: string }> = {
    LICENSE_EXPIRED: {
      title: 'Your license has expired.',
      body: 'Please contact your administrator.\n\nYour existing local data has NOT been deleted.',
    },
    LICENSE_SUSPENDED: {
      title: 'Your license is currently suspended.',
      body: 'Please contact your administrator.\n\nYour existing local data has NOT been deleted.',
    },
    LICENSE_REVOKED: {
      title: 'This license has been revoked.',
      body: 'Please contact your software provider for assistance.\n\nYour existing local data has NOT been deleted.',
    },
    DEVICE_DEACTIVATED: {
      title: 'This device has been deactivated.',
      body: 'Contact your administrator to reactivate this device or activate a different one.\n\nYour existing local data has NOT been deleted.',
    },
    SCHOOL_SUSPENDED: {
      title: 'This school account is suspended.',
      body: 'Please contact your software provider.\n\nYour existing local data has NOT been deleted.',
    },
    SCHOOL_ARCHIVED: {
      title: 'This school account has been archived.',
      body: 'Please contact your software provider if you believe this is a mistake.',
    },
    NO_ACTIVE_LICENSE: {
      title: 'No active license was found.',
      body: 'Please contact your administrator to issue a license for your school.',
    },
  };

  const copy = content[reason || ''] || {
    title: 'Authorization unavailable.',
    body: 'Please contact your administrator. Your existing local data has NOT been deleted.',
  };

  return (
    <Shell>
      <Card>
        <div className="text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 mb-4">
            <AlertTriangle className="h-7 w-7" />
          </div>
          <h1 className="text-lg font-semibold">{copy.title}</h1>
          <p className="mt-2 text-sm text-[#6e6e73] whitespace-pre-line leading-relaxed">{copy.body}</p>
        </div>
        <div className="mt-6 flex flex-col gap-2">
          <button
            onClick={onRetry}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#0066cc] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0055b3] transition"
          >
            <RefreshCw className="h-4 w-4" /> Re-check status
          </button>
          <button
            onClick={() => cp?.logout()}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-[#d2d2d7] px-4 py-2.5 text-sm font-semibold text-[#1d1d1f] hover:bg-[#f5f5f7] transition"
          >
            Sign out
          </button>
        </div>
        {state.license?.expires_at && (
          <p className="mt-4 text-center text-xs text-[#86868b]">
            License {state.license.license_key} • expired {fmtDateTime(state.license.expires_at)}
          </p>
        )}
      </Card>
      <SupportFooter state={state} />
    </Shell>
  );
}

function ServerUnavailableView({ state, onRetry }: { state: ControlPlaneState; onRetry: () => void }) {
  return (
    <Shell>
      <Card>
        <div className="text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 mb-4">
            <ServerCrash className="h-7 w-7" />
          </div>
          <h1 className="text-lg font-semibold">Unable to connect to licensing service.</h1>
          <p className="mt-2 text-sm text-[#6e6e73] leading-relaxed">
            Your local school data remains available according to your offline access policy.
          </p>
          {state.offline.lastValidatedAt && (
            <p className="mt-3 text-xs text-[#86868b]">
              Last successful verification:
              <br />
              <span className="font-semibold text-[#1d1d1f]">{fmtDateTime(state.offline.lastValidatedAt)}</span>
            </p>
          )}
        </div>
        <button
          onClick={onRetry}
          className="mt-6 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#0066cc] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0055b3] transition"
        >
          <RefreshCw className="h-4 w-4" /> Try again
        </button>
      </Card>
      <SupportFooter state={state} />
    </Shell>
  );
}

function GraceExpiredView({ state, onRetry }: { state: ControlPlaneState; onRetry: () => void }) {
  return (
    <Shell>
      <Card>
        <div className="text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 mb-4">
            <Clock className="h-7 w-7" />
          </div>
          <h1 className="text-lg font-semibold">Online verification is required.</h1>
          <p className="mt-2 text-sm text-[#6e6e73] leading-relaxed">
            This computer has been offline longer than the allowed {state.offline.graceHours}-hour
            grace period. Connect to the internet to verify your license.
          </p>
          <p className="mt-3 rounded-xl bg-emerald-50 border border-emerald-200 px-3.5 py-2.5 text-xs font-semibold text-emerald-700">
            Nothing has been deleted — your school data is intact on this computer.
          </p>
          {state.offline.lastValidatedAt && (
            <p className="mt-3 text-xs text-[#86868b]">
              Last successful verification: {fmtDateTime(state.offline.lastValidatedAt)}
            </p>
          )}
        </div>
        <button
          onClick={onRetry}
          className="mt-6 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#0066cc] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0055b3] transition"
        >
          <RefreshCw className="h-4 w-4" /> I'm online — verify now
        </button>
      </Card>
      <SupportFooter state={state} />
    </Shell>
  );
}

function OfflineBanner({ state }: { state: ControlPlaneState }) {
  if (state.phase !== 'OFFLINE_GRACE') return null;
  return (
    <div className="fixed top-0 inset-x-0 z-40 flex items-center justify-center gap-2 bg-amber-500/95 px-4 py-1.5 text-xs font-semibold text-white shadow-sm">
      <WifiOff className="h-3.5 w-3.5" />
      Offline mode — full functionality continues locally. Grace remaining: ~
      {Math.max(1, Math.round(state.offline.remainingHours))}h. Last verified{' '}
      {fmtDateTime(state.offline.lastValidatedAt)}.
    </div>
  );
}

/* --------------------------------- Gate ---------------------------------- */

export const LicenseGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<ControlPlaneState | null>(null);
  const cp = getControlPlane();

  useEffect(() => {
    if (!cp) return;
    let mounted = true;
    cp.getState().then(s => mounted && setState(s));
    const unsubscribe = cp.onStateChange(s => mounted && setState(s));
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [cp]);

  const retry = useCallback(async () => {
    if (!cp) return;
    setState(s => (s ? { ...s, phase: 'CHECKING' } : s));
    const next = await cp.refreshLicense();
    setState(next);
  }, [cp]);

  if (!cp) {
    // Browser (non-Electron): the license gate does not apply.
    return <>{children}</>;
  }

  if (!state || state.phase === 'CHECKING') {
    return (
      <Shell>
        <Card>
          <div className="flex flex-col items-center py-8 text-[#86868b]">
            <BadgeCheck className="h-8 w-8 mb-3 animate-pulse text-[#0066cc]" />
            <p className="text-sm font-medium">Checking your authorization…</p>
          </div>
        </Card>
      </Shell>
    );
  }

  switch (state.phase) {
    case 'LOGGED_OUT':
      return <LoginView state={state} onLoggedIn={setState} />;
    case 'BLOCKED':
      return <BlockedView state={state} onRetry={retry} />;
    case 'SERVER_UNAVAILABLE':
      return <ServerUnavailableView state={state} onRetry={retry} />;
    case 'GRACE_EXPIRED':
      return <GraceExpiredView state={state} onRetry={retry} />;
    case 'AUTHORIZED':
    case 'OFFLINE_GRACE':
      return (
        <>
          <OfflineBanner state={state} />
          {children}
        </>
      );
    default:
      return null;
  }
};

export default LicenseGate;

/* Utility re-export to keep imports tidy */
export { KeyRound };
