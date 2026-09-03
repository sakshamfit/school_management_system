/**
 * System — operational status and production-readiness checklist.
 * Values of secrets are never displayed; only configured/strong booleans.
 */

import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { api, fmtDate } from '../api';
import { PageHeader, toast } from '../components';

interface SystemInfo {
  version: string;
  node_env: string;
  node_version: string;
  uptime_seconds: number;
  database: { integrity_ok: boolean; size_bytes: number; wal_mode: string };
  backup: { directory_configured: boolean; last_backup: { file: string; at: string } | null };
  tls: { direct_tls_configured: boolean; trust_proxy: boolean; https_ready: boolean };
  secrets: {
    license_token_secret_configured: boolean;
    license_token_secret_strong: boolean;
    admin_bootstrap_secret_configured: boolean;
  };
  public_base_url_configured: boolean;
  cors_origins_count: number;
  production_checklist_errors: string[];
  offline_grace_hours: number;
}

function Check({ ok, label, hint }: { ok: boolean; label: string; hint?: string }) {
  return (
    <li className="flex items-start gap-2.5 py-2">
      {ok ? (
        <CheckCircle2 className="h-4.5 w-4.5 h-5 w-5 text-emerald-500 shrink-0" />
      ) : (
        <XCircle className="h-5 w-5 text-red-500 shrink-0" />
      )}
      <div>
        <div className="text-sm font-medium text-slate-800">{label}</div>
        {hint && <div className="text-xs text-slate-400">{hint}</div>}
      </div>
    </li>
  );
}

export function SystemPage() {
  const [info, setInfo] = useState<SystemInfo | null>(null);

  useEffect(() => {
    api.get<SystemInfo>('/system').then(setInfo).catch(e => toast(e.message, 'error'));
  }, []);

  if (!info) return <div className="text-sm text-slate-400">Loading…</div>;

  const fmtUptime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m ${s % 60}s`;
  };

  return (
    <div>
      <PageHeader title="System" subtitle="Control-plane operational status & production readiness" />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="a-card p-5">
          <h3 className="text-sm font-semibold text-slate-900">Runtime</h3>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-slate-500">Version</dt><dd className="font-mono">{info.version}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Environment</dt><dd className="font-mono">{info.node_env}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Node.js</dt><dd className="font-mono">{info.node_version}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Uptime</dt><dd className="font-mono">{fmtUptime(info.uptime_seconds)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Offline grace</dt><dd className="font-mono">{info.offline_grace_hours}h</dd></div>
          </dl>
        </div>

        <div className="a-card p-5">
          <h3 className="text-sm font-semibold text-slate-900">Control-plane Database</h3>
          <p className="mt-1 text-[11px] text-slate-400">
            Holds only licensing data — school operational data is never stored here.
          </p>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-slate-500">Integrity</dt><dd className={info.database.integrity_ok ? 'text-emerald-600 font-semibold' : 'text-red-600 font-semibold'}>{info.database.integrity_ok ? 'OK' : 'FAILED'}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Journal mode</dt><dd className="font-mono uppercase">{info.database.wal_mode}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Size</dt><dd className="font-mono">{(info.database.size_bytes / 1024).toFixed(1)} KB</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Last server backup</dt><dd className="font-mono text-xs">{info.backup.last_backup ? fmtDate(info.backup.last_backup.at) : 'none yet'}</dd></div>
          </dl>
        </div>

        <div className="a-card p-5">
          <h3 className="text-sm font-semibold text-slate-900">Production checklist</h3>
          <ul className="mt-2 divide-y divide-slate-50">
            <Check ok={info.tls.https_ready} label="HTTPS terminated (direct TLS or trusted proxy)" />
            <Check ok={info.secrets.license_token_secret_configured && info.secrets.license_token_secret_strong} label="Strong LICENSE_TOKEN_SECRET configured" />
            <Check ok={info.public_base_url_configured} label="PUBLIC_BASE_URL set (https)" />
            <Check ok={info.cors_origins_count > 0} label="CORS origins restricted" hint={`${info.cors_origins_count} origin(s) allowlisted`} />
            <Check ok={info.backup.last_backup !== null} label="Server database backups running" hint={info.backup.last_backup ? `last: ${fmtDate(info.backup.last_backup.at)}` : 'run server:backup (cron)'} />
            <Check ok={info.secrets.admin_bootstrap_secret_configured} label="ADMIN_BOOTSTRAP_SECRET set" hint="required for production bootstrap" />
          </ul>
          {info.production_checklist_errors.length > 0 && (
            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3">
              <div className="text-xs font-bold text-red-700">Blocking production issues:</div>
              <ul className="mt-1 text-xs text-red-600 list-disc pl-4 space-y-0.5">
                {info.production_checklist_errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
