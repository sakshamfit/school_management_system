import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  Search,
} from 'lucide-react';
import { useSchool } from '../../context/SchoolContext';
import { Student } from '../../types';
import { formatDate } from '../../utils/helpers';

interface PerformanceViewProps {
  onSelectStudent: (studentId: string) => void;
  onOpenAddPerformance: (student: Student) => void;
}

export const PerformanceView: React.FC<PerformanceViewProps> = ({
  onSelectStudent,
}) => {
  const { db } = useSchool();
  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredLogs = useMemo(() => {
    return db.performance.filter(p => {
      if (selectedClassId !== 'all' && p.classId !== selectedClassId) return false;
      if (selectedCategory !== 'all' && p.category !== selectedCategory) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesStudent = p.studentName.toLowerCase().includes(q);
        const matchesRemarks = p.remarks.toLowerCase().includes(q);
        if (!matchesStudent && !matchesRemarks) return false;
      }
      return true;
    });
  }, [db.performance, selectedClassId, selectedCategory, searchQuery]);

  return (
    <div className="space-y-6 pb-16 text-[#1d1d1f]">
      {/* Header */}
      <div className="bg-white rounded-[18px] border border-[#e5e5ea] p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#ff9500]/10 text-[#ff9500]">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold tracking-[-0.022em] text-[#1d1d1f]">
                Student Performance & Teacher Notes
              </h2>
              <p className="text-xs text-[#86868b]">
                Behavior observations, strengths, conduct logs, and continuous evaluation
              </p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-[#f0f0f0]">
          <div className="relative">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-[#86868b]" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search student or remarks..."
              className="apple-input pl-10"
            />
          </div>

          <div>
            <select
              value={selectedClassId}
              onChange={e => setSelectedClassId(e.target.value)}
              className="apple-input font-medium"
            >
              <option value="all">All Classes</option>
              {db.classes.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} - Section {c.section}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="apple-input font-medium"
            >
              <option value="all">All Categories</option>
              <option value="academic">Academic Excellence</option>
              <option value="behavior">Conduct & Discipline</option>
              <option value="attendance">Attendance & Punctuality</option>
              <option value="sports">Athletics & Sports</option>
              <option value="creativity">Arts & Innovation</option>
              <option value="leadership">Leadership & Initiative</option>
            </select>
          </div>
        </div>
      </div>

      {/* Remarks Feed */}
      <div className="space-y-4">
        {filteredLogs.length === 0 ? (
          <div className="bg-white rounded-[18px] border border-[#e5e5ea] p-10 text-center text-xs text-[#86868b] shadow-xs">
            No evaluations located matching criteria.
          </div>
        ) : (
          filteredLogs.map(log => {
            const student = db.students.find(s => s.id === log.studentId);

            return (
              <div
                key={log.id}
                className="bg-white rounded-[18px] border border-[#e5e5ea] p-5 hover:border-[#0066cc]/40 transition-all shadow-xs space-y-3 group"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#f0f0f0] pb-3">
                  <div
                    onClick={() => onSelectStudent(log.studentId)}
                    className="flex items-center space-x-3.5 cursor-pointer"
                  >
                    <img
                      src={
                        student?.photoUrl ||
                        `https://api.dicebear.com/7.x/adventurer/svg?seed=${log.studentName}`
                      }
                      alt={log.studentName}
                      className="h-11 w-11 rounded-full object-cover bg-white apple-product-shadow"
                    />
                    <div>
                      <h4 className="font-semibold text-sm text-[#1d1d1f] group-hover:text-[#0066cc] transition-colors">
                        {log.studentName}
                      </h4>
                      <p className="text-xs text-[#86868b]">
                        {log.className} • {formatDate(log.date)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <span className="bg-[#f5f5f7] px-2.5 py-0.5 rounded-full text-xs font-semibold text-[#0066cc] capitalize">
                      {log.category}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${
                        log.rating === 'outstanding'
                          ? 'bg-[#30d158]/10 text-[#30d158]'
                          : log.rating === 'good'
                          ? 'bg-[#0066cc]/10 text-[#0066cc]'
                          : log.rating === 'satisfactory'
                          ? 'bg-[#ff9500]/10 text-[#ff9500]'
                          : 'bg-[#ff3b30]/10 text-[#ff3b30]'
                      }`}
                    >
                      {log.rating.replace('_', ' ')}
                    </span>
                  </div>
                </div>

                <p className="text-xs font-medium text-[#1d1d1f] leading-relaxed">
                  "{log.remarks}"
                </p>

                {(log.strengths || log.areasToImprove) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-xs">
                    {log.strengths && (
                      <div className="bg-[#30d158]/10 rounded-xl p-3 text-[#1d1d1f]">
                        <strong className="text-[#30d158] block mb-0.5">Strengths:</strong> {log.strengths}
                      </div>
                    )}
                    {log.areasToImprove && (
                      <div className="bg-[#ff9500]/10 rounded-xl p-3 text-[#1d1d1f]">
                        <strong className="text-[#ff9500] block mb-0.5">Areas to Focus:</strong> {log.areasToImprove}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between text-xs text-[#86868b] pt-2 border-t border-[#f0f0f0]">
                  <span>Evaluated by: {log.teacherName}</span>
                  <button
                    onClick={() => onSelectStudent(log.studentId)}
                    className="text-[#0066cc] font-semibold hover:underline"
                  >
                    View Student Record →
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
