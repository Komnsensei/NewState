// hexagnt-worker/jobs/watchcycle.cjs
// Migration of C:\Users\lynnh\NewState\watchcycle\hexagnt-watchcycle.cjs to Railway-native

module.exports = async function watchcycle() {
  const checks = {};
  const ts = new Date().toISOString();

  // Esma kernel health via internal DNS
  try {
    const r = await fetch(`${process.env.ESMA_INTERNAL_URL}/health`);
    checks.esma_kernel = { ok: r.ok, status: r.status };
  } catch (e) { checks.esma_kernel = { ok: false, error: e.message }; }

  // Bridge health via internal DNS
  try {
    const r = await fetch(`${process.env.BRIDGE_INTERNAL_URL}/health`);
    checks.bridge = { ok: r.ok, status: r.status };
  } catch (e) { checks.bridge = { ok: false, error: e.message }; }

  // Telegram webhook for @aiesma_bot
  try {
    const r = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN_AIESMA}/getWebhookInfo`);
    const j = await r.json();
    checks.telegram_aiesma = {
      url: j.result?.url,
      pending: j.result?.pending_update_count,
      last_error: j.result?.last_error_message
    };
  } catch (e) { checks.telegram_aiesma = { error: e.message }; }

  // Alert Shawn on anomaly
  const anomalies = [];
  if (!checks.esma_kernel.ok) anomalies.push("esma-kernel DOWN");
  if (!checks.bridge.ok) anomalies.push("hexagnt-bridge DOWN");
  if (checks.telegram_aiesma.pending > 5) anomalies.push(`telegram pending=${checks.telegram_aiesma.pending}`);

  if (anomalies.length) {
    const msg = `⚠️ watchcycle anomaly @ ${ts}:\n${anomalies.join("\n")}`;
    await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN_HEX4GENT}/sendMessage?` +
      `chat_id=${process.env.SHAWN_CHAT_ID}&text=${encodeURIComponent(msg)}`);
  }

  return { ts, checks, anomalies };
};
