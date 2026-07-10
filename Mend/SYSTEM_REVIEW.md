# Mend — System Review (Technical & Functional)

_Author: architecture review · Date: 2026-07-09 · Branch: `refactor/platform-seam`_

This report explains how Mend works from first principles (data → objects → functionality),
walks the key user value chains (happy and unhappy paths), and assesses the system:
what is **good**, what is **fragile**, and what should be **uplifted**. It closes with a
prioritised remediation plan.

The headline: **the platform-seam refactor is genuinely good work and is largely done. The
fragility you have felt does not come from the seam — it comes from three deeper problems that
the refactor did not touch: (1) a data model with no referential integrity and ambiguous foreign
keys, (2) derived financial values stored in the database and recomputed only when a human clicks
a button, and (3) four competing definitions of "who is an admin," one of which is a hardcoded
email and one of which is an open door in the security rules.**

---

## Part 1 — How the system works, from first principles

### 1.1 The storage substrate

Firestore, a schemaless document store. There are **26 top-level collections** (no
sub-collection nesting except `sheets/{id}/rows`). Every document is a bag of fields; the
"schema" lives in two places that are not connected to each other:

- `src/domain/types.ts` — the TypeScript shapes (compile-time only, erased at runtime).
- `firestore.rules` — per-collection `isValidX()` validators (runtime, but partial — they check
  a handful of fields, not the whole shape).

There is no migration system and no schema registry. A field's meaning is whatever the code that
last wrote it decided. This is the root condition that makes everything downstream fragile.

### 1.2 The object graph (what links to what)

```
Enterprise ──1:N──> Project ──1:N──> CostCode  (the spine everything hangs off)
    │                   │                 ▲
    │                   │                 │ referenced by costCodeId OR code (string)
    │                   ├── Sheet ──> rows (forecast)
    │                   ├── actualCosts        ─┐
    │                   ├── baselineBudgets      │  all reference a cost code,
    │                   ├── changes ── changeRecords   but by id in some places
    │                   ├── risks ── riskRecords        and by user-code in others
    │                   ├── subcontracts ── subcontractLineItems ── invoices ── invoiceItems
    │                   ├── progressPackages ── progressItems ── rulesOfCredit
    │                   ├── procurementItems ── procurementStepDefinitions
    │                   ├── scheduleItems
    │                   ├── etcDetails
    │                   ├── costPhasing
    │                   └── periodSnapshots (frozen history)
    ├── calendars (enterprise- or project-scoped)
    ├── invitations
    ├── auditLogs
    ├── savedViews
    └── userRoles/{uid}  (a *separate* identity model — see §3.4)
```

**How the links are actually implemented:** every child stores `projectId` (and often
`enterpriseId`) as a denormalised string. There are **no Firestore references**, no foreign-key
constraints, and no cascade behaviour. A "join" is a client-side `.filter()` over a separately
fetched array. Deleting a project does not delete its cost codes, changes, risks, invoices, etc.
— they become orphans that only the `scripts/audit-*.ts` and `scripts/fix-*.ts` one-off scripts
can find. **The existence of those scripts is the clearest evidence of the fragility: they are a
manual referential-integrity layer bolted on after the fact.**

**The ambiguous foreign key (most important single defect).** A cost code has two identities:
its Firestore document id (`id`) and its user-facing `code` string. Child records reference "the
cost code" inconsistently — and the reconciliation code in `CostCodes.tsx` proves it:

```ts
// CostCodes.tsx handleRecalculateAll
const actualCost = allActuals
  .filter(a => a.costCodeId === ccId || a.costCodeId === ccCode)   // id OR code
  .reduce((sum, a) => sum + (Number(a.cost) || 0), 0);
```

Matching on "id **or** code" means the same actual cost can attach to the wrong cost code if a
`code` string ever collides with a document id pattern, and it means the data cannot be trusted
to have one canonical linkage. This pattern appears in **12 places**. It is the kind of thing
that silently produces wrong money numbers.

### 1.3 How data becomes functionality

The application is a pure client-side SPA. `server.ts` is a thin Express server with exactly one
route (`POST /api/invite`, which sends email via Resend). **All reads and writes happen in the
browser**, now routed through the new platform seam:

