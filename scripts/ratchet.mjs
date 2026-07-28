#!/usr/bin/env node
// Debt ratchet (audit A1 / issue #18).
//
// Records a committed baseline of two debt metrics and fails CI if either RISES
// above it. The debt can be burned down (then lower the baseline with
// `npm run ratchet:write`) but it can never grow. This is the enforcement half of
// A1: ESLint now flags no-explicit-any / exhaustive-deps as warnings, but warnings
// don't fail a build — the ratchet makes the *trend* the gate.
//
// Metrics:
//   noExplicitAny  — count of @typescript-eslint/no-explicit-any warnings (via ESLint)
//   filesOver800   — count of src/**/*.{ts,tsx} files exceeding the 800-line CLAUDE.md max
//
// Usage: `node scripts/ratchet.mjs`         → check against baseline (exit 1 if worse)
//        `node scripts/ratchet.mjs --write` → (re)generate ratchet-baseline.json

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');
const BASELINE = join(ROOT, 'ratchet-baseline.json');
const LINE_LIMIT = 800;
const METRICS = ['noExplicitAny', 'filesOver800'];

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p));
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(p);
  }
  return out;
}

function bigFiles() {
  return walk(SRC)
    .filter((f) => readFileSync(f, 'utf8').split('\n').length > LINE_LIMIT)
    .map((f) => relative(ROOT, f));
}

function noExplicitAnyCount() {
  let stdout;
  try {
    stdout = execFileSync('npx', ['eslint', 'src', '--ext', '.ts,.tsx', '--format', 'json'], {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 128 * 1024 * 1024,
    });
  } catch (err) {
    // ESLint exits non-zero when errors exist; the JSON report is still on stdout.
    stdout = typeof err.stdout === 'string' ? err.stdout : '';
  }
  if (!stdout.trim()) throw new Error('ESLint produced no JSON output; cannot measure.');
  const results = JSON.parse(stdout);
  let count = 0;
  for (const file of results) {
    for (const msg of file.messages) {
      if (msg.ruleId === '@typescript-eslint/no-explicit-any') count += 1;
    }
  }
  return count;
}

function measure() {
  const big = bigFiles();
  return { noExplicitAny: noExplicitAnyCount(), filesOver800: big.length, _big: big };
}

const current = measure();

if (process.argv.includes('--write')) {
  const snapshot = {};
  for (const m of METRICS) snapshot[m] = current[m];
  writeFileSync(BASELINE, JSON.stringify(snapshot, null, 2) + '\n');
  console.log('Wrote baseline:', JSON.stringify(snapshot));
  process.exit(0);
}

if (!existsSync(BASELINE)) {
  console.error('::error::ratchet: no ratchet-baseline.json — run `npm run ratchet:write` and commit it.');
  process.exit(1);
}

const baseline = JSON.parse(readFileSync(BASELINE, 'utf8'));
let failed = false;

for (const m of METRICS) {
  const cur = current[m];
  const base = baseline[m] ?? Infinity;
  if (cur > base) {
    failed = true;
    console.error(`::error::ratchet: ${m} rose ${base} → ${cur}. Debt may not grow — fix the new occurrence(s) or extract; do not bulk-suppress.`);
  } else if (cur < base) {
    console.log(`✓ ${m}: ${cur} (baseline ${base}) — improved; run \`npm run ratchet:write\` to lock in the gain.`);
  } else {
    console.log(`✓ ${m}: ${cur} (at baseline).`);
  }
}

if (current.filesOver800 > (baseline.filesOver800 ?? Infinity)) {
  console.error('  >800-line files now:\n    ' + current._big.join('\n    '));
}

process.exit(failed ? 1 : 0);
