import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  SchoolDatabase,
  User,
  Student,
  ClassRoom,
  AttendanceRecord,
  TeacherAttendanceRecord,
  FeeAccount,
  FeeTransaction,
  StudentResult,
  Exam,
  PerformanceRecord,
  AcademicYear,
  ActivityLog,
  SchoolInfo,
  AttendanceStatus,
  TeacherAttendanceStatus,
} from '../types';
import { INITIAL_SCHOOL_DATABASE } from '../data/initialData';
import { generateTeacherCode, generateReceiptNumber, getTodayDateString } from '../utils/helpers';

const STORAGE_KEY = 'msps_school_database_v2';
const AUTH_KEY = 'msps_auth_user_v2';

interface AdminImpersonation {
  active: boolean;
  teacherId: string;
  teacherName: string;
  classId: string;
  className: string;
}

interface SchoolContextType {
  db: SchoolDatabase;
  currentUser: User | null;
  adminImpersonation: AdminImpersonation | null;
  unreadNotificationCount: number;
  
  // Auth
  loginPrincipal: (email: string, password: string) => { success: boolean; error?: string };
  setupSchoolAndPrincipal: (data: {
    principalName: string;
    schoolName: string;
    email: string;
    password: string;
    phone?: string;
  }) => { success: boolean; error?: string };
  loginTeacher: (code: string) => { success: boolean; error?: string };
  logout: () => void;
  
  // Impersonation
  startAdminClassAccess: (teacherId: string) => void;
  exitAdminClassAccess: () => void;
  
  // Teachers
  addTeacher: (data: Partial<User>) => { success: boolean; teacher?: User };
  updateTeacher: (id: string, data: Partial<User>) => void;
  archiveTeacher: (id: string) => void;
  restoreTeacher: (id: string) => void;
  regenerateTeacherCode: (id: string) => string;
  
  // Classes
  addClass: (data: Partial<ClassRoom>) => void;
  updateClass: (id: string, data: Partial<ClassRoom>) => void;
  
  // Students
  addStudent: (data: Partial<Student>) => Student;
  updateStudent: (id: string, data: Partial<Student>) => void;
  archiveStudent: (id: string) => void;
  restoreStudent: (id: string) => void;
  
  // Attendance
  saveAttendanceBatch: (
    classId: string,
    date: string,
    items: { studentId: string; studentName: string; rollNumber: string; status: AttendanceStatus; remarks?: string }[]
  ) => void;
  markTeacherAttendance: (
    teacherId: string,
    date: string,
    status: TeacherAttendanceStatus,
    remarks?: string
  ) => void;
  
  // Fees
  recordFeeTransaction: (data: {
    studentId: string;
    amount: number;
    paymentDate: string;
    paymentMethod: 'Cash' | 'UPI' | 'Bank Transfer' | 'Cheque' | 'Online';
    notes?: string;
  }) => FeeTransaction | null;
  updateStudentFeeAccount: (studentId: string, totalFee: number) => void;
  
  // Exams & Results
  addExam: (data: Omit<Exam, 'id'>) => Exam;
  saveStudentResult: (data: Omit<StudentResult, 'id' | 'createdAt'>) => StudentResult;
  
  // Performance
  addPerformanceRecord: (data: Omit<PerformanceRecord, 'id' | 'createdAt'>) => void;
  
  // Academic Year & Promotion
  promoteStudents: (fromClassId: string, toClassId: string, studentIds: string[]) => void;
  changeAcademicYear: (yearId: string) => void;
  addAcademicYear: (data: Omit<AcademicYear, 'id'>) => void;
  
  // Settings & Notifications
  updateSchoolInfo: (data: Partial<SchoolInfo>) => void;
  updateSchoolSettings: (data: Partial<SchoolInfo>) => void;
  deleteResult: (id: string) => void;
  addResult: (data: Omit<StudentResult, 'id' | 'createdAt'>) => StudentResult;
  addPerformance: (data: Omit<PerformanceRecord, 'id' | 'createdAt'>) => void;
  deletePerformance: (id: string) => void;
  deleteStudent: (id: string) => void;
  deleteTeacher: (id: string) => void;
  deleteClass: (id: string) => void;
  markNotificationAsRead: (id: string) => void;
  markAllNotificationsAsRead: () => void;
  resetDatabaseToDemo: () => void;
}

const SchoolContext = createContext<SchoolContextType | undefined>(undefined);

