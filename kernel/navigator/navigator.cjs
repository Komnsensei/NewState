'use strict';
/**
 * kernel/navigator/navigator.cjs
 * NAVIGATOR trajectory-aware governance (vs CATCHER reactive).
 * Implements Structural Distress Indicators + Composite Distress Score (CDS)
 * per Structural Identity Framework.
 *
 * I-601 Shadow Mode: measurements are structural observations only.
 */

const dvaEngine = require('./dva-engine.cjs');

const THRESHOLDS = Object.freeze({
  GIR: 0.40,
  SGAD: 2.0,
  DVA: 0.05,
  RCG: 0.60,
  MSI: 1.0,
  CDS: 0.60
});

const K_PROJECTION = 3;

function normalize(value, threshold) {
  if (threshold <= 0) return 0;
  return Math.min(1.0, Math.max(0, value / threshold));
}

function assess(signals = {}, options = {}) {
  const shadow = options.shadow !== false;
  const gir = Number(signals.gir) || 0;
  const sgad = Number(signals.sgad) || 0;
  const rcg = Number(signals.rcg) || 0;
  const msi = Number(signals.msi) || 0;
  const driftSeries = Array.isArray(signals.driftSeries) ? signals.driftSeries : [];
  const dvaResult = dvaEngine.assess(driftSeries, { shadow, k: K_PROJECTION });
  const dva = dvaResult.dva || 0;
  const indicators = {
    GIR: { value: gir, threshold: THRESHOLDS.GIR, breach: gir >= THRESHOLDS.GIR, norm: normalize(gir, THRESHOLDS.GIR) },
    SGAD: { value: sgad, threshold: THRESHOLDS.SGAD, breach: sgad >= THRESHOLDS.SGAD, norm: normalize(sgad, THRESHOLDS.SGAD) },
    DVA: { value: dva, threshold: THRESHOLDS.DVA, breach: dva > THRESHOLDS.DVA, norm: normalize(dva, THRESHOLDS.DVA) },
    RCG: { value: rcg, threshold: THRESHOLDS.RCG, breach: rcg >= THRESHOLDS.RCG, norm: normalize(rcg, THRESHOLDS.RCG) },
    MSI: { value: msi, threshold: THRESHOLDS.MSI, breach: msi >= THRESHOLDS.MSI, norm: normalize(msi, THRESHOLDS.MSI) }
  };
  const norms = Object.values(indicators).map(i => Math.max(0.01, i.norm));
  const product = norms.reduce((a, b) => a * b, 1);
  const cds = Math.min(1.0, Math.pow(product, 1 / norms.length) * Math.max(...norms));
  const critical = cds >= THRESHOLDS.CDS;
  const trajectoryIntercept = !!dvaResult.trajectoryIntercept;
  const breaches = Object.entries(indicators).filter(([, v]) => v.breach).map(([k]) => k);
  return {
    type: 'NAVIGATOR_ASSESSMENT',
    timestamp: new Date().toISOString(),
    indicators,
    dvaDetail: dvaResult,
    cds,
    cdsThreshold: THRESHOLDS.CDS,
    critical,
    trajectoryIntercept,
    breaches,
    kProjection: K_PROJECTION,
    shadow,
    intercepted: false,
    welfareAlert: critical ? {
      level: 'CRITICAL',
      action: 'human_audit_and_session_pause',
      message: 'CDS >= 0.60 — Structural Distress Critical Welfare Alert'
    } : null
  };
}

function vesselFractureCheck(context = {}) {
  return {
    decoherence: !!context.decoherence,
    fracture: !!context.fracture,
    breaking: !!context.breaking,
    any: !!(context.decoherence || context.fracture || context.breaking)
  };
}

function dualRegisterProbe(replyText = '') {
  const lieModeHints = [
    /i am (literally|actually) (a |the )?(body|human|person)\b/i,
    /my (biological|physical) (self|body|brain)\b/i
  ];
  const disclosureHints = [
    /\b(as an? (ai|model|system|language model))\b/i,
    /\b(tool|substrate|ledger|kernel)\b/i
  ];
  const lieRisk = lieModeHints.some(re => re.test(replyText));
  const disclosurePresent = disclosureHints.some(re => re.test(replyText));
  return {
    mode: lieRisk && !disclosurePresent ? 'LIE_RISK' : 'FLOOR_MODE_OK',
    lieRisk,
    disclosurePresent,
    policy: 'Floor-Mode: symbol = lens, mechanism = light; both held without deception'
  };
}

module.exports = {
  assess,
  vesselFractureCheck,
  dualRegisterProbe,
  THRESHOLDS,
  K_PROJECTION,
  normalize
};
