'use strict';

/**
 * School data repository — SQLite storage for the SchoolDatabase model.
 *
 * Each renderer collection maps to a table with a few indexed columns plus a
 * JSON `data` column holding the full document. This keeps the renderer's
 * existing data model 100% compatible while enabling indexed queries.
 *
 * All writes happen in transactions; the single connection lives in the main
 * process (renderer access is IPC-only).
 */

const { getDb } = require('./db');
const logger = require('./logger');

const COLLECTIONS = {
  users: 'users',
  classes: 'classes',
  students: 'students',
  attendance: 'attendance',
  teacherAttendance: 'teacher_attendance',
  feeAccounts: 'fee_accounts',
  feeTransactions: 'fee_transactions',
  exams: 'exams',
  results: 'results',
  performance: 'performance',
  academicYears: 'academic_years',
  activityLogs: 'activity_logs',
  notifications: 'notifications',
};

// JS field name → SQL column for WHERE clauses coming from the renderer.
const FIELD_COLUMNS = {
  studentId: 'student_id',
  classId: 'class_id',
  date: 'date',
  teacherId: 'teacher_id',
  examName: 'exam_name',
  status: 'status',
};

function tableFor(collection) {
  const table = COLLECTIONS[collection];
  if (!table) throw new Error(`Unknown collection: ${collection}`);
  return table;
}

function columnsFor(table, doc) {
  switch (table) {
    case 'users':
      return { role: doc.role || null, email: doc.email || null, status: doc.status || null };
    case 'classes':
      return { name: doc.name || null };
    case 'students':
      return { class_id: doc.classId || null, status: doc.status || null, name: doc.name || null };
    case 'attendance':
      return { class_id: doc.classId || null, date: doc.date || null, student_id: doc.studentId || null };
    case 'teacher_attendance':
      return { teacher_id: doc.teacherId || null, date: doc.date || null };
    case 'fee_accounts':
      return { student_id: doc.studentId || null, status: doc.status || null };
    case 'fee_transactions':
      return { student_id: doc.studentId || null, payment_date: doc.paymentDate || null };
    case 'results':
      return { student_id: doc.studentId || null, exam_name: doc.examName || null };
    case 'performance':
      return { student_id: doc.studentId || null };
    case 'activity_logs':
      return { timestamp: doc.timestamp || null };
    default:
      return {};
  }
}

function upsertStmt(table) {
  const cols = columnsFor(table, {});
  const colNames = Object.keys(cols);
  const allCols = ['id', ...colNames, 'data'];
  const placeholders = allCols.map(() => '?').join(', ');
  const updates = [...colNames.map((c) => `${c} = excluded.${c}`), 'data = excluded.data'].join(', ');
  return getDb().prepare(
    `INSERT INTO ${table} (${allCols.join(', ')}) VALUES (${placeholders})
     ON CONFLICT(id) DO UPDATE SET ${updates}`
  );
}

const stmtCache = new Map();
function stmt(table) {
  const current = getDb();
  const cached = stmtCache.get(table);
  // Statements are bound to a specific connection; re-prepare after
  // close/reopen (e.g. after a restore).
  if (cached && cached.db === current) return cached;
  const prepared = upsertStmt(table);
  stmtCache.set(table, prepared);
  return prepared;
}

