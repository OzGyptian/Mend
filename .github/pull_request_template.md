## What & why

<!-- One or two sentences. Link the GitHub issue if there is one (e.g. "Closes #42"). -->

## Type

- [ ] feat
- [ ] fix
- [ ] refactor
- [ ] docs / chore / test

## Pre-merge checklist

- [ ] `npm run lint` passes (type-check)
- [ ] `npm run test` passes (unit)
- [ ] Branch rebased on latest `main` (`git pull --rebase origin main`)
- [ ] No `firebase/*` imports outside `src/platform/`
- [ ] JOURNAL.md updated (for notable changes)

## 🗄️ Database / schema

Pick one:

- [ ] This PR **does not** change the database schema.
- [ ] This PR **changes the schema** — I added a migration in `supabase/migrations/`
      **and gave the other developer a heads-up.**

<!--
Reminder: schema changes reach the shared database only after this merges to `main`
(via `npx supabase db push`). NEVER apply migrations directly in the Supabase Studio
SQL editor (that caused incident P3-0). The "DB change notify" workflow will auto-label
this PR and @-mention the other developer if it touches supabase/migrations/.
-->
