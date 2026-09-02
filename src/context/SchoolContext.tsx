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
import { isDesktopApp, getSchoolApp, DesktopSessionInfo } from '../services/desktopBridge';
import {
  seedInitialDatabaseIfNeeded,
  subscribeToSchoolDatabase,
  saveSchoolInfoToFirestore,
  saveUserToFirestore,
  deleteUserFromFirestore,
  saveClassToFirestore,
  deleteClassFromFirestore,
  saveStudentToFirestore,
  deleteStudentFromFirestore,
  saveAttendanceBatchToFirestore,
  saveTeacherAttendanceToFirestore,
  saveFeeAccountToFirestore,
  saveFeeTransactionToFirestore,
  saveExamToFirestore,
  saveResultToFirestore,
  deleteResultFromFirestore,
  savePerformanceToFirestore,
  deletePerformanceFromFirestore,
  saveAcademicYearToFirestore,
  saveActivityLogToFirestore,
  saveNotificationToFirestore,
} from '../services/dataService';

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
  isCloudConnected: boolean;
  isCloudSyncing: boolean;
  lastCloudSyncTime: string | null;
  cloudError: string | null;

  // Desktop edition (Electron) state
  isDesktop: boolean;
  desktopSession: DesktopSessionInfo | null;
  desktopInitializing: boolean;
  refreshDesktopSession: () => Promise<void>;

  // Auth
  loginPrincipal: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  setupSchoolAndPrincipal: (data: {
    principalName: string;
    schoolName: string;
    email: string;
    password: string;
    phone?: string;
  }) => { success: boolean; error?: string };
  loginTeacher: (code: string) => Promise<{ success: boolean; error?: string }>;
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
  importFullDatabase: (importedDb: SchoolDatabase) => { success: boolean; error?: string };
}

const SchoolContext = createContext<SchoolContextType | undefined>(undefined);

