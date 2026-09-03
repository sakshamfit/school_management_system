/**
 * Admin dashboard — control-plane aggregates only.
 * Never displays school operational data (no students/teachers/fees).
 */

import { useEffect, useState } from 'react';
import { api, fmtDate } from '../api';
import { PageHeader, StatCard, Badge } from '../components';

interface DashboardData {
  totals: {
    schools_total: number;
    schools_active: number;
    schools_suspended: number;
    schools_archived: number;
    licenses_expired: number;
    licenses_expiring_soon: number;
    devices_active: number;
  };
  recent_activations: Array<{
    id: string;
    name: string | null;
    platform: string | null;
    activated_at: string;
    school_name: string;
    school_code: string;
  }>;
  recent_logins: Array<{
    id: number;
    actor_type: string;
    actor_label: string;
    created_at: string;
  }>;
  recent_backup_metadata: Array<{
    device_id: string;
    device_name: string | null;
    app_version: string | null;
    drive_connected: boolean;
    last_backup_at: string | null;
    last_backup_status: string | null;
    school_name: string;
  }>;
  current_app_version: string;
  expiring_soon_window_days: number;
}

export function DashboardPage({ onNavigate }: { onNavigate: (r: string) => void }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<DashboardData>('/dashboard')
      .then(setData)
      .catch(e => setError(e.message));
  }, []);

  if (error) return <div className="a-card p-6 text-red-600 text-sm">{error}</div>;
  if (!data) return <div className="text-sm text-slate-400">Loading dashboard…</div>;

  const t = data.totals;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle={`Commercial control plane • Current application version ${data.current_app_version}`}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Schools" value={t.schools_total} />
        <StatCard label="Active Schools" value={t.schools_active} tone="good" />
        <StatCard label="Suspended Schools" value={t.schools_suspended} tone={t.schools_suspended > 0 ? 'warning' : 'default'} />
        <StatCard label="Active Devices" value={t.devices_active} />
        <StatCard label="Expired Licenses" value={t.licenses_expired} tone={t.licenses_expired > 0 ? 'danger' : 'default'} />
        <StatCard
          label="Expiring Soon"
          value={t.licenses_expiring_soon}
          tone={t.licenses_expiring_soon > 0 ? 'warning' : 'default'}
          hint={`within ${data.expiring_soon_window_days} days`}
        />
        <StatCard label="Recent Activations" value={data.recent_activations.length} hint="latest devices" />
        <StatCard label="App Version" value={<span className="text-xl font-mono">{data.current_app_version}</span>} />
      </div>

      <div className="mt-6 grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="a-card overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Recent Activations</h3>
            <button className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer" onClick={() => onNavigate('devices')}>
              View all
            </button>
          </div>
          <ul className="divide-y divide-slate-100">
            {data.recent_activations.length === 0 && (
              <li className="px-5 py-6 text-sm text-slate-400">No devices activated yet.</li>
            )}
            {data.recent_activations.map(d => (
              <li key={d.id} className="px-5 py-3">
                <div className="text-sm font-medium text-slate-800">{d.name || 'Unnamed device'}</div>
                <div className="text-xs text-slate-400 mt-0.5">
                  {d.school_name} • {d.platform || 'unknown platform'} • {fmtDate(d.activated_at)}
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="a-card overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Recent Logins</h3>
            <button className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer" onClick={() => onNavigate('audit')}>
              Audit log
            </button>
          </div>
          <ul className="divide-y divide-slate-100">
            {data.recent_logins.length === 0 && (
              <li className="px-5 py-6 text-sm text-slate-400">No logins recorded yet.</li>
            )}
            {data.recent_logins.map(l => (
              <li key={l.id} className="px-5 py-3">
                <div className="text-sm font-medium text-slate-800">{l.actor_label}</div>
                <div className="text-xs text-slate-400 mt-0.5">
                  {l.actor_type === 'admin' ? 'Administrator' : 'School user'} • {fmtDate(l.created_at)}
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="a-card overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-900">Backup Metadata</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Drive status reported by devices — backup contents always stay with the school.
            </p>
          </div>
          <ul className="divide-y divide-slate-100">
            {data.recent_backup_metadata.length === 0 && (
              <li className="px-5 py-6 text-sm text-slate-400">
                No backup metadata reported yet (desktop backup integration ships with the
                Google Drive phase).
              </li>
            )}
            {data.recent_backup_metadata.map(b => (
              <li key={b.device_id} className="px-5 py-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium text-slate-800">{b.school_name}</div>
                  <Badge value={b.drive_connected ? 'ACTIVE' : 'ARCHIVED'} />
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  {b.device_name || 'Device'} • {b.drive_connected ? 'Drive connected' : 'Drive not connected'} •{' '}
                  Last backup: {b.last_backup_at ? fmtDate(b.last_backup_at) : 'never'}
                  {b.last_backup_status ? ` • ${b.last_backup_status}` : ''}
                  {b.app_version ? ` • v${b.app_version}` : ''}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
