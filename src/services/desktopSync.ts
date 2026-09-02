/**
 * Desktop data backend — mirrors the firestoreSync surface but persists to the
 * local SQLite database through the secure IPC bridge.
 *
 * Offline-first by design: once a school session is active every operation is
 * local; there is no network dependency for day-to-day school work.
 */

import { getSchoolApp } from './desktopBridge';
import type {
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

function api() {
  const app = getSchoolApp();
  if (!app) throw new Error('Desktop bridge unavailable');
  return app;
}

/** IPC results carry { error: true, message } on failure. */
function assertOk(result: any, operation: string) {
  if (result && result.error) {
    throw new Error(result.message || `Desktop operation failed (${operation})`);
  }
  return result;
}

// On desktop, initial seeding happens server-side at first login; nothing to do here.
export const seedInitialDatabaseIfNeeded = async (): Promise<void> => {
  return;
};

/**
 * Loads the whole local database once and hands it to the subscriber.
 * The returned unsubscribe keeps the same contract as the Firestore version.
 */
export const subscribeToSchoolDatabase = (
  onUpdate: (data: Partial<SchoolDatabase>) => void,
  onError?: (error: Error) => void
): (() => void) => {
  let cancelled = false;

  (async () => {
    try {
      const data = await api().database.load();
      assertOk(data, 'db:load');
      if (!cancelled && data && data.schoolInfo) {
        onUpdate(data as Partial<SchoolDatabase>);
      }
    } catch (err: any) {
      onError?.(err instanceof Error ? err : new Error(String(err)));
    }
  })();

  return () => {
    cancelled = true;
  };
};

// ================= Write-through mutators (local SQLite) =================

export const saveSchoolInfoToFirestore = async (schoolInfo: SchoolInfo) => {
  assertOk(await api().database.setSchoolInfo(schoolInfo), 'schoolInfo');
};

export const saveUserToFirestore = async (user: User) => {
  assertOk(await api().database.upsert('users', user), 'user');
};

export const deleteUserFromFirestore = async (userId: string) => {
  assertOk(await api().database.deleteTeacher(userId), 'deleteUser');
};

export const saveClassToFirestore = async (cls: ClassRoom) => {
  assertOk(await api().database.upsert('classes', cls), 'class');
};

export const deleteClassFromFirestore = async (classId: string) => {
  assertOk(await api().database.remove('classes', classId), 'deleteClass');
};

export const saveStudentToFirestore = async (student: Student) => {
  assertOk(await api().database.upsert('students', student), 'student');
};

export const deleteStudentFromFirestore = async (studentId: string) => {
  assertOk(await api().database.deleteStudent(studentId), 'deleteStudent');
};

export const saveAttendanceBatchToFirestore = async (records: AttendanceRecord[]) => {
  if (!records.length) return;
  const { classId, date } = records[0];
  assertOk(
    await api().database.replaceWhere('attendance', { classId, date }, records),
    'attendanceBatch'
  );
};

export const saveTeacherAttendanceToFirestore = async (record: TeacherAttendanceRecord) => {
  assertOk(await api().database.upsert('teacherAttendance', record), 'teacherAttendance');
};

export const saveFeeAccountToFirestore = async (feeAccount: FeeAccount) => {
  assertOk(await api().database.upsert('feeAccounts', feeAccount), 'feeAccount');
};

export const saveFeeTransactionToFirestore = async (
  transaction: FeeTransaction,
  updatedAccount: FeeAccount
) => {
  assertOk(await api().database.upsert('feeTransactions', transaction), 'feeTransaction');
  assertOk(await api().database.upsert('feeAccounts', updatedAccount), 'feeAccount');
};

export const saveExamToFirestore = async (exam: Exam) => {
  assertOk(await api().database.upsert('exams', exam), 'exam');
};

export const saveResultToFirestore = async (result: StudentResult) => {
  assertOk(await api().database.upsert('results', result), 'result');
};

export const deleteResultFromFirestore = async (resultId: string) => {
  assertOk(await api().database.remove('results', resultId), 'deleteResult');
};

export const savePerformanceToFirestore = async (performance: PerformanceRecord) => {
  assertOk(await api().database.upsert('performance', performance), 'performance');
};

export const deletePerformanceFromFirestore = async (performanceId: string) => {
  assertOk(await api().database.remove('performance', performanceId), 'deletePerformance');
};

export const saveAcademicYearToFirestore = async (ay: AcademicYear) => {
  assertOk(await api().database.upsert('academicYears', ay), 'academicYear');
};

export const saveActivityLogToFirestore = async (log: ActivityLog) => {
  assertOk(await api().database.upsert('activityLogs', log), 'activityLog');
};

export const saveNotificationToFirestore = async (notification: AppNotification) => {
  assertOk(await api().database.upsert('notifications', notification), 'notification');
};
