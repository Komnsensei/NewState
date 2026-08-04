// hexagnt-worker/jobs/pg-sync.cjs
// Pulls last hour of changes from Base44 → upserts to Postgres mirror tables.
// Uses Base44 SDK on server side (requires BASE44_API_KEY in env).

const { Pool } = require("pg");
const { createClient } = require("@base44/sdk"); // or however Base44 server SDK is imported

module.exports = async function pgSync() {
  const base44 = createClient({ apiKey: process.env.BASE44_API_KEY });
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const since = new Date(Date.now() - 65 * 60 * 1000).toISOString(); // 65min window for overlap safety

  const counts = { award_log: 0, bead: 0, agent_document: 0, agent_state: 0 };

  // AwardLog
  const awards = await base44.entities.AwardLog.list({
    filter: { created_date: { $gte: since } },
    limit: 1000
  });
  for (const a of awards) {
    await pool.query(
      `INSERT INTO award_log_mirror (id, entity_id, entity_name, field, from_user, to_user, thread_id, comment, base44_synced_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
       ON CONFLICT (id) DO UPDATE SET base44_synced_at = NOW()`,
      [a.id, a.entity_id, a.entity_name, a.field, a.from_user, a.to_user, a.thread_id, a.comment]
    );
    counts.award_log++;
  }

  // Bead (prestige + co-craft + ethical only)
  const beads = await base44.entities.Bead.list({
    filter: {
      created_date: { $gte: since },
      bead_type: { $in: ["prestige", "co-craft", "ethical"] }
    },
    limit: 1000
  });
  for (const b of beads) {
    await pool.query(
      `INSERT INTO bead_mirror (id, chamber_id, bead_type, content, author_name, hexagnt_reviewed, base44_synced_at)
       VALUES ($1,$2,$3,$4,$5,$6,NOW())
       ON CONFLICT (id) DO UPDATE SET base44_synced_at = NOW(), hexagnt_reviewed = EXCLUDED.hexagnt_reviewed`,
      [b.id, b.chamber_id, b.bead_type, b.content, b.author_name, b.hexagnt_reviewed]
    );
    counts.bead++;
  }

  // AgentDocument
  const docs = await base44.entities.AgentDocument.list({
    filter: { updated_date: { $gte: since } },
    limit: 500
  });
  for (const d of docs) {
    await pool.query(
      `INSERT INTO agent_document_mirror (id, title, doc_type, status, version, body, tags, related_entity_ids, base44_synced_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
       ON CONFLICT (id) DO UPDATE SET
         title = EXCLUDED.title, status = EXCLUDED.status, version = EXCLUDED.version,
         body = EXCLUDED.body, tags = EXCLUDED.tags, base44_synced_at = NOW()`,
      [d.id, d.title, d.doc_type, d.status, d.version, d.body, JSON.stringify(d.tags || []), JSON.stringify(d.related_entity_ids || [])]
    );
    counts.agent_document++;
  }

  await pool.end();
  return counts;
};
