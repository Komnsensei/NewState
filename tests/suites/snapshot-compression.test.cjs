'use strict';
const path = require('path');
const fs = require('fs');

module.exports = async ({ test, assert, eq, group }) => {
  await group('snapshot compression', async () => {
    delete require.cache[require.resolve('../../kernel/snapshot.cjs')];
    const { newRequestId, writeBundle, readBundle, COMPRESS_THRESHOLD_BYTES, SNAPSHOT_ROOT }
      = require('../../kernel/snapshot.cjs');

    await test('small artifact stored uncompressed', () => {
      const rid = newRequestId();
      writeBundle(rid, { prompt: 'small' });
      const dir = path.join(SNAPSHOT_ROOT, rid);
      assert(fs.existsSync(path.join(dir, 'prompt.txt')));
      assert(!fs.existsSync(path.join(dir, 'prompt.txt.gz')));
    });

    await test('large artifact stored gzipped', () => {
      const rid = newRequestId();
      const big = 'x'.repeat(COMPRESS_THRESHOLD_BYTES + 100);
      writeBundle(rid, { prompt: big });
      const dir = path.join(SNAPSHOT_ROOT, rid);
      assert(fs.existsSync(path.join(dir, 'prompt.txt.gz')));
    });

    await test('readBundle reverses compression transparently', () => {
      const rid = newRequestId();
      const big = 'y'.repeat(COMPRESS_THRESHOLD_BYTES + 100);
      writeBundle(rid, { prompt: big, userMessage: 'q' });
      const b = readBundle(rid);
      eq(b.prompt.length, big.length);
      eq(b.userMessage, 'q');
    });
  });
};