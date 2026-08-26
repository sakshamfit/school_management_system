import React, { useState, useMemo } from 'react';
import {
  Award,
  PlusCircle,
  Search,
  Printer,
  Trash2,
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
    <div className="space-y-6 pb-16 text-[#1d1d1f]">
      {/* Header */}
      <div className="bg-white rounded-[18px] border border-[#e5e5ea] p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#af52de]/10 text-[#af52de]">
              <Award className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold tracking-[-0.022em] text-[#1d1d1f]">
                Examinations & Report Cards
              </h2>
              <p className="text-xs text-[#86868b]">
                Academic performance evaluation, printable marksheets, and WhatsApp delivery
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="apple-btn-primary"
          >
            <PlusCircle className="h-4 w-4 mr-2" />
            <span>Record Exam Result</span>
          </button>
        </div>

        {/* Filters */}
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 border-t border-[#f0f0f0]">
          <div className="relative">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-[#86868b]" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search student or exam name..."
              className="apple-input pl-10"
            />
          </div>

          <div>
            <select
              value={selectedClassId}
              onChange={e => setSelectedClassId(e.target.value)}
              className="apple-input font-medium"
            >
              <option value="all">All Classes ({db.results.length} results)</option>
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
      <div className="space-y-4">
        {filteredResults.length === 0 ? (
          <div className="bg-white rounded-[18px] border border-[#e5e5ea] p-12 text-center shadow-xs">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#f5f5f7] text-[#0066cc] mb-3">
              <Award className="h-6 w-6" />
            </div>
            <h3 className="text-base font-semibold text-[#1d1d1f] mb-1">No Marksheets Generated</h3>
            <p className="text-xs text-[#86868b] max-w-sm mx-auto mb-4">
              Record subject scores for unit tests, midterms, or final exams to generate official report cards.
            </p>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="apple-btn-primary"
            >
              <PlusCircle className="h-4 w-4 mr-2" />
              <span>Record First Result</span>
            </button>
          </div>
        ) : (
          filteredResults.map(res => {
            const studentObj = db.students.find(s => s.id === res.studentId);
            return (
              <div
                key={res.id}
                className="bg-white rounded-[18px] border border-[#e5e5ea] p-5 hover:border-[#0066cc]/40 transition-all shadow-xs space-y-4 group"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#f0f0f0] pb-3.5">
                  <div
                    onClick={() => onSelectStudent(res.studentId)}
                    className="cursor-pointer"
                  >
                    <div className="flex items-center space-x-2">
                      <h4 className="font-semibold text-sm text-[#1d1d1f] group-hover:text-[#0066cc] transition-colors">
                        {res.studentName}
                      </h4>
                      <span className="bg-[#f5f5f7] px-2 py-0.5 rounded-full text-[10px] font-semibold text-[#0066cc]">
                        Roll #{res.rollNumber}
                      </span>
                    </div>
                    <p className="text-xs text-[#86868b] mt-0.5">
                      {res.className} • <span className="font-semibold text-[#1d1d1f]">{res.examName}</span> ({formatDate(res.examDate)})
                    </p>
                  </div>

                  {/* Actions & Score */}
                  <div className="flex items-center space-x-2">
                    <div className="text-right mr-2">
                      <span className="bg-[#0066cc]/10 text-[#0066cc] px-2.5 py-1 rounded-full text-xs font-semibold">
                        Grade {res.grade} ({res.percentage}%)
                      </span>
                      <p className="text-[11px] text-[#86868b] mt-1">
                        {res.totalMarks}/{res.totalMaxMarks} Marks
                      </p>
                    </div>

                    <button
                      onClick={() => setViewingResult(res)}
                      className="apple-btn-secondary py-1.5 px-3 text-xs"
                      title="View & Print Official Marksheet"
                    >
                      <Printer className="h-3.5 w-3.5 mr-1.5 text-[#0066cc]" />
                      <span>Print Marksheet</span>
                    </button>

                    {studentObj && (
                      <button
                        onClick={() => openWhatsAppMarksheetMessage(db.schoolInfo, studentObj, res)}
                        className="w-8 h-8 rounded-full bg-[#f5f5f7] text-[#30d158] hover:bg-[#30d158] hover:text-white flex items-center justify-center transition-colors"
                        title="Send to Parent on WhatsApp"
                      >
                        <Phone className="h-3.5 w-3.5" />
                      </button>
                    )}

                    <button
                      onClick={() => {
                        if (confirm(`Delete marksheet for ${res.studentName}?`)) {
                          deleteResult(res.id);
                        }
                      }}
                      className="w-8 h-8 rounded-full bg-[#f5f5f7] text-[#86868b] hover:text-[#ff3b30] hover:bg-[#ff3b30]/10 flex items-center justify-center transition-colors"
                      title="Delete Record"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Subject Badges */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                  {res.subjects.map(sub => (
                    <div
                      key={sub.subject}
                      className="bg-[#f5f5f7] rounded-xl p-2.5 text-xs border border-[#e5e5ea]"
                    >
                      <span className="text-[#86868b] block text-[11px] truncate font-medium">{sub.subject}</span>
                      <div className="flex items-baseline justify-between mt-1">
                        <span className="font-semibold text-[#1d1d1f] text-xs">
                          {sub.obtainedMarks}/{sub.maxMarks}
                        </span>
                        <span className="font-semibold text-[#0066cc] text-[11px]">{sub.grade}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {res.remarks && (
                  <p className="text-xs text-[#86868b] bg-[#f5f5f7] rounded-xl p-3 border border-[#e5e5ea]">
                    <strong className="text-[#1d1d1f] font-semibold">Teacher Evaluation:</strong> "{res.remarks}"
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
