import React, { useState, useEffect, useMemo } from 'react';
import {
  CalendarCheck,
  Check,
  X,
  Sparkles,
  Search,
  Calendar,
  Save,
  CheckCircle2,
  AlertCircle,
  Users,
  ChevronLeft,
  ChevronRight,
  Clock,
  History,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useSchool } from '../../context/SchoolContext';
import { AttendanceStatus } from '../../types';
import { getTodayDateString, formatDate } from '../../utils/helpers';

interface AttendanceViewProps {
  initialClassId?: string;
  onSelectStudent?: (studentId: string) => void;
}

export const AttendanceView: React.FC<AttendanceViewProps> = ({
  initialClassId,
  onSelectStudent,
}) => {
  const { db, currentUser, saveAttendanceBatch } = useSchool();
  const isPrincipal = currentUser?.role === 'principal';

  // Default class selection
  const defaultClass =
    initialClassId ||
    (currentUser?.role === 'teacher' && currentUser.assignedClassId
      ? currentUser.assignedClassId
      : db.classes[0]?.id || 'cls_05');

  const [selectedClassId, setSelectedClassId] = useState(defaultClass);
  const [selectedDate, setSelectedDate] = useState(getTodayDateString());
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'take' | 'history'>('take');
  const [isSaved, setIsSaved] = useState(false);

  // Active students in selected class
  const classStudents = useMemo(() => {
    return db.students
      .filter(s => s.classId === selectedClassId && s.status === 'active')
      .sort((a, b) => parseInt(a.rollNumber || '0') - parseInt(b.rollNumber || '0'));
  }, [db.students, selectedClassId]);

  // Local attendance state map: { [studentId]: { status: AttendanceStatus, remarks?: string } }
  const [attendanceMap, setAttendanceMap] = useState<Record<string, { status: AttendanceStatus; remarks?: string }>>({});

  // Sync existing attendance for selected date & class
  useEffect(() => {
    const existingRecords = db.attendance.filter(
      a => a.classId === selectedClassId && a.date === selectedDate
    );

    const initialMap: Record<string, { status: AttendanceStatus; remarks?: string }> = {};
    classStudents.forEach(s => {
      const found = existingRecords.find(r => r.studentId === s.id);
      if (found) {
        initialMap[s.id] = { status: found.status, remarks: found.remarks };
      } else {
        // Default to 'present' for fast marking flow
        initialMap[s.id] = { status: 'present', remarks: '' };
      }
    });

    setAttendanceMap(initialMap);
    setIsSaved(false);
  }, [selectedClassId, selectedDate, classStudents, db.attendance]);

  // Filtered student list for search
  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return classStudents;
    const q = searchQuery.toLowerCase();
    return classStudents.filter(
      s => s.name.toLowerCase().includes(q) || s.rollNumber.includes(q)
    );
  }, [classStudents, searchQuery]);

  // Metric counts
  const totalCount = classStudents.length;
  const attendanceValues = Object.values(attendanceMap) as { status: AttendanceStatus; remarks?: string }[];
  const presentCount = attendanceValues.filter(v => v.status === 'present').length;
  const absentCount = attendanceValues.filter(v => v.status === 'absent').length;
  const leaveCount = attendanceValues.filter(v => v.status === 'leave').length;
  const attendancePercentage = totalCount > 0 ? ((presentCount / totalCount) * 100).toFixed(1) : '0';

  // Quick mark toggle
  const setStudentStatus = (studentId: string, status: AttendanceStatus) => {
    setAttendanceMap(prev => ({
      ...prev,
      [studentId]: { ...prev[studentId], status },
    }));
    setIsSaved(false);
  };

  const markAllPresent = () => {
    const newMap: Record<string, { status: AttendanceStatus; remarks?: string }> = {};
    classStudents.forEach(s => {
      newMap[s.id] = { status: 'present', remarks: attendanceMap[s.id]?.remarks || '' };
    });
    setAttendanceMap(newMap);
    setIsSaved(false);
  };

  const markAllAbsent = () => {
    const newMap: Record<string, { status: AttendanceStatus; remarks?: string }> = {};
    classStudents.forEach(s => {
      newMap[s.id] = { status: 'absent', remarks: attendanceMap[s.id]?.remarks || '' };
    });
    setAttendanceMap(newMap);
    setIsSaved(false);
  };

  // Submit attendance
  const handleSaveAttendance = () => {
    const batchItems = classStudents.map(student => ({
      studentId: student.id,
      studentName: student.name,
      rollNumber: student.rollNumber,
      status: attendanceMap[student.id]?.status || 'present',
      remarks: attendanceMap[student.id]?.remarks || '',
    }));

    saveAttendanceBatch(selectedClassId, selectedDate, batchItems);
    setIsSaved(true);

    try {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.8 },
      });
    } catch {
      // ignore
    }

    setTimeout(() => setIsSaved(false), 4000);
  };

  const selectedClassObj = db.classes.find(c => c.id === selectedClassId);

  return (
    <div className="space-y-4 pb-20">
      {/* Top Header & View Switcher */}
      <div className="rounded-3xl border border-orange-100 bg-white p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center space-x-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-100 text-orange-600">
                <CalendarCheck className="h-5 w-5" />
              </div>
              <h2 className="text-lg font-black text-slate-900">
                Live Attendance System
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Mobile-first instant tapping • Auto-saves to school database
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setViewMode('take')}
              className={`rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
                viewMode === 'take'
                  ? 'bg-orange-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Take Attendance
            </button>
            <button
              onClick={() => setViewMode('history')}
              className={`rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
                viewMode === 'history'
                  ? 'bg-orange-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Attendance History
            </button>
          </div>
        </div>

        {/* Filter Controls: Class & Date */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-3 border-t border-slate-100">
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              Select Class
            </label>
            <select
              value={selectedClassId}
              onChange={e => setSelectedClassId(e.target.value)}
              className="w-full rounded-xl border border-orange-200 bg-orange-50/40 py-2 px-3 text-xs font-bold text-slate-800 focus:border-orange-500 focus:outline-none"
            >
              {db.classes.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} - Sec {c.section} ({c.totalStudents || 0} Students)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              Attendance Date
            </label>
            <div className="relative">
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 py-2 px-3 text-xs font-bold text-slate-800 focus:border-orange-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              Search Student / Roll
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Filter by name or roll..."
                className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-xs font-medium text-slate-800 placeholder-slate-400 focus:border-orange-500 focus:outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {viewMode === 'take' ? (
        <>
          {/* Real-time Summary Card */}
          <div className="rounded-3xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-4 sm:p-5 text-white shadow-lg shadow-slate-900/10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-orange-400">
                  {selectedClassObj?.name} — Attendance Status
                </span>
                <div className="mt-1 flex items-baseline space-x-3">
                  <span className="text-2xl sm:text-3xl font-black">{attendancePercentage}%</span>
                  <span className="text-xs text-slate-300">
                    {presentCount} of {totalCount} Students Present
                  </span>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={markAllPresent}
                  className="rounded-xl bg-emerald-600/90 hover:bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white transition-all active:scale-95"
                >
                  ✓ All Present
                </button>
                <button
                  onClick={markAllAbsent}
                  className="rounded-xl bg-rose-600/90 hover:bg-rose-600 px-3 py-1.5 text-xs font-bold text-white transition-all active:scale-95"
                >
                  ✕ All Absent
                </button>
              </div>
            </div>

            {/* Attendance Progress Bar */}
            <div className="mt-3.5 h-2.5 w-full overflow-hidden rounded-full bg-slate-700">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-300"
                style={{ width: `${attendancePercentage}%` }}
              ></div>
            </div>

            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
              <span className="text-emerald-400 font-bold">🟢 Present: {presentCount}</span>
              <span className="text-rose-400 font-bold">🔴 Absent: {absentCount}</span>
              <span>Total: {totalCount} Students</span>
            </div>
          </div>

          {/* Vertical Fast-Tap Student Cards List (Optimized ~5 visible per phone screen) */}
          <div className="space-y-2">
            {filteredStudents.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-orange-200 bg-white p-8 text-center">
                <Users className="mx-auto h-12 w-12 text-orange-300 mb-2" />
                <h4 className="font-bold text-slate-800 text-sm">No Students in this Class</h4>
                <p className="text-xs text-slate-500 mt-1">
                  Add students to {selectedClassObj?.name} to begin tracking daily attendance.
                </p>
              </div>
            ) : (
              filteredStudents.map(student => {
                const status = attendanceMap[student.id]?.status || 'present';
                const isPresent = status === 'present';
                const isAbsent = status === 'absent';

                return (
                  <div
                    key={student.id}
                    className={`rounded-2xl border p-3 transition-all ${
                      isPresent
                        ? 'border-emerald-200 bg-emerald-50/30'
                        : isAbsent
                        ? 'border-rose-200 bg-rose-50/40'
                        : 'border-slate-200 bg-white'
                    } flex items-center justify-between gap-2 shadow-xs`}
                  >
                    {/* Student Info */}
                    <div
                      onClick={() => onSelectStudent && onSelectStudent(student.id)}
                      className="flex items-center space-x-3 cursor-pointer flex-1 min-w-0"
                    >
                      <img
                        src={
                          student.photoUrl ||
                          `https://api.dicebear.com/7.x/adventurer/svg?seed=${student.name}`
                        }
                        alt={student.name}
                        className="h-11 w-11 shrink-0 rounded-full object-cover border-2 border-white shadow-xs"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center space-x-1.5">
                          <h4 className="font-extrabold text-xs sm:text-sm text-slate-900 truncate">
                            {student.name}
                          </h4>
                          <span className="rounded bg-slate-200/80 px-1.5 py-0.2 text-[10px] font-bold text-slate-700">
                            #{student.rollNumber}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 truncate">
                          {student.className} • Parent: {student.parentName}
                        </p>
                      </div>
                    </div>

                    {/* Large 1-Tap Attendance Buttons */}
                    <div className="flex items-center space-x-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => setStudentStatus(student.id, 'present')}
                        className={`flex items-center space-x-1 rounded-xl px-3.5 py-2.5 text-xs font-black transition-all active:scale-90 ${
                          isPresent
                            ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30 ring-2 ring-emerald-300'
                            : 'bg-white text-emerald-700 border border-emerald-300 hover:bg-emerald-50'
                        }`}
                      >
                        <Check className="h-4 w-4" />
                        <span>PRESENT</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setStudentStatus(student.id, 'absent')}
                        className={`flex items-center space-x-1 rounded-xl px-3.5 py-2.5 text-xs font-black transition-all active:scale-90 ${
                          isAbsent
                            ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30 ring-2 ring-rose-300'
                            : 'bg-white text-rose-700 border border-rose-300 hover:bg-rose-50'
                        }`}
                      >
                        <X className="h-4 w-4" />
                        <span>ABSENT</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Sticky Bottom Submit Bar */}
          <div className="sticky bottom-16 lg:bottom-4 z-30 pt-3">
            <div className="rounded-2xl border border-orange-200 bg-white/95 p-3.5 shadow-xl backdrop-blur-md flex items-center justify-between gap-3">
              <div className="text-xs">
                <span className="font-extrabold text-slate-900">
                  {presentCount} Present, {absentCount} Absent
                </span>
                <p className="text-[11px] text-slate-500">
                  Target Date: <strong>{formatDate(selectedDate)}</strong>
                </p>
              </div>

              <button
                type="button"
                onClick={handleSaveAttendance}
                className="inline-flex items-center space-x-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 px-6 py-3 text-xs font-black text-white shadow-lg shadow-orange-500/25 hover:from-orange-600 hover:to-amber-700 active:scale-95 transition-all"
              >
                <Save className="h-4 w-4" />
                <span>SUBMIT ATTENDANCE</span>
              </button>
            </div>

            {isSaved && (
              <div className="mt-2 rounded-xl bg-emerald-600 p-3 text-center text-xs font-bold text-white shadow-md animate-in fade-in zoom-in-95">
                ✓ Attendance for {selectedClassObj?.name} saved successfully into database!
              </div>
            )}
          </div>
        </>
      ) : (
        /* Attendance History View */
        <div className="rounded-3xl border border-orange-100 bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center space-x-2">
              <History className="h-5 w-5 text-orange-600" />
              <h3 className="font-extrabold text-slate-900 text-sm">
                Monthly Attendance Records • {selectedClassObj?.name}
              </h3>
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {classStudents.map(student => {
              const studentRecords = db.attendance.filter(
                a => a.studentId === student.id
              );
              const presentDays = studentRecords.filter(a => a.status === 'present').length;
              const absentDays = studentRecords.filter(a => a.status === 'absent').length;
              const pct =
                studentRecords.length > 0
                  ? ((presentDays / studentRecords.length) * 100).toFixed(0)
                  : '100';

              return (
                <div
                  key={student.id}
                  className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div className="flex items-center space-x-3">
                    <img
                      src={
                        student.photoUrl ||
                        `https://api.dicebear.com/7.x/adventurer/svg?seed=${student.name}`
                      }
                      alt={student.name}
                      className="h-10 w-10 rounded-full object-cover border border-orange-200"
                    />
                    <div>
                      <h4
                        onClick={() => onSelectStudent && onSelectStudent(student.id)}
                        className="font-bold text-xs text-slate-900 hover:text-orange-600 cursor-pointer"
                      >
                        {student.name}
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Roll No: {student.rollNumber} • Adm: {student.admissionNumber}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-1.5 text-xs">
                      <span className="font-semibold text-emerald-700">
                        {presentDays} Present
                      </span>
                      <span className="text-slate-300">•</span>
                      <span className="font-semibold text-rose-700">{absentDays} Absent</span>
                    </div>

                    <span
                      className={`rounded-lg px-2.5 py-1 text-xs font-black ${
                        Number(pct) >= 75
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {pct}%
                    </span>

                    <button
                      onClick={() => onSelectStudent && onSelectStudent(student.id)}
                      className="rounded-lg bg-orange-50 px-2.5 py-1 text-[11px] font-bold text-orange-700 hover:bg-orange-100"
                    >
                      Calendar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
