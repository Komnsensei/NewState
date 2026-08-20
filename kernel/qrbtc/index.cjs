'use strict';
const path = require('path');
const {
  scoreSession,
  normalize,
  spiralDegree,
  assignTier,
  getTierFromScore100,
  calculateBlockValue,
  WEIGHTS
} = require('./score.cjs');
const { hashSession, verifyChain, LocalLedger } = require('./chain.cjs');

function defaultLedgerPath() {
  try {
    const { paths } = require('../newstate-paths.cjs');
    if (paths && paths.statusDir) {
      return path.join(paths.statusDir, 'qrbtc-ledger.json');
    }
  } catch (_) {}
  return path.join(process.cwd(), '.newstate', 'status', 'qrbtc-ledger.json');
}

let _ledger = null;
function getLedger() {
  if (!_ledger) _ledger = new LocalLedger(defaultLedgerPath());
  return _ledger;
}

function submitSession(passportId, session, opts = {}) {
  const score = scoreSession(session);
  const trust = normalize(score, 100);
  const tier = getTierFromScore100(score);
  const degreesDelta = calculateBlockValue(score);

  const ledger = getLedger();
  const passport = passportId ? ledger.getPassport(passportId) : null;
  let totalDegrees = passport ? passport.total_degrees + degreesDelta : degreesDelta;
  const chain = passportId ? ledger.chains.get(passportId) || [] : [];
  const previousHash = chain.length ? chain[chain.length - 1].session_hash : null;
  const session_hash = hashSession(session, score, totalDegrees, previousHash);

  const block = {
    passport_id: passportId || null,
    score,
    trust,
    tier,
    degrees_delta: degreesDelta,
    total_degrees: totalDegrees,
    session_hash,
    previous_hash: previousHash,
    pillars: { ...session },
    at: new Date().toISOString()
  };

  if (passport && !passport.revoked && opts.persist !== false) {
    chain.push(block);
    ledger.chains.set(passportId, chain);
    passport.total_degrees = totalDegrees;
    passport.block_count = chain.length;
    passport.tier = tier;
    passport.trust = trust;
    ledger.passports.set(passportId, passport);
    ledger.persist();
  }

  return block;
}

function verifyPassportChain(passportId) {
  const ledger = getLedger();
  const chain = ledger.chains.get(passportId) || [];
  return verifyChain(chain);
}

module.exports = {
  WEIGHTS,
  scoreSession,
  normalize,
  spiralDegree,
  assignTier,
  getTierFromScore100,
  calculateBlockValue,
  hashSession,
  verifyChain,
  LocalLedger,
  getLedger,
  submitSession,
  verifyPassportChain
};
