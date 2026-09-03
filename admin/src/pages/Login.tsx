/**
 * Administrator sign-in. This is a completely separate authentication
 * surface from the customer/school login — no public signup exists.
 */

import React, { useState } from 'react';
import { ShieldCheck, AlertCircle } from 'lucide-react';
import { login, AdminApiError } from '../api';

export function LoginPage({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email.trim(), password);
      onLoggedIn();
    } catch (err) {
      if (err instanceof AdminApiError) setError(err.message);
      else setError('Unable to reach the control server.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-100">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white mb-4 shadow-md">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">SMS Admin Control Panel</h1>
          <p className="text-xs text-slate-500 mt-1">Commercial licensing &amp; device management</p>
        </div>

        <form onSubmit={submit} className="a-card p-6 space-y-4">
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              {error}
            </div>
          )}
          <div>
            <label className="a-label" htmlFor="email">
              Administrator email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              required
              className="a-input"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="a-label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              className="a-input"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>
          <button type="submit" className="a-btn-primary w-full" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
          <p className="text-center text-[11px] text-slate-400">
            Authorized staff only. All actions are audit-logged.
          </p>
        </form>
      </div>
    </div>
  );
}
