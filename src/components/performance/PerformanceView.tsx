import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  Search,
  Filter,
  Star,
  PlusCircle,
  ChevronRight,
  TrendingUp,
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
  onOpenAddPerformance,
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
    <div className="space-y-4 pb-16">
      {/* Header */}
      <div className="rounded-3xl border border-orange-100 bg-white p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-pink-100 text-pink-600">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900">
                Student Remarks & Growth Track
              </h2>
              <p className="text-xs text-slate-500">
                Teacher observations, behavioral feedback, and continuous progress notes
              </p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-3 border-t border-slate-100">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by student or remarks..."
              className="w-full rounded-xl border border-slate-200 py-1.5 pl-9 pr-3 text-xs font-medium text-slate-800 placeholder-slate-400 focus:border-pink-500 focus:outline-none"
            />
          </div>

          <div>
            <select
              value={selectedClassId}
              onChange={e => setSelectedClassId(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white py-1.5 px-3 text-xs font-bold text-slate-800 focus:border-pink-500 focus:outline-none"
            >
              <option value="all">All Classes</option>
              {db.classes.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} - Sec {c.section}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white py-1.5 px-3 text-xs font-bold text-slate-800 focus:border-pink-500 focus:outline-none"
            >
              <option value="all">All Categories</option>
              <option value="academic">Academic Excellence</option>
              <option value="behavior">Behavior & Discipline</option>
              <option value="attendance">Attendance & Punctuality</option>
              <option value="sports">Sports</option>
              <option value="creativity">Creativity & Arts</option>
              <option value="leadership">Leadership</option>
            </select>
          </div>
        </div>
      </div>

      {/* Remarks Feed */}
      <div className="space-y-3">
        {filteredLogs.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center text-xs text-slate-400">
            No student remarks found matching criteria.
          </div>
        ) : (
          filteredLogs.map(log => {
            const student = db.students.find(s => s.id === log.studentId);

            return (
              <div
                key={log.id}
                className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs hover:border-pink-300 transition-all space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                  <div
                    onClick={() => onSelectStudent(log.studentId)}
                    className="flex items-center space-x-3 cursor-pointer group"
                  >
                    <img
                      src={
                        student?.photoUrl ||
                        `https://api.dicebear.com/7.x/adventurer/svg?seed=${log.studentName}`
                      }
                      alt={log.studentName}
                      className="h-10 w-10 rounded-full object-cover border border-pink-200"
                    />
                    <div>
                      <h4 className="font-extrabold text-sm text-slate-900 group-hover:text-pink-600">
                        {log.studentName}
                      </h4>
                      <p className="text-xs text-slate-500">
                        {log.className} • {formatDate(log.date)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <span className="rounded-full bg-pink-100 px-2.5 py-0.5 text-xs font-black uppercase text-pink-800">
                      {log.category}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-bold capitalize ${
                        log.rating === 'outstanding'
                          ? 'bg-emerald-100 text-emerald-800'
                          : log.rating === 'good'
                          ? 'bg-blue-100 text-blue-800'
                          : log.rating === 'satisfactory'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {log.rating.replace('_', ' ')}
                    </span>
                  </div>
                </div>

                <p className="text-xs sm:text-sm font-medium text-slate-800 leading-relaxed">
                  "{log.remarks}"
                </p>

                {(log.strengths || log.areasToImprove) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs">
                    {log.strengths && (
                      <div className="rounded-xl bg-emerald-50/70 p-2 border border-emerald-100 text-emerald-900">
                        <strong>🌟 Strengths:</strong> {log.strengths}
                      </div>
                    )}
                    {log.areasToImprove && (
                      <div className="rounded-xl bg-amber-50/70 p-2 border border-amber-100 text-amber-900">
                        <strong>🎯 Areas to Focus:</strong> {log.areasToImprove}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-50">
                  <span>Logged by: {log.teacherName}</span>
                  <button
                    onClick={() => onSelectStudent(log.studentId)}
                    className="text-pink-600 font-bold hover:underline"
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