export const SchoolProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const desktop = isDesktopApp();

  const [db, setDb] = useState<SchoolDatabase>(() => {
    // Desktop edition: SQLite (owned by the Electron main process) is the
    // source of truth — the initial in-memory copy is replaced on load.
    if (!desktop && typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.schoolInfo) {
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
    // Desktop sessions are restored by the main process (secure storage),
    // never from renderer-accessible localStorage.
    if (!desktop && typeof window !== 'undefined') {
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
  const [isCloudConnected, setIsCloudConnected] = useState<boolean>(false);
  const [isCloudSyncing, setIsCloudSyncing] = useState<boolean>(false);
  const [lastCloudSyncTime, setLastCloudSyncTime] = useState<string | null>(null);
  const [cloudError, setCloudError] = useState<string | null>(null);
  const [desktopSession, setDesktopSession] = useState<DesktopSessionInfo | null>(null);
  const [desktopInitializing, setDesktopInitializing] = useState<boolean>(desktop);

  // Sync database to local storage as instant local cache (web edition only —
  // the desktop edition persists to SQLite in the main process).
  useEffect(() => {
    if (desktop) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    } catch (e) {
      console.error('Error saving db to local storage', e);
    }
  }, [db, desktop]);

  // Sync auth state (web edition only)
  useEffect(() => {
    if (desktop) {
      if (!currentUser) setAdminImpersonation(null);
      return;
    }
    if (currentUser) {
      localStorage.setItem(AUTH_KEY, JSON.stringify(currentUser));
    } else {
      localStorage.removeItem(AUTH_KEY);
      setAdminImpersonation(null);
    }
  }, [currentUser, desktop]);

  // Desktop: restore the secure session (auto login) + watch license events.
  const refreshDesktopSession = useCallback(async () => {
    const app = getSchoolApp();
    if (!app) return;
    try {
      const res = await app.auth.sessionStatus();
      if (res && res.session) {
        setDesktopSession(res.session);
        if (res.session.authenticated && res.session.user) {
          const u = res.session.user;
          setCurrentUser(prev => {
            // Teacher sessions carry their own local user record.
            if (prev && prev.id === u.id) return prev;
            return {
              id: u.id,
              name: u.name,
              email: u.email || '',
              role: (u.role as User['role']) || 'principal',
              status: 'active',
              createdAt: new Date().toISOString(),
              teacherCode: (u as any).teacherCode,
              assignedClassId: (u as any).assignedClassId,
              assignedClassName: (u as any).assignedClassName,
              subject: (u as any).subject,
              phone: (u as any).phone,
              photoUrl: (u as any).photoUrl,
            } as User;
          });
        } else if (!res.session.authenticated) {
          setCurrentUser(null);
        }
      }
    } catch (e) {
      console.error('Failed to query desktop session', e);
    } finally {
      setDesktopInitializing(false);
    }
  }, []);

  // One-time upgrade path: if this computer has a legacy browser export in
  // localStorage and the local SQLite database is empty, import it once.
  useEffect(() => {
    if (!desktop || !currentUser) return;
    const app = getSchoolApp();
    if (!app) return;
    try {
      const legacy = localStorage.getItem(STORAGE_KEY);
      if (legacy) {
        app.database
          .importLegacy({ legacyDatabase: JSON.parse(legacy) })
          .then(res => {
            if (res && res.imported) localStorage.removeItem(STORAGE_KEY);
          })
          .catch(() => {});
      }
    } catch {
      /* ignore malformed legacy data */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desktop, currentUser?.id]);

  useEffect(() => {
    if (!desktop) return;
    refreshDesktopSession();

    const app = getSchoolApp();
    if (!app) return;
    // License state changes pushed from the main process (periodic
    // revalidation, suspension, revocation) and session restoration.
    const offLicense = app.auth.onLicenseChanged(() => {
      refreshDesktopSession();
    });
    const offRestored = app.auth.onSessionRestored(() => {
      refreshDesktopSession();
    });
    return () => {
      offLicense();
      offRestored();
    };
  }, [desktop, refreshDesktopSession]);

  // Initialize the data subscription.
  // Web: runs immediately (Firestore). Desktop: only once a licensed session
  // exists — the SQLite database belongs to the signed-in school.
  const desktopSessionReady = desktop ? !!currentUser : true;

  useEffect(() => {
    if (desktop && !desktopSessionReady) return;
    let unsubscribe: (() => void) | null = null;

    const setupFirestoreRealtime = async () => {
      try {
        setIsCloudSyncing(true);
        // Seed default template if firestore is completely empty
        await seedInitialDatabaseIfNeeded();

        // Subscribe to data updates (Firestore on web, local SQLite on desktop)
        unsubscribe = subscribeToSchoolDatabase(
          updatedData => {
            setDb(prev => {
              const merged: SchoolDatabase = {
                ...prev,
                ...updatedData,
              };
              return merged;
            });

            setIsCloudConnected(true);
            setIsCloudSyncing(false);
            setCloudError(null);
            setLastCloudSyncTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
          },
          err => {
            console.error('Firestore real-time subscription error:', err);
            setCloudError(err.message);
            setIsCloudSyncing(false);
          }
        );
      } catch (err: any) {
        console.error('Failed to initialize Firestore real-time sync:', err);
        setCloudError(err?.message || 'Database connection error');
        setIsCloudSyncing(false);
      }
    };

    setupFirestoreRealtime();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [desktop, desktopSessionReady]);

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
    saveActivityLogToFirestore(newLog).catch(e => console.error('Error logging to Firestore:', e));
  }, [currentUser, adminImpersonation]);

  // Authentication methods
  //
  // Desktop edition: credentials are verified by the central license server
  // over HTTPS — nothing is checked locally and no credentials are bundled.
  // Web edition: legacy behavior against the users list (development/demo).
  const loginPrincipal = async (email: string, password: string) => {
    const inputEmail = email.trim().toLowerCase();
    const inputPass = password.trim();

    if (desktop) {
      const app = getSchoolApp();
      if (!app) return { success: false, error: 'Desktop services unavailable. Restart the application.' };
      try {
        const result = await app.auth.login({ identifier: inputEmail, password: inputPass });
        if (result.error || !result.ok) {
          return { success: false, error: result.message || 'Sign-in failed.' };
        }
        if (result.session) setDesktopSession(result.session);
        if (result.session && result.session.user) {
          const u = result.session.user;
          setCurrentUser({
            id: u.id,
            name: u.name,
            email: u.email || '',
            role: 'principal',
            phone: '',
            status: 'active',
            createdAt: new Date().toISOString(),
          } as User);
        }
        setAdminImpersonation(null);
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err.message || 'Sign-in failed.' };
      }
    }

    // Web/development fallback (no hard-coded credentials).
    if (!import.meta.env.DEV) {
      return {
        success: false,
        error:
          'School Management System sign-in is provided through the installed desktop application. Please contact your software administrator.',
      };
    }

    const user = db.users.find(
      u => u.role === 'principal' && u.email.toLowerCase() === inputEmail
    );
    if (!user) {
      return { success: false, error: 'No Principal account found with this email address.' };
    }
    if (!user.password || user.password !== inputPass) {
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

    const updatedSchoolInfo: SchoolInfo = {
      ...db.schoolInfo,
      name: data.schoolName.trim() || 'M.S. PUBLIC SCHOOL',
      email: data.email.trim().toLowerCase(),
      phone: data.phone || db.schoolInfo.phone,
      setupCompleted: true,
    };

    setDb(prev => ({
      ...prev,
      schoolInfo: updatedSchoolInfo,
      users: [
        ...prev.users.filter(u => u.role !== 'principal'),
        newPrincipal,
      ],
    }));

    setCurrentUser(newPrincipal);
    saveSchoolInfoToFirestore(updatedSchoolInfo).catch(e => console.error(e));
    saveUserToFirestore(newPrincipal).catch(e => console.error(e));
    logActivity('SCHOOL_SETUP', `School configured and Principal account created for ${data.principalName}`);
    return { success: true };
  };

  const loginTeacher = async (code: string) => {
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) {
      return { success: false, error: 'Please enter your unique Teacher Code.' };
    }

    if (desktop) {
      // Teacher sign-in is local (offline-first) but only possible on a
      // computer that already has an active, licensed school session.
      const app = getSchoolApp();
      if (!app) return { success: false, error: 'Desktop services unavailable.' };
      try {
        const result = await app.auth.loginTeacherLocal(cleanCode);
        if (result.error || !result.ok) {
          return { success: false, error: result.message || 'Invalid Teacher Code.' };
        }
        if (result.session) setDesktopSession(result.session);
        const localTeacher = db.users.find(
          u => u.role === 'teacher' && u.teacherCode?.toUpperCase() === cleanCode
        );
        if (localTeacher) setCurrentUser(localTeacher);
        setAdminImpersonation(null);
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err.message || 'Teacher sign-in failed.' };
      }
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
    if (desktop) {
      const app = getSchoolApp();
      if (app) {
        app.auth.logout().then(() => refreshDesktopSession()).catch(() => refreshDesktopSession());
      }
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
          const updatedCls = { ...c, classTeacherId: newTeacher.id, classTeacherName: newTeacher.name };
          saveClassToFirestore(updatedCls).catch(e => console.error(e));
          return updatedCls;
        }
        return c;
      });

      return {
        ...prev,
        users: [...prev.users, newTeacher],
        classes: updatedClasses,
      };
    });

    saveUserToFirestore(newTeacher).catch(e => console.error(e));
    logActivity('TEACHER_ADDED', `Added new teacher: ${newTeacher.name} (Code: ${newTeacher.teacherCode})`, 'teacher', newTeacher.id);
    return { success: true, teacher: newTeacher };
  };

  const updateTeacher = (id: string, data: Partial<User>) => {
    setDb(prev => {
      const teacher = prev.users.find(u => u.id === id);
      if (!teacher) return prev;

      const updatedTeacher = { ...teacher, ...data };
      const updatedUsers = prev.users.map(u => (u.id === id ? updatedTeacher : u));
      let updatedClasses = prev.classes;

      if (data.assignedClassId && data.assignedClassId !== teacher.assignedClassId) {
        updatedClasses = prev.classes.map(c => {
          if (c.id === data.assignedClassId) {
            const upCls = { ...c, classTeacherId: id, classTeacherName: data.name || teacher.name };
            saveClassToFirestore(upCls).catch(e => console.error(e));
            return upCls;
          }
          if (c.id === teacher.assignedClassId) {
            const upCls = { ...c, classTeacherId: undefined, classTeacherName: undefined };
            saveClassToFirestore(upCls).catch(e => console.error(e));
            return upCls;
          }
          return c;
        });
      }

      saveUserToFirestore(updatedTeacher).catch(e => console.error(e));
      return {
        ...prev,
        users: updatedUsers,
        classes: updatedClasses,
      };
    });
    logActivity('TEACHER_UPDATED', `Updated teacher details for ID ${id}`, 'teacher', id);
  };

  const archiveTeacher = (id: string) => {
    setDb(prev => {
      const teacher = prev.users.find(u => u.id === id);
      if (teacher) {
        saveUserToFirestore({ ...teacher, status: 'archived' }).catch(e => console.error(e));
      }
      return {
        ...prev,
        users: prev.users.map(u => (u.id === id ? { ...u, status: 'archived' } : u)),
      };
    });
    logActivity('TEACHER_ARCHIVED', `Archived teacher account for ID ${id}`, 'teacher', id);
  };

  const restoreTeacher = (id: string) => {
    setDb(prev => {
      const teacher = prev.users.find(u => u.id === id);
      if (teacher) {
        saveUserToFirestore({ ...teacher, status: 'active' }).catch(e => console.error(e));
      }
      return {
        ...prev,
        users: prev.users.map(u => (u.id === id ? { ...u, status: 'active' } : u)),
      };
    });
    logActivity('TEACHER_RESTORED', `Restored teacher account for ID ${id}`, 'teacher', id);
  };

  const regenerateTeacherCode = (id: string): string => {
    const newCode = generateTeacherCode();
    setDb(prev => {
      const teacher = prev.users.find(u => u.id === id);
      if (teacher) {
        saveUserToFirestore({ ...teacher, teacherCode: newCode }).catch(e => console.error(e));
      }
      return {
        ...prev,
        users: prev.users.map(u => (u.id === id ? { ...u, teacherCode: newCode } : u)),
      };
    });
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
    saveClassToFirestore(newClass).catch(e => console.error(e));
    logActivity('CLASS_CREATED', `Created new class: ${newClass.name} - Section ${newClass.section}`, 'class', newClass.id);
  };

  const updateClass = (id: string, data: Partial<ClassRoom>) => {
    setDb(prev => {
      const cls = prev.classes.find(c => c.id === id);
      if (cls) {
        const updatedCls = { ...cls, ...data };
        saveClassToFirestore(updatedCls).catch(e => console.error(e));
      }
      return {
        ...prev,
        classes: prev.classes.map(c => (c.id === id ? { ...c, ...data } : c)),
      };
    });
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

    // Create default fee account
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
          const upCls = { ...c, totalStudents: (c.totalStudents || 0) + 1 };
          saveClassToFirestore(upCls).catch(e => console.error(e));
          return upCls;
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

    saveStudentToFirestore(newStudent).catch(e => console.error(e));
    saveFeeAccountToFirestore(newFeeAccount).catch(e => console.error(e));
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
          const updatedFA = {
            ...fa,
            studentName: updatedStudent.name,
            rollNumber: updatedStudent.rollNumber,
            classId: updatedStudent.classId,
            className: updatedStudent.className,
          };
          saveFeeAccountToFirestore(updatedFA).catch(e => console.error(e));
          return updatedFA;
        }
        return fa;
      });

      saveStudentToFirestore(updatedStudent).catch(e => console.error(e));
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
      if (student) {
        saveStudentToFirestore({ ...student, status: 'archived' }).catch(e => console.error(e));
      }
      const updatedClasses = prev.classes.map(c => {
        if (student && c.id === student.classId && (c.totalStudents || 0) > 0) {
          const upCls = { ...c, totalStudents: (c.totalStudents || 1) - 1 };
          saveClassToFirestore(upCls).catch(e => console.error(e));
          return upCls;
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
      if (student) {
        saveStudentToFirestore({ ...student, status: 'active' }).catch(e => console.error(e));
      }
      const updatedClasses = prev.classes.map(c => {
        if (student && c.id === student.classId) {
          const upCls = { ...c, totalStudents: (c.totalStudents || 0) + 1 };
          saveClassToFirestore(upCls).catch(e => console.error(e));
          return upCls;
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
      const filtered = prev.attendance.filter(
        a => !(a.classId === classId && a.date === date)
      );
      return {
        ...prev,
        attendance: [...filtered, ...newRecords],
      };
    });

    saveAttendanceBatchToFirestore(newRecords).catch(e => console.error('Error saving attendance batch:', e));

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

    saveTeacherAttendanceToFirestore(record).catch(e => console.error(e));
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

    saveFeeTransactionToFirestore(transaction, updatedFeeAccount).catch(e => console.error('Error saving fee tx:', e));

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

      const updatedFA = { ...feeAccount, totalFee: newTotal, dueAmount: newDue, status: newStatus };
      saveFeeAccountToFirestore(updatedFA).catch(e => console.error(e));

      return {
        ...prev,
        feeAccounts: prev.feeAccounts.map(fa =>
          fa.studentId === studentId ? updatedFA : fa
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
    saveExamToFirestore(newExam).catch(e => console.error(e));
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
      const filtered = prev.results.filter(
        r => !(r.studentId === data.studentId && r.examName === data.examName)
      );
      return {
        ...prev,
        results: [newResult, ...filtered],
      };
    });

    saveResultToFirestore(newResult).catch(e => console.error(e));
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

    savePerformanceToFirestore(newRecord).catch(e => console.error(e));
    logActivity('PERFORMANCE_NOTE_ADDED', `Added ${data.category} performance feedback for ${data.studentName} (Rating: ${data.rating})`, 'student', data.studentId);
  };

  // Promotion
  const promoteStudents = (fromClassId: string, toClassId: string, studentIds: string[]) => {
    const toClass = db.classes.find(c => c.id === toClassId);
    if (!toClass) return;

    setDb(prev => {
      const updatedStudents = prev.students.map(s => {
        if (studentIds.includes(s.id)) {
          const updated = {
            ...s,
            classId: toClassId,
            className: toClass.name,
            updatedAt: new Date().toISOString(),
          };
          saveStudentToFirestore(updated).catch(e => console.error(e));
          return updated;
        }
        return s;
      });

      const updatedFeeAccounts = prev.feeAccounts.map(fa => {
        if (studentIds.includes(fa.studentId)) {
          const updatedFA = {
            ...fa,
            classId: toClassId,
            className: toClass.name,
          };
          saveFeeAccountToFirestore(updatedFA).catch(e => console.error(e));
          return updatedFA;
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

    const updatedSchoolInfo: SchoolInfo = {
      ...db.schoolInfo,
      currentAcademicYear: yearObj.name,
    };

    setDb(prev => ({
      ...prev,
      schoolInfo: updatedSchoolInfo,
      academicYears: prev.academicYears.map(y => {
        const up = { ...y, isCurrent: y.id === yearId };
        saveAcademicYearToFirestore(up).catch(e => console.error(e));
        return up;
      }),
    }));

    saveSchoolInfoToFirestore(updatedSchoolInfo).catch(e => console.error(e));
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
    saveAcademicYearToFirestore(newYear).catch(e => console.error(e));
    logActivity('ACADEMIC_YEAR_ADDED', `Added new academic year: ${newYear.name}`, 'academic_year', newYear.id);
  };

  // Results & Performance deletion/helpers
  const deleteResult = (id: string) => {
    setDb(prev => ({
      ...prev,
      results: prev.results.filter(r => r.id !== id),
    }));
    deleteResultFromFirestore(id).catch(e => console.error(e));
    logActivity('RESULT_DELETED', `Deleted examination result`, 'result', id);
  };

  const deletePerformance = (id: string) => {
    setDb(prev => ({
      ...prev,
      performance: prev.performance.filter(p => p.id !== id),
    }));
    deletePerformanceFromFirestore(id).catch(e => console.error(e));
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
    deleteStudentFromFirestore(id).catch(e => console.error(e));
    logActivity('STUDENT_DELETED', `Permanently removed student records`, 'student', id);
  };

  const deleteTeacher = (id: string) => {
    setDb(prev => ({
      ...prev,
      users: prev.users.filter(u => u.id !== id),
      teacherAttendance: prev.teacherAttendance.filter(ta => ta.teacherId !== id),
    }));
    deleteUserFromFirestore(id).catch(e => console.error(e));
    logActivity('TEACHER_DELETED', `Permanently removed teacher`, 'teacher', id);
  };

  const deleteClass = (id: string) => {
    setDb(prev => ({
      ...prev,
      classes: prev.classes.filter(c => c.id !== id),
    }));
    deleteClassFromFirestore(id).catch(e => console.error(e));
    logActivity('CLASS_DELETED', `Deleted class`, 'class', id);
  };

  // Settings & Notifications
  const updateSchoolInfo = (data: Partial<SchoolInfo>) => {
    const updated: SchoolInfo = {
      ...db.schoolInfo,
      ...data,
    };
    setDb(prev => ({
      ...prev,
      schoolInfo: updated,
    }));
    saveSchoolInfoToFirestore(updated).catch(err => console.error('Failed to sync settings to Firestore', err));
    logActivity('SCHOOL_SETTINGS_UPDATED', `Updated school institutional details`);
  };

  const updateSchoolSettings = updateSchoolInfo;
  const addResult = saveStudentResult;
  const addPerformance = addPerformanceRecord;

  const markNotificationAsRead = (id: string) => {
    setDb(prev => {
      const updated = prev.notifications.map(n => (n.id === id ? { ...n, isRead: true } : n));
      const target = updated.find(n => n.id === id);
      if (target) {
        saveNotificationToFirestore(target).catch(e => console.error(e));
      }
      return {
        ...prev,
        notifications: updated,
      };
    });
  };

  const markAllNotificationsAsRead = () => {
    setDb(prev => {
      const updated = prev.notifications.map(n => ({ ...n, isRead: true }));
      updated.forEach(n => saveNotificationToFirestore(n).catch(e => console.error(e)));
      return {
        ...prev,
        notifications: updated,
      };
    });
  };

  const resetDatabaseToDemo = () => {
    if (desktop) {
      // Demo reset is intentionally unavailable in the commercial desktop
      // edition — it must never wipe a real school's live data.
      console.warn('Demo reset is disabled in the desktop edition.');
      return;
    }
    setDb(INITIAL_SCHOOL_DATABASE);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_SCHOOL_DATABASE));
    seedInitialDatabaseIfNeeded();
    logActivity('DEMO_RESET', 'Reset school database to initial default demo data');
  };

  const importFullDatabase = (importedDb: SchoolDatabase): { success: boolean; error?: string } => {
    try {
      if (!importedDb || typeof importedDb !== 'object') {
        return { success: false, error: 'Invalid database format' };
      }
      if (!importedDb.schoolInfo || !Array.isArray(importedDb.students) || !Array.isArray(importedDb.classes)) {
        return { success: false, error: 'Missing required school data fields (schoolInfo, students, classes)' };
      }

      if (desktop) {
        const app = getSchoolApp();
        if (app) {
          // Main process takes a safety backup before replacing.
          app.database
            .replaceAll(importedDb)
            .then(res => {
              if (res && res.error) {
                console.error('Desktop import failed:', res.message);
                return;
              }
              setDb(importedDb);
            })
            .catch(e => console.error('Desktop import failed:', e));
        }
        logActivity('DATABASE_RESTORE', 'Restored complete school database from client backup file');
        return { success: true };
      }

      setDb(importedDb);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(importedDb));

      // Sync imported objects to firestore
      if (importedDb.schoolInfo) saveSchoolInfoToFirestore(importedDb.schoolInfo).catch(e => console.error(e));
      importedDb.classes?.forEach(c => saveClassToFirestore(c).catch(e => console.error(e)));
      importedDb.students?.forEach(s => saveStudentToFirestore(s).catch(e => console.error(e)));
      importedDb.feeAccounts?.forEach(f => saveFeeAccountToFirestore(f).catch(e => console.error(e)));

      logActivity('DATABASE_RESTORE', 'Restored complete school database from client backup file');
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to import database' };
    }
  };

  const unreadNotificationCount = db.notifications.filter(n => !n.isRead).length;

  return (
    <SchoolContext.Provider
      value={{
        db,
        currentUser,
        adminImpersonation,
        unreadNotificationCount,
        isCloudConnected,
        isCloudSyncing,
        lastCloudSyncTime,
        cloudError,
        isDesktop: desktop,
        desktopSession,
        desktopInitializing,
        refreshDesktopSession,
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
        importFullDatabase,
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
