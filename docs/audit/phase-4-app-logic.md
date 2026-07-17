# Phase 4 — Application Logic Audit

Scope: where authorization decisions live in the client (and whether each has a
DB-enforced twin), the state-lifecycle fragility class we fixed repeatedly this session
(and its systemic root), business logic that leaked out of the domain layer, the
derived-value read paths handed off from Phase 2 (D6), and the hardcoded-email residue (#13).

## Findings

### A1 — HIGH (process, systemic root cause): ESLint enforces almost nothing

`eslint.config.js` configures exactly ONE rule: the `no-restricted-imports` firebase
boundary guard. There is **no `react-hooks/exhaustive-deps`, no `react-hooks/rules-of-hooks`,
no `@typescript-eslint/no-explicit-any`, no `no-floating-promises`** — the plugin
`eslint-plugin-react-hooks` isn't even installed.

This is the systemic root of a whole class of bugs hit this session. Every one of the
auth-timing bugs we fixed (effects missing `isSystemOwner` / `authLoading` from their
dependency arrays → stale-closure reads → the "My Profile bounces", "not associated with
an enterprise" flicker, and enterprise-switch-reverts bugs) is *exactly* what
`react-hooks/exhaustive-deps` flags automatically. It was never enabled, so they shipped.

Compounding it: `npm run lint` is `tsc --noEmit && eslint src`, and since eslint only
checks the firebase boundary, **"lint passes" means "types compile + no firebase import
leak" — nothing about React correctness, effect dependencies, `any` usage, or unhandled
promises.** That's false confidence; the green check doesn't cover the bug classes that
actually bit.

**Remediation (high value, low effort):** install `eslint-plugin-react-hooks`, enable
`exhaustive-deps` (warn→error) and `rules-of-hooks` (error), add the typescript-eslint
recommended set, and add the `no-explicit-any` ratchet (ties GitHub #18). This converts an
entire recurring bug class into pre-commit errors. Expect it to surface a backlog of
existing violations — triage, don't bulk-suppress.

### A2 — MEDIUM: hardcoded Tarek-email `isSystemAdmin` in three components (#13, broader than filed)

The hardcoded system-owner email check is not in one place — it's in at least:
`src/platform/firestore/hooks.ts:61`, `src/components/CostManagement.tsx:51`,
`src/components/ProcurementManagementSubPane.tsx:33`. Each hardcodes
`['tarek.guindy@gmail.com', 'tarek_guindy@hotmail.com']` and treats a match as
system-admin, feeding `isProjectAdmin`/`isSystemAdmin` UX gates.

Two problems: (1) it's pre-DB-role residue that should be the DB-driven
`is_platform_admin`/role check, and (2) it doesn't generalize — a new admin, or Tarek from
a different email, silently gets nothing; conversely it grants Tarek project-admin UX on
*every* project regardless of membership. It's UX-only (RLS decides real writes, verified
Phase 1), so not a security breach — but it's fragile duplicated authorization logic.
**Remediation:** delete all three; route through the single DB-driven platform-admin
signal that D3 (Phase 2) consolidates. Subsumes #13.

### A3 — MEDIUM: `ForecastGrid` computes EAC inline instead of the canonical domain function

`src/components/ForecastGrid.tsx` computes EAC inline (≈line 319/326:
`forecastMethod === 'commitment' ? qty*rate : actualCostToDate + costToGo`) rather than
calling the canonical `computeEacEtc` in `src/domain/eac.ts`. That's two implementations of
the same concept (DRY / one-algorithm-per-concept violation) — the exact divergence trap
that produces silently-different numbers in different views. It also reads stored
`item.eac`/`item.costToGo` in some code paths while recomputing in others.

This makes forecast_rows the **real** case of the D6 stored-derived-value concern: unlike
cost_codes (see A4, already migrated to compute-on-read), forecast EAC is both stored AND
recomputed inline, via a formula that bypasses the domain layer. **Remediation:** move the
formula into `src/domain/eac.ts` (or reuse the existing function), have the component call
it, and decide whether `forecast_rows.eac`/`cost_to_go` should be stored at all or computed
on read per the leaves-only rule.

### A4 — GOOD (D6 partially resolved): cost_codes derived values already compute-on-read

`src/components/CostCodes.tsx` documents (≈line 127-129) that the stored
baselineBudget/approvedBudget/actualCostToDate/estimateAtCompletion/costVariance (+movement)
fields are "always live-computed from leaves now, never stale" — the old "Recalculate"
button and force-write path were removed. So for cost_codes, the current derived values are
recomputed from leaves on read (compliant with the leaves-only rule); the stored
`*_previous` columns are frozen prior-period values used for period-over-period display
(legitimate snapshots). Someone already did this migration correctly. **Remediation:**
spot-verify the compute path actually recomputes (don't just trust the comment), and apply
the same treatment to forecast_rows (A3).

### A5 — client authorization is uniformly RLS-backed; no new client-only security gate found

Phase 1 established that every table is RLS-protected and the client cannot exceed its DB
permissions. Re-checked here: the client-side `isPlatformAdmin`/`isEnterpriseAdmin`/
`isProjectAdmin` checks scattered through components are UX gates (hide/show, enable/disable)
whose real enforcement is RLS. The ONE exploitable client-authz gap remains Phase 1 F3 (the
frontend trusts `user_roles.platform_role`, self-settable → System-Admin UI + enterprise-
name disclosure). No additional client-only security decision (a mutation gated solely by a
client check with no server enforcement) was found. Good — the "no backend API" architecture
holds because RLS is comprehensive.

### Auth-timing race class — fixed in App.tsx; A1 is the guard against recurrence

The effects in `App.tsx` now carry proper `authLoading`/`isSystemOwner` guards (fixed this
session). The remaining `useEffect` deps depend on already-resolved state. No new instance
found in App.tsx. But the *reason* the cluster existed is A1 (no exhaustive-deps lint) — a
full component-wide sweep for the same pattern is only worthwhile once A1 is enabled, which
will flag them mechanically. Recommend: enable A1, triage what it surfaces, rather than
hand-hunting now.

## Handoffs / cross-references
- A1 subsumes GitHub #18 and is the single highest-leverage process fix in the audit.
- A2 subsumes #13 and depends on D3 (Phase 2) landing the single platform-admin signal.
- A3 + A4 close out the D6 (Phase 2) derived-value question: cost_codes ✅ compliant,
  forecast_rows ❌ needs the same compute-on-read + domain-function treatment.
- No new tenant-isolation or data-loss finding at the app layer — consistent with Phase 1's
  result that enforcement lives (correctly) in the DB, not the client.
