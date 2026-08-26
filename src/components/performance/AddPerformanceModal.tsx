import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Save,
  Star,
  CheckCircle2,
} from 'lucide-react';
import { useSchool } from '../../context/SchoolContext';
import { Student, PerformanceCategory, PerformanceRating } from '../../types';
import { getTodayDateString } from '../../utils/helpers';

interface AddPerformanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student | null;
}

export const AddPerformanceModal: React.FC<AddPerformanceModalProps> = ({
  isOpen,
  onClose,
  student,
}) => {
  const { addPerformance, currentUser } = useSchool();

  if (!isOpen || !student) return null;

  const [category, setCategory] = useState<PerformanceCategory>('academic');
  const [rating, setRating] = useState<PerformanceRating>('outstanding');
  const [remarks, setRemarks] = useState('');
  const [strengths, setStrengths] = useState('');
  const [areasToImprove, setAreasToImprove] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!remarks.trim()) return;

    addPerformance({
      studentId: student.id,
      studentName: student.name,
      classId: student.classId,
      className: student.className,
      category,
      rating,
      remarks,
      strengths,
      areasToImprove,
      date: getTodayDateString(),
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 sm:p-4 backdrop-blur-sm animate-in fade-in overflow-y-auto">
      <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between bg-gradient-to-r from-purple-600 to-pink-600 p-5 text-white shrink-0">
          <div className="flex items-center space-x-2">
            <Sparkles className="h-6 w-6" />
            <div>
              <h3 className="text-base font-black">Add Performance Remark</h3>
              <p className="text-[11px] text-pink-100">{student.name} • {student.className}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full bg-white/20 p-1.5 text-white hover:bg-white/30"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 overflow-y-auto">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Category *
            </label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value as any)}
              className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-xs font-bold text-slate-800 focus:border-purple-500 focus:outline-none bg-white"
            >
              <option value="academic">Academic Excellence</option>
              <option value="behavior">Classroom Behavior & Discipline</option>
              <option value="attendance">Attendance & Punctuality</option>
              <option value="sports">Sports & Physical Activities</option>
              <option value="creativity">Art, Music & Creativity</option>
              <option value="leadership">Leadership & Teamwork</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Rating Level *
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'outstanding', label: '🌟 Outstanding', color: 'bg-emerald-50 text-emerald-800 border-emerald-300' },
                { id: 'good', label: '👍 Good', color: 'bg-blue-50 text-blue-800 border-blue-300' },
                { id: 'satisfactory', label: '👌 Satisfactory', color: 'bg-amber-50 text-amber-800 border-amber-300' },
                { id: 'needs_attention', label: '⚠️ Needs Attention', color: 'bg-rose-50 text-rose-800 border-rose-300' },
              ].map(item => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setRating(item.id as any)}
                  className={`rounded-xl py-2 px-3 text-xs font-bold transition-all border ${
                    rating === item.id
                      ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                      : item.color
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Teacher's Detailed Observation *
            </label>
            <textarea
              required
              rows={3}
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
              placeholder="Describe the student's progress, attitude, and participation..."
              className="w-full rounded-xl border border-slate-200 py-2 px-3 text-xs font-medium text-slate-800 focus:border-purple-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 gap-2.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                🌟 Key Strengths
              </label>
              <input
                type="text"
                value={strengths}
                onChange={e => setStrengths(e.target.value)}
                placeholder="e.g. Quick problem solver, active speaker"
                className="w-full rounded-xl border border-slate-200 py-2 px-3 text-xs font-medium text-slate-800 focus:border-purple-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                🎯 Areas for Improvement
              </label>
              <input
                type="text"
                value={areasToImprove}
                onChange={e => setAreasToImprove(e.target.value)}
                placeholder="e.g. Needs more practice in geometry homework"
                className="w-full rounded-xl border border-slate-200 py-2 px-3 text-xs font-medium text-slate-800 focus:border-purple-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="w-full rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 py-3 text-xs font-black text-white shadow-lg shadow-purple-600/25 hover:from-purple-700 hover:to-pink-700 active:scale-95 transition-all flex items-center justify-center space-x-2"
            >
              <Save className="h-4 w-4" />
              <span>SAVE PERFORMANCE NOTE</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
