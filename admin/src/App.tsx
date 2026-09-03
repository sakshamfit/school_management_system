/**
 * Admin Control Panel — session gate + hash-free internal routing.
 */

import { useCallback, useEffect, useState } from 'react';
import { fetchMe, AdminProfile } from './api';
import { Layout, ToastHost } from './components';
import { LoginPage } from './pages/Login';
import { DashboardPage } from './pages/Dashboard';
import { SchoolsPage } from './pages/Schools';
import { SchoolDetailPage } from './pages/SchoolDetail';
import { LicensesPage } from './pages/Licenses';
import { DevicesPage } from './pages/Devices';
import { ReleasesPage } from './pages/Releases';
import { AuditLogsPage } from './pages/AuditLogs';
import { SystemPage } from './pages/System';

export default function App() {
  const [admin, setAdmin] = useState<AdminProfile | null>(null);
  const [checking, setChecking] = useState(true);
  const [route, setRoute] = useState<string>('dashboard');
  const [schoolId, setSchoolId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const me = await fetchMe();
    setAdmin(me?.admin ?? null);
    setChecking(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const navigate = (r: string) => {
    setSchoolId(null);
    setRoute(r);
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-slate-400">
        Loading…
      </div>
    );
  }

  if (!admin) {
    return (
      <>
        <LoginPage onLoggedIn={refresh} />
        <ToastHost />
      </>
    );
  }

  return (
    <>
      <Layout admin={admin} route={schoolId ? 'schools' : route} onNavigate={navigate} onLogout={() => setAdmin(null)}>
        {schoolId ? (
          <SchoolDetailPage schoolId={schoolId} onBack={() => setSchoolId(null)} />
        ) : route === 'dashboard' ? (
          <DashboardPage onNavigate={navigate} />
        ) : route === 'schools' ? (
          <SchoolsPage onOpenSchool={id => setSchoolId(id)} />
        ) : route === 'licenses' ? (
          <LicensesPage />
        ) : route === 'devices' ? (
          <DevicesPage />
        ) : route === 'releases' ? (
          <ReleasesPage />
        ) : route === 'audit' ? (
          <AuditLogsPage />
        ) : route === 'system' ? (
          <SystemPage />
        ) : (
          <DashboardPage onNavigate={navigate} />
        )}
      </Layout>
      <ToastHost />
    </>
  );
}
