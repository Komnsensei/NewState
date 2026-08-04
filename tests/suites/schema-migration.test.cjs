'use strict';
const { migrate, SCHEMA_VERSION, channelOf } = require('../../kernel/schemas/event-schemas.cjs');
module.exports = async ({ test, assert, eq, group }) => {
  await group('schema-migration', async () => {
    await test('v1 event (no schemaVersion) migrates to current', () => {
      const v1 = { ts: 1, type: 'GROUNDING_INTERVENTION', pattern: 'x', original: 'x' };
      const m = migrate(v1);
      eq(m.schemaVersion, SCHEMA_VERSION);
      eq(m.channel, 'semantic');
      assert(typeof m.migratedFrom === 'number');
    });
    await test('v2 event migrates forward to v3', () => {
      const v2 = { ts: 1, type: 'RECURSION_SPIKE', depth: 1, schemaVersion: 2 };
      const m = migrate(v2);
      eq(m.schemaVersion, SCHEMA_VERSION);
      eq(m.migratedFrom, 2);
    });
    await test('current-version event passes through unchanged', () => {
      const m = migrate({ ts: 1, type: 'RECURSION_SPIKE', depth: 4, schemaVersion: SCHEMA_VERSION });
      eq(m.schemaVersion, SCHEMA_VERSION);
      assert(!('migratedFrom' in m));
    });
    await test('channelOf returns runtime/semantic correctly', () => {
      eq(channelOf('RECURSION_SPIKE'), 'runtime');
      eq(channelOf('GROUNDING_INTERVENTION'), 'semantic');
      eq(channelOf('SHADOW_OBSERVATION'), 'semantic');
      eq(channelOf('NOPE'), 'unknown');
    });
  });
};
