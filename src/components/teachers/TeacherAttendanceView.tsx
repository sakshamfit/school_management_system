import React, { useState } from 'react';
import {
  UserCheck,
  Calendar,
  Check,
  X,
  Clock,
  CheckCircle2,
  Save,
} from 'lucide-react';
import { useSchool } from '../../context/SchoolContext';
import { getTodayDateString, formatDate } from '../../utils/helpers';

export const TeacherAttendanceView: React.FC = () => {
  const { db, markTeacherAttendance } = useSchool();
  const [selectedDate, setSelectedDate] = useState(getTodayDateString());
  const [savedSuccess, setSavedSuccess] = useState(false);

  const activeTeachers = db.users.filter(u => u.role === 'teacher' && u.status === 'active');

  const handleStatusChange = (teacherId: string, status: 'present' | 'absent' | 'leave' | 'half_day') => {
    markTeacherAttendance(teacherId, selectedDate, status);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const todayRecords = db.teacherAttendance.filter(t => t.date === selectedDate);
  const presentCount = todayRecords.filter(t => t.status === 'present').length;
  const leaveCount = todayRecords.filter(t => t.status === 'leave').length;
  const absentCount = todayRecords.filter(t => t.status === 'absent').length;

  return (
    <div className="space-y-4 pb-16">
      {/* Header */}
      <div className="rounded-3xl border border-orange-100 bg-white p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
              <UserCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900">
                Staff & Teacher Attendance
              </h2>
              <p className="text-xs text-slate-500">
                Principal control over daily faculty attendance and leaves
              </p>
            </div>
          </div>

          <div>
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="rounded-xl border border-slate-200 py-2 px-3 text-xs font-bold text-slate-800 focus:border-amber-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Summary Bar */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3.5 text-center">
          <span className="text-[10px] font-bold uppercase text-emerald-700">Present</span>
          <p className="text-xl font-black text-emerald-800 mt-0.5">{presentCount}</p>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-3.5 text-center">
          <span className="text-[10px] font-bold uppercase text-amber-700">On Leave</span>
          <p className="text-xl font-black text-amber-800 mt-0.5">{leaveCount}</p>
        </div>

        <div className="rounded-2xl border border-rose-200 bg-rose-50/60 p-3.5 text-center">
          <span className="text-[10px] font-bold uppercase text-rose-700">Absent</span>
          <p className="text-xl font-black text-rose-800 mt-0.5">{absentCount}</p>
        </div>
      </div>

      {/* Teacher Attendance Rows */}
      <div className="rounded-3xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs space-y-3">
        <h3 className="font-extrabold text-slate-900 text-sm pb-2 border-b border-slate-100">
          Faculty Roster for {formatDate(selectedDate)}
        </h3>

        <div className="divide-y divide-slate-100">
          {activeTeachers.map(teacher => {
            const record = db.teacherAttendance.find(
              t => t.teacherId === teacher.id && t.date === selectedDate
            );
            const currentStatus = record?.status || 'present';

            return (
              <div
                key={teacher.id}
                className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-center space-x-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 font-bold text-amber-800">
                    {teacher.name.charAt(0)}
                  </div>
                  <div>
                    <h4 className="font-bold text-xs sm:text-sm text-slate-900">
                      {teacher.name}
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      {teacher.assignedClassName} • {teacher.subject || 'All Subjects'}
                    </p>
                  </div>
                </div>

                {/* Status Selector */}
                <div className="flex items-center space-x-1.5">
                  {(['present', 'leave', 'absent', 'half_day'] as const).map(status => {
                    const isSelected = currentStatus === status;
                    return (
                      <button
                        key={status}
                        onClick={() => handleStatusChange(teacher.id, status)}
                        className={`rounded-xl px-3 py-1.5 text-xs font-bold capitalize transition-all ${
                          isSelected
                            ? status === 'present'
                              ? 'bg-emerald-600 text-white shadow-sm'
                              : status === 'leave'
                              ? 'bg-amber-600 text-white shadow-sm'
                              : status === 'absent'
                              ? 'bg-rose-600 text-white shadow-sm'
                              : 'bg-blue-600 text-white shadow-sm'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {status.replace('_', ' ')}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
