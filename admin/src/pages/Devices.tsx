/**
 * Devices — global device register with deactivate/reactivate controls.
 */

import { useEffect, useState } from 'react';
import { api, fmtDate, fmtDateOnly } from '../api';
import { PageHeader, Badge, toast } from '../components';

interface DeviceRow {
  id: string;
  school_id: string;
  school_name: string;
  school_code: string;
  device_uid: string;
  name: string | null;
  platform: string | null;
  app_version: string | null;
  status: string;
  activated_at: string;
  last_seen_at: string | null;
}

export function DevicesPage() {
  const [rows, setRows] = useState<DeviceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.get<{ devices: DeviceRow[] }>('/devices');
      setRows(data.devices);
    } catch (e: any) {
      toast(e.message || 'Failed to load devices', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const act = async (d: DeviceRow, action: 'deactivate' | 'reactivate') => {
    if (action === 'deactivate' && !window.confirm(`Deactivate "${d.name || d.device_uid}"?\n\nThe desktop app on that device will lose authorization. Its local school data is NOT deleted.`)) return;
    setBusyId(d.id);
    try {
      await api.post(`/devices/${d.id}/${action}`, {});
      toast(`Device ${action}d`);
      await load();
    } catch (e: any) {
      toast(e.message || 'Action failed', 'error');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Devices"
        subtitle="Stable application-generated device identities — no invasive hardware fingerprinting"
      />

      <div className="a-card overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50/60">
            <tr>
              <th className="a-th">Device</th>
              <th className="a-th">School</th>
              <th className="a-th">Platform</th>
              <th className="a-th">App version</th>
              <th className="a-th">Activated</th>
              <th className="a-th">Last seen</th>
              <th className="a-th">Status</th>
              <th className="a-th">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && (
              <tr><td colSpan={8} className="a-td text-center text-slate-400 py-10">Loading…</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={8} className="a-td text-center text-slate-400 py-10">No devices activated yet.</td></tr>
            )}
            {rows.map(d => (
              <tr key={d.id}>
                <td className="a-td">
                  <div className="font-medium text-slate-800">{d.name || 'Unnamed device'}</div>
                  <div className="text-[11px] text-slate-400 font-mono">{d.device_uid.slice(0, 18)}…</div>
                </td>
                <td className="a-td">
                  <div className="text-sm text-slate-700">{d.school_name}</div>
                  <div className="text-xs text-slate-400 font-mono">{d.school_code}</div>
                </td>
                <td className="a-td">{d.platform || '—'}</td>
                <td className="a-td font-mono text-xs">{d.app_version || '—'}</td>
                <td className="a-td text-xs text-slate-500">{fmtDateOnly(d.activated_at)}</td>
                <td className="a-td text-xs text-slate-500">{d.last_seen_at ? fmtDate(d.last_seen_at) : 'never'}</td>
                <td className="a-td"><Badge value={d.status} /></td>
                <td className="a-td">
                  {d.status === 'ACTIVE' ? (
                    <button className="a-btn-danger !px-2 !py-1 text-[11px]" disabled={busyId === d.id} onClick={() => act(d, 'deactivate')}>
                      Deactivate
                    </button>
                  ) : (
                    <button className="a-btn-secondary !px-2 !py-1 text-[11px]" disabled={busyId === d.id} onClick={() => act(d, 'reactivate')}>
                      Reactivate
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
