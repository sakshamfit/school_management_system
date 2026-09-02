import React, { useEffect, useState } from 'react';
import {
  Shield,
  KeyRound,
  Mail,
  Lock,
  ArrowRight,
  AlertCircle,
  GraduationCap,
  Smartphone,
  Building2,
  Headset,
  Loader2,
  MonitorSmartphone,
} from 'lucide-react';
import { useSchool } from '../../context/SchoolContext';
import { getSchoolApp } from '../../services/desktopBridge';

export const AuthScreen: React.FC = () => {
  const { db, loginPrincipal, loginTeacher, isDesktop, desktopInitializing } = useSchool();

  const [authMode, setAuthMode] = useState<'selection' | 'principal_login' | 'teacher_login'>(
    isDesktop ? 'principal_login' : 'selection'
  );

  const [principalEmail, setPrincipalEmail] = useState('');
  const [principalPassword, setPrincipalPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [teacherCode, setTeacherCode] = useState('');
  const [teacherError, setTeacherError] = useState<string | null>(null);
  const [teacherSubmitting, setTeacherSubmitting] = useState(false);

  const [appVersion, setAppVersion] = useState<string>('');
  const [support, setSupport] = useState<{ url?: string; email?: string; phone?: string } | null>(null);

  useEffect(() => {
    if (!isDesktop) return;
    const app = getSchoolApp();
    if (!app) return;
    app.system.info().then(info => {
      if (info && info.appVersion) setAppVersion(info.appVersion);
    });
    app.auth.getSupport().then(res => {
      if (res && res.support) setSupport(res.support);
    });
  }, [isDesktop]);

  const handlePrincipalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setLoginError(null);
    setIsSubmitting(true);
    try {
      const res = await loginPrincipal(principalEmail, principalPassword);
      if (!res.success) {
        setLoginError(res.error || 'Invalid email or password');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTeacherSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (teacherSubmitting) return;
    setTeacherError(null);
    setTeacherSubmitting(true);
    try {
      const res = await loginTeacher(teacherCode);
      if (!res.success) {
        setTeacherError(res.error || 'Invalid 6-Digit Teacher Code');
      }
    } finally {
      setTeacherSubmitting(false);
    }
  };

  const contactAdministrator = () => {
    if (isDesktop) {
      const app = getSchoolApp();
      const target = support?.email ? `mailto:${support.email}` : support?.url;
      if (app && target) {
        app.system.openExternal(target);
        return;
      }
    }
    const phone = db.schoolInfo.phone;
    if (phone) window.open(`https://wa.me/${phone.replace(/[^\d]/g, '')}`, '_blank');
  };

  // ------------------------------------------------------------------
  // Desktop edition sign-in (no signup — accounts are provisioned by the
  // software administrator and verified online with an offline grace period)
  // ------------------------------------------------------------------
  if (isDesktop) {
    if (desktopInitializing) {
      return (
        <div className="min-h-screen flex flex-col justify-center items-center bg-[#f5f5f7] text-[#1d1d1f] gap-4">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-[#0066cc] text-white shadow-md">
            <GraduationCap className="h-8 w-8 text-white" />
          </div>
          <div className="flex items-center space-x-2 text-sm text-[#86868b]">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Preparing your secure session…</span>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen flex flex-col justify-center items-center p-4 relative overflow-hidden bg-[#f5f5f7] text-[#1d1d1f]">
        <div className="w-full max-w-md relative z-10">
          <div className="text-center mb-8">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-[#0066cc] text-white mb-4 shadow-md">
              <GraduationCap className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-2xl font-semibold tracking-[-0.022em]">School Management System</h1>
            <p className="text-xs text-[#86868b] mt-1">Windows Desktop Edition</p>
            {authMode === 'teacher_login' && (
              <div className="mt-3 inline-flex items-center space-x-2 bg-white px-3.5 py-1 rounded-full text-xs font-semibold text-[#0066cc] border border-[#e5e5ea] shadow-xs">
                <span>{db.schoolInfo.name}</span>
              </div>
            )}
          </div>

          {authMode === 'principal_login' && (
            <div className="bg-white rounded-[20px] border border-[#e5e5ea] p-6 sm:p-7 shadow-xl animate-in fade-in duration-200">
              <div className="flex items-center space-x-3 pb-4 border-b border-[#f0f0f0] mb-5">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0066cc]/10 text-[#0066cc]">
                  <Shield className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Sign in to your school</h3>
                  <p className="text-xs text-[#86868b]">
                    Use the credentials provided by your software administrator
                  </p>
                </div>
              </div>

              {loginError && (
                <div className="mb-4 flex items-start space-x-2 bg-[#ff3b30]/10 p-3 rounded-xl text-xs font-semibold text-[#ff3b30]">
                  <AlertCircle className="h-4 w-4 shrink-0 text-[#ff3b30] mt-0.5" />
                  <span>{loginError}</span>
                </div>
              )}

              <form onSubmit={handlePrincipalSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#86868b] mb-1">School ID / Email</label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#86868b]" />
                    <input
                      type="text"
                      required
                      autoFocus
                      value={principalEmail}
                      onChange={e => setPrincipalEmail(e.target.value)}
                      placeholder="e.g. DPS-2026-001 or admin@school.com"
                      className="apple-input pl-10"
                      autoComplete="username"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#86868b] mb-1">Password</label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#86868b]" />
                    <input
                      type="password"
                      required
                      value={principalPassword}
                      onChange={e => setPrincipalPassword(e.target.value)}
                      placeholder="Enter password"
                      className="apple-input pl-10"
                      autoComplete="current-password"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full apple-btn-primary py-3 mt-2 flex items-center justify-center space-x-2 disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Verifying…</span>
                    </>
                  ) : (
                    <>
                      <span>LOGIN</span>
                      <ArrowRight className="h-4 w-4 shrink-0" />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-5 pt-4 border-t border-[#f0f0f0] flex items-center justify-between">
                <button
                  onClick={contactAdministrator}
                  className="text-xs font-semibold text-[#0066cc] hover:underline flex items-center space-x-1.5"
                >
                  <Headset className="h-3.5 w-3.5" />
                  <span>Contact Administrator</span>
                </button>
                <button
                  onClick={() => setAuthMode('teacher_login')}
                  className="text-xs font-semibold text-[#86868b] hover:text-[#0066cc] flex items-center space-x-1.5"
                >
                  <KeyRound className="h-3.5 w-3.5" />
                  <span>Teacher sign-in</span>
                </button>
              </div>
            </div>
          )}

          {authMode === 'teacher_login' && (
            <div className="bg-white rounded-[20px] border border-[#e5e5ea] p-6 sm:p-7 shadow-xl animate-in fade-in duration-200">
              <div className="flex items-center justify-between pb-4 border-b border-[#f0f0f0] mb-5">
                <div className="flex items-center space-x-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#af52de]/10 text-[#af52de]">
                    <KeyRound className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">Teacher Login</h3>
                    <p className="text-xs text-[#86868b]">Access Code</p>
                  </div>
                </div>
                <button
                  onClick={() => setAuthMode('principal_login')}
                  className="text-xs font-semibold text-[#0066cc] hover:underline"
                >
                  School sign-in
                </button>
              </div>

              {teacherError && (
                <div className="mb-4 flex items-start space-x-2 bg-[#ff3b30]/10 p-3 rounded-xl text-xs font-semibold text-[#ff3b30]">
                  <AlertCircle className="h-4 w-4 shrink-0 text-[#ff3b30] mt-0.5" />
                  <span>{teacherError}</span>
                </div>
              )}

              <form onSubmit={handleTeacherSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#86868b] mb-1 text-center">
                    Teacher Code
                  </label>
                  <div className="relative">
                    <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#0066cc]" />
                    <input
                      type="text"
                      required
                      autoFocus
                      maxLength={10}
                      value={teacherCode}
                      onChange={e => setTeacherCode(e.target.value.toUpperCase())}
                      placeholder="e.g. 501001"
                      className="apple-input pl-10 pr-10 font-mono text-center text-lg font-bold tracking-widest"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={teacherSubmitting}
                  className="w-full apple-btn-primary py-3 mt-2 flex items-center justify-center space-x-2 disabled:opacity-60"
                >
                  {teacherSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <span>Enter Teacher Portal</span>
                      <ArrowRight className="h-4 w-4 shrink-0" />
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          <div className="flex items-center justify-center space-x-2 text-center pt-4 text-xs text-[#86868b]">
            <MonitorSmartphone className="h-3.5 w-3.5 text-[#30d158] shrink-0" />
            <span>Your school data is stored securely on this computer</span>
          </div>

          {appVersion && (
            <div className="text-center pt-2 text-[10px] text-[#c7c7cc]">Version {appVersion}</div>
          )}
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------------
  // Web edition (existing behavior, preserved)
  // ------------------------------------------------------------------
  return (
    <div className="min-h-screen flex flex-col justify-center items-center p-4 relative overflow-hidden bg-[#f5f5f7] text-[#1d1d1f]">
      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-[#0066cc] text-white mb-4 shadow-md">
            <GraduationCap className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-semibold tracking-[-0.022em] text-[#1d1d1f]">
            {db.schoolInfo.name || 'School Management System'}
          </h1>
          <p className="text-xs text-[#86868b] mt-1">School Management & Performance System</p>
          <div className="mt-3 inline-flex items-center space-x-2 bg-white px-3.5 py-1 rounded-full text-xs font-semibold text-[#0066cc] border border-[#e5e5ea] shadow-xs">
            <span>Session: {db.schoolInfo.currentAcademicYear}</span>
          </div>
        </div>

        {authMode === 'selection' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div
              onClick={() => setAuthMode('principal_login')}
              className="group cursor-pointer bg-white rounded-[20px] border border-[#e5e5ea] p-5 hover:border-[#0066cc]/40 transition-all duration-200 shadow-xs"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0066cc]/10 text-[#0066cc]">
                    <Building2 className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-[#1d1d1f] group-hover:text-[#0066cc] transition-colors">
                      Principal Console
                    </h2>
                    <p className="text-xs text-[#86868b] mt-0.5">
                      Full administration, faculty, students, fees & audit
                    </p>
                  </div>
                </div>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f5f5f7] text-[#86868b] group-hover:bg-[#0066cc] group-hover:text-white transition-colors">
                  <ArrowRight className="h-4 w-4" />
                </div>
              </div>
            </div>

            <div
              onClick={() => setAuthMode('teacher_login')}
              className="group cursor-pointer bg-white rounded-[20px] border border-[#e5e5ea] p-5 hover:border-[#0066cc]/40 transition-all duration-200 shadow-xs"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#af52de]/10 text-[#af52de]">
                    <GraduationCap className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-[#1d1d1f] group-hover:text-[#0066cc] transition-colors">
                      Teacher Portal
                    </h2>
                    <p className="text-xs text-[#86868b] mt-0.5">Teacher Code • Multi-Device Access</p>
                  </div>
                </div>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f5f5f7] text-[#86868b] group-hover:bg-[#0066cc] group-hover:text-white transition-colors">
                  <ArrowRight className="h-4 w-4" />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center space-x-2 text-center pt-2 text-xs text-[#86868b]">
              <Smartphone className="h-3.5 w-3.5 text-[#30d158] shrink-0" />
              <span>Multi-device synchronization enabled</span>
            </div>
          </div>
        )}

        {authMode === 'principal_login' && (
          <div className="bg-white rounded-[20px] border border-[#e5e5ea] p-6 sm:p-7 shadow-xl animate-in fade-in duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-[#f0f0f0] mb-5">
              <div className="flex items-center space-x-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0066cc]/10 text-[#0066cc]">
                  <Shield className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-[#1d1d1f]">Principal Login</h3>
                  <p className="text-xs text-[#86868b]">Email & Master Password</p>
                </div>
              </div>
              <button
                onClick={() => setAuthMode('selection')}
                className="text-xs font-semibold text-[#0066cc] hover:underline"
              >
                Change Role
              </button>
            </div>

            {loginError && (
              <div className="mb-4 flex items-start space-x-2 bg-[#ff3b30]/10 p-3 rounded-xl text-xs font-semibold text-[#ff3b30]">
                <AlertCircle className="h-4 w-4 shrink-0 text-[#ff3b30] mt-0.5" />
                <span>{loginError}</span>
              </div>
            )}

            <form onSubmit={handlePrincipalSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#86868b] mb-1">Principal Email Address</label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#86868b]" />
                  <input
                    type="email"
                    required
                    value={principalEmail}
                    onChange={e => setPrincipalEmail(e.target.value)}
                    placeholder="principal@school.edu.in"
                    className="apple-input pl-10"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#86868b] mb-1">Password</label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#86868b]" />
                  <input
                    type="password"
                    required
                    value={principalPassword}
                    onChange={e => setPrincipalPassword(e.target.value)}
                    placeholder="Enter password"
                    className="apple-input pl-10"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full apple-btn-primary py-3 mt-2 flex items-center justify-center space-x-2 disabled:opacity-60"
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <span>Access Principal Console</span>
                    <ArrowRight className="h-4 w-4 shrink-0" />
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {authMode === 'teacher_login' && (
          <div className="bg-white rounded-[20px] border border-[#e5e5ea] p-6 sm:p-7 shadow-xl animate-in fade-in duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-[#f0f0f0] mb-5">
              <div className="flex items-center space-x-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#af52de]/10 text-[#af52de]">
                  <KeyRound className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-[#1d1d1f]">Teacher Login</h3>
                  <p className="text-xs text-[#86868b]">Access Code</p>
                </div>
              </div>
              <button
                onClick={() => setAuthMode('selection')}
                className="text-xs font-semibold text-[#0066cc] hover:underline"
              >
                Change Role
              </button>
            </div>

            {teacherError && (
              <div className="mb-4 flex items-start space-x-2 bg-[#ff3b30]/10 p-3 rounded-xl text-xs font-semibold text-[#ff3b30]">
                <AlertCircle className="h-4 w-4 shrink-0 text-[#ff3b30] mt-0.5" />
                <span>{teacherError}</span>
              </div>
            )}

            <form onSubmit={handleTeacherSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#86868b] mb-1 text-center">Teacher Code</label>
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#0066cc]" />
                  <input
                    type="text"
                    required
                    autoFocus
                    maxLength={10}
                    value={teacherCode}
                    onChange={e => setTeacherCode(e.target.value.toUpperCase())}
                    placeholder="e.g. 501001"
                    className="apple-input pl-10 pr-10 font-mono text-center text-lg font-bold tracking-widest"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={teacherSubmitting}
                className="w-full apple-btn-primary py-3 mt-2 flex items-center justify-center space-x-2 disabled:opacity-60"
              >
                {teacherSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <span>Enter Teacher Portal</span>
                    <ArrowRight className="h-4 w-4 shrink-0" />
                  </>
                )}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
