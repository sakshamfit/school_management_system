import React, { useState } from 'react';
import {
  LayoutDashboard,
  CalendarCheck,
  GraduationCap,
  CreditCard,
  Menu,
  X,
  Users,
  Award,
  Sparkles,
  BarChart3,
  Calendar,
  History,
  Settings,
  UserCheck,
  BookOpen,
  Search,
  MessageSquare,
  School,
} from 'lucide-react';
import { useSchool } from '../context/SchoolContext';

interface MobileBottomNavProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  onOpenSearch?: () => void;
  onOpenWhatsApp?: () => void;
}

interface NavPrimaryItem {
  id: string;
  label: string;
  icon: any;
  badge?: number | string;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentTab,
  setCurrentTab,
  onOpenSearch,
  onOpenWhatsApp,
}) => {
  const { currentUser, db } = useSchool();
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const isPrincipal = currentUser?.role === 'principal';

  const dueStudentsCount = db.feeAccounts.filter(fa => fa.status === 'due' || fa.status === 'partial').length;

  const principalPrimary: NavPrimaryItem[] = [
    { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
    { id: 'attendance', label: 'Attendance', icon: CalendarCheck },
    { id: 'students', label: 'Students', icon: GraduationCap },
    { id: 'fees', label: 'Fees', icon: CreditCard, badge: dueStudentsCount > 0 ? dueStudentsCount : undefined },
  ];

  const teacherPrimary: NavPrimaryItem[] = [
    { id: 'dashboard', label: 'Class', icon: LayoutDashboard },
    { id: 'attendance', label: 'Roll-Call', icon: CalendarCheck },
    { id: 'students', label: 'Students', icon: GraduationCap },
    { id: 'results', label: 'Marks', icon: Award },
  ];

  const primaryItems = isPrincipal ? principalPrimary : teacherPrimary;

  const principalMoreItems = [
    { id: 'teachers', label: 'Faculty Roster', icon: Users, desc: 'Teacher profiles and codes' },
    { id: 'classes', label: 'Class Sections', icon: BookOpen, desc: 'Classrooms and grade rosters' },
    { id: 'teacher-attendance', label: 'Staff Attendance', icon: UserCheck, desc: 'Daily faculty records' },
    { id: 'results', label: 'Marksheets & Exams', icon: Award, desc: 'Examination grades and marks' },
    { id: 'performance', label: 'Observations', icon: Sparkles, desc: 'Remarks and feedback' },
    { id: 'reports', label: 'Analytics & Insights', icon: BarChart3, desc: 'Attendance and fee graphs' },
    { id: 'academic-year', label: 'Session Promotion', icon: Calendar, desc: 'Academic year upgrade' },
    { id: 'activity-logs', label: 'Audit Logs', icon: History, desc: 'Activity and system events' },
    { id: 'settings', label: 'School Settings', icon: Settings, desc: 'Configuration and profile' },
  ];

  const teacherMoreItems = [
    { id: 'performance', label: 'Behavior Remarks', icon: Sparkles, desc: 'Add remarks for students' },
    { id: 'my-attendance', label: 'Faculty Check-In', icon: UserCheck, desc: 'View monthly attendance' },
    { id: 'reports', label: 'Class Analytics', icon: BarChart3, desc: 'Class-level attendance reports' },
  ];

  const moreItems = isPrincipal ? principalMoreItems : teacherMoreItems;

  return (
    <>
      {/* Bottom Sticky Tab Bar with Apple Frosted Glass styling */}
      <nav
        aria-label="Mobile Navigation"
        className="fixed bottom-0 left-0 right-0 z-40 lg:hidden border-t border-[#e5e5ea] bg-white/90 backdrop-blur-xl px-2 pt-1 pb-[max(0.6rem,env(safe-area-inset-bottom))]"
      >
        <div className="flex items-center justify-around max-w-md mx-auto">
          {primaryItems.map(item => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setCurrentTab(item.id);
                  setShowMoreMenu(false);
                }}
                className={`relative flex flex-col items-center justify-center py-1.5 px-3 transition-all duration-150 ${
                  isActive
                    ? 'text-[#0066cc] font-medium'
                    : 'text-[#86868b] hover:text-[#1d1d1f]'
                }`}
              >
                <div
                  className={`relative flex h-7 w-7 items-center justify-center transition-all`}
                >
                  <Icon className={`h-5 w-5 ${isActive ? 'text-[#0066cc]' : 'text-[#86868b]'}`} />
                  {item.badge && (
                    <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#ff3b30] text-[9px] font-bold text-white">
                      {typeof item.badge === 'number' && item.badge > 99 ? '99+' : item.badge}
                    </span>
                  )}
                </div>
                <span className="text-[10px] mt-0.5 tracking-tight truncate max-w-[60px]">
                  {item.label}
                </span>
              </button>
            );
          })}

          {/* More Menu Drawer Trigger */}
          <button
            onClick={() => setShowMoreMenu(!showMoreMenu)}
            className={`relative flex flex-col items-center justify-center py-1.5 px-3 transition-all ${
              showMoreMenu
                ? 'text-[#0066cc] font-medium'
                : 'text-[#86868b] hover:text-[#1d1d1f]'
            }`}
          >
            <div className="flex h-7 w-7 items-center justify-center">
              <Menu className="h-5 w-5" />
            </div>
            <span className="text-[10px] mt-0.5 tracking-tight">More</span>
          </button>
        </div>
      </nav>

      {/* Mobile More Drawer Bottom Sheet */}
      {showMoreMenu && (
        <div className="fixed inset-0 z-50 lg:hidden flex flex-col justify-end bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            onClick={e => e.stopPropagation()}
            className="bg-[#f5f5f7] border-t border-[#e5e5ea] rounded-t-[24px] p-5 shadow-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300"
          >
            {/* Sheet Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#e5e5ea]">
              <div className="flex items-center space-x-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#0066cc] shadow-xs">
                  <School className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[#1d1d1f] leading-tight">
                    {db.schoolInfo.name}
                  </h3>
                  <p className="text-[11px] text-[#86868b]">
                    All Management Modules
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowMoreMenu(false)}
                className="w-7 h-7 rounded-full bg-white text-[#86868b] hover:text-[#1d1d1f] flex items-center justify-center shadow-xs"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Quick Actions inside Drawer */}
            <div className="grid grid-cols-2 gap-2.5 my-3">
              {onOpenSearch && (
                <button
                  onClick={() => {
                    setShowMoreMenu(false);
                    onOpenSearch();
                  }}
                  className="flex items-center space-x-2 bg-white rounded-xl p-3 text-left border border-[#e5e5ea] shadow-xs active:scale-98 transition-all"
                >
                  <Search className="h-4 w-4 text-[#0066cc] shrink-0" />
                  <span className="text-xs font-medium text-[#1d1d1f]">Quick Search</span>
                </button>
              )}

              {onOpenWhatsApp && (
                <button
                  onClick={() => {
                    setShowMoreMenu(false);
                    onOpenWhatsApp();
                  }}
                  className="flex items-center space-x-2 bg-white rounded-xl p-3 text-left border border-[#e5e5ea] shadow-xs active:scale-98 transition-all"
                >
                  <MessageSquare className="h-4 w-4 text-[#30d158] shrink-0" />
                  <span className="text-xs font-medium text-[#1d1d1f]">WhatsApp Alert</span>
                </button>
              )}
            </div>

            {/* Module Grid List */}
            <div className="overflow-y-auto flex-1 space-y-2 pb-6 pr-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {moreItems.map(item => {
                  const Icon = item.icon;
                  const isActive = currentTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setCurrentTab(item.id);
                        setShowMoreMenu(false);
                      }}
                      className={`flex items-center space-x-3 p-3 rounded-xl text-left transition-all ${
                        isActive
                          ? 'bg-[#0066cc] text-white shadow-sm'
                          : 'bg-white text-[#1d1d1f] border border-[#e5e5ea] hover:border-[#0066cc]/30'
                      }`}
                    >
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                          isActive
                            ? 'bg-white/20 text-white'
                            : 'bg-[#f5f5f7] text-[#0066cc]'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className={`text-xs font-medium truncate ${isActive ? 'text-white' : 'text-[#1d1d1f]'}`}>
                          {item.label}
                        </div>
                        <div className={`text-[10px] truncate ${isActive ? 'text-white/80' : 'text-[#86868b]'}`}>
                          {item.desc}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
