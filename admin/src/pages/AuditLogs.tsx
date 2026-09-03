/**
 * Audit Logs — immutable control-plane activity trail.
 * Secrets are redacted server-side at write time and never appear here.
 */

import { useEffect, useState } from 'react';
import { api, fmtDate } from '../api';
import { PageHeader, toast } from '../components';

interface AuditEntry {
  id: number;
  actor_type: string | null;
  actor_label: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  metadata: Record<string, unknown> | null;
  ip: string | null;
  created_at: string;
}

export function AuditLogsPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [actions, setActions] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const [actor, setActor] = useState('');
  const [loading, setLoading] = useState(true);
  const pageSize = 50;

  const load = async (p = page, a = action, ac = actor) => {
    setLoading(true);
    try {
      const data = await api.get<{ entries: AuditEntry[]; total: number; actions: string[] }>(
        `/audit?page=${p}&page_size=${pageSize}${a ? `&action=${encodeURIComponent(a)}` : ''}${ac ? `&actor=${encodeURIComponent(ac)}` : ''}`
      );
      setEntries(data.entries);
      setTotal(data.total);
      setActions(data.actions);
    } catch (e: any) {
      toast(e.message || 'Failed to load audit logs', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(page, action, actor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, action]);

  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <PageHeader
        title="Audit Logs"
        subtitle={`${total} control-plane events • never contains passwords, tokens or keys`}
      />

      <div className="a-card">
        <div className="flex flex-wrap gap-2 border-b border-slate-100 p-3">
          <select className="a-input !w-64" value={action} onChange={e => { setPage(1); setAction(e.target.value); }}>
            <option value="">All actions</option>
            {actions.map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          <form
            onSubmit={e => {
              e.preventDefault();
              setPage(1);
              load(1, action, actor);
            }}
          >
            <input className="a-input !w-64" placeholder="Filter by actor (email/name)…" value={actor} onChange={e => setActor(e.target.value)} />
          </form>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50/60">
              <tr>
                <th className="a-th">Time</th>
                <th className="a-th">Actor</th>
                <th className="a-th">Action</th>
                <th className="a-th">Target</th>
                <th className="a-th">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && (
                <tr><td colSpan={5} className="a-td text-center text-slate-400 py-10">Loading…</td></tr>
              )}
              {!loading && entries.length === 0 && (
                <tr><td colSpan={5} className="a-td text-center text-slate-400 py-10">No matching events.</td></tr>
              )}
              {entries.map(e => (
                <tr key={e.id}>
                  <td className="a-td whitespace-nowrap text-xs text-slate-500">{fmtDate(e.created_at)}</td>
                  <td className="a-td">
                    <div className="text-sm text-slate-700">{e.actor_label || 'system'}</div>
                    <div className="text-[11px] text-slate-400">{e.actor_type || 'system'}{e.ip ? ` • ${e.ip}` : ''}</div>
                  </td>
                  <td className="a-td">
                    <span className="inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                      {e.action}
                    </span>
                  </td>
                  <td className="a-td text-xs text-slate-500">
                    {e.target_type ? `${e.target_type} ${String(e.target_id || '').slice(0, 18)}` : '—'}
                  </td>
                  <td className="a-td max-w-80">
                    {e.metadata ? (
                      <code className="block truncate text-[11px] text-slate-400" title={JSON.stringify(e.metadata, null, 2)}>
                        {JSON.stringify(e.metadata)}
                      </code>
                    ) : (
                      <span className="text-slate-300 text-xs">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
          <span className="text-xs text-slate-400">Page {page} of {pages}</span>
          <div className="flex gap-2">
            <button className="a-btn-secondary !px-2.5 !py-1 text-xs" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              ← Previous
            </button>
            <button className="a-btn-secondary !px-2.5 !py-1 text-xs" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>
              Next →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
