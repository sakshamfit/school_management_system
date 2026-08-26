import React, { useState, useMemo } from 'react';
import {
  Search,
  X,
  GraduationCap,
  Users,
  BookOpen,
  ArrowRight,
} from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import { Student } from '../types';

interface QuickSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectStudent: (studentId: string) => void;
  onNavigateTab: (tab: string, extra?: any) => void;
}

export const QuickSearchModal: React.FC<QuickSearchModalProps> = ({
  isOpen,
  onClose,
  onSelectStudent,
  onNavigateTab,
}) => {
  const { db } = useSchool();
  const [query, setQuery] = useState('');

  const searchResults = useMemo(() => {
    if (!query.trim()) return { students: [], teachers: [], classes: [] };
    const q = query.toLowerCase();

    const matchedStudents = db.students.filter(
      s =>
        s.name.toLowerCase().includes(q) ||
        s.rollNumber.includes(q) ||
        s.admissionNumber.toLowerCase().includes(q) ||
        s.parentName.toLowerCase().includes(q)
    );

    const matchedTeachers = db.users.filter(
      u =>
        u.role === 'teacher' &&
        (u.name.toLowerCase().includes(q) ||
          (u.teacherCode && u.teacherCode.toLowerCase().includes(q)) ||
          (u.subject && u.subject.toLowerCase().includes(q)))
    );

    const matchedClasses = db.classes.filter(
      c => c.name.toLowerCase().includes(q) || c.section.toLowerCase().includes(q)
    );

    return {
      students: matchedStudents.slice(0, 5),
      teachers: matchedTeachers.slice(0, 4),
      classes: matchedClasses.slice(0, 3),
    };
  }, [db, query]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-16 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-lg rounded-3xl bg-white/85 backdrop-blur-xl border border-white/60 shadow-2xl overflow-hidden">
        {/* Search Input Box */}
        <div className="relative border-b border-black/5 p-4 flex items-center">
          <Search className="h-5 w-5 text-[#F27D26] mr-3 shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search students, teachers, roll numbers, classes..."
            className="w-full text-sm font-bold text-[#1A2B48] placeholder-[#1A2B48]/40 focus:outline-none bg-transparent"
          />
          <button
            onClick={onClose}
            className="rounded-full p-1 text-[#1A2B48]/40 hover:bg-black/5"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Results List */}
        <div className="p-4 max-h-[65vh] overflow-y-auto space-y-4">
          {!query.trim() ? (
            <div className="py-8 text-center text-xs text-slate-400">
              Type student name, roll number, teacher or class to search across school...
            </div>
          ) : searchResults.students.length === 0 &&
            searchResults.teachers.length === 0 &&
            searchResults.classes.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              No matching school records found for "{query}".
            </div>
          ) : (
            <>
              {/* Students */}
              {searchResults.students.length > 0 && (
                <div>
                  <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">
                    Students
                  </span>
                  <div className="mt-1.5 space-y-1">
                    {searchResults.students.map(s => (
                      <div
                        key={s.id}
                        onClick={() => {
                          onSelectStudent(s.id);
                          onClose();
                        }}
                        className="cursor-pointer flex items-center justify-between rounded-xl p-2 hover:bg-orange-50 transition-colors"
                      >
                        <div className="flex items-center space-x-2.5">
                          <img
                            src={
                              s.photoUrl ||
                              `https://api.dicebear.com/7.x/adventurer/svg?seed=${s.name}`
                            }
                            alt={s.name}
                            className="h-8 w-8 rounded-full object-cover border border-orange-200"
                          />
                          <div>
                            <span className="font-bold text-xs text-slate-800">{s.name}</span>
                            <span className="text-[11px] text-slate-500 block">
                              {s.className} • Roll #{s.rollNumber}
                            </span>
                          </div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-orange-400" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Teachers */}
              {searchResults.teachers.length > 0 && (
                <div>
                  <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">
                    Teachers
                  </span>
                  <div className="mt-1.5 space-y-1">
                    {searchResults.teachers.map(t => (
                      <div
                        key={t.id}
                        onClick={() => {
                          onNavigateTab('teachers');
                          onClose();
                        }}
                        className="cursor-pointer flex items-center justify-between rounded-xl p-2 hover:bg-blue-50 transition-colors"
                      >
                        <div className="flex items-center space-x-2.5">
                          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-100 font-bold text-blue-700 text-xs">
                            {t.name.charAt(0)}
                          </div>
                          <div>
                            <span className="font-bold text-xs text-slate-800">{t.name}</span>
                            <span className="text-[11px] text-slate-500 block">
                              Code: {t.teacherCode} • {t.assignedClassName}
                            </span>
                          </div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-blue-400" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Classes */}
              {searchResults.classes.length > 0 && (
                <div>
                  <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">
                    Classes
                  </span>
                  <div className="mt-1.5 space-y-1">
                    {searchResults.classes.map(c => (
                      <div
                        key={c.id}
                        onClick={() => {
                          onNavigateTab('students', { classId: c.id });
                          onClose();
                        }}
                        className="cursor-pointer flex items-center justify-between rounded-xl p-2 hover:bg-amber-50 transition-colors"
                      >
                        <div className="flex items-center space-x-2.5">
                          <BookOpen className="h-4 w-4 text-amber-600" />
                          <span className="font-bold text-xs text-slate-800">
                            {c.name} - Section {c.section}
                          </span>
                        </div>
                        <ArrowRight className="h-4 w-4 text-amber-400" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
