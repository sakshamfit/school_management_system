'use strict';

/**
 * Safe local file storage for uploads/reports/diagnostics.
 *
 * Security rules:
 *  - Every filename is sanitized (no path separators, no traversal, no
 *    control characters, bounded length).
 *  - Every resolved path is verified to remain inside an approved root
 *    (uploads/, backups/, reports/). Absolute paths from the renderer are
 *    never honored for reads/writes.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const paths = require('./paths');
const logger = require('./logger');

const APPROVED_SUBDIRS = ['students', 'teachers', 'documents', 'photos', 'reports'];

function sanitizeFileName(name) {
  if (typeof name !== 'string' || !name.trim()) {
    throw new Error('Invalid file name');
  }
  const base = path.basename(name).replace(/[\\/]/g, '_');
  const cleaned = base
    .replace(/[\u0000-\u001f<>:"|?*]/g, '_')
    .replace(/^\.+/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
  if (!cleaned || cleaned === '.' || cleaned === '..') {
    throw new Error('Invalid file name');
  }
  return cleaned;
}

function resolveInsideRoot(root, ...segments) {
  const resolved = path.resolve(root, ...segments);
  const normalizedRoot = path.resolve(root);
  if (resolved !== normalizedRoot && !resolved.startsWith(normalizedRoot + path.sep)) {
    throw new Error('Path escapes the allowed directory');
  }
  return resolved;
}

/**
 * Save base64/binary content into uploads/<category>/<safe-name>.
 * Returns { fileName, relativePath }.
 */
function saveUpload({ category, fileName, dataBase64 }) {
  if (!APPROVED_SUBDIRS.includes(category)) throw new Error('Invalid upload category');
  const safeName = sanitizeFileName(fileName);
  const dir = resolveInsideRoot(paths.uploadsDir(), category);
  fs.mkdirSync(dir, { recursive: true });

  const unique = `${Date.now()}-${crypto.randomBytes(3).toString('hex')}-${safeName}`;
  const target = resolveInsideRoot(dir, unique);
  const buffer = Buffer.from(String(dataBase64), 'base64');
  if (buffer.length > 25 * 1024 * 1024) throw new Error('File too large (max 25 MB)');
  fs.writeFileSync(target, buffer);
  logger.info('upload saved', { category, file: unique, bytes: buffer.length });
  return { fileName: unique, relativePath: path.join(category, unique) };
}

function listUploads(category) {
  if (!APPROVED_SUBDIRS.includes(category)) throw new Error('Invalid upload category');
  const dir = path.join(paths.uploadsDir(), category);
  try {
    return fs
      .readdirSync(dir)
      .filter((f) => fs.statSync(path.join(dir, f)).isFile())
      .map((f) => ({ fileName: f, size: fs.statSync(path.join(dir, f)).size }));
  } catch {
    return [];
  }
}

/** Full OS path for an upload (validated) — used with shell.openPath. */
function uploadAbsolutePath(category, fileName) {
  if (!APPROVED_SUBDIRS.includes(category)) throw new Error('Invalid upload category');
  const safeName = sanitizeFileName(fileName);
  return resolveInsideRoot(paths.uploadsDir(), category, safeName);
}

function uploadTrashOrDelete(category, fileName) {
  const target = uploadAbsolutePath(category, fileName);
  if (fs.existsSync(target)) fs.unlinkSync(target);
}

module.exports = {
  sanitizeFileName,
  saveUpload,
  listUploads,
  uploadAbsolutePath,
  uploadTrashOrDelete,
  APPROVED_SUBDIRS,
};
