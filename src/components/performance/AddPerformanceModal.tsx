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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 sm:p-4 backdrop-blur-md animate-in fade-in overflow-y-auto">
      <div className="w-full max-w-md bg-[#1a1a1a] border border-[#3c3c3c] shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col font-mono text-[#e6e6e6]">
        {/* M-Stripe bar */}
        <div className="m-stripe" />

        {/* Header */}
        <div className="flex items-center justify-between bg-black p-5 border-b border-[#3c3c3c] text-white shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="flex h-8 w-8 items-center justify-center bg-[#1a1a1a] border border-[#3c3c3c] text-[#1c69d4]">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-bold uppercase tracking-[1.5px]">LOG PERFORMANCE OBSERVATION</h3>
              <p className="text-[10px] text-[#7e7e7e] uppercase">{student.name} • {student.className}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="bg-[#1a1a1a] border border-[#3c3c3c] p-1.5 text-white hover:border-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 overflow-y-auto font-mono">
          <div>
            <label className="block text-[10px] font-bold text-[#7e7e7e] uppercase tracking-[1px] mb-1">
              CATEGORY *
            </label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value as any)}
              className="w-full bg-black border border-[#3c3c3c] py-2 px-3 text-xs font-bold text-white focus:border-white focus:outline-none uppercase"
            >
              <option value="academic">ACADEMIC EXCELLENCE</option>
              <option value="behavior">CONDUCT & DISCIPLINE</option>
              <option value="attendance">ATTENDANCE & PUNCTUALITY</option>
              <option value="sports">ATHLETICS & SPORTS</option>
              <option value="creativity">INNOVATION & ARTS</option>
              <option value="leadership">COMMAND & LEADERSHIP</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-[#7e7e7e] uppercase tracking-[1px] mb-1">
              ASSESSMENT LEVEL *
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'outstanding', label: 'OUTSTANDING', color: 'border-[#0fa336] text-[#0fa336]' },
                { id: 'good', label: 'COMMENDABLE', color: 'border-[#1c69d4] text-[#1c69d4]' },
                { id: 'satisfactory', label: 'ACCEPTABLE', color: 'border-amber-500 text-amber-400' },
                { id: 'needs_attention', label: 'NEEDS ATTENTION', color: 'border-[#e22718] text-[#e22718]' },
              ].map(item => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setRating(item.id as any)}
                  className={`py-2 px-3 text-[10px] font-bold uppercase tracking-[1px] transition-all border ${
                    rating === item.id
                      ? 'bg-white text-black border-white'
                      : `bg-black ${item.color}`
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-[#7e7e7e] uppercase tracking-[1px] mb-1">
              INSTRUCTOR DETAILED OBSERVATION *
            </label>
            <textarea
              required
              rows={3}
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
              placeholder="Record cadet progress, attitude, and tactical participation..."
              className="w-full bg-black border border-[#3c3c3c] py-2 px-3 text-xs font-bold text-white focus:border-white focus:outline-none uppercase"
            />
          </div>

          <div className="grid grid-cols-1 gap-2.5">
            <div>
              <label className="block text-[10px] font-bold text-[#7e7e7e] uppercase tracking-[1px] mb-1">
                DEMONSTRATED STRENGTHS
              </label>
              <input
                type="text"
                value={strengths}
                onChange={e => setStrengths(e.target.value)}
                placeholder="e.g. Quick problem solver, active communicator"
                className="w-full bg-black border border-[#3c3c3c] py-2 px-3 text-xs font-bold text-white focus:border-white focus:outline-none uppercase"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-[#7e7e7e] uppercase tracking-[1px] mb-1">
                AREAS FOR DEVELOPMENT
              </label>
              <input
                type="text"
                value={areasToImprove}
                onChange={e => setAreasToImprove(e.target.value)}
                placeholder="e.g. Requires additional focus in geometry modules"
                className="w-full bg-black border border-[#3c3c3c] py-2 px-3 text-xs font-bold text-white focus:border-white focus:outline-none uppercase"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="w-full bg-white text-black py-3 text-xs font-bold uppercase tracking-[1.5px] hover:bg-[#e6e6e6] active:scale-95 transition-all flex items-center justify-center space-x-2"
            >
              <Save className="h-4 w-4 text-[#1c69d4]" />
              <span>COMMIT OBSERVATION</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
