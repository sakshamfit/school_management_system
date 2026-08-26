import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  writeBatch,
  getDocs,
  getDoc,
} from 'firebase/firestore';
import { firestore } from '../lib/firebase';
import {
  SchoolDatabase,
  SchoolInfo,
  User,
  ClassRoom,
  Student,
  AttendanceRecord,
  TeacherAttendanceRecord,
  FeeAccount,
  FeeTransaction,
  Exam,
  StudentResult,
  PerformanceRecord,
  AcademicYear,
  ActivityLog,
  AppNotification,
} from '../types';
import { INITIAL_SCHOOL_DATABASE } from '../data/initialData';

// Firestore collection names
export const COLLECTIONS = {
  SCHOOL_DATA: 'school_data',
  USERS: 'users',
  CLASSES: 'classes',
  STUDENTS: 'students',
  ATTENDANCE: 'attendance',
  TEACHER_ATTENDANCE: 'teacher_attendance',
  FEE_ACCOUNTS: 'fee_accounts',
  FEE_TRANSACTIONS: 'fee_transactions',
  EXAMS: 'exams',
  RESULTS: 'results',
  PERFORMANCE: 'performance',
  ACADEMIC_YEARS: 'academic_years',
  ACTIVITY_LOGS: 'activity_logs',
  NOTIFICATIONS: 'notifications',
} as const;

// Ensure documents have no undefined values before saving to Firestore
export const sanitizeData = <T extends Record<string, any>>(data: T): T => {
  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        sanitized[key] = sanitizeData(value);
      } else if (Array.isArray(value)) {
        sanitized[key] = value.map(item =>
          item !== null && typeof item === 'object' ? sanitizeData(item) : item
        );
      } else {
        sanitized[key] = value;
      }
    }
  }
  return sanitized as T;
};

// Seed initial database into Firestore if empty
export const seedInitialDatabaseIfNeeded = async () => {
  try {
    const schoolDocRef = doc(firestore, COLLECTIONS.SCHOOL_DATA, 'main');
    const schoolDocSnap = await getDoc(schoolDocRef);

    if (!schoolDocSnap.exists()) {
      console.log('🌱 Seeding initial school database to Firestore...');
      const batch = writeBatch(firestore);

      // School Info
      batch.set(schoolDocRef, sanitizeData(INITIAL_SCHOOL_DATABASE.schoolInfo));

      // Users (Principal)
      INITIAL_SCHOOL_DATABASE.users.forEach(user => {
        const userRef = doc(firestore, COLLECTIONS.USERS, user.id);
        batch.set(userRef, sanitizeData(user));
      });

      // Classes
      INITIAL_SCHOOL_DATABASE.classes.forEach(cls => {
        const classRef = doc(firestore, COLLECTIONS.CLASSES, cls.id);
        batch.set(classRef, sanitizeData(cls));
      });

      // Academic Years
      INITIAL_SCHOOL_DATABASE.academicYears.forEach(ay => {
        const ayRef = doc(firestore, COLLECTIONS.ACADEMIC_YEARS, ay.id);
        batch.set(ayRef, sanitizeData(ay));
      });

      // Initial Exams
      INITIAL_SCHOOL_DATABASE.exams.forEach(exam => {
        const examRef = doc(firestore, COLLECTIONS.EXAMS, exam.id);
        batch.set(examRef, sanitizeData(exam));
      });

      await batch.commit();
      console.log('✅ Firestore initial seed completed successfully.');
    }
  } catch (error) {
    console.error('Error during Firestore database seeding:', error);
  }
};