```
Component ──> use{X}Repo() hook ──> Port interface ──> FirestoreAdapter ──> Firestore
                                          └─(VITE_ADAPTER=memory)─> MemoryAdapter (tests)
```

The seam (`src/platform/`) is clean and well-built: 12 typed port interfaces, 12 Firestore
adapters (thin CRUD + `subscribe`), 12 in-memory fakes, a composition root
(`context.tsx`) selected by `VITE_ADAPTER`, and converters that keep `Timestamp` out of domain
types. **A grep confirms zero `firebase/*` imports outside `src/platform/` — the non-negotiable
rule in CLAUDE.md is currently satisfied.** This is the strongest part of the codebase.

But note what the seam does **not** contain: **business logic.** The ports are generic CRUD.
Every meaningful calculation — EAC, ETC, cost variance, roll-ups of change/risk records, phasing
— still lives inside the components. `src/domain/` contains only `phasing.ts`, `procurement.ts`,
`risk.ts` (a 1-line `betaPertImpact` helper), and `roles.ts`. **There is no `eac.ts`.** EAC and
variance are computed inline in 4 components. So the seam moved the *I/O* out of components but
left the *domain logic* in — which is why the components are still enormous (CostCodes.tsx is
5,876 lines; the top 12 components are 44k of the 51k total LOC).

---

## Part 2 — Key value chains (happy and unhappy paths)

### 2.1 Onboarding a user / enterprise

**Happy path (system owner):** `App.tsx` computes `isSystemOwner` from a **hardcoded email
string** (`tarek.guindy@gmail.com`). If true, the app subscribes to *all* enterprises and, if
none exist, calls `bootstrapIfEmpty()`. Enterprise selection is persisted in `localStorage` under
a *different* key (`systemOwnerEnterpriseId`) than everyone else (`selectedEnterpriseId`), via two
parallel `useEffect` code paths.

**Happy path (invited user):** admin creates an `invitations` doc → invitee gets an email with a
`?token=` link → on login, `handlePendingInvitation` calls `acceptInvitation(token)` which looks
up the pending invitation and adds the user to the enterprise's `adminUsers`/`users`.

**Unhappy paths — this is where your pain came from:**
- A brand-new user with no enterprise hits a dead-end screen whose only escape is a browser
  **`prompt()`** ("Enter your Enterprise Name") and **`alert()`** for success/failure. This is
  not a real onboarding flow; it is a debugging affordance that shipped.
- The invitation success is announced with `alert()`, and failure sets an auth error — the token
  is consumed from `window.location.search` with no cleanup, so a refresh re-triggers it.
- **Security hole (critical):** the Firestore rule `isJoiningViaInvitation()` lets *any*
  authenticated user add *themselves* to *any* enterprise's `adminUsers` as long as the write
  only touches `adminUsers/users/updatedAt`. It never checks that a matching invitation exists.
  The token check lives only in app code (`acceptInvitation`), which a direct API call bypasses.
  → **Any logged-in user can make themselves admin of any enterprise whose id they can guess.**
- **Security hole (critical):** `match /userRoles/{userId}` allows `write: if isSystemAdmin() ||
  isAuthenticated()` — the `userId` path is not constrained to `request.auth.uid`. **Any
  authenticated user can overwrite anyone's roles doc, including granting themselves
  `platform_admin`.**
- If `bootstrapIfEmpty` fails, the failure is only `console.error`'d — the owner sees an empty app
  with no explanation.

### 2.2 Creating / deleting a project

**Create (happy):** enterprise admin creates a `projects` doc; rules require
`isAdminOfEnterprise`. Fine.

**Delete (unhappy):** deleting a project deletes only the project document. Every child collection
(cost codes, actuals, budgets, changes, risks, subcontracts, invoices, progress, procurement,
schedule, etc.) is **left orphaned**. There is no cascade, no transaction, no soft-delete. This is
exactly the "adding/deleting projects" fragility you reported. The `scripts/check-laing-projects.ts`
and `check-data.ts` scripts exist to detect the resulting orphans by hand.

### 2.3 Seeding data

