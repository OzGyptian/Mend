# Onboarding — getting set up to build Mend

This is the shared reference for how two people build Mend together: the access model, the
daily workflow, ownership lanes, and the one database rule. It assumes you use **Claude Code**
as your AI pair.

> **New developer?** For a full, click-by-click walkthrough (no command-line experience
> assumed), follow **`GETTING_STARTED_TAREK.md`** — it's the step-by-step version of §1–§4
> below. This file is the concise "how we work" reference.

> **The one-line mental model:** everything you need is in this repo. Your development
> environment runs in the cloud (GitHub Codespaces) and opens in a browser, so it's identical
> on any machine. The repo's own `.claude/` rulebook governs how Claude behaves on Mend,
> identically for both of us.

---

## 1. Access model (Model B — Bernard owns the platform, you build on it)

We deliberately keep platform/infrastructure ownership with one person, so a second developer
can build features without being able to break shared infrastructure. In practice that means
**you need far less than a full set of platform invites.**

| System | Do you need access? | Why |
|--------|---------------------|-----|
| **GitHub** — `OzGyptian/Mend` | ✅ **Yes** — collaborator invite | Push code, open PRs. This is the one invite that matters. |
| **GitHub Codespaces** | ✅ Comes free with the repo | Your whole dev environment, in the browser. Secrets are injected automatically (Bernard sets them once — see `.devcontainer/SETUP_NOTES.md`). |
| **Vercel** | ❌ No | Preview deploys build automatically on every PR via the GitHub app — no Vercel login needed. |
| **Supabase** | ❌ No (Model B) | You build against the existing database via the injected connection keys. You don't manage the project or run migrations — Bernard does. |
| **Firebase** | ❌ No | The client auth config is committed and public; you just sign in to the app. |

> Data note: the Supabase data here is **synthetic/scratch only** — no real customer data. See
> CLAUDE.md's data-sensitivity section.

---

## 2. How you work — Codespaces (primary), local (optional)

- **Primary:** open a **Codespace** from the green **Code → Codespaces** button on the repo.
  Everything is pre-installed (Node 20, deps, Claude Code) and secrets are injected. Works the
  same on a work laptop (browser only) or a home laptop.
- **Optional (local):** a full local checkout is possible for speed/offline work. On macOS use
  `nvm`; on Windows the clean path is **WSL2**. Not required — Codespaces covers everything.
  See the appendix in `GETTING_STARTED_TAREK.md`.

---

## 3. First run (in a Codespace)

```bash
npm ci        # already run for you on Codespace create
npm run dev   # → click the forwarded-port pop-up to open the app
```

If the app loads, you're in. (In a local checkout, add a `.env.local` first — Codespaces
injects it automatically.)

---

## 4. Verify your environment

```bash
npm run lint      # type-check + eslint — must pass
npm run test      # unit suite — must pass
```

Green on both = your setup matches CI.

---

## 5. The daily workflow (how the two of us stay out of each other's way)

```
1. Start of session:   git switch main && git pull --rebase origin main
2. New work:           git switch -c feat/<you>-<short-desc>
3. Code with Claude:   it automatically follows this repo's .claude/ rulebook
4. Local gate:         npm run lint && npm run test
5. Push:               git push -u origin HEAD     → a Vercel PREVIEW URL appears on the PR
6. Open a PR:          the template + CI run automatically
7. Merge when green:   squash-merge → lands as ONE commit on main → deploys to prod
```

**Cadence — merge little and often.** A branch should live **hours to a couple of days, never
a week.** Rebase on `main` at the start of every session. We integrate on `main` continuously,
*not* in a big batch before a call — that's what keeps merges trivial.

**Branch naming:** `feat/<owner>-<desc>` (e.g. `feat/tarek-risk-export`) so ownership is obvious
at a glance.

---

## 6. Who does what — rules of engagement

Two principles keep two people productive without stepping on each other:
**lanes are soft, the database is hard.** You can cross a lane with a heads-up in the PR; you
never cross the database line.

