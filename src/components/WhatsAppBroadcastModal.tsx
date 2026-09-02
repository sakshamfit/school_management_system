import React, { useState } from 'react';
import {
  MessageSquare,
  X,
  Send,
  Sparkles,
  AlertCircle,
  CreditCard,
  Calendar,
  FileText,
  Megaphone,
  Phone,
} from 'lucide-react';
import { useSchool } from '../context/SchoolContext';

interface WhatsAppBroadcastModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultClassId?: string;
}

export const WhatsAppBroadcastModal: React.FC<WhatsAppBroadcastModalProps> = ({
  isOpen,
  onClose,
  defaultClassId,
}) => {
  const { db } = useSchool();
  const [selectedClassId, setSelectedClassId] = useState<string>(defaultClassId || 'all');
  const [templateType, setTemplateType] = useState<'attendance' | 'fee' | 'holiday' | 'exam' | 'custom'>('attendance');
  const [customSubject, setCustomSubject] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [recipientFilter, setRecipientFilter] = useState<'all' | 'unpaid_fees' | 'absent_today'>('all');

  if (!isOpen) return null;

  // Filter students based on selection
  const targetStudents = db.students.filter(student => {
    if (student.status !== 'active') return false;
    if (selectedClassId !== 'all' && student.classId !== selectedClassId) return false;

    if (recipientFilter === 'unpaid_fees') {
      const fee = db.feeAccounts.find(fa => fa.studentId === student.id);
      return (fee?.dueAmount || 0) > 0;
    }

    if (recipientFilter === 'absent_today') {
      const today = new Date().toISOString().split('T')[0];
      const att = db.attendance.find(a => a.studentId === student.id && a.date === today);
      return att?.status === 'absent';
    }

    return true;
  });

  const getTemplateText = (student: typeof db.students[0]) => {
    const fee = db.feeAccounts.find(fa => fa.studentId === student.id);
    const schoolName = db.schoolInfo.name || 'M.S. Public School';
    const schoolPhone = db.schoolInfo.phone || '+91 9931066436';

    switch (templateType) {
      case 'attendance':
        return `*${schoolName} - Daily Attendance Alert*\n\nDear Parent,\nThis is to notify that *${student.name}* (Roll: ${student.rollNumber}, ${student.className}) is marked *ABSENT* for today's classes.\n\nPlease ensure regular attendance. For any query, contact school: ${schoolPhone}.\n\n_Regards,_\n_${schoolName}_`;
      case 'fee':
        return `*${schoolName} - Fee Reminder Alert*\n\nDear Parent,\nThis is a gentle reminder regarding pending school fees for *${student.name}* (${student.className}, Adm: ${student.admissionNumber}).\n\n*Pending Due:* ₹${fee?.dueAmount || 0}\n\nPlease clear the balance at the school office or via UPI at your earliest convenience.\n\n_Thank You,_\n_${schoolName}_`;
      case 'holiday':
        return `*${schoolName} - Official Notice*\n\nDear Parents,\nSchool will remain *CLOSED* on *${customSubject || 'Upcoming Occasion'}* as per academic calendar.\nClasses will resume regularly on the next working day.\n\n_Warm Regards,_\n_Principal, ${schoolName}_`;
      case 'exam':
        return `*${schoolName} - Examination Notification*\n\nDear Parents,\nThe upcoming ${customSubject || 'Term Examination'} timetable and syllabus have been published. Please ensure *${student.name}* prepares diligently.\n\n_Best Wishes,_\n_${schoolName}_`;
      case 'custom':
      default:
        return `*${schoolName} - Important Announcement*\n\n*${customSubject || 'School Notice'}*\n\nDear Parents,\n${customMessage || 'Please take note of the upcoming school activities.'}\n\n_Regards,_\n_${schoolName}_`;
    }
  };

  const handleOpenWhatsAppForStudent = (student: typeof db.students[0]) => {
    let phone = (student.parentPhone || '').replace(/\D/g, '');
    if (phone.length === 10) {
      phone = '91' + phone;
    }
    const message = encodeURIComponent(getTemplateText(student));
    if (phone) {
      window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
    } else {
      window.open(`https://wa.me/?text=${message}`, '_blank');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in">
      <div className="w-full sm:max-w-xl bg-white rounded-t-[24px] sm:rounded-[20px] border border-[#e5e5ea] p-6 shadow-2xl max-h-[90vh] flex flex-col overflow-hidden text-[#1d1d1f]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#f0f0f0]">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#30d158]/10 text-[#30d158]">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-base text-[#1d1d1f]">
                WhatsApp Broadcast Center
              </h3>
              <p className="text-xs text-[#86868b]">
                1-tap direct parent alerts & school circulars
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#f5f5f7] text-[#86868b] hover:text-[#1d1d1f] flex items-center justify-center transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 py-4 space-y-4 pr-1">
          {/* Template Selection Pills */}
          <div>
            <label className="block text-xs font-semibold text-[#86868b] mb-2">
              Select Message Template:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { id: 'attendance', label: 'Absent Alert', icon: AlertCircle, color: 'text-[#ff3b30]' },
                { id: 'fee', label: 'Fee Reminder', icon: CreditCard, color: 'text-[#ff9500]' },
                { id: 'holiday', label: 'Holiday Notice', icon: Calendar, color: 'text-[#30d158]' },
                { id: 'exam', label: 'Exam Update', icon: FileText, color: 'text-[#0066cc]' },
                { id: 'custom', label: 'Custom Notice', icon: Megaphone, color: 'text-[#af52de]' },
              ].map(tpl => {
                const Icon = tpl.icon;
                const isSelected = templateType === tpl.id;
                return (
                  <button
                    key={tpl.id}
                    onClick={() => {
                      setTemplateType(tpl.id as any);
                      if (tpl.id === 'attendance') setRecipientFilter('absent_today');
                      else if (tpl.id === 'fee') setRecipientFilter('unpaid_fees');
                      else setRecipientFilter('all');
                    }}
                    className={`flex items-center space-x-2 p-2.5 rounded-xl text-xs font-medium transition-all text-left border ${
                      isSelected
                        ? 'bg-[#0066cc] text-white border-[#0066cc] shadow-xs'
                        : 'bg-[#f5f5f7] text-[#1d1d1f] border-transparent hover:bg-[#e5e5ea]'
                    }`}
                  >
                    <Icon className={`h-4 w-4 shrink-0 ${isSelected ? 'text-white' : tpl.color}`} />
                    <span className="truncate">{tpl.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Filters: Class & Recipient Group */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#86868b] mb-1">
                Target Class:
              </label>
              <select
                value={selectedClassId}
                onChange={e => setSelectedClassId(e.target.value)}
                className="apple-input font-medium"
              >
                <option value="all">All Classes (Whole School)</option>
                {db.classes.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} - Section {c.section}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#86868b] mb-1">
                Filter Parents:
              </label>
              <select
                value={recipientFilter}
                onChange={e => setRecipientFilter(e.target.value as any)}
                className="apple-input font-medium"
              >
                <option value="all">All Students ({targetStudents.length})</option>
                <option value="absent_today">Only Absent Students Today</option>
                <option value="unpaid_fees">Only Students with Due Fees</option>
              </select>
            </div>
          </div>

          {/* Custom Message Inputs */}
          {(templateType === 'custom' || templateType === 'holiday' || templateType === 'exam') && (
            <div className="space-y-3 bg-[#f5f5f7] p-4 rounded-xl border border-[#e5e5ea]">
              <div>
                <label className="block text-xs font-semibold text-[#86868b] mb-1">
                  Title / Subject:
                </label>
                <input
                  type="text"
                  value={customSubject}
                  onChange={e => setCustomSubject(e.target.value)}
                  placeholder="e.g. Annual Sports Day / Eid Holiday Notice"
                  className="apple-input bg-white font-medium"
                />
              </div>

              {templateType === 'custom' && (
                <div>
                  <label className="block text-xs font-semibold text-[#86868b] mb-1">
                    Message Body:
                  </label>
                  <textarea
                    rows={3}
                    value={customMessage}
                    onChange={e => setCustomMessage(e.target.value)}
                    placeholder="Type announcement to be sent to parents..."
                    className="apple-input bg-white font-medium"
                  />
                </div>
              )}
            </div>
          )}

          {/* Live Preview Card */}
          <div className="bg-[#f5f5f7] p-4 rounded-xl border border-[#e5e5ea]">
            <div className="flex items-center justify-between text-xs text-[#30d158] font-semibold mb-2">
              <span className="flex items-center gap-1">
                <Sparkles className="h-3.5 w-3.5 shrink-0" />
                Message Preview
              </span>
              <span className="text-[#86868b]">{targetStudents.length} Parents Targeted</span>
            </div>
            <p className="text-xs text-[#1d1d1f] whitespace-pre-line bg-white p-3.5 rounded-lg border border-[#e5e5ea] leading-relaxed max-h-36 overflow-y-auto">
              {targetStudents[0] ? getTemplateText(targetStudents[0]) : 'Select recipients to preview message.'}
            </p>
          </div>

          {/* Target Parents 1-Tap Buttons List */}
          <div>
            <h4 className="text-xs font-semibold text-[#86868b] mb-2">
              Tap Student to Send WhatsApp ({targetStudents.length} Total):
            </h4>
            <div className="space-y-2 max-h-48 overflow-y-auto divide-y divide-[#f0f0f0]">
              {targetStudents.length === 0 ? (
                <div className="p-4 text-center text-xs text-[#86868b]">
                  No students match this filter criteria.
                </div>
              ) : (
                targetStudents.map(student => {
                  return (
                    <div
                      key={student.id}
                      className="pt-2 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-xs text-[#1d1d1f] truncate">
                            {student.name}
                          </span>
                          <span className="text-[11px] text-[#86868b]">
                            ({student.className}, Roll #{student.rollNumber})
                          </span>
                        </div>
                        <p className="text-[11px] text-[#86868b] truncate flex items-center gap-1 mt-0.5">
                          <span>Parent: {student.parentName}</span>
                          <span>•</span>
                          <Phone className="h-3 w-3 text-[#30d158] inline shrink-0" />
                          <span>{student.parentPhone || 'No Phone'}</span>
                        </p>
                      </div>

                      <button
                        onClick={() => handleOpenWhatsAppForStudent(student)}
                        className="apple-btn-secondary py-1.5 px-3 text-xs text-[#30d158] shrink-0"
                      >
                        <Send className="h-3 w-3 mr-1.5 shrink-0" />
                        <span>Send</span>
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-[#f0f0f0] flex items-center justify-between">
          <span className="text-xs text-[#86868b]">
            Opens WhatsApp Web / Mobile with pre-filled message
          </span>
          <button
            onClick={onClose}
            className="apple-btn-secondary py-1.5 px-4 text-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
