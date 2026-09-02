'use strict';

/**
 * Desktop data-layer tests (run in plain Node — no Electron required).
 * Covers: migrations, repository round-trip, cascading deletes, backup +
 * restore, legacy import, offline-grace decisions, file-path security.
 *
 * Run: node desktop/test/desktop.test.js
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sms-desktop-test-'));
process.env.SMS_DATA_DIR_OVERRIDE = tmpRoot;

const paths = require('../lib/paths');
const logger = require('../lib/logger');
logger.init({ dir: paths.logsDir(), isDev: false });

const dbModule = require('../lib/db');
const migrations = require('../lib/migrations');
const repository = require('../lib/repository');
const backup = require('../lib/backup');
const files = require('../lib/files');
const { offlineAccessDecision } = require('../lib/licenseClient');

let passed = 0;
function ok(name) {
  passed += 1;
  console.log(`  ✓ ${name}`);
}

function sampleDatabase() {
  return {
    schoolInfo: {
      id: 'school_1',
      name: 'Test School',
      tagline: '',
      address: 'Test Street',
      phone: '+91 00000 00000',
      email: 'school@test.local',
      currentAcademicYear: '2026-2027',
      setupCompleted: true,
    },
    users: [
      { id: 'usr_admin', name: 'Admin', email: 'admin@test.local', role: 'principal', status: 'active', createdAt: '2026-01-01T00:00:00Z' },
      { id: 'usr_t1', name: 'Teacher One', email: 't1@test.local', role: 'teacher', teacherCode: '501001', assignedClassId: 'cls_01', status: 'active', createdAt: '2026-01-01T00:00:00Z' },
    ],
    classes: [{ id: 'cls_01', name: 'Class 1', section: 'A', capacity: 40, totalStudents: 2 }],
    students: [
      { id: 'std_1', name: 'Aarav', rollNumber: '01', classId: 'cls_01', className: 'Class 1', admissionNumber: 'TS-2026-001', admissionDate: '2026-04-01', status: 'active', academicYear: '2026-2027', parentName: 'P1', createdAt: '2026-04-01T00:00:00Z' },
      { id: 'std_2', name: 'Diya', rollNumber: '02', classId: 'cls_01', className: 'Class 1', admissionNumber: 'TS-2026-002', admissionDate: '2026-04-01', status: 'active', academicYear: '2026-2027', parentName: 'P2', createdAt: '2026-04-01T00:00:00Z' },
    ],
    attendance: [
      { id: 'att_cls_01_std_1_2026-09-01', date: '2026-09-01', classId: 'cls_01', className: 'Class 1', studentId: 'std_1', studentName: 'Aarav', rollNumber: '01', status: 'present', markedByUserId: 'usr_admin', markedByUserName: 'Admin', markedByRole: 'principal', timestamp: '2026-09-01T09:00:00Z' },
      { id: 'att_cls_01_std_2_2026-09-01', date: '2026-09-01', classId: 'cls_01', className: 'Class 1', studentId: 'std_2', studentName: 'Diya', rollNumber: '02', status: 'absent', markedByUserId: 'usr_admin', markedByUserName: 'Admin', markedByRole: 'principal', timestamp: '2026-09-01T09:00:00Z' },
    ],
    teacherAttendance: [{ id: 't_att_usr_t1_2026-09-01', date: '2026-09-01', teacherId: 'usr_t1', teacherName: 'Teacher One', teacherCode: '501001', status: 'present', markedAt: '2026-09-01T09:00:00Z' }],
    feeAccounts: [
      { id: 'fee_std_1', studentId: 'std_1', studentName: 'Aarav', rollNumber: '01', classId: 'cls_01', className: 'Class 1', totalFee: 24000, paidAmount: 5000, dueAmount: 19000, status: 'partial' },
    ],
    feeTransactions: [
      { id: 'txn_1', feeAccountId: 'fee_std_1', studentId: 'std_1', studentName: 'Aarav', classId: 'cls_01', className: 'Class 1', amount: 5000, paymentDate: '2026-08-15', paymentMethod: 'Cash', receiptNumber: 'TS/REC/26/0001', recordedByName: 'Admin', recordedByUserId: 'usr_admin', timestamp: '2026-08-15T10:00:00Z' },
    ],
    exams: [{ id: 'exam_1', name: 'Unit Test 1', academicYear: '2026-2027', classId: 'cls_01', className: 'Class 1' }],
    results: [
      { id: 'res_1', examId: 'exam_1', examName: 'Unit Test 1', studentId: 'std_1', studentName: 'Aarav', rollNumber: '01', classId: 'cls_01', className: 'Class 1', academicYear: '2026-2027', subjects: [{ subject: 'Math', maxMarks: 50, obtainedMarks: 45, grade: 'A1' }], totalMarks: 45, totalMaxMarks: 50, percentage: 90, grade: 'A1' },
    ],
    performance: [{ id: 'perf_1', studentId: 'std_1', studentName: 'Aarav', classId: 'cls_01', date: '2026-09-01', category: 'academic', rating: 'excellent' }],
    academicYears: [{ id: 'ay_1', name: '2026-2027', isCurrent: true, startDate: '2026-04-01', endDate: '2027-03-31' }],
    activityLogs: [{ id: 'log_1', userId: 'usr_admin', userName: 'Admin', userRole: 'principal', action: 'TEST', details: 'test', timestamp: '2026-09-01T09:00:00Z' }],
    notifications: [{ id: 'ntf_1', title: 'Welcome', message: 'Setup complete', type: 'info', isRead: false, createdAt: '2026-09-01T09:00:00Z' }],
  };
}

async function main() {
  console.log('Desktop data-layer tests\n');

  // -- Migrations -------------------------------------------------------------
  const db = dbModule.openDatabase();
  const result = await migrations.runMigrations(db, {});
  assert.deepStrictEqual(result.applied, ['1_initial_schema']);
  const rerun = await migrations.runMigrations(db, {});
  assert.deepStrictEqual(rerun.applied, []);
  assert.strictEqual(migrations.schemaVersion(db), 1);
  ok('migrations apply once and are idempotent');

  // -- Full database round-trip -----------------------------------------------
  const sample = sampleDatabase();
  repository.replaceFullDatabase(sample);
  const loaded = repository.loadFullDatabase(null);
  assert.strictEqual(loaded.schoolInfo.name, 'Test School');
  assert.strictEqual(loaded.students.length, 2);
  assert.strictEqual(loaded.users.length, 2);
  assert.strictEqual(loaded.feeTransactions[0].amount, 5000);
  assert.strictEqual(loaded.results[0].subjects[0].obtainedMarks, 45);
  ok('full database round-trips through SQLite (all 14 collections)');

  // -- Upserts + where-based replacements --------------------------------------
  repository.upsertDoc('students', { ...sample.students[0], name: 'Aarav Kumar' });
  let check = repository.loadFullDatabase(null);
  assert.strictEqual(check.students.find((s) => s.id === 'std_1').name, 'Aarav Kumar');

  repository.replaceWhere('attendance', { classId: 'cls_01', date: '2026-09-01' }, [
    { ...sample.attendance[0], status: 'late' },
  ]);
  check = repository.loadFullDatabase(null);
  assert.strictEqual(check.attendance.length, 1);
  assert.strictEqual(check.attendance[0].status, 'late');
  ok('upsert + replaceWhere (attendance batch semantics) work');

  repository.upsertDoc('students', { id: 'std_3', name: 'Extra', rollNumber: '03', classId: 'cls_01', className: 'Class 1', status: 'active', createdAt: 'x' });
  repository.deleteWhere('students', { status: 'archived' }); // no-op
  repository.deleteDoc('students', 'std_3');
  check = repository.loadFullDatabase(null);
  assert.strictEqual(check.students.length, 2);
  ok('delete by id + deleteWhere work');

  // -- Cascading deletes --------------------------------------------------------
  repository.deleteStudentCascade('std_1');
  check = repository.loadFullDatabase(null);
  assert.strictEqual(check.students.find((s) => s.id === 'std_1'), undefined);
  assert.strictEqual(check.feeAccounts.length, 0);
  assert.strictEqual(check.feeTransactions.length, 0);
  assert.strictEqual(check.results.length, 0);
  assert.strictEqual(check.performance.length, 0);
  assert.strictEqual(check.attendance.length, 0);
  ok('student deletion cascades across fees, attendance, results, performance');

  repository.deleteTeacherCascade('usr_t1');
  check = repository.loadFullDatabase(null);
  assert.strictEqual(check.users.find((u) => u.id === 'usr_t1'), undefined);
  assert.strictEqual(check.teacherAttendance.length, 0);
  ok('teacher deletion cascades into staff attendance');

  // -- Backup + restore -----------------------------------------------------------
  repository.replaceFullDatabase(sampleDatabase()); // reset to full sample
  const b1 = await backup.createBackup({ reason: 'test' });
  assert.ok(fs.existsSync(b1.path));
  ok('backup file created');

  // Destroy data, then restore.
  repository.deleteStudentCascade('std_1');
  repository.deleteStudentCascade('std_2');
  let destroyed = repository.loadFullDatabase(null);
  assert.strictEqual(destroyed.students.length, 0);

  const restoreResult = await backup.restoreBackup(b1.file, { runMigrations: (d) => migrations.runMigrations(d, {}) });
  assert.strictEqual(restoreResult.ok, true);
  const restored = repository.loadFullDatabase(null);
  assert.strictEqual(restored.students.length, 2);
  assert.strictEqual(restored.feeTransactions.length, 1);
  ok('restore recovers deleted data (with pre-restore safety backup)');

  // Path traversal on restore is refused.
  let traversalBlocked = false;
  try {
    await backup.restoreBackup('..\\evil.sqlite', {});
  } catch {
    traversalBlocked = true;
  }
  assert.ok(traversalBlocked);
  ok('restore rejects path traversal');

  // Retention / listing sanity.
  const list = backup.listBackups();
  assert.ok(list.length >= 1);
  assert.ok(/^school-[\w.-]+\.sqlite$/.test(list[0].file));
  ok('backup listing works');

  // -- Legacy browser import ------------------------------------------------------
  dbModule.closeDatabase();
  fs.rmSync(paths.databaseFile(), { force: true });
  fs.rmSync(paths.databaseFile() + '-wal', { force: true });
  fs.rmSync(paths.databaseFile() + '-shm', { force: true });
  dbModule.openDatabase();
  await migrations.runMigrations(dbModule.getDb(), {});
  const imported = repository.migrateLegacyIfPresent(sampleDatabase());
  assert.strictEqual(imported, true);
  const secondImport = repository.migrateLegacyIfPresent(sampleDatabase());
  assert.strictEqual(secondImport, false); // never overwrite real data
  const legacyLoaded = repository.loadFullDatabase(null);
  assert.strictEqual(legacyLoaded.students.length, 2);
  ok('legacy localStorage database imports once into SQLite');

  // -- Offline grace decisions ------------------------------------------------------
  const now = new Date('2026-09-02T12:00:00Z').getTime();
  const freshCache = {
    school: { id: 'x' },
    license: { effectiveStatus: 'ACTIVE' },
    policy: { offlineGraceDays: 30 },
    lastVerifiedAt: '2026-09-01T12:00:00Z',
  };
  assert.strictEqual(offlineAccessDecision(freshCache, now).allowed, true);

  const staleCache = { ...freshCache, lastVerifiedAt: '2026-07-01T12:00:00Z' };
  assert.strictEqual(offlineAccessDecision(staleCache, now).allowed, false);
  assert.strictEqual(offlineAccessDecision(staleCache, now).reason, 'GRACE_EXCEEDED');

  const revokedCache = { ...freshCache, license: { effectiveStatus: 'REVOKED' } };
  assert.strictEqual(offlineAccessDecision(revokedCache, now).allowed, false);

  const longExpired = {
    ...freshCache,
    license: { effectiveStatus: 'EXPIRED', expiresAt: '2026-05-01T00:00:00Z' },
    lastVerifiedAt: '2026-09-01T12:00:00Z',
  };
  assert.strictEqual(offlineAccessDecision(longExpired, now).allowed, false);

  const recentlyExpired = {
    ...freshCache,
    license: { effectiveStatus: 'EXPIRED', expiresAt: '2026-08-30T00:00:00Z' },
    lastVerifiedAt: '2026-09-01T12:00:00Z',
  };
  assert.strictEqual(offlineAccessDecision(recentlyExpired, now).allowed, true);
  ok('offline grace policy: fresh OK, stale blocked, revoked blocked, expiry bounded');

  // -- File security ---------------------------------------------------------------
  assert.strictEqual(files.sanitizeFileName('photo.jpg'), 'photo.jpg');
  assert.strictEqual(files.sanitizeFileName('../../etc/passwd'), 'passwd');
  assert.strictEqual(files.sanitizeFileName('a\\b\\c.png'), 'a_b_c.png');
  const traversed = files.sanitizeFileName('..\\..\\x.png');
  assert.ok(!traversed.includes('/') && !traversed.includes('\\') && !traversed.startsWith('.'));
  let badNameBlocked = false;
  try {
    files.sanitizeFileName('....');
  } catch {
    badNameBlocked = true;
  }
  assert.ok(badNameBlocked);
  ok('filename sanitization strips traversal');

  const saved = files.saveUpload({
    category: 'students',
    fileName: '../../evil.txt',
    dataBase64: Buffer.from('hello').toString('base64'),
  });
  const absPath = files.uploadAbsolutePath('students', saved.fileName);
  assert.ok(absPath.startsWith(paths.uploadsDir()));
  let badCategory = false;
  try {
    files.saveUpload({ category: '..', fileName: 'x.txt', dataBase64: '' });
  } catch {
    badCategory = true;
  }
  assert.ok(badCategory);
  ok('uploads are confined to the uploads directory');

  console.log(`\n✅ ALL ${passed} DESKTOP DATA-LAYER TESTS PASSED\n`);
  dbModule.closeDatabase();
  fs.rmSync(tmpRoot, { recursive: true, force: true });
  process.exit(0);
}

main().catch((err) => {
  console.error('\n❌ TEST FAILURE:', err);
  try {
    dbModule.closeDatabase();
  } catch {
    /* ignore */
  }
  fs.rmSync(tmpRoot, { recursive: true, force: true });
  process.exit(1);
});
