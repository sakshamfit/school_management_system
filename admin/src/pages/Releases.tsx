/**
 * Releases — publish/unpublish desktop application release metadata.
 * The desktop updater consumes GET /releases/latest over HTTPS.
 */

import React, { useEffect, useState } from 'react';
import { Rocket } from 'lucide-react';
import { api, fmtDate } from '../api';
import { PageHeader, Badge, Modal, toast } from '../components';

interface ReleaseRow {
  id: string;
  version: string;
  channel: string;
  download_url: string;
  notes: string | null;
  mandatory: boolean;
  sha256: string | null;
  status: string;
  published_at: string;
}

export function ReleasesPage() {
  const [rows, setRows] = useState<ReleaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    version: '',
    channel: 'stable',
    download_url: '',
    notes: '',
    mandatory: false,
    sha256: '',
  });

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.get<{ releases: ReleaseRow[] }>('/releases');
      setRows(data.releases);
    } catch (e: any) {
      toast(e.message || 'Failed to load releases', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const publish = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post('/releases', {
        ...form,
        sha256: form.sha256 || undefined,
        notes: form.notes || undefined,
      });
      toast(`Release ${form.version} published to ${form.channel}`);
      setOpen(false);
      setForm({ version: '', channel: 'stable', download_url: '', notes: '', mandatory: false, sha256: '' });
      await load();
    } catch (e2: any) {
      setError(e2.message || 'Publish failed');
    } finally {
      setBusy(false);
    }
  };

  const unpublish = async (r: ReleaseRow) => {
    if (!window.confirm(`Unpublish ${r.version} (${r.channel})?\n\nIt will disappear from the update feed.`)) return;
    try {
      await api.post(`/releases/${r.id}/unpublish`, {});
      toast('Release unpublished');
      await load();
    } catch (e: any) {
      toast(e.message || 'Failed', 'error');
    }
  };

  return (
    <div>
      <PageHeader
        title="Releases"
        subtitle="Update feed for the desktop updater • consumed over HTTPS only"
        actions={
          <button className="a-btn-primary" onClick={() => setOpen(true)}>
            <Rocket className="h-4 w-4" /> Publish Release
          </button>
        }
      />

      <div className="a-card overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50/60">
            <tr>
              <th className="a-th">Version</th>
              <th className="a-th">Channel</th>
              <th className="a-th">Mandatory</th>
              <th className="a-th">Published</th>
              <th className="a-th">Download URL</th>
              <th className="a-th">Status</th>
              <th className="a-th"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && (
              <tr><td colSpan={7} className="a-td text-center text-slate-400 py-10">Loading…</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={7} className="a-td text-center text-slate-400 py-10">No releases published yet.</td></tr>
            )}
            {rows.map(r => (
              <tr key={r.id}>
                <td className="a-td font-mono font-semibold">{r.version}</td>
                <td className="a-td capitalize">{r.channel}</td>
                <td className="a-td">{r.mandatory ? <span className="text-red-600 font-semibold text-xs">MANDATORY</span> : 'Optional'}</td>
                <td className="a-td text-xs text-slate-500">{fmtDate(r.published_at)}</td>
                <td className="a-td max-w-64">
                  <span className="block truncate text-xs text-slate-500" title={r.download_url}>
                    {r.download_url}
                  </span>
                  {r.notes && <span className="block truncate text-[11px] text-slate-400" title={r.notes}>{r.notes}</span>}
                </td>
                <td className="a-td"><Badge value={r.status} /></td>
                <td className="a-td">
                  {r.status === 'PUBLISHED' && (
                    <button className="a-btn-danger !px-2 !py-1 text-[11px]" onClick={() => unpublish(r)}>
                      Unpublish
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open && (
        <Modal title="Publish Release" onClose={() => setOpen(false)} wide>
          <form onSubmit={publish} className="space-y-4">
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{error}</div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="a-label">Version *</label>
                <input required className="a-input font-mono" placeholder="1.2.0" value={form.version} onChange={e => setForm(f => ({ ...f, version: e.target.value }))} />
              </div>
              <div>
                <label className="a-label">Update Channel</label>
                <select className="a-input" value={form.channel} onChange={e => setForm(f => ({ ...f, channel: e.target.value }))}>
                  <option value="stable">Stable</option>
                  <option value="beta">Beta</option>
                </select>
              </div>
            </div>
            <div>
              <label className="a-label">Download URL * (HTTPS in production)</label>
              <input
                required
                className="a-input font-mono text-xs"
                placeholder="https://downloads.example.com/SchoolManagementSetup-1.2.0.exe"
                value={form.download_url}
                onChange={e => setForm(f => ({ ...f, download_url: e.target.value }))}
              />
            </div>
            <div>
              <label className="a-label">SHA-256 of installer (recommended)</label>
              <input
                className="a-input font-mono text-xs"
                placeholder="64 hex characters"
                value={form.sha256}
                onChange={e => setForm(f => ({ ...f, sha256: e.target.value }))}
              />
            </div>
            <div>
              <label className="a-label">Release Notes</label>
              <textarea className="a-input min-h-24" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" className="h-4 w-4 accent-blue-600" checked={form.mandatory} onChange={e => setForm(f => ({ ...f, mandatory: e.target.checked }))} />
              Mandatory update (blocks older versions until updated)
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" className="a-btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
              <button type="submit" className="a-btn-primary" disabled={busy}>
                {busy ? 'Publishing…' : 'Publish'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
