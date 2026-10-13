#!/usr/bin/env node
// Are there branches left behind, and is any of them holding work that main does not have?
//
// The session checklist used to answer this with `git log main..<branch>`, and that command cannot
// answer it. Every pull request here is squash-merged, which gives the merged work a new commit
// identity, so the original commits never appear in main even though every line of them did. On
// 15 September that reported 38 branches of "unmerged work" when the true number was zero, and a
// check that cries wolf is a check nobody runs — which is how 38 branches accumulated in the first
// place.
//
// This asks the question three ways and only calls a branch safe when one of them proves it:
//   1. patch-id — `git cherry` finds every commit already in main whatever its identity
//   2. the pull request — a branch whose PR is MERGED is merged, however the merge was performed
//   3. the diff — a branch whose three-dot diff against main is empty holds nothing unique
// Anything none of those can prove is left alone and reported for a person to decide.
//
// Named .cjs, not .js, so it runs whether or not the project it sits in declares "type": "module".
// Found the hard way: it threw on the first project it was copied into.
//
// Usage:  npm run branches          report only
//         npm run branches:prune    delete the ones proven merged, local and remote
'use strict';
const { execSync } = require('child_process');

const lines = (s) => (s ? s.split('\n').filter(Boolean) : []);
const sh = (cmd, quiet) => {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: quiet ? ['ignore', 'pipe', 'ignore'] : undefined }).trim();
  } catch {
    return '';
  }
};

const PRUNE = process.argv.includes('--prune');
const MAIN = 'main';

// Branches that are a place, not a piece of work. A deployment branch sits behind main by design, so
// every "is it merged" test says yes and every cleanup tool offers to delete it. Caught on WWTXSales,
// whose `production` branch is one commit behind main and updated the same day: this script called it
// finished with. Extend the list per repo with: git config branches.protect "uat,demo"
const PROTECTED = new Set(
  ['main', 'master', 'production', 'prod', 'staging', 'stage', 'develop', 'development', 'trunk', 'live']
    .concat(lines(sh('git config --get branches.protect', true).split(',').join('\n')).map((x) => x.trim()))
    .filter(Boolean)
);
const isProtected = (name) => PROTECTED.has(name) || /^(release|hotfix)\//.test(name);
const hasGh = !!sh('command -v gh', true);

const current = sh('git rev-parse --abbrev-ref HEAD');
if (PRUNE && current !== MAIN) {
  console.error(`On ${current}. Switch to ${MAIN} before pruning, so nothing deletes the branch you are standing on.`);
  process.exit(1);
}

// One call for every pull request, rather than one per branch.
const prState = new Map();
if (hasGh) {
  const raw = sh('gh pr list --state all --limit 400 --json number,state,headRefName', true);
  if (raw) {
    try {
      JSON.parse(raw).forEach((p) => {
        const seen = prState.get(p.headRefName);
        if (!seen || p.state === 'MERGED') prState.set(p.headRefName, { number: p.number, state: p.state });
      });
    } catch { /* gh not logged in, or offline: fall back to the git-only tests */ }
  }
}

function verdict(ref, name, where) {
  if (isProtected(name)) return { safe: false, protectedBranch: true, how: 'a long-lived branch, not a piece of work' };
  // The branch you are standing on is where you are working, even when it carries nothing yet.
  if (where === 'local' && name === current) return { safe: false, protectedBranch: true, how: 'the branch you are on' };
  const pr = prState.get(name);
  // A branch with a pull request still open is work in progress, even when it has nothing on it yet —
  // a branch opened a minute ago has no commits and would otherwise read as finished with.
  if (pr && pr.state === 'OPEN') return { safe: false, how: `PR #${pr.number} is still open` };
  if (!lines(sh(`git cherry ${MAIN} ${ref}`)).some((l) => l.startsWith('+'))) {
    return { safe: true, how: 'every commit is already in main' };
  }
  if (pr && pr.state === 'MERGED') return { safe: true, how: `squash-merged as PR #${pr.number}`, pr: pr.number };
  if (!sh(`git diff ${MAIN}...${ref} --stat`)) return { safe: true, how: 'holds no change main lacks' };
  if (pr) return { safe: false, how: `PR #${pr.number} is ${pr.state}` };
  return { safe: false, how: hasGh ? 'no pull request, and it has changes main does not' : 'changes main does not have (could not reach GitHub to check for a pull request)' };
}

sh('git fetch --prune -q', true);

