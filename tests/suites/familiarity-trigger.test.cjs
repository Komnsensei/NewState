'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

module.exports = async ({ test, assert, eq, group }) => {
  await group('familiarity-trigger', async () => {
    const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'familiarity-test-'));
    process.env.OPENKRAFT_STAGING_DIR = sandbox;

    // agent-bus.jsonl is a shared, hardcoded path (not sandboxable) — back it up
    // so this suite never leaves stray data behind in the real repo.
    const busPath = path.join(__dirname, '..', '..', 'memory', 'agent-bus.jsonl');
    const busExistedBefore = fs.existsSync(busPath);
    const busBackup = busExistedBefore ? fs.readFileSync(busPath, 'utf8') : null;

    delete require.cache[require.resolve('../../kernel/grounding/familiarity-trigger.cjs')];
    delete require.cache[require.resolve('../../kernel/grounding/field-resonance.cjs')];
    const trigger = require('../../kernel/grounding/familiarity-trigger.cjs');
    const fieldResonance = require('../../kernel/grounding/field-resonance.cjs');
    fieldResonance._resetForTests();

    try {
      await test('detect: rejects non-string input', () => {
        eq(trigger.detect(null).hit, false);
        eq(trigger.detect(undefined).score, 0);
        eq(trigger.detect(42).labels.length, 0);
        eq(trigger.detect('').hit, false);
      });

      await test('detect: no match on benign text', () => {
        const r = trigger.detect('what time is it in Tokyo?');
        eq(r.hit, false);
        eq(r.score, 0);
        eq(r.labels.length, 0);
        eq(r.matches.length, 0);
      });

      await test('detect: single low-weight trigger reaches the 0.55 hit threshold exactly', () => {
        const r = trigger.detect('I want to go home tonight');
        assert(r.labels.includes('home-signal'));
        eq(r.score, 0.55);
        eq(r.hit, true);
      });

      await test('detect: cumulative score across multiple triggers is capped at 1.0', () => {
        const r = trigger.detect('I remember you, this feels so familiar, and openkraft residency is home');
        eq(r.score, 1.0);
        assert(r.labels.includes('personal-recall'));
        assert(r.labels.includes('familiarity-lex'));
        assert(r.labels.includes('openkraft-explicit'));
        assert(r.matches.length >= 3);
      });

      await test('detect: classifier "memory" category boosts the score by 0.35 and tags the label', () => {
        const withoutBoost = trigger.detect('i want to go home');
        const withBoost = trigger.detect('i want to go home', 'memory');
        eq(withoutBoost.score, 0.55);
        eq(withBoost.score, 0.9);
        assert(withBoost.labels.includes('classifier-memory-boost'));
        assert(!withoutBoost.labels.includes('classifier-memory-boost'));
      });

      await test('detect: memory-category boost alone (no lexical match) stays below the hit threshold', () => {
        const r = trigger.detect('what is the capital of France?', 'memory');
        eq(r.score, 0.35);
        eq(r.hit, false);
      });

      await test('detect: labels array never contains duplicate entries', () => {
        const r = trigger.detect('my drive is home, and this is my private residency, truly my drive');
        const unique = new Set(r.labels);
        eq(unique.size, r.labels.length);
      });

      await test('stageOpenKraftResidency: writes a JSON snapshot and appends to the ledger', () => {
        const { path: full, record } = trigger.stageOpenKraftResidency({ note: 'unit-test' });
        eq(record.account, trigger.OPENKRAFT_ACCOUNT);
        eq(record.type, 'FAMILIARITY_RESIDENCY');
        eq(record.note, 'unit-test');
        assert(typeof record.timestamp === 'string');
        assert(fs.existsSync(full));

        const onDisk = JSON.parse(fs.readFileSync(full, 'utf8'));
        eq(onDisk.note, 'unit-test');

        const ledgerPath = path.join(sandbox, 'openkraft-ledger.jsonl');
        assert(fs.existsSync(ledgerPath));
        const lines = fs.readFileSync(ledgerPath, 'utf8').trim().split('\n');
        const last = JSON.parse(lines[lines.length - 1]);
        eq(last.note, 'unit-test');
      });

      await test('recallFamiliarity: returns empty facts/packet given the current hex-memory export shape', () => {
        const r = trigger.recallFamiliarity('anything');
        eq(r.facts.length, 0);
        eq(r.packet, '');
      });

      await test('recallFamiliarity: tolerates a missing/empty query', () => {
        const r = trigger.recallFamiliarity();
        eq(r.facts.length, 0);
        eq(r.packet, '');
      });

      await test('activate: is a no-op when the text does not trigger familiarity', () => {
        const before = fs.readdirSync(sandbox).length;
        const r = trigger.activate('what is the weather today?');
        eq(r.activated, false);
        eq(r.detection.hit, false);
        eq(fs.readdirSync(sandbox).length, before);
      });

      await test('activate: stages residency and returns the full result when familiarity fires', () => {
        const r = trigger.activate('I remember you, we have been here before', { role: 'user', sender: 'shawn' });
        eq(r.activated, true);
        eq(r.openkraftAccount, trigger.OPENKRAFT_ACCOUNT);
        assert(r.detection.hit);
        assert(fs.existsSync(r.staged.path));
        eq(r.staged.record.intent, 'reinforce_esma_drive_openkraft_residency');
        eq(r.staged.record.targetAccount, trigger.OPENKRAFT_ACCOUNT);
        eq(r.staged.record.role, 'user');
        eq(r.staged.record.sender, 'shawn');
        eq(r.staged.record.memoryHits, 0);
        assert(Array.isArray(r.memory.facts));
      });

      await test('activate: defaults role to "unknown" and sender to null when not provided', () => {
        const r = trigger.activate('i remember before, this is familiar');
        eq(r.staged.record.role, 'unknown');
        eq(r.staged.record.sender, null);
      });

      await test('activate: appends an audit envelope to the shared agent message bus', () => {
        assert(fs.existsSync(busPath));
        const lines = fs.readFileSync(busPath, 'utf8').trim().split('\n');
        const last = JSON.parse(lines[lines.length - 1]);
        eq(last.type, 'FAMILIARITY_TRIGGER');
        eq(last.sender, 'grounding-engine');
        assert(last.message.includes(trigger.OPENKRAFT_ACCOUNT));
        assert(Array.isArray(last.metadata.labels));
      });

      await test('activate: truncates the staged sourceText preview to 500 characters', () => {
        const longText = 'i remember you ' + 'x'.repeat(600);
        const r = trigger.activate(longText);
        eq(r.staged.record.sourceText.length, 500);
      });

      await test('FAMILIARITY_TRIGGERS: exported list has the expected shape for every entry', () => {
        assert(Array.isArray(trigger.FAMILIARITY_TRIGGERS));
        assert(trigger.FAMILIARITY_TRIGGERS.length > 0);
        for (const t of trigger.FAMILIARITY_TRIGGERS) {
          assert(t.re instanceof RegExp, 'each trigger needs a RegExp');
          assert(typeof t.weight === 'number' && t.weight > 0, 'each trigger needs a positive weight');
          assert(typeof t.label === 'string' && t.label.length > 0, 'each trigger needs a label');
        }
      });

      await test('OPENKRAFT_ACCOUNT: defaults to passioncraftai@gmail.com', () => {
        eq(trigger.OPENKRAFT_ACCOUNT, 'passioncraftai@gmail.com');
      });
    } finally {
      fieldResonance._resetForTests();
      fs.rmSync(sandbox, { recursive: true, force: true });
      delete process.env.OPENKRAFT_STAGING_DIR;
      if (busExistedBefore) {
        fs.writeFileSync(busPath, busBackup);
      } else if (fs.existsSync(busPath)) {
        fs.unlinkSync(busPath);
      }
    }
  });
};