export const SchoolProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [db, setDb] = useState<SchoolDatabase>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.schoolInfo) {
            // Ensure permanent principal is synced
            const users = (parsed.users || []).filter(
              (u: User) => !u.id.startsWith('usr_teach_') || u.teacherCode
            );
            const hasPrincipal = users.some(
              (u: User) => u.role === 'principal' && u.email === 'mozammilalam1996@gmail.com'
            );
            if (!hasPrincipal) {
              users.unshift({
                id: 'usr_principal_01',
                name: 'Mozammil Alam',
                email: 'mozammilalam1996@gmail.com',
                role: 'principal',
                password: '9931066436@',
                phone: '+91 99310 66436',
                status: 'active',
                joiningDate: '2026-01-01',
                createdAt: '2026-01-01T00:00:00.000Z',
              });
            } else {
              // Ensure password matches
              const p = users.find((u: User) => u.role === 'principal' && u.email === 'mozammilalam1996@gmail.com');
              if (p) {
                p.password = '9931066436@';
                p.name = 'Mozammil Alam';
              }
            }
            parsed.users = users;
            return parsed;
          }
        }
      } catch (e) {
        console.error('Failed to load database from localStorage', e);
      }
    }
    return INITIAL_SCHOOL_DATABASE;
  });

  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(AUTH_KEY);
        if (saved) {
          return JSON.parse(saved);
        }
      } catch (e) {
        console.error('Failed to parse saved auth user', e);
      }
    }
    return null;
  });

  const [adminImpersonation, setAdminImpersonation] = useState<AdminImpersonation | null>(null);

  // Sync database to local storage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    } catch (e) {
      console.error('Error saving db to local storage', e);
    }
  }, [db]);

  // Sync auth state
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(AUTH_KEY, JSON.stringify(currentUser));
    } else {
      localStorage.removeItem(AUTH_KEY);
      setAdminImpersonation(null);
    }
  }, [currentUser]);

  // Activity logger helper
  const logActivity = useCallback((
    action: string,
    details: string,
    entityType?: ActivityLog['entityType'],
    entityId?: string
  ) => {
    const newLog: ActivityLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      userId: currentUser?.id || 'sys',
      userName: currentUser ? currentUser.name + (adminImpersonation ? ' (Admin Mode)' : '') : 'System',
      userRole: currentUser?.role || 'principal',
      action,
      details,
      timestamp: new Date().toISOString(),
      entityType,
      entityId,
    };
    setDb(prev => ({
      ...prev,
      activityLogs: [newLog, ...prev.activityLogs.slice(0, 199)],
    }));
  }, [currentUser, adminImpersonation]);

  // Authentication methods
  const loginPrincipal = (email: string, password: string) => {
    const inputEmail = email.trim().toLowerCase();
    const inputPass = password.trim();

    // Direct permanent credentials check
    if (inputEmail === 'mozammilalam1996@gmail.com' && inputPass === '9931066436@') {
      let principalUser = db.users.find(u => u.role === 'principal' && u.email === 'mozammilalam1996@gmail.com');
      if (!principalUser) {
        principalUser = {
          id: 'usr_principal_01',
          name: 'Mozammil Alam',
          email: 'mozammilalam1996@gmail.com',
          role: 'principal',
          password: '9931066436@',
          phone: '+91 99310 66436',
          status: 'active',
          joiningDate: '2026-01-01',
          createdAt: '2026-01-01T00:00:00.000Z',
        };
      }
      setCurrentUser(principalUser);
      setAdminImpersonation(null);
      logActivity('LOGIN_PRINCIPAL', `Principal Mozammil Alam logged into Admin Dashboard`);
      return { success: true };
    }

    const user = db.users.find(
      u => u.role === 'principal' && u.email.toLowerCase() === inputEmail
    );
    if (!user) {
      return { success: false, error: 'No Principal account found with this email address.' };
    }
    if (user.password && user.password !== inputPass) {
      return { success: false, error: 'Incorrect password. Please try again.' };
    }
    setCurrentUser(user);
    setAdminImpersonation(null);
    logActivity('LOGIN_PRINCIPAL', `Principal ${user.name} logged into Admin Dashboard`);
    return { success: true };
  };

  const setupSchoolAndPrincipal = (data: {
    principalName: string;
    schoolName: string;
    email: string;
    password: string;
    phone?: string;
  }) => {
    const newPrincipal: User = {
      id: `usr_prin_${Date.now()}`,
      name: data.principalName.trim(),
      email: data.email.trim().toLowerCase(),
      role: 'principal',
      password: data.password.trim(),
      phone: data.phone || '',
      status: 'active',
      joiningDate: getTodayDateString(),
      createdAt: new Date().toISOString(),
    };

    setDb(prev => ({
      ...prev,
      schoolInfo: {
        ...prev.schoolInfo,
        name: data.schoolName.trim() || 'M.S. PUBLIC SCHOOL',
        email: data.email.trim().toLowerCase(),
        phone: data.phone || prev.schoolInfo.phone,
        setupCompleted: true,
      },
      users: [
        ...prev.users.filter(u => u.role !== 'principal'),
        newPrincipal,
      ],
    }));

    setCurrentUser(newPrincipal);
    logActivity('SCHOOL_SETUP', `School configured and Principal account created for ${data.principalName}`);
    return { success: true };
  };

  const loginTeacher = (code: string) => {
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) {
      return { success: false, error: 'Please enter your unique Teacher Code.' };
    }
    const teacher = db.users.find(
      u => u.role === 'teacher' && u.teacherCode?.toUpperCase() === cleanCode
    );
    if (!teacher) {
      return { success: false, error: 'Invalid Teacher Code. Please check or contact the Principal.' };
    }
    if (teacher.status === 'archived') {
      return { success: false, error: 'This teacher account is currently archived. Please contact the Principal.' };
    }
    setCurrentUser(teacher);
    setAdminImpersonation(null);
    logActivity('LOGIN_TEACHER', `Teacher ${teacher.name} (${teacher.teacherCode}) logged in`);
    return { success: true };
  };

  const logout = () => {
    if (currentUser) {
      logActivity('LOGOUT', `${currentUser.name} logged out`);
    }
    setCurrentUser(null);
    setAdminImpersonation(null);
  };

  // Admin class access / impersonation
  const startAdminClassAccess = (teacherId: string) => {
    if (currentUser?.role !== 'principal') return;
    const teacher = db.users.find(u => u.id === teacherId);
    if (!teacher || !teacher.assignedClassId) return;

    const assignedClass = db.classes.find(c => c.id === teacher.assignedClassId);
    setAdminImpersonation({
      active: true,
      teacherId: teacher.id,
      teacherName: teacher.name,
      classId: teacher.assignedClassId,
      className: assignedClass?.name || teacher.assignedClassName || 'Assigned Class',
    });
    logActivity('ADMIN_CLASS_ACCESS_START', `Principal entered Admin Access Mode for ${teacher.name}'s class (${assignedClass?.name})`);
  };

  const exitAdminClassAccess = () => {
    if (adminImpersonation) {
      logActivity('ADMIN_CLASS_ACCESS_EXIT', `Principal exited Admin Access Mode for ${adminImpersonation.teacherName}`);
    }
    setAdminImpersonation(null);
  };

  // Teacher Management
  const addTeacher = (data: Partial<User>) => {
    const assignedClass = data.assignedClassId ? db.classes.find(c => c.id === data.assignedClassId) : undefined;
    const uniqueCode = data.teacherCode || generateTeacherCode();

    const newTeacher: User = {
      id: `usr_teach_${Date.now()}`,
      name: (data.name || 'New Teacher').trim(),
      email: (data.email || `${(data.name || 'teacher').toLowerCase().replace(/\s+/g, '.')}@mspublicschool.edu.in`).trim(),
      role: 'teacher',
      teacherCode: uniqueCode,
      assignedClassId: data.assignedClassId,
      assignedClassName: assignedClass?.name || data.assignedClassName,
      subject: data.subject || 'General',
      phone: data.phone || '',
      photoUrl: data.photoUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${uniqueCode}`,
      status: 'active',
      joiningDate: data.joiningDate || getTodayDateString(),
      createdAt: new Date().toISOString(),
    };

    setDb(prev => {
      // If class is assigned, update class teacher as well
      const updatedClasses = prev.classes.map(c => {
        if (data.assignedClassId && c.id === data.assignedClassId) {
          return { ...c, classTeacherId: newTeacher.id, classTeacherName: newTeacher.name };
        }
        return c;
      });

      return {
        ...prev,
        users: [...prev.users, newTeacher],
        classes: updatedClasses,
      };
    });

    logActivity('TEACHER_ADDED', `Added new teacher: ${newTeacher.name} (Code: ${newTeacher.teacherCode})`, 'teacher', newTeacher.id);
    return { success: true, teacher: newTeacher };
  };

  const updateTeacher = (id: string, data: Partial<User>) => {
    setDb(prev => {
      const teacher = prev.users.find(u => u.id === id);
      if (!teacher) return prev;

      const updatedUsers = prev.users.map(u => (u.id === id ? { ...u, ...data } : u));
      let updatedClasses = prev.classes;

      if (data.assignedClassId && data.assignedClassId !== teacher.assignedClassId) {
        const assignedClass = prev.classes.find(c => c.id === data.assignedClassId);
        updatedClasses = prev.classes.map(c => {
          if (c.id === data.assignedClassId) {
            return { ...c, classTeacherId: id, classTeacherName: data.name || teacher.name };
          }
          if (c.id === teacher.assignedClassId) {
            return { ...c, classTeacherId: undefined, classTeacherName: undefined };
          }
          return c;
        });
      }

      return {
        ...prev,
        users: updatedUsers,
        classes: updatedClasses,
      };
    });
    logActivity('TEACHER_UPDATED', `Updated teacher details for ID ${id}`, 'teacher', id);
  };

  const archiveTeacher = (id: string) => {
    setDb(prev => ({
      ...prev,
      users: prev.users.map(u => (u.id === id ? { ...u, status: 'archived' } : u)),
    }));
    logActivity('TEACHER_ARCHIVED', `Archived teacher account for ID ${id}`, 'teacher', id);
  };

  const restoreTeacher = (id: string) => {
    setDb(prev => ({
      ...prev,
      users: prev.users.map(u => (u.id === id ? { ...u, status: 'active' } : u)),
    }));
    logActivity('TEACHER_RESTORED', `Restored teacher account for ID ${id}`, 'teacher', id);
  };

  const regenerateTeacherCode = (id: string): string => {
    const newCode = generateTeacherCode();
    setDb(prev => ({
      ...prev,
      users: prev.users.map(u => (u.id === id ? { ...u, teacherCode: newCode } : u)),
    }));
    logActivity('TEACHER_CODE_REGENERATED', `Regenerated teacher code to ${newCode}`, 'teacher', id);
    return newCode;
  };

  // Class Management
  const addClass = (data: Partial<ClassRoom>) => {
    const newClass: ClassRoom = {
      id: `cls_${Date.now()}`,
      name: (data.name || 'New Class').trim(),
      section: (data.section || 'A').toUpperCase().trim(),
      roomNumber: data.roomNumber || `R-${Math.floor(100 + Math.random() * 200)}`,
      capacity: data.capacity || 40,
      totalStudents: 0,
    };
    setDb(prev => ({
      ...prev,
      classes: [...prev.classes, newClass],
    }));
    logActivity('CLASS_CREATED', `Created new class: ${newClass.name} - Section ${newClass.section}`, 'class', newClass.id);
  };

  const updateClass = (id: string, data: Partial<ClassRoom>) => {
    setDb(prev => ({
      ...prev,
      classes: prev.classes.map(c => (c.id === id ? { ...c, ...data } : c)),
    }));
    logActivity('CLASS_UPDATED', `Updated class ${id}`, 'class', id);
  };

  // Student Management
  const addStudent = (data: Partial<Student>): Student => {
    const classItem = db.classes.find(c => c.id === data.classId);
    const className = classItem?.name || data.className || 'Class 1';

    const newStudent: Student = {
      id: `std_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      name: (data.name || 'Student Name').trim(),
      rollNumber: (data.rollNumber || '01').padStart(2, '0'),
      classId: data.classId || (db.classes[0]?.id || 'cls_01'),
      className,
      age: data.age || 8,
      dob: data.dob || '2016-01-01',
      gender: data.gender || 'Male',
      parentName: (data.parentName || 'Parent Name').trim(),
      parentPhone: data.parentPhone || '',
      parentRelation: data.parentRelation || 'Parent',
      address: data.address || '',
      admissionNumber: data.admissionNumber || `MSPS-${db.schoolInfo.currentAcademicYear.slice(0, 4)}-${Math.floor(100 + Math.random() * 900)}`,
      admissionDate: data.admissionDate || getTodayDateString(),
      photoUrl: data.photoUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${data.name || 'student'}`,
      status: 'active',
      notes: data.notes || '',
      bloodGroup: data.bloodGroup || 'O+',
      academicYear: data.academicYear || db.schoolInfo.currentAcademicYear,
      createdAt: new Date().toISOString(),
    };

    // Create default fee account (e.g. ₹24,000 annual fee)
    const newFeeAccount: FeeAccount = {
      id: `fee_${newStudent.id}`,
      studentId: newStudent.id,
      studentName: newStudent.name,
      rollNumber: newStudent.rollNumber,
      classId: newStudent.classId,
      className: newStudent.className,
      totalFee: 24000,
      paidAmount: 0,
      dueAmount: 24000,
      status: 'due',
    };

    setDb(prev => {
      // Recalculate class student count
      const updatedClasses = prev.classes.map(c => {
        if (c.id === newStudent.classId) {
          return { ...c, totalStudents: (c.totalStudents || 0) + 1 };
        }
        return c;
      });

      return {
        ...prev,
        students: [newStudent, ...prev.students],
        feeAccounts: [...prev.feeAccounts, newFeeAccount],
        classes: updatedClasses,
      };
    });

    logActivity('STUDENT_ADDED', `Admitted student ${newStudent.name} (${newStudent.admissionNumber}) to ${newStudent.className}`, 'student', newStudent.id);
    return newStudent;
  };

  const updateStudent = (id: string, data: Partial<Student>) => {
    setDb(prev => {
      const student = prev.students.find(s => s.id === id);
      if (!student) return prev;

      const updatedStudent = { ...student, ...data, updatedAt: new Date().toISOString() };
      
      // Update fee account student name / class if changed
      const updatedFeeAccounts = prev.feeAccounts.map(fa => {
        if (fa.studentId === id) {
          return {
            ...fa,
            studentName: updatedStudent.name,
            rollNumber: updatedStudent.rollNumber,
            classId: updatedStudent.classId,
            className: updatedStudent.className,
          };
        }
        return fa;
      });

      return {
        ...prev,
        students: prev.students.map(s => (s.id === id ? updatedStudent : s)),
        feeAccounts: updatedFeeAccounts,
      };
    });
    logActivity('STUDENT_UPDATED', `Updated student profile for ID ${id}`, 'student', id);
  };

  const archiveStudent = (id: string) => {
    setDb(prev => {
      const student = prev.students.find(s => s.id === id);
      const updatedClasses = prev.classes.map(c => {
        if (student && c.id === student.classId && (c.totalStudents || 0) > 0) {
          return { ...c, totalStudents: (c.totalStudents || 1) - 1 };
        }
        return c;
      });

      return {
        ...prev,
        students: prev.students.map(s => (s.id === id ? { ...s, status: 'archived' } : s)),
        classes: updatedClasses,
      };
    });
    logActivity('STUDENT_ARCHIVED', `Archived student ID ${id} (historical records preserved)`, 'student', id);
  };

  const restoreStudent = (id: string) => {
    setDb(prev => {
      const student = prev.students.find(s => s.id === id);
      const updatedClasses = prev.classes.map(c => {
        if (student && c.id === student.classId) {
          return { ...c, totalStudents: (c.totalStudents || 0) + 1 };
        }
        return c;
      });

      return {
        ...prev,
        students: prev.students.map(s => (s.id === id ? { ...s, status: 'active' } : s)),
        classes: updatedClasses,
      };
    });
    logActivity('STUDENT_RESTORED', `Restored student ID ${id}`, 'student', id);
  };

  // Attendance Submission
  const saveAttendanceBatch = (
    classId: string,
    date: string,
    items: { studentId: string; studentName: string; rollNumber: string; status: AttendanceStatus; remarks?: string }[]
  ) => {
    const classObj = db.classes.find(c => c.id === classId);
    const className = classObj?.name || 'Class';
    const nowIso = new Date().toISOString();

    const newRecords: AttendanceRecord[] = items.map(item => ({
      id: `att_${classId}_${item.studentId}_${date}`,
      date,
      classId,
      className,
      studentId: item.studentId,
      studentName: item.studentName,
      rollNumber: item.rollNumber,
      status: item.status,
      markedByUserId: currentUser?.id || 'sys',
      markedByUserName: currentUser?.name || 'Admin',
      markedByRole: currentUser?.role || 'teacher',
      timestamp: nowIso,
      remarks: item.remarks,
    }));

    setDb(prev => {
      // Remove existing attendance records for this class & date, then add new
      const filtered = prev.attendance.filter(
        a => !(a.classId === classId && a.date === date)
      );
      return {
        ...prev,
        attendance: [...filtered, ...newRecords],
      };
    });

    const presentCount = items.filter(i => i.status === 'present').length;
    const absentCount = items.filter(i => i.status === 'absent').length;

    logActivity(
      'ATTENDANCE_SAVED',
      `Marked attendance for ${className} on ${date}: ${presentCount} Present, ${absentCount} Absent`,
      'attendance'
    );
  };

  const markTeacherAttendance = (
    teacherId: string,
    date: string,
    status: TeacherAttendanceStatus,
    remarks?: string
  ) => {
    const teacher = db.users.find(u => u.id === teacherId);
    if (!teacher) return;

    const record: TeacherAttendanceRecord = {
      id: `t_att_${teacherId}_${date}`,
      date,
      teacherId,
      teacherName: teacher.name,
      teacherCode: teacher.teacherCode || '',
      status,
      remarks,
      markedAt: new Date().toISOString(),
    };

    setDb(prev => {
      const filtered = prev.teacherAttendance.filter(
        t => !(t.teacherId === teacherId && t.date === date)
      );
      return {
        ...prev,
        teacherAttendance: [...filtered, record],
      };
    });

    logActivity('TEACHER_ATTENDANCE_MARKED', `Teacher attendance marked for ${teacher.name}: ${status.toUpperCase()}`, 'teacher', teacherId);
  };

  // Fees
  const recordFeeTransaction = (data: {
    studentId: string;
    amount: number;
    paymentDate: string;
    paymentMethod: 'Cash' | 'UPI' | 'Bank Transfer' | 'Cheque' | 'Online';
    notes?: string;
  }): FeeTransaction | null => {
    const student = db.students.find(s => s.id === data.studentId);
    if (!student) return null;

    const existingFeeAccount = db.feeAccounts.find(fa => fa.studentId === data.studentId) || {
      id: `fee_${student.id}`,
      studentId: student.id,
      studentName: student.name,
      rollNumber: student.rollNumber,
      classId: student.classId,
      className: student.className,
      totalFee: 24000,
      paidAmount: 0,
      dueAmount: 24000,
      status: 'due' as const,
    };

    const newPaidAmount = (existingFeeAccount.paidAmount || 0) + Number(data.amount);
    const newDueAmount = Math.max(0, (existingFeeAccount.totalFee || 0) - newPaidAmount);
    const newStatus = newDueAmount === 0 ? 'paid' : newPaidAmount > 0 ? 'partial' : 'due';

    const receiptNo = generateReceiptNumber();

    const transaction: FeeTransaction = {
      id: `txn_${Date.now()}`,
      feeAccountId: existingFeeAccount.id,
      studentId: student.id,
      studentName: student.name,
      classId: student.classId,
      className: student.className,
      amount: Number(data.amount),
      paymentDate: data.paymentDate || getTodayDateString(),
      paymentMethod: data.paymentMethod,
      receiptNumber: receiptNo,
      notes: data.notes || '',
      recordedByName: currentUser?.name || 'Admin',
      recordedByUserId: currentUser?.id || 'sys',
      timestamp: new Date().toISOString(),
    };

    const updatedFeeAccount: FeeAccount = {
      ...existingFeeAccount,
      paidAmount: newPaidAmount,
      dueAmount: newDueAmount,
      status: newStatus,
      lastPaymentDate: data.paymentDate,
    };

    setDb(prev => ({
      ...prev,
      feeTransactions: [transaction, ...prev.feeTransactions],
      feeAccounts: prev.feeAccounts.some(fa => fa.studentId === data.studentId)
        ? prev.feeAccounts.map(fa => (fa.studentId === data.studentId ? updatedFeeAccount : fa))
        : [...prev.feeAccounts, updatedFeeAccount],
    }));

    logActivity(
      'FEE_COLLECTED',
      `Received fee of ₹${data.amount.toLocaleString('en-IN')} for ${student.name} (${student.className}) via ${data.paymentMethod} (Receipt: ${receiptNo})`,
      'fee',
      transaction.id
    );

    return transaction;
  };

  const updateStudentFeeAccount = (studentId: string, totalFee: number) => {
    setDb(prev => {
      const feeAccount = prev.feeAccounts.find(fa => fa.studentId === studentId);
      if (!feeAccount) return prev;

      const newTotal = Number(totalFee);
      const newDue = Math.max(0, newTotal - (feeAccount.paidAmount || 0));
      const newStatus = newDue === 0 ? 'paid' : (feeAccount.paidAmount || 0) > 0 ? 'partial' : 'due';

      return {
        ...prev,
        feeAccounts: prev.feeAccounts.map(fa =>
          fa.studentId === studentId
            ? { ...fa, totalFee: newTotal, dueAmount: newDue, status: newStatus }
            : fa
        ),
      };
    });
    logActivity('FEE_STRUCTURE_UPDATED', `Updated total fee structure for student ID ${studentId}`);
  };

  // Exams & Results
  const addExam = (data: Omit<Exam, 'id'>): Exam => {
    const newExam: Exam = {
      ...data,
      id: `ex_${Date.now()}`,
    };
    setDb(prev => ({
      ...prev,
      exams: [...prev.exams, newExam],
    }));
    logActivity('EXAM_CREATED', `Created examination: ${newExam.name} (${newExam.academicYear})`);
    return newExam;
  };

  const saveStudentResult = (data: Omit<StudentResult, 'id' | 'createdAt'>): StudentResult => {
    const newResult: StudentResult = {
      ...data,
      id: `res_${data.studentId}_${data.examId || 'exam'}_${Date.now()}`,
      createdAt: new Date().toISOString(),
    };

    setDb(prev => {
      // Remove any existing result for same student & exam
      const filtered = prev.results.filter(
        r => !(r.studentId === data.studentId && r.examName === data.examName)
      );
      return {
        ...prev,
        results: [newResult, ...filtered],
      };
    });

    logActivity('RESULT_SAVED', `Recorded result for ${data.studentName} in ${data.examName} (${data.percentage}% - Grade: ${data.grade})`, 'result', newResult.id);
    return newResult;
  };

  // Performance
  const addPerformanceRecord = (data: Omit<PerformanceRecord, 'id' | 'createdAt'>) => {
    const newRecord: PerformanceRecord = {
      ...data,
      id: `perf_${Date.now()}`,
      createdAt: new Date().toISOString(),
    };

    setDb(prev => ({
      ...prev,
      performance: [newRecord, ...prev.performance],
    }));

    logActivity('PERFORMANCE_NOTE_ADDED', `Added ${data.category} performance feedback for ${data.studentName} (Rating: ${data.rating})`, 'student', data.studentId);
  };

  // Promotion
  const promoteStudents = (fromClassId: string, toClassId: string, studentIds: string[]) => {
    const toClass = db.classes.find(c => c.id === toClassId);
    if (!toClass) return;

    setDb(prev => {
      const updatedStudents = prev.students.map(s => {
        if (studentIds.includes(s.id)) {
          return {
            ...s,
            classId: toClassId,
            className: toClass.name,
            updatedAt: new Date().toISOString(),
          };
        }
        return s;
      });

      const updatedFeeAccounts = prev.feeAccounts.map(fa => {
        if (studentIds.includes(fa.studentId)) {
          return {
            ...fa,
            classId: toClassId,
            className: toClass.name,
          };
        }
        return fa;
      });

      return {
        ...prev,
        students: updatedStudents,
        feeAccounts: updatedFeeAccounts,
      };
    });

    logActivity('STUDENTS_PROMOTED', `Promoted ${studentIds.length} students to ${toClass.name}`, 'class', toClassId);
  };

  // Academic Year
  const changeAcademicYear = (yearId: string) => {
    const yearObj = db.academicYears.find(y => y.id === yearId);
    if (!yearObj) return;

    setDb(prev => ({
      ...prev,
      schoolInfo: {
        ...prev.schoolInfo,
        currentAcademicYear: yearObj.name,
      },
      academicYears: prev.academicYears.map(y => ({
        ...y,
        isCurrent: y.id === yearId,
      })),
    }));

    logActivity('ACADEMIC_YEAR_CHANGED', `Switched active academic session to ${yearObj.name}`, 'academic_year', yearId);
  };

  const addAcademicYear = (data: Omit<AcademicYear, 'id'>) => {
    const newYear: AcademicYear = {
      ...data,
      id: `ay_${Date.now()}`,
    };
    setDb(prev => ({
      ...prev,
      academicYears: [...prev.academicYears, newYear],
    }));
    logActivity('ACADEMIC_YEAR_ADDED', `Added new academic year: ${newYear.name}`, 'academic_year', newYear.id);
  };

  // Results & Performance deletion/helpers
  const deleteResult = (id: string) => {
    setDb(prev => ({
      ...prev,
      results: prev.results.filter(r => r.id !== id),
    }));
    logActivity('RESULT_DELETED', `Deleted examination result`, 'result', id);
  };

  const deletePerformance = (id: string) => {
    setDb(prev => ({
      ...prev,
      performance: prev.performance.filter(p => p.id !== id),
    }));
    logActivity('PERFORMANCE_DELETED', `Deleted performance note`, 'student', id);
  };

  const deleteStudent = (id: string) => {
    setDb(prev => ({
      ...prev,
      students: prev.students.filter(s => s.id !== id),
      feeAccounts: prev.feeAccounts.filter(fa => fa.studentId !== id),
      attendance: prev.attendance.filter(a => a.studentId !== id),
      results: prev.results.filter(r => r.studentId !== id),
      performance: prev.performance.filter(p => p.studentId !== id),
    }));
    logActivity('STUDENT_DELETED', `Permanently removed student records`, 'student', id);
  };

  const deleteTeacher = (id: string) => {
    setDb(prev => ({
      ...prev,
      users: prev.users.filter(u => u.id !== id),
      teacherAttendance: prev.teacherAttendance.filter(ta => ta.teacherId !== id),
    }));
    logActivity('TEACHER_DELETED', `Permanently removed teacher`, 'teacher', id);
  };

  const deleteClass = (id: string) => {
    setDb(prev => ({
      ...prev,
      classes: prev.classes.filter(c => c.id !== id),
    }));
    logActivity('CLASS_DELETED', `Deleted class`, 'class', id);
  };

  // Settings & Notifications
  const updateSchoolInfo = (data: Partial<SchoolInfo>) => {
    setDb(prev => {
      const updated = {
        ...prev,
        schoolInfo: {
          ...prev.schoolInfo,
          ...data,
        },
      };
      // Ensure immediately saved to localStorage
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (err) {
        console.error('Failed to sync settings to localStorage', err);
      }
      return updated;
    });
    logActivity('SCHOOL_SETTINGS_UPDATED', `Updated school institutional details`);
  };

  const updateSchoolSettings = updateSchoolInfo;
  const addResult = saveStudentResult;
  const addPerformance = addPerformanceRecord;

  const markNotificationAsRead = (id: string) => {
    setDb(prev => ({
      ...prev,
      notifications: prev.notifications.map(n => (n.id === id ? { ...n, isRead: true } : n)),
    }));
  };

  const markAllNotificationsAsRead = () => {
    setDb(prev => ({
      ...prev,
      notifications: prev.notifications.map(n => ({ ...n, isRead: true })),
    }));
  };

  const resetDatabaseToDemo = () => {
    setDb(INITIAL_SCHOOL_DATABASE);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_SCHOOL_DATABASE));
    logActivity('DEMO_RESET', 'Reset school database to initial default demo data');
  };

  const unreadNotificationCount = db.notifications.filter(n => !n.isRead).length;

  return (
    <SchoolContext.Provider
      value={{
        db,
        currentUser,
        adminImpersonation,
        unreadNotificationCount,
        loginPrincipal,
        setupSchoolAndPrincipal,
        loginTeacher,
        logout,
        startAdminClassAccess,
        exitAdminClassAccess,
        addTeacher,
        updateTeacher,
        archiveTeacher,
        restoreTeacher,
        regenerateTeacherCode,
        addClass,
        updateClass,
        deleteClass,
        addStudent,
        updateStudent,
        archiveStudent,
        restoreStudent,
        deleteStudent,
        deleteTeacher,
        saveAttendanceBatch,
        markTeacherAttendance,
        recordFeeTransaction,
        updateStudentFeeAccount,
        addExam,
        saveStudentResult,
        addResult,
        deleteResult,
        addPerformanceRecord,
        addPerformance,
        deletePerformance,
        promoteStudents,
        changeAcademicYear,
        addAcademicYear,
        updateSchoolInfo,
        updateSchoolSettings,
        markNotificationAsRead,
        markAllNotificationsAsRead,
        resetDatabaseToDemo,
      }}
    >
      {children}
    </SchoolContext.Provider>
  );
};

export const useSchool = () => {
  const context = useContext(SchoolContext);
  if (!context) {
    throw new Error('useSchool must be used within a SchoolProvider');
  }
  return context;
};
