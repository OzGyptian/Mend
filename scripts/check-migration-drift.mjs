#!/usr/bin/env node
// Migration drift check (RCA 2026-07-28, remediation #4).
//
// F3: the repo names migrations 0001..NNNN while the live ledger held 42 timestamp-named
// versions, with ZERO overlap. `supabase db push` therefore believed nothing had been
// applied and would have replayed every migration against the production database. The
// drift went unnoticed for 16 days because nothing ever compared the two.
//
// This compares `supabase migration list --linked` against supabase/migrations/*.sql and
// reports: pending (local, not applied), orphans (applied, no local file), and mismatched
// naming schemes. Exits non-zero on drift.
//
// Requires Supabase credentials, so it is a LOCAL pre-push check, not a CI gate — the same
// constraint that keeps test:postgres out of CI (see issue #26).
//
//   npm run db:drift

import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';

function fail(msg) {
  console.error(`\n✖ ${msg}`);
  process.exit(1);
}

let raw;
try {
  raw = execFileSync('npx', ['supabase', 'migration', 'list', '--linked'], {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
} catch (err) {
  fail(
    'could not read the remote migration list. Is the project linked and are credentials available?\n' +
      String(err.stderr || err.message).slice(0, 300),
  );
}

const jsonLine = raw
  .trim()
  .split('\n')
  .reverse()
  .find((l) => l.trim().startsWith('{'));
if (!jsonLine) fail('unexpected output from `supabase migration list` (no JSON found).');

const migrations = JSON.parse(jsonLine).migrations ?? [];
const localFiles = readdirSync('supabase/migrations')
  .filter((f) => f.endsWith('.sql'))
  .map((f) => f.slice(0, 4))
  .sort();

const pending = migrations.filter((m) => m.local && !m.remote).map((m) => m.local);
const orphans = migrations.filter((m) => m.remote && !m.local).map((m) => m.remote);
const matched = migrations.filter((m) => m.local && m.remote).length;

console.log(`local migration files : ${localFiles.length}`);
console.log(`applied & matched     : ${matched}`);
console.log(`pending (not applied) : ${pending.length}${pending.length ? ` -> ${pending.join(', ')}` : ''}`);
console.log(`orphans (no local file): ${orphans.length}${orphans.length ? ` -> ${orphans.slice(0, 5).join(', ')}${orphans.length > 5 ? ' …' : ''}` : ''}`);

if (orphans.length) {
  fail(
    `${orphans.length} applied migration(s) have no local file — the ledger and the repo have diverged.\n` +
      `  This is the F3 condition: \`db push\` may try to replay everything.\n` +
      `  Fix: verify the schema state first, then reconcile with\n` +
      `    supabase migration repair --status applied <local versions>\n` +
      `    supabase migration repair --status reverted <orphan versions>\n` +
      `  Never run \`supabase db pull\` to "fix" this — it overwrites local history.`,
  );
}

if (pending.length) {
  console.log(
    `\n⚠ ${pending.length} migration(s) committed but not applied: ${pending.join(', ')}\n` +
      `  Apply with \`npx supabase db push\` (and remember: code and migration ship together).`,
  );
  process.exit(2);
}

console.log('\n✓ no drift: every local migration is applied, and nothing is applied that is not in the repo.');
