import React, { useState, useEffect, useMemo } from 'react';
import {
  CalendarCheck,
  Check,
  X,
  Search,
  Save,
  Users,
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

  // Local attendance state map: { [studentId]: { status: AttendanceStatus; remarks?: string } }
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
        particleCount: 40,
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
    <div className="space-y-6 pb-24 text-[#1d1d1f]">
      {/* Top Header & View Switcher */}
      <div className="bg-white rounded-[18px] border border-[#e5e5ea] p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#30d158]/15 text-[#30d158]">
                <CalendarCheck className="h-5 w-5" />
              </div>
              <h2 className="text-xl font-semibold tracking-[-0.022em] text-[#1d1d1f]">
                Daily Roll-Call & Attendance
              </h2>
            </div>
            <p className="text-xs text-[#86868b] mt-1">
              One-tap marking with real-time analytics synchronization
            </p>
          </div>

          {/* Segmented Control */}
          <div className="flex items-center bg-[#f5f5f7] p-1 rounded-full border border-[#e5e5ea]">
            <button
              onClick={() => setViewMode('take')}
              className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all ${
                viewMode === 'take'
                  ? 'bg-white text-[#1d1d1f] shadow-xs'
                  : 'text-[#86868b] hover:text-[#1d1d1f]'
              }`}
            >
              Take Roll-Call
            </button>
            <button
              onClick={() => setViewMode('history')}
              className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all ${
                viewMode === 'history'
                  ? 'bg-white text-[#1d1d1f] shadow-xs'
                  : 'text-[#86868b] hover:text-[#1d1d1f]'
              }`}
            >
              History & Logs
            </button>
          </div>
        </div>

        {/* Filter Controls: Class & Date */}
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-[#f0f0f0]">
          <div>
            <label className="block text-xs font-medium text-[#86868b] mb-1">
              Select Class / Section
            </label>
            <select
              value={selectedClassId}
              onChange={e => setSelectedClassId(e.target.value)}
              className="apple-input font-medium"
            >
              {db.classes.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} - Section {c.section} ({c.totalStudents || 0} Students)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#86868b] mb-1">
              Attendance Date
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="apple-input font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#86868b] mb-1">
              Filter Student
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#86868b]" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search by name or roll..."
                className="apple-input pl-10"
              />
            </div>
          </div>
        </div>
      </div>

      {viewMode === 'take' ? (
        <>
          {/* Real-time Summary Card */}
          <div className="bg-white rounded-[18px] border border-[#e5e5ea] p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-semibold text-[#0066cc] uppercase tracking-wider">
                  {selectedClassObj?.name} • Summary
                </span>
                <div className="mt-1 flex items-baseline space-x-3">
                  <span className="text-3xl font-semibold tracking-tight text-[#1d1d1f]">{attendancePercentage}%</span>
                  <span className="text-xs text-[#86868b]">
                    {presentCount} of {totalCount} students present
                  </span>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={markAllPresent}
                  className="bg-[#30d158]/10 text-[#30d158] hover:bg-[#30d158] hover:text-white px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all active:scale-95"
                >
                  ✓ All Present
                </button>
                <button
                  onClick={markAllAbsent}
                  className="bg-[#ff3b30]/10 text-[#ff3b30] hover:bg-[#ff3b30] hover:text-white px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all active:scale-95"
                >
                  ✕ All Absent
                </button>
              </div>
            </div>

            {/* Attendance Progress Bar */}
            <div className="mt-4 h-2 w-full overflow-hidden bg-[#f5f5f7] rounded-full">
              <div
                className="h-full bg-[#30d158] rounded-full transition-all duration-300"
                style={{ width: `${attendancePercentage}%` }}
              ></div>
            </div>

            <div className="mt-2.5 flex items-center justify-between text-xs text-[#86868b]">
              <span className="text-[#30d158] font-medium">Present: {presentCount}</span>
              <span className="text-[#ff3b30] font-medium">Absent: {absentCount}</span>
              <span>Total Class: {totalCount}</span>
            </div>
          </div>

          {/* Vertical Fast-Tap Student Cards List */}
          <div className="space-y-3">
            {filteredStudents.length === 0 ? (
              <div className="bg-white rounded-[18px] border border-[#e5e5ea] p-8 text-center shadow-xs">
                <Users className="mx-auto h-10 w-10 text-[#86868b] mb-2" />
                <h4 className="font-semibold text-sm text-[#1d1d1f]">No Students in This Class</h4>
                <p className="text-xs text-[#86868b] mt-1">
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
                    className={`bg-white rounded-2xl border p-3.5 transition-all flex items-center justify-between gap-3 shadow-xs ${
                      isPresent
                        ? 'border-[#30d158]/50'
                        : isAbsent
                        ? 'border-[#ff3b30]/50'
                        : 'border-[#e5e5ea]'
                    }`}
                  >
                    {/* Student Info */}
                    <div
                      onClick={() => onSelectStudent && onSelectStudent(student.id)}
                      className="flex items-center space-x-3.5 cursor-pointer flex-1 min-w-0"
                    >
                      <img
                        src={
                          student.photoUrl ||
                          `https://api.dicebear.com/7.x/adventurer/svg?seed=${student.name}`
                        }
                        alt={student.name}
                        className="h-11 w-11 shrink-0 rounded-full object-cover bg-white apple-product-shadow"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center space-x-1.5">
                          <h4 className="font-semibold text-sm text-[#1d1d1f] truncate">
                            {student.name}
                          </h4>
                          <span className="bg-[#f5f5f7] px-2 py-0.5 rounded-full text-[10px] font-semibold text-[#0066cc]">
                            #{student.rollNumber}
                          </span>
                        </div>
                        <p className="text-xs text-[#86868b] truncate mt-0.5">
                          {student.className} • Guardian: {student.parentName}
                        </p>
                      </div>
                    </div>

                    {/* Large 1-Tap Attendance Segmented Buttons */}
                    <div className="flex items-center space-x-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => setStudentStatus(student.id, 'present')}
                        className={`flex items-center space-x-1 px-3.5 py-2 text-xs font-semibold rounded-full transition-all active:scale-95 ${
                          isPresent
                            ? 'bg-[#30d158] text-white shadow-xs'
                            : 'bg-[#f5f5f7] text-[#30d158] hover:bg-[#30d158]/10'
                        }`}
                      >
                        <Check className="h-3.5 w-3.5 shrink-0" />
                        <span>Present</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setStudentStatus(student.id, 'absent')}
                        className={`flex items-center space-x-1 px-3.5 py-2 text-xs font-semibold rounded-full transition-all active:scale-95 ${
                          isAbsent
                            ? 'bg-[#ff3b30] text-white shadow-xs'
                            : 'bg-[#f5f5f7] text-[#ff3b30] hover:bg-[#ff3b30]/10'
                        }`}
                      >
                        <X className="h-3.5 w-3.5 shrink-0" />
                        <span>Absent</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Sticky Bottom Submit Bar */}
          <div className="sticky bottom-16 lg:bottom-4 z-30 pt-4">
            <div className="bg-white/90 backdrop-blur-xl border border-[#e5e5ea] rounded-2xl p-4 shadow-xl flex items-center justify-between gap-4">
              <div>
                <span className="font-semibold text-xs text-[#1d1d1f]">
                  {presentCount} Present • {absentCount} Absent
                </span>
                <p className="text-[11px] text-[#86868b]">
                  Recording for <strong>{formatDate(selectedDate)}</strong>
                </p>
              </div>

              <button
                type="button"
                onClick={handleSaveAttendance}
                className="apple-btn-primary"
              >
                <Save className="h-4 w-4 mr-2 shrink-0" />
                <span>Save Attendance</span>
              </button>
            </div>

            {isSaved && (
              <div className="mt-2 bg-[#30d158]/15 border border-[#30d158]/30 rounded-xl p-3 text-center text-xs font-semibold text-[#30d158] animate-in fade-in">
                ✓ Attendance records for {selectedClassObj?.name} saved successfully.
              </div>
            )}
          </div>
        </>
      ) : (
        /* Attendance History View */
        <div className="bg-white rounded-[18px] border border-[#e5e5ea] p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#f0f0f0]">
            <div className="flex items-center space-x-2">
              <History className="h-4 w-4 text-[#0066cc] shrink-0" />
              <h3 className="font-semibold text-[#1d1d1f] text-sm">
                Historical Attendance • {selectedClassObj?.name}
              </h3>
            </div>
          </div>

          <div className="divide-y divide-[#f0f0f0]">
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
                  className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center space-x-3.5">
                    <img
                      src={
                        student.photoUrl ||
                        `https://api.dicebear.com/7.x/adventurer/svg?seed=${student.name}`
                      }
                      alt={student.name}
                      className="h-10 w-10 rounded-full object-cover bg-white apple-product-shadow"
                    />
                    <div>
                      <h4
                        onClick={() => onSelectStudent && onSelectStudent(student.id)}
                        className="font-semibold text-sm text-[#1d1d1f] hover:text-[#0066cc] cursor-pointer"
                      >
                        {student.name}
                      </h4>
                      <p className="text-xs text-[#86868b]">
                        Roll #{student.rollNumber} • Adm #{student.admissionNumber}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2 text-xs">
                      <span className="font-semibold text-[#30d158]">
                        {presentDays} Present
                      </span>
                      <span className="text-[#86868b]">•</span>
                      <span className="font-semibold text-[#ff3b30]">{absentDays} Absent</span>
                    </div>

                    <span
                      className={`px-3 py-0.5 rounded-full text-xs font-semibold ${
                        Number(pct) >= 75
                          ? 'bg-[#30d158]/10 text-[#30d158]'
                          : 'bg-[#ff3b30]/10 text-[#ff3b30]'
                      }`}
                    >
                      {pct}%
                    </span>

                    <button
                      onClick={() => onSelectStudent && onSelectStudent(student.id)}
                      className="apple-btn-secondary py-1 text-xs"
                    >
                      Profile
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
