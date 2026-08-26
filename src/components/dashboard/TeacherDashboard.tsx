import React, { useState, useEffect } from 'react';
import {
  CalendarCheck,
  GraduationCap,
  PlusCircle,
  Sparkles,
  Award,
  UserCheck,
  Search,
  CheckCircle2,
  Clock,
  ArrowRight,
  Phone,
  BookOpen,
  Check,
} from 'lucide-react';
import { useSchool } from '../../context/SchoolContext';
import { getTodayDateString, formatDate } from '../../utils/helpers';

interface TeacherDashboardProps {
  onNavigate: (tab: string, extra?: any) => void;
  onOpenAddStudent: () => void;
  onSelectStudent: (studentId: string) => void;
}

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({
  onNavigate,
  onOpenAddStudent,
  onSelectStudent,
}) => {
  const { db, currentUser, markTeacherAttendance } = useSchool();
  const todayStr = getTodayDateString();

  // Assigned class
  const assignedClassId = currentUser?.assignedClassId || 'cls_05';
  const assignedClass = db.classes.find(c => c.id === assignedClassId);
  const myStudents = db.students.filter(
    s => s.classId === assignedClassId && s.status === 'active'
  );

  // Today's attendance for this class
  const todayClassAttendance = db.attendance.filter(
    a => a.classId === assignedClassId && a.date === todayStr
  );
  const isAttendanceSubmittedToday = todayClassAttendance.length > 0;
  const presentCount = todayClassAttendance.filter(a => a.status === 'present').length;
  const absentCount = todayClassAttendance.filter(a => a.status === 'absent').length;

  // Teacher's own attendance record today
  const myAttendanceToday = db.teacherAttendance.find(
    t => t.teacherId === currentUser?.id && t.date === todayStr
  );

  const [checkInRemarks, setCheckInRemarks] = useState('');
  const [showCheckInSuccess, setShowCheckInSuccess] = useState(false);

  // Automatic Check-in when teacher enters panel
  useEffect(() => {
    if (currentUser?.id && !myAttendanceToday) {
      markTeacherAttendance(currentUser.id, todayStr, 'present', 'Auto-marked Present upon entering portal');
      setShowCheckInSuccess(true);
    }
  }, [currentUser?.id, todayStr, myAttendanceToday, markTeacherAttendance]);

  const handleSelfCheckIn = (status: 'present' | 'leave' | 'half_day') => {
    if (!currentUser) return;
    markTeacherAttendance(currentUser.id, todayStr, status, checkInRemarks);
    setShowCheckInSuccess(true);
    setTimeout(() => setShowCheckInSuccess(false), 3500);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Auto-Attendance Present Success Banner */}
      <div className="rounded-2xl bg-emerald-500 text-white p-3.5 px-5 shadow-md flex items-center justify-between animate-in fade-in slide-in-from-top-2 duration-300">
        <div className="flex items-center space-x-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-emerald-600 font-black shadow-xs">
            <Check className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs font-black tracking-wide">
              ✓ TEACHER ATTENDANCE RECORDED: PRESENT
            </p>
            <p className="text-[11px] text-emerald-100">
              System verified presence for {currentUser?.name} on {formatDate(todayStr)}. Synced with Principal.
            </p>
          </div>
        </div>
        <span className="hidden sm:inline-block text-[10px] font-bold uppercase bg-white/20 px-2.5 py-1 rounded-full backdrop-blur-sm">
          Active Today
        </span>
      </div>

      {/* Teacher Class Hero Card */}
      <div className="rounded-3xl bg-[#F27D26] p-6 text-white shadow-lg shadow-orange-500/20 border border-white/30 backdrop-blur-md">
        <div className="flex items-center justify-between">
          <div className="inline-flex items-center space-x-2 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur-sm border border-white/30">
            <span>👩‍🏫 Teacher Workspace</span>
            <span>•</span>
            <span>{formatDate(todayStr)}</span>
          </div>
          <span className="rounded-full bg-white/20 border border-white/30 px-3 py-0.5 text-xs font-bold text-white backdrop-blur-sm font-mono">
            Code: {currentUser?.teacherCode || 'MSPS'}
          </span>
        </div>

        <div className="mt-3">
          <h2 className="text-2xl sm:text-3xl font-black text-white">
            Namaste, {currentUser?.name}!
          </h2>
          <p className="text-xs sm:text-sm text-orange-100 mt-1">
            Class Teacher for <strong>{assignedClass?.name || 'Class 5'}</strong> (Subject: {currentUser?.subject || 'All Subjects'})
          </p>
        </div>

        {/* Attendance Status Callout */}
        <div className="mt-4 rounded-2xl bg-white/15 p-4 backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-white/30">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#F27D26] font-bold shadow-sm">
              <CalendarCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-white">
                {isAttendanceSubmittedToday
                  ? `Class Attendance: Completed (${presentCount} Present, ${absentCount} Absent)`
                  : "Class Attendance Not Taken Yet"}
              </p>
              <p className="text-[11px] text-orange-100">
                {myStudents.length} enrolled students in {assignedClass?.name}
              </p>
            </div>
          </div>

          <button
            onClick={() => onNavigate('attendance', { classId: assignedClassId })}
            className="inline-flex items-center justify-center space-x-1.5 rounded-2xl bg-white px-5 py-2.5 text-xs font-bold text-[#F27D26] shadow-md hover:scale-105 active:scale-95 transition-all"
          >
            <span>{isAttendanceSubmittedToday ? 'Review Class Attendance' : 'Take Class Attendance Now'}</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Main Quick Action Hub */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <button
          onClick={() => onNavigate('attendance', { classId: assignedClassId })}
          className="flex flex-col items-center justify-center rounded-3xl bg-white/70 backdrop-blur-md p-5 text-center shadow-sm border border-white/60 hover:bg-white hover:scale-105 transition-all active:scale-95 group"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 group-hover:scale-110 transition-transform">
            <CalendarCheck className="h-6 w-6" />
          </div>
          <span className="mt-2.5 text-xs font-black text-[#1A2B48]">Take Attendance</span>
          <span className="text-[10px] text-[#1A2B48]/50 mt-0.5">1-tap fast mark</span>
        </button>

        <button
          onClick={onOpenAddStudent}
          className="flex flex-col items-center justify-center rounded-3xl bg-white/70 backdrop-blur-md p-5 text-center shadow-sm border border-white/60 hover:bg-white hover:scale-105 transition-all active:scale-95 group"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-100 text-[#F27D26] group-hover:scale-110 transition-transform">
            <PlusCircle className="h-6 w-6" />
          </div>
          <span className="mt-2.5 text-xs font-black text-[#1A2B48]">Add Student</span>
          <span className="text-[10px] text-[#1A2B48]/50 mt-0.5">Camera photo</span>
        </button>

        <button
          onClick={() => onNavigate('performance')}
          className="flex flex-col items-center justify-center rounded-3xl bg-white/70 backdrop-blur-md p-5 text-center shadow-sm border border-white/60 hover:bg-white hover:scale-105 transition-all active:scale-95 group"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-100 text-purple-700 group-hover:scale-110 transition-transform">
            <Sparkles className="h-6 w-6" />
          </div>
          <span className="mt-2.5 text-xs font-black text-[#1A2B48]">Student Remarks</span>
          <span className="text-[10px] text-[#1A2B48]/50 mt-0.5">Performance notes</span>
        </button>

        <button
          onClick={() => onNavigate('results')}
          className="flex flex-col items-center justify-center rounded-3xl bg-white/70 backdrop-blur-md p-5 text-center shadow-sm border border-white/60 hover:bg-white hover:scale-105 transition-all active:scale-95 group"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-100 text-purple-700 group-hover:scale-110 transition-transform">
            <Award className="h-6 w-6" />
          </div>
          <span className="mt-2.5 text-xs font-black text-[#1A2B48]">Report Card & Marks</span>
          <span className="text-[10px] text-purple-700 font-semibold mt-0.5">Generate & Print</span>
        </button>
      </div>

      {/* Teacher Attendance Status & Controls */}
      <div className="bg-white/50 backdrop-blur-sm border border-white/50 rounded-[32px] p-6 shadow-sm">
        <div className="flex items-center justify-between pb-3 border-b border-black/5">
          <div className="flex items-center space-x-2">
            <UserCheck className="h-5 w-5 text-[#F27D26]" />
            <h3 className="font-black text-[#1A2B48] text-base">My Daily Presence Status</h3>
          </div>
          {myAttendanceToday && (
            <span
              className={`rounded-full px-3 py-1 text-xs font-bold ${
                myAttendanceToday.status === 'present'
                  ? 'bg-emerald-100 text-emerald-800'
                  : myAttendanceToday.status === 'leave'
                  ? 'bg-rose-100 text-rose-800'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              ✓ Marked: {myAttendanceToday.status.toUpperCase()}
            </span>
          )}
        </div>

        <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-[#1A2B48]/70">
            {myAttendanceToday?.status === 'present'
              ? `You are automatically checked-in as Present for today (${formatDate(todayStr)}).`
              : 'Update your status below if on leave or half day.'}
          </p>

          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <button
              onClick={() => handleSelfCheckIn('present')}
              className={`flex-1 sm:flex-initial rounded-2xl px-5 py-2.5 text-xs font-bold transition-all shadow-xs ${
                myAttendanceToday?.status === 'present'
                  ? 'bg-emerald-600 text-white shadow-emerald-600/20'
                  : 'bg-white/80 text-emerald-700 hover:bg-emerald-50 border border-emerald-200'
              }`}
            >
              ✓ Present
            </button>
            <button
              onClick={() => handleSelfCheckIn('leave')}
              className={`flex-1 sm:flex-initial rounded-2xl px-4 py-2.5 text-xs font-bold transition-all ${
                myAttendanceToday?.status === 'leave'
                  ? 'bg-rose-600 text-white'
                  : 'bg-white/60 text-[#1A2B48]/70 hover:bg-white border border-white/80'
              }`}
            >
              Apply Leave
            </button>
          </div>
        </div>
      </div>

      {/* My Class Students Roster Preview */}
      <div className="bg-white/50 backdrop-blur-sm border border-white/50 rounded-[32px] p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-black text-[#1A2B48] text-base">
              {assignedClass?.name} Students ({myStudents.length})
            </h3>
            <p className="text-xs text-[#1A2B48]/60">Tap student to view profile & records</p>
          </div>
          <button
            onClick={() => onNavigate('students')}
            className="text-xs font-bold text-[#F27D26] hover:underline inline-flex items-center space-x-1"
          >
            <span>Full Roster</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {myStudents.length === 0 ? (
          <div className="py-8 text-center bg-white/40 rounded-2xl border border-white/60">
            <GraduationCap className="h-8 w-8 mx-auto text-[#1A2B48]/30 mb-2" />
            <p className="text-xs font-bold text-[#1A2B48]/60">No students added to {assignedClass?.name} yet.</p>
            <button
              onClick={onOpenAddStudent}
              className="mt-3 inline-flex items-center space-x-1.5 rounded-xl bg-[#F27D26] px-4 py-2 text-xs font-bold text-white shadow-xs"
            >
              <PlusCircle className="h-3.5 w-3.5" />
              <span>Add First Student</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {myStudents.map(student => {
              const todayAtt = db.attendance.find(
                a => a.studentId === student.id && a.date === todayStr
              );
              return (
                <div
                  key={student.id}
                  onClick={() => onSelectStudent(student.id)}
                  className="cursor-pointer flex items-center justify-between rounded-2xl border border-white/80 bg-white/60 p-3.5 hover:border-orange-300 hover:bg-white transition-all group shadow-xs"
                >
                  <div className="flex items-center space-x-3">
                    <img
                      src={student.photoUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${student.name}`}
                      alt={student.name}
                      className="h-10 w-10 rounded-xl object-cover border border-orange-200"
                    />
                    <div>
                      <h4 className="font-bold text-xs text-[#1A2B48] group-hover:text-[#F27D26] transition-colors">
                        {student.name}
                      </h4>
                      <p className="text-[11px] text-[#1A2B48]/50">
                        Roll No: {student.rollNumber} • Adm: {student.admissionNumber}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    {todayAtt ? (
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-black ${
                          todayAtt.status === 'present'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {todayAtt.status.toUpperCase()}
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-200/80 px-2.5 py-0.5 text-[10px] font-semibold text-slate-600">
                        Pending
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
