import React from 'react';
import {
  X,
  Printer,
  Share2,
  Award,
  Calendar,
  User,
  GraduationCap,
  CheckCircle2,
  FileText,
  Phone,
} from 'lucide-react';
import { useSchool } from '../../context/SchoolContext';
import { StudentResult, Student } from '../../types';
import { formatDate } from '../../utils/helpers';
import { openWhatsAppMarksheetMessage } from '../../utils/whatsapp';

interface PrintableMarksheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: StudentResult | null;
  student?: Student | null;
}

export const PrintableMarksheetModal: React.FC<PrintableMarksheetModalProps> = ({
  isOpen,
  onClose,
  result,
  student,
}) => {
  const { db } = useSchool();

  if (!isOpen || !result) return null;

  const targetStudent =
    student ||
    db.students.find(s => s.id === result.studentId) || {
      id: result.studentId,
      name: result.studentName,
      rollNumber: result.rollNumber,
      classId: result.classId,
      className: result.className,
      admissionNumber: 'MSPS-2025',
      parentName: 'Parent / Guardian',
      parentPhone: '',
      academicYear: result.academicYear,
      status: 'active' as const,
      createdAt: '',
    };

  const handlePrint = () => {
    window.print();
  };

  const isPassed = result.percentage >= 33;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-2 sm:p-4 backdrop-blur-sm animate-in fade-in overflow-y-auto print:p-0 print:bg-white print:static">
      <div className="w-full max-w-3xl rounded-3xl bg-white shadow-2xl overflow-hidden my-auto max-h-[94vh] flex flex-col print:max-h-none print:shadow-none print:rounded-none print:w-full print:max-w-none">
        {/* Top Control Bar (Hidden in Print) */}
        <div className="flex items-center justify-between bg-slate-900 px-5 py-3.5 text-white shrink-0 print:hidden">
          <div className="flex items-center space-x-2">
            <Award className="h-5 w-5 text-amber-400" />
            <span className="text-xs font-black uppercase tracking-wider text-slate-200">
              Student Marksheet / Report Card Preview
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => openWhatsAppMarksheetMessage(db.schoolInfo, targetStudent, result)}
              className="inline-flex items-center space-x-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 active:scale-95 transition-all shadow-xs"
            >
              <Phone className="h-3.5 w-3.5" />
              <span>WhatsApp Parent</span>
            </button>

            <button
              onClick={handlePrint}
              className="inline-flex items-center space-x-1.5 rounded-xl bg-orange-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-orange-600 active:scale-95 transition-all shadow-xs"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print / PDF</span>
            </button>

            <button
              onClick={onClose}
              className="rounded-full bg-white/20 p-1.5 text-white hover:bg-white/30 transition-colors ml-2"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Printable Marksheet Container */}
        <div
          id="official-report-card"
          className="flex-1 overflow-y-auto p-6 sm:p-10 bg-white text-slate-900 print:overflow-visible print:p-8"
        >
          {/* Institutional Border Frame */}
          <div className="border-4 border-double border-slate-800 p-6 sm:p-8 rounded-2xl relative">
            {/* Background Emblem Watermark */}
            <div className="absolute inset-0 flex items-center justify-center opacity-4 pointer-events-none">
              <GraduationCap className="h-72 w-72 text-slate-900" />
            </div>

            {/* School Header */}
            <div className="text-center pb-5 border-b-2 border-slate-800">
              <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-orange-600 text-white font-black text-2xl shadow-md mb-2">
                MS
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-950 uppercase font-serif">
                {db.schoolInfo.name || 'M.S. PUBLIC SCHOOL'}
              </h1>
              <p className="text-xs font-bold text-slate-600 italic mt-0.5">
                {db.schoolInfo.tagline || 'Knowledge is Power • Empowering Future Generations'}
              </p>
              <p className="text-[11px] text-slate-500 font-medium mt-1">
                {db.schoolInfo.address || 'Main Campus, School Road'} • Ph: {db.schoolInfo.phone} • Email: {db.schoolInfo.email}
              </p>
              <div className="mt-2 inline-flex items-center space-x-3 text-[10px] font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-full uppercase tracking-wider">
                <span>Affiliation No: {db.schoolInfo.affiliationNumber || 'CBSE/AFF/2024/93821'}</span>
                <span>•</span>
                <span>Session: {result.academicYear}</span>
              </div>
            </div>

            {/* Title */}
            <div className="text-center my-4">
              <span className="inline-block bg-slate-900 text-white px-5 py-1 rounded-full text-xs font-black uppercase tracking-widest">
                Official Academic Performance Report
              </span>
              <h2 className="text-base font-extrabold text-slate-800 mt-1">
                {result.examName}
              </h2>
            </div>

            {/* Student Biodata Box */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs mb-5">
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Student Name</span>
                <span className="font-extrabold text-slate-900 text-sm">{result.studentName}</span>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Class & Section</span>
                <span className="font-bold text-slate-800">{result.className}</span>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Roll Number</span>
                <span className="font-bold text-slate-800 font-mono text-sm">#{result.rollNumber}</span>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Admission No</span>
                <span className="font-bold text-slate-800 font-mono">{targetStudent.admissionNumber || 'MSPS-2025'}</span>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Father / Guardian</span>
                <span className="font-bold text-slate-800">{targetStudent.parentName || '—'}</span>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Date of Issue</span>
                <span className="font-bold text-slate-800">{formatDate(result.examDate || new Date().toISOString())}</span>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Academic Status</span>
                <span
                  className={`font-black text-xs uppercase ${
                    isPassed ? 'text-emerald-700' : 'text-rose-700'
                  }`}
                >
                  {isPassed ? 'PROMOTED / PASS' : 'NEEDS IMPROVEMENT'}
                </span>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Overall Rank / Grade</span>
                <span className="font-black text-orange-600 text-sm">Grade {result.grade}</span>
              </div>
            </div>

            {/* Subject Marks Table */}
            <div className="overflow-x-auto mb-5">
              <table className="w-full text-xs text-left border border-slate-300">
                <thead>
                  <tr className="bg-slate-800 text-white font-bold uppercase text-[10px] tracking-wider">
                    <th className="p-2.5 border border-slate-400 w-12 text-center">S.No</th>
                    <th className="p-2.5 border border-slate-400">Subject Name</th>
                    <th className="p-2.5 border border-slate-400 text-center w-24">Max Marks</th>
                    <th className="p-2.5 border border-slate-400 text-center w-24">Pass Marks</th>
                    <th className="p-2.5 border border-slate-400 text-center w-28">Marks Obtained</th>
                    <th className="p-2.5 border border-slate-400 text-center w-20">Grade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-medium">
                  {result.subjects.map((sub, idx) => {
                    const passMark = Math.ceil(sub.maxMarks * 0.33);
                    const subPassed = sub.obtainedMarks >= passMark;
                    return (
                      <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'}>
                        <td className="p-2.5 border border-slate-200 text-center font-bold text-slate-500">
                          {idx + 1}
                        </td>
                        <td className="p-2.5 border border-slate-200 font-bold text-slate-900">
                          {sub.subject}
                        </td>
                        <td className="p-2.5 border border-slate-200 text-center font-bold text-slate-700">
                          {sub.maxMarks}
                        </td>
                        <td className="p-2.5 border border-slate-200 text-center text-slate-500 font-mono">
                          {passMark}
                        </td>
                        <td className="p-2.5 border border-slate-200 text-center font-black text-slate-900">
                          <span
                            className={
                              subPassed ? 'text-slate-900' : 'text-rose-600 font-bold'
                            }
                          >
                            {sub.obtainedMarks}
                          </span>
                        </td>
                        <td className="p-2.5 border border-slate-200 text-center font-black text-purple-700">
                          {sub.grade}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 font-black text-xs border-t-2 border-slate-800">
                    <td colSpan={2} className="p-3 border border-slate-300 text-right uppercase tracking-wider">
                      GRAND TOTAL:
                    </td>
                    <td className="p-3 border border-slate-300 text-center font-black">
                      {result.totalMaxMarks}
                    </td>
                    <td className="p-3 border border-slate-300 text-center text-slate-500">
                      {Math.ceil(result.totalMaxMarks * 0.33)}
                    </td>
                    <td className="p-3 border border-slate-300 text-center text-sm font-black text-orange-700">
                      {result.totalMarks}
                    </td>
                    <td className="p-3 border border-slate-300 text-center font-black text-purple-800">
                      {result.grade}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Score Summary Box */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-orange-50/50 p-4 rounded-xl border border-orange-200 text-xs mb-5">
              <div>
                <span className="text-[10px] font-bold uppercase text-orange-800 block">Total Percentage</span>
                <p className="text-xl font-black text-orange-950">{result.percentage}%</p>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase text-orange-800 block">Overall Result</span>
                <p
                  className={`text-base font-black ${
                    isPassed ? 'text-emerald-700' : 'text-rose-700'
                  }`}
                >
                  {isPassed ? 'PASSED & PROMOTED' : 'DETENTION / RE-APPEAR'}
                </p>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase text-orange-800 block">Grading Scale (CBSE)</span>
                <p className="text-[11px] font-bold text-slate-700 mt-0.5">
                  A+ (90-100%) • A (80-89%) • B (70-79%) • C (50-69%) • D (33-49%)
                </p>
              </div>
            </div>

            {/* Remarks */}
            {result.remarks && (
              <div className="mb-6 p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                <span className="font-extrabold text-slate-800 uppercase text-[10px] block mb-1">
                  Teacher's Comprehensive Observation & Remarks:
                </span>
                <p className="font-medium text-slate-700 italic">"{result.remarks}"</p>
              </div>
            )}

            {/* Signature Block */}
            <div className="mt-8 pt-8 border-t border-slate-300 grid grid-cols-3 gap-4 text-center text-xs">
              <div>
                <div className="h-10"></div>
                <p className="font-bold text-slate-800 border-t border-slate-400 pt-1">Class Teacher</p>
              </div>

              <div>
                <div className="h-10 flex items-center justify-center">
                  <div className="h-9 w-9 rounded-full border border-dashed border-slate-400 flex items-center justify-center text-[9px] text-slate-400">
                    SEAL
                  </div>
                </div>
                <p className="font-bold text-slate-800 border-t border-slate-400 pt-1">Exam Controller</p>
              </div>

              <div>
                <div className="h-10"></div>
                <p className="font-bold text-slate-800 border-t border-slate-400 pt-1">
                  Principal ({db.schoolInfo.principalName || 'Dr. R.K. Mishra'})
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