// Real-time synchronization subscription helper
export const subscribeToSchoolDatabase = (
  onUpdate: (data: Partial<SchoolDatabase>) => void,
  onError?: (error: Error) => void
) => {
  const unsubscribers: (() => void)[] = [];

  try {
    // 1. School Info
    const schoolDocRef = doc(firestore, COLLECTIONS.SCHOOL_DATA, 'main');
    unsubscribers.push(
      onSnapshot(
        schoolDocRef,
        snap => {
          if (snap.exists()) {
            onUpdate({ schoolInfo: snap.data() as SchoolInfo });
          }
        },
        err => onError?.(err)
      )
    );

    // 2. Users
    unsubscribers.push(
      onSnapshot(
        collection(firestore, COLLECTIONS.USERS),
        snap => {
          const users = snap.docs.map(d => d.data() as User);
          onUpdate({ users });
        },
        err => onError?.(err)
      )
    );

    // 3. Classes
    unsubscribers.push(
      onSnapshot(
        collection(firestore, COLLECTIONS.CLASSES),
        snap => {
          const classes = snap.docs.map(d => d.data() as ClassRoom);
          onUpdate({ classes });
        },
        err => onError?.(err)
      )
    );

    // 4. Students
    unsubscribers.push(
      onSnapshot(
        collection(firestore, COLLECTIONS.STUDENTS),
        snap => {
          const students = snap.docs.map(d => d.data() as Student);
          onUpdate({ students });
        },
        err => onError?.(err)
      )
    );

    // 5. Attendance
    unsubscribers.push(
      onSnapshot(
        collection(firestore, COLLECTIONS.ATTENDANCE),
        snap => {
          const attendance = snap.docs.map(d => d.data() as AttendanceRecord);
          onUpdate({ attendance });
        },
        err => onError?.(err)
      )
    );

    // 6. Teacher Attendance
    unsubscribers.push(
      onSnapshot(
        collection(firestore, COLLECTIONS.TEACHER_ATTENDANCE),
        snap => {
          const teacherAttendance = snap.docs.map(d => d.data() as TeacherAttendanceRecord);
          onUpdate({ teacherAttendance });
        },
        err => onError?.(err)
      )
    );

    // 7. Fee Accounts
    unsubscribers.push(
      onSnapshot(
        collection(firestore, COLLECTIONS.FEE_ACCOUNTS),
        snap => {
          const feeAccounts = snap.docs.map(d => d.data() as FeeAccount);
          onUpdate({ feeAccounts });
        },
        err => onError?.(err)
      )
    );

    // 8. Fee Transactions
    unsubscribers.push(
      onSnapshot(
        collection(firestore, COLLECTIONS.FEE_TRANSACTIONS),
        snap => {
          const feeTransactions = snap.docs.map(d => d.data() as FeeTransaction);
          onUpdate({ feeTransactions });
        },
        err => onError?.(err)
      )
    );

    // 9. Exams
    unsubscribers.push(
      onSnapshot(
        collection(firestore, COLLECTIONS.EXAMS),
        snap => {
          const exams = snap.docs.map(d => d.data() as Exam);
          onUpdate({ exams });
        },
        err => onError?.(err)
      )
    );

    // 10. Results / Marksheets
    unsubscribers.push(
      onSnapshot(
        collection(firestore, COLLECTIONS.RESULTS),
        snap => {
          const results = snap.docs.map(d => d.data() as StudentResult);
          onUpdate({ results });
        },
        err => onError?.(err)
      )
    );

    // 11. Performance Records
    unsubscribers.push(
      onSnapshot(
        collection(firestore, COLLECTIONS.PERFORMANCE),
        snap => {
          const performance = snap.docs.map(d => d.data() as PerformanceRecord);
          onUpdate({ performance });
        },
        err => onError?.(err)
      )
    );

    // 12. Academic Years
    unsubscribers.push(
      onSnapshot(
        collection(firestore, COLLECTIONS.ACADEMIC_YEARS),
        snap => {
          const academicYears = snap.docs.map(d => d.data() as AcademicYear);
          onUpdate({ academicYears });
        },
        err => onError?.(err)
      )
    );

    // 13. Activity Logs
    unsubscribers.push(
      onSnapshot(
        collection(firestore, COLLECTIONS.ACTIVITY_LOGS),
        snap => {
          const activityLogs = snap.docs.map(d => d.data() as ActivityLog);
          onUpdate({ activityLogs });
        },
        err => onError?.(err)
      )
    );

    // 14. Notifications
    unsubscribers.push(
      onSnapshot(
        collection(firestore, COLLECTIONS.NOTIFICATIONS),
        snap => {
          const notifications = snap.docs.map(d => d.data() as AppNotification);
          onUpdate({ notifications });
        },
        err => onError?.(err)
      )
    );
  } catch (e: any) {
    onError?.(e);
  }

  return () => {
    unsubscribers.forEach(unsub => unsub());
  };
};

// ================= Single Document & Batch Mutators =================

// School Info
export const saveSchoolInfoToFirestore = async (schoolInfo: SchoolInfo) => {
  const ref = doc(firestore, COLLECTIONS.SCHOOL_DATA, 'main');
  await setDoc(ref, sanitizeData(schoolInfo), { merge: true });
};

// User / Teacher
export const saveUserToFirestore = async (user: User) => {
  const ref = doc(firestore, COLLECTIONS.USERS, user.id);
  await setDoc(ref, sanitizeData(user), { merge: true });
};

