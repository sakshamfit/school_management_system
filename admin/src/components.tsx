/**
 * Shared admin UI primitives — layout, sidebar, tables, badges, modals, toasts.
 */

import React, { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  Building2,
  KeyRound,
  MonitorSmartphone,
  Rocket,
  ScrollText,
  Settings,
  LogOut,
  ShieldCheck,
  X,
  AlertTriangle,
  Copy,
  Check,
} from 'lucide-react';
import { AdminProfile, logout } from './api';

/* ----------------------------- Status badges ----------------------------- */

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  SUSPENDED: 'bg-amber-50 text-amber-700 border-amber-200',
  ARCHIVED: 'bg-slate-100 text-slate-500 border-slate-200',
  EXPIRED: 'bg-red-50 text-red-700 border-red-200',
  REVOKED: 'bg-red-50 text-red-700 border-red-200',
  DEACTIVATED: 'bg-slate-100 text-slate-500 border-slate-200',
  PUBLISHED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  UNPUBLISHED: 'bg-slate-100 text-slate-500 border-slate-200',
  DISABLED: 'bg-slate-100 text-slate-500 border-slate-200',
  AUTHORIZED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

export function Badge({ value }: { value: string | null | undefined }) {
  if (!value) return <span className="text-slate-400 text-xs">—</span>;
  const style = STATUS_STYLES[value] ?? 'bg-slate-100 text-slate-600 border-slate-200';
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${style}`}>
      {value.replace(/_/g, ' ')}
    </span>
  );
}

/* --------------------------------- Modal --------------------------------- */

export function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onMouseDown={e => e.target === e.currentTarget && onClose()}
    >
      <div className={`a-card w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          <button className="a-btn-ghost !p-1.5 rounded-lg cursor-pointer" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

/* --------------------------------- Toast --------------------------------- */

interface ToastMsg {
  id: number;
  text: string;
  kind: 'success' | 'error';
}

let pushToastGlobal: (text: string, kind?: 'success' | 'error') => void = () => {};

export function toast(text: string, kind: 'success' | 'error' = 'success') {
  pushToastGlobal(text, kind);
}

export function ToastHost() {
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  useEffect(() => {
    pushToastGlobal = (text, kind = 'success') => {
      const id = Date.now() + Math.random();
      setToasts(prev => [...prev, { id, text, kind }]);
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
    };
    return () => {
      pushToastGlobal = () => {};
    };
  }, []);

  return (
    <div className="fixed bottom-5 right-5 z-[100] space-y-2">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`rounded-xl border px-4 py-3 text-sm font-medium shadow-lg ${
            t.kind === 'error'
              ? 'bg-red-50 border-red-200 text-red-700'
              : 'bg-emerald-50 border-emerald-200 text-emerald-700'
          }`}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------- Stat card ------------------------------- */

export function StatCard({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: 'default' | 'warning' | 'danger' | 'good';
}) {
  const tones: Record<string, string> = {
    default: 'text-slate-900',
    warning: 'text-amber-600',
    danger: 'text-red-600',
    good: 'text-emerald-600',
  };
  return (
    <div className="a-card p-5">
      <div className="text-xs font-semibold text-slate-500">{label}</div>
      <div className={`mt-1.5 text-3xl font-bold tracking-tight ${tones[tone]}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-400">{hint}</div>}
    </div>
  );
}

/* --------------------------- Copy-to-clipboard --------------------------- */

export function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="a-btn-secondary !px-2 !py-1 text-xs"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          toast('Copy failed — select and copy manually.', 'error');
        }
      }}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? 'Copied' : (label ?? 'Copy')}
    </button>
  );
}

/* ------------------------- One-time credentials -------------------------- */

export function CredentialsReveal({
  schoolCode,
  email,
  password,
  onClose,
}: {
  schoolCode: string;
  email: string;
  password: string;
  onClose: () => void;
}) {
  return (
    <Modal title="School credentials created" onClose={onClose}>
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 flex gap-3">
        <AlertTriangle className="h-5 w-5 shrink-0" />
        <p>
          <span className="font-semibold">Shown once only.</span> The temporary password is never
          stored in plaintext and cannot be recovered. Deliver these credentials to the customer
          through a secure channel, then close this window.
        </p>
      </div>
      <dl className="mt-5 space-y-3">
        <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
          <div>
            <dt className="text-xs font-semibold text-slate-500">School ID</dt>
            <dd className="font-mono text-sm font-semibold text-slate-900">{schoolCode}</dd>
          </div>
          <CopyButton text={schoolCode} />
        </div>
        <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
          <div>
            <dt className="text-xs font-semibold text-slate-500">Username / Email</dt>
            <dd className="font-mono text-sm font-semibold text-slate-900">{email}</dd>
          </div>
          <CopyButton text={email} />
        </div>
        <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
          <div>
            <dt className="text-xs font-semibold text-slate-500">Temporary Password</dt>
            <dd className="font-mono text-sm font-semibold text-slate-900">{password}</dd>
          </div>
          <CopyButton text={password} />
        </div>
      </dl>
      <div className="mt-6 flex justify-end">
        <button className="a-btn-primary" onClick={onClose}>
          I have stored these securely
        </button>
      </div>
    </Modal>
  );
}

/* --------------------------------- Layout -------------------------------- */

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'schools', label: 'Schools', icon: Building2 },
  { id: 'licenses', label: 'Licenses', icon: KeyRound },
  { id: 'devices', label: 'Devices', icon: MonitorSmartphone },
  { id: 'releases', label: 'Releases', icon: Rocket },
  { id: 'audit', label: 'Audit Logs', icon: ScrollText },
  { id: 'system', label: 'System', icon: Settings },
] as const;

export type NavId = (typeof NAV)[number]['id'];

export function Layout({
  admin,
  route,
  onNavigate,
  onLogout,
  children,
}: {
  admin: AdminProfile;
  route: string;
  onNavigate: (route: string) => void;
  onLogout: () => void;
  children: React.ReactNode;
}) {
  const handleLogout = async () => {
    await logout();
    onLogout();
  };

  return (
    <div className="min-h-screen flex">
      <aside className="w-64 shrink-0 border-r border-slate-200 bg-white flex flex-col">
        <div className="flex items-center gap-2.5 px-5 py-5 border-b border-slate-100">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-bold text-slate-900 leading-tight">SMS Control Panel</div>
            <div className="text-[11px] text-slate-400">Commercial Licensing</div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {NAV.map(item => (
            <div
              key={item.id}
              className={`a-nav-link ${route.startsWith(item.id) ? 'a-nav-link-active' : ''}`}
              onClick={() => onNavigate(item.id)}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </div>
          ))}
        </nav>
        <div className="border-t border-slate-100 p-4">
          <div className="text-xs font-semibold text-slate-700 truncate">{admin.name}</div>
          <div className="text-[11px] text-slate-400 truncate">{admin.email}</div>
          <button className="a-btn-ghost mt-3 w-full justify-start !text-red-600" onClick={handleLogout}>
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 min-w-0 p-6 lg:p-8">{children}</main>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}
