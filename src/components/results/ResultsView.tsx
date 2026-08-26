import React, { useState, useMemo } from 'react';
import {
  Award,
  PlusCircle,
  Search,
  Printer,
  ChevronRight,
  Sparkles,
  BookOpen,
  Share2,
  Trash2,
  FileText,
  Phone,
} from 'lucide-react';
import { useSchool } from '../../context/SchoolContext';
import { Student, StudentResult } from '../../types';
import { formatDate } from '../../utils/helpers';
import { PrintableMarksheetModal } from './PrintableMarksheetModal';
import { AddResultModal } from './AddResultModal';
import { openWhatsAppMarksheetMessage } from '../../utils/whatsapp';

interface ResultsViewProps {
  onSelectStudent: (studentId: string) => void;
  onOpenAddResult?: (student: Student) => void;
}

export const ResultsView: React.FC<ResultsViewProps> = ({
  onSelectStudent,
  onOpenAddResult,
}) => {
  const { db, deleteResult, currentUser } = useSchool();
  const [selectedClassId, setSelectedClassId] = useState<string>(
    currentUser?.assignedClassId || 'all'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [viewingResult, setViewingResult] = useState<StudentResult | null>(null);

  const filteredResults = useMemo(() => {
    return db.results.filter(res => {
      if (selectedClassId !== 'all' && res.classId !== selectedClassId) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesStudent = res.studentName.toLowerCase().includes(q);
        const matchesExam = res.examName.toLowerCase().includes(q);
        if (!matchesStudent && !matchesExam) return false;
      }
      return true;
    });
  }, [db.results, selectedClassId, searchQuery]);

  return (
    <div className="space-y-4 pb-16">
      {/* Header */}
      <div className="rounded-3xl border border-orange-100 bg-white p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-purple-100 text-purple-600 shadow-xs">
              <Award className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-slate-900">
                Examinations & Marksheets
              </h2>
              <p className="text-xs text-slate-500">
                Create report cards, print marksheets, and send results to parents via WhatsApp
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center justify-center space-x-2 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-2.5 text-xs font-black text-white shadow-md shadow-purple-600/20 hover:from-purple-700 hover:to-indigo-700 active:scale-95 transition-all"
          >
            <PlusCircle className="h-4 w-4" />
            <span>+ Create Marksheet / Enter Marks</span>
          </button>
        </div>

        {/* Filters */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-3 border-t border-slate-100">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search student name or exam title..."
              className="w-full rounded-xl border border-slate-200 py-1.5 pl-9 pr-3 text-xs font-medium text-slate-800 placeholder-slate-400 focus:border-purple-500 focus:outline-none"
            />
          </div>

          <div>
            <select
              value={selectedClassId}
              onChange={e => setSelectedClassId(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white py-1.5 px-3 text-xs font-bold text-slate-800 focus:border-purple-500 focus:outline-none"
            >
              <option value="all">All Classes ({db.results.length} Published Marksheets)</option>
              {db.classes.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} - Section {c.section}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Results Grid */}
      <div className="space-y-3">
        {filteredResults.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-50 text-purple-600 mb-3">
              <Award className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800 mb-1">No Marksheets Created Yet</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
              Enter subject scores for unit tests, midterms, or final exams to generate official report cards.
            </p>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center space-x-2 rounded-2xl bg-purple-600 px-4 py-2 text-xs font-black text-white hover:bg-purple-700"
            >
              <PlusCircle className="h-4 w-4" />
              <span>Create First Marksheet</span>
            </button>
          </div>
        ) : (
          filteredResults.map(res => {
            const studentObj = db.students.find(s => s.id === res.studentId);
            return (
              <div
                key={res.id}
                className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs hover:border-purple-300 transition-all space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div
                    onClick={() => onSelectStudent(res.studentId)}
                    className="cursor-pointer group"
                  >
                    <div className="flex items-center space-x-2">
                      <h4 className="font-extrabold text-sm text-slate-900 group-hover:text-purple-600">
                        {res.studentName}
                      </h4>
                      <span className="rounded bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-800">
                        Roll #{res.rollNumber}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {res.className} • <span className="font-semibold text-slate-700">{res.examName}</span> ({formatDate(res.examDate)})
                    </p>
                  </div>

                  {/* Actions & Score */}
                  <div className="flex items-center space-x-2.5">
                    <div className="text-right mr-1">
                      <span className="rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-3 py-1 text-xs font-black text-white shadow-xs">
                        Grade {res.grade} ({res.percentage}%)
                      </span>
                      <p className="text-[10px] text-slate-400 mt-0.5 font-bold">
                        {res.totalMarks}/{res.totalMaxMarks} Marks
                      </p>
                    </div>

                    <button
                      onClick={() => setViewingResult(res)}
                      className="inline-flex items-center space-x-1 rounded-xl bg-orange-50 px-2.5 py-1.5 text-xs font-bold text-orange-700 hover:bg-orange-100 transition-colors border border-orange-200/60"
                      title="View & Print Official Marksheet"
                    >
                      <Printer className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Print Marksheet</span>
                    </button>

                    {studentObj && (
                      <button
                        onClick={() => openWhatsAppMarksheetMessage(db.schoolInfo, studentObj, res)}
                        className="inline-flex items-center space-x-1 rounded-xl bg-emerald-50 px-2.5 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100 transition-colors border border-emerald-200/60"
                        title="Send to Parent on WhatsApp"
                      >
                        <Phone className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">WhatsApp</span>
                      </button>
                    )}

                    <button
                      onClick={() => {
                        if (confirm(`Delete marksheet for ${res.studentName}?`)) {
                          deleteResult(res.id);
                        }
                      }}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      title="Delete Record"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Subject Badges */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {res.subjects.map(sub => (
                    <div
                      key={sub.subject}
                      className="rounded-xl bg-slate-50 p-2 text-xs border border-slate-100"
                    >
                      <span className="text-slate-500 block text-[10px] truncate font-medium">{sub.subject}</span>
                      <div className="flex items-baseline justify-between mt-0.5">
                        <span className="font-black text-slate-800">
                          {sub.obtainedMarks}/{sub.maxMarks}
                        </span>
                        <span className="font-black text-purple-700 text-[10px]">{sub.grade}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {res.remarks && (
                  <p className="text-xs text-slate-600 bg-purple-50/40 p-2.5 rounded-xl border border-purple-100 italic">
                    <strong className="not-italic text-purple-900 font-bold">Teacher's Note:</strong> "{res.remarks}"
                  </p>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Marksheet Creation Modal */}
      {isAddModalOpen && (
        <AddResultModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          initialClassId={selectedClassId !== 'all' ? selectedClassId : undefined}
          onSaved={(newRes) => {
            setIsAddModalOpen(false);
            setViewingResult(newRes);
          }}
        />
      )}

      {/* Printable Marksheet Modal */}
      {viewingResult && (
        <PrintableMarksheetModal
          isOpen={!!viewingResult}
          onClose={() => setViewingResult(null)}
          result={viewingResult}
          student={db.students.find(s => s.id === viewingResult.studentId)}
        />
      )}
    </div>
  );
};

