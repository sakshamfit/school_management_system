import React, { useState, useMemo } from 'react';
import {
  Search,
  X,
  BookOpen,
  ArrowRight,
} from 'lucide-react';
import { useSchool } from '../context/SchoolContext';

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
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-16 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-lg bg-white rounded-[20px] border border-[#e5e5ea] shadow-2xl overflow-hidden text-[#1d1d1f]">
        {/* Search Input Box */}
        <div className="relative border-b border-[#f0f0f0] p-4 flex items-center bg-white">
          <Search className="h-4 w-4 text-[#0066cc] mr-3 shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search students, roll no, teachers, class..."
            className="w-full text-sm font-medium text-[#1d1d1f] placeholder-[#86868b] focus:outline-none bg-transparent"
          />
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-[#f5f5f7] text-[#86868b] hover:text-[#1d1d1f] flex items-center justify-center transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Results List */}
        <div className="p-4 max-h-[65vh] overflow-y-auto space-y-4">
          {!query.trim() ? (
            <div className="py-8 text-center text-xs text-[#86868b]">
              Type a student name, roll number, teacher, or class to search...
            </div>
          ) : searchResults.students.length === 0 &&
            searchResults.teachers.length === 0 &&
            searchResults.classes.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#86868b]">
              No matching records found for "{query}".
            </div>
          ) : (
            <>
              {/* Students */}
              {searchResults.students.length > 0 && (
                <div>
                  <span className="text-xs font-semibold text-[#86868b] uppercase tracking-wider px-1">
                    Students ({searchResults.students.length})
                  </span>
                  <div className="mt-2 space-y-1.5">
                    {searchResults.students.map(s => (
                      <div
                        key={s.id}
                        onClick={() => {
                          onSelectStudent(s.id);
                          onClose();
                        }}
                        className="cursor-pointer flex items-center justify-between p-3 bg-white rounded-xl border border-[#e5e5ea] hover:border-[#0066cc]/40 hover:bg-[#0066cc]/5 transition-all"
                      >
                        <div className="flex items-center space-x-3">
                          <img
                            src={
                              s.photoUrl ||
                              `https://api.dicebear.com/7.x/adventurer/svg?seed=${s.name}`
                            }
                            alt={s.name}
                            className="h-9 w-9 rounded-full object-cover bg-white apple-product-shadow"
                          />
                          <div>
                            <span className="font-semibold text-xs text-[#1d1d1f] block">{s.name}</span>
                            <span className="text-[11px] text-[#86868b]">
                              {s.className} • Roll #{s.rollNumber} • Adm #{s.admissionNumber}
                            </span>
                          </div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-[#0066cc]" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Teachers */}
              {searchResults.teachers.length > 0 && (
                <div>
                  <span className="text-xs font-semibold text-[#86868b] uppercase tracking-wider px-1">
                    Teachers ({searchResults.teachers.length})
                  </span>
                  <div className="mt-2 space-y-1.5">
                    {searchResults.teachers.map(t => (
                      <div
                        key={t.id}
                        onClick={() => {
                          onNavigateTab('teachers');
                          onClose();
                        }}
                        className="cursor-pointer flex items-center justify-between p-3 bg-white rounded-xl border border-[#e5e5ea] hover:border-[#0066cc]/40 hover:bg-[#0066cc]/5 transition-all"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0066cc]/10 text-[#0066cc] font-semibold text-xs">
                            {t.name.charAt(0)}
                          </div>
                          <div>
                            <span className="font-semibold text-xs text-[#1d1d1f] block">{t.name}</span>
                            <span className="text-[11px] text-[#86868b]">
                              Code: {t.teacherCode} • {t.assignedClassName || t.subject}
                            </span>
                          </div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-[#0066cc]" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Classes */}
              {searchResults.classes.length > 0 && (
                <div>
                  <span className="text-xs font-semibold text-[#86868b] uppercase tracking-wider px-1">
                    Classes ({searchResults.classes.length})
                  </span>
                  <div className="mt-2 space-y-1.5">
                    {searchResults.classes.map(c => (
                      <div
                        key={c.id}
                        onClick={() => {
                          onNavigateTab('students', { classId: c.id });
                          onClose();
                        }}
                        className="cursor-pointer flex items-center justify-between p-3 bg-white rounded-xl border border-[#e5e5ea] hover:border-[#0066cc]/40 hover:bg-[#0066cc]/5 transition-all"
                      >
                        <div className="flex items-center space-x-3">
                          <BookOpen className="h-4 w-4 text-[#0066cc]" />
                          <span className="font-semibold text-xs text-[#1d1d1f]">
                            {c.name} - Section {c.section}
                          </span>
                        </div>
                        <ArrowRight className="h-4 w-4 text-[#0066cc]" />
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
