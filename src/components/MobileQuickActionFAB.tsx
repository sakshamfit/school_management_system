import React, { useState } from 'react';
import {
  Plus,
  X,
  CalendarCheck,
  UserPlus,
  CreditCard,
  Search,
  MessageSquare,
} from 'lucide-react';

interface MobileQuickActionFABProps {
  onNavigateTab: (tab: string, extra?: any) => void;
  onOpenAddStudent: () => void;
  onOpenAddTeacher?: () => void;
  onOpenQuickSearch: () => void;
  onOpenWhatsAppBroadcast: () => void;
}

export const MobileQuickActionFAB: React.FC<MobileQuickActionFABProps> = ({
  onNavigateTab,
  onOpenAddStudent,
  onOpenQuickSearch,
  onOpenWhatsAppBroadcast,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const actions = [
    {
      id: 'attendance',
      label: 'Daily Roll-Call',
      subtext: 'Mark today attendance',
      icon: CalendarCheck,
      action: () => {
        onNavigateTab('attendance');
        setIsOpen(false);
      },
    },
    {
      id: 'enroll',
      label: 'New Student Admission',
      subtext: 'Enroll student profile',
      icon: UserPlus,
      action: () => {
        onOpenAddStudent();
        setIsOpen(false);
      },
    },
    {
      id: 'fees',
      label: 'Collect Tuition Fee',
      subtext: 'Record fee receipt',
      icon: CreditCard,
      action: () => {
        onNavigateTab('fees');
        setIsOpen(false);
      },
    },
    {
      id: 'whatsapp',
      label: 'WhatsApp Circular',
      subtext: 'Send parent notice',
      icon: MessageSquare,
      action: () => {
        onOpenWhatsAppBroadcast();
        setIsOpen(false);
      },
    },
    {
      id: 'search',
      label: 'Search Directory',
      subtext: 'Find student or roll',
      icon: Search,
      action: () => {
        onOpenQuickSearch();
        setIsOpen(false);
      },
    },
  ];

  return (
    <>
      {/* Backdrop overlay when speed dial is open */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs lg:hidden animate-in fade-in duration-200"
        />
      )}

      {/* Speed Dial Menu items */}
      <div className="fixed bottom-20 right-4 z-50 lg:hidden flex flex-col items-end space-y-2 pointer-events-none">
        {isOpen && (
          <div className="flex flex-col items-end space-y-2 mb-2 pointer-events-auto animate-in slide-in-from-bottom-5 duration-200">
            {actions.map(act => {
              const Icon = act.icon;
              return (
                <button
                  key={act.id}
                  onClick={act.action}
                  className="flex items-center space-x-3 bg-white px-4 py-2.5 rounded-[14px] shadow-lg border border-[#e5e5ea] active:scale-98 transition-all text-right group"
                >
                  <div className="flex flex-col items-end">
                    <span className="text-xs font-semibold text-[#1d1d1f]">
                      {act.label}
                    </span>
                    <span className="text-[11px] text-[#86868b]">{act.subtext}</span>
                  </div>
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0066cc]/10 text-[#0066cc]">
                    <Icon className="h-4 w-4" />
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Primary FAB Trigger Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Quick Actions Menu"
          className={`pointer-events-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#0066cc] text-white shadow-xl hover:bg-[#0071e3] active:scale-95 transition-all duration-200 ${
            isOpen ? 'bg-[#1d1d1f]' : ''
          }`}
        >
          {isOpen ? (
            <X className="h-5 w-5 text-white" />
          ) : (
            <Plus className="h-6 w-6 text-white stroke-[2.2]" />
          )}
        </button>
      </div>
    </>
  );
};