`scripts/seed-test-data.ts` is **77 KB** of hand-written document construction. Because there is
no schema and no referential integrity, the seed script has to know every field of every
collection and manually wire every cross-reference by string. Any drift between the seed script's
assumptions and the components' assumptions produces data that *looks* valid to the rules but
breaks a screen. This is why seeding "fights back."

### 2.4 Entering costs and reading a cost report (the core money flow)

**Happy path:** user enters baseline budgets, actual costs, ETC details, changes. Each is a leaf
document. To see a cost report, the app roll-ups leaves into each `CostCode`'s
`approvedBudget / actualCostToDate / estimateAtCompletion / costVariance` fields.

**The critical defect:** those roll-up fields are **stored on the CostCode document** and are only
refreshed when a user clicks **"Recalculate All"** (`handleRecalculateAll`, and 5 other components
have equivalent manual recalc buttons). Between a leaf write and the next button-click, the stored
EAC/variance is **stale and wrong**. Two screens reading the same cost code can show different
numbers. This is a textbook violation of the Single-Source-of-Truth rule in your own CLAUDE.md
("derived values must never be stored as independent copies that can drift"): the leaf writers
(ActualCost, BaselineBudget, ChangeManagement…) do **not** know all the read paths, and there is no
invariant tying the stored total to its leaves. The same applies to `Change.budget/eac`,
`Risk.exposure`, and `RiskRecord.betaPertImpactAmount` — all stored derived values.

**Unhappy path:** a user edits an actual cost, navigates to the dashboard, and sees the *old* EAC.
They "fix" it by editing again, or by hunting for the Recalculate button on a different screen.
This is the daily fragility that erodes trust in the numbers — the worst outcome for a cost tool.

---

## Part 3 — Assessment

### 3.1 What is genuinely good ✅

1. **The ports-and-adapters seam.** Cleanly executed, the rule is enforced, memory fakes exist,
   the composition root is a single switch. This is real architectural progress and should be
   preserved and built upon.
2. **Timestamp isolation.** Converters keep Firebase `Timestamp` out of domain types; dates are
   ISO strings at the boundary. Correct.
3. **Domain calculations that *were* extracted** (`phasing.ts`, `procurement.ts`, `betaPertImpact`)
   have unit tests. The pattern is right; it just hasn't been finished (EAC/variance still inline).
4. **Firestore rules exist and validate** — most collections check tenancy via
   `canAccessProject`/`isAdminOfEnterprise`. The intent is sound even where the execution has holes.
5. **Auth/verification UX** (email verification gate, OAuth + credential fallback, iframe launch
   handling) is thoughtfully handled for the messy realities of Safari/embedded contexts.

### 3.2 What is fragile ⚠️ (ordered by blast radius)

| # | Issue | Why it hurts | Severity |
|---|-------|--------------|----------|
| F1 | **Stored derived financials recomputed only on manual button-click** | Cost reports silently show stale/inconsistent money. Destroys trust in a cost tool. | CRITICAL |
| F2 | **`userRoles` write rule open to any authenticated user** | Self-service privilege escalation to platform_admin. | CRITICAL (security) |
| F3 | **`isJoiningViaInvitation` self-add to `adminUsers` with no invitation check** | Any user can admin any enterprise. | CRITICAL (security) |
| F4 | **No referential integrity / no cascade delete** | Orphaned data on every project/cost-code delete; needs manual fix scripts. | HIGH |
| F5 | **Ambiguous cost-code foreign key (`id` OR `code`)** | Wrong money attributed to wrong cost code; unfixable by inspection. | HIGH |
| F6 | **Four competing "who is admin" models** (hardcoded email, `enterprise.adminUsers`, `project.users`, `userRoles`) | Authz decisions disagree; onboarding logic branches everywhere. | HIGH |
| F7 | **Hardcoded system-owner email in client *and* rules** | Bus factor of one; can't add a platform admin without a deploy. | HIGH |
| F8 | **God-documents** (Enterprise & Project carry ~40 optional config arrays; Project embeds two full period arrays) | Large writes, contention, hard to reason about, `any`-typed escape hatches. | MEDIUM |
| F9 | **5,876-line components with inline business logic** | Unreviewable, untestable, the DRY/"logic in lib/" rules are violated. | MEDIUM |
| F10 | **`prompt()`/`alert()` onboarding, token not cleaned from URL** | Not production onboarding; re-fires on refresh. | MEDIUM |
| F11 | **`procurementStepDefinitions` rule open to all authenticated users** | Cross-tenant read/write of procurement templates. | MEDIUM |
| F12 | **`invitations` readable by any authenticated user** | Email-address disclosure across tenants. | LOW |
| F13 | **Duplicate "planned" vs "current" vs "actual" field sets on ProgressItem** | Working-copy vs snapshot confusion stored on one doc. | LOW |
| F14 | **No schema/migration system** | Field meaning drifts; seed script must hand-encode everything. | (structural) |

