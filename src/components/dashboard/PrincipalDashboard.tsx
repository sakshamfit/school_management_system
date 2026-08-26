import React from 'react';
import {
  Users,
  GraduationCap,
  CalendarCheck,
  CreditCard,
  PlusCircle,
  Search,
  Award,
  BarChart3,
  ArrowRight,
  Sparkles,
  Phone,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { useSchool } from '../../context/SchoolContext';
import { getTodayDateString, formatDate } from '../../utils/helpers';
import { openWhatsAppFeeMessage } from '../../utils/whatsapp';

interface PrincipalDashboardProps {
  onNavigate: (tab: string, extra?: any) => void;
  onOpenAddStudent: () => void;
  onOpenAddTeacher: () => void;
  onOpenQuickSearch: () => void;
  onSelectStudent: (studentId: string) => void;
}

export const PrincipalDashboard: React.FC<PrincipalDashboardProps> = ({
  onNavigate,
  onOpenAddStudent,
  onOpenAddTeacher,
  onOpenQuickSearch,
  onSelectStudent,
}) => {
  const { db, currentUser } = useSchool();
  const todayStr = getTodayDateString();

  // Calculate live statistics
  const activeStudents = db.students.filter(s => s.status === 'active');
  const totalStudents = activeStudents.length;

  // Today's student attendance
  const todayAttendance = db.attendance.filter(a => a.date === todayStr);
  const presentStudentsCount = todayAttendance.filter(a => a.status === 'present').length;
  const absentStudentsCount = todayAttendance.filter(a => a.status === 'absent').length;
  const attendancePercentage =
    todayAttendance.length > 0
      ? ((presentStudentsCount / todayAttendance.length) * 100).toFixed(0)
      : totalStudents > 0
      ? '0'
      : '100';

  // Teacher attendance
  const activeTeachers = db.users.filter(u => u.role === 'teacher' && u.status === 'active');
  const totalTeachers = activeTeachers.length;
  const todayTeacherAttendance = db.teacherAttendance.filter(t => t.date === todayStr);
  const teachersPresent = todayTeacherAttendance.filter(t => t.status === 'present').length;

  // Fees calculation
  const totalFeesCollected = db.feeAccounts.reduce((acc, curr) => acc + (curr.paidAmount || 0), 0);
  const totalFeesPending = db.feeAccounts.reduce((acc, curr) => acc + (curr.dueAmount || 0), 0);
  const studentsWithDueFees = db.feeAccounts.filter(fa => (fa.dueAmount || 0) > 0);

  // Identify low attendance students (< 75%)
  const lowAttendanceStudents = activeStudents
    .map(student => {
      const records = db.attendance.filter(a => a.studentId === student.id);
      const present = records.filter(a => a.status === 'present').length;
      const pct = records.length > 0 ? (present / records.length) * 100 : 100;
      return { student, totalDays: records.length, presentDays: present, percentage: pct };
    })
    .filter(item => item.percentage < 75 && item.totalDays > 0);

  return (
    <div className="space-y-6 pb-16 text-[#1d1d1f]">
      {/* 1. Hero Overview Card (Museum Gallery style tile) */}
      <div className="bg-white rounded-[18px] border border-[#e5e5ea] p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <span className="text-xs font-semibold text-[#0066cc] uppercase tracking-wider">
              Executive Overview • {formatDate(todayStr)}
            </span>
            <h1 className="mt-1 text-2xl sm:text-3xl font-semibold tracking-[-0.025em] text-[#1d1d1f]">
              {currentUser?.name || 'Principal Console'}
            </h1>
            <p className="text-[15px] text-[#86868b] mt-1">
              Active Session {db.schoolInfo.currentAcademicYear} • {totalStudents} enrolled students • {totalTeachers} active faculty
            </p>
          </div>

          <div className="flex flex-wrap gap-2.5">
            <button
              onClick={onOpenAddStudent}
              className="apple-btn-primary"
            >
              <PlusCircle className="h-4 w-4 mr-2" />
              <span>Enroll Student</span>
            </button>
            <button
              onClick={onOpenAddTeacher}
              className="apple-btn-secondary"
            >
              <Users className="h-4 w-4 mr-2 text-[#0066cc]" />
              <span>Add Faculty</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Live Key Performance Indicators Grid (Store Utility Cards) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Students */}
        <div
          onClick={() => onNavigate('students')}
          className="cursor-pointer bg-white p-5 rounded-[18px] border border-[#e5e5ea] hover:border-[#0066cc]/40 transition-all shadow-xs group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#86868b]">Total Students</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f5f5f7] text-[#0066cc]">
              <GraduationCap className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-semibold tracking-tight text-[#1d1d1f]">{totalStudents}</span>
            <span className="text-xs font-medium text-[#30d158]">Active</span>
          </div>
          <p className="text-xs text-[#86868b] mt-1">{db.classes.length} Academic classes</p>
        </div>

        {/* Student Attendance */}
        <div
          onClick={() => onNavigate('attendance')}
          className="cursor-pointer bg-white p-5 rounded-[18px] border border-[#e5e5ea] hover:border-[#0066cc]/40 transition-all shadow-xs group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#86868b]">Today's Attendance</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f5f5f7] text-[#30d158]">
              <CalendarCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-semibold tracking-tight text-[#1d1d1f]">
              {todayAttendance.length > 0 ? `${attendancePercentage}%` : `${presentStudentsCount}`}
            </span>
            <span className="text-xs font-medium text-[#30d158]">
              {todayAttendance.length > 0 ? `${presentStudentsCount} Present` : 'Today'}
            </span>
          </div>
          <p className="text-xs text-[#86868b] mt-1">
            {todayAttendance.length > 0 ? `${absentStudentsCount} Absentees` : 'Daily roll-call'}
          </p>
        </div>

        {/* Teachers Today */}
        <div
          onClick={() => onNavigate('teachers')}
          className="cursor-pointer bg-white p-5 rounded-[18px] border border-[#e5e5ea] hover:border-[#0066cc]/40 transition-all shadow-xs group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#86868b]">Faculty Roster</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f5f5f7] text-[#0066cc]">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-semibold tracking-tight text-[#1d1d1f]">{teachersPresent}</span>
            <span className="text-xs text-[#86868b]">/ {totalTeachers} present</span>
          </div>
          <p className="text-xs text-[#86868b] mt-1">Faculty check-in status</p>
        </div>

        {/* Fees Collected */}
        <div
          onClick={() => onNavigate('fees')}
          className="cursor-pointer bg-white p-5 rounded-[18px] border border-[#e5e5ea] hover:border-[#0066cc]/40 transition-all shadow-xs group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#86868b]">Fee Treasury</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f5f5f7] text-[#ff9500]">
              <CreditCard className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#1d1d1f]">
              ₹{totalFeesCollected.toLocaleString('en-IN')}
            </span>
          </div>
          <p className="text-xs text-[#ff3b30] mt-1">
            Due: ₹{totalFeesPending.toLocaleString('en-IN')}
          </p>
        </div>
      </div>

      {/* 3. Quick Operations Matrix */}
      <div className="bg-white rounded-[18px] border border-[#e5e5ea] p-6 shadow-xs">
        <h3 className="text-sm font-semibold text-[#1d1d1f] mb-4">
          Quick Operations & Shortcuts
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          <button
            onClick={() => onNavigate('attendance')}
            className="flex flex-col items-center justify-center bg-[#f5f5f7] hover:bg-[#e5e5ea] p-4 rounded-2xl transition-all group"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#30d158] shadow-xs mb-2">
              <CalendarCheck className="h-5 w-5" />
            </div>
            <span className="text-xs font-medium text-[#1d1d1f]">Attendance</span>
          </button>

          <button
            onClick={onOpenAddStudent}
            className="flex flex-col items-center justify-center bg-[#f5f5f7] hover:bg-[#e5e5ea] p-4 rounded-2xl transition-all group"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#0066cc] shadow-xs mb-2">
              <GraduationCap className="h-5 w-5" />
            </div>
            <span className="text-xs font-medium text-[#1d1d1f]">Admission</span>
          </button>

          <button
            onClick={onOpenAddTeacher}
            className="flex flex-col items-center justify-center bg-[#f5f5f7] hover:bg-[#e5e5ea] p-4 rounded-2xl transition-all group"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#0066cc] shadow-xs mb-2">
              <Users className="h-5 w-5" />
            </div>
            <span className="text-xs font-medium text-[#1d1d1f]">Faculty</span>
          </button>

          <button
            onClick={() => onNavigate('fees')}
            className="flex flex-col items-center justify-center bg-[#f5f5f7] hover:bg-[#e5e5ea] p-4 rounded-2xl transition-all group"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#ff9500] shadow-xs mb-2">
              <CreditCard className="h-5 w-5" />
            </div>
            <span className="text-xs font-medium text-[#1d1d1f]">Fees</span>
          </button>

          <button
            onClick={() => onNavigate('results')}
            className="flex flex-col items-center justify-center bg-[#f5f5f7] hover:bg-[#e5e5ea] p-4 rounded-2xl transition-all group"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#ff2d55] shadow-xs mb-2">
              <Award className="h-5 w-5" />
            </div>
            <span className="text-xs font-medium text-[#1d1d1f]">Marksheets</span>
          </button>

          <button
            onClick={() => onNavigate('reports')}
            className="flex flex-col items-center justify-center bg-[#f5f5f7] hover:bg-[#e5e5ea] p-4 rounded-2xl transition-all group"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#5856d6] shadow-xs mb-2">
              <BarChart3 className="h-5 w-5" />
            </div>
            <span className="text-xs font-medium text-[#1d1d1f]">Analytics</span>
          </button>

          <button
            onClick={onOpenQuickSearch}
            className="flex flex-col items-center justify-center bg-[#f5f5f7] hover:bg-[#e5e5ea] p-4 rounded-2xl transition-all group"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#1d1d1f] shadow-xs mb-2">
              <Search className="h-5 w-5" />
            </div>
            <span className="text-xs font-medium text-[#1d1d1f]">Directory</span>
          </button>
        </div>
      </div>

      {/* 4. Class Sections Overview */}
      <div className="bg-white rounded-[18px] border border-[#e5e5ea] p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#f0f0f0]">
          <div>
            <h3 className="font-semibold text-[#1d1d1f] text-base">Class Sections & Enrolled Students</h3>
            <p className="text-xs text-[#86868b]">Grade breakdown and designated class teachers</p>
          </div>
          <button
            onClick={() => onNavigate('classes')}
            className="text-xs font-medium text-[#0066cc] hover:underline inline-flex items-center space-x-1"
          >
            <span>View All</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {db.classes.map(c => {
            const classStudents = db.students.filter(s => s.classId === c.id && s.status === 'active');
            const teacher = db.users.find(u => u.id === c.classTeacherId);
            return (
              <div
                key={c.id}
                onClick={() => onNavigate('students', { classId: c.id })}
                className="cursor-pointer bg-[#f5f5f7] rounded-2xl p-4 hover:bg-[#e5e5ea] transition-all"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-[#1d1d1f]">{c.name}</span>
                  <span className="bg-white px-2 py-0.5 rounded-full text-[11px] font-medium text-[#0066cc] shadow-xs">
                    Sec {c.section}
                  </span>
                </div>
                <div className="mt-3 flex items-baseline justify-between">
                  <span className="text-2xl font-semibold tracking-tight text-[#1d1d1f]">{classStudents.length}</span>
                  <span className="text-xs text-[#86868b]">Students</span>
                </div>
                <p className="mt-1 text-xs text-[#86868b] truncate">
                  Teacher: {teacher?.name || 'Unassigned'}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. Alerts & Action Queues Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Fee Audit Queue */}
        <div className="bg-white rounded-[18px] border border-[#e5e5ea] p-6 shadow-xs flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-[#f0f0f0]">
            <div className="flex items-center space-x-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#ff9500]/10 text-[#ff9500]">
                <CreditCard className="h-4 w-4" />
              </div>
              <div>
                <h4 className="font-semibold text-[#1d1d1f] text-sm">Fee Collection Queue</h4>
                <p className="text-xs text-[#ff3b30]">
                  {studentsWithDueFees.length} students with pending dues
                </p>
              </div>
            </div>
            <button
              onClick={() => onNavigate('fees')}
              className="text-xs font-medium text-[#0066cc] hover:underline inline-flex items-center space-x-1"
            >
              <span>View All</span>
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>

          <div className="mt-4 space-y-2.5 max-h-56 overflow-y-auto pr-1 flex-1">
            {studentsWithDueFees.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#30d158] bg-[#f5f5f7] rounded-xl font-medium">
                ✓ All student accounts are fully settled
              </div>
            ) : (
              studentsWithDueFees.slice(0, 4).map(fa => {
                const student = db.students.find(s => s.id === fa.studentId);
                return (
                  <div
                    key={fa.id}
                    className="flex items-center justify-between bg-[#f5f5f7] rounded-xl p-3 hover:bg-[#e5e5ea] transition-all"
                  >
                    <div className="flex items-center space-x-3">
                      <img
                        src={student?.photoUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${fa.studentName}`}
                        alt={fa.studentName}
                        className="h-9 w-9 rounded-full object-cover bg-white apple-product-shadow"
                      />
                      <div>
                        <p
                          onClick={() => onSelectStudent(fa.studentId)}
                          className="font-semibold text-xs text-[#1d1d1f] hover:text-[#0066cc] cursor-pointer"
                        >
                          {fa.studentName}
                        </p>
                        <p className="text-[11px] text-[#86868b]">
                          {fa.className} • Roll #{fa.rollNumber}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2.5">
                      <div className="text-right">
                        <p className="text-xs font-semibold text-[#ff3b30]">
                          ₹{(fa.dueAmount || 0).toLocaleString('en-IN')}
                        </p>
                        <span className="text-[10px] text-[#ff9500] font-medium">Due</span>
                      </div>

                      {student && (
                        <button
                          onClick={() => openWhatsAppFeeMessage(db.schoolInfo, student, fa)}
                          className="w-8 h-8 rounded-full bg-white text-[#30d158] hover:bg-[#30d158] hover:text-white flex items-center justify-center shadow-xs transition-colors"
                          title="WhatsApp Fee Notice"
                        >
                          <Phone className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Attendance Alert */}
        <div className="bg-white rounded-[18px] border border-[#e5e5ea] p-6 shadow-xs flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-[#f0f0f0]">
            <div className="flex items-center space-x-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#ff3b30]/10 text-[#ff3b30]">
                <AlertCircle className="h-4 w-4" />
              </div>
              <div>
                <h4 className="font-semibold text-[#1d1d1f] text-sm">Attendance Monitoring</h4>
                <p className="text-xs text-[#ff3b30]">
                  Students below 75% target threshold
                </p>
              </div>
            </div>
            <button
              onClick={() => onNavigate('attendance')}
              className="text-xs font-medium text-[#0066cc] hover:underline inline-flex items-center space-x-1"
            >
              <span>View Register</span>
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>

          <div className="mt-4 space-y-2.5 max-h-56 overflow-y-auto pr-1 flex-1">
            {lowAttendanceStudents.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#30d158] bg-[#f5f5f7] rounded-xl font-medium">
                ✓ All students meet the required attendance quota
              </div>
            ) : (
              lowAttendanceStudents.map(({ student, percentage, totalDays, presentDays }) => (
                <div
                  key={student.id}
                  className="flex items-center justify-between bg-[#f5f5f7] rounded-xl p-3 hover:bg-[#e5e5ea] transition-all"
                >
                  <div className="flex items-center space-x-3">
                    <img
                      src={student.photoUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${student.name}`}
                      alt={student.name}
                      className="h-9 w-9 rounded-full object-cover bg-white apple-product-shadow"
                    />
                    <div>
                      <p
                        onClick={() => onSelectStudent(student.id)}
                        className="font-semibold text-xs text-[#1d1d1f] hover:text-[#0066cc] cursor-pointer"
                      >
                        {student.name}
                      </p>
                      <p className="text-[11px] text-[#86868b]">
                        {student.className} • Roll #{student.rollNumber}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="bg-white px-2 py-0.5 rounded-full text-xs font-semibold text-[#ff3b30] shadow-xs">
                      {percentage.toFixed(0)}%
                    </span>
                    <p className="text-[10px] text-[#86868b] mt-0.5">
                      {presentDays}/{totalDays} Days
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 6. Recent Audit Trail */}
      <div className="bg-white rounded-[18px] border border-[#e5e5ea] p-6 shadow-xs">
        <div className="flex items-center justify-between mb-3 pb-3 border-b border-[#f0f0f0]">
          <div className="flex items-center space-x-2">
            <Clock className="h-4 w-4 text-[#0066cc]" />
            <h3 className="font-semibold text-[#1d1d1f] text-sm">System Activity & Audit Log</h3>
          </div>
          <button
            onClick={() => onNavigate('activity-logs')}
            className="text-xs font-medium text-[#0066cc] hover:underline"
          >
            View Full Log
          </button>
        </div>

        <div className="divide-y divide-[#f0f0f0]">
          {db.activityLogs.slice(0, 3).map(log => (
            <div key={log.id} className="py-3 flex items-start justify-between text-xs">
              <div>
                <span className="font-semibold text-[#1d1d1f]">{log.userName}</span>
                <p className="text-[#86868b] text-xs mt-0.5">{log.details}</p>
              </div>
              <span className="text-[11px] text-[#86868b] shrink-0 ml-3">
                {formatDate(log.timestamp.slice(0, 10))}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
