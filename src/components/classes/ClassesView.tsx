import React, { useState } from 'react';
import {
  BookOpen,
  PlusCircle,
  Users,
  GraduationCap,
  ArrowRight,
  UserCheck,
  Save,
  X,
} from 'lucide-react';
import { useSchool } from '../../context/SchoolContext';

interface ClassesViewProps {
  onNavigateToStudents: (classId: string) => void;
}

export const ClassesView: React.FC<ClassesViewProps> = ({ onNavigateToStudents }) => {
  const { db, addClass, updateClass } = useSchool();
  const [showAddModal, setShowAddModal] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newSection, setNewSection] = useState('A');
  const [newTeacherId, setNewTeacherId] = useState('');

  const activeTeachers = db.users.filter(u => u.role === 'teacher' && u.status === 'active');

  const handleCreateClass = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim()) return;

    const teacher = activeTeachers.find(t => t.id === newTeacherId);

    addClass({
      name: newClassName,
      section: newSection,
      classTeacherId: newTeacherId || undefined,
      classTeacherName: teacher?.name || undefined,
    });

    setShowAddModal(false);
    setNewClassName('');
  };

  return (
    <div className="space-y-4 pb-16">
      {/* Header */}
      <div className="rounded-3xl border border-orange-100 bg-white p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-100 text-orange-600">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900">
                School Classes & Grades
              </h2>
              <p className="text-xs text-slate-500">
                Manage classroom sections, student capacities, and assigned class teachers
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center space-x-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 px-4 py-2 text-xs font-black text-white shadow-md shadow-orange-500/25 hover:from-orange-600 hover:to-amber-700 active:scale-95 transition-all"
          >
            <PlusCircle className="h-4 w-4" />
            <span>+ Add New Class</span>
          </button>
        </div>
      </div>

      {/* Classes Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {db.classes.map(c => {
          const classStudents = db.students.filter(
            s => s.classId === c.id && s.status === 'active'
          );
          const teacher = db.users.find(u => u.id === c.classTeacherId);

          return (
            <div
              key={c.id}
              className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs hover:border-orange-300 hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-base font-black text-slate-900">{c.name}</span>
                  <span className="rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-extrabold text-orange-800">
                    Section {c.section}
                  </span>
                </div>

                <div className="mt-4 rounded-xl bg-slate-50 p-3 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <GraduationCap className="h-4 w-4 text-orange-600" />
                    <span className="text-xs font-bold text-slate-700">Enrolled Students</span>
                  </div>
                  <span className="text-sm font-black text-slate-900">
                    {classStudents.length} Students
                  </span>
                </div>

                <div className="mt-3 text-xs text-slate-600">
                  <span className="text-slate-400 block text-[10px]">Class Teacher:</span>
                  <p className="font-bold text-slate-800 mt-0.5">
                    {teacher ? `👩‍🏫 ${teacher.name}` : '⚠️ No teacher assigned'}
                  </p>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100">
                <button
                  onClick={() => onNavigateToStudents(c.id)}
                  className="w-full inline-flex items-center justify-center space-x-1.5 rounded-xl bg-orange-50 hover:bg-orange-100 py-2 text-xs font-bold text-orange-800 transition-colors"
                >
                  <span>View {c.name} Student Roster</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Class Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-extrabold text-base text-slate-900">Add New Class Section</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateClass} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Class Name *
                </label>
                <input
                  type="text"
                  required
                  value={newClassName}
                  onChange={e => setNewClassName(e.target.value)}
                  placeholder="e.g. Class 11"
                  className="w-full rounded-xl border border-slate-200 py-2 px-3 text-xs font-bold text-slate-800 focus:border-orange-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Section
                </label>
                <input
                  type="text"
                  required
                  value={newSection}
                  onChange={e => setNewSection(e.target.value.toUpperCase())}
                  placeholder="A"
                  className="w-full rounded-xl border border-slate-200 py-2 px-3 text-xs font-bold text-slate-800 focus:border-orange-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Assign Class Teacher
                </label>
                <select
                  value={newTeacherId}
                  onChange={e => setNewTeacherId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 py-2 px-3 text-xs font-bold text-slate-800 focus:border-orange-500 focus:outline-none bg-white"
                >
                  <option value="">-- Select Teacher --</option>
                  {activeTeachers.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.subject || 'Faculty'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full rounded-xl bg-orange-600 py-2.5 text-xs font-bold text-white shadow-md hover:bg-orange-700 active:scale-95 transition-all"
                >
                  Create Class
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
