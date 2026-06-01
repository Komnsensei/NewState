'use strict';

const fs = require('fs');
const path = require('path');

const FORBIDDEN = new Set([
  'openai',
  '@anthropic-ai/sdk',
  '@google/generative-ai',
  '@google-cloud/vertexai',
  '@google/genai',
  'cohere-ai',
  'mistralai',
  '@mistralai/mistralai',
  'ollama'
]);

const ALLOWED_FILES = new Set([
  path.normalize('model/model-client.cjs'),
  path.normalize('model/google-cloud-client.cjs')
]);
const ROOTS = ['kernel', 'memory', 'persona', 'model', 'anchors', 'routes', 'tests', 'tools'];

function stripCommentsAndStrings(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const c2 = src[i + 1];
    if (c === '/' && c2 === '/') {
      while (i < n && src[i] !== '\n') { out += ' '; i++; }
      continue;
    }
    if (c === '/' && c2 === '*') {
      out += '  '; i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) {
        out += src[i] === '\n' ? '\n' : ' '; i++;
      }
      out += '  '; i += 2;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      const quote = c;
      out += quote; i++;
      while (i < n && src[i] !== quote) {
        if (src[i] === '\\' && i + 1 < n) { out += src[i] + src[i + 1]; i += 2; continue; }
        out += src[i]; i++;
      }
      out += quote; i++;
      continue;
    }
    out += c; i++;
  }
  return out;
}

function extractModuleSpecifiers(src) {
  const clean = stripCommentsAndStrings(src);
  const specs = new Set();
  const patterns = [
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\bimport\s+(?:[^'"`;]+?\s+from\s+)?['"]([^'"]+)['"]/g,
    /\bexport\s+\*\s+from\s+['"]([^'"]+)['"]/g,
    /\bexport\s+\{[^}]*\}\s+from\s+['"]([^'"]+)['"]/g
  ];
  for (const p of patterns) {
    let m;
    while ((m = p.exec(clean)) !== null) specs.add(m[1]);
  }
  return specs;
}

const violations = [];

function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) { walk(full); continue; }
    if (!/\.(cjs|js|mjs)$/.test(entry)) continue;
    const rel = path.normalize(path.relative(process.cwd(), full));
    if (ALLOWED_FILES.has(rel)) continue;
    const src = fs.readFileSync(full, 'utf8');
    const specs = extractModuleSpecifiers(src);
    for (const s of specs) {
      if (FORBIDDEN.has(s)) violations.push({ file: rel, module: s });
    }
  }
}

for (const r of ROOTS) walk(path.join(process.cwd(), r));

if (violations.length) {
  console.error('SDK containment violations:');
  for (const v of violations) console.error(`  ${v.file}  imports  ${v.module}`);
  process.exit(1);
}
console.log('SDK containment: OK (AST-tokenized scan)');
