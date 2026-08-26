import React, { useState, useMemo } from 'react';
import {
  Calendar,
  ArrowRight,
  GraduationCap,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Users,
  Save,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useSchool } from '../../context/SchoolContext';

export const AcademicYearView: React.FC = () => {
  const { db, promoteStudents, updateSchoolSettings } = useSchool();

  const [currentYear, setCurrentYear] = useState(db.schoolInfo.currentAcademicYear);
  const [sourceClassId, setSourceClassId] = useState(db.classes[0]?.id || 'cls_05');
  const [targetClassId, setTargetClassId] = useState(db.classes[1]?.id || 'cls_06');
  const [nextAcademicYear, setNextAcademicYear] = useState('2026-27');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [promotionSuccessMsg, setPromotionSuccessMsg] = useState<string | null>(null);

  // Active students in source class
  const sourceStudents = useMemo(() => {
    return db.students.filter(s => s.classId === sourceClassId && s.status === 'active');
  }, [db.students, sourceClassId]);

  const selectAll = () => {
    setSelectedStudentIds(sourceStudents.map(s => s.id));
  };

  const clearAll = () => {
    setSelectedStudentIds([]);
  };

  const toggleStudent = (id: string) => {
    setSelectedStudentIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handlePromote = () => {
    if (selectedStudentIds.length === 0) return;

    const sourceClass = db.classes.find(c => c.id === sourceClassId);
    const targetClass = db.classes.find(c => c.id === targetClassId);

    promoteStudents(selectedStudentIds, targetClassId, nextAcademicYear);

    try {
      confetti({
        particleCount: 80,
        spread: 80,
        origin: { y: 0.6 },
      });
    } catch {}

    setPromotionSuccessMsg(
      `Successfully promoted ${selectedStudentIds.length} students from ${sourceClass?.name} to ${targetClass?.name} for session ${nextAcademicYear}!`
    );

    setSelectedStudentIds([]);
    setTimeout(() => setPromotionSuccessMsg(null), 5000);
  };

  const handleSetCurrentAcademicYear = (e: React.FormEvent) => {
    e.preventDefault();
    updateSchoolSettings({ currentAcademicYear: currentYear });
  };

  const sourceClassObj = db.classes.find(c => c.id === sourceClassId);
  const targetClassObj = db.classes.find(c => c.id === targetClassId);

  return (
    <div className="space-y-5 pb-16">
      {/* Header */}
      <div className="rounded-3xl border border-orange-100 bg-white p-4 sm:p-5 shadow-sm">
        <div className="flex items-center space-x-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-100 text-orange-600">
            <Calendar className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900">
              Academic Session & Student Promotion Engine
            </h2>
            <p className="text-xs text-slate-500">
              Batch promote students to next classes while preserving full permanent historical records
            </p>
          </div>
        </div>
      </div>

      {/* Current Session Setting */}
      <div className="rounded-3xl border border-orange-100 bg-white p-5 shadow-xs">
        <h3 className="font-extrabold text-sm text-slate-900 mb-2">
          Active School Session
        </h3>
        <form onSubmit={handleSetCurrentAcademicYear} className="flex flex-col sm:flex-row items-center gap-3">
          <input
            type="text"
            value={currentYear}
            onChange={e => setCurrentYear(e.target.value)}
            placeholder="e.g. 2025-26"
            className="w-full sm:w-64 rounded-xl border border-slate-200 py-2 px-3 text-xs font-bold text-slate-800 focus:border-orange-500 focus:outline-none font-mono"
          />
          <button
            type="submit"
            className="w-full sm:w-auto rounded-xl bg-orange-600 px-4 py-2 text-xs font-bold text-white hover:bg-orange-700 active:scale-95 transition-all"
          >
            Update Active Session
          </button>
        </form>
      </div>

      {/* Student Promotion Workspace */}
      <div className="rounded-3xl border border-orange-200 bg-gradient-to-br from-orange-50/50 via-white to-amber-50/40 p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex items-center space-x-2">
          <Sparkles className="h-5 w-5 text-orange-600" />
          <h3 className="font-extrabold text-slate-900 text-base">
            Annual Class Promotion Workflow
          </h3>
        </div>

        {promotionSuccessMsg && (
          <div className="rounded-2xl bg-emerald-600 p-4 text-xs font-bold text-white shadow-md flex items-center space-x-2 animate-in fade-in">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <span>{promotionSuccessMsg}</span>
          </div>
        )}

        {/* Promotion Mapping Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-2xl bg-white border border-orange-100 shadow-xs">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Source Class (Promoting From)
            </label>
            <select
              value={sourceClassId}
              onChange={e => {
                setSourceClassId(e.target.value);
                setSelectedStudentIds([]);
              }}
              className="w-full rounded-xl border border-slate-200 py-2 px-3 text-xs font-bold text-slate-800 focus:border-orange-500 focus:outline-none bg-white"
            >
              {db.classes.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} - Sec {c.section}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Target Class (Promoting To)
            </label>
            <select
              value={targetClassId}
              onChange={e => setTargetClassId(e.target.value)}
              className="w-full rounded-xl border border-slate-200 py-2 px-3 text-xs font-bold text-slate-800 focus:border-orange-500 focus:outline-none bg-white"
            >
              {db.classes.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} - Sec {c.section}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Target Academic Session
            </label>
            <input
              type="text"
              value={nextAcademicYear}
              onChange={e => setNextAcademicYear(e.target.value)}
              placeholder="2026-27"
              className="w-full rounded-xl border border-slate-200 py-2 px-3 text-xs font-bold text-slate-800 focus:border-orange-500 focus:outline-none font-mono"
            />
          </div>
        </div>

        {/* Student Selection Checklist */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div>
              <h4 className="font-extrabold text-xs text-slate-900">
                Select Students in {sourceClassObj?.name} ({sourceStudents.length} Available)
              </h4>
              <p className="text-[11px] text-slate-500">
                {selectedStudentIds.length} students selected for promotion to {targetClassObj?.name}
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={selectAll}
                className="rounded-lg bg-orange-100 px-2.5 py-1 text-xs font-bold text-orange-800 hover:bg-orange-200"
              >
                Select All
              </button>
              <button
                type="button"
                onClick={clearAll}
                className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600 hover:bg-slate-200"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
            {sourceStudents.map(student => {
              const isChecked = selectedStudentIds.includes(student.id);

              return (
                <div
                  key={student.id}
                  onClick={() => toggleStudent(student.id)}
                  className={`cursor-pointer flex items-center justify-between rounded-xl p-2.5 border transition-all ${
                    isChecked
                      ? 'border-orange-400 bg-orange-50/70 shadow-xs'
                      : 'border-slate-100 bg-slate-50/50 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {}}
                      className="h-4 w-4 rounded text-orange-600 focus:ring-orange-500 pointer-events-none"
                    />
                    <img
                      src={
                        student.photoUrl ||
                        `https://api.dicebear.com/7.x/adventurer/svg?seed=${student.name}`
                      }
                      alt={student.name}
                      className="h-8 w-8 rounded-full object-cover border border-slate-200"
                    />
                    <div className="truncate">
                      <span className="font-bold text-xs text-slate-800 block truncate">
                        {student.name}
                      </span>
                      <span className="text-[10px] text-slate-500">Roll #{student.rollNumber}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-2">
            <button
              type="button"
              disabled={selectedStudentIds.length === 0}
              onClick={handlePromote}
              className={`w-full rounded-xl py-3 text-xs font-black text-white shadow-lg transition-all flex items-center justify-center space-x-2 ${
                selectedStudentIds.length > 0
                  ? 'bg-gradient-to-r from-orange-500 to-amber-600 shadow-orange-500/25 hover:from-orange-600 hover:to-amber-700 active:scale-95'
                  : 'bg-slate-300 cursor-not-allowed'
              }`}
            >
              <Sparkles className="h-4 w-4" />
              <span>
                PROMOTE {selectedStudentIds.length} STUDENTS TO {targetClassObj?.name?.toUpperCase()}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
