import React, { useState } from 'react';
import {
  Users,
  PlusCircle,
  KeyRound,
  BookOpen,
  Phone,
  Mail,
  Copy,
  Check,
  Shield,
  Edit2,
  Share2,
} from 'lucide-react';
import { useSchool } from '../../context/SchoolContext';
import { formatDate, generateTeacherCode } from '../../utils/helpers';

interface TeachersViewProps {
  onOpenAddTeacher: () => void;
  onNavigateToClass: (classId: string) => void;
}

export const TeachersView: React.FC<TeachersViewProps> = ({
  onOpenAddTeacher,
  onNavigateToClass,
}) => {
  const { db, startAdminClassAccess, updateTeacher, currentUser } = useSchool();
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [editingTeacherId, setEditingTeacherId] = useState<string | null>(null);
  const [editCodeValue, setEditCodeValue] = useState<string>('');

  const teachers = db.users.filter(u => u.role === 'teacher');

  const copyTeacherCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const shareCodeWhatsApp = (teacherName: string, code: string, phone?: string) => {
    const text = `Namaste ${teacherName}, here is your 6-digit teacher portal login code for ${db.schoolInfo.name}: *${code}*. Open the school portal and enter this code to mark attendance and manage your class.`;
    const url = phone
      ? `https://wa.me/${phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const handleStartEditCode = (teacherId: string, currentCode: string) => {
    setEditingTeacherId(teacherId);
    setEditCodeValue(currentCode);
  };

  const handleSaveCode = (teacherId: string) => {
    if (editCodeValue.trim()) {
      updateTeacher(teacherId, { teacherCode: editCodeValue.trim().toUpperCase() });
    }
    setEditingTeacherId(null);
  };

  return (
    <div className="space-y-4 pb-16">
      {/* Header */}
      <div className="rounded-3xl border border-white/60 bg-white/70 backdrop-blur-xl p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-[#1A2B48]">
                School Faculty & Teachers
              </h2>
              <p className="text-xs text-[#1A2B48]/60">
                Principal can set 6-digit teacher codes, assign classes, and share codes via WhatsApp
              </p>
            </div>
          </div>

          <button
            onClick={onOpenAddTeacher}
            className="inline-flex items-center space-x-1.5 rounded-xl bg-[#F27D26] px-4 py-2 text-xs font-black text-white shadow-md shadow-orange-500/20 hover:scale-105 active:scale-95 transition-all"
          >
            <PlusCircle className="h-4 w-4" />
            <span>+ Add New Teacher</span>
          </button>
        </div>
      </div>

      {/* Teachers Cards Grid */}
      {teachers.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white/60 p-8 text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 mb-3">
            <Users className="h-7 w-7" />
          </div>
          <h3 className="text-base font-black text-[#1A2B48]">No Faculty Members Added Yet</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-4">
            Click "+ Add New Teacher" to register your teachers, assign them to classes, and generate their 6-digit login codes. Teachers can log in from multiple phones simultaneously.
          </p>
          <button
            onClick={onOpenAddTeacher}
            className="inline-flex items-center space-x-1.5 rounded-xl bg-[#F27D26] px-5 py-2.5 text-xs font-black text-white shadow-md shadow-orange-500/20 hover:scale-105 active:scale-95 transition-all"
          >
            <PlusCircle className="h-4 w-4" />
            <span>+ Add First Teacher</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {teachers.map(teacher => {
            const assignedClass = db.classes.find(c => c.id === teacher.assignedClassId);
            const studentCount = db.students.filter(
              s => s.classId === teacher.assignedClassId && s.status === 'active'
            ).length;
            const isEditing = editingTeacherId === teacher.id;

            return (
              <div
                key={teacher.id}
                className="rounded-2xl border border-white/80 bg-white/70 backdrop-blur-md p-4 shadow-xs hover:border-blue-300 hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Header Profile */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-black text-base shadow-sm">
                        {teacher.name.charAt(0)}
                      </div>
                      <div>
                        <h4 className="font-extrabold text-sm text-[#1A2B48]">
                          {teacher.name}
                        </h4>
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800">
                          {teacher.assignedClassName || 'Class Teacher'}
                        </span>
                      </div>
                    </div>

                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        teacher.status === 'active'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {teacher.status.toUpperCase()}
                    </span>
                  </div>

                  {/* Login Code Display & Edit Box */}
                  <div className="mt-3.5 rounded-xl bg-amber-50/90 p-2.5 border border-amber-200">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold text-amber-900 block">
                        6-Digit Teacher Code:
                      </span>
                      {!isEditing && (
                        <button
                          onClick={() => handleStartEditCode(teacher.id, teacher.teacherCode || '')}
                          className="inline-flex items-center space-x-0.5 text-[10px] font-bold text-amber-800 hover:underline"
                          title="Edit Code Manually"
                        >
                          <Edit2 className="h-2.5 w-2.5" />
                          <span>Edit</span>
                        </button>
                      )}
                    </div>

                    {isEditing ? (
                      <div className="flex items-center space-x-1.5 mt-1">
                        <input
                          type="text"
                          maxLength={10}
                          autoFocus
                          value={editCodeValue}
                          onChange={e => setEditCodeValue(e.target.value.toUpperCase())}
                          className="w-full rounded-lg bg-white border border-amber-400 px-2 py-1 text-xs font-mono font-black text-amber-900 tracking-wider focus:outline-none"
                        />
                        <button
                          onClick={() => handleSaveCode(teacher.id)}
                          className="rounded-lg bg-amber-700 px-2 py-1 text-[11px] font-bold text-white shadow-xs hover:bg-amber-800"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingTeacherId(null)}
                          className="rounded-lg bg-slate-200 px-2 py-1 text-[11px] font-bold text-slate-700"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-black text-sm text-amber-900 tracking-wider">
                          {teacher.teacherCode || 'N/A'}
                        </span>

                        <div className="flex items-center space-x-1">
                          <button
                            onClick={() => copyTeacherCode(teacher.teacherCode || '')}
                            className="rounded-lg bg-white p-1.5 text-amber-800 shadow-xs hover:bg-amber-100"
                            title="Copy Code"
                          >
                            {copiedCode === teacher.teacherCode ? (
                              <Check className="h-3.5 w-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                          <button
                            onClick={() =>
                              shareCodeWhatsApp(teacher.name, teacher.teacherCode || '', teacher.phone)
                            }
                            className="rounded-lg bg-emerald-500 p-1.5 text-white shadow-xs hover:bg-emerald-600"
                            title="Share via WhatsApp"
                          >
                            <Share2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Details */}
                  <div className="mt-3 space-y-1.5 text-[11px] text-[#1A2B48]/70">
                    <div className="flex items-center space-x-2">
                      <BookOpen className="h-3.5 w-3.5 text-slate-400" />
                      <span>Subject: <strong>{teacher.subject || 'All Subjects'}</strong></span>
                    </div>
                    {teacher.phone && (
                      <div className="flex items-center space-x-2">
                        <Phone className="h-3.5 w-3.5 text-slate-400" />
                        <span>{teacher.phone}</span>
                      </div>
                    )}
                    <div className="flex items-center space-x-2">
                      <Users className="h-3.5 w-3.5 text-slate-400" />
                      <span>{studentCount} Students Enrolled</span>
                    </div>
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="mt-4 pt-2.5 border-t border-black/5 flex items-center justify-between">
                  {teacher.assignedClassId && (
                    <button
                      onClick={() => startAdminClassAccess(teacher.id)}
                      className="w-full inline-flex items-center justify-center space-x-1.5 rounded-xl bg-orange-50 hover:bg-orange-100 py-2 text-xs font-bold text-orange-800 transition-colors"
                    >
                      <Shield className="h-3.5 w-3.5 text-orange-600" />
                      <span>Enter Portal as This Teacher</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
