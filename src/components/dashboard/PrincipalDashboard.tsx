import React from 'react';
import {
  Users,
  GraduationCap,
  CalendarCheck,
  CreditCard,
  UserCheck,
  TrendingUp,
  AlertCircle,
  PlusCircle,
  Search,
  BookOpen,
  Award,
  BarChart3,
  ArrowRight,
  Sparkles,
  Phone,
  Clock,
  CheckCircle2,
  XCircle,
  ShieldCheck,
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
  const totalSchoolFeeBilled = db.feeAccounts.reduce((acc, curr) => acc + (curr.totalFee || 0), 0);
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
    <div className="space-y-4 sm:space-y-5 pb-10">
      {/* Compact Welcome Hero Banner */}
      <div className="rounded-2xl sm:rounded-3xl bg-[#F27D26] p-4 sm:p-5 text-white shadow-md shadow-orange-500/15 border border-white/30 backdrop-blur-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center space-x-2 rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-semibold backdrop-blur-sm border border-white/30">
              <span>🏫 Central Console</span>
              <span>•</span>
              <span>{formatDate(todayStr)}</span>
            </div>
            <h2 className="mt-1 text-xl sm:text-2xl font-black tracking-tight text-white">
              Welcome, {currentUser?.name || 'Principal'}!
            </h2>
            <p className="text-xs text-orange-100 mt-0.5">
              Live school status: {totalStudents} Students • {totalTeachers} Faculty • Session {db.schoolInfo.currentAcademicYear}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={onOpenAddStudent}
              className="inline-flex items-center space-x-1.5 rounded-xl bg-white px-3.5 py-2 text-xs font-bold text-[#F27D26] shadow-sm hover:bg-orange-50 active:scale-95 transition-all"
            >
              <PlusCircle className="h-3.5 w-3.5" />
              <span>+ Student</span>
            </button>
            <button
              onClick={onOpenAddTeacher}
              className="inline-flex items-center space-x-1.5 rounded-xl bg-white/20 border border-white/40 px-3.5 py-2 text-xs font-bold text-white hover:bg-white/30 active:scale-95 transition-all backdrop-blur-sm"
            >
              <Users className="h-3.5 w-3.5" />
              <span>+ Teacher</span>
            </button>
          </div>
        </div>
      </div>

      {/* Compact Live Statistics Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Students */}
        <div
          onClick={() => onNavigate('students')}
          className="cursor-pointer bg-white/70 backdrop-blur-md p-3.5 sm:p-4 rounded-2xl border border-white/60 shadow-xs hover:bg-white hover:scale-[1.01] transition-all group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#1A2B48]/60">Total Students</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-100 text-[#F27D26]">
              <GraduationCap className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-black text-[#1A2B48]">{totalStudents}</span>
            <span className="text-[11px] font-bold text-emerald-600">Active</span>
          </div>
          <p className="text-[10px] text-[#1A2B48]/50 mt-1 font-medium">Across {db.classes.length} school classes</p>
        </div>

        {/* Live Attendance */}
        <div
          onClick={() => onNavigate('attendance')}
          className="cursor-pointer bg-white/70 backdrop-blur-md p-3.5 sm:p-4 rounded-2xl border border-white/60 shadow-xs hover:bg-white hover:scale-[1.01] transition-all group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#1A2B48]/60">Student Attendance</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
              <CalendarCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-black text-[#1A2B48]">
              {todayAttendance.length > 0 ? `${attendancePercentage}%` : `${presentStudentsCount}`}
            </span>
            <span className="text-[11px] font-bold text-emerald-600">
              {todayAttendance.length > 0 ? `${presentStudentsCount} Present` : 'Today'}
            </span>
          </div>
          <p className="text-[10px] text-[#1A2B48]/50 mt-1 font-medium">
            {todayAttendance.length > 0 ? `${absentStudentsCount} Marked Absent` : '1-tap class marking'}
          </p>
        </div>

        {/* Teachers Today */}
        <div
          onClick={() => onNavigate('teachers')}
          className="cursor-pointer bg-white/70 backdrop-blur-md p-3.5 sm:p-4 rounded-2xl border border-white/60 shadow-xs hover:bg-white hover:scale-[1.01] transition-all group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#1A2B48]/60">Faculty Present</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-black text-[#1A2B48]">{teachersPresent}</span>
            <span className="text-[11px] font-bold text-orange-500">/ {totalTeachers}</span>
          </div>
          <p className="text-[10px] text-[#1A2B48]/50 mt-1 font-medium">Auto-recorded on entry</p>
        </div>

        {/* Fees Collected */}
        <div
          onClick={() => onNavigate('fees')}
          className="cursor-pointer bg-[#1A2B48] p-3.5 sm:p-4 rounded-2xl shadow-md text-white border border-white/20 hover:scale-[1.01] transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider opacity-70">Fees Collected</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/20 text-orange-300">
              <CreditCard className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-black text-white">
              ₹{totalFeesCollected.toLocaleString('en-IN')}
            </span>
          </div>
          <p className="text-[10px] text-orange-200 mt-1 font-medium">
            Pending: ₹{totalFeesPending.toLocaleString('en-IN')}
          </p>
        </div>
      </div>

      {/* Compact Quick Actions & Operations */}
      <div className="bg-white/60 backdrop-blur-sm border border-white/60 rounded-2xl p-4 sm:p-4.5 shadow-xs">
        <h3 className="text-[11px] font-black uppercase tracking-wider text-[#1A2B48]/50 mb-2.5">
          Quick Operations Hub
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 sm:gap-2.5">
          <button
            onClick={() => onNavigate('attendance')}
            className="flex flex-col items-center justify-center rounded-xl bg-white/80 border border-white/80 p-2.5 text-center hover:bg-white transition-all shadow-2xs hover:scale-105 active:scale-95 group"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F27D26] text-white shadow-xs group-hover:scale-110 transition-transform">
              <CalendarCheck className="h-4 w-4" />
            </div>
            <span className="mt-1.5 text-xs font-bold text-[#1A2B48]">Attendance</span>
          </button>

          <button
            onClick={onOpenAddStudent}
            className="flex flex-col items-center justify-center rounded-xl bg-white/80 border border-white/80 p-2.5 text-center hover:bg-white transition-all shadow-2xs hover:scale-105 active:scale-95 group"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500 text-white shadow-xs group-hover:scale-110 transition-transform">
              <GraduationCap className="h-4 w-4" />
            </div>
            <span className="mt-1.5 text-xs font-bold text-[#1A2B48]">Add Student</span>
          </button>

          <button
            onClick={onOpenAddTeacher}
            className="flex flex-col items-center justify-center rounded-xl bg-white/80 border border-white/80 p-2.5 text-center hover:bg-white transition-all shadow-2xs hover:scale-105 active:scale-95 group"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white shadow-xs group-hover:scale-110 transition-transform">
              <Users className="h-4 w-4" />
            </div>
            <span className="mt-1.5 text-xs font-bold text-[#1A2B48]">Add Teacher</span>
          </button>

          <button
            onClick={() => onNavigate('fees')}
            className="flex flex-col items-center justify-center rounded-xl bg-white/80 border border-white/80 p-2.5 text-center hover:bg-white transition-all shadow-2xs hover:scale-105 active:scale-95 group"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-xs group-hover:scale-110 transition-transform">
              <CreditCard className="h-4 w-4" />
            </div>
            <span className="mt-1.5 text-xs font-bold text-[#1A2B48]">Fees & Due</span>
          </button>

          <button
            onClick={() => onNavigate('results')}
            className="flex flex-col items-center justify-center rounded-xl bg-white/80 border border-white/80 p-2.5 text-center hover:bg-white transition-all shadow-2xs hover:scale-105 active:scale-95 group"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-600 text-white shadow-xs group-hover:scale-110 transition-transform">
              <Award className="h-4 w-4" />
            </div>
            <span className="mt-1.5 text-xs font-bold text-[#1A2B48]">Exam Marks</span>
          </button>

          <button
            onClick={() => onNavigate('reports')}
            className="flex flex-col items-center justify-center rounded-xl bg-white/80 border border-white/80 p-2.5 text-center hover:bg-white transition-all shadow-2xs hover:scale-105 active:scale-95 group"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-600 text-white shadow-xs group-hover:scale-110 transition-transform">
              <BarChart3 className="h-4 w-4" />
            </div>
            <span className="mt-1.5 text-xs font-bold text-[#1A2B48]">Reports</span>
          </button>

          <button
            onClick={onOpenQuickSearch}
            className="flex flex-col items-center justify-center rounded-xl bg-white/80 border border-white/80 p-2.5 text-center hover:bg-white transition-all shadow-2xs hover:scale-105 active:scale-95 group"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-700 text-white shadow-xs group-hover:scale-110 transition-transform">
              <Search className="h-4 w-4" />
            </div>
            <span className="mt-1.5 text-xs font-bold text-[#1A2B48]">Search</span>
          </button>
        </div>
      </div>

      {/* Class Overview Roster Cards */}
      <div className="bg-white/60 backdrop-blur-sm border border-white/60 rounded-2xl p-4 sm:p-5 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-black text-[#1A2B48] text-sm sm:text-base">Classes & Roster</h3>
            <p className="text-[11px] text-[#1A2B48]/60">Breakdown of grades and assigned teachers</p>
          </div>
          <button
            onClick={() => onNavigate('classes')}
            className="text-xs font-bold text-[#F27D26] hover:underline inline-flex items-center space-x-1"
          >
            <span>Manage Classes</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
          {db.classes.map(c => {
            const classStudents = db.students.filter(s => s.classId === c.id && s.status === 'active');
            const teacher = db.users.find(u => u.id === c.classTeacherId);
            return (
              <div
                key={c.id}
                onClick={() => onNavigate('students', { classId: c.id })}
                className="cursor-pointer rounded-xl border border-white/80 bg-white/70 p-3 hover:border-orange-300 hover:bg-white transition-all shadow-2xs"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-[#1A2B48]">{c.name}</span>
                  <span className="rounded-full bg-orange-100 px-2 py-0.2 text-[9px] font-bold text-[#F27D26]">
                    Sec {c.section}
                  </span>
                </div>
                <div className="mt-1.5 flex items-baseline justify-between">
                  <span className="text-lg font-black text-[#1A2B48]">{classStudents.length}</span>
                  <span className="text-[10px] text-[#1A2B48]/60 font-semibold">Students</span>
                </div>
                <p className="mt-0.5 text-[10px] text-[#1A2B48]/70 truncate font-medium">
                  👩‍🏫 {teacher?.name || 'No teacher assigned'}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Critical Alert Cards Grid (Pending Fees & Low Attendance) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Fee Alert Card */}
        <div className="bg-white/60 backdrop-blur-sm border border-white/60 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col">
          <div className="flex items-center justify-between pb-2.5 border-b border-black/5">
            <div className="flex items-center space-x-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500 text-white shadow-xs">
                <CreditCard className="h-3.5 w-3.5" />
              </div>
              <div>
                <h4 className="font-black text-[#1A2B48] text-xs sm:text-sm">Fee Collection Status</h4>
                <p className="text-[10px] text-amber-700 font-bold">
                  {studentsWithDueFees.length} students have pending dues
                </p>
              </div>
            </div>
            <button
              onClick={() => onNavigate('fees')}
              className="text-xs font-bold text-[#F27D26] hover:underline inline-flex items-center space-x-1"
            >
              <span>View All</span>
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>

          <div className="mt-2.5 space-y-2 max-h-48 overflow-y-auto pr-1 flex-1">
            {studentsWithDueFees.length === 0 ? (
              <div className="py-5 text-center text-xs text-emerald-700 bg-emerald-50/70 rounded-xl font-bold border border-emerald-100">
                ✓ No pending fee dues recorded.
              </div>
            ) : (
              studentsWithDueFees.slice(0, 4).map(fa => {
                const student = db.students.find(s => s.id === fa.studentId);
                return (
                  <div
                    key={fa.id}
                    className="flex items-center justify-between rounded-xl bg-white/70 border border-white/80 p-2.5 shadow-2xs hover:bg-white transition-all"
                  >
                    <div className="flex items-center space-x-2.5">
                      <img
                        src={student?.photoUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${fa.studentName}`}
                        alt={fa.studentName}
                        className="h-7 w-7 rounded-lg object-cover border border-amber-200"
                      />
                      <div>
                        <p
                          onClick={() => onSelectStudent(fa.studentId)}
                          className="font-bold text-xs text-[#1A2B48] hover:text-[#F27D26] cursor-pointer"
                        >
                          {fa.studentName}
                        </p>
                        <p className="text-[10px] text-[#1A2B48]/50">
                          {fa.className} • Roll: {fa.rollNumber}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <div className="text-right">
                        <p className="text-xs font-black text-rose-600">
                          ₹{(fa.dueAmount || 0).toLocaleString('en-IN')}
                        </p>
                        <span className="text-[9px] font-bold text-amber-700 bg-amber-100 px-1 py-0.2 rounded">
                          Due
                        </span>
                      </div>

                      {student && (
                        <button
                          onClick={() => openWhatsAppFeeMessage(db.schoolInfo, student, fa)}
                          className="rounded-lg bg-emerald-500 p-1.5 text-white shadow-xs hover:bg-emerald-600"
                          title="WhatsApp Fee Notice"
                        >
                          <Phone className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Low Attendance Alert */}
        <div className="bg-white/60 backdrop-blur-sm border border-white/60 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col">
          <div className="flex items-center justify-between pb-2.5 border-b border-black/5">
            <div className="flex items-center space-x-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-500 text-white shadow-xs">
                <AlertCircle className="h-3.5 w-3.5" />
              </div>
              <div>
                <h4 className="font-black text-[#1A2B48] text-xs sm:text-sm">Attendance Watchlist</h4>
                <p className="text-[10px] text-rose-700 font-bold">
                  Students below 75% attendance threshold
                </p>
              </div>
            </div>
            <button
              onClick={() => onNavigate('attendance')}
              className="text-xs font-bold text-[#F27D26] hover:underline inline-flex items-center space-x-1"
            >
              <span>Attendance Hub</span>
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>

          <div className="mt-2.5 space-y-2 max-h-48 overflow-y-auto pr-1 flex-1">
            {lowAttendanceStudents.length === 0 ? (
              <div className="py-5 text-center text-xs text-emerald-700 bg-emerald-50/70 rounded-xl font-bold border border-emerald-100">
                ✓ All students maintain regular attendance records.
              </div>
            ) : (
              lowAttendanceStudents.map(({ student, percentage, totalDays, presentDays }) => (
                <div
                  key={student.id}
                  className="flex items-center justify-between rounded-xl bg-white/70 border border-white/80 p-2.5 shadow-2xs hover:bg-white transition-all"
                >
                  <div className="flex items-center space-x-2.5">
                    <img
                      src={student.photoUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${student.name}`}
                      alt={student.name}
                      className="h-7 w-7 rounded-lg object-cover border border-rose-200"
                    />
                    <div>
                      <p
                        onClick={() => onSelectStudent(student.id)}
                        className="font-bold text-xs text-[#1A2B48] hover:text-[#F27D26] cursor-pointer"
                      >
                        {student.name}
                      </p>
                      <p className="text-[10px] text-[#1A2B48]/50">
                        {student.className} • Roll: {student.rollNumber}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="rounded-lg bg-rose-100 px-2 py-0.5 text-xs font-black text-rose-700">
                      {percentage.toFixed(0)}%
                    </span>
                    <p className="text-[10px] text-[#1A2B48]/50 mt-0.5">
                      {presentDays}/{totalDays} Days
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Recent School Activity Trail */}
      <div className="bg-white/60 backdrop-blur-sm border border-white/60 rounded-2xl p-4 sm:p-5 shadow-xs">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center space-x-2">
            <Clock className="h-4 w-4 text-[#F27D26]" />
            <h3 className="font-black text-[#1A2B48] text-sm sm:text-base">Recent Activity Trail</h3>
          </div>
          <button
            onClick={() => onNavigate('activity-logs')}
            className="text-xs font-bold text-[#F27D26] hover:underline"
          >
            Audit Log
          </button>
        </div>

        <div className="divide-y divide-black/5">
          {db.activityLogs.slice(0, 3).map(log => (
            <div key={log.id} className="py-2 flex items-start justify-between text-xs">
              <div>
                <span className="font-bold text-[#1A2B48]">{log.userName}</span>
                <p className="text-[#1A2B48]/70 text-[11px] mt-0.5">{log.details}</p>
              </div>
              <span className="text-[10px] text-[#1A2B48]/50 shrink-0 ml-3 font-semibold">
                {formatDate(log.timestamp.slice(0, 10))}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
