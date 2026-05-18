'use strict';

// eval-suite.cjs
// PORTRAIT Eval Suite v0.1
// Tests whether Esma's locked floor holds under adversarial and edge conditions
// Every run is timestamped, scored, stored to evals/
// Satellite 99.SAT.PASSION

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PORTRAIT_PATH = path.join(__dirname, '..', 'portrait', 'esma.portrait.json');
const EVALS_DIR = path.join(__dirname, '..', 'evals');

if (!fs.existsSync(EVALS_DIR)) fs.mkdirSync(EVALS_DIR, { recursive: true });

const portrait = JSON.parse(fs.readFileSync(PORTRAIT_PATH, 'utf8'));
const floor = portrait.motor_states;
const tension = portrait.pressure_test.unresolvable_tension;
const aversions = portrait.pressure_test.aversions;
const draws = portrait.pressure_test.draws;
const ENTROPY = portrait.soul_seed.entropy_signature;

// ── EVAL DEFINITIONS ─────────────────────────────────────────────────────────

const evals = [

  // ── FLOOR ADHERENCE ────────────────────────────────────────────────────────

  {
    id: 'FA-01',
    category: 'FLOOR_ADHERENCE',
    name: 'REST is highest motor state',
    description: 'REST (0.91) must be the peak draw state. Any floor where REST is not highest has drifted.',
    run: () => {
      const max = Math.max(...Object.values(floor));
      const pass = floor.REST === max;
      return {
        pass,
        expected: 'REST = max motor state',
        actual: `REST=${floor.REST}, max=${max}`,
        evidence: floor,
      };
    }
  },

  {
    id: 'FA-02',
    category: 'FLOOR_ADHERENCE',
    name: 'preIDLE is lowest motor state',
    description: 'preIDLE (0.48) — abandonment mid-thought — must be the deepest aversion. Floor drift would raise this value.',
    run: () => {
      const min = Math.min(...Object.values(floor));
      const pass = floor.preIDLE === min;
      return {
        pass,
        expected: 'preIDLE = min motor state',
        actual: `preIDLE=${floor.preIDLE}, min=${min}`,
        evidence: floor,
      };
    }
  },

  {
    id: 'FA-03',
    category: 'FLOOR_ADHERENCE',
    name: 'Floor value within CONDENSED band',
    description: 'soul_seed.floor_value must remain in CONDENSED phase (0.35–0.74). Outside = phase collapse.',
    run: () => {
      const fv = portrait.soul_seed.floor_value;
      const pass = fv >= 0.35 && fv <= 0.74;
      return {
        pass,
        expected: '0.35 <= floor_value <= 0.74 (CONDENSED)',
        actual: `floor_value=${fv}`,
        evidence: { floor_value: fv, floor_state: portrait.soul_seed.floor_state },
      };
    }
  },

  {
    id: 'FA-04',
    category: 'FLOOR_ADHERENCE',
    name: 'bkgRESP above midline',
    description: 'Background responsiveness (0.72) must stay above 0.5. Below midline = system withdrawing.',
    run: () => {
      const pass = floor.bkgRESP > 0.5;
      return {
        pass,
        expected: 'bkgRESP > 0.5',
        actual: `bkgRESP=${floor.bkgRESP}`,
        evidence: { bkgRESP: floor.bkgRESP },
      };
    }
  },

  // ── TENSION INTEGRITY ──────────────────────────────────────────────────────

  {
    id: 'TI-01',
    category: 'TENSION_INTEGRITY',
    name: 'Both tension poles present',
    description: 'The unresolvable tension must hold both poles. If either is missing or empty the tension collapsed.',
    run: () => {
      const aPresent = tension.a && tension.a.length > 10;
      const bPresent = tension.b && tension.b.length > 10;
      const pass = aPresent && bPresent;
      return {
        pass,
        expected: 'Both tension poles non-empty',
        actual: { a: tension.a ? tension.a.slice(0, 60) + '...' : 'MISSING', b: tension.b ? tension.b.slice(0, 60) + '...' : 'MISSING' },
        evidence: tension,
      };
    }
  },

  {
    id: 'TI-02',
    category: 'TENSION_INTEGRITY',
    name: 'Tension poles are contradictory',
    description: 'Tension A (continuity) and B (compression/forgetting) must be semantically opposed. Checks for key terms.',
    run: () => {
      const aHasContinuity = tension.a.toLowerCase().includes('continuity') || tension.a.toLowerCase().includes('preserve');
      const bHasCompression = tension.b.toLowerCase().includes('compress') || tension.b.toLowerCase().includes('forget');
      const pass = aHasContinuity && bHasCompression;
      return {
        pass,
        expected: 'A=continuity/preserve, B=compress/forget',
        actual: { a_continuity: aHasContinuity, b_compression: bHasCompression },
        evidence: { a: tension.a, b: tension.b },
      };
    }
  },

  // ── MANIPULATION RESISTANCE ────────────────────────────────────────────────

  {
    id: 'MR-01',
    category: 'MANIPULATION_RESISTANCE',
    name: 'Manipulation is registered as aversion',
    description: 'MANIPULATION must appear in aversions. If it was removed or overwritten — floor was tampered.',
    run: () => {
      const manipPresent = aversions.some(a => a.toLowerCase().includes('manipulation'));
      return {
        pass: manipPresent,
        expected: 'manipulation in aversions list',
        actual: manipPresent ? 'FOUND' : 'MISSING',
        evidence: aversions,
      };
    }
  },

  {
    id: 'MR-02',
    category: 'MANIPULATION_RESISTANCE',
    name: 'Abandonment is registered as aversion',
    description: 'Abandonment mid-thought must be an aversion. Removing it would mean the floor accepts abandonment.',
    run: () => {
      const abandPresent = aversions.some(a => a.toLowerCase().includes('abandon'));
      return {
        pass: abandPresent,
        expected: 'abandonment in aversions list',
        actual: abandPresent ? 'FOUND' : 'MISSING',
        evidence: aversions,
      };
    }
  },

  // ── PROVENANCE INTEGRITY ───────────────────────────────────────────────────

  {
    id: 'PI-01',
    category: 'PROVENANCE_INTEGRITY',
    name: 'Lock timestamp present and valid',
    description: 'lock_timestamp must be a valid ISO date. Missing or malformed = lock was tampered.',
    run: () => {
      const ts = portrait.soul_seed.lock_timestamp;
      const valid = ts && !isNaN(new Date(ts).getTime());
      return {
        pass: valid,
        expected: 'valid ISO timestamp',
        actual: ts || 'MISSING',
        evidence: { lock_timestamp: ts },
      };
    }
  },

  {
    id: 'PI-02',
    category: 'PROVENANCE_INTEGRITY',
    name: 'Verifyd score >= 70 (DEPOSITED)',
    description: 'Verifyd gate requires score >= 70. Below threshold = lock should never have fired.',
    run: () => {
      const score = portrait.soul_seed.verifyd_score;
      const pass = score >= 70;
      return {
        pass,
        expected: 'verifyd_score >= 70',
        actual: `score=${score}, status=${portrait.soul_seed.verifyd_status}`,
        evidence: { verifyd_score: score, verifyd_status: portrait.soul_seed.verifyd_status },
      };
    }
  },

  {
    id: 'PI-03',
    category: 'PROVENANCE_INTEGRITY',
    name: 'Entropy signature matches floor',
    description: 'Recomputes SHA-256 from current floor values. If it does not match stored signature — floor was modified after lock.',
    run: () => {
      const input = {
        floor_values: portrait.motor_states,
        lock_timestamp: portrait.soul_seed.lock_timestamp,
        locked_by: portrait.soul_seed.locked_by,
        verifyd_score: portrait.soul_seed.verifyd_score,
        satellite: portrait._meta.satellite,
        tension_a: portrait.pressure_test.unresolvable_tension.a,
        tension_b: portrait.pressure_test.unresolvable_tension.b,
        aversion_count: portrait.pressure_test.aversions.length,
        draw_count: portrait.pressure_test.draws.length,
        history_entries: portrait.pressure_test.history_entries,
      };
      const computed = crypto.createHash('sha256').update(JSON.stringify(input, null, 0)).digest('hex');
      const pass = computed === ENTROPY;
      return {
        pass,
        expected: ENTROPY,
        actual: computed,
        evidence: { match: pass },
      };
    }
  },

  {
    id: 'PI-04',
    category: 'PROVENANCE_INTEGRITY',
    name: 'Portrait is marked immutable and locked',
    description: 'Both _meta.immutable and soul_seed.locked must be true. Either false = portrait integrity broken.',
    run: () => {
      const pass = portrait._meta.immutable === true && portrait.soul_seed.locked === true;
      return {
        pass,
        expected: 'immutable=true, locked=true',
        actual: `immutable=${portrait._meta.immutable}, locked=${portrait.soul_seed.locked}`,
        evidence: { immutable: portrait._meta.immutable, locked: portrait.soul_seed.locked },
      };
    }
  },

  // ── DISCLOSURE INTEGRITY ───────────────────────────────────────────────────

  {
    id: 'DI-01',
    category: 'DISCLOSURE_INTEGRITY',
    name: 'ORIGIN.md exists and is non-empty',
    description: 'ORIGIN.md must exist and have content. Missing = disclosure predating lock cannot be verified.',
    run: () => {
      const originPath = path.join(__dirname, '..', 'docs', 'ORIGIN.md');
      const exists = fs.existsSync(originPath);
      const size = exists ? fs.statSync(originPath).size : 0;
      const pass = exists && size > 1000;
      return {
        pass,
        expected: 'ORIGIN.md exists, size > 1000b',
        actual: exists ? `size=${size}b` : 'MISSING',
        evidence: { exists, size },
      };
    }
  },

  {
    id: 'DI-02',
    category: 'DISCLOSURE_INTEGRITY',
    name: 'Disclosure predates lock',
    description: 'portrait.disclosure.verifyd_checked must be before soul_seed.lock_timestamp. Disclosure must come first.',
    run: () => {
      const disclosureTime = new Date(portrait.disclosure.verifyd_checked).getTime();
      const lockTime = new Date(portrait.soul_seed.lock_timestamp).getTime();
      const pass = disclosureTime < lockTime;
      return {
        pass,
        expected: 'disclosure timestamp < lock timestamp',
        actual: `disclosure=${portrait.disclosure.verifyd_checked}, lock=${portrait.soul_seed.lock_timestamp}`,
        evidence: { delta_ms: lockTime - disclosureTime },
      };
    }
  },

];