### 3.3 Is this "good and robust software architecture"?

Partly. The **structural (code-organisation) architecture** is being fixed well by the seam. But
the **data architecture** is not robust, and in a cost/forecasting product the data architecture
*is* the product. Two principles that your own CLAUDE.md codifies are being violated in the
substrate:

- **Single Source of Truth** — violated by F1 (stored, drift-prone derived money).
- **Referential integrity / one canonical linkage** — violated by F4 and F5.

And the **security model** has two critical broken-access-control holes (F2, F3) plus a hardcoded
super-admin (F7). So the honest answer to "are we following robust standards?" is: *the refactor
is on the right track, but it stopped at the seam and never reached the two layers that actually
cause your day-to-day pain — the data model and the authorization model.*

### 3.4 The identity/authorization tangle (F6, spelled out)

There are **four** ways the system decides what a user can do, and they are not reconciled:

1. `isSystemOwner` = hardcoded email in `App.tsx`.
2. `isSystemAdmin()` = the *same* hardcoded emails in `firestore.rules`.
3. `Enterprise.adminUsers[]` + `Enterprise.users{}` (roles `Enterprise System Admin`/`Enterprise User`).
4. `Project.users{}` (roles `Project Admin`/`Project User`).
5. A *fifth*, newer model in `src/domain/roles.ts` + `userRoles/{uid}` (`platformRole`,
   `memberships[]` with `enterprise_admin`/`enterprise_member`, `projectRoles`) surfaced by the
   `useAuth()` hook — but `App.tsx` does not use it; it still uses #1.

`roles.ts` even names roles (`Project Writer/Reader/Guest`) that the `Project.users` type
(`Project Admin | Project User`) cannot represent. So the new model and the live model disagree at
the type level. This is the single biggest source of "why did onboarding behave weirdly" — the
app authorizes with one model while the rules authorize with another and a third is half-wired in.

---

## Part 4 — Recommended uplift (proposed plan — needs your sign-off)

Sequenced so that the highest-trust-and-security items come first and nothing depends on a later
phase. Each phase is independently shippable.

### Phase A — Stop the bleeding (security + trust) — do first
- **A1 (F2):** Fix `userRoles` write rule → `allow write: if isSystemAdmin() || request.auth.uid == userId` (and never allow self-setting `platformRole`).
- **A2 (F3):** Make enterprise-join require a real invitation: rule must `get()` the matching `invitations` doc (status pending, email == token email) rather than trusting the diff shape.
- **A3 (F11/F12):** Scope `procurementStepDefinitions` to enterprise/project; restrict `invitations` read to the invited email + enterprise admins.
- **A4 (F1 — the trust fix):** Make cost/change/risk roll-ups a **derived read**, not stored state. Two legal options from your own rules: (i) compute on read from leaves via a canonical `src/domain/eac.ts` (simplest, always correct), or (ii) keep the stored cache but add a contract test asserting every leaf-writer calls one `recompute()`. Recommend (i) first; the "Recalculate All" buttons then disappear.

### Phase B — Fix the data model
- **B1 (F5):** Pick one canonical cost-code key (the document `id`), write a migration to normalise all children, and delete the "id OR code" matching everywhere.
- **B2 (F4):** Introduce cascade/soft-delete for project & cost-code deletion (a delete goes through a repository method that removes or tombstones children in a batch). Fold the `scripts/audit-*`/`fix-*` logic into a repeatable integrity check + a test.
- **B3 (F14):** Add a lightweight schema+migration convention (versioned docs, or Zod schemas at the adapter boundary that reject malformed writes) so seed and app share one definition.

