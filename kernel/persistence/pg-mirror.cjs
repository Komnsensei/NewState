// kernel/persistence/pg-mirror.cjs
// Postgres mirror for Base44 entities.

'use strict';

const { Pool } = require('pg');

const enabled = !!process.env.DATABASE_URL;
let pool = null;

if (enabled) {
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
}

async function mirror(tableName, id, data) {
  if (!enabled) return { mirrored: false, reason: 'DATABASE_URL not set' };
  if (!pool) return { mirrored: false, reason: 'Postgres pool not initialized' };

  try {
    let query, values;

    switch (tableName) {
      case 'award_log_mirror':
        query = `INSERT INTO award_log_mirror (id, entity_id, entity_name, field, from_user, to_user, thread_id, comment, base44_synced_at)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
                 ON CONFLICT (id) DO UPDATE SET base44_synced_at = NOW()`;
        values = [data.id, data.entity_id, data.entity_name, data.field, data.from_user, data.to_user, data.thread_id, data.comment];
        break;
      case 'bead_mirror':
        query = `INSERT INTO bead_mirror (id, chamber_id, bead_type, content, author_name, hexagnt_reviewed, base44_synced_at)
                 VALUES ($1,$2,$3,$4,$5,$6,NOW())
                 ON CONFLICT (id) DO UPDATE SET base44_synced_at = NOW(), hexagnt_reviewed = EXCLUDED.hexagnt_reviewed`;
        values = [data.id, data.chamber_id, data.bead_type, data.content, data.author_name, data.hexagnt_reviewed];
        break;
      case 'agent_document_mirror':
        query = `INSERT INTO agent_document_mirror (id, title, doc_type, status, version, body, tags, related_entity_ids, base44_synced_at)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
                 ON CONFLICT (id) DO UPDATE SET
                   title = EXCLUDED.title, status = EXCLUDED.status, version = EXCLUDED.version,
                   body = EXCLUDED.body, tags = EXCLUDED.tags, base44_synced_at = NOW()`;
        values = [data.id, data.title, data.doc_type, data.status, data.version, data.body, JSON.stringify(data.tags || []), JSON.stringify(data.related_entity_ids || [])];
        break;
      default:
        return { mirrored: false, error: `Unknown table name: ${tableName}` };
    }

    await pool.query(query, values);
    return { mirrored: true };
  } catch (e) {
    console.error(`[pg-mirror:${tableName}]`, e.message);
    return { mirrored: false, error: e.message };
  }
}

module.exports = {
  enabled,
  mirrorAwardLog: (id, data) => mirror('award_log_mirror', id, data),
  mirrorBead: (id, data) => mirror('bead_mirror', id, data),
  mirrorAgentDocument: (id, data) => mirror('agent_document_mirror', id, data),
  // Add other mirror functions as needed for different tables
  closePool: async () => { if (pool) await pool.end(); }
};
