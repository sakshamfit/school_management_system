import React, { useState } from 'react';
import {
  X,
  GraduationCap,
  CalendarCheck,
  CreditCard,
  Award,
  Sparkles,
  History,
  Phone,
  Calendar,
  Mail,
  MapPin,
  FileText,
  Clock,
  PlusCircle,
  Share2,
  CheckCircle2,
  AlertCircle,
  Printer,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useSchool } from '../../context/SchoolContext';
import { Student, AttendanceStatus, StudentResult } from '../../types';
import { formatDate } from '../../utils/helpers';
import { openWhatsAppFeeMessage, openWhatsAppMarksheetMessage } from '../../utils/whatsapp';
import { PrintableMarksheetModal } from '../results/PrintableMarksheetModal';
import { AddResultModal } from '../results/AddResultModal';

interface StudentProfileModalProps {
  studentId: string | null;
  onClose: () => void;
  onOpenCollectFee?: (student: Student) => void;
  onOpenAddResult?: (student: Student) => void;
  onOpenAddPerformance?: (student: Student) => void;
  onOpenEditStudent?: (student: Student) => void;
}

export const StudentProfileModal: React.FC<StudentProfileModalProps> = ({
  studentId,
  onClose,
  onOpenCollectFee,
  onOpenAddResult,
  onOpenAddPerformance,
  onOpenEditStudent,
}) => {
  const { db } = useSchool();
  const [activeTab, setActiveTab] = useState<'overview' | 'attendance' | 'fees' | 'results' | 'performance' | 'history'>('overview');
  const [calendarMonth, setCalendarMonth] = useState<number>(new Date().getMonth()); // 0-11
  const [calendarYear, setCalendarYear] = useState<number>(new Date().getFullYear());
  const [viewingResult, setViewingResult] = useState<StudentResult | null>(null);
  const [showAddResultModal, setShowAddResultModal] = useState(false);

  if (!studentId) return null;

  const student = db.students.find(s => s.id === studentId);
  if (!student) return null;

  const feeAccount = db.feeAccounts.find(fa => fa.studentId === student.id) || {
    id: `fee_${student.id}`,
    studentId: student.id,
    studentName: student.name,
    rollNumber: student.rollNumber,
    classId: student.classId,
    className: student.className,
    totalFee: 24000,
    paidAmount: 0,
    dueAmount: 24000,
    status: 'due' as const,
  };

  const studentTransactions = db.feeTransactions.filter(t => t.studentId === student.id);
  const studentResults = db.results.filter(r => r.studentId === student.id);
  const studentPerformance = db.performance.filter(p => p.studentId === student.id);
  const studentAttendance = db.attendance.filter(a => a.studentId === student.id);

  // Attendance metrics
  const totalAttendanceRecorded = studentAttendance.length;
  const presentDays = studentAttendance.filter(a => a.status === 'present').length;
  const absentDays = studentAttendance.filter(a => a.status === 'absent').length;
  const attendancePct =
    totalAttendanceRecorded > 0
      ? ((presentDays / totalAttendanceRecorded) * 100).toFixed(1)
      : '100';

  // Calendar month generator
  const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(calendarYear, calendarMonth, 1).getDay(); // 0 is Sun

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-2 sm:p-4 backdrop-blur-sm animate-in fade-in overflow-y-auto">
      <div className="w-full max-w-3xl rounded-3xl bg-white shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Header Profile Summary */}
        <div className="relative bg-gradient-to-r from-orange-600 via-orange-500 to-amber-500 p-5 sm:p-6 text-white shrink-0">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 rounded-full bg-black/20 p-1.5 text-white hover:bg-black/40 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
            <img
              src={student.photoUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${student.name}`}
              alt={student.name}
              className="h-20 w-20 sm:h-24 sm:w-24 rounded-2xl object-cover border-4 border-white/90 shadow-lg shrink-0"
            />
            <div className="text-center sm:text-left flex-1">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <h3 className="text-xl sm:text-2xl font-black">{student.name}</h3>
                <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-extrabold backdrop-blur-sm">
                  Roll #{student.rollNumber}
                </span>
                {student.status === 'archived' && (
                  <span className="rounded-full bg-red-600/80 px-2.5 py-0.5 text-xs font-bold">
                    Archived
                  </span>
                )}
              </div>

              <p className="text-xs sm:text-sm text-orange-100 font-semibold mt-1">
                {student.className} • Admission No: {student.admissionNumber} • Academic Session: {student.academicYear}
              </p>

              <div className="mt-3 flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <button
                  onClick={() => {
                    if (studentResults.length > 0) {
                      setViewingResult(studentResults[0]);
                    } else {
                      setShowAddResultModal(true);
                    }
                  }}
                  className="inline-flex items-center space-x-1.5 rounded-xl bg-purple-600 px-3 py-1.5 text-xs font-extrabold text-white shadow-md hover:bg-purple-700 active:scale-95 transition-all"
                  title="Generate or view printable student report card"
                >
                  <Award className="h-3.5 w-3.5 text-amber-300" />
                  <span>Generate Marksheet</span>
                </button>

                {student.parentPhone && (
                  <button
                    onClick={() => openWhatsAppFeeMessage(db.schoolInfo, student, feeAccount)}
                    className="inline-flex items-center space-x-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-extrabold text-white shadow-md hover:bg-emerald-700 active:scale-95 transition-all"
                  >
                    <Phone className="h-3.5 w-3.5" />
                    <span>WhatsApp Parent</span>
                  </button>
                )}

                {onOpenCollectFee && (
                  <button
                    onClick={() => onOpenCollectFee(student)}
                    className="inline-flex items-center space-x-1.5 rounded-xl bg-white px-3 py-1.5 text-xs font-extrabold text-orange-700 shadow-md hover:bg-orange-50 active:scale-95 transition-all"
                  >
                    <CreditCard className="h-3.5 w-3.5" />
                    <span>Collect Fee</span>
                  </button>
                )}

                {onOpenEditStudent && (
                  <button
                    onClick={() => onOpenEditStudent(student)}
                    className="inline-flex items-center space-x-1.5 rounded-xl bg-orange-700/60 border border-white/30 px-3 py-1.5 text-xs font-bold text-white hover:bg-orange-700/80 transition-all"
                  >
                    <span>Edit Profile</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 6 Tabs Navigation Strip */}
          <div className="mt-5 flex items-center space-x-1 overflow-x-auto pb-1 scrollbar-none border-t border-white/20 pt-3">
            {[
              { id: 'overview', label: 'Overview', icon: GraduationCap },
              { id: 'attendance', label: 'Attendance', icon: CalendarCheck },
              { id: 'fees', label: 'Fees & Dues', icon: CreditCard },
              { id: 'results', label: 'Exam Results', icon: Award },
              { id: 'performance', label: 'Performance', icon: Sparkles },
              { id: 'history', label: 'Audit History', icon: History },
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex shrink-0 items-center space-x-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-white text-orange-700 shadow-sm'
                      : 'text-white/80 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Contents */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 bg-slate-50/50">
          {/* 1. OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                    Student Details
                  </h4>
                  <div className="space-y-2.5 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500">Full Name</span>
                      <span className="font-bold text-slate-800">{student.name}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500">Class & Roll</span>
                      <span className="font-bold text-slate-800">
                        {student.className} (Roll No: {student.rollNumber})
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500">Admission Number</span>
                      <span className="font-bold text-slate-800">{student.admissionNumber}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500">Admission Date</span>
                      <span className="font-bold text-slate-800">{formatDate(student.admissionDate)}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500">Gender / Age</span>
                      <span className="font-bold text-slate-800">
                        {student.gender || 'Not specified'} ({student.age || '—'} yrs)
                      </span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-500">Blood Group</span>
                      <span className="font-bold text-slate-800">{student.bloodGroup || 'O+'}</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                    Guardian & Address
                  </h4>
                  <div className="space-y-2.5 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500">Parent/Guardian</span>
                      <span className="font-bold text-slate-800">{student.parentName}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500">Phone Number</span>
                      <span className="font-bold text-slate-800">
                        {student.parentPhone || 'Not provided'}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500">Relation</span>
                      <span className="font-bold text-slate-800">{student.parentRelation || 'Parent'}</span>
                    </div>
                    <div className="py-1">
                      <span className="text-slate-500 block mb-1">Residential Address</span>
                      <span className="font-medium text-slate-800">
                        {student.address || 'Address not listed'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Academic Marksheet & Report Card Quick Card */}
              <div className="rounded-2xl border border-purple-200 bg-gradient-to-br from-purple-50 via-white to-indigo-50/40 p-4 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-purple-100">
                  <div className="flex items-center space-x-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-100 text-purple-700">
                      <Award className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-wider text-purple-900">
                        Academic Marksheet & Report Card
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        {studentResults.length > 0
                          ? `Latest Exam: ${studentResults[0].examName} (${studentResults[0].percentage}%)`
                          : 'No exam marks recorded yet for this session'}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {studentResults.length > 0 ? (
                      <>
                        <button
                          onClick={() => setViewingResult(studentResults[0])}
                          className="inline-flex items-center space-x-1.5 rounded-xl bg-purple-600 px-3 py-1.5 text-xs font-black text-white shadow-xs hover:bg-purple-700 active:scale-95 transition-all"
                        >
                          <Printer className="h-3.5 w-3.5" />
                          <span>View & Print Marksheet</span>
                        </button>

                        <button
                          onClick={() => openWhatsAppMarksheetMessage(db.schoolInfo, student, studentResults[0])}
                          className="inline-flex items-center space-x-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-black text-white shadow-xs hover:bg-emerald-700 active:scale-95 transition-all"
                        >
                          <Phone className="h-3.5 w-3.5" />
                          <span>Send via WhatsApp</span>
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setShowAddResultModal(true)}
                        className="inline-flex items-center space-x-1.5 rounded-xl bg-purple-600 px-3 py-1.5 text-xs font-black text-white shadow-xs hover:bg-purple-700 active:scale-95 transition-all"
                      >
                        <Award className="h-3.5 w-3.5 text-amber-300" />
                        <span>+ Generate First Marksheet</span>
                      </button>
                    )}
                  </div>
                </div>

                {studentResults.length > 0 && (
                  <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="rounded-xl bg-white p-2 border border-purple-100">
                      <span className="text-[10px] text-slate-400 block font-bold">Total Marks</span>
                      <span className="font-extrabold text-slate-900">
                        {studentResults[0].totalMarks} / {studentResults[0].totalMaxMarks}
                      </span>
                    </div>
                    <div className="rounded-xl bg-white p-2 border border-purple-100">
                      <span className="text-[10px] text-slate-400 block font-bold">Percentage</span>
                      <span className="font-extrabold text-purple-700">
                        {studentResults[0].percentage}%
                      </span>
                    </div>
                    <div className="rounded-xl bg-white p-2 border border-purple-100">
                      <span className="text-[10px] text-slate-400 block font-bold">Overall Grade</span>
                      <span className="font-extrabold text-orange-600">
                        Grade {studentResults[0].grade}
                      </span>
                    </div>
                    <div className="rounded-xl bg-white p-2 border border-purple-100">
                      <span className="text-[10px] text-slate-400 block font-bold">Status</span>
                      <span className="font-extrabold text-emerald-700">
                        {studentResults[0].percentage >= 33 ? 'Passed & Promoted' : 'Needs Review'}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {student.notes && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 text-xs">
                  <h5 className="font-bold text-amber-900 mb-1">Teacher & Administrative Notes:</h5>
                  <p className="text-amber-800 leading-relaxed">{student.notes}</p>
                </div>
              )}
            </div>
          )}

          {/* 2. ATTENDANCE TAB */}
          {activeTab === 'attendance' && (
            <div className="space-y-5">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-2xl bg-white p-3.5 border border-slate-200 text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Total School Days</span>
                  <p className="text-xl font-black text-slate-900 mt-1">{totalAttendanceRecorded}</p>
                </div>
                <div className="rounded-2xl bg-white p-3.5 border border-emerald-200 text-center">
                  <span className="text-[10px] uppercase font-bold text-emerald-600">Present</span>
                  <p className="text-xl font-black text-emerald-700 mt-1">{presentDays}</p>
                </div>
                <div className="rounded-2xl bg-white p-3.5 border border-rose-200 text-center">
                  <span className="text-[10px] uppercase font-bold text-rose-600">Absent</span>
                  <p className="text-xl font-black text-rose-700 mt-1">{absentDays}</p>
                </div>
                <div className="rounded-2xl bg-white p-3.5 border border-orange-200 text-center">
                  <span className="text-[10px] uppercase font-bold text-orange-600">Attendance Rate</span>
                  <p className="text-xl font-black text-orange-700 mt-1">{attendancePct}%</p>
                </div>
              </div>

              {/* Monthly Interactive Calendar */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
                  <h4 className="font-bold text-slate-800 text-xs sm:text-sm">
                    {monthNames[calendarMonth]} {calendarYear}
                  </h4>
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => {
                        if (calendarMonth === 0) {
                          setCalendarMonth(11);
                          setCalendarYear(y => y - 1);
                        } else {
                          setCalendarMonth(m => m - 1);
                        }
                      }}
                      className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => {
                        if (calendarMonth === 11) {
                          setCalendarMonth(0);
                          setCalendarYear(y => y + 1);
                        } else {
                          setCalendarMonth(m => m + 1);
                        }
                      }}
                      className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Day Headers */}
                <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-400 mb-1">
                  {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                    <div key={d} className="py-1">{d}</div>
                  ))}
                </div>

                {/* Day Grid */}
                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                    <div key={`empty_${i}`} className="h-9"></div>
                  ))}

                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const attRecord = studentAttendance.find(a => a.date === dateStr);
                    const status = attRecord?.status;

                    return (
                      <div
                        key={day}
                        className={`h-9 flex flex-col items-center justify-center rounded-xl text-xs font-bold transition-colors ${
                          status === 'present'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : status === 'absent'
                            ? 'bg-rose-100 text-rose-800 border border-rose-300'
                            : 'bg-slate-50 text-slate-400'
                        }`}
                        title={status ? `${dateStr}: ${status}` : 'No Record'}
                      >
                        <span>{day}</span>
                        {status && (
                          <span className="text-[8px] leading-none">
                            {status === 'present' ? '✓' : '✕'}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 flex items-center justify-center space-x-4 text-xs font-semibold">
                  <div className="flex items-center space-x-1.5">
                    <span className="h-3 w-3 rounded-full bg-emerald-500"></span>
                    <span className="text-slate-600">Present</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <span className="h-3 w-3 rounded-full bg-rose-500"></span>
                    <span className="text-slate-600">Absent</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <span className="h-3 w-3 rounded-full bg-slate-200"></span>
                    <span className="text-slate-400">No Record</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 3. FEES TAB */}
          {activeTab === 'fees' && (
            <div className="space-y-4">
              {/* Summary Card */}
              <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 p-4 sm:p-5 text-white">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase font-bold text-orange-400">Student Fee Account</span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-black uppercase ${
                      feeAccount.status === 'paid'
                        ? 'bg-emerald-500 text-white'
                        : feeAccount.status === 'partial'
                        ? 'bg-amber-500 text-white'
                        : 'bg-rose-500 text-white'
                    }`}
                  >
                    {feeAccount.status}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 text-center sm:text-left">
                  <div>
                    <span className="text-[10px] text-slate-400">Total Annual Fee</span>
                    <p className="text-base sm:text-lg font-black text-white">
                      ₹{(feeAccount.totalFee || 0).toLocaleString('en-IN')}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400">Paid to Date</span>
                    <p className="text-base sm:text-lg font-black text-emerald-400">
                      ₹{(feeAccount.paidAmount || 0).toLocaleString('en-IN')}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400">Outstanding Due</span>
                    <p className="text-base sm:text-lg font-black text-rose-400">
                      ₹{(feeAccount.dueAmount || 0).toLocaleString('en-IN')}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2 pt-3 border-t border-slate-700">
                  <button
                    onClick={() => openWhatsAppFeeMessage(db.schoolInfo, student, feeAccount)}
                    className="inline-flex items-center space-x-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition-all"
                  >
                    <Phone className="h-3.5 w-3.5" />
                    <span>Send WhatsApp Fee Notice</span>
                  </button>

                  {onOpenCollectFee && (
                    <button
                      onClick={() => onOpenCollectFee(student)}
                      className="inline-flex items-center space-x-1.5 rounded-xl bg-orange-600 px-4 py-2 text-xs font-bold text-white hover:bg-orange-700 transition-all"
                    >
                      <CreditCard className="h-3.5 w-3.5" />
                      <span>Record Payment</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Transactions Ledger */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
                <h4 className="font-bold text-slate-800 text-xs sm:text-sm mb-3">
                  Payment History & Receipts
                </h4>

                {studentTransactions.length === 0 ? (
                  <p className="py-4 text-center text-xs text-slate-400">
                    No payment transactions recorded yet.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {studentTransactions.map(tx => (
                      <div key={tx.id} className="py-2.5 flex items-center justify-between text-xs">
                        <div>
                          <p className="font-bold text-slate-800">
                            ₹{tx.amount.toLocaleString('en-IN')} via {tx.paymentMethod}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            Receipt: <span className="font-mono">{tx.receiptNumber}</span> • {formatDate(tx.paymentDate)}
                          </p>
                          {tx.notes && <p className="text-[10px] text-slate-400 mt-0.5">{tx.notes}</p>}
                        </div>
                        <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                          Paid
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 4. RESULTS TAB */}
          {activeTab === 'results' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-800 text-xs sm:text-sm">
                  Academic Results & Marksheets
                </h4>
                <button
                  onClick={() => setShowAddResultModal(true)}
                  className="inline-flex items-center space-x-1.5 rounded-xl bg-purple-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-purple-700 shadow-xs active:scale-95 transition-all"
                >
                  <Award className="h-3.5 w-3.5 text-amber-300" />
                  <span>+ Generate / Add Marksheet</span>
                </button>
              </div>

              {studentResults.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-xs text-slate-400">
                  No exam results published for this student yet.
                </div>
              ) : (
                studentResults.map(res => (
                  <div
                    key={res.id}
                    className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-3"
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <div>
                        <h5 className="font-extrabold text-sm text-slate-900">{res.examName}</h5>
                        <p className="text-[11px] text-slate-500">Session: {res.academicYear}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => setViewingResult(res)}
                          className="inline-flex items-center space-x-1 rounded-lg bg-orange-50 px-2 py-1 text-xs font-bold text-orange-700 hover:bg-orange-100 border border-orange-200/60"
                        >
                          <Printer className="h-3.5 w-3.5" />
                          <span>Print Marksheet</span>
                        </button>

                        <button
                          onClick={() => openWhatsAppMarksheetMessage(db.schoolInfo, student, res)}
                          className="inline-flex items-center space-x-1 rounded-lg bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700 hover:bg-emerald-100 border border-emerald-200/60"
                        >
                          <Phone className="h-3.5 w-3.5" />
                          <span>WhatsApp</span>
                        </button>

                        <div className="text-right pl-2">
                          <span className="rounded-lg bg-orange-100 px-2.5 py-1 text-xs font-black text-orange-800">
                            Grade {res.grade} ({res.percentage}%)
                          </span>
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            {res.totalMarks}/{res.totalMaxMarks} Total
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {res.subjects.map(s => (
                        <div key={s.subject} className="rounded-xl bg-slate-50 p-2 text-xs">
                          <span className="text-slate-500 block truncate">{s.subject}</span>
                          <span className="font-bold text-slate-900">
                            {s.obtainedMarks}/{s.maxMarks}
                          </span>
                          <span className="ml-1 text-[10px] font-bold text-orange-600">({s.grade})</span>
                        </div>
                      ))}
                    </div>

                    {res.remarks && (
                      <p className="text-[11px] text-slate-600 bg-orange-50/50 p-2 rounded-xl border border-orange-100">
                        <strong>Teacher Remark:</strong> {res.remarks}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* 5. PERFORMANCE TAB */}
          {activeTab === 'performance' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-800 text-xs sm:text-sm">
                  Teacher Behavioral & Academic Feedback
                </h4>
                {onOpenAddPerformance && (
                  <button
                    onClick={() => onOpenAddPerformance(student)}
                    className="inline-flex items-center space-x-1.5 rounded-xl bg-purple-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-purple-700"
                  >
                    <PlusCircle className="h-3.5 w-3.5" />
                    <span>+ Add Note</span>
                  </button>
                )}
              </div>

              {studentPerformance.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-xs text-slate-400">
                  No performance records logged yet.
                </div>
              ) : (
                studentPerformance.map(p => (
                  <div
                    key={p.id}
                    className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="rounded-md bg-purple-100 px-2 py-0.5 text-[10px] font-extrabold uppercase text-purple-800">
                          {p.category}
                        </span>
                        <span className="text-slate-400 text-[11px]">{formatDate(p.date)}</span>
                      </div>
                      <span className="font-bold text-purple-900 capitalize">
                        Rating: {p.rating.replace('_', ' ')}
                      </span>
                    </div>

                    <p className="font-semibold text-slate-800 text-sm leading-relaxed">
                      "{p.remarks}"
                    </p>

                    {p.strengths && (
                      <p className="text-emerald-700">
                        <strong>🌟 Strengths:</strong> {p.strengths}
                      </p>
                    )}
                    {p.areasToImprove && (
                      <p className="text-amber-700">
                        <strong>🎯 Areas to Focus:</strong> {p.areasToImprove}
                      </p>
                    )}
                    <p className="text-[10px] text-slate-400">Logged by: {p.teacherName}</p>
                  </div>
                ))
              )}
            </div>
          )}

          {/* 6. HISTORY TAB */}
          {activeTab === 'history' && (
            <div className="space-y-3">
              <h4 className="font-bold text-slate-800 text-xs sm:text-sm mb-2">
                Student Life Cycle & Audit Trail
              </h4>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3 text-xs">
                <div className="flex items-start space-x-3">
                  <div className="h-2 w-2 rounded-full bg-emerald-500 mt-1.5"></div>
                  <div>
                    <p className="font-bold text-slate-800">Admitted to {student.className}</p>
                    <p className="text-slate-500 text-[11px]">
                      Date: {formatDate(student.admissionDate)} • Admission No: {student.admissionNumber}
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <div className="h-2 w-2 rounded-full bg-orange-500 mt-1.5"></div>
                  <div>
                    <p className="font-bold text-slate-800">Enrolled in Academic Session {student.academicYear}</p>
                    <p className="text-slate-500 text-[11px]">Assigned Roll Number #{student.rollNumber}</p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <div className="h-2 w-2 rounded-full bg-blue-500 mt-1.5"></div>
                  <div>
                    <p className="font-bold text-slate-800">Permanent Record Security</p>
                    <p className="text-slate-500 text-[11px]">
                      Historical records safely retained in cloud school database. Soft archive enabled.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {viewingResult && (
        <PrintableMarksheetModal
          isOpen={!!viewingResult}
          onClose={() => setViewingResult(null)}
          result={viewingResult}
          student={student}
        />
      )}

      {showAddResultModal && (
        <AddResultModal
          isOpen={showAddResultModal}
          onClose={() => setShowAddResultModal(false)}
          student={student}
          initialClassId={student.classId}
          onSaved={(newRes) => {
            setShowAddResultModal(false);
            setViewingResult(newRes);
          }}
        />
      )}
    </div>
  );
};
