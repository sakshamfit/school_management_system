import React, { useState } from 'react';
import {
  BookOpen,
  PlusCircle,
  GraduationCap,
  ArrowRight,
  X,
} from 'lucide-react';
import { useSchool } from '../../context/SchoolContext';

interface ClassesViewProps {
  onNavigateToStudents: (classId: string) => void;
}

export const ClassesView: React.FC<ClassesViewProps> = ({ onNavigateToStudents }) => {
  const { db, addClass } = useSchool();
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
    <div className="space-y-6 pb-16 text-[#1d1d1f]">
      {/* Header */}
      <div className="bg-white rounded-[18px] border border-[#e5e5ea] p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0066cc]/10 text-[#0066cc]">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold tracking-[-0.022em] text-[#1d1d1f]">
                Class Sections & Grade Tiers
              </h2>
              <p className="text-xs text-[#86868b]">
                Manage grade divisions, enrolled capacities, and assigned educators
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="apple-btn-primary"
          >
            <PlusCircle className="h-4 w-4 mr-2" />
            <span>Add Class Section</span>
          </button>
        </div>
      </div>

      {/* Classes Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {db.classes.map(c => {
          const classStudents = db.students.filter(
            s => s.classId === c.id && s.status === 'active'
          );
          const teacher = db.users.find(u => u.id === c.classTeacherId);

          return (
            <div
              key={c.id}
              className="bg-white rounded-[18px] border border-[#e5e5ea] p-5 hover:border-[#0066cc]/40 transition-all shadow-xs flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-base font-semibold text-[#1d1d1f]">{c.name}</span>
                  <span className="bg-[#f5f5f7] px-2.5 py-0.5 rounded-full text-xs font-semibold text-[#0066cc]">
                    Section {c.section}
                  </span>
                </div>

                <div className="mt-4 bg-[#f5f5f7] rounded-xl p-3.5 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <GraduationCap className="h-4 w-4 text-[#0066cc]" />
                    <span className="text-xs font-medium text-[#86868b]">Enrolled Students</span>
                  </div>
                  <span className="text-sm font-semibold text-[#1d1d1f]">
                    {classStudents.length} Students
                  </span>
                </div>

                <div className="mt-3.5 text-xs text-[#86868b]">
                  <span className="text-[11px] block">Assigned Class Teacher:</span>
                  <p className="font-semibold text-[#1d1d1f] mt-0.5 text-sm">
                    {teacher ? teacher.name : 'Unassigned'}
                  </p>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-[#f0f0f0]">
                <button
                  onClick={() => onNavigateToStudents(c.id)}
                  className="w-full inline-flex items-center justify-center space-x-2 bg-[#f5f5f7] hover:bg-[#e5e5ea] py-2 rounded-xl text-xs font-semibold text-[#1d1d1f] transition-colors"
                >
                  <span>View Student Roster</span>
                  <ArrowRight className="h-3.5 w-3.5 text-[#0066cc]" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Class Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-white rounded-[20px] border border-[#e5e5ea] shadow-2xl overflow-hidden text-[#1d1d1f]">
            <div className="flex items-center justify-between p-6 border-b border-[#f0f0f0]">
              <h3 className="font-semibold text-base">Create New Class Section</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-full bg-[#f5f5f7] text-[#86868b] hover:text-[#1d1d1f] flex items-center justify-center transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateClass} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#86868b] mb-1">
                  Class Name *
                </label>
                <input
                  type="text"
                  required
                  value={newClassName}
                  onChange={e => setNewClassName(e.target.value)}
                  placeholder="e.g. Class 11"
                  className="apple-input"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#86868b] mb-1">
                  Section Identifier
                </label>
                <input
                  type="text"
                  required
                  value={newSection}
                  onChange={e => setNewSection(e.target.value.toUpperCase())}
                  placeholder="A"
                  className="apple-input"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#86868b] mb-1">
                  Assign Class Teacher
                </label>
                <select
                  value={newTeacherId}
                  onChange={e => setNewTeacherId(e.target.value)}
                  className="apple-input font-medium"
                >
                  <option value="">-- Unassigned --</option>
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
                  className="w-full apple-btn-primary py-2.5"
                >
                  Create Class Section
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