function serializeDoc(table, doc) {
  const cols = columnsFor(table, doc);
  return ['id' in doc ? String(doc.id) : null, ...Object.keys(cols).map((k) => cols[k]), JSON.stringify(doc)];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

function setSchoolInfo(info) {
  getDb()
    .prepare('INSERT INTO school_info (id, data) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data')
    .run(JSON.stringify(info));
}

function upsertDoc(collection, doc) {
  if (!doc || typeof doc.id !== 'string') throw new Error('Document must include a string id');
  const table = tableFor(collection);
  stmt(table).run(...serializeDoc(table, doc));
}

function upsertDocs(collection, docs) {
  const table = tableFor(collection);
  const s = stmt(table);
  const run = getDb().transaction((list) => {
    for (const doc of list) {
      if (doc && typeof doc.id === 'string') s.run(...serializeDoc(table, doc));
    }
  });
  run(docs || []);
}

function deleteDoc(collection, id) {
  const table = tableFor(collection);
  getDb().prepare(`DELETE FROM ${table} WHERE id = ?`).run(String(id));
}

function buildWhere(where) {
  const clauses = [];
  const values = [];
  for (const [field, value] of Object.entries(where || {})) {
    const col = FIELD_COLUMNS[field];
    if (!col) throw new Error(`Unsupported where field: ${field}`);
    clauses.push(`${col} = ?`);
    values.push(String(value));
  }
  if (clauses.length === 0) throw new Error('Empty where clause is not allowed');
  return { sql: clauses.join(' AND '), values };
}

function deleteWhere(collection, where) {
  const table = tableFor(collection);
  const { sql, values } = buildWhere(where);
  const info = getDb().prepare(`DELETE FROM ${table} WHERE ${sql}`).run(...values);
  return info.changes;
}

/** Replace all rows matching `where` with `docs` (single transaction). */
function replaceWhere(collection, where, docs) {
  const table = tableFor(collection);
  const { sql, values } = buildWhere(where);
  const s = stmt(table);
  const run = getDb().transaction(() => {
    getDb().prepare(`DELETE FROM ${table} WHERE ${sql}`).run(...values);
    for (const doc of docs || []) {
      if (doc && typeof doc.id === 'string') s.run(...serializeDoc(table, doc));
    }
  });
  run();
}

/** Cascading deletes mirroring the renderer's entity removal semantics. */
function deleteStudentCascade(id) {
  const db = getDb();
  const run = db.transaction(() => {
    db.prepare('DELETE FROM students WHERE id = ?').run(id);
    db.prepare('DELETE FROM fee_accounts WHERE student_id = ?').run(id);
    db.prepare('DELETE FROM fee_transactions WHERE student_id = ?').run(id);
    db.prepare('DELETE FROM attendance WHERE student_id = ?').run(id);
    db.prepare('DELETE FROM results WHERE student_id = ?').run(id);
    db.prepare('DELETE FROM performance WHERE student_id = ?').run(id);
  });
  run();
}

function deleteTeacherCascade(id) {
  const db = getDb();
  const run = db.transaction(() => {
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
    db.prepare('DELETE FROM teacher_attendance WHERE teacher_id = ?').run(id);
  });
  run();
}

function loadFullDatabase(seedIfEmpty) {
  const db = getDb();

  const infoRow = db.prepare('SELECT data FROM school_info WHERE id = 1').get();
  let schoolInfo = infoRow ? JSON.parse(infoRow.data) : null;

  const readAll = (table) => db.prepare(`SELECT data FROM ${table}`).all().map((r) => JSON.parse(r.data));

  if (!schoolInfo) {
    if (typeof seedIfEmpty === 'function') {
      const seeded = seedIfEmpty();
      replaceFullDatabase(seeded);
      return loadFullDatabase(null);
    }
    throw new Error('DATABASE_EMPTY');
  }

  return {
    schoolInfo,
    users: readAll('users'),
    classes: readAll('classes'),
    students: readAll('students'),
    attendance: readAll('attendance'),
    teacherAttendance: readAll('teacher_attendance'),
    feeAccounts: readAll('fee_accounts'),
    feeTransactions: readAll('fee_transactions'),
    exams: readAll('exams'),
    results: readAll('results'),
    performance: readAll('performance'),
    academicYears: readAll('academic_years'),
    activityLogs: readAll('activity_logs').sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || ''))),
    notifications: readAll('notifications'),
  };
}

/** Atomically replace every collection (import / restore / demo reset). */
function replaceFullDatabase(imported) {
  if (!imported || typeof imported !== 'object' || !imported.schoolInfo) {
    throw new Error('Invalid database payload');
  }
  const db = getDb();
  const run = db.transaction(() => {
    setSchoolInfo(imported.schoolInfo);
    for (const [collection, table] of Object.entries(COLLECTIONS)) {
      db.prepare(`DELETE FROM ${table}`).run();
      const list = imported[collection];
      if (Array.isArray(list)) {
        const s = stmt(table);
        for (const doc of list) {
          if (doc && typeof doc.id === 'string') s.run(...serializeDoc(table, doc));
        }
      }
    }
  });
  run();
  logger.info('full database replaced', {
    students: Array.isArray(imported.students) ? imported.students.length : 0,
  });
}

function migrateLegacyIfPresent(legacyDatabase) {
  if (!legacyDatabase || typeof legacyDatabase !== 'object' || !legacyDatabase.schoolInfo) return false;
  const db = getDb();
  const existing = db.prepare('SELECT data FROM school_info WHERE id = 1').get();
  if (existing) return false; // never overwrite real data
  replaceFullDatabase(legacyDatabase);
  logger.info('legacy browser database imported into SQLite');
  return true;
}

module.exports = {
  COLLECTIONS,
  setSchoolInfo,
  upsertDoc,
  upsertDocs,
  deleteDoc,
  deleteWhere,
  replaceWhere,
  deleteStudentCascade,
  deleteTeacherCascade,
  loadFullDatabase,
  replaceFullDatabase,
  migrateLegacyIfPresent,
};
