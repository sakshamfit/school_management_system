import React, { useState } from 'react';
import {
  X,
  Users,
  KeyRound,
  Mail,
  Phone,
  BookOpen,
  Calendar,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 sm:p-4 backdrop-blur-sm animate-in fade-in overflow-y-auto">
      <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between bg-gradient-to-r from-blue-600 to-indigo-600 p-5 text-white shrink-0">
          <div className="flex items-center space-x-2">
            <Users className="h-6 w-6" />
            <div>
              <h3 className="text-base font-black">Add Faculty / Teacher</h3>
              <p className="text-[11px] text-blue-100">Set 6-digit teacher code manually or generate automatically</p>
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
          {/* Teacher Code Input & Customization */}
          <div className="rounded-2xl bg-amber-50 p-4 border border-amber-200">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-amber-900">
                Teacher 6-Digit Login Code (Manual / Auto):
              </span>
              <div className="flex items-center space-x-1.5">
                <button
                  type="button"
                  onClick={handleGenerateNewCode}
                  className="inline-flex items-center space-x-1 text-[11px] font-bold text-amber-800 hover:text-amber-950 bg-amber-100/80 px-2 py-0.5 rounded-lg"
                  title="Generate new random 6-digit code"
                >
                  <RefreshCw className="h-3 w-3" />
                  <span>Random</span>
                </button>
                <button
                  type="button"
                  onClick={copyCode}
                  className="inline-flex items-center space-x-1 text-[11px] font-bold text-amber-800 hover:text-amber-950 bg-amber-100/80 px-2 py-0.5 rounded-lg"
                >
                  {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            <div className="relative">
              <KeyRound className="absolute left-3.5 top-2.5 h-4 w-4 text-amber-600" />
              <input
                type="text"
                required
                maxLength={10}
                value={teacherCode}
                onChange={e => setTeacherCode(e.target.value.toUpperCase())}
                placeholder="e.g. 501001"
                className="w-full pl-10 pr-3 py-2 rounded-xl bg-white border border-amber-300 font-mono font-black text-lg tracking-widest text-amber-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <p className="text-[11px] text-amber-800 mt-1.5">
              Principal can enter any 6-digit code (e.g. <code>501001</code>). Teacher enters this code to sign in directly.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Teacher Full Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Smt. Anita Sharma"
              className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-xs font-bold text-slate-800 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Assigned Class *
              </label>
              <select
                value={assignedClassId}
                onChange={e => setAssignedClassId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-xs font-bold text-slate-800 focus:border-blue-500 focus:outline-none bg-white"
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
                Primary Subject
              </label>
              <input
                type="text"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="e.g. Mathematics"
                className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-xs font-bold text-slate-800 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Phone Number (WhatsApp)
              </label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+91 9876543210"
                className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-xs font-bold text-slate-800 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="teacher@mspublicschool.edu.in"
                className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-xs font-medium text-slate-800 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 py-3 text-xs font-black text-white shadow-lg shadow-blue-600/25 hover:from-blue-700 hover:to-indigo-700 active:scale-95 transition-all flex items-center justify-center space-x-2"
            >
              <Save className="h-4 w-4" />
              <span>SAVE & ASSIGN TEACHER</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
