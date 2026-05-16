'use strict';

function tokenize(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function jaccard(a, b) {
  if (!a.length && !b.length) return 1;
  const A = new Set(a), B = new Set(b);
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  const union = A.size + B.size - inter;
  return union === 0 ? 1 : inter / union;
}

function lexical(a, b) {
  return jaccard(tokenize(a), tokenize(b));
}

function shapeProfile(text) {
  const s = String(text || '');
  const paras = s.split(/\n\s*\n/).filter(Boolean);
  const sents = s.split(/[.!?]+\s+/).filter(Boolean);
  const lines = s.split('\n');
  return {
    paraCount:     paras.length,
    sentCount:     sents.length,
    avgSentLen:    sents.length ? sents.reduce((a, x) => a + x.length, 0) / sents.length : 0,
    listLines:     lines.filter(l => /^\s*([-*+]|\d+\.)\s/.test(l)).length,
    codeLines:     lines.filter(l => /^\s*```/.test(l)).length,
    questionLines: lines.filter(l => /\?\s*$/.test(l)).length
  };
}

function normalize(v, key) {
  const caps = {
    paraCount: 20, sentCount: 40, avgSentLen: 200,
    listLines: 30, codeLines: 20, questionLines: 20
  };
  const c = caps[key] || 1;
  return Math.min(1, v / c);
}

function structural(a, b) {
  const sa = shapeProfile(a);
  const sb = shapeProfile(b);
  const keys = ['paraCount', 'sentCount', 'avgSentLen', 'listLines', 'codeLines', 'questionLines'];
  let dist = 0;
  for (const k of keys) {
    const va = normalize(sa[k], k);
    const vb = normalize(sb[k], k);
    dist += Math.abs(va - vb);
  }
  return Math.max(0, 1 - dist / keys.length);
}

const STOPWORDS = new Set(('a an the of to in on for with and or but if while is are was were be been being this that these those it as by at from into about over under').split(' '));

function semantic(a, b) {
  const ca = tokenize(a).filter(t => !STOPWORDS.has(t));
  const cb = tokenize(b).filter(t => !STOPWORDS.has(t));
  return jaccard(ca, cb);
}

function decompose(a, b) {
  return Object.freeze({
    lexical:    lexical(a, b),
    structural: structural(a, b),
    semantic:   semantic(a, b),
    method:     'phase5-lexical-proxy',
    note:       'semantic axis is content-word jaccard; embedding-based upgrade is future work'
  });
}

module.exports = { decompose, lexical, structural, semantic, shapeProfile };