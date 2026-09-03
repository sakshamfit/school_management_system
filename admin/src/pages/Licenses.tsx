/**
 * Licenses — global license register with full lifecycle actions.
 */

import { useEffect, useState } from 'react';
import { api, fmtDateOnly, daysUntil } from '../api';
import { PageHeader, Badge, toast } from '../components';

interface LicenseRow {
  id: string;
  school_id: string;
  school_name: string;
  school_code: string;
  license_key: string;
  status: string;
  issued_at: string;
  expires_at: string;
  max_devices: number;
}

export function LicensesPage() {
  const [rows, setRows] = useState<LicenseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.get<{ licenses: LicenseRow[] }>('/licenses');
      setRows(data.licenses);
    } catch (e: any) {
      toast(e.message || 'Failed to load licenses', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const act = async (id: string, action: string, body?: any, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusyId(id);
    try {
      if (action === 'extend') {
        const input = window.prompt('Extend by how many days?', '365');
        if (!input) return;
        const days = Number(input);
        if (!Number.isInteger(days) || days < 1 || days > 3650) {
          toast('Invalid number of days (1–3650).', 'error');
          return;
        }
        await api.post(`/licenses/${id}/extend`, { days });
      } else {
        await api.post(`/licenses/${id}/${action}`, body ?? {});
      }
      toast(`License ${action}d`.replace('ded', 'ded'));
      await load();
    } catch (e: any) {
      toast(e.message || 'Action failed', 'error');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <PageHeader title="Licenses" subtitle="Server-authoritative license register • no license secrets exist in the desktop app" />

      <div className="a-card overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50/60">
            <tr>
              <th className="a-th">License key</th>
              <th className="a-th">School</th>
              <th className="a-th">Status</th>
              <th className="a-th">Expires</th>
              <th className="a-th">Devices</th>
              <th className="a-th">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && (
              <tr><td colSpan={6} className="a-td text-center text-slate-400 py-10">Loading…</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="a-td text-center text-slate-400 py-10">
                  No licenses yet — create one from a school's detail page or when adding a school.
                </td>
              </tr>
            )}
            {rows.map(l => {
              const left = daysUntil(l.expires_at);
              return (
                <tr key={l.id}>
                  <td className="a-td font-mono text-xs font-semibold">{l.license_key}</td>
                  <td className="a-td">
                    <div className="font-medium text-slate-800">{l.school_name}</div>
                    <div className="text-xs text-slate-400 font-mono">{l.school_code}</div>
                  </td>
                  <td className="a-td"><Badge value={l.status} /></td>
                  <td className="a-td text-sm">
                    {fmtDateOnly(l.expires_at)}
                    {l.status === 'ACTIVE' && left !== null && (
                      <div className={`text-[11px] ${left <= 30 ? 'text-amber-600 font-semibold' : 'text-slate-400'}`}>
                        {left >= 0 ? `${left} days left` : 'expired'}
                      </div>
                    )}
                  </td>
                  <td className="a-td">{l.max_devices}</td>
                  <td className="a-td">
                    <div className="flex flex-wrap gap-1.5">
                      <button className="a-btn-secondary !px-2 !py-1 text-[11px]" disabled={busyId === l.id || l.status === 'REVOKED'} onClick={() => act(l.id, 'extend')}>
                        Extend
                      </button>
                      {['ACTIVE', 'EXPIRED'].includes(l.status) && (
                        <button className="a-btn-secondary !px-2 !py-1 text-[11px] !text-amber-600" disabled={busyId === l.id} onClick={() => act(l.id, 'suspend')}>
                          Suspend
                        </button>
                      )}
                      {l.status === 'SUSPENDED' && (
                        <button className="a-btn-secondary !px-2 !py-1 text-[11px] !text-emerald-600" disabled={busyId === l.id} onClick={() => act(l.id, 'reactivate')}>
                          Reactivate
                        </button>
                      )}
                      {l.status !== 'REVOKED' && (
                        <button
                          className="a-btn-danger !px-2 !py-1 text-[11px]"
                          disabled={busyId === l.id}
                          onClick={() =>
                            act(l.id, 'revoke', undefined, `Revoke ${l.license_key}?\n\nPermanent. Local customer data is NOT affected.`)
                          }
                        >
                          Revoke
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
