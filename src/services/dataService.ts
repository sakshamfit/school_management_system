/**
 * Data backend selector.
 *
 * Desktop edition (window.schoolApp present) → local SQLite via IPC.
 * Web edition (existing deployment)           → Firestore (unchanged).
 *
 * Everything else in the app imports from here, so the rest of the codebase
 * is storage-agnostic.
 */

import { isDesktopApp } from './desktopBridge';
import * as firestoreSync from './firestoreSync';
import * as desktopSync from './desktopSync';

const backend = isDesktopApp() ? desktopSync : firestoreSync;

export const seedInitialDatabaseIfNeeded = backend.seedInitialDatabaseIfNeeded;
export const subscribeToSchoolDatabase = backend.subscribeToSchoolDatabase;
export const saveSchoolInfoToFirestore = backend.saveSchoolInfoToFirestore;
export const saveUserToFirestore = backend.saveUserToFirestore;
export const deleteUserFromFirestore = backend.deleteUserFromFirestore;
export const saveClassToFirestore = backend.saveClassToFirestore;
export const deleteClassFromFirestore = backend.deleteClassFromFirestore;
export const saveStudentToFirestore = backend.saveStudentToFirestore;
export const deleteStudentFromFirestore = backend.deleteStudentFromFirestore;
export const saveAttendanceBatchToFirestore = backend.saveAttendanceBatchToFirestore;
export const saveTeacherAttendanceToFirestore = backend.saveTeacherAttendanceToFirestore;
export const saveFeeAccountToFirestore = backend.saveFeeAccountToFirestore;
export const saveFeeTransactionToFirestore = backend.saveFeeTransactionToFirestore;
export const saveExamToFirestore = backend.saveExamToFirestore;
export const saveResultToFirestore = backend.saveResultToFirestore;
export const deleteResultFromFirestore = backend.deleteResultFromFirestore;
export const savePerformanceToFirestore = backend.savePerformanceToFirestore;
export const deletePerformanceFromFirestore = backend.deletePerformanceFromFirestore;
export const saveAcademicYearToFirestore = backend.saveAcademicYearToFirestore;
export const saveActivityLogToFirestore = backend.saveActivityLogToFirestore;
export const saveNotificationToFirestore = backend.saveNotificationToFirestore;