export const deleteUserFromFirestore = async (userId: string) => {
  const ref = doc(firestore, COLLECTIONS.USERS, userId);
  await deleteDoc(ref);
};

// Classes
export const saveClassToFirestore = async (cls: ClassRoom) => {
  const ref = doc(firestore, COLLECTIONS.CLASSES, cls.id);
  await setDoc(ref, sanitizeData(cls), { merge: true });
};

export const deleteClassFromFirestore = async (classId: string) => {
  const ref = doc(firestore, COLLECTIONS.CLASSES, classId);
  await deleteDoc(ref);
};

// Students
export const saveStudentToFirestore = async (student: Student) => {
  const ref = doc(firestore, COLLECTIONS.STUDENTS, student.id);
  await setDoc(ref, sanitizeData(student), { merge: true });
};

export const deleteStudentFromFirestore = async (studentId: string) => {
  const ref = doc(firestore, COLLECTIONS.STUDENTS, studentId);
  await deleteDoc(ref);
};

// Attendance Batch
export const saveAttendanceBatchToFirestore = async (records: AttendanceRecord[]) => {
  const batch = writeBatch(firestore);
  records.forEach(record => {
    const ref = doc(firestore, COLLECTIONS.ATTENDANCE, record.id);
    batch.set(ref, sanitizeData(record), { merge: true });
  });
  await batch.commit();
};

// Teacher Attendance
export const saveTeacherAttendanceToFirestore = async (record: TeacherAttendanceRecord) => {
  const ref = doc(firestore, COLLECTIONS.TEACHER_ATTENDANCE, record.id);
  await setDoc(ref, sanitizeData(record), { merge: true });
};

// Fee Account & Transaction
export const saveFeeAccountToFirestore = async (feeAccount: FeeAccount) => {
  const ref = doc(firestore, COLLECTIONS.FEE_ACCOUNTS, feeAccount.id);
  await setDoc(ref, sanitizeData(feeAccount), { merge: true });
};

export const saveFeeTransactionToFirestore = async (
  transaction: FeeTransaction,
  updatedAccount: FeeAccount
) => {
  const batch = writeBatch(firestore);
  const txRef = doc(firestore, COLLECTIONS.FEE_TRANSACTIONS, transaction.id);
  batch.set(txRef, sanitizeData(transaction));

  const accRef = doc(firestore, COLLECTIONS.FEE_ACCOUNTS, updatedAccount.id);
  batch.set(accRef, sanitizeData(updatedAccount), { merge: true });

  await batch.commit();
};

// Exam
export const saveExamToFirestore = async (exam: Exam) => {
  const ref = doc(firestore, COLLECTIONS.EXAMS, exam.id);
  await setDoc(ref, sanitizeData(exam), { merge: true });
};

// Student Result / Marksheet
export const saveResultToFirestore = async (result: StudentResult) => {
  const ref = doc(firestore, COLLECTIONS.RESULTS, result.id);
  await setDoc(ref, sanitizeData(result), { merge: true });
};

export const deleteResultFromFirestore = async (resultId: string) => {
  const ref = doc(firestore, COLLECTIONS.RESULTS, resultId);
  await deleteDoc(ref);
};

// Performance
export const savePerformanceToFirestore = async (performance: PerformanceRecord) => {
  const ref = doc(firestore, COLLECTIONS.PERFORMANCE, performance.id);
  await setDoc(ref, sanitizeData(performance), { merge: true });
};

export const deletePerformanceFromFirestore = async (performanceId: string) => {
  const ref = doc(firestore, COLLECTIONS.PERFORMANCE, performanceId);
  await deleteDoc(ref);
};

// Academic Year
export const saveAcademicYearToFirestore = async (ay: AcademicYear) => {
  const ref = doc(firestore, COLLECTIONS.ACADEMIC_YEARS, ay.id);
  await setDoc(ref, sanitizeData(ay), { merge: true });
};

// Activity Log
export const saveActivityLogToFirestore = async (log: ActivityLog) => {
  const ref = doc(firestore, COLLECTIONS.ACTIVITY_LOGS, log.id);
  await setDoc(ref, sanitizeData(log));
};

// Notifications
export const saveNotificationToFirestore = async (notification: AppNotification) => {
  const ref = doc(firestore, COLLECTIONS.NOTIFICATIONS, notification.id);
  await setDoc(ref, sanitizeData(notification), { merge: true });
};
