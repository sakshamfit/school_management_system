import React, { useState } from 'react';
import {
  UserCheck,
} from 'lucide-react';
import { useSchool } from '../../context/SchoolContext';
import { getTodayDateString, formatDate } from '../../utils/helpers';

export const TeacherAttendanceView: React.FC = () => {
  const { db, markTeacherAttendance } = useSchool();
  const [selectedDate, setSelectedDate] = useState(getTodayDateString());

  const activeTeachers = db.users.filter(u => u.role === 'teacher' && u.status === 'active');

  const handleStatusChange = (teacherId: string, status: 'present' | 'absent' | 'leave' | 'half_day') => {
    markTeacherAttendance(teacherId, selectedDate, status);
  };

  const todayRecords = db.teacherAttendance.filter(t => t.date === selectedDate);
  const presentCount = todayRecords.filter(t => t.status === 'present').length;
  const leaveCount = todayRecords.filter(t => t.status === 'leave').length;
  const absentCount = todayRecords.filter(t => t.status === 'absent').length;

  return (
    <div className="space-y-6 pb-16 text-[#1d1d1f]">
      {/* Header */}
      <div className="bg-white rounded-[18px] border border-[#e5e5ea] p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0066cc]/10 text-[#0066cc]">
              <UserCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold tracking-[-0.022em] text-[#1d1d1f]">
                Faculty Attendance
              </h2>
              <p className="text-xs text-[#86868b]">
                Record and manage daily teacher attendance and leaves
              </p>
            </div>
          </div>

          <div>
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="apple-input font-medium"
            />
          </div>
        </div>
      </div>

      {/* Summary Bar */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-[#e5e5ea] p-4 text-center shadow-xs">
          <span className="text-xs text-[#30d158]">Present</span>
          <p className="text-2xl font-semibold text-[#30d158] mt-1">{presentCount}</p>
        </div>

        <div className="bg-white rounded-2xl border border-[#e5e5ea] p-4 text-center shadow-xs">
          <span className="text-xs text-[#ff9500]">On Leave</span>
          <p className="text-2xl font-semibold text-[#ff9500] mt-1">{leaveCount}</p>
        </div>

        <div className="bg-white rounded-2xl border border-[#e5e5ea] p-4 text-center shadow-xs">
          <span className="text-xs text-[#ff3b30]">Absent</span>
          <p className="text-2xl font-semibold text-[#ff3b30] mt-1">{absentCount}</p>
        </div>
      </div>

      {/* Teacher Attendance Rows */}
      <div className="bg-white rounded-[18px] border border-[#e5e5ea] p-6 shadow-xs space-y-4">
        <h3 className="font-semibold text-sm text-[#1d1d1f] pb-3 border-b border-[#f0f0f0]">
          Faculty Roster for {formatDate(selectedDate)}
        </h3>

        <div className="divide-y divide-[#f0f0f0]">
          {activeTeachers.map(teacher => {
            const record = db.teacherAttendance.find(
              t => t.teacherId === teacher.id && t.date === selectedDate
            );
            const currentStatus = record?.status || 'present';

            return (
              <div
                key={teacher.id}
                className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-center space-x-3.5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f5f5f7] font-semibold text-sm text-[#1d1d1f]">
                    {teacher.name.charAt(0)}
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm text-[#1d1d1f]">
                      {teacher.name}
                    </h4>
                    <p className="text-xs text-[#86868b]">
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
                        className={`rounded-full px-3.5 py-1.5 text-xs font-semibold capitalize transition-all ${
                          isSelected
                            ? status === 'present'
                              ? 'bg-[#30d158] text-white shadow-xs'
                              : status === 'leave'
                              ? 'bg-[#ff9500] text-white shadow-xs'
                              : status === 'absent'
                              ? 'bg-[#ff3b30] text-white shadow-xs'
                              : 'bg-[#0066cc] text-white shadow-xs'
                            : 'bg-[#f5f5f7] text-[#86868b] hover:text-[#1d1d1f]'
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