// Work hides in stashes too. Two sat here for four days, from branches long since merged, holding
// changes that would have conflicted with everything done since. Nothing reports them unless asked.
const stashes = lines(sh('git stash list')).map((l, i) => {
  const when = sh(`git log -1 --format=%ad --date=short "stash@{${i}}"`, true);
  const files = lines(sh(`git stash show --name-only "stash@{${i}}"`, true)).length;
  return { i, when, files, label: l.split(': ').slice(1).join(': ') };
});

const locals = lines(sh(`git branch --format='%(refname:short)'`)).filter((b) => b !== MAIN);
const remotes = lines(sh(`git ls-remote --heads origin`))
  .map((l) => l.split('\t')[1].replace('refs/heads/', ''))
  .filter((b) => b !== MAIN);

const report = [];
for (const b of locals) report.push({ where: 'local', name: b, ref: b, sha: sh(`git rev-parse --short ${b}`), ...verdict(b, b, 'local') });
for (const b of remotes) {
  const ref = `origin/${b}`;
  if (!sh(`git rev-parse --verify -q ${ref}`, true)) continue;
  report.push({ where: 'remote', name: b, ref, sha: sh(`git rev-parse --short ${ref}`), ...verdict(ref, b, 'remote') });
}

const safe = report.filter((r) => r.safe);
const held = report.filter((r) => r.protectedBranch);
const keep = report.filter((r) => !r.safe && !r.protectedBranch);

function reportStashes() {
  if (!stashes.length) return;
  const old = stashes.filter((x) => (Date.now() - Date.parse(x.when)) / 86400000 > 2);
  console.log(`\n${stashes.length} stash${stashes.length === 1 ? '' : 'es'}${old.length ? `, ${old.length} more than two days old` : ''}:`);
  stashes.forEach((x) => console.log(`  stash@{${x.i}}  ${x.when}  ${String(x.files).padStart(3)} files  ${x.label}`));
  console.log('  A stash is invisible to every other check. Look at one with: git stash show -p "stash@{0}"');
  console.log('  Keep it as a file before dropping it: git stash show -p "stash@{0}" > ~/Downloads/stash.patch');
}

if (!report.length) {
  console.log(`Only ${MAIN}, here and on the server. Nothing to clean up.`);
  reportStashes();
  process.exit(0);
}

console.log(`${report.length} branch${report.length === 1 ? '' : 'es'} besides ${MAIN}: ${safe.length} finished with, ${keep.length} needing a decision${held.length ? `, ${held.length} left alone as long-lived` : ''}.\n`);

if (held.length) {
  console.log('LEFT ALONE:');
  held.forEach((r) => console.log(`  ${r.where.padEnd(6)} ${r.name.padEnd(52)} ${r.sha}  ${r.how}`));
  console.log('');
}

if (keep.length) {
  console.log('NEEDS A DECISION — merge it, cherry-pick what matters, or delete it deliberately:');
  keep.forEach((r) => console.log(`  ${r.where.padEnd(6)} ${r.name.padEnd(52)} ${r.sha}  ${r.how}`));
  console.log('');
}

if (!safe.length) process.exit(keep.length ? 1 : 0);

if (!PRUNE) {
  console.log('FINISHED WITH — safe to delete:');
  safe.forEach((r) => console.log(`  ${r.where.padEnd(6)} ${r.name.padEnd(52)} ${r.sha}  ${r.how}`));
  console.log(`\nDelete them with: npm run branches:prune`);
  reportStashes();
  process.exit(0);
}

console.log('Deleting, and how to get each one back:');
let gone = 0;
for (const r of safe) {
  const ok = r.where === 'local'
    ? sh(`git branch -D ${r.name}`, true) !== '' || !sh(`git rev-parse --verify -q ${r.name}`, true)
    : (sh(`git push origin --delete ${r.name} -q`, true), !sh(`git ls-remote --heads origin ${r.name}`, true));
  if (!ok) { console.log(`  could not delete ${r.where} ${r.name}`); continue; }
  gone += 1;
  const back = r.pr ? `git fetch origin pull/${r.pr}/head:${r.name}` : `git branch ${r.name} ${r.sha}`;
  console.log(`  ${r.where.padEnd(6)} ${r.name.padEnd(52)} ← ${back}`);
}
console.log(`\n${gone} deleted. ${keep.length ? `${keep.length} left for you to decide on.` : 'Nothing left but main.'}`);
reportStashes();
