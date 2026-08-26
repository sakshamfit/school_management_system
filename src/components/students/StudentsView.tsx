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
  const { db, archiveStudent, restoreStudent } = useSchool();
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
    <div className="space-y-6 pb-16 text-[#1d1d1f]">
      {/* Header Bar */}
      <div className="bg-white rounded-[18px] border border-[#e5e5ea] p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0066cc]/10 text-[#0066cc]">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold tracking-[-0.022em] text-[#1d1d1f]">
                Student Directory
              </h2>
              <p className="text-xs text-[#86868b]">
                {filteredStudents.length} {statusFilter} students enrolled
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() =>
                setStatusFilter(s => (s === 'active' ? 'archived' : 'active'))
              }
              className="apple-btn-secondary"
            >
              {statusFilter === 'archived' ? 'Viewing Archived' : 'Archived Records'}
            </button>

            <button
              onClick={onOpenAddStudent}
              className="apple-btn-primary"
            >
              <PlusCircle className="h-4 w-4 mr-2" />
              <span>Enroll Student</span>
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-[#f0f0f0]">
          <div className="sm:col-span-2 relative">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-[#86868b]" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by name, roll number, admission ID, or parent..."
              className="apple-input pl-10"
            />
          </div>

          <div>
            <select
              value={selectedClassId}
              onChange={e => setSelectedClassId(e.target.value)}
              className="apple-input font-medium"
            >
              <option value="all">All Classes ({db.students.length} Total)</option>
              {db.classes.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} (Section {c.section})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Student Cards Grid */}
      {filteredStudents.length === 0 ? (
        <div className="bg-white rounded-[18px] border border-[#e5e5ea] p-12 text-center shadow-xs">
          <GraduationCap className="mx-auto h-12 w-12 text-[#86868b] mb-3" />
          <h4 className="text-base font-semibold text-[#1d1d1f]">No Students Found</h4>
          <p className="text-xs text-[#86868b] mt-1">
            Try adjusting your search criteria or enroll a new student.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
                className="bg-white rounded-[18px] border border-[#e5e5ea] p-5 hover:border-[#0066cc]/40 transition-all shadow-xs flex flex-col justify-between group"
              >
                <div>
                  {/* Top Profile Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div
                      onClick={() => onSelectStudent(student.id)}
                      className="flex items-center space-x-3.5 cursor-pointer flex-1 min-w-0"
                    >
                      <img
                        src={
                          student.photoUrl ||
                          `https://api.dicebear.com/7.x/adventurer/svg?seed=${student.name}`
                        }
                        alt={student.name}
                        className="h-12 w-12 shrink-0 rounded-full object-cover bg-white apple-product-shadow"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center space-x-1.5">
                          <h4 className="font-semibold text-sm text-[#1d1d1f] group-hover:text-[#0066cc] truncate transition-colors">
                            {student.name}
                          </h4>
                          <span className="bg-[#f5f5f7] px-2 py-0.5 rounded-full text-[10px] font-semibold text-[#0066cc]">
                            #{student.rollNumber}
                          </span>
                        </div>
                        <p className="text-xs text-[#86868b] truncate mt-0.5">
                          {student.className} • Adm #{student.admissionNumber}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Details stats */}
                  <div className="mt-4 bg-[#f5f5f7] rounded-xl p-3.5 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[#86868b] block text-[11px]">Guardian:</span>
                      <span className="font-semibold text-[#1d1d1f] truncate block">
                        {student.parentName}
                      </span>
                    </div>

                    <div>
                      <span className="text-[#86868b] block text-[11px]">Attendance:</span>
                      <span
                        className={`font-semibold ${
                          Number(attPct) >= 75 ? 'text-[#30d158]' : 'text-[#ff3b30]'
                        }`}
                      >
                        {attPct}%
                      </span>
                    </div>

                    <div className="col-span-2 pt-2 border-t border-[#e5e5ea] flex items-center justify-between">
                      <span className="text-[#86868b] text-[11px]">Fee Balance:</span>
                      <span
                        className={`font-semibold ${
                          isDue ? 'text-[#ff3b30]' : 'text-[#30d158]'
                        }`}
                      >
                        {isDue ? `₹${feeAccount?.dueAmount} Due` : '✓ Settled'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div className="mt-4 pt-3 border-t border-[#f0f0f0] flex items-center justify-between gap-2">
                  <div className="flex items-center space-x-1.5">
                    <button
                      onClick={() => onSelectStudent(student.id)}
                      className="bg-[#f5f5f7] hover:bg-[#e5e5ea] px-3 py-1.5 rounded-full text-xs font-medium text-[#1d1d1f] flex items-center space-x-1.5 transition-colors"
                      title="Open Profile"
                    >
                      <Eye className="h-3.5 w-3.5 text-[#0066cc]" />
                      <span>Profile</span>
                    </button>

                    {student.parentPhone && (
                      <button
                        onClick={() => openWhatsAppFeeMessage(db.schoolInfo, student, feeAccount)}
                        className="w-8 h-8 rounded-full bg-[#f5f5f7] text-[#30d158] hover:bg-[#30d158] hover:text-white flex items-center justify-center transition-colors"
                        title="Send WhatsApp Notice"
                      >
                        <Phone className="h-3.5 w-3.5" />
                      </button>
                    )}

                    <button
                      onClick={() => onOpenCollectFee(student)}
                      className="w-8 h-8 rounded-full bg-[#f5f5f7] text-[#ff9500] hover:bg-[#ff9500] hover:text-white flex items-center justify-center transition-colors"
                      title="Collect Fee"
                    >
                      <CreditCard className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => onOpenEditStudent(student)}
                      className="w-8 h-8 rounded-full bg-[#f5f5f7] text-[#86868b] hover:text-[#1d1d1f] hover:bg-[#e5e5ea] flex items-center justify-center transition-colors"
                      title="Edit Student"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>

                    {student.status === 'active' ? (
                      <button
                        onClick={() => setConfirmArchiveStudent(student)}
                        className="w-8 h-8 rounded-full bg-[#f5f5f7] text-[#86868b] hover:text-[#ff3b30] hover:bg-[#ff3b30]/10 flex items-center justify-center transition-colors"
                        title="Archive Record"
                      >
                        <Archive className="h-3.5 w-3.5" />
                      </button>
                    ) : (
                      <button
                        onClick={() => restoreStudent(student.id)}
                        className="w-8 h-8 rounded-full bg-[#30d158]/10 text-[#30d158] hover:bg-[#30d158] hover:text-white flex items-center justify-center transition-colors"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm bg-white rounded-[20px] border border-[#e5e5ea] p-6 space-y-4 text-[#1d1d1f] shadow-2xl">
            <div className="flex items-center space-x-2.5 text-[#ff3b30]">
              <Archive className="h-5 w-5" />
              <h4 className="font-semibold text-base">
                Archive Student Record?
              </h4>
            </div>

            <p className="text-xs text-[#86868b] leading-relaxed">
              Are you sure you want to archive <strong>{confirmArchiveStudent.name}</strong>? Historical attendance, fees, and results are safely preserved and can be restored at any time.
            </p>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                onClick={() => setConfirmArchiveStudent(null)}
                className="apple-btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  archiveStudent(confirmArchiveStudent.id);
                  setConfirmArchiveStudent(null);
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#ff3b30] hover:bg-[#d70015] rounded-full transition-all"
              >
                Confirm Archive
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
