# `.claude/` — shared, repo-owned Claude Code configuration

This directory makes Mend **self-contained** for AI-assisted development. Both developers
(and both of their Claude Code instances) read the **same** rulebook from here — nobody
depends on anyone's personal global `~/.claude`.

## What's in here

| Path | Committed? | Purpose |
|------|-----------|---------|
| `settings.json` | ✅ yes | Shared permissions + hooks (e.g. type-check after edits) |
| `settings.local.json` | ❌ gitignored | Per-machine overrides — yours only, never shared |
| `rules/` | ✅ yes | **Mend's engineering standards** (see below) |
| `agents/` | ✅ yes | Curated review/TDD subagents used on this repo |
| `skills/` | ✅ (empty for now) | Reserved — project skills can be vendored here later |
| `worktrees/`, `*.lock` | ❌ gitignored | Local runtime state |

## `rules/` — where these come from

`rules/` holds a **vendored, frozen copy** of the slice of Bernard's personal ECC
engineering-standards framework that applies to a TypeScript / React / Vite app:

- `rules/common/` — language-agnostic principles
- `rules/typescript/` — TS/JS specifics
- `rules/web/` — frontend/web specifics

**Once vendored here, these rules belong to the repo, not to ECC.** Either developer may
edit them via a normal PR. They are *not* a live dependency — Mend never reaches into
`~/.claude` at build or run time.

### Re-syncing from upstream ECC

Only the maintainer of the upstream ECC framework needs this. To pull upstream
improvements down into the repo:

```bash
./scripts/sync-ecc.sh          # copies common + typescript + web from ~/.claude/rules/ecc
git diff .claude/rules         # review
# commit if the changes are intended
```

Everyone else just uses what's already committed here — no setup required.

## Precedence (why this guarantees parity)

Claude Code layers project-level `.claude/` **over** each user's global `~/.claude/`.
So whatever either developer has in their personal config, this repo's rules and agents
take effect for work on Mend. That's the mechanism that keeps both of us coding to an
identical standard.
