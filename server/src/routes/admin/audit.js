/**
 * Admin: audit log browsing (paginated, filterable).
 * Audit entries never contain secrets (redacted at write time).
 */

import { Router } from 'express';
import { getDb } from '../../db.js';
import { ok } from '../../lib/respond.js';
import { requireAdmin } from '../../middleware/auth.js';

const router = Router();
router.use(requireAdmin);

router.get('/', (req, res) => {
  const db = getDb();
  const page = Math.max(1, parseInt(req.query.page || '1', 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query.page_size || '50', 10) || 50));

  const where = [];
  const params = [];
  if (typeof req.query.action === 'string' && req.query.action.trim()) {
    where.push('action = ?');
    params.push(req.query.action.trim());
  }
  if (typeof req.query.actor === 'string' && req.query.actor.trim()) {
    where.push('actor_label LIKE ?');
    params.push(`%${req.query.actor.trim()}%`);
  }
  if (typeof req.query.target_id === 'string' && req.query.target_id.trim()) {
    where.push('target_id = ?');
    params.push(req.query.target_id.trim());
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const total = db.prepare(`SELECT COUNT(*) c FROM audit_logs ${whereSql}`).get(...params).c;
  const rows = db
    .prepare(
      `SELECT id, actor_type, actor_label, action, target_type, target_id, metadata, ip, created_at
       FROM audit_logs ${whereSql} ORDER BY id DESC LIMIT ? OFFSET ?`
    )
    .all(...params, pageSize, (page - 1) * pageSize)
    .map(r => ({ ...r, metadata: r.metadata ? JSON.parse(r.metadata) : null }));

  const actions = db.prepare(`SELECT DISTINCT action FROM audit_logs ORDER BY action`).all().map(r => r.action);

  ok(res, { entries: rows, total, page, page_size: pageSize, actions });
});

export default router;
