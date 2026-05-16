'use strict';

// Offline delta report generator.
//
// Calls kernel/audit/delta-report.cjs directly, without HTTP layer.
// Useful when a model is unavailable and the operator has run
// tools/shadow-harness.cjs to populate forensics.
//
// Adds a harnessMode summary if any events in the ledger were
// produced by the harness, so the operator knows how to interpret
// the report.
//
// Usage:
//   node tools/shadow-report.cjs                    (full ledger)
//   node tools/shadow-report.cjs --since <unix-ms>  (window from ts)
//   node tools/shadow-report.cjs --pretty           (indented JSON)
//   node tools/shadow-report.cjs --out report.json  (write to file)

if (!process.env.GEMINI_API_KEY) {
  process.env.GEMINI_API_KEY = 'harness-dummy-key-never-used';
}

const fs = require('fs');
const { forensics } = require('../kernel/forensics.cjs');
const deltaReport = require('../kernel/audit/delta-report.cjs');

function parseArgs(argv) {
  const args = { since: undefined, pretty: false, out: null };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--since' && argv[i + 1]) { args.since = Number(argv[i + 1]); i++; }
    else if (argv[i] === '--pretty') args.pretty = true;
    else if (argv[i] === '--out' && argv[i + 1]) { args.out = argv[i + 1]; i++; }
  }
  return args;
}

function summarizeHarness(filters) {
  const all = forensics.query(filters);
  const harness = all.filter(e => e.harnessMode === true);
  const live = all.length - harness.length;
  return {
    totalEvents: all.length,
    harnessEvents: harness.length,
    liveEvents: live,
    mixedLedger: harness.length > 0 && live > 0,
    mode: harness.length > 0 && live === 0 ? 'harness-only'
        : live > 0 && harness.length === 0 ? 'live-only'
        : harness.length > 0 ? 'mixed' : 'empty'
  };
}

function run() {
  const args = parseArgs(process.argv);
  const filters = args.since ? { since: args.since } : {};

  const harnessSummary = summarizeHarness(filters);
  const report = deltaReport.generate(filters);

  // Wrap report with provenance metadata.
  const wrapped = {
    ok: true,
    provenance: {
      generator: 'tools/shadow-report.cjs',
      mode: harnessSummary.mode,
      harnessEvents: harnessSummary.harnessEvents,
      liveEvents: harnessSummary.liveEvents,
      mixedLedger: harnessSummary.mixedLedger,
      warning: harnessSummary.mode === 'harness-only'
        ? 'All events harness-generated. Report reflects shadow component behavior on curated inputs, not real chat traffic.'
        : harnessSummary.mode === 'mixed'
        ? 'Ledger contains both harness and live events. Filter with --since or rotate forensics for a clean report.'
        : harnessSummary.mode === 'live-only'
        ? 'All events from real /chat traffic.'
        : 'Ledger empty.'
    },
    report
  };

  const json = args.pretty
    ? JSON.stringify(wrapped, null, 2)
    : JSON.stringify(wrapped);

  if (args.out) {
    fs.writeFileSync(args.out, json);
    console.error(`[shadow-report] written to ${args.out}`);
    console.error(`[shadow-report] mode: ${harnessSummary.mode}`);
    console.error(`[shadow-report] events: harness=${harnessSummary.harnessEvents} live=${harnessSummary.liveEvents}`);
  } else {
    process.stdout.write(json + '\n');
  }
}

run();