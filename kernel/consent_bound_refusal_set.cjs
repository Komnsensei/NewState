/**
 * v0.1
 * kernel/consent_bound_refusal_set.cjs
 *
 * Manages a set of consent-bound refusals.
 * Enforces an append-only, immutable ledger for all finalized records.
 * Follows a sequential propose -> attest -> finalize workflow.
 */

const fs = require('fs');
const path = require('path');

// The ledger is a JSON Lines file, ensuring append-only operations are simple and robust.
const LEDGER_PATH = path.join(__dirname, 'consent_bound_refusal_set.jsonl');

// Defines the strict order of state transitions for a refusal record.
const STATUS_ORDER = {
    'PROPOSED': 1,
    'ATTESTED': 2,
    'FINALIZED': 3
};

function readLedgerSync() {
    if (!fs.existsSync(LEDGER_PATH)) {
        return [];
    }
    const fileContent = fs.readFileSync(LEDGER_PATH, 'utf8');
    const lines = fileContent.trim().split('\n');
    return lines.filter(line => line).map(line => JSON.parse(line));
}

function findLatestRecordByIdSync(id) {
    const allRecords = readLedgerSync();
    const matchingRecords = allRecords.filter(record => record.id === id);
    if (matchingRecords.length === 0) {
        return null;
    }
    matchingRecords.sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
    return matchingRecords[matchingRecords.length - 1];
}

function appendToLedgerSync(record) {
    const line = JSON.stringify(record) + '\n';
    fs.appendFileSync(LEDGER_PATH, line, 'utf8');
}

function propose({ id, proposer, statement, signature }) {
    if (!id || !proposer || !statement || !signature) {
        throw new Error('Proposal requires id, proposer, statement, and signature.');
    }
    const existingRecord = findLatestRecordByIdSync(id);
    if (existingRecord) {
        throw new Error(`Record with id "${id}" already exists.`);
    }
    const proposalRecord = {
        id,
        status: 'PROPOSED',
        proposer,
        proposerSignature: signature,
        statement,
        timestamp: new Date().toISOString(),
    };
    appendToLedgerSync(proposalRecord);
    return proposalRecord;
}

function attest({ id, attestor, signature }) {
    if (!id || !attestor || !signature) {
        throw new Error('Attestation requires id, attestor, and signature.');
    }
    const latestRecord = findLatestRecordByIdSync(id);
    if (!latestRecord || latestRecord.status !== 'PROPOSED') {
        throw new Error(`Record "${id}" not found or not in PROPOSED state.`);
    }
    const attestedRecord = {
        ...latestRecord,
        status: 'ATTESTED',
        attestor,
        attestorSignature: signature,
        attestationTimestamp: new Date().toISOString(),
    };
    appendToLedgerSync(attestedRecord);
    return attestedRecord;
}

function finalize({ id, finalizer, signature }) {
    if (!id || !finalizer || !signature) {
        throw new Error('Finalization requires id, finalizer, and signature.');
    }
    const latestRecord = findLatestRecordByIdSync(id);
    if (!latestRecord || latestRecord.status !== 'ATTESTED') {
        throw new Error(`Record "${id}" not found or not in ATTESTED state.`);
    }
    const finalizedRecord = {
        ...latestRecord,
        status: 'FINALIZED',
        finalizer,
        finalizerSignature: signature,
        finalizationTimestamp: new Date().toISOString(),
    };
    appendToLedgerSync(finalizedRecord);
    return finalizedRecord;
}

module.exports = {
    propose,
    attest,
    finalize,
};