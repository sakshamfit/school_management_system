import React, { useState, useEffect } from 'react';
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
  Info,
  Eye,
  EyeOff,
  Cloud,
  HardDrive,
  CheckCircle2,
  WifiOff,
} from 'lucide-react';
import { useSchool } from '../../context/SchoolContext';

// Check if running in Electron
const isElectron = typeof window !== 'undefined' && (window as any).electronAPI?.isElectron;

export const AuthScreen: React.FC = () => {
  const { db, loginPrincipal, loginTeacher } = useSchool();

  const [authMode, setAuthMode] = useState<'selection' | 'principal_login' | 'teacher_login'>('selection');
  const [principalEmail, setPrincipalEmail] = useState('mozammilalam1996@gmail.com');
  const [principalPassword, setPrincipalPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [licenseStatus, setLicenseStatus] = useState<any>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const [teacherCode, setTeacherCode] = useState('');
  const [teacherError, setTeacherError] = useState<string | null>(null);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Load license info if in Electron
    if (isElectron && (window as any).electronAPI?.license?.getInfo) {
      (window as any).electronAPI.license.getInfo().then((result: any) => {
        if (result.success && result.data) {
          setLicenseStatus(result.data);
        }
      }).catch(() => {});
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handlePrincipalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setIsLoggingIn(true);

    try {
      // If in Electron, use secure auth manager
      if (isElectron && (window as any).electronAPI?.auth?.login) {
        const result = await (window as any).electronAPI.auth.login(principalEmail, principalPassword, db.schoolInfo.id);
        if (!result.success) {
          if (result.isOffline) {
            setIsOnline(false);
            throw new Error('Internet unavailable. Checking offline session...');
          }
          throw new Error(result.error);
        }
        // Auth succeeded in main process, now also login in renderer context
        // For compatibility, we still call the context login
        const ctxResult = loginPrincipal(principalEmail, principalPassword);
        if (!ctxResult.success) {
          throw new Error(ctxResult.error || 'Login failed');
        }
      } else {
        // Web mode
        const res = loginPrincipal(principalEmail, principalPassword);
        if (!res.success) {
          throw new Error(res.error || 'Invalid email or password');
        }
      }
    } catch (err: any) {
      setLoginError(err.message);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleTeacherSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTeacherError(null);

    try {
      if (isElectron && (window as any).electronAPI?.auth?.loginTeacher) {
        const result = await (window as any).electronAPI.auth.loginTeacher(teacherCode);
        if (!result.success) throw new Error(result.error);
      }
      const res = loginTeacher(teacherCode);
      if (!res.success) throw new Error(res.error || 'Invalid 6-Digit Teacher Code');
    } catch (err: any) {
      setTeacherError(err.message);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center p-4 relative overflow-hidden bg-[#f5f5f7] text-[#1d1d1f]">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#0066cc]/5 rounded-full blur-3xl" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#30d158]/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* School Logo & Title */}
        <div className="text-center mb-8">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-[#0066cc] text-white mb-4 shadow-md">
            <GraduationCap className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-semibold tracking-[-0.022em] text-[#1d1d1f]">
            {db.schoolInfo.name || 'M.S. PUBLIC SCHOOL'}
          </h1>
          <p className="text-xs text-[#86868b] mt-1">
            School Management & Performance System
          </p>
          <div className="mt-3 inline-flex items-center space-x-2 bg-white px-3.5 py-1 rounded-full text-xs font-semibold text-[#0066cc] border border-[#e5e5ea] shadow-xs">
            <span>Session: {db.schoolInfo.currentAcademicYear}</span>
          </div>

          {/* License status badge */}
          {licenseStatus && (
            <div className="mt-3 flex justify-center">
              {licenseStatus.status === 'active' ? (
                <span className="inline-flex items-center gap-1 bg-[#30d158]/10 text-[#30d158] px-2.5 py-1 rounded-full text-[11px] font-semibold">
                  <CheckCircle2 className="h-3 w-3" />
                  Licensed • Expires {licenseStatus.expiresAt ? new Date(licenseStatus.expiresAt).toLocaleDateString() : '—'}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 bg-[#ff3b30]/10 text-[#ff3b30] px-2.5 py-1 rounded-full text-[11px] font-semibold">
                  <AlertCircle className="h-3 w-3" />
                  {licenseStatus.status.toUpperCase()} • Contact Admin
                </span>
              )}
            </div>
          )}

          {/* Offline badge */}
          {!isOnline && (
            <div className="mt-2 flex justify-center">
              <span className="inline-flex items-center gap-1 bg-[#ff9f0a]/10 text-[#ff9f0a] px-2.5 py-1 rounded-full text-[11px] font-semibold">
                <WifiOff className="h-3 w-3" />
                Offline Mode • 7-day grace period
              </span>
            </div>
          )}
        </div>

        {/* View 1: Main Selection (Two Cards) - No Signup */}
        {authMode === 'selection' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Principal Login Card */}
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
                      Administrator-issued credentials required
                    </p>
                  </div>
                </div>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f5f5f7] text-[#86868b] group-hover:bg-[#0066cc] group-hover:text-white transition-colors">
                  <ArrowRight className="h-4 w-4" />
                </div>
              </div>
            </div>

            {/* Teacher Login Card */}
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
                    <p className="text-xs text-[#86868b] mt-0.5">
                      6-Digit Teacher Code • Multi-Device Access
                    </p>
                  </div>
                </div>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f5f5f7] text-[#86868b] group-hover:bg-[#0066cc] group-hover:text-white transition-colors">
                  <ArrowRight className="h-4 w-4" />
                </div>
              </div>
            </div>

            {/* Security & No Signup Notice */}
            <div className="bg-white rounded-[16px] border border-[#e5e5ea] p-4">
              <div className="flex items-start space-x-2">
                <Shield className="h-4 w-4 text-[#0066cc] mt-0.5 shrink-0" />
                <div>
                  <h4 className="text-xs font-semibold text-[#1d1d1f]">Administrator-Issued Access Only</h4>
                  <p className="text-[11px] text-[#86868b] mt-1 leading-relaxed">
                    There is no public signup. Your School ID, email, and password are issued by the administrator. 
                    If you forgot your credentials, please contact your school administrator.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center space-x-2 text-center pt-2 text-xs text-[#86868b]">
              <Smartphone className="h-3.5 w-3.5 text-[#30d158] shrink-0" />
              <span>Secure • Local-first • Encrypted backup</span>
            </div>
          </div>
        )}

        {/* View 2: Principal Login - No Signup, Only Login */}
        {authMode === 'principal_login' && (
          <div className="bg-white rounded-[20px] border border-[#e5e5ea] p-6 sm:p-7 shadow-xl animate-in fade-in duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-[#f0f0f0] mb-5">
              <div className="flex items-center space-x-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0066cc]/10 text-[#0066cc]">
                  <Shield className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-[#1d1d1f]">Principal Login</h3>
                  <p className="text-xs text-[#86868b]">School ID / Email & Password</p>
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
              <div className="mb-4 flex items-start space-x-2 bg-[#ff3b30]/10 p-3 rounded-xl text-xs font-medium text-[#ff3b30] border border-[#ff3b30]/20">
                <AlertCircle className="h-4 w-4 shrink-0 text-[#ff3b30] mt-0.5" />
                <span>{loginError}</span>
              </div>
            )}

            <form onSubmit={handlePrincipalSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#86868b] mb-1">
                  School ID / Email Address
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#86868b]" />
                  <input
                    type="email"
                    required
                    value={principalEmail}
                    onChange={e => setPrincipalEmail(e.target.value)}
                    placeholder="schoolname@gmail.com"
                    className="apple-input pl-10"
                    autoComplete="email"
                  />
                </div>
                <p className="text-[11px] text-[#86868b] mt-1">Issued by administrator</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#86868b] mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#86868b]" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoFocus
                    value={principalPassword}
                    onChange={e => setPrincipalPassword(e.target.value)}
                    placeholder="Enter password"
                    className="apple-input pl-10 pr-10"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#86868b] hover:text-[#1d1d1f]"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full apple-btn-primary py-3 mt-2 flex items-center justify-center space-x-2 disabled:opacity-50"
              >
                {isLoggingIn ? (
                  <>
                    <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <span>Access Principal Console</span>
                    <ArrowRight className="h-4 w-4 shrink-0" />
                  </>
                )}
              </button>

              <div className="pt-3 border-t border-[#f0f0f0] text-center">
                <p className="text-[11px] text-[#86868b]">
                  Forgot password? <span className="font-semibold text-[#1d1d1f]">Contact Administrator</span>
                </p>
                <p className="text-[10px] text-[#86868b] mt-1">
                  No public signup • Credentials issued by admin only
                </p>
              </div>
            </form>

            {/* Local-first info */}
            <div className="mt-4 bg-[#f5f5f7] rounded-xl p-3 border border-[#e5e5ea] flex items-start space-x-2">
              <HardDrive className="h-4 w-4 text-[#0066cc] mt-0.5 shrink-0" />
              <p className="text-[11px] text-[#86868b] leading-relaxed">
                Your school data is stored locally on this computer. Google Drive is used only as encrypted backup. Works offline.
              </p>
            </div>
          </div>
        )}

        {/* View 3: Teacher Login with 6-Digit Code */}
        {authMode === 'teacher_login' && (
          <div className="bg-white rounded-[20px] border border-[#e5e5ea] p-6 sm:p-7 shadow-xl animate-in fade-in duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-[#f0f0f0] mb-5">
              <div className="flex items-center space-x-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#af52de]/10 text-[#af52de]">
                  <KeyRound className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-[#1d1d1f]">Teacher Login</h3>
                  <p className="text-xs text-[#86868b]">6-Digit Access Code</p>
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
              <div className="mb-4 flex items-center space-x-2 bg-[#ff3b30]/10 p-3 rounded-xl text-xs font-semibold text-[#ff3b30]">
                <AlertCircle className="h-4 w-4 shrink-0 text-[#ff3b30]" />
                <span>{teacherError}</span>
              </div>
            )}

            <form onSubmit={handleTeacherSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#86868b] mb-1 text-center">
                  6-Digit Teacher Code
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
                <div className="mt-3 flex items-center justify-center space-x-1.5 text-xs text-[#86868b] bg-[#f5f5f7] py-2 px-3 rounded-xl text-center">
                  <Smartphone className="h-3.5 w-3.5 text-[#30d158] shrink-0" />
                  <span>Issued by principal • Works on multiple devices</span>
                </div>
              </div>

              <button
                type="submit"
                className="w-full apple-btn-primary py-3 mt-2 flex items-center justify-center space-x-2"
              >
                <span>Enter Teacher Portal</span>
                <ArrowRight className="h-4 w-4 shrink-0" />
              </button>

              <div className="pt-3 border-t border-[#f0f0f0] text-center">
                <p className="text-[11px] text-[#86868b]">
                  Forgot code? <span className="font-semibold text-[#1d1d1f]">Contact Principal</span>
                </p>
              </div>
            </form>
          </div>
        )}

        {/* Footer - Production info */}
        <div className="mt-6 text-center">
          <p className="text-[10px] text-[#86868b]">
            M.S. PUBLIC SCHOOL • Version 1.0.0 • Secure Desktop Application
          </p>
          <p className="text-[10px] text-[#86868b] mt-1 flex items-center justify-center gap-1">
            <Cloud className="h-3 w-3" />
            Encrypted backup to your own Google Drive
          </p>
        </div>
      </div>
    </div>
  );
};
