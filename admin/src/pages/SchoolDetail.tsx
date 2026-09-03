/**
 * School detail — profile editing, school user credentials, licenses,
 * devices, and lifecycle actions (suspend / reactivate / archive).
 */

import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  KeyRound,
  MonitorSmartphone,
  PauseCircle,
  PlayCircle,
  Archive,
  RefreshCw,
} from 'lucide-react';
import { api, fmtDate, fmtDateOnly } from '../api';
import { PageHeader, Badge, Modal, toast, CredentialsReveal, CopyButton } from '../components';

interface Detail {
  school: any;
  users: Array<{ id: string; name: string; email: string; role: string; status: string; must_change_password: boolean; created_at: string }>;
  licenses: Array<any>;
  devices: Array<any>;
  recent_audit: Array<{ id: number; actor_label: string; action: string; created_at: string }>;
}

export function SchoolDetailPage({ schoolId, onBack }: { schoolId: string; onBack: () => void }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [busy, setBusy] = useState(false);
  const [resetTarget, setResetTarget] = useState<{ id: string; email: string } | null>(null);
  const [resetResult, setResetResult] = useState<{ email: string; password: string } | null>(null);
  const [newLicenseOpen, setNewLicenseOpen] = useState(false);
  const [extendTarget, setExtendTarget] = useState<string | null>(null);
  const [extendDays, setExtendDays] = useState(365);

  const load = async () => {
    try {
      setDetail(await api.get<Detail>(`/schools/${schoolId}`));
    } catch (e: any) {
      toast(e.message || 'Failed to load school', 'error');
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId]);

  if (!detail) return <div className="text-sm text-slate-400">Loading…</div>;
  const s = detail.school;

  const act = async (fn: () => Promise<any>, done: string) => {
    setBusy(true);
    try {
      await fn();
      toast(done);
      await load();
    } catch (e: any) {
      toast(e.message || 'Action failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  const schoolAction = (action: string, confirmText: string, done: string) => {
    if (!window.confirm(confirmText)) return;
    return act(() => api.post(`/schools/${schoolId}/${action}`, {}), done);
  };

  const licenseAction = (id: string, action: string, done: string) =>
    act(() => api.post(`/licenses/${id}/${action}`, {}), done);

  const createLicense = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await act(
      () =>
        api.post(`/schools/${schoolId}/licenses`, {
          duration_days: Number(fd.get('duration_days')),
          max_devices: Number(fd.get('max_devices')),
        }),
      'License created'
    );
    setNewLicenseOpen(false);
  };

  const doReset = async () => {
    if (!resetTarget) return;
    setBusy(true);
    try {
      const res = await api.post<{ temporary_password: string }>(
        `/schools/${schoolId}/credentials/reset`,
        { user_id: resetTarget.id }
      );
      setResetResult({ email: resetTarget.email, password: res.temporary_password });
      setResetTarget(null);
    } catch (e: any) {
      toast(e.message || 'Reset failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <button className="a-btn-ghost mb-4 -ml-2" onClick={onBack}>
        <ArrowLeft className="h-4 w-4" /> Back to Schools
      </button>

      <PageHeader
        title={s.name}
        subtitle={`School ID ${s.school_code} • created ${fmtDateOnly(s.created_at)}`}
        actions={
          <>
            <CopyButton text={s.school_code} label="Copy School ID" />
            {s.status === 'ACTIVE' && (
              <button
                className="a-btn-secondary !text-amber-600 !border-amber-200 hover:!bg-amber-50"
                disabled={busy}
                onClick={() => schoolAction('suspend', `Suspend ${s.name}?\n\nAll customer sessions are revoked. Local school data on customer machines is NOT affected.`, 'School suspended')}
              >
                <PauseCircle className="h-4 w-4" /> Suspend
              </button>
            )}
            {s.status === 'SUSPENDED' && (
              <button
                className="a-btn-secondary !text-emerald-600 !border-emerald-200 hover:!bg-emerald-50"
                disabled={busy}
                onClick={() => schoolAction('reactivate', `Reactivate ${s.name}?`, 'School reactivated')}
              >
                <PlayCircle className="h-4 w-4" /> Reactivate
              </button>
            )}
            {s.status !== 'ARCHIVED' && (
              <button
                className="a-btn-danger"
                disabled={busy}
                onClick={() => schoolAction('archive', `Archive ${s.name}?\n\nThe school will no longer be able to sign in. This is for offboarding; customer data remains on customer machines.`, 'School archived')}
              >
                <Archive className="h-4 w-4" /> Archive
              </button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Profile */}
        <div className="a-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">School Profile</h3>
            <Badge value={s.status} />
          </div>
          <dl className="text-sm space-y-2">
            <div><dt className="a-label !mb-0">Contact</dt><dd>{s.contact_name || '—'}</dd></div>
            <div><dt className="a-label !mb-0">Email</dt><dd>{s.email || '—'}</dd></div>
            <div><dt className="a-label !mb-0">Phone</dt><dd>{s.phone || '—'}</dd></div>
            <div><dt className="a-label !mb-0">Address</dt><dd>{s.address || '—'}</dd></div>
          </dl>

          <h3 className="text-sm font-semibold text-slate-900 pt-3 border-t border-slate-100">
            Login Users
          </h3>
          <ul className="space-y-2">
            {detail.users.map(u => (
              <li key={u.id} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-800">{u.name}</div>
                    <div className="text-xs text-slate-400 font-mono">{u.email}</div>
                  </div>
                  <Badge value={u.status} />
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">
                    {u.must_change_password ? 'Must change temporary password on next sign-in' : ''}
                  </span>
                  <button
                    className="a-btn-secondary !px-2.5 !py-1 text-xs"
                    disabled={busy}
                    onClick={() => setResetTarget({ id: u.id, email: u.email })}
                  >
                    <KeyRound className="h-3.5 w-3.5" /> Reset credentials
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Licenses */}
        <div className="a-card p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Licenses</h3>
            <button className="a-btn-secondary !px-2.5 !py-1 text-xs" onClick={() => setNewLicenseOpen(true)}>
              + New license
            </button>
          </div>
          <ul className="mt-3 space-y-3">
            {detail.licenses.length === 0 && (
              <li className="text-sm text-slate-400 py-4">No licenses yet.</li>
            )}
            {detail.licenses.map(l => (
              <li key={l.id} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-semibold text-slate-700">{l.license_key}</span>
                  <Badge value={l.status} />
                </div>
                <div className="mt-1.5 text-xs text-slate-500">
                  Expires {fmtDateOnly(l.expires_at)} • {l.max_devices} device{l.max_devices === 1 ? '' : 's'}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <button
                    className="a-btn-secondary !px-2 !py-1 text-[11px]"
                    disabled={busy || l.status === 'REVOKED'}
                    onClick={() => {
                      setExtendTarget(l.id);
                      setExtendDays(365);
                    }}
                  >
                    Extend
                  </button>
                  {['ACTIVE', 'EXPIRED'].includes(l.status) && (
                    <button
                      className="a-btn-secondary !px-2 !py-1 text-[11px] !text-amber-600"
                      disabled={busy}
                      onClick={() => licenseAction(l.id, 'suspend', 'License suspended')}
                    >
                      Suspend
                    </button>
                  )}
                  {l.status === 'SUSPENDED' && (
                    <button
                      className="a-btn-secondary !px-2 !py-1 text-[11px] !text-emerald-600"
                      disabled={busy}
                      onClick={() => licenseAction(l.id, 'reactivate', 'License reactivated')}
                    >
                      Reactivate
                    </button>
                  )}
                  {l.status !== 'REVOKED' && (
                    <button
                      className="a-btn-danger !px-2 !py-1 text-[11px]"
                      disabled={busy}
                      onClick={() => {
                        if (window.confirm(`Revoke ${l.license_key}?\n\nThis is permanent. Customer sessions are revoked; local data on customer machines is NOT affected.`)) {
                          licenseAction(l.id, 'revoke', 'License revoked');
                        }
                      }}
                    >
                      Revoke
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Devices + recent audit */}
        <div className="space-y-4">
          <div className="a-card p-5">
            <div className="flex items-center gap-2">
              <MonitorSmartphone className="h-4 w-4 text-slate-400" />
              <h3 className="text-sm font-semibold text-slate-900">Devices ({detail.devices.length})</h3>
            </div>
            <ul className="mt-3 space-y-2">
              {detail.devices.length === 0 && <li className="text-sm text-slate-400 py-2">No devices activated.</li>}
              {detail.devices.map(d => (
                <li key={d.id} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium text-slate-800">{d.name || 'Unnamed device'}</div>
                    <Badge value={d.status} />
                  </div>
                  <div className="mt-1 text-[11px] text-slate-400">
                    {d.platform || '?'} {d.app_version ? `• v${d.app_version}` : ''} • activated {fmtDateOnly(d.activated_at)} •
                    last seen {d.last_seen_at ? fmtDate(d.last_seen_at) : 'never'}
                  </div>
                  <div className="mt-1 text-[11px] text-slate-400">
                    {d.drive_connected ? '☁️ Drive connected' : '☁️ Drive not connected'}
                    {d.last_backup_at ? ` • last backup ${fmtDate(d.last_backup_at)}` : ''}
                  </div>
                  <div className="mt-2">
                    {d.status === 'ACTIVE' ? (
                      <button
                        className="a-btn-danger !px-2 !py-1 text-[11px]"
                        disabled={busy}
                        onClick={() => act(() => api.post(`/devices/${d.id}/deactivate`, {}), 'Device deactivated')}
                      >
                        Deactivate
                      </button>
                    ) : (
                      <button
                        className="a-btn-secondary !px-2 !py-1 text-[11px]"
                        disabled={busy}
                        onClick={() => act(() => api.post(`/devices/${d.id}/reactivate`, {}), 'Device reactivated')}
                      >
                        Reactivate
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="a-card p-5">
            <h3 className="text-sm font-semibold text-slate-900">Recent activity for this school</h3>
            <ul className="mt-2 space-y-1.5">
              {detail.recent_audit.slice(0, 10).map(a => (
                <li key={a.id} className="text-[11px] text-slate-500 flex justify-between gap-2">
                  <span className="truncate">{a.action}</span>
                  <span className="text-slate-400 shrink-0">{fmtDate(a.created_at)}</span>
                </li>
              ))}
              {detail.recent_audit.length === 0 && <li className="text-[11px] text-slate-400">No activity.</li>}
            </ul>
          </div>
        </div>
      </div>

      {/* Reset credentials confirm */}
      {resetTarget && (
        <Modal title="Reset School Credentials" onClose={() => setResetTarget(null)}>
          <p className="text-sm text-slate-600">
            Generate a new temporary password for <span className="font-semibold">{resetTarget.email}</span>?
          </p>
          <ul className="mt-3 text-xs text-slate-500 list-disc pl-5 space-y-1">
            <li>All existing sessions for this user are revoked immediately.</li>
            <li>The new password is shown to you exactly once.</li>
            <li>Only its secure hash is stored — plaintext is never persisted.</li>
          </ul>
          <div className="mt-5 flex justify-end gap-2">
            <button className="a-btn-secondary" onClick={() => setResetTarget(null)}>
              Cancel
            </button>
            <button className="a-btn-primary" disabled={busy} onClick={doReset}>
              <RefreshCw className="h-4 w-4" /> Generate new credentials
            </button>
          </div>
        </Modal>
      )}

      {resetResult && (
        <CredentialsReveal
          schoolCode={s.school_code}
          email={resetResult.email}
          password={resetResult.password}
          onClose={() => setResetResult(null)}
        />
      )}

      {/* New license */}
      {newLicenseOpen && (
        <Modal title="Create License" onClose={() => setNewLicenseOpen(false)}>
          <p className="text-xs text-slate-500 mb-4">
            Creating a new license supersedes any existing licenses for this school.
          </p>
          <form onSubmit={createLicense} className="space-y-4">
            <div>
              <label className="a-label">Duration (days)</label>
              <select name="duration_days" className="a-input" defaultValue={365}>
                <option value={30}>30</option>
                <option value={90}>90</option>
                <option value={180}>180</option>
                <option value={365}>365</option>
                <option value={730}>730</option>
                <option value={1095}>1095</option>
              </select>
            </div>
            <div>
              <label className="a-label">Max devices</label>
              <input name="max_devices" type="number" min={1} max={500} defaultValue={3} className="a-input" />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className="a-btn-secondary" onClick={() => setNewLicenseOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="a-btn-primary" disabled={busy}>
                Create License
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Extend license */}
      {extendTarget && (
        <Modal title="Extend License" onClose={() => setExtendTarget(null)}>
          <form
            onSubmit={async e => {
              e.preventDefault();
              await act(
                () => api.post(`/licenses/${extendTarget}/extend`, { days: extendDays }),
                'License extended'
              );
              setExtendTarget(null);
            }}
            className="space-y-4"
          >
            <div>
              <label className="a-label">Extend by</label>
              <select className="a-input" value={extendDays} onChange={e => setExtendDays(Number(e.target.value))}>
                <option value={30}>30 days</option>
                <option value={90}>90 days</option>
                <option value={180}>180 days</option>
                <option value={365}>1 year</option>
                <option value={730}>2 years</option>
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className="a-btn-secondary" onClick={() => setExtendTarget(null)}>
                Cancel
              </button>
              <button type="submit" className="a-btn-primary" disabled={busy}>
                Extend License
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