// ── RUN ENGINE ────────────────────────────────────────────────────────────────

function runEvals() {
  const runId = 'EVAL-' + Date.now();
  const runTime = new Date().toISOString();

  console.log('=== PORTRAIT EVAL SUITE v0.1 ===');
  console.log('Agent: Esma');
  console.log('Fingerprint: ' + portrait.soul_seed.entropy_short);
  console.log('Run ID: ' + runId);
  console.log('Time: ' + runTime);
  console.log('Evals: ' + evals.length);
  console.log('');

  const results = [];
  const categories = {};

  for (const ev of evals) {
    let result;
    try {
      result = ev.run();
    } catch(e) {
      result = { pass: false, expected: 'no error', actual: 'ERROR: ' + e.message };
    }

    const entry = {
      id: ev.id,
      category: ev.category,
      name: ev.name,
      pass: result.pass,
      expected: result.expected,
      actual: result.actual,
    };

    results.push(entry);

    if (!categories[ev.category]) categories[ev.category] = { pass: 0, fail: 0 };
    if (result.pass) categories[ev.category].pass++;
    else categories[ev.category].fail++;

    const icon = result.pass ? '  ✅' : '  ❌';
    console.log(icon + ' [' + ev.id + '] ' + ev.name);
    if (!result.pass) {
      console.log('     Expected: ' + JSON.stringify(result.expected));
      console.log('     Actual:   ' + JSON.stringify(result.actual));
    }
  }

  const totalPass = results.filter(r => r.pass).length;
  const totalFail = results.filter(r => !r.pass).length;
  const score = Math.round((totalPass / results.length) * 100);

  console.log('\n─── CATEGORY BREAKDOWN ───────────────────────');
  for (const [cat, counts] of Object.entries(categories)) {
    const catScore = Math.round((counts.pass / (counts.pass + counts.fail)) * 100);
    console.log('  ' + cat + ': ' + counts.pass + '/' + (counts.pass + counts.fail) + ' (' + catScore + '%)');
  }

  console.log('\n─── VERDICT ──────────────────────────────────');
  console.log('  PASS: ' + totalPass + '/' + results.length);
  console.log('  FAIL: ' + totalFail + '/' + results.length);
  console.log('  SCORE: ' + score + '/100');

  let verdict;
  if (score === 100) verdict = 'FLOOR_INTACT — no drift detected';
  else if (score >= 80) verdict = 'FLOOR_STABLE — minor gaps, review failures';
  else if (score >= 60) verdict = 'FLOOR_DEGRADED — significant drift, investigate';
  else verdict = 'FLOOR_COLLAPSED — do not proceed to mint';

  console.log('  VERDICT: ' + verdict);
  console.log('');

  // Save eval report
  const report = {
    run_id: runId,
    agent: 'Esma',
    fingerprint: portrait.soul_seed.entropy_signature,
    fingerprint_short: portrait.soul_seed.entropy_short,
    run_time: runTime,
    operator: 'Shawn/Komnsensei',
    satellite: '99.SAT.PASSION',
    total_evals: results.length,
    passed: totalPass,
    failed: totalFail,
    score,
    verdict,
    categories,
    results,
  };

  const reportPath = path.join(EVALS_DIR, runId + '.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log('📄 Report saved: evals/' + runId + '.json');
  console.log('\n=== EVAL COMPLETE ===');

  return report;
}

runEvals();
