import React, { useState, useEffect } from 'react';
import {
  X,
  Award,
  Plus,
  Trash2,
  Save,
  CheckCircle2,
  User,
  GraduationCap,
  Sparkles,
} from 'lucide-react';
import { useSchool } from '../../context/SchoolContext';
import { Student, SubjectMarks, StudentResult } from '../../types';
import { getTodayDateString, calculateGrade } from '../../utils/helpers';

interface AddResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  student?: Student | null;
  initialClassId?: string;
  onSaved?: (newResult: StudentResult) => void;
}

export const AddResultModal: React.FC<AddResultModalProps> = ({
  isOpen,
  onClose,
  student: initialStudent,
  initialClassId,
  onSaved,
}) => {
  const { db, addResult, currentUser } = useSchool();

  const [selectedStudentId, setSelectedStudentId] = useState<string>(
    initialStudent?.id || ''
  );
  const [selectedClassId, setSelectedClassId] = useState<string>(
    initialStudent?.classId ||
      initialClassId ||
      currentUser?.assignedClassId ||
      db.classes[0]?.id ||
      'cls_05'
  );

  const [examName, setExamName] = useState('Annual Final Examination 2025-26');
  const [examDate, setExamDate] = useState(getTodayDateString());
  const [remarks, setRemarks] = useState('Excellent performance throughout the academic session.');

  // Default subjects
  const [subjects, setSubjects] = useState<SubjectMarks[]>([
    { subject: 'Mathematics', maxMarks: 100, obtainedMarks: 90, grade: 'A+' },
    { subject: 'Science', maxMarks: 100, obtainedMarks: 85, grade: 'A' },
    { subject: 'English', maxMarks: 100, obtainedMarks: 82, grade: 'A' },
    { subject: 'Hindi', maxMarks: 100, obtainedMarks: 88, grade: 'A' },
    { subject: 'Social Studies', maxMarks: 100, obtainedMarks: 86, grade: 'A' },
  ]);

  const classStudents = db.students.filter(
    s => s.classId === selectedClassId && s.status === 'active'
  );

  useEffect(() => {
    if (initialStudent) {
      setSelectedStudentId(initialStudent.id);
      setSelectedClassId(initialStudent.classId);
    } else if (classStudents.length > 0 && !selectedStudentId) {
      setSelectedStudentId(classStudents[0].id);
    }
  }, [initialStudent, selectedClassId, classStudents]);

  if (!isOpen) return null;

  const currentStudent =
    db.students.find(s => s.id === selectedStudentId) ||
    initialStudent ||
    classStudents[0];

  const updateSubjectMarks = (index: number, field: keyof SubjectMarks, value: any) => {
    setSubjects(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      if (field === 'obtainedMarks' || field === 'maxMarks') {
        const obt = Number(updated[index].obtainedMarks) || 0;
        const max = Number(updated[index].maxMarks) || 100;
        const pct = max > 0 ? (obt / max) * 100 : 0;
        updated[index].grade = calculateGrade(pct);
      }
      return updated;
    });
  };

  const addSubjectRow = () => {
    setSubjects(prev => [
      ...prev,
      { subject: 'Computer Science', maxMarks: 100, obtainedMarks: 90, grade: 'A+' },
    ]);
  };

  const removeSubjectRow = (index: number) => {
    if (subjects.length <= 1) return;
    setSubjects(prev => prev.filter((_, i) => i !== index));
  };

  const totalMax = subjects.reduce((a, b) => a + Number(b.maxMarks || 0), 0);
  const totalObt = subjects.reduce((a, b) => a + Number(b.obtainedMarks || 0), 0);
  const overallPercentage = totalMax > 0 ? Number(((totalObt / totalMax) * 100).toFixed(1)) : 0;
  const overallGrade = calculateGrade(overallPercentage);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentStudent) {
      alert('Please select a student first');
      return;
    }

    const saved = addResult({
      studentId: currentStudent.id,
      studentName: currentStudent.name,
      rollNumber: currentStudent.rollNumber,
      classId: currentStudent.classId,
      className: currentStudent.className,
      examName,
      examDate,
      academicYear: currentStudent.academicYear || db.schoolInfo.currentAcademicYear || '2025-26',
      subjects,
      totalMarks: totalObt,
      totalMaxMarks: totalMax,
      percentage: overallPercentage,
      grade: overallGrade,
      remarks,
    });

    onClose();
    if (onSaved && saved) {
      onSaved(saved);
    }
  };

  const examPresets = [
    'Annual Final Examination 2025-26',
    'Half-Yearly Examination 2025-26',
    'Quarterly Examination',
    'Unit Test 1 (Formative Assessment)',
    'Unit Test 2',
    'Periodic Test 1',
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-2 sm:p-4 backdrop-blur-sm animate-in fade-in overflow-y-auto">
      <div className="w-full max-w-xl rounded-3xl bg-white shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 p-5 text-white shrink-0">
          <div className="flex items-center space-x-2.5">
            <Award className="h-6 w-6 text-amber-300" />
            <div>
              <h3 className="text-base sm:text-lg font-black">Create Student Marksheet / Report Card</h3>
              <p className="text-[11px] text-purple-100">
                {currentStudent ? `${currentStudent.name} • ${currentStudent.className} (Roll #${currentStudent.rollNumber})` : 'Enter Subject Marks & Grades'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full bg-white/20 p-1.5 text-white hover:bg-white/30 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1">
          {/* Class & Student Selection if not locked */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-purple-50/60 p-3.5 rounded-2xl border border-purple-100">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Select Class *
              </label>
              <select
                value={selectedClassId}
                onChange={e => {
                  setSelectedClassId(e.target.value);
                  const firstInClass = db.students.find(
                    s => s.classId === e.target.value && s.status === 'active'
                  );
                  if (firstInClass) setSelectedStudentId(firstInClass.id);
                }}
                className="w-full rounded-xl border border-purple-200 bg-white py-2 px-3 text-xs font-bold text-slate-800 focus:border-purple-500 focus:outline-none"
              >
                {db.classes.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} - Section {c.section}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Select Student *
              </label>
              <select
                value={selectedStudentId}
                onChange={e => setSelectedStudentId(e.target.value)}
                className="w-full rounded-xl border border-purple-200 bg-white py-2 px-3 text-xs font-bold text-slate-800 focus:border-purple-500 focus:outline-none"
              >
                {classStudents.length === 0 ? (
                  <option value="">No students in this class</option>
                ) : (
                  classStudents.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} (Roll #{s.rollNumber})
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          {/* Exam Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Examination Title *
              </label>
              <input
                type="text"
                required
                value={examName}
                onChange={e => setExamName(e.target.value)}
                placeholder="e.g. Annual Final Examination"
                className="w-full rounded-xl border border-slate-200 py-2 px-3 text-xs font-bold text-slate-800 focus:border-purple-500 focus:outline-none"
              />
              {/* Quick Exam Presets */}
              <div className="mt-1.5 flex flex-wrap gap-1">
                {examPresets.slice(0, 3).map(preset => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setExamName(preset)}
                    className="text-[10px] bg-slate-100 hover:bg-purple-100 text-slate-600 hover:text-purple-800 px-2 py-0.5 rounded-md font-semibold transition-colors"
                  >
                    {preset.split(' ')[0]} {preset.split(' ')[1]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Examination Date
              </label>
              <input
                type="date"
                value={examDate}
                onChange={e => setExamDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 py-2 px-3 text-xs font-bold text-slate-800 focus:border-purple-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Subject Marks Table */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between pb-1">
              <span className="text-xs font-bold text-slate-700">Subject Marks Breakdown</span>
              <button
                type="button"
                onClick={addSubjectRow}
                className="inline-flex items-center space-x-1 text-xs font-bold text-purple-700 hover:text-purple-900 bg-purple-100/60 px-2.5 py-1 rounded-lg"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Subject</span>
              </button>
            </div>

            <div className="space-y-2">
              {subjects.map((sub, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    required
                    value={sub.subject}
                    onChange={e => updateSubjectMarks(idx, 'subject', e.target.value)}
                    placeholder="Subject Name"
                    className="flex-1 rounded-xl border border-slate-200 bg-white py-1.5 px-3 text-xs font-bold text-slate-800"
                  />
                  <input
                    type="number"
                    required
                    min={0}
                    max={sub.maxMarks}
                    value={sub.obtainedMarks}
                    onChange={e => updateSubjectMarks(idx, 'obtainedMarks', Number(e.target.value))}
                    placeholder="Obt"
                    className="w-16 rounded-xl border border-slate-200 bg-white py-1.5 px-2 text-xs font-black text-center text-slate-800"
                  />
                  <span className="text-xs text-slate-400 font-bold">/</span>
                  <input
                    type="number"
                    required
                    min={1}
                    value={sub.maxMarks}
                    onChange={e => updateSubjectMarks(idx, 'maxMarks', Number(e.target.value))}
                    placeholder="Max"
                    className="w-16 rounded-xl border border-slate-200 bg-white py-1.5 px-2 text-xs font-bold text-center text-slate-800"
                  />
                  <span className="w-9 text-center text-xs font-black text-purple-700 bg-purple-100 py-1 rounded-lg">
                    {sub.grade}
                  </span>
                  {subjects.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeSubjectRow(idx)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Computed Score Bar */}
          <div className="rounded-2xl bg-gradient-to-r from-purple-50 to-indigo-50 p-4 border border-purple-200 flex items-center justify-between shadow-xs">
            <div>
              <span className="text-[10px] uppercase font-bold text-purple-800 block">
                Calculated Grand Total
              </span>
              <p className="text-base font-black text-purple-950">
                {totalObt} / {totalMax} Marks ({overallPercentage}%)
              </p>
            </div>
            <div className="text-right">
              <span className="rounded-xl bg-purple-600 px-3.5 py-1.5 text-xs font-black text-white shadow-xs">
                Grade {overallGrade} ({overallPercentage >= 33 ? 'PASS' : 'FAIL'})
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Class Teacher's Observation & Remark
            </label>
            <input
              type="text"
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
              placeholder="e.g. Outstanding analytical thinking in Science and Mathematics!"
              className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-xs font-medium text-slate-800 focus:border-purple-500 focus:outline-none"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="w-full rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 py-3 text-xs font-black text-white shadow-lg shadow-purple-600/25 hover:from-purple-700 hover:to-indigo-700 active:scale-95 transition-all flex items-center justify-center space-x-2"
            >
              <Save className="h-4 w-4" />
              <span>SAVE & PUBLISH OFFICIAL MARKSHEET</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

