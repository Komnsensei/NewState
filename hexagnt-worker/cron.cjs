// hexagnt-worker/cron.cjs
// Entry point when CRON_JOB env var is set. Server stays alive for Telegram; cron is one-shot.

const job = process.env.CRON_JOB;

const handlers = {
  'pg-sync': require('./jobs/pg-sync.cjs'),
  'integrity-audit': require('./jobs/integrity-audit.cjs'),
  'watchcycle': require('./jobs/watchcycle.cjs'),
  'zenodo-stage': require('./jobs/zenodo-stage.cjs'),
  'forensics-roll': require('./jobs/forensics-roll.cjs')
};

(async () => {
  if (!job || !handlers[job]) {
    console.error('CRON_JOB not set or unknown:', job);
    process.exit(1);
  }
  const t0 = Date.now();
  console.log(`[cron:${job}] starting`);
  try {
    const result = await handlers[job]();
    console.log(`[cron:${job}] done in ${Date.now() - t0}ms`, result);
    process.exit(0);
  } catch (e) {
    console.error(`[cron:${job}] failed:`, e);
    process.exit(1);
  }
})();
