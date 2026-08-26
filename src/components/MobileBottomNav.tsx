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
} from 'lucide-react';
import { useSchool } from '../context/SchoolContext';

interface MobileBottomNavProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentTab,
  setCurrentTab,
}) => {
  const { currentUser, db } = useSchool();
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const isPrincipal = currentUser?.role === 'principal';

  const principalPrimary = [
    { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
    { id: 'attendance', label: 'Attendance', icon: CalendarCheck },
    { id: 'students', label: 'Students', icon: GraduationCap },
    { id: 'fees', label: 'Fees', icon: CreditCard },
  ];

  const teacherPrimary = [
    { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
    { id: 'attendance', label: 'Attendance', icon: CalendarCheck },
    { id: 'students', label: 'My Students', icon: GraduationCap },
    { id: 'performance', label: 'Performance', icon: Sparkles },
  ];

  const primaryItems = isPrincipal ? principalPrimary : teacherPrimary;

  const principalMoreItems = [
    { id: 'teachers', label: 'Teachers Management', icon: Users },
    { id: 'classes', label: 'Classes Management', icon: BookOpen },
    { id: 'teacher-attendance', label: 'Teacher Attendance', icon: UserCheck },
    { id: 'results', label: 'Exam Results', icon: Award },
    { id: 'performance', label: 'Student Performance', icon: Sparkles },
    { id: 'reports', label: 'Reports & Analytics', icon: BarChart3 },
    { id: 'academic-year', label: 'Academic Session', icon: Calendar },
    { id: 'activity-logs', label: 'Audit & Backup', icon: History },
    { id: 'settings', label: 'School Settings', icon: Settings },
  ];

  const teacherMoreItems = [
    { id: 'results', label: 'Exam Marks', icon: Award },
    { id: 'my-attendance', label: 'My Attendance', icon: UserCheck },
    { id: 'reports', label: 'Class Report', icon: BarChart3 },
  ];

  const moreItems = isPrincipal ? principalMoreItems : teacherMoreItems;

  return (
    <>
      {/* Bottom Sticky Tab Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 lg:hidden border-t border-white/40 bg-white/60 backdrop-blur-xl px-2 py-1.5 shadow-[0_-4px_20px_rgba(26,43,72,0.06)]">
        <div className="flex items-center justify-around">
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
                className={`flex flex-col items-center justify-center py-1 px-3 rounded-2xl transition-all ${
                  isActive
                    ? 'text-[#F27D26] font-extrabold scale-105'
                    : 'text-[#1A2B48]/60 font-semibold hover:text-[#1A2B48]'
                }`}
              >
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-xl transition-colors ${
                    isActive ? 'bg-white/80 backdrop-blur-md text-[#F27D26] shadow-xs border border-white/60' : ''
                  }`}
                >
                  <Icon className="h-4.5 w-4.5" />
                </div>
                <span className="text-[10px] mt-0.5 tracking-tight">{item.label}</span>
              </button>
            );
          })}

          {/* More Drawer Button */}
          <button
            onClick={() => setShowMoreMenu(!showMoreMenu)}
            className={`flex flex-col items-center justify-center py-1 px-3 rounded-2xl transition-all ${
              showMoreMenu
                ? 'text-[#F27D26] font-extrabold'
                : 'text-[#1A2B48]/60 font-semibold hover:text-[#1A2B48]'
            }`}
          >
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-xl ${
                showMoreMenu ? 'bg-white/80 backdrop-blur-md text-[#F27D26] shadow-xs border border-white/60' : ''
              }`}
            >
              <Menu className="h-4.5 w-4.5" />
            </div>
            <span className="text-[10px] mt-0.5">More</span>
          </button>
        </div>
      </div>

      {/* More Items Drawer */}
      {showMoreMenu && (
        <div className="fixed inset-0 z-50 lg:hidden flex flex-col justify-end bg-black/40 backdrop-blur-md animate-in fade-in">
          <div className="rounded-t-[32px] bg-white/95 backdrop-blur-2xl border-t border-white/60 p-5 shadow-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <span className="text-base font-black text-[#1A2B48]">
                  {db.schoolInfo.name} Menu
                </span>
              </div>
              <button
                onClick={() => setShowMoreMenu(false)}
                className="rounded-full bg-white/80 border border-white/80 p-1.5 text-slate-500 hover:bg-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5 mt-4">
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
                    className={`flex items-center space-x-3 rounded-2xl p-3.5 text-left text-xs font-bold transition-all ${
                      isActive
                        ? 'bg-[#F27D26] text-white shadow-md shadow-orange-500/20'
                        : 'bg-white/60 backdrop-blur-md text-[#1A2B48] border border-white/80 hover:bg-white'
                    }`}
                  >
                    <Icon
                      className={`h-5 w-5 shrink-0 ${
                        isActive ? 'text-white' : 'text-[#F27D26]'
                      }`}
                    />
                    <span className="leading-tight">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