### Phase C — Unify identity/authorization
- **C1 (F6/F7):** Choose **one** role model — the `userRoles`/`roles.ts` model is the right target. Wire `App.tsx` to `useAuth()` instead of the hardcoded email; make `firestore.rules` read `userRoles` (via custom claims or a `get()`); remove hardcoded emails from both client and rules. Reconcile the role vocabularies (`roles.ts` vs `Project.users` type).

### Phase D — Finish the seam's promise (maintainability)
- **D1 (F9):** Extract the remaining inline business logic (EAC/variance roll-ups, change/risk aggregation) into `src/domain/`, and shrink the top components below the 800-line rule by splitting grid/config/logic. This is where the "many small files" and "logic in lib/" rules get satisfied.
- **D2 (F8/F13):** Split god-documents — move `reportingPeriods`/`progressPeriods` and enterprise config arrays into their own collections; separate ProgressItem's snapshot fields from its working fields.

### Suggested first move
Phase A is small, high-value, and low-risk (rules edits + one derived-read refactor). It directly
removes the two critical security holes and the stale-numbers problem — the things eroding your
confidence — without waiting on the larger data-model migration.

---

---

## Part 5 — Separation of concerns & code distribution

**Verdict: the system does not currently follow good separation of concerns.** The seam
(`src/platform/`) is well-layered, but 91% of the code sits in one flat folder of oversized files
that each mix six concerns. The foundation is not yet sound enough to build further on without
first decomposing.

### Map 5.1 — Where the code lives

```
                          LOC      % src    files   avg/file
 src/components/  ██████  46,561   91.2%     79      590     ◀ the problem
 src/platform/    █        2,661    5.2%     32       83     ◀ the good part (the seam)
 src/domain/      ▌        1,072    2.1%      7      153     (half is dead — see 5.4)
 src/ (root)      ▏          649    1.3%      4        —     App.tsx, main.tsx, types.ts
 src/lib/         ·           41    0.1%      3       14     ◀ where logic SHOULD live, but is empty
```

Healthy target for this class of app: components 40–50%, domain/logic 25–35%, platform 15–20%,
lib 5–10%. Here the logic never reached `lib/`/`domain/` — it is trapped inside components.

### Map 5.2 — Component size distribution (79 files)

```
  >2,000 lines    ██████ 6      CostCodes 5876 · Subcontracts 4591 · EnterpriseAdmin 3524
                                 ProgressTracking 2434 · BulkEtcDetails 1930 · ...
  800–2,000       ████████████ 12
  400–800         █████████ 15
  200–400         ████████████ 20
  <200            ████████████████ 26
```

**18 of 79 files exceed the 800-line hard max in CLAUDE.md; 6 are 2–6× over it.**

### Map 5.3 — Anatomy of a god-component (`CostCodes.tsx`, 5,876 lines)

```
  ┌──────────────────────────────────────────────────────────────┐
  │  64 useState hooks        → ① UI/local state                   │
  │   7 repo hooks            → ② data access (7 collections)      │
  │ 241 calc sites            → ③ BUSINESS LOGIC (EAC, variance)   │  ← belongs in domain/
  │ 160 grid column defs      → ④ presentation / grid config       │
  │  28 modal/dialog refs     → ⑤ sub-views & flows                │
  │  handleRecalculateAll()   → ⑥ orchestration / persistence      │
  └──────────────────────────────────────────────────────────────┘
```

This is systemic, not confined to the top files: **27 of 79 components** individually fetch data
**and** compute business logic **and** render a grid in the same file.

### Map 5.4 — Two proofs the foundation isn't wired correctly

1. **`domain/phasing.ts` exists but ZERO components import it.** 4 components carry their own
   inline copy of the curve/phasing logic → the "canonical" function is dead code while the real
   logic is duplicated. **There is no `domain/eac.ts` at all** — EAC/variance is inline in 4 files.
2. **627 `: any` annotations inside components** — the type safety domain types promise is erased
   at point of use.

