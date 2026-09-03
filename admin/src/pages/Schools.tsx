/**
 * Schools — list, search, create (with one-time credentials reveal).
 */

import React, { useEffect, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { api, fmtDate, AdminApiError } from '../api';
import { PageHeader, Badge, Modal, toast, CredentialsReveal } from '../components';

interface SchoolRow {
  id: string;
  school_code: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  active_devices: number;
  license_status: string | null;
  license_expires_at: string | null;
  created_at: string;
}

interface CreatedPayload {
  school: SchoolRow;
  user: { id: string; name: string; email: string };
  temporary_password: string;
  license: any;
}

const DURATIONS = [
  { days: 30, label: '1 month (trial)' },
  { days: 90, label: '3 months' },
  { days: 180, label: '6 months' },
  { days: 365, label: '1 year' },
  { days: 730, label: '2 years' },
  { days: 1095, label: '3 years' },
];

function CreateSchoolModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (p: CreatedPayload) => void;
}) {
  const [form, setForm] = useState({
    name: '',
    school_code: '',
    contact_name: '',
    email: '',
    phone: '',
    address: '',
    admin_name: '',
    admin_email: '',
    license_duration_days: 365,
    max_devices: 3,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: string, v: string | number) => setForm(prev => ({ ...prev, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const payload = await api.post<CreatedPayload>('/schools', {
        ...form,
        school_code: form.school_code || undefined,
        email: form.email || undefined,
        phone: form.phone || undefined,
        address: form.address || undefined,
        contact_name: form.contact_name || undefined,
      });
      onCreated(payload);
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : 'Failed to create school.');
      setBusy(false);
    }
  };

  return (
    <Modal title="Add School" onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-5">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
            {error}
          </div>
        )}

        <fieldset>
          <legend className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
            School details
          </legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="a-label">School Name *</label>
              <input required className="a-input" value={form.name} onChange={e => set('name', e.target.value)} />
            </div>
            <div>
              <label className="a-label">School ID (auto if empty)</label>
              <input
                className="a-input font-mono"
                placeholder="SCH-4821"
                value={form.school_code}
                onChange={e => set('school_code', e.target.value.toUpperCase())}
              />
            </div>
            <div>
              <label className="a-label">Contact Name</label>
              <input className="a-input" value={form.contact_name} onChange={e => set('contact_name', e.target.value)} />
            </div>
            <div>
              <label className="a-label">Email</label>
              <input type="email" className="a-input" value={form.email} onChange={e => set('email', e.target.value)} />
            </div>
            <div>
              <label className="a-label">Phone</label>
              <input className="a-input" value={form.phone} onChange={e => set('phone', e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className="a-label">Address</label>
              <input className="a-input" value={form.address} onChange={e => set('address', e.target.value)} />
            </div>
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
            School admin account (login credentials)
          </legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="a-label">Admin Name *</label>
              <input required className="a-input" value={form.admin_name} onChange={e => set('admin_name', e.target.value)} />
            </div>
            <div>
              <label className="a-label">Admin Email (username) *</label>
              <input
                required
                type="email"
                className="a-input"
                value={form.admin_email}
                onChange={e => set('admin_email', e.target.value)}
              />
            </div>
          </div>
          <p className="mt-1.5 text-[11px] text-slate-400">
            A temporary password is generated automatically and shown exactly once after creation.
          </p>
        </fieldset>

        <fieldset>
          <legend className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
            License
          </legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="a-label">License Duration</label>
              <select
                className="a-input"
                value={form.license_duration_days}
                onChange={e => set('license_duration_days', Number(e.target.value))}
              >
                {DURATIONS.map(d => (
                  <option key={d.days} value={d.days}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="a-label">Maximum Devices</label>
              <input
                type="number"
                min={1}
                max={500}
                className="a-input"
                value={form.max_devices}
                onChange={e => set('max_devices', Number(e.target.value))}
              />
            </div>
          </div>
        </fieldset>

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="a-btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="a-btn-primary" disabled={busy}>
            {busy ? 'Creating…' : 'Create School'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function SchoolsPage({ onOpenSchool }: { onOpenSchool: (id: string) => void }) {
  const [rows, setRows] = useState<SchoolRow[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [created, setCreated] = useState<CreatedPayload | null>(null);

  const load = async (query = q, st = status) => {
    setLoading(true);
    try {
      const data = await api.get<{ schools: SchoolRow[]; total: number }>(
        `/schools?q=${encodeURIComponent(query)}${st ? `&status=${st}` : ''}`
      );
      setRows(data.schools);
      setTotal(data.total);
    } catch (e: any) {
      toast(e.message || 'Failed to load schools', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  return (
    <div>
      <PageHeader
        title="Schools"
        subtitle={`${total} school account${total === 1 ? '' : 's'} • no public signup — accounts are issued here`}
        actions={
          <button className="a-btn-primary" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" /> Add School
          </button>
        }
      />

      <div className="a-card">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
          <form
            className="relative flex-1 min-w-56"
            onSubmit={e => {
              e.preventDefault();
              load(q, status);
            }}
          >
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className="a-input !pl-9"
              placeholder="Search name, School ID or email…"
              value={q}
              onChange={e => setQ(e.target.value)}
            />
          </form>
          <select className="a-input !w-40" value={status} onChange={e => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="SUSPENDED">SUSPENDED</option>
            <option value="ARCHIVED">ARCHIVED</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50/60">
              <tr>
                <th className="a-th">School</th>
                <th className="a-th">School ID</th>
                <th className="a-th">Status</th>
                <th className="a-th">License</th>
                <th className="a-th">Devices</th>
                <th className="a-th">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && (
                <tr>
                  <td colSpan={6} className="a-td text-center text-slate-400 py-10">
                    Loading…
                  </td>
                </tr>
              )}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="a-td text-center text-slate-400 py-10">
                    No schools found. Create the first one with “Add School”.
                  </td>
                </tr>
              )}
              {rows.map(s => (
                <tr
                  key={s.id}
                  className="hover:bg-slate-50/70 cursor-pointer"
                  onClick={() => onOpenSchool(s.id)}
                >
                  <td className="a-td">
                    <div className="font-semibold text-slate-900">{s.name}</div>
                    <div className="text-xs text-slate-400">{s.contact_name || s.email || '—'}</div>
                  </td>
                  <td className="a-td font-mono text-xs">{s.school_code}</td>
                  <td className="a-td">
                    <Badge value={s.status} />
                  </td>
                  <td className="a-td">
                    <Badge value={s.license_status} />
                    {s.license_expires_at && (
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        until {fmtDate(s.license_expires_at)}
                      </div>
                    )}
                  </td>
                  <td className="a-td">{s.active_devices}</td>
                  <td className="a-td text-xs text-slate-500">{fmtDate(s.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate && (
        <CreateSchoolModal
          onClose={() => setShowCreate(false)}
          onCreated={payload => {
            setShowCreate(false);
            setCreated(payload);
            load();
          }}
        />
      )}

      {created && (
        <CredentialsReveal
          schoolCode={created.school.school_code}
          email={created.user.email}
          password={created.temporary_password}
          onClose={() => setCreated(null)}
        />
      )}
    </div>
  );
}
