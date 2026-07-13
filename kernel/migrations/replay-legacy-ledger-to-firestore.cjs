#!/usr/bin/env node
// kernel/migrations/replay-legacy-ledger-to-firestore.cjs
// Phase 7B closer — idempotent rehydration of legacy JSONL ledger into Firestore.
// Usage: node kernel/migrations/replay-legacy-ledger-to-firestore.cjs [--dry-run]
//
// Env required:
//   GOOGLE_CLOUD_PROJECT=passioncraft
//   FIRESTORE_COLLECTION=esma-history (default)
//   LEGACY_BUCKET=passioncraft-archive (default)
//   LEGACY_OBJECT=legacy/esma-history-2026-06-18.jsonl (default)
//
// Idempotency: doc_id = sha256(`${entry.ts}|${(entry.content||"").slice(0,128)}`).slice(0,40)
// Safe to re-run. Will not duplicate. Will not overwrite existing docs (set with merge:false + exists:false guard).

const crypto = require("crypto");
const readline = require("readline");
const { Storage } = require("@google-cloud/storage");
const { Firestore } = require("@google-cloud/firestore");

const DRY_RUN = process.argv.includes("--dry-run");
const PROJECT = process.env.GOOGLE_CLOUD_PROJECT || "passioncraft";
const COLLECTION = process.env.FIRESTORE_COLLECTION || "esma-history";
const BUCKET = process.env.LEGACY_BUCKET || "passioncraft-archive";
const OBJECT = process.env.LEGACY_OBJECT || "legacy/esma-history-2026-06-18.jsonl";

function docIdFor(entry) {
  const ts = entry.ts || entry.timestamp || "";
  const head = String(entry.content || entry.text || "").slice(0, 128);
  return crypto.createHash("sha256").update(`${ts}|${head}`).digest("hex").slice(0, 40);
}

async function main() {
  console.log(`[rehydrate] project=${PROJECT} collection=${COLLECTION} src=gs://${BUCKET}/${OBJECT} dry_run=${DRY_RUN}`);

  const storage = new Storage({ projectId: PROJECT });
  const fs = new Firestore({ projectId: PROJECT });
  const col = fs.collection(COLLECTION);

  const stream = storage.bucket(BUCKET).file(OBJECT).createReadStream();
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  let total = 0, written = 0, skipped_existing = 0, skipped_invalid = 0, errors = 0;
  let batch = fs.batch();
  let batched = 0;
  const BATCH_SIZE = 400;

  for await (const line of rl) {
    total++;
    let entry;
    try { entry = JSON.parse(line); } catch (e) { skipped_invalid++; continue; }
    if (!entry || (!entry.ts && !entry.timestamp)) { skipped_invalid++; continue; }

    const id = docIdFor(entry);
    const ref = col.doc(id);

    if (!DRY_RUN) {
      const doc = await ref.get();
      if (doc.exists) {
        skipped_existing++;
        continue;
      }
      batch.set(ref, { ...entry, _rehydrated_at: Firestore.FieldValue.serverTimestamp() });
      batched++;
      if (batched >= BATCH_SIZE) {
        await batch.commit();
        batch = fs.batch();
        batched = 0;
      }
    }
    written++;
  }

  if (batched > 0) {
    await batch.commit();
  }

  console.log(`[rehydrate] complete. Total: ${total}, Written: ${written}, Skipped (existing): ${skipped_existing}, Skipped (invalid): ${skipped_invalid}, Errors: ${errors}`);
}

if (require.main === module) {
  main().catch(e => {
    console.error("[rehydrate] FATAL:", e);
    process.exit(1);
  });
}
