import React, { useState } from 'react';
import {
  Users,
  PlusCircle,
  BookOpen,
  Phone,
  Copy,
  Check,
  Shield,
  Edit2,
  Share2,
} from 'lucide-react';
import { useSchool } from '../../context/SchoolContext';

interface TeachersViewProps {
  onOpenAddTeacher: () => void;
  onNavigateToClass: (classId: string) => void;
}

export const TeachersView: React.FC<TeachersViewProps> = ({
  onOpenAddTeacher,
}) => {
  const { db, startAdminClassAccess, updateTeacher } = useSchool();
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
    const text = `Namaste ${teacherName}, here is your login code for ${db.schoolInfo.name}: *${code}*. Open the school portal and enter this code to mark attendance and manage your class.`;
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
    <div className="space-y-6 pb-16 text-[#1d1d1f]">
      {/* Header */}
      <div className="bg-white rounded-[18px] border border-[#e5e5ea] p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0066cc]/10 text-[#0066cc]">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold tracking-[-0.022em] text-[#1d1d1f]">
                Faculty & Teacher Roster
              </h2>
              <p className="text-xs text-[#86868b]">
                Teacher login credentials, class assignments, and WhatsApp dispatch
              </p>
            </div>
          </div>

          <button
            onClick={onOpenAddTeacher}
            className="apple-btn-primary"
          >
            <PlusCircle className="h-4 w-4 mr-2" />
            <span>Add Faculty Member</span>
          </button>
        </div>
      </div>

      {/* Teachers Cards Grid */}
      {teachers.length === 0 ? (
        <div className="bg-white rounded-[18px] border border-[#e5e5ea] p-10 text-center shadow-xs">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#f5f5f7] text-[#0066cc] mb-3">
            <Users className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold text-[#1d1d1f]">No Faculty Members Registered</h3>
          <p className="text-xs text-[#86868b] max-w-md mx-auto mt-1 mb-4">
            Click "+ Add Faculty Member" to enroll teachers, assign classes, and create login codes.
          </p>
          <button
            onClick={onOpenAddTeacher}
            className="apple-btn-primary"
          >
            <PlusCircle className="h-4 w-4 mr-2" />
            <span>Add Faculty Member</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {teachers.map(teacher => {
            const studentCount = db.students.filter(
              s => s.classId === teacher.assignedClassId && s.status === 'active'
            ).length;
            const isEditing = editingTeacherId === teacher.id;

            return (
              <div
                key={teacher.id}
                className="bg-white rounded-[18px] border border-[#e5e5ea] p-5 hover:border-[#0066cc]/40 transition-all shadow-xs flex flex-col justify-between group"
              >
                <div>
                  {/* Header Profile */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#0066cc]/10 text-[#0066cc] font-semibold text-base">
                        {teacher.name.charAt(0)}
                      </div>
                      <div>
                        <h4 className="font-semibold text-sm text-[#1d1d1f]">
                          {teacher.name}
                        </h4>
                        <span className="text-xs text-[#86868b] block mt-0.5">
                          {teacher.assignedClassName || 'Class Teacher'}
                        </span>
                      </div>
                    </div>

                    <span
                      className={`px-2.5 py-0.5 text-[10px] font-semibold rounded-full ${
                        teacher.status === 'active'
                          ? 'bg-[#30d158]/10 text-[#30d158]'
                          : 'bg-[#86868b]/10 text-[#86868b]'
                      }`}
                    >
                      {teacher.status.toUpperCase()}
                    </span>
                  </div>

                  {/* Login Code Display & Edit Box */}
                  <div className="mt-4 bg-[#f5f5f7] rounded-xl p-3.5 border border-[#e5e5ea]">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-semibold text-[#86868b]">
                        Teacher Portal Access Code:
                      </span>
                      {!isEditing && (
                        <button
                          onClick={() => handleStartEditCode(teacher.id, teacher.teacherCode || '')}
                          className="inline-flex items-center space-x-1 text-xs font-medium text-[#0066cc] hover:underline"
                          title="Edit Code Manually"
                        >
                          <Edit2 className="h-3 w-3" />
                          <span>Edit</span>
                        </button>
                      )}
                    </div>

                    {isEditing ? (
                      <div className="flex items-center space-x-2 mt-1">
                        <input
                          type="text"
                          maxLength={10}
                          autoFocus
                          value={editCodeValue}
                          onChange={e => setEditCodeValue(e.target.value.toUpperCase())}
                          className="apple-input py-1 px-2 text-xs font-mono font-bold"
                        />
                        <button
                          onClick={() => handleSaveCode(teacher.id)}
                          className="apple-btn-primary py-1 px-3 text-xs"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingTeacherId(null)}
                          className="apple-btn-secondary py-1 px-2 text-xs"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-semibold text-sm text-[#1d1d1f] tracking-wider">
                          {teacher.teacherCode || 'N/A'}
                        </span>

                        <div className="flex items-center space-x-1.5">
                          <button
                            onClick={() => copyTeacherCode(teacher.teacherCode || '')}
                            className="w-7 h-7 rounded-full bg-white text-[#86868b] hover:text-[#1d1d1f] flex items-center justify-center shadow-xs transition-colors"
                            title="Copy Code"
                          >
                            {copiedCode === teacher.teacherCode ? (
                              <Check className="h-3.5 w-3.5 text-[#30d158]" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                          <button
                            onClick={() =>
                              shareCodeWhatsApp(teacher.name, teacher.teacherCode || '', teacher.phone)
                            }
                            className="w-7 h-7 rounded-full bg-white text-[#30d158] hover:bg-[#30d158] hover:text-white flex items-center justify-center shadow-xs transition-colors"
                            title="Share via WhatsApp"
                          >
                            <Share2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Details */}
                  <div className="mt-3.5 space-y-2 text-xs text-[#86868b]">
                    <div className="flex items-center space-x-2">
                      <BookOpen className="h-3.5 w-3.5 text-[#86868b]" />
                      <span>Subject: <strong className="text-[#1d1d1f] font-medium">{teacher.subject || 'All Subjects'}</strong></span>
                    </div>
                    {teacher.phone && (
                      <div className="flex items-center space-x-2">
                        <Phone className="h-3.5 w-3.5 text-[#86868b]" />
                        <span className="text-[#1d1d1f] font-medium">{teacher.phone}</span>
                      </div>
                    )}
                    <div className="flex items-center space-x-2">
                      <Users className="h-3.5 w-3.5 text-[#86868b]" />
                      <span>{studentCount} Students in Class</span>
                    </div>
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="mt-4 pt-3 border-t border-[#f0f0f0]">
                  {teacher.assignedClassId && (
                    <button
                      onClick={() => startAdminClassAccess(teacher.id)}
                      className="w-full inline-flex items-center justify-center space-x-2 bg-[#f5f5f7] hover:bg-[#0066cc]/10 hover:text-[#0066cc] py-2 rounded-xl text-xs font-semibold text-[#1d1d1f] transition-colors"
                    >
                      <Shield className="h-3.5 w-3.5" />
                      <span>Enter Teacher Portal</span>
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
