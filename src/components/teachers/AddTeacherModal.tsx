import React, { useState } from 'react';
import {
  X,
  Users,
  KeyRound,
  Save,
  Copy,
  Check,
  RefreshCw,
} from 'lucide-react';
import { useSchool } from '../../context/SchoolContext';
import { generateTeacherCode, getTodayDateString } from '../../utils/helpers';

interface AddTeacherModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AddTeacherModal: React.FC<AddTeacherModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { db, addTeacher } = useSchool();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [assignedClassId, setAssignedClassId] = useState(db.classes[0]?.id || 'cls_05');
  const [subject, setSubject] = useState('Mathematics & Science');
  const [joiningDate, setJoiningDate] = useState(getTodayDateString());
  const [teacherCode, setTeacherCode] = useState(generateTeacherCode());
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleGenerateNewCode = () => {
    setTeacherCode(generateTeacherCode());
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const selectedClass = db.classes.find(c => c.id === assignedClassId);
    const assignedClassName = selectedClass ? selectedClass.name : 'Class 5';

    addTeacher({
      name,
      teacherCode: teacherCode.trim() || generateTeacherCode(),
      email: email || `${name.toLowerCase().replace(/\s+/g, '')}@mspublicschool.edu.in`,
      phone,
      assignedClassId,
      assignedClassName,
      subject,
      joiningDate,
    });

    onClose();
  };

  const copyCode = () => {
    navigator.clipboard.writeText(teacherCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 sm:p-4 backdrop-blur-sm animate-in fade-in overflow-y-auto">
      <div className="w-full max-w-md bg-white rounded-[20px] border border-[#e5e5ea] shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col text-[#1d1d1f]">
        {/* Header */}
        <div className="flex items-center justify-between bg-white p-5 border-b border-[#f0f0f0] shrink-0">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0066cc]/10 text-[#0066cc]">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold tracking-[-0.022em] text-[#1d1d1f]">Add Faculty Member</h3>
              <p className="text-xs text-[#86868b]">Create access credentials for teacher login</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#f5f5f7] text-[#86868b] hover:text-[#1d1d1f] flex items-center justify-center transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {/* Teacher Code Input */}
          <div className="bg-[#f5f5f7] p-4 rounded-2xl border border-[#e5e5ea]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-[#86868b]">
                6-Digit Access Code:
              </span>
              <div className="flex items-center space-x-1.5">
                <button
                  type="button"
                  onClick={handleGenerateNewCode}
                  className="apple-btn-secondary py-1 px-2.5 text-xs text-[#0066cc]"
                  title="Generate new random 6-digit code"
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  <span>Random</span>
                </button>
                <button
                  type="button"
                  onClick={copyCode}
                  className="apple-btn-secondary py-1 px-2.5 text-xs"
                >
                  {copied ? <Check className="h-3 w-3 text-[#30d158] mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            <div className="relative">
              <KeyRound className="absolute left-3.5 top-2.5 h-4 w-4 text-[#0066cc]" />
              <input
                type="text"
                required
                maxLength={10}
                value={teacherCode}
                onChange={e => setTeacherCode(e.target.value.toUpperCase())}
                placeholder="501001"
                className="apple-input pl-10 font-mono font-bold text-lg tracking-widest text-[#1d1d1f]"
              />
            </div>
            <p className="text-[11px] text-[#86868b] mt-1.5">
              The teacher uses this access code along with their assigned class to log in.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#86868b] mb-1">
              Teacher Full Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Anita Sharma"
              className="apple-input"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#86868b] mb-1">
                Assigned Class *
              </label>
              <select
                value={assignedClassId}
                onChange={e => setAssignedClassId(e.target.value)}
                className="apple-input font-medium"
              >
                {db.classes.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} - Sec {c.section}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#86868b] mb-1">
                Primary Subject
              </label>
              <input
                type="text"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="Mathematics & Science"
                className="apple-input"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#86868b] mb-1">
                Phone (WhatsApp)
              </label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+91 9876543210"
                className="apple-input"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#86868b] mb-1">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="teacher@mspublicschool.edu.in"
                className="apple-input"
              />
            </div>
          </div>

          <div className="pt-3">
            <button
              type="submit"
              className="w-full apple-btn-primary py-3"
            >
              <Save className="h-4 w-4 mr-2" />
              <span>Register Faculty Member</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
