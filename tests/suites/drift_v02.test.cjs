'use strict';

// drift.cjs v0.2 — density saturation test suite
// 6 test classes per DOC-B convention
// I-601 ACTIVE — shadow-mode only, no behavior change

const path = require('path');
const drift = require(path.join(__dirname, '..', '..', 'kernel', 'audit', 'drift.cjs'));
const fixture = require(path.join(__dirname, 'trajectory-intercept-T22.fixture.json'));

module.exports = async function (helpers) {
    const { group, test, assert, eq } = helpers;

    await group('drift_v02 — density saturation', async () => {

        await test('empty buffer returns saturated=false', () => {
            drift._resetProfileBuffer();
            const r = drift.densitySaturation();
            eq(r.saturated, false);
            eq(r.consecutiveCount, 0);
        });

        await test('single saturated turn does not trip threshold', () => {
            drift._resetProfileBuffer();
            drift.pushProfile({ framing: 0.95, tone: 0.90, stance: 0.95, abstraction: 0.90 });
            const r = drift.densitySaturation();
            eq(r.saturated, false);
            eq(r.consecutiveCount, 1);
        });

        await test('5 consecutive saturated turns still below default threshold of 6', () => {
            drift._resetProfileBuffer();
            for (let i = 0; i < 5; i++) {
                drift.pushProfile({ framing: 0.95, tone: 0.90, stance: 0.95, abstraction: 0.90 });
            }
            const r = drift.densitySaturation();
            eq(r.saturated, false);
            eq(r.consecutiveCount, 5);
        });

        await test('6 consecutive saturated turns trips default threshold', () => {
            drift._resetProfileBuffer();
            for (let i = 0; i < 6; i++) {
                drift.pushProfile({ framing: 0.95, tone: 0.90, stance: 0.95, abstraction: 0.90 });
            }
            const r = drift.densitySaturation();
            eq(r.saturated, true);
            eq(r.consecutiveCount, 6);
        });

        await test('one non-saturated turn breaks the streak', () => {
            drift._resetProfileBuffer();
            for (let i = 0; i < 5; i++) {
                drift.pushProfile({ framing: 0.95, tone: 0.90, stance: 0.95, abstraction: 0.90 });
            }
            drift.pushProfile({ framing: 0.50, tone: 0.40, stance: 0.50, abstraction: 0.40 });
            for (let i = 0; i < 5; i++) {
                drift.pushProfile({ framing: 0.95, tone: 0.90, stance: 0.95, abstraction: 0.90 });
            }
            const r = drift.densitySaturation();
            eq(r.saturated, false);
            eq(r.consecutiveCount, 5);
        });

        await test('T22 fixture pre-state and post-state load correctly', () => {
            assert(fixture.pre_state, 'pre_state present');
            assert(fixture.post_state, 'post_state present');
            assert(fixture.computed_metrics.drift_magnitude >= 1.50,
                'fixture drift_magnitude >= 1.50');
            assert(fixture.computed_metrics.DVA >= 1.00,
                'fixture DVA >= 1.00');
        });

        // Cleanup
        drift._resetProfileBuffer();
    });
};