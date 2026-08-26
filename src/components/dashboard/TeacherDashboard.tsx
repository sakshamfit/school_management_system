import React, { useState, useEffect } from 'react';
import {
  CalendarCheck,
  GraduationCap,
  PlusCircle,
  Sparkles,
  Award,
  UserCheck,
  CheckCircle2,
  Clock,
  ArrowRight,
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
    <div className="space-y-6 pb-16 text-[#1d1d1f]">
      {/* Auto-Attendance Present Success Banner */}
      <div className="bg-white rounded-[18px] border border-[#e5e5ea] p-4 flex items-center justify-between shadow-xs">
        <div className="flex items-center space-x-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#30d158]/15 text-[#30d158]">
            <Check className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs font-semibold text-[#1d1d1f]">
              Faculty Attendance Logged: Present
            </p>
            <p className="text-[11px] text-[#86868b]">
              Attendance verified for {currentUser?.name} on {formatDate(todayStr)}.
            </p>
          </div>
        </div>
        <span className="hidden sm:inline-block text-[11px] font-medium text-[#30d158] bg-[#30d158]/10 px-2.5 py-0.5 rounded-full">
          Live Synced
        </span>
      </div>

      {/* Teacher Class Hero Card */}
      <div className="bg-white rounded-[18px] border border-[#e5e5ea] p-6 sm:p-8 shadow-xs">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-[#0066cc] uppercase tracking-wider">
            Faculty Workspace • {formatDate(todayStr)}
          </span>
          <span className="bg-[#f5f5f7] px-2.5 py-1 rounded-full text-xs font-mono text-[#86868b]">
            Code: {currentUser?.teacherCode || 'MSPS'}
          </span>
        </div>

        <div className="mt-3">
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-[-0.025em] text-[#1d1d1f]">
            Welcome, {currentUser?.name}!
          </h2>
          <p className="text-[15px] text-[#86868b] mt-1">
            Class Educator for <strong className="text-[#1d1d1f] font-semibold">{assignedClass?.name || 'Class 5'}</strong> ({currentUser?.subject || 'All Subjects'})
          </p>
        </div>

        {/* Attendance Status Callout */}
        <div className="mt-6 bg-[#f5f5f7] rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[#30d158] shadow-xs">
              <CalendarCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#1d1d1f]">
                {isAttendanceSubmittedToday
                  ? `Roll-Call Recorded (${presentCount} Present, ${absentCount} Absent)`
                  : "Daily Roll-Call Pending"}
              </p>
              <p className="text-xs text-[#86868b]">
                {myStudents.length} active students enrolled in {assignedClass?.name}
              </p>
            </div>
          </div>

          <button
            onClick={() => onNavigate('attendance', { classId: assignedClassId })}
            className="apple-btn-primary"
          >
            <span>{isAttendanceSubmittedToday ? 'Review Roll-Call' : 'Take Roll-Call'}</span>
            <ArrowRight className="h-4 w-4 ml-1.5" />
          </button>
        </div>
      </div>

      {/* Main Quick Action Hub */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <button
          onClick={() => onNavigate('attendance', { classId: assignedClassId })}
          className="flex flex-col items-center justify-center bg-white border border-[#e5e5ea] p-5 rounded-[18px] text-center hover:border-[#0066cc]/40 transition-all shadow-xs group"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#30d158]/10 text-[#30d158] mb-3 group-hover:scale-105 transition-transform">
            <CalendarCheck className="h-5 w-5" />
          </div>
          <span className="text-sm font-semibold text-[#1d1d1f]">Roll-Call</span>
          <span className="text-xs text-[#86868b] mt-0.5">1-tap fast mark</span>
        </button>

        <button
          onClick={onOpenAddStudent}
          className="flex flex-col items-center justify-center bg-white border border-[#e5e5ea] p-5 rounded-[18px] text-center hover:border-[#0066cc]/40 transition-all shadow-xs group"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#0066cc]/10 text-[#0066cc] mb-3 group-hover:scale-105 transition-transform">
            <PlusCircle className="h-5 w-5" />
          </div>
          <span className="text-sm font-semibold text-[#1d1d1f]">Add Student</span>
          <span className="text-xs text-[#86868b] mt-0.5">Camera photo</span>
        </button>

        <button
          onClick={() => onNavigate('performance')}
          className="flex flex-col items-center justify-center bg-white border border-[#e5e5ea] p-5 rounded-[18px] text-center hover:border-[#0066cc]/40 transition-all shadow-xs group"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#5856d6]/10 text-[#5856d6] mb-3 group-hover:scale-105 transition-transform">
            <Sparkles className="h-5 w-5" />
          </div>
          <span className="text-sm font-semibold text-[#1d1d1f]">Remarks</span>
          <span className="text-xs text-[#86868b] mt-0.5">Observations</span>
        </button>

        <button
          onClick={() => onNavigate('results')}
          className="flex flex-col items-center justify-center bg-white border border-[#e5e5ea] p-5 rounded-[18px] text-center hover:border-[#0066cc]/40 transition-all shadow-xs group"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#ff2d55]/10 text-[#ff2d55] mb-3 group-hover:scale-105 transition-transform">
            <Award className="h-5 w-5" />
          </div>
          <span className="text-sm font-semibold text-[#1d1d1f]">Marksheets</span>
          <span className="text-xs text-[#86868b] mt-0.5">Exams & grades</span>
        </button>
      </div>

      {/* Teacher Attendance Status & Controls */}
      <div className="bg-white rounded-[18px] border border-[#e5e5ea] p-6 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-[#f0f0f0]">
          <div className="flex items-center space-x-2">
            <UserCheck className="h-4 w-4 text-[#0066cc]" />
            <h3 className="font-semibold text-[#1d1d1f] text-sm">Faculty Check-In Record</h3>
          </div>
          {myAttendanceToday && (
            <span
              className={`px-2.5 py-0.5 text-xs rounded-full font-medium ${
                myAttendanceToday.status === 'present'
                  ? 'bg-[#30d158]/10 text-[#30d158]'
                  : myAttendanceToday.status === 'leave'
                  ? 'bg-[#ff3b30]/10 text-[#ff3b30]'
                  : 'bg-[#ff9500]/10 text-[#ff9500]'
              }`}
            >
              Status: {myAttendanceToday.status.toUpperCase()}
            </span>
          )}
        </div>

        <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-[#86868b]">
            {myAttendanceToday?.status === 'present'
              ? `You are checked-in as Present for today (${formatDate(todayStr)}).`
              : 'Update your attendance status below if on leave or half day.'}
          </p>

          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <button
              onClick={() => handleSelfCheckIn('present')}
              className={`flex-1 sm:flex-initial apple-btn-primary ${
                myAttendanceToday?.status === 'present' ? 'bg-[#30d158] hover:bg-[#28c04e]' : ''
              }`}
            >
              ✓ Present
            </button>
            <button
              onClick={() => handleSelfCheckIn('leave')}
              className="flex-1 sm:flex-initial apple-btn-secondary"
            >
              Apply Leave
            </button>
          </div>
        </div>
      </div>

      {/* My Class Students Roster Preview */}
      <div className="bg-white rounded-[18px] border border-[#e5e5ea] p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#f0f0f0]">
          <div>
            <h3 className="font-semibold text-[#1d1d1f] text-base">
              {assignedClass?.name} Student Roster ({myStudents.length})
            </h3>
            <p className="text-xs text-[#86868b]">Select student to view academic dossier & contact info</p>
          </div>
          <button
            onClick={() => onNavigate('students')}
            className="text-xs font-medium text-[#0066cc] hover:underline inline-flex items-center space-x-1"
          >
            <span>Full Directory</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {myStudents.length === 0 ? (
          <div className="py-8 text-center bg-[#f5f5f7] rounded-2xl">
            <GraduationCap className="h-8 w-8 mx-auto text-[#86868b] mb-2" />
            <p className="text-xs text-[#86868b]">No students added to {assignedClass?.name} yet.</p>
            <button
              onClick={onOpenAddStudent}
              className="mt-3 apple-btn-primary"
            >
              <PlusCircle className="h-4 w-4 mr-1.5" />
              <span>Enroll Student</span>
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
                  className="cursor-pointer flex items-center justify-between bg-[#f5f5f7] rounded-2xl p-3.5 hover:bg-[#e5e5ea] transition-all group"
                >
                  <div className="flex items-center space-x-3">
                    <img
                      src={student.photoUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${student.name}`}
                      alt={student.name}
                      className="h-10 w-10 rounded-full object-cover bg-white apple-product-shadow"
                    />
                    <div>
                      <h4 className="font-semibold text-xs text-[#1d1d1f] group-hover:text-[#0066cc] transition-colors">
                        {student.name}
                      </h4>
                      <p className="text-[11px] text-[#86868b]">
                        Roll #{student.rollNumber} • Adm #{student.admissionNumber}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    {todayAtt ? (
                      <span
                        className={`px-2.5 py-0.5 text-[10px] rounded-full font-semibold ${
                          todayAtt.status === 'present'
                            ? 'bg-[#30d158]/15 text-[#30d158]'
                            : 'bg-[#ff3b30]/15 text-[#ff3b30]'
                        }`}
                      >
                        {todayAtt.status.toUpperCase()}
                      </span>
                    ) : (
                      <span className="bg-white px-2.5 py-0.5 rounded-full text-[10px] text-[#86868b] shadow-xs">
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
