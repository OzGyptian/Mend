# Onboarding — getting set up to build Mend

This guide gets a second developer from zero to a running local Mend, plus the day-to-day
workflow two people share. It assumes you'll use **Claude Code** as your AI pair.

> **The one-line mental model:** everything you need is in this repo plus a set of secrets
> pulled from Vercel. Your personal global config is irrelevant here — the repo's own
> `.claude/` rulebook governs how Claude behaves on Mend, identically for both of us.

---

## 1. Access you need (Bernard grants these — 4 invitations)

You can't `git clone` or run the app until these land. Bernard sends them; you accept.

| # | System | What it's for | You'll get… |
|---|--------|---------------|-------------|
| 1 | **GitHub** — `OzGyptian/Mend` | The code | Collaborator (push) invite by email |
| 2 | **Vercel** — the Mend project/team | Deploys + `vercel env pull` (your secrets) | Team invite |
| 3 | **Supabase** — `mend-migration-scratch` org | The database (synthetic data) | Org member invite |
| 4 | **Firebase** — the Mend project | Auth + the accept-invite path | Project member invite |

> Data note: the Supabase/Firebase data here is **synthetic/scratch only** — no real
> customer data. See CLAUDE.md's data-sensitivity section.

---

## 2. Tools to install (once, on your machine)

- **Node via nvm** — the repo pins the version in `.nvmrc` (currently Node 20).
- **Vercel CLI** — `npm i -g vercel`
- **Supabase CLI** — for migrations (`brew install supabase/tap/supabase` or see their docs)
- **Claude Code** — installed and signed in

---

## 3. First-time setup (6 commands)

```bash
git clone https://github.com/OzGyptian/Mend.git
cd Mend
nvm use                     # picks up Node 20 from .nvmrc  (nvm install if prompted)
npm ci                      # exact dependencies from the lockfile
vercel link                 # connect this folder to the Mend Vercel project
vercel env pull .env.local  # materialise secrets locally (this file is gitignored)
npm run dev                 # → http://localhost:3000
```

If `npm run dev` serves the app at `localhost:3000`, you're in.

> Prefer not to use Vercel for secrets? You can instead `cp .env.example .env.local` and
> fill in the values by hand — `.env.example` documents every variable.

---

## 4. Verify your environment is correct

```bash
npm run lint      # type-check — must pass
npm run test      # unit suite — must pass
./scripts/verify-standalone.sh   # end-to-end check that the repo is self-contained
```

Green across all three = your setup matches CI.

---

## 5. The daily workflow (how the two of us stay out of each other's way)

```
1. Start of session:   git switch main && git pull --rebase origin main
2. New work:           git switch -c feat/<you>-<short-desc>
3. Code with Claude:   it automatically follows this repo's .claude/ rulebook
4. Local gate:         npm run lint && npm run test
5. Push:               git push -u origin HEAD     → a Vercel PREVIEW URL appears
6. Open a PR:          the template + CI run automatically
7. Merge when green:   squash-merge → lands as ONE commit on main → deploys to prod
```

**Cadence — merge little and often.** A branch should live **hours to a couple of days,
never a week.** Rebase on `main` at the start of every session. We integrate on `main`
continuously, *not* in a big batch before a call — that's what keeps merges trivial.

**Branch naming:** `feat/<owner>-<desc>` (e.g. `feat/tarek-risk-export`) so ownership is
obvious at a glance.

---

## 6. Ownership lanes (fewest collisions)

We each mostly own an area, to keep two people off the same files:

<!-- TODO: Bernard + Tarek confirm this split, then remove this note. -->

| Developer | Primary areas |
|-----------|---------------|
| **Bernard** | `src/platform/*`, procurement, EAC, phasing |
| **Tarek** | risk, progress, changes, subcontracts |
| **Shared hot files** | `src/App.tsx`, `src/types.ts` — give a heads-up in the PR; keep edits small and additive |

---

## 7. Database changes — the one rule that matters

We share **one** Supabase database. So:

1. **Every schema change is a migration file** in `supabase/migrations/` — never a manual
   edit in the Supabase Studio SQL editor. (This caused a real breakage, incident P3-0.)
2. **Tell the other developer.** Opening a PR that touches `supabase/migrations/` triggers
   the *DB change notify* workflow — it labels the PR `db-change` and @-mentions the other
   of us automatically. Don't rely only on that; a quick message is polite.
3. **Migrations reach the shared DB from `main`**, applied with `npx supabase db push`
   (ideally in CI), *after* merge — never from a feature branch.

If we start colliding on the shared DB often, that's the signal to graduate to
per-branch databases (Supabase Branching or local Postgres). Not needed yet.

---

## 8. Where the rules live

- **`CLAUDE.md`** — project conventions, architecture, the non-negotiable rules.
- **`.claude/`** — shared Claude Code config; `.claude/README.md` explains it.
- **`.claude/rules/`** — the engineering standards both of us (and both Claudes) follow.

Questions that aren't answered here belong in a GitHub Issue (that's our backlog) or a
quick catch-up — not in a private doc only one of us can see.