| Area | Bernard | Tarek |
|------|---------|-------|
| Feature code — **risk, progress, changes, subcontracts** | supports / reviews | **owns & builds** |
| Feature code — **procurement, EAC, phasing** | **owns** | may touch with a PR heads-up (soft lane) |
| **Platform** (`src/platform/*`) | **owns** | avoid; flag if a feature genuinely needs it |
| **Database schema & migrations** | **owns — Bernard only** | **never changes schema** (hard line) — proposes changes via Issue/message; see §7 |
| **Merging to `main` / shipping to prod** | self-merges when CI is green | **self-merges when CI is green** — CI is the guardrail (see below) |
| **Infrastructure** — Vercel, Supabase, Firebase, Codespaces secrets | **owns** | not needed (Model B) |
| **Repo config** — `.claude/` rulebook, CI workflows, branch protection | **owns** | leave alone |
| **Adding npm dependencies** | ok | ok if the feature needs it — call it out in the PR |
| **Risky ops** — delete data, force-push, touch the prod DB | with care | **stop and ask Bernard first** |

**Shared hot files** (`src/App.tsx`, `src/types.ts`): give a heads-up in the PR and keep edits
small and additive.

**Merging = deploying.** `main` auto-deploys to the production URL, and we run **no human review
gate** during this pre-production phase — either person merges once CI is green. That makes the
**CI checks (lint, tests, e2e, build) the real guardrail**: if they're red, nobody merges; keep
them honest and green. (When real customers exist, we reinstate a review gate — see CLAUDE.md's
branch strategy.)

---

## 7. Database changes — the one rule that matters (Model B)

We share **one** Supabase database, and under Model B **Bernard owns all schema changes**:

1. **You (Tarek) never change the database structure yourself** — no new tables/columns, no
   migration files, no edits in the Supabase Studio SQL editor.
2. **When a feature needs a new field or table**, tell Bernard (a message or a GitHub Issue).
   He writes the migration and applies it, and tells you when it's live. This is by design —
   you can't accidentally break the shared database, and you never touch the migration tooling.
3. **Migrations reach the shared DB from `main`** via `npx supabase db push` — run by Bernard,
   after merge, never from a feature branch. (This discipline exists because a manual out-of-band
   change once caused a real breakage, incident P3-0.)

If we ever start colliding on the shared DB often, that's the signal to graduate to per-branch
databases (Supabase Branching or local Postgres). Not needed yet.

---

## 8. Crossing a boundary — what happens

These boundaries are guardrails against *accidents*, not tripwires — and most are enforced
mechanically (§6), not by memory. This is the response when one is crossed anyway: **recover,
don't blame.**

| If… | What happens / what to do |
|-----|---------------------------|
| A **soft lane** is crossed without a heads-up | No drama. CODEOWNERS auto-requested the owner's review; note it in the PR and carry on. |
| A PR tries to **change the database schema** and isn't Bernard's | CI fails the `lint, unit tests, build` check → it can't merge. Bernard makes the migration instead (Model B, §7). |
| A schema change somehow reached the shared DB **out-of-band** | Incident P3-0 playbook: revert the code, then re-apply the change as a proper migration file via `npx supabase db push`. |
| A **bad change shipped to prod** (the self-merge risk) | Roll back first, fix later: Vercel → Deployments → the last good one → **Promote to Production**. Then fix forward on a branch. |
| A **force-push to `main`** or a **destructive op** is attempted | Blocked by branch protection / lack of access. Via Claude, the "stop and ask" rule + Claude's permission prompts are the backstop. |

**Rule of thumb:** hard lines (database, infra, config) are *prevented*; soft lanes are *flagged*;
production is *reversible* (roll back, then fix). Nobody has to be perfect — the guardrails make
mistakes cheap.

---

## 9. Where the rules and the backlog live

- **`CLAUDE.md`** — project conventions, architecture, the non-negotiable rules.
- **`.claude/`** — shared Claude Code config; `.claude/README.md` explains it.
- **`.claude/rules/`** — the engineering standards both of us (and both Claudes) follow.
- **GitHub Issues** — the backlog. New work, questions, and "the DB needs a new field" requests
  go here (or a quick catch-up) — not a private doc only one of us can see.
