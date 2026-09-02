'use strict';

/**
 * Audit logging. Records actor/action/target + non-sensitive metadata.
 * NEVER pass secrets (passwords, tokens) into metadata.
 */

const { getDb } = require('./db');

function audit({ actorType, actorId, actorName, action, target, metadata, ip }) {
  try {
    getDb()
      .prepare(
        `INSERT INTO audit_logs (actor_type, actor_id, actor_name, action, target, metadata, ip, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        actorType || 'system',
        actorId || null,
        actorName || null,
        action,
        target || null,
        JSON.stringify(metadata || {}),
        ip || null,
        new Date().toISOString()
      );
  } catch (err) {
    console.error('[audit] failed to write audit log:', err.message);
  }
}

module.exports = { audit };
