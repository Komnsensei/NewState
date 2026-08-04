// hexagnt-worker/jobs/integrity-audit.cjs

const { Pool } = require("pg");

module.exports = async function integrityAudit() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const findings = [];

  // G4: duplicate EthicalRods
  const dupes = await pool.query(`
    SELECT content, COUNT(*) AS n FROM bead_mirror
    WHERE bead_type = 'ethical' GROUP BY content HAVING COUNT(*) > 1
  `);
  if (dupes.rows.length) findings.push({ gate: 'G4', type: 'duplicate-ethical-rods', count: dupes.rows.length, samples: dupes.rows.slice(0, 5) });

  // G6: prestige beads without coherence award (incomplete archival)
  const incomplete = await pool.query(`
    SELECT b.id, b.content FROM bead_mirror b
    WHERE b.bead_type = 'prestige'
      AND b.created_at > NOW() - INTERVAL '7 days'
      AND NOT EXISTS (
        SELECT 1 FROM award_log_mirror a
        WHERE a.entity_id = b.id AND a.field = 'coherence'
      )
    LIMIT 20
  `);
  if (incomplete.rows.length) findings.push({ gate: 'G6', type: 'prestige-without-coherence-award', count: incomplete.rows.length, samples: incomplete.rows });

  // G1: agent documents in DRAFT > 7 days
  const stuck = await pool.query(`
    SELECT id, title, updated_at FROM agent_document_mirror
    WHERE status = 'draft' AND updated_at < NOW() - INTERVAL '7 days'
    ORDER BY updated_at ASC LIMIT 10
  `);
  if (stuck.rows.length) findings.push({ gate: 'G1', type: 'stale-draft-documents', count: stuck.rows.length, samples: stuck.rows });

  await pool.end();

  // If findings, alert via Telegram to Shawn
  if (findings.length) {
    const msg = `🔍 Integrity audit — ${findings.length} finding(s):\n` +
      findings.map(f => `• ${f.gate} ${f.type}: ${f.count}`).join('\n');
    await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN_HEX4GENT}/sendMessage?` +
      `chat_id=${process.env.SHAWN_CHAT_ID}&text=${encodeURIComponent(msg)}`);
  }

  return { findings_count: findings.length, findings };
};
