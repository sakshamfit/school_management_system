import React, { useState } from 'react';
import {
  GraduationCap,
  LogOut,
  Bell,
  Calendar,
  AlertTriangle,
  ArrowRight,
  School,
  X,
  Database,
  RefreshCw,
  Search,
  CheckCircle2,
} from 'lucide-react';
import { useSchool } from '../context/SchoolContext';

interface NavbarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  onOpenQuickSearch: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
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
    isCloudConnected,
    isCloudSyncing,
    lastCloudSyncTime,
  } = useSchool();

  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const getSectionTitle = (tab: string) => {
    switch (tab) {
      case 'dashboard':
        return currentUser?.role === 'principal' ? 'Overview' : 'Faculty Classroom';
      case 'attendance':
        return 'Attendance Register';
      case 'students':
        return 'Student Directory';
      case 'fees':
        return 'Fee Treasury & Ledger';
      case 'teachers':
        return 'Faculty & Staff';
      case 'teacher-attendance':
        return 'Staff Attendance';
      case 'classes':
        return 'Academic Classes';
      case 'results':
        return 'Evaluation & Marksheets';
      case 'performance':
        return 'Growth & Observations';
      case 'reports':
        return 'Analytics & Insights';
      case 'academic-year':
        return 'Session Promotion';
      case 'activity-logs':
        return 'Audit Logs';
      case 'settings':
        return 'School Settings';
      default:
        return 'School Management';
    }
  };

  return (
    <header className="sticky top-0 z-30 w-full select-none">
      {/* 1. Apple Global Nav (Ultra-thin 44px pure black top bar) */}
      <div className="bg-[#000000] text-[#f5f5f7] h-11 border-b border-[#2d2d2d] flex items-center justify-between px-3 sm:px-6">
        <div className="max-w-[1440px] w-full mx-auto flex items-center justify-between text-xs">
          {/* Brand Mark */}
          <div className="flex items-center space-x-2.5">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-white">
              <GraduationCap className="h-3.5 w-3.5" />
            </div>
            <span className="font-semibold tracking-tight text-white text-xs sm:text-sm">
              {db.schoolInfo.name || 'M.S. Public School'}
            </span>
            <span className="hidden md:inline-block px-2 py-0.5 rounded-full bg-white/10 text-[10px] text-[#86868b] font-normal">
              CBSE Affiliated
            </span>
          </div>

          {/* Center / Right Telemetry Status */}
          <div className="flex items-center space-x-3 text-[11px]">
            {/* Live Firestore Sync Status */}
            <div
              className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-[#d2d2d7]"
              title={
                isCloudConnected
                  ? `Cloud Live (Last sync: ${lastCloudSyncTime || 'Just now'})`
                  : isCloudSyncing
                  ? 'Syncing with Cloud Firestore...'
                  : 'Local Cache'
              }
            >
              {isCloudSyncing ? (
                <>
                  <RefreshCw className="h-2.5 w-2.5 text-[#2997ff] animate-spin" />
                  <span className="text-[#2997ff] hidden sm:inline text-[11px]">Syncing</span>
                </>
              ) : isCloudConnected ? (
                <>
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#30d158] opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#30d158]"></span>
                  </span>
                  <span className="text-[#30d158] hidden sm:inline text-[11px]">Cloud Live</span>
                </>
              ) : (
                <>
                  <Database className="h-2.5 w-2.5 text-[#86868b]" />
                  <span className="text-[#86868b] hidden sm:inline text-[11px]">Local</span>
                </>
              )}
            </div>

            {/* Academic Session */}
            <div className="hidden sm:flex items-center space-x-1 text-[#86868b]">
              <Calendar className="h-3 w-3" />
              <span>{db.schoolInfo.currentAcademicYear}</span>
            </div>

            {/* User role indicator */}
            <span className="text-[#86868b] hidden md:inline">
              {currentUser?.role === 'principal' ? 'Principal Portal' : `${currentUser?.assignedClassName || 'Faculty'}`}
            </span>
          </div>
        </div>
      </div>

      {/* Admin Impersonation Notice Bar */}
      {adminImpersonation && (
        <div className="bg-[#ff3b30] px-4 py-2 text-white flex items-center justify-between text-xs font-medium">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>
              <strong>Admin Mode:</strong> Viewing class {adminImpersonation.className} ({adminImpersonation.teacherName})
            </span>
          </div>
          <button
            onClick={exitAdminClassAccess}
            className="rounded-full bg-white text-[#ff3b30] px-3 py-1 text-xs font-semibold hover:bg-white/90 transition-all flex items-center space-x-1"
          >
            <span>Exit Preview</span>
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* 2. Apple Frosted Sub-Nav (52px frosted glass category strip) */}
      <div className="bg-[#f5f5f7]/85 backdrop-blur-xl border-b border-black/5 h-13 px-3 sm:px-6 transition-all">
        <div className="max-w-[1440px] w-full mx-auto h-full flex items-center justify-between">
          {/* Section Category Title */}
          <div className="flex items-center space-x-3">
            <h2 className="text-lg sm:text-[21px] font-semibold tracking-[-0.022em] text-[#1d1d1f]">
              {getSectionTitle(currentTab)}
            </h2>
          </div>

          {/* Interactive Action Controls */}
          <div className="flex items-center space-x-2.5">
            {/* Apple Pill Search Input Button */}
            <button
              onClick={onOpenQuickSearch}
              className="flex items-center space-x-2 bg-white/90 hover:bg-white border border-[#d2d2d7] rounded-full px-3.5 py-1.5 text-xs text-[#86868b] hover:text-[#1d1d1f] transition-all shadow-xs"
              title="Search student, roll number, admission..."
            >
              <Search className="h-3.5 w-3.5 text-[#86868b]" />
              <span className="hidden md:inline font-normal text-[13px]">Search directory</span>
              <kbd className="hidden lg:inline-block bg-[#f5f5f7] px-1.5 py-0.5 text-[10px] font-mono text-[#86868b] rounded-md border border-[#e5e5ea]">
                ⌘K
              </kbd>
            </button>

            {/* Apple Circular Notification Control */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative flex h-8 w-8 items-center justify-center rounded-full bg-black/5 hover:bg-black/10 text-[#1d1d1f] transition-colors"
                aria-label="Notifications"
              >
                <Bell className="h-4 w-4" />
                {unreadNotificationCount > 0 && (
                  <span className="absolute top-0 right-0 flex h-3 w-3 items-center justify-center rounded-full bg-[#0066cc] text-[8px] font-bold text-white">
                    {unreadNotificationCount}
                  </span>
                )}
              </button>

              {/* Apple Notification Flyout */}
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-[18px] border border-[#e5e5ea] bg-white p-4 shadow-xl z-50 animate-in fade-in">
                  <div className="flex items-center justify-between pb-3 border-b border-[#f0f0f0]">
                    <div className="flex items-center space-x-2">
                      <Bell className="h-4 w-4 text-[#0066cc]" />
                      <h4 className="font-semibold text-[#1d1d1f] text-xs">Notifications</h4>
                      {unreadNotificationCount > 0 && (
                        <span className="bg-[#0066cc] text-white px-2 py-0.5 text-[10px] font-medium rounded-full">
                          {unreadNotificationCount} new
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      {unreadNotificationCount > 0 && (
                        <button
                          onClick={markAllNotificationsAsRead}
                          className="text-[11px] font-medium text-[#0066cc] hover:underline"
                        >
                          Mark all as read
                        </button>
                      )}
                      <button
                        onClick={() => setShowNotifications(false)}
                        className="text-[#86868b] hover:text-[#1d1d1f] p-1"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1">
                    {db.notifications.length === 0 ? (
                      <div className="py-8 text-center text-xs text-[#86868b]">
                        No notifications to display.
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
                          className={`cursor-pointer p-3 rounded-xl text-xs transition-all border ${
                            n.isRead
                              ? 'bg-[#fafafc] text-[#86868b] border-[#f0f0f0]'
                              : 'bg-white text-[#1d1d1f] border-[#0066cc]/20 shadow-xs'
                          }`}
                        >
                          <div className="flex items-start justify-between font-medium">
                            <span className={!n.isRead ? 'text-[#0066cc] font-semibold' : ''}>
                              {n.title}
                            </span>
                            {!n.isRead && (
                              <span className="h-1.5 w-1.5 rounded-full bg-[#0066cc]"></span>
                            )}
                          </div>
                          <p className="mt-1 text-[#86868b] leading-relaxed">{n.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Apple User Capsule Pill */}
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center space-x-2 bg-white/90 hover:bg-white border border-[#d2d2d7] rounded-full pl-1.5 pr-3 py-1 transition-all shadow-xs"
              >
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#1d1d1f] text-white font-medium text-[11px]">
                  {currentUser?.role === 'principal' ? 'P' : 'F'}
                </div>
                <div className="hidden sm:block text-left leading-tight">
                  <p className="text-xs font-semibold text-[#1d1d1f] truncate max-w-[110px]">
                    {currentUser?.name || 'User'}
                  </p>
                </div>
              </button>

              {/* User Dropdown */}
              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-64 rounded-[18px] border border-[#e5e5ea] bg-white p-2.5 shadow-xl z-50">
                  <div className="p-3 bg-[#f5f5f7] rounded-xl mb-2">
                    <p className="font-semibold text-xs text-[#1d1d1f]">{currentUser?.name}</p>
                    <p className="text-[11px] text-[#86868b] mt-0.5">{currentUser?.email || currentUser?.phone || 'No email registered'}</p>
                    {currentUser?.teacherCode && (
                      <div className="mt-2 inline-flex items-center space-x-1 bg-white px-2 py-0.5 text-[10px] font-medium text-[#1d1d1f] rounded-md border border-[#e5e5ea]">
                        <span>Code:</span>
                        <span className="font-mono text-[#0066cc] font-semibold">{currentUser.teacherCode}</span>
                      </div>
                    )}
                  </div>

                  {currentUser?.role === 'principal' && (
                    <button
                      onClick={() => {
                        setCurrentTab('settings');
                        setShowUserMenu(false);
                      }}
                      className="w-full flex items-center space-x-2 px-3 py-2 text-xs font-medium text-[#1d1d1f] hover:bg-[#f5f5f7] rounded-lg transition-colors"
                    >
                      <School className="h-4 w-4 text-[#0066cc]" />
                      <span>School Settings</span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      logout();
                      setShowUserMenu(false);
                    }}
                    className="w-full flex items-center space-x-2 px-3 py-2 text-xs font-medium text-[#ff3b30] hover:bg-[#ff3b30]/10 rounded-lg transition-colors mt-1"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
