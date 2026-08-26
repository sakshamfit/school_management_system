import React, { useState, useMemo } from 'react';
import {
  GraduationCap,
  PlusCircle,
  Search,
  Phone,
  CreditCard,
  Eye,
  Edit2,
  Archive,
  RotateCcw,
  Filter,
  CheckCircle2,
  AlertCircle,
  MoreVertical,
} from 'lucide-react';
import { useSchool } from '../../context/SchoolContext';
import { Student } from '../../types';
import { openWhatsAppFeeMessage } from '../../utils/whatsapp';

interface StudentsViewProps {
  initialClassId?: string;
  onSelectStudent: (studentId: string) => void;
  onOpenAddStudent: () => void;
  onOpenEditStudent: (student: Student) => void;
  onOpenCollectFee: (student: Student) => void;
}

export const StudentsView: React.FC<StudentsViewProps> = ({
  initialClassId,
  onSelectStudent,
  onOpenAddStudent,
  onOpenEditStudent,
  onOpenCollectFee,
}) => {
  const { db, archiveStudent, restoreStudent, currentUser } = useSchool();
  const [selectedClassId, setSelectedClassId] = useState<string>(initialClassId || 'all');
  const [statusFilter, setStatusFilter] = useState<'active' | 'archived'>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmArchiveStudent, setConfirmArchiveStudent] = useState<Student | null>(null);

  // Filter students
  const filteredStudents = useMemo(() => {
    return db.students.filter(student => {
      // Class filter
      if (selectedClassId !== 'all' && student.classId !== selectedClassId) {
        return false;
      }
      // Status filter
      if (student.status !== statusFilter) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = student.name.toLowerCase().includes(q);
        const matchesRoll = student.rollNumber.includes(q);
        const matchesAdm = student.admissionNumber.toLowerCase().includes(q);
        const matchesParent = student.parentName.toLowerCase().includes(q);
        if (!matchesName && !matchesRoll && !matchesAdm && !matchesParent) return false;
      }
      return true;
    });
  }, [db.students, selectedClassId, statusFilter, searchQuery]);

  return (
    <div className="space-y-4 pb-16">
      {/* Header Bar */}
      <div className="rounded-3xl border border-orange-100 bg-white p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-100 text-orange-600">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900">
                Students Directory
              </h2>
              <p className="text-xs text-slate-500">
                {filteredStudents.length} {statusFilter} students found
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() =>
                setStatusFilter(s => (s === 'active' ? 'archived' : 'active'))
              }
              className={`rounded-xl px-3 py-2 text-xs font-bold transition-all ${
                statusFilter === 'archived'
                  ? 'bg-red-100 text-red-700 border border-red-200'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {statusFilter === 'archived' ? 'Viewing Archived' : 'View Archived'}
            </button>

            <button
              onClick={onOpenAddStudent}
              className="inline-flex items-center space-x-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 px-4 py-2 text-xs font-black text-white shadow-md shadow-orange-500/25 hover:from-orange-600 hover:to-amber-700 active:scale-95 transition-all"
            >
              <PlusCircle className="h-4 w-4" />
              <span>+ Enroll Student</span>
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-3 border-t border-slate-100">
          <div className="sm:col-span-2 relative">
            <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by student name, roll number, admission no, or parent..."
              className="w-full rounded-xl border border-slate-200 py-2 pl-10 pr-4 text-xs font-medium text-slate-800 placeholder-slate-400 focus:border-orange-500 focus:outline-none"
            />
          </div>

          <div>
            <select
              value={selectedClassId}
              onChange={e => setSelectedClassId(e.target.value)}
              className="w-full rounded-xl border border-orange-200 bg-orange-50/40 py-2 px-3 text-xs font-bold text-slate-800 focus:border-orange-500 focus:outline-none"
            >
              <option value="all">All Classes ({db.students.length} Students)</option>
              {db.classes.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} - Section {c.section}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Student Cards Grid */}
      {filteredStudents.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-orange-200 bg-white p-12 text-center">
          <GraduationCap className="mx-auto h-12 w-12 text-orange-300 mb-2" />
          <h4 className="text-sm font-bold text-slate-800">No Students Found</h4>
          <p className="text-xs text-slate-500 mt-1">
            Try adjusting your search criteria or enroll a new student.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredStudents.map(student => {
            const feeAccount = db.feeAccounts.find(fa => fa.studentId === student.id);
            const studentAttendance = db.attendance.filter(a => a.studentId === student.id);
            const presentDays = studentAttendance.filter(a => a.status === 'present').length;
            const attPct =
              studentAttendance.length > 0
                ? ((presentDays / studentAttendance.length) * 100).toFixed(0)
                : '100';

            const isDue = (feeAccount?.dueAmount || 0) > 0;

            return (
              <div
                key={student.id}
                className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs hover:border-orange-300 hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Top Profile Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div
                      onClick={() => onSelectStudent(student.id)}
                      className="flex items-center space-x-3 cursor-pointer flex-1 min-w-0 group"
                    >
                      <img
                        src={
                          student.photoUrl ||
                          `https://api.dicebear.com/7.x/adventurer/svg?seed=${student.name}`
                        }
                        alt={student.name}
                        className="h-12 w-12 shrink-0 rounded-2xl object-cover border-2 border-orange-100 shadow-xs group-hover:scale-105 transition-transform"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center space-x-1.5">
                          <h4 className="font-extrabold text-xs sm:text-sm text-slate-900 group-hover:text-orange-600 truncate transition-colors">
                            {student.name}
                          </h4>
                          <span className="rounded bg-orange-100 px-1.5 py-0.2 text-[10px] font-black text-orange-800">
                            #{student.rollNumber}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 truncate mt-0.5">
                          {student.className} • Adm: {student.admissionNumber}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Details stats */}
                  <div className="mt-3.5 rounded-xl bg-slate-50 p-2.5 grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Parent:</span>
                      <span className="font-bold text-slate-700 truncate block">
                        {student.parentName}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[10px]">Attendance:</span>
                      <span
                        className={`font-bold ${
                          Number(attPct) >= 75 ? 'text-emerald-700' : 'text-rose-600'
                        }`}
                      >
                        {attPct}% Rate
                      </span>
                    </div>

                    <div className="col-span-2 pt-1 border-t border-slate-200/60 flex items-center justify-between">
                      <span className="text-slate-400 text-[10px]">Fee Status:</span>
                      <span
                        className={`font-black text-[11px] ${
                          isDue ? 'text-rose-600' : 'text-emerald-600'
                        }`}
                      >
                        {isDue ? `₹${feeAccount?.dueAmount} Due` : '✓ All Paid'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div className="mt-3.5 pt-2 border-t border-slate-100 flex items-center justify-between gap-1.5">
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => onSelectStudent(student.id)}
                      className="rounded-lg bg-orange-50 px-2.5 py-1.5 text-[11px] font-extrabold text-orange-700 hover:bg-orange-100 flex items-center space-x-1"
                      title="Open Profile"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>Profile</span>
                    </button>

                    {student.parentPhone && (
                      <button
                        onClick={() => openWhatsAppFeeMessage(db.schoolInfo, student, feeAccount)}
                        className="rounded-lg bg-emerald-50 px-2 py-1.5 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100"
                        title="Send WhatsApp"
                      >
                        <Phone className="h-3.5 w-3.5" />
                      </button>
                    )}

                    <button
                      onClick={() => onOpenCollectFee(student)}
                      className="rounded-lg bg-blue-50 px-2 py-1.5 text-[11px] font-bold text-blue-700 hover:bg-blue-100"
                      title="Fee payment"
                    >
                      <CreditCard className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => onOpenEditStudent(student)}
                      className="rounded-lg p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                      title="Edit Student"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>

                    {student.status === 'active' ? (
                      <button
                        onClick={() => setConfirmArchiveStudent(student)}
                        className="rounded-lg p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50"
                        title="Archive Record"
                      >
                        <Archive className="h-3.5 w-3.5" />
                      </button>
                    ) : (
                      <button
                        onClick={() => restoreStudent(student.id)}
                        className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50"
                        title="Restore Student"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Non-Destructive Soft Archive Confirmation Modal */}
      {confirmArchiveStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl space-y-4">
            <div className="flex items-center space-x-2 text-amber-600">
              <Archive className="h-6 w-6" />
              <h4 className="font-extrabold text-slate-900 text-sm">
                Archive Student Record?
              </h4>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to archive <strong>{confirmArchiveStudent.name}</strong>? School safety policy ensures historical attendance, fees, and results are never deleted and can be restored at any time.
            </p>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                onClick={() => setConfirmArchiveStudent(null)}
                className="rounded-xl px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  archiveStudent(confirmArchiveStudent.id);
                  setConfirmArchiveStudent(null);
                }}
                className="rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700"
              >
                Archive Safely
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