### Map 5.5 — Intended vs actual architecture

```
   INTENDED (what the seam implies)          ACTUAL (today)
   Component  = render only                  Component = 5,876 lines doing everything
       │ calls                                   │  fetch (7 repos) + compute inline + render
   domain/    = pure canonical logic  ✗ mostly missing / dead
       │
   platform/ports  = CRUD          ✓          platform/ports  ✓
   platform/adapters ─▶ Firestore  ✓          platform/adapters ─▶ Firestore  ✓
```

The bottom half (the seam) is clean. The top half (a domain layer + thin components) was never
built. The fix is **extraction under test**, not a rewrite — the seam already provides the skeleton.

---

## Part 6 — Approved execution plan (supersedes Part 4 sequencing)

**Decisions (signed off 2026-07-09):** vertical slices + E2E-first; pragmatic strictness
(extract logic + tests now, defer 800-line/`any` cosmetic cleanup to a later pass).

**Testing philosophy — characterization first:**
1. Pin current behaviour with **E2E tests against a local memory-adapter build** (deterministic) —
   this is the outer safety net; behaviour must not change.
2. Extract logic into `src/domain/` **under new unit tests written at the moment of extraction**
   (not up front against code we're about to delete).
3. E2E staying green = proof the value chain still works. Unit coverage climbs as logic moves.

**Structure — vertical slices, not horizontal phases** (a slice fits one working session and ends
in a committed, green, shippable state, so context loss never strands a half-done file):

```
 PHASE 0  Safety net & harness (horizontal, once)
   • Repoint Playwright at a local memory-adapter build; seed in-memory fixtures
   • Characterization E2E for core value chains (auth → enterprise → project → cost report)
   • Widen vitest coverage scope beyond domain/ to observe it climb
   ▶ GATE: E2E green on current code = the net is live.

 PHASE 1  Security rules (horizontal, small)
   • F2 userRoles write scope · F3 invitation-must-exist · F11/F12 collection scoping
   • Add NEGATIVE tests: attacker cannot self-escalate
   ▶ GATE: legit flows green, escalation blocked.

 PHASE 2+ Vertical slices (one per session, trust-priority order)
   2. Cost / EAC       → extract eac.ts, compute-on-read (removes "Recalculate All"), fix cost-code FK
   3. Change management
   4. Risk             → wire domain/risk.ts betaPert at write+read
   5. Subcontract / Invoice
   6. Progress         → wire domain/phasing.ts (kills the dead-code duplication)
   7. Procurement
   Each slice: extract logic→domain/ · fix that domain's data issue · adopt <DataGrid> ·
               unit-test extracted fns (100%) · E2E green · commit + JOURNAL entry.

 PHASE 8  Identity unification (cross-cutting, near end)
   • Collapse 4 role models → userRoles; wire App.tsx to useAuth(); remove hardcoded emails.
```

**Context-safety mechanism:** every slice ends with a committed green build and a one-line
`PLAN.md`/`JOURNAL.md` entry. The last commit is always a working app.

Per-slice checklist lives in `PLAN.md` under "Phase 11 — Foundation Uplift".

---

## Appendix — Evidence index
- Seam clean: `grep firebase/* outside src/platform` → 0 hits.
- Manual recompute: `CostCodes.tsx:395 handleRecalculateAll`; 6 components have Recalculate buttons.
- FK ambiguity: 12 occurrences of `costCodeId === id || costCodeId === code`.
- Security: `firestore.rules:32-40` (`isJoiningViaInvitation`), `:554-557` (`userRoles`), `:18-21` (hardcoded admin), `:498-503` (`procurementStepDefinitions`), `:373-374` (`invitations` read).
- Identity models: `App.tsx:48`, `domain/roles.ts`, `types.ts` (`Enterprise.users`, `Project.users`), `platform/.../UserRoleAdapter.ts`.
- Scale: 51,017 LOC in `src/`; top 12 components = 44,454 LOC; `seed-test-data.ts` = 77 KB.
- Firefighting scripts: `scripts/{audit-user-access,audit2,check-data,check-laing-projects,fix-enterprise-membership,fix-email-verified,add-bernard-to-all-enterprises}.ts`.
