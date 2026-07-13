// esma-kernel side cron — keeps forensics.jsonl bounded by rolling daily
// Runs on esma-kernel service at 23:55 UTC

module.exports = async function forensicsRoll() {
  const fs = require("fs");
  const path = require("path");
  const DATA_DIR = process.env.DATA_DIR || "./kernel";
  const src = path.join(DATA_DIR, "forensics.jsonl");
  const archiveDir = path.join(DATA_DIR, "archive");
  if (!fs.existsSync(archiveDir)) fs.mkdirSync(archiveDir, { recursive: true });

  const date = new Date().toISOString().slice(0, 10);
  const dest = path.join(archiveDir, `${date}.jsonl`);

  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    fs.writeFileSync(src, ""); // truncate live ledger
    return { archived_to: dest, size: fs.statSync(dest).size };
  }
  return { archived_to: null, reason: "no live ledger to roll" };
};
