import React, { useState } from 'react';
import {
  GraduationCap,
  LogOut,
  Bell,
  UserCheck,
  Calendar,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  School,
  X,
} from 'lucide-react';
import { useSchool } from '../context/SchoolContext';

interface NavbarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  onOpenQuickSearch: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  setCurrentTab,
  onOpenQuickSearch,
}) => {
  const {
    db,
    currentUser,
    adminImpersonation,
    exitAdminClassAccess,
    logout,
    unreadNotificationCount,
    markNotificationAsRead,
    markAllNotificationsAsRead,
  } = useSchool();

  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  return (
    <header className="sticky top-0 z-30 border-b border-white/40 bg-white/40 backdrop-blur-xl shadow-xs">
      {/* Admin Impersonation Notice Bar */}
      {adminImpersonation && (
        <div className="bg-[#F27D26]/90 backdrop-blur-md px-4 py-2 text-white shadow-xs border-b border-white/20 flex items-center justify-between text-xs sm:text-sm font-medium">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-4 w-4 shrink-0 animate-pulse text-amber-200" />
            <span>
              <strong>ADMIN ACCESS MODE:</strong> Managing {adminImpersonation.className} ({adminImpersonation.teacherName})
            </span>
          </div>
          <button
            onClick={exitAdminClassAccess}
            className="rounded-xl bg-white/20 px-3 py-1 text-xs font-semibold hover:bg-white/30 transition-all flex items-center space-x-1 border border-white/30 backdrop-blur-sm"
          >
            <span>Exit Mode</span>
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      )}

      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-3 sm:px-6">
        {/* School Brand */}
        <div className="flex items-center space-x-3">
          <div className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-2xl bg-[#F27D26] text-white font-bold text-xl shadow-lg shadow-orange-500/20 border border-white/30">
            <GraduationCap className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <h1 className="text-base sm:text-lg font-black tracking-tight text-[#1A2B48] leading-tight">
                {db.schoolInfo.name || 'M.S. PUBLIC SCHOOL'}
              </h1>
              <span className="hidden sm:inline-flex items-center rounded-full bg-orange-100/80 border border-orange-200/50 px-2 py-0.5 text-[10px] font-bold text-orange-800 backdrop-blur-sm">
                CBSE
              </span>
            </div>
            <p className="text-[11px] font-medium text-[#1A2B48]/60 hidden sm:block">
              Smart School System • Session {db.schoolInfo.currentAcademicYear}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* Quick Search Button */}
          <button
            onClick={onOpenQuickSearch}
            className="flex items-center space-x-2 rounded-2xl border border-white/80 bg-white/60 px-3.5 py-2 text-xs font-medium text-[#1A2B48] hover:bg-white/90 backdrop-blur-md shadow-xs transition-all active:scale-95"
            title="Search student, roll number, admission..."
          >
            <span className="text-[#F27D26] font-bold">🔍</span>
            <span className="hidden md:inline text-[#1A2B48]/70 font-semibold">Search Students...</span>
            <kbd className="hidden lg:inline-block rounded-lg bg-white/90 px-1.5 py-0.5 text-[10px] font-bold text-[#1A2B48]/60 shadow-xs border border-slate-200/60">
              Ctrl+K
            </kbd>
          </button>

          {/* Academic Session Chip */}
          <div className="hidden md:flex items-center space-x-1.5 rounded-2xl bg-white/60 border border-white/70 backdrop-blur-md px-3 py-1.5 text-xs font-bold text-[#1A2B48]">
            <Calendar className="h-3.5 w-3.5 text-[#F27D26]" />
            <span>{db.schoolInfo.currentAcademicYear}</span>
          </div>

          {/* Notification Center */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-white/60 border border-white/70 text-[#1A2B48] hover:bg-white/90 hover:text-[#F27D26] backdrop-blur-md shadow-xs transition-all"
              aria-label="Notifications"
            >
              <Bell className="h-4.5 w-4.5" />
              {unreadNotificationCount > 0 && (
                <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm ring-2 ring-white animate-bounce">
                  {unreadNotificationCount}
                </span>
              )}
            </button>

            {/* Notification Dropdown */}
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-3xl border border-white/70 bg-white/95 backdrop-blur-2xl p-4 shadow-2xl z-50 animate-in fade-in zoom-in-95">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center space-x-2">
                    <Bell className="h-4 w-4 text-[#F27D26]" />
                    <h4 className="font-bold text-[#1A2B48] text-sm">Notifications</h4>
                    {unreadNotificationCount > 0 && (
                      <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-[#F27D26]">
                        {unreadNotificationCount} new
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    {unreadNotificationCount > 0 && (
                      <button
                        onClick={markAllNotificationsAsRead}
                        className="text-[11px] font-bold text-[#F27D26] hover:underline"
                      >
                        Mark all read
                      </button>
                    )}
                    <button
                      onClick={() => setShowNotifications(false)}
                      className="text-slate-400 hover:text-slate-600 p-1"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-3 max-h-80 space-y-2.5 overflow-y-auto">
                  {db.notifications.length === 0 ? (
                    <div className="py-6 text-center text-xs text-slate-400">
                      No notifications right now.
                    </div>
                  ) : (
                    db.notifications.map(n => (
                      <div
                        key={n.id}
                        onClick={() => {
                          markNotificationAsRead(n.id);
                          if (n.linkAction) {
                            setCurrentTab(n.linkAction);
                            setShowNotifications(false);
                          }
                        }}
                        className={`cursor-pointer rounded-2xl p-3 text-xs transition-all ${
                          n.isRead ? 'bg-white/60 text-slate-600 border border-white/60' : 'bg-orange-50/80 text-[#1A2B48] border border-orange-200/70 shadow-xs'
                        }`}
                      >
                        <div className="flex items-start justify-between font-bold">
                          <span className={n.type === 'fee' ? 'text-amber-700' : n.type === 'attendance' ? 'text-blue-700' : 'text-[#1A2B48]'}>
                            {n.title}
                          </span>
                          {!n.isRead && (
                            <span className="h-2 w-2 rounded-full bg-[#F27D26]"></span>
                          )}
                        </div>
                        <p className="mt-1 text-slate-600 leading-relaxed">{n.message}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User Profile Pill */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center space-x-2 rounded-2xl border border-white/80 bg-white/60 backdrop-blur-md p-1.5 sm:px-3 sm:py-1.5 shadow-xs hover:bg-white/90 hover:border-orange-300 transition-all"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#F27D26] text-white font-bold text-xs shadow-sm shadow-orange-500/20">
                {currentUser?.role === 'principal' ? 'AD' : 'TC'}
              </div>
              <div className="hidden sm:block text-left leading-none">
                <p className="text-xs font-bold text-[#1A2B48] truncate max-w-[120px]">
                  {currentUser?.name || 'User'}
                </p>
                <p className="text-[10px] font-semibold text-[#F27D26] capitalize mt-0.5">
                  {currentUser?.role === 'principal'
                    ? 'Principal Admin'
                    : `${currentUser?.assignedClassName || 'Teacher'}`}
                </p>
              </div>
            </button>

            {/* User Menu Dropdown */}
            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-64 rounded-3xl border border-white/70 bg-white/95 backdrop-blur-2xl p-2.5 shadow-2xl z-50">
                <div className="p-3 border-b border-slate-100 bg-orange-50/60 backdrop-blur-sm rounded-2xl mb-1 border border-orange-100/50">
                  <p className="font-bold text-sm text-[#1A2B48]">{currentUser?.name}</p>
                  <p className="text-xs text-slate-500">{currentUser?.email || currentUser?.phone || 'No email'}</p>
                  {currentUser?.teacherCode && (
                    <div className="mt-2 inline-flex items-center space-x-1 rounded-lg bg-orange-100/90 px-2 py-0.5 text-[11px] font-bold text-orange-800">
                      <span>Code:</span>
                      <span className="font-mono">{currentUser.teacherCode}</span>
                    </div>
                  )}
                </div>

                {currentUser?.role === 'principal' && (
                  <button
                    onClick={() => {
                      setCurrentTab('settings');
                      setShowUserMenu(false);
                    }}
                    className="w-full flex items-center space-x-2 rounded-xl px-3 py-2 text-xs font-bold text-[#1A2B48] hover:bg-orange-50 transition-colors"
                  >
                    <School className="h-4 w-4 text-[#F27D26]" />
                    <span>School Settings</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    logout();
                    setShowUserMenu(false);
                  }}
                  className="w-full flex items-center space-x-2 rounded-xl px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 transition-colors mt-1"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Log Out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
