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
  Printer,
  ChevronLeft,
  ChevronRight,
  PlusCircle,
} from 'lucide-react';
import { useSchool } from '../../context/SchoolContext';
import { Student, StudentResult } from '../../types';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-2 sm:p-4 backdrop-blur-sm animate-in fade-in overflow-y-auto">
      <div className="w-full max-w-3xl bg-white rounded-[20px] border border-[#e5e5ea] shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col text-[#1d1d1f]">
        {/* Header Profile Summary */}
        <div className="relative bg-white p-6 border-b border-[#f0f0f0] shrink-0">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 w-8 h-8 rounded-full bg-[#f5f5f7] text-[#86868b] hover:text-[#1d1d1f] flex items-center justify-center transition-colors"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
            <img
              src={student.photoUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${student.name}`}
              alt={student.name}
              className="h-20 w-20 sm:h-24 sm:w-24 rounded-full object-cover bg-white apple-product-shadow shrink-0"
            />
            <div className="text-center sm:text-left flex-1">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <h3 className="text-xl font-semibold tracking-[-0.022em] text-[#1d1d1f]">{student.name}</h3>
                <span className="bg-[#f5f5f7] px-2.5 py-0.5 rounded-full text-xs font-semibold text-[#0066cc]">
                  Roll #{student.rollNumber}
                </span>
                {student.status === 'archived' && (
                  <span className="bg-[#ff3b30]/10 text-[#ff3b30] px-2.5 py-0.5 rounded-full text-xs font-semibold">
                    Archived
                  </span>
                )}
              </div>

              <p className="text-xs text-[#86868b] mt-1">
                {student.className} • Adm No: {student.admissionNumber} • Session: {student.academicYear}
              </p>

              <div className="mt-4 flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <button
                  onClick={() => {
                    if (studentResults.length > 0) {
                      setViewingResult(studentResults[0]);
                    } else {
                      setShowAddResultModal(true);
                    }
                  }}
                  className="apple-btn-primary py-1.5 px-3.5 text-xs"
                >
                  <Award className="h-3.5 w-3.5 mr-1.5" />
                  <span>Generate Marksheet</span>
                </button>

                {student.parentPhone && (
                  <button
                    onClick={() => openWhatsAppFeeMessage(db.schoolInfo, student, feeAccount)}
                    className="apple-btn-secondary py-1.5 px-3 text-xs text-[#30d158]"
                  >
                    <Phone className="h-3.5 w-3.5 mr-1.5" />
                    <span>WhatsApp Parent</span>
                  </button>
                )}

                {onOpenCollectFee && (
                  <button
                    onClick={() => onOpenCollectFee(student)}
                    className="apple-btn-secondary py-1.5 px-3 text-xs"
                  >
                    <CreditCard className="h-3.5 w-3.5 mr-1.5" />
                    <span>Collect Fee</span>
                  </button>
                )}

                {onOpenEditStudent && (
                  <button
                    onClick={() => onOpenEditStudent(student)}
                    className="apple-btn-secondary py-1.5 px-3 text-xs"
                  >
                    <span>Edit</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 6 Tabs Navigation Strip */}
          <div className="mt-6 flex items-center space-x-1.5 overflow-x-auto pb-1 scrollbar-none border-t border-[#f0f0f0] pt-3">
            {[
              { id: 'overview', label: 'Overview', icon: GraduationCap },
              { id: 'attendance', label: 'Attendance', icon: CalendarCheck },
              { id: 'fees', label: 'Fees & Dues', icon: CreditCard },
              { id: 'results', label: 'Exam Results', icon: Award },
              { id: 'performance', label: 'Performance', icon: Sparkles },
              { id: 'history', label: 'Audit Trail', icon: History },
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex shrink-0 items-center space-x-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-[#1d1d1f] text-white shadow-xs'
                      : 'bg-[#f5f5f7] text-[#86868b] hover:text-[#1d1d1f]'
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
        <div className="flex-1 overflow-y-auto p-6 bg-[#f5f5f7] space-y-4">
          {/* 1. OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-white rounded-2xl border border-[#e5e5ea] p-4 shadow-xs">
                  <h4 className="text-xs font-semibold text-[#86868b] uppercase tracking-wider mb-3">
                    Student Details
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1.5 border-b border-[#f0f0f0]">
                      <span className="text-[#86868b]">Full Name</span>
                      <span className="font-semibold text-[#1d1d1f]">{student.name}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-[#f0f0f0]">
                      <span className="text-[#86868b]">Class & Roll</span>
                      <span className="font-semibold text-[#1d1d1f]">
                        {student.className} (Roll #{student.rollNumber})
                      </span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-[#f0f0f0]">
                      <span className="text-[#86868b]">Admission No</span>
                      <span className="font-semibold text-[#1d1d1f]">{student.admissionNumber}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-[#f0f0f0]">
                      <span className="text-[#86868b]">Admission Date</span>
                      <span className="font-semibold text-[#1d1d1f]">{formatDate(student.admissionDate)}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-[#f0f0f0]">
                      <span className="text-[#86868b]">Gender / Age</span>
                      <span className="font-semibold text-[#1d1d1f]">
                        {student.gender || 'Not specified'} ({student.age || '—'} yrs)
                      </span>
                    </div>
                    <div className="flex justify-between py-1.5">
                      <span className="text-[#86868b]">Blood Group</span>
                      <span className="font-semibold text-[#0066cc]">{student.bloodGroup || 'O+'}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-[#e5e5ea] p-4 shadow-xs">
                  <h4 className="text-xs font-semibold text-[#86868b] uppercase tracking-wider mb-3">
                    Guardian & Address
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1.5 border-b border-[#f0f0f0]">
                      <span className="text-[#86868b]">Guardian</span>
                      <span className="font-semibold text-[#1d1d1f]">{student.parentName}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-[#f0f0f0]">
                      <span className="text-[#86868b]">Phone Number</span>
                      <span className="font-semibold text-[#1d1d1f]">
                        {student.parentPhone || 'Not provided'}
                      </span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-[#f0f0f0]">
                      <span className="text-[#86868b]">Relation</span>
                      <span className="font-semibold text-[#1d1d1f]">{student.parentRelation || 'Parent'}</span>
                    </div>
                    <div className="py-1.5">
                      <span className="text-[#86868b] block mb-1">Address</span>
                      <span className="text-[#1d1d1f]">
                        {student.address || 'Address not listed'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Academic Marksheet Quick Card */}
              <div className="bg-white rounded-2xl border border-[#e5e5ea] p-5 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#f0f0f0]">
                  <div className="flex items-center space-x-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#af52de]/10 text-[#af52de]">
                      <Award className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm text-[#1d1d1f]">
                        Academic Marksheet & Report Card
                      </h4>
                      <p className="text-xs text-[#86868b]">
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
                          className="apple-btn-secondary py-1.5 px-3 text-xs"
                        >
                          <Printer className="h-3.5 w-3.5 mr-1.5" />
                          <span>Print</span>
                        </button>

                        <button
                          onClick={() => openWhatsAppMarksheetMessage(db.schoolInfo, student, studentResults[0])}
                          className="apple-btn-secondary py-1.5 px-3 text-xs text-[#30d158]"
                        >
                          <Phone className="h-3.5 w-3.5 mr-1.5" />
                          <span>WhatsApp</span>
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setShowAddResultModal(true)}
                        className="apple-btn-primary py-1.5 px-3.5 text-xs"
                      >
                        <Award className="h-3.5 w-3.5 mr-1.5" />
                        <span>+ Generate Marksheet</span>
                      </button>
                    )}
                  </div>
                </div>

                {studentResults.length > 0 && (
                  <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="bg-[#f5f5f7] p-3 rounded-xl">
                      <span className="text-[11px] text-[#86868b] block">Total Marks</span>
                      <span className="font-semibold text-[#1d1d1f] mt-0.5 block">
                        {studentResults[0].totalMarks} / {studentResults[0].totalMaxMarks}
                      </span>
                    </div>
                    <div className="bg-[#f5f5f7] p-3 rounded-xl">
                      <span className="text-[11px] text-[#86868b] block">Percentage</span>
                      <span className="font-semibold text-[#0066cc] mt-0.5 block">
                        {studentResults[0].percentage}%
                      </span>
                    </div>
                    <div className="bg-[#f5f5f7] p-3 rounded-xl">
                      <span className="text-[11px] text-[#86868b] block">Grade</span>
                      <span className="font-semibold text-[#1d1d1f] mt-0.5 block">
                        Grade {studentResults[0].grade}
                      </span>
                    </div>
                    <div className="bg-[#f5f5f7] p-3 rounded-xl">
                      <span className="text-[11px] text-[#86868b] block">Status</span>
                      <span className={`font-semibold mt-0.5 block ${studentResults[0].percentage >= 33 ? 'text-[#30d158]' : 'text-[#ff3b30]'}`}>
                        {studentResults[0].percentage >= 33 ? 'Passed' : 'Needs Review'}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {student.notes && (
                <div className="bg-white rounded-2xl border border-[#e5e5ea] p-4 text-xs shadow-xs">
                  <h5 className="font-semibold text-[#1d1d1f] mb-1">Notes & Remarks:</h5>
                  <p className="text-[#86868b] leading-relaxed">{student.notes}</p>
                </div>
              )}
            </div>
          )}

          {/* 2. ATTENDANCE TAB */}
          {activeTab === 'attendance' && (
            <div className="space-y-4">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white p-4 rounded-2xl border border-[#e5e5ea] text-center shadow-xs">
                  <span className="text-xs text-[#86868b]">Total Days</span>
                  <p className="text-xl font-semibold text-[#1d1d1f] mt-1">{totalAttendanceRecorded}</p>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-[#e5e5ea] text-center shadow-xs">
                  <span className="text-xs text-[#30d158]">Present</span>
                  <p className="text-xl font-semibold text-[#30d158] mt-1">{presentDays}</p>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-[#e5e5ea] text-center shadow-xs">
                  <span className="text-xs text-[#ff3b30]">Absent</span>
                  <p className="text-xl font-semibold text-[#ff3b30] mt-1">{absentDays}</p>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-[#e5e5ea] text-center shadow-xs">
                  <span className="text-xs text-[#0066cc]">Attendance Rate</span>
                  <p className="text-xl font-semibold text-[#0066cc] mt-1">{attendancePct}%</p>
                </div>
              </div>

              {/* Monthly Interactive Calendar */}
              <div className="bg-white rounded-2xl border border-[#e5e5ea] p-5 shadow-xs">
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#f0f0f0]">
                  <h4 className="font-semibold text-sm text-[#1d1d1f]">
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
                      className="w-7 h-7 rounded-full bg-[#f5f5f7] flex items-center justify-center text-[#86868b] hover:text-[#1d1d1f]"
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
                      className="w-7 h-7 rounded-full bg-[#f5f5f7] flex items-center justify-center text-[#86868b] hover:text-[#1d1d1f]"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Day Headers */}
                <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-[#86868b] mb-1">
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
                        className={`h-9 rounded-lg flex flex-col items-center justify-center text-xs font-semibold transition-all ${
                          status === 'present'
                            ? 'bg-[#30d158]/10 text-[#30d158] border border-[#30d158]/20'
                            : status === 'absent'
                            ? 'bg-[#ff3b30]/10 text-[#ff3b30] border border-[#ff3b30]/20'
                            : 'bg-[#f5f5f7] text-[#86868b]'
                        }`}
                        title={status ? `${dateStr}: ${status}` : 'No Record'}
                      >
                        <span>{day}</span>
                        {status && (
                          <span className="text-[9px] leading-none font-bold">
                            {status === 'present' ? '✓' : '✕'}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 flex items-center justify-center space-x-5 text-xs">
                  <div className="flex items-center space-x-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#30d158]"></span>
                    <span className="text-[#1d1d1f]">Present</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#ff3b30]"></span>
                    <span className="text-[#1d1d1f]">Absent</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#e5e5ea]"></span>
                    <span className="text-[#86868b]">No Record</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 3. FEES TAB */}
          {activeTab === 'fees' && (
            <div className="space-y-4">
              {/* Summary Card */}
              <div className="bg-white rounded-2xl border border-[#e5e5ea] p-5 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#0066cc]">Fee Account</span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${
                      feeAccount.status === 'paid'
                        ? 'bg-[#30d158]/10 text-[#30d158]'
                        : feeAccount.status === 'partial'
                        ? 'bg-[#ff9500]/10 text-[#ff9500]'
                        : 'bg-[#ff3b30]/10 text-[#ff3b30]'
                    }`}
                  >
                    {feeAccount.status}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-3 text-center sm:text-left">
                  <div>
                    <span className="text-xs text-[#86868b]">Total Annual Fee</span>
                    <p className="text-base sm:text-lg font-semibold text-[#1d1d1f]">
                      ₹{(feeAccount.totalFee || 0).toLocaleString('en-IN')}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-[#86868b]">Paid to Date</span>
                    <p className="text-base sm:text-lg font-semibold text-[#30d158]">
                      ₹{(feeAccount.paidAmount || 0).toLocaleString('en-IN')}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-[#86868b]">Outstanding Due</span>
                    <p className="text-base sm:text-lg font-semibold text-[#ff3b30]">
                      ₹{(feeAccount.dueAmount || 0).toLocaleString('en-IN')}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2 pt-3 border-t border-[#f0f0f0]">
                  <button
                    onClick={() => openWhatsAppFeeMessage(db.schoolInfo, student, feeAccount)}
                    className="apple-btn-secondary py-1.5 px-3 text-xs text-[#30d158]"
                  >
                    <Phone className="h-3.5 w-3.5 mr-1.5" />
                    <span>Send WhatsApp Reminder</span>
                  </button>

                  {onOpenCollectFee && (
                    <button
                      onClick={() => onOpenCollectFee(student)}
                      className="apple-btn-primary py-1.5 px-4 text-xs"
                    >
                      <CreditCard className="h-3.5 w-3.5 mr-1.5" />
                      <span>Record Payment</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Transactions Ledger */}
              <div className="bg-white rounded-2xl border border-[#e5e5ea] p-5 shadow-xs">
                <h4 className="font-semibold text-sm text-[#1d1d1f] mb-3">
                  Payment History & Receipts
                </h4>

                {studentTransactions.length === 0 ? (
                  <p className="py-4 text-center text-xs text-[#86868b]">
                    No payment transactions recorded yet.
                  </p>
                ) : (
                  <div className="divide-y divide-[#f0f0f0]">
                    {studentTransactions.map(tx => (
                      <div key={tx.id} className="py-3 flex items-center justify-between text-xs">
                        <div>
                          <p className="font-semibold text-[#1d1d1f]">
                            ₹{tx.amount.toLocaleString('en-IN')} via {tx.paymentMethod.toUpperCase()}
                          </p>
                          <p className="text-[11px] text-[#86868b]">
                            Receipt: {tx.receiptNumber} • {formatDate(tx.paymentDate)}
                          </p>
                          {tx.notes && <p className="text-[11px] text-[#86868b] mt-0.5">{tx.notes}</p>}
                        </div>
                        <span className="bg-[#30d158]/10 text-[#30d158] px-2.5 py-0.5 rounded-full text-[10px] font-semibold">
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
                <h4 className="font-semibold text-sm text-[#1d1d1f]">
                  Academic Results & Marksheets
                </h4>
                <button
                  onClick={() => setShowAddResultModal(true)}
                  className="apple-btn-primary py-1.5 px-3.5 text-xs"
                >
                  <Award className="h-3.5 w-3.5 mr-1.5" />
                  <span>+ Generate Marksheet</span>
                </button>
              </div>

              {studentResults.length === 0 ? (
                <div className="bg-white rounded-2xl border border-[#e5e5ea] p-6 text-center text-xs text-[#86868b] shadow-xs">
                  No exam results published for this student yet.
                </div>
              ) : (
                studentResults.map(res => (
                  <div
                    key={res.id}
                    className="bg-white rounded-2xl border border-[#e5e5ea] p-5 space-y-3 shadow-xs"
                  >
                    <div className="flex items-center justify-between border-b border-[#f0f0f0] pb-3">
                      <div>
                        <h5 className="font-semibold text-sm text-[#1d1d1f]">{res.examName}</h5>
                        <p className="text-xs text-[#86868b]">Session: {res.academicYear}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => setViewingResult(res)}
                          className="apple-btn-secondary py-1 px-2.5 text-xs"
                        >
                          <Printer className="h-3.5 w-3.5 mr-1" />
                          <span>Print</span>
                        </button>

                        <button
                          onClick={() => openWhatsAppMarksheetMessage(db.schoolInfo, student, res)}
                          className="apple-btn-secondary py-1 px-2.5 text-xs text-[#30d158]"
                        >
                          <Phone className="h-3.5 w-3.5 mr-1" />
                          <span>WhatsApp</span>
                        </button>

                        <div className="text-right pl-2">
                          <span className="bg-[#0066cc]/10 text-[#0066cc] px-2.5 py-0.5 rounded-full text-xs font-semibold">
                            Grade {res.grade} ({res.percentage}%)
                          </span>
                          <p className="text-[11px] text-[#86868b] mt-0.5">
                            {res.totalMarks}/{res.totalMaxMarks} Marks
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {res.subjects.map(s => (
                        <div key={s.subject} className="bg-[#f5f5f7] rounded-xl p-2.5 text-xs">
                          <span className="text-[#86868b] block truncate">{s.subject}</span>
                          <span className="font-semibold text-[#1d1d1f]">
                            {s.obtainedMarks}/{s.maxMarks}
                          </span>
                          <span className="ml-1 text-[11px] font-semibold text-[#0066cc]">({s.grade})</span>
                        </div>
                      ))}
                    </div>

                    {res.remarks && (
                      <p className="text-xs text-[#86868b] bg-[#f5f5f7] p-2.5 rounded-xl">
                        <strong className="text-[#1d1d1f]">Remark:</strong> {res.remarks}
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
                <h4 className="font-semibold text-sm text-[#1d1d1f]">
                  Teacher Behavioral & Academic Feedback
                </h4>
                {onOpenAddPerformance && (
                  <button
                    onClick={() => onOpenAddPerformance(student)}
                    className="apple-btn-primary py-1.5 px-3.5 text-xs"
                  >
                    <PlusCircle className="h-3.5 w-3.5 mr-1.5" />
                    <span>+ Add Note</span>
                  </button>
                )}
              </div>

              {studentPerformance.length === 0 ? (
                <div className="bg-white rounded-2xl border border-[#e5e5ea] p-6 text-center text-xs text-[#86868b] shadow-xs">
                  No performance records logged yet.
                </div>
              ) : (
                studentPerformance.map(p => (
                  <div
                    key={p.id}
                    className="bg-white rounded-2xl border border-[#e5e5ea] p-5 space-y-2 text-xs shadow-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="bg-[#f5f5f7] px-2.5 py-0.5 rounded-full text-xs font-semibold text-[#0066cc] capitalize">
                          {p.category}
                        </span>
                        <span className="text-[#86868b] text-xs">{formatDate(p.date)}</span>
                      </div>
                      <span className="font-semibold text-[#1d1d1f] capitalize">
                        Rating: {p.rating.replace('_', ' ')}
                      </span>
                    </div>

                    <p className="font-medium text-[#1d1d1f] text-xs leading-relaxed">
                      "{p.remarks}"
                    </p>

                    {p.strengths && (
                      <p className="text-[#30d158]">
                        <strong>Strengths:</strong> {p.strengths}
                      </p>
                    )}
                    {p.areasToImprove && (
                      <p className="text-[#ff9500]">
                        <strong>Areas to Focus:</strong> {p.areasToImprove}
                      </p>
                    )}
                    <p className="text-[11px] text-[#86868b]">Evaluated by: {p.teacherName}</p>
                  </div>
                ))
              )}
            </div>
          )}

          {/* 6. HISTORY TAB */}
          {activeTab === 'history' && (
            <div className="space-y-3">
              <h4 className="font-semibold text-sm text-[#1d1d1f] mb-2">
                Student Life Cycle & Audit Trail
              </h4>
              <div className="bg-white rounded-2xl border border-[#e5e5ea] p-5 space-y-3.5 text-xs shadow-xs">
                <div className="flex items-start space-x-3">
                  <div className="h-2.5 w-2.5 rounded-full bg-[#30d158] mt-1"></div>
                  <div>
                    <p className="font-semibold text-[#1d1d1f]">Admitted to {student.className}</p>
                    <p className="text-[#86868b] text-[11px]">
                      Date: {formatDate(student.admissionDate)} • Admission No: {student.admissionNumber}
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <div className="h-2.5 w-2.5 rounded-full bg-[#0066cc] mt-1"></div>
                  <div>
                    <p className="font-semibold text-[#1d1d1f]">Enrolled in Academic Session {student.academicYear}</p>
                    <p className="text-[#86868b] text-[11px]">Assigned Roll Number #{student.rollNumber}</p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <div className="h-2.5 w-2.5 rounded-full bg-[#86868b] mt-1"></div>
                  <div>
                    <p className="font-semibold text-[#1d1d1f]">Permanent Record Security</p>
                    <p className="text-[#86868b] text-[11px]">
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
