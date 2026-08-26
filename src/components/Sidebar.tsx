import React from 'react';
import {
  LayoutDashboard,
  Users,
  BookOpen,
  GraduationCap,
  CalendarCheck,
  UserCheck,
  CreditCard,
  Award,
  Sparkles,
  BarChart3,
  Calendar,
  History,
  Settings,
  ShieldCheck,
  LogOut,
  ChevronRight,
} from 'lucide-react';
import { useSchool } from '../context/SchoolContext';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  highlight?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, setCurrentTab }) => {
  const { currentUser, adminImpersonation, exitAdminClassAccess, logout, db } = useSchool();
  const isPrincipal = currentUser?.role === 'principal';

  const principalNavItems: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'teachers', label: 'Teachers', icon: Users, badge: `${db.users.filter(u => u.role === 'teacher' && u.status === 'active').length}` },
    { id: 'classes', label: 'Classes', icon: BookOpen, badge: `${db.classes.length}` },
    { id: 'students', label: 'Students', icon: GraduationCap, badge: `${db.students.filter(s => s.status === 'active').length}` },
    { id: 'attendance', label: 'Live Attendance', icon: CalendarCheck },
    { id: 'teacher-attendance', label: 'Teacher Attendance', icon: UserCheck },
    { id: 'fees', label: 'Fees & WhatsApp', icon: CreditCard },
    { id: 'results', label: 'Report Cards & Marksheets', icon: Award, badge: db.results.length > 0 ? `${db.results.length}` : undefined },
    { id: 'performance', label: 'Performance', icon: Sparkles },
    { id: 'reports', label: 'Reports & Analytics', icon: BarChart3 },
    { id: 'academic-year', label: 'Academic Session', icon: Calendar },
    { id: 'activity-logs', label: 'Audit & Backup', icon: History },
    { id: 'settings', label: 'School Settings', icon: Settings },
  ];

  const teacherNavItems: NavItem[] = [
    { id: 'dashboard', label: 'My Class Dashboard', icon: LayoutDashboard },
    { id: 'attendance', label: 'Take Attendance', icon: CalendarCheck, highlight: true },
    { id: 'students', label: 'My Students', icon: Users },
    { id: 'results', label: 'Report Cards & Marksheets', icon: Award, badge: db.results.length > 0 ? `${db.results.length}` : undefined },
    { id: 'performance', label: 'Student Remarks', icon: Sparkles },
    { id: 'my-attendance', label: 'My Attendance', icon: UserCheck },
    { id: 'reports', label: 'Class Report', icon: BarChart3 },
  ];

  const navItems = isPrincipal ? principalNavItems : teacherNavItems;

  return (
    <aside className="hidden lg:flex flex-col w-64 shrink-0 border-r border-white/20 bg-white/40 backdrop-blur-xl p-4 min-h-[calc(100vh-4rem)] z-10">
      {/* Role Banner */}
      <div className="mb-4 rounded-3xl bg-[#F27D26] p-4 text-white shadow-lg shadow-orange-500/20 border border-white/30 backdrop-blur-md">
        <div className="flex items-center space-x-2">
          <ShieldCheck className="h-5 w-5 text-amber-200" />
          <span className="text-xs font-black uppercase tracking-wider text-orange-100">
            {isPrincipal ? 'Principal Portal' : 'Teacher Portal'}
          </span>
        </div>
        <p className="mt-1.5 font-bold text-sm leading-tight text-white">
          {currentUser?.name}
        </p>
        <p className="text-[11px] text-orange-100 mt-0.5">
          {isPrincipal ? 'Smart School Administration' : `Class Teacher: ${currentUser?.assignedClassName || 'Class 5'}`}
        </p>

        {adminImpersonation && (
          <button
            onClick={exitAdminClassAccess}
            className="mt-3 w-full rounded-2xl bg-white/20 border border-white/30 py-1.5 text-xs font-bold hover:bg-white/30 transition-all text-center"
          >
            Exit Class View
          </button>
        )}
      </div>

      {/* Navigation List */}
      <nav className="flex-1 space-y-1.5 overflow-y-auto pr-1">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentTab(item.id)}
              className={`group flex w-full items-center justify-between p-3 rounded-2xl text-xs font-bold transition-all ${
                isActive
                  ? 'bg-white/70 backdrop-blur-md shadow-sm border border-white/50 text-[#F27D26]'
                  : item.highlight
                  ? 'bg-orange-100/60 text-orange-900 hover:bg-white/50 border border-orange-200/40'
                  : 'text-[#1A2B48]/70 hover:bg-white/40 hover:text-[#1A2B48]'
              }`}
            >
              <div className="flex items-center space-x-3">
                <Icon
                  className={`h-4.5 w-4.5 shrink-0 transition-transform group-hover:scale-110 ${
                    isActive ? 'text-[#F27D26]' : 'text-[#1A2B48]/60 group-hover:text-[#F27D26]'
                  }`}
                />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    isActive
                      ? 'bg-orange-100 text-[#F27D26]'
                      : 'bg-white/60 text-[#1A2B48]/70 border border-white/50 group-hover:bg-white'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer Info */}
      <div className="mt-4 border-t border-black/5 pt-3">
        <button
          onClick={logout}
          className="flex w-full items-center justify-between rounded-2xl p-3 text-xs font-bold text-red-600 hover:bg-white/40 transition-colors"
        >
          <div className="flex items-center space-x-3">
            <LogOut className="h-4 w-4" />
            <span>Sign Out</span>
          </div>
          <ChevronRight className="h-4 w-4 text-red-300" />
        </button>
      </div>
    </aside>
  );
};
