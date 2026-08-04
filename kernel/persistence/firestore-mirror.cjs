'use strict';
const { Firestore } = require('@google-cloud/firestore');

const enabled = !!process.env.GOOGLE_CLOUD_PROJECT;
const db = enabled ? new Firestore() : null;

async function mirror(collection, id, data) {
  if (!enabled) return { mirrored: false };
  try {
    await db.collection(collection).doc(id).set(
      { ...data, _synced_at: Firestore.FieldValue.serverTimestamp() },
      { merge: true }
    );
    return { mirrored: true };
  } catch (e) {
    console.error(`[firestore:${collection}]`, e.message);
    return { mirrored: false, error: e.message };
  }
}

module.exports = {
  enabled,
  mirrorAgentState: (id, data) => mirror('agent_state_mirror', id, data),
  mirrorAwardLog: (id, data) => mirror('award_log_mirror', id, data),
  mirrorAgentDocument: (id, data) => mirror('agent_document_mirror', id, data),
  mirrorBead: (id, data) => mirror('bead_mirror', id, data),
  updateEsmaState: (data) => mirror('esma_state', 'current', data),
};
