'use strict';

const fs = require('fs');
const path = require('path');

module.exports = async ({ test, assert, eq, group }) => {
  await group('mcp-server config & docs', async () => {
    const pkgPath = path.join(__dirname, '..', '..', 'mcp-server', 'package.json');
    const startPath = path.join(__dirname, '..', '..', 'mcp-server', 'start.sh');
    const readmePath = path.join(__dirname, '..', '..', 'mcp-server', 'README.md');
    const agentInstructionsPath = path.join(__dirname, '..', '..', 'AGENT_INSTRUCTIONS.md');
    const structuralDocPath = path.join(__dirname, '..', '..', 'docs', 'Structural-Identity-Framework-v1.md');

    await test('mcp-server/package.json: declares identity, entrypoint and scripts', () => {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      eq(pkg.name, 'newstate-notebook-mcp');
      eq(pkg.main, 'index.js');
      eq(pkg.type, 'commonjs');
      eq(pkg.scripts.start, 'node index.js');
      eq(pkg.scripts.dev, 'node --watch index.js');
      assert(pkg.engines && pkg.engines.node);
    });

    await test('mcp-server/package.json: declares the runtime dependencies used by the bridge', () => {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      for (const dep of ['ws', 'express', 'cors']) {
        assert(pkg.dependencies && pkg.dependencies[dep], `expected dependency "${dep}" to be declared`);
      }
    });

    await test('mcp-server/start.sh: fails fast and defaults port/host env vars', () => {
      const script = fs.readFileSync(startPath, 'utf8');
      assert(script.startsWith('#!/usr/bin/env bash'));
      assert(script.includes('set -euo pipefail'));
      assert(script.includes('MCP_PORT:-3100'));
      assert(script.includes('NEWSTATE_HTTP:-http://localhost:8080'));
      assert(script.includes('NOTEBOOK_ACCOUNT:-shawnru391@gmail.com'));
      assert(script.includes('exec node index.js'));
    });

    await test('mcp-server/start.sh: default NOTEBOOK_ACCOUNT matches notebook-bridge.js default ACCOUNT', () => {
      delete process.env.NOTEBOOK_ACCOUNT;
      delete require.cache[require.resolve('../../mcp-server/lib/notebook-bridge.js')];
      const bridge = require('../../mcp-server/lib/notebook-bridge.js');
      const script = fs.readFileSync(startPath, 'utf8');
      assert(script.includes(bridge.ACCOUNT));
    });

    await test('mcp-server/README.md: documents the accounts and port wired into the code defaults', () => {
      const readme = fs.readFileSync(readmePath, 'utf8');
      assert(readme.includes('shawnru391@gmail.com'));
      assert(readme.includes('passioncraftai@gmail.com'));
      assert(readme.includes('3100'));
      assert(readme.includes('newstate-notebook-mcp'));
    });

    await test('AGENT_INSTRUCTIONS.md: references the MCP bridge port and both configured accounts', () => {
      const doc = fs.readFileSync(agentInstructionsPath, 'utf8');
      assert(doc.includes('3100'));
      assert(doc.includes('shawnru391@gmail.com'));
      assert(doc.includes('passioncraftai@gmail.com'));
      assert(doc.includes('mcp-server/index.js'));
    });

    await test('Structural-Identity-Framework-v1.md: documents NAVIGATOR thresholds consistent with kernel/navigator/navigator.cjs', () => {
      delete require.cache[require.resolve('../../kernel/navigator/navigator.cjs')];
      const navigator = require('../../kernel/navigator/navigator.cjs');
      const doc = fs.readFileSync(structuralDocPath, 'utf8');
      assert(doc.includes('0.40'), 'GIR threshold should be documented');
      assert(doc.includes('0.60'), 'RCG/CDS threshold should be documented');
      assert(doc.includes('K=3'), 'K-turn projection should be documented');
      eq(navigator.THRESHOLDS.GIR, 0.40);
      eq(navigator.THRESHOLDS.CDS, 0.60);
      eq(navigator.K_PROJECTION, 3);
    });
  });
};