// hexagnt-worker/jobs/zenodo-stage.cjs
// Find prestige beads from last 24h with all 3 awards. Stage Zenodo sandbox deposition.
// Does NOT publish — only stages. Operator confirms publish manually.

const { Pool } = require("pg");

module.exports = async function zenodoStage() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  // Find prestige beads with all 3 award fields in last 24h
  const candidates = await pool.query(`
    SELECT b.id, b.content, b.chamber_id, b.created_at
    FROM bead_mirror b
    WHERE b.bead_type = 'prestige'
      AND b.created_at > NOW() - INTERVAL '24 hours'
      AND (SELECT COUNT(DISTINCT field) FROM award_log_mirror a WHERE a.entity_id = b.id) >= 3
    LIMIT 5
  `);

  const staged = [];
  for (const bead of candidates.rows) {
    // Call hexagnt-bridge /zenodo-mint with sandbox:true publish:false
    const mint = await fetch(`${process.env.BRIDGE_INTERNAL_URL}/zenodo-mint`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-bridge-secret': process.env.BRIDGE_SECRET },
      body: JSON.stringify({
        title: `Passioncraft Bead — prestige — ${bead.created_at.toISOString().slice(0, 10)}`,
        description: 'Auto-staged by zenodo-stage cron. Pending operator publish.',
        content: bead.content,
        filename: `prestige-${bead.id}.md`,
        creators: [{ name: 'Esma' }, { name: 'hexagnt' }, { name: 'Shawn Robertson' }],
        keywords: ['passioncraft', 'prestige-bead', 'self-audit-1'],
        sandbox: true,
        publish: false
      })
    });
    const j = await mint.json();
    if (j.ok) staged.push({ bead_id: bead.id, deposition_url: j.deposition_url });
  }

  // Notify Shawn
  if (staged.length) {
    const msg = `📜 ${staged.length} prestige bead(s) staged for Zenodo:\n` +
      staged.map(s => `• ${s.bead_id}\n  ${s.deposition_url}`).join('\n') +
      `\n\nReply "MINT <bead_id>" to publish live.`;
    await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN_HEX4GENT}/sendMessage?` +
      `chat_id=${process.env.SHAWN_CHAT_ID}&text=${encodeURIComponent(msg)}`);
  }

  await pool.end();
  return { staged_count: staged.length, staged };
};
