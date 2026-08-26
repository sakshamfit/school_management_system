import React, { useState } from 'react';
import {
  Shield,
  KeyRound,
  Mail,
  Lock,
  ArrowRight,
  AlertCircle,
  GraduationCap,
  Smartphone,
  CheckCircle2,
} from 'lucide-react';
import { useSchool } from '../../context/SchoolContext';

export const AuthScreen: React.FC = () => {
  const { db, loginPrincipal, loginTeacher } = useSchool();

  const [authMode, setAuthMode] = useState<'selection' | 'principal_login' | 'teacher_login'>('selection');

  // Principal Login Form State (preloaded with permanent email)
  const [principalEmail, setPrincipalEmail] = useState('mozammilalam1996@gmail.com');
  const [principalPassword, setPrincipalPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);

  // Teacher Login Form State
  const [teacherCode, setTeacherCode] = useState('');
  const [teacherError, setTeacherError] = useState<string | null>(null);

  const handlePrincipalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    const res = loginPrincipal(principalEmail, principalPassword);
    if (!res.success) {
      setLoginError(res.error || 'Invalid email or password');
    }
  };

  const handleTeacherSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTeacherError(null);
    const res = loginTeacher(teacherCode);
    if (!res.success) {
      setTeacherError(res.error || 'Invalid 6-Digit Teacher Code');
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center p-4 relative overflow-hidden bg-[#FBF9F5]">
      {/* Background Decorative Glass Orbs */}
      <div className="fixed top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-orange-400/15 blur-[120px] pointer-events-none" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-blue-400/10 blur-[120px] pointer-events-none" />
      <div className="fixed top-[40%] right-[20%] w-[35vw] h-[35vw] rounded-full bg-amber-300/10 blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* School Logo & Title */}
        <div className="text-center mb-6">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-[#F27D26] text-white shadow-xl shadow-orange-500/25 ring-4 ring-white/60 mb-3 animate-in zoom-in-90 duration-300">
            <GraduationCap className="h-9 w-9" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[#1A2B48]">
            {db.schoolInfo.name || 'M.S. PUBLIC SCHOOL'}
          </h1>
          <p className="text-xs sm:text-sm font-bold text-[#F27D26] mt-1">
            Smart School Management System
          </p>
          <div className="mt-2 inline-flex items-center space-x-1.5 rounded-full bg-white/70 backdrop-blur-md px-3.5 py-1 text-[11px] font-bold text-[#1A2B48] border border-white/60 shadow-xs">
            <span>Academic Session: {db.schoolInfo.currentAcademicYear}</span>
          </div>
        </div>

        {/* View 1: Main Selection (Two Cards) */}
        {authMode === 'selection' && (
          <div className="space-y-3.5 animate-in fade-in zoom-in-95 duration-200">
            {/* Principal Login Card */}
            <div
              onClick={() => setAuthMode('principal_login')}
              className="group cursor-pointer rounded-3xl border border-white/60 bg-white/75 backdrop-blur-xl p-5 shadow-lg shadow-orange-950/5 hover:border-orange-400 hover:bg-white/95 hover:scale-[1.02] transition-all duration-200 active:scale-[0.99]"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-100/80 text-2xl group-hover:scale-110 transition-transform">
                    👨‍💼
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-[#1A2B48] group-hover:text-[#F27D26] transition-colors">
                      Principal Login
                    </h2>
                    <p className="text-xs text-[#1A2B48]/60 mt-0.5">
                      Admin portal, faculty, students, fees & controls
                    </p>
                  </div>
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 text-[#F27D26] group-hover:bg-[#F27D26] group-hover:text-white transition-colors">
                  <ArrowRight className="h-5 w-5" />
                </div>
              </div>
            </div>

            {/* Teacher Login Card */}
            <div
              onClick={() => setAuthMode('teacher_login')}
              className="group cursor-pointer rounded-3xl border border-white/60 bg-white/75 backdrop-blur-xl p-5 shadow-lg shadow-orange-950/5 hover:border-amber-400 hover:bg-white/95 hover:scale-[1.02] transition-all duration-200 active:scale-[0.99]"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100/80 text-2xl group-hover:scale-110 transition-transform">
                    👩‍🏫
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-[#1A2B48] group-hover:text-[#F27D26] transition-colors">
                      Teacher Login
                    </h2>
                    <p className="text-xs text-[#1A2B48]/60 mt-0.5">
                      6-Digit Teacher Code • Multi-Phone Access
                    </p>
                  </div>
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-[#F27D26] group-hover:bg-[#F27D26] group-hover:text-white transition-colors">
                  <ArrowRight className="h-5 w-5" />
                </div>
              </div>
            </div>

            {/* Multi-Device Support Badge */}
            <div className="flex items-center justify-center space-x-2 text-center pt-2 text-[11px] text-[#1A2B48]/60 font-semibold">
              <Smartphone className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              <span>Teachers can log in from 2 or 3 phones simultaneously</span>
            </div>
          </div>
        )}

        {/* View 2: Principal Login */}
        {authMode === 'principal_login' && (
          <div className="rounded-3xl border border-white/60 bg-white/80 backdrop-blur-xl p-6 sm:p-7 shadow-xl shadow-orange-950/5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-black/5 mb-5">
              <div className="flex items-center space-x-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-100 text-[#F27D26]">
                  <Shield className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-black text-[#1A2B48] text-base">Principal Login</h3>
                  <p className="text-[11px] text-[#1A2B48]/60">Sign in with email & password</p>
                </div>
              </div>
              <button
                onClick={() => setAuthMode('selection')}
                className="text-xs font-bold text-[#F27D26] hover:underline"
              >
                Change Role
              </button>
            </div>

            {loginError && (
              <div className="mb-4 flex items-center space-x-2 rounded-2xl bg-red-50/90 p-3 text-xs font-semibold text-red-700 border border-red-200">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
                <span>{loginError}</span>
              </div>
            )}

            <form onSubmit={handlePrincipalSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#1A2B48] mb-1">
                  Principal Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={principalEmail}
                    onChange={e => setPrincipalEmail(e.target.value)}
                    placeholder="mozammilalam1996@gmail.com"
                    className="w-full rounded-2xl border border-white/80 bg-white/90 py-2.5 pl-10 pr-4 text-sm font-bold text-slate-800 placeholder-slate-400 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1A2B48] mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                  <input
                    type="password"
                    required
                    autoFocus
                    value={principalPassword}
                    onChange={e => setPrincipalPassword(e.target.value)}
                    placeholder="Enter password"
                    className="w-full rounded-2xl border border-white/80 bg-white/90 py-2.5 pl-10 pr-4 text-sm font-medium text-slate-800 placeholder-slate-400 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full rounded-2xl bg-[#F27D26] py-3 text-sm font-bold text-white shadow-lg shadow-orange-500/25 hover:scale-[1.02] active:scale-[0.99] transition-all flex items-center justify-center space-x-2"
              >
                <span>Access Principal Dashboard</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          </div>
        )}

        {/* View 3: Teacher Login with 6-Digit Code */}
        {authMode === 'teacher_login' && (
          <div className="rounded-3xl border border-white/60 bg-white/80 backdrop-blur-xl p-6 sm:p-7 shadow-xl shadow-orange-950/5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-black/5 mb-5">
              <div className="flex items-center space-x-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-[#F27D26]">
                  <KeyRound className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-black text-[#1A2B48] text-base">Teacher Login</h3>
                  <p className="text-[11px] text-[#1A2B48]/60">Enter your 6-digit teacher code</p>
                </div>
              </div>
              <button
                onClick={() => setAuthMode('selection')}
                className="text-xs font-bold text-[#F27D26] hover:underline"
              >
                Change Role
              </button>
            </div>

            {teacherError && (
              <div className="mb-4 flex items-center space-x-2 rounded-2xl bg-red-50/90 p-3 text-xs font-semibold text-red-700 border border-red-200">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
                <span>{teacherError}</span>
              </div>
            )}

            <form onSubmit={handleTeacherSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#1A2B48] mb-1">
                  6-Digit Teacher Code
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3.5 top-3.5 h-4 w-4 text-[#F27D26]" />
                  <input
                    type="text"
                    required
                    autoFocus
                    maxLength={10}
                    value={teacherCode}
                    onChange={e => setTeacherCode(e.target.value.toUpperCase())}
                    placeholder="e.g. 501001"
                    className="w-full uppercase font-mono tracking-wider rounded-2xl border border-amber-200 bg-white/90 py-3 pl-10 pr-4 text-base font-black text-[#1A2B48] placeholder-slate-400 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200 text-center"
                  />
                </div>
                <div className="mt-2.5 flex items-center justify-center space-x-1.5 text-[11px] text-emerald-700 bg-emerald-50 py-1.5 px-3 rounded-xl border border-emerald-100 font-medium text-center">
                  <Smartphone className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Works simultaneously on 2 or 3 phones per teacher</span>
                </div>
              </div>

              <button
                type="submit"
                className="w-full rounded-2xl bg-[#F27D26] py-3 text-sm font-bold text-white shadow-lg shadow-orange-500/25 hover:scale-[1.02] active:scale-[0.99] transition-all flex items-center justify-center space-x-2"
              >
                <span>Enter Teacher Portal</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
