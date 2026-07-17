# Phase 2 — Data Model Structural Audit

Method: schema inspection + live value-distribution queries + cross-check against the
domain type definitions (`src/domain/types.ts`) and the pure domain logic that consumes
categorical columns. Focus: the structural fragility class Bernard flagged (enum vs free
text, duplicated concepts, naming/convention drift), stored-derived-value correctness, and
department-hierarchy readiness (assessed as a *directional* option, not a committed build).

## Findings

### D1 — HIGH: categorical values are unconstrained free text, and vocabulary/case drift is already live in the data

The single clearest confirmation of Bernard's concern. `cost_phasing.distribution_method`
is `text` with no CHECK/enum. Live values right now:

| value | rows |
|---|---|
| `Even` | 258 |
| `even` | 1 |
| `manual` | 1 |

The same conceptual value ("how a cost is spread over time") is stored with **at least
four different string vocabularies across the type system**:
- `src/domain/types.ts:2` — `DistributionMethod = 'manual' | 'even' | 'front' | 'back' | 'bell'`
- other domain types in the same file use `'Even' | 'Bell Curve' | 'Front load' | ...`
  and `'Scurve' | 'Bell' | 'front load' | ...` (title/mixed/long forms)
- `src/domain/phasing.ts` `calculatePhasing()` switches on `case 'Even'`, `case 'Bell'`
  (title case), with `default: weights = fill(1)` (even distribution)

**Why it's dangerous:** a row whose method doesn't case-match the switch falls to the
default, which silently produces **even distribution**. Today this is *benign* only because
(a) the default happens to equal even and (b) most data is `Even`. But any non-even method
stored with the wrong casing/vocabulary (e.g. a `bell` that should be `Bell`, a `front load`
vs `Front load`) silently yields wrong phased financials **with no error**. The `even`/`manual`
lowercase rows are the drift already beginning. This is the exact "enum values which can
vary" trap.

Same pattern, unconstrained free text with title-case values, in every categorical column
checked: `cost_codes.eac_method` (`Change Management`/`ETC Details`/`Manual`/`Sub-Contract
Management` — and this one is a **strategy switch that selects the EAC calculation
method**, so a typo mis-calculates cost-at-completion), `subcontracts.payment_type`
(`LumpSum`), `subcontract_line_items.type` (`Original`/`ChangeOrder`),
`sheets.forecast_method` (`commitment`).

**Remediation direction (Phase 5):** promote each stable categorical to a Postgres enum (or
a CHECK-constrained domain), pick ONE canonical vocabulary, migrate existing data to it
(normalizing the `even`→`Even` drift), and make the domain types reference a single shared
union. This is the highest-value structural fix — it converts a class of silent wrong-number
bugs into insert-time errors.

### D2 — MEDIUM: membership is modelled four ways; only the two empty relational tables are authoritative

1. `enterprise_members` (relational) — **0 rows**, RLS-authoritative
2. `project_members` (relational) — **0 rows**, RLS-authoritative
3. `user_roles.memberships` (jsonb array) — present on all 4 users, **all `[]`** (empty)
4. `sheets.users` (uuid array) — **all `[]`** (empty)

The two relational tables are the ones every RLS policy trusts; they have never been
populated. (3) and (4) are dead Firestore-era residue carrying no data. All 4 real users
are platform admins (confirmed: every `user_roles.platform_role` = `'platform_admin'`), so
the entire app has only ever run via admin bypass — nothing has ever read a membership.
**Remediation:** delete the two dead representations (3, 4) once confirmed unread by code
(Phase 4), keep the relational tables as the single source, and actually populate them when
real users are onboarded.

### D3 — MEDIUM: platform_role lives in two tables with two type systems and two value conventions

- `user_profiles.platform_role` — enum `platform_role` (`admin`|`user`), read by RLS
  `is_platform_admin()`
- `user_roles.platform_role` — unconstrained `text`, expected to be `'platform_admin'`,
  read by the frontend `useAuth().isPlatformAdmin`

Already bit us this session (the grant-admin two-table dance) and confirmed exploitable at
the UI tier in Phase 1 F3 (self-granted `user_roles.platform_role` gives client-side
System-Admin UI + enterprise-name disclosure, though DB access stays blocked).
**Remediation:** one source of truth — `user_profiles.platform_role`, trigger-protected —
and have the frontend read that (via an RPC or a view). Delete/lock `user_roles.platform_role`.
This subsumes Phase 1 F3 and GitHub #12/#13.

### D4 — LOW/MEDIUM: role value conventions are inconsistent across the three role enums

`enterprise_member_role` = `admin`|`member` (lowercase), `platform_role` = `admin`|`user`
(lowercase), but `project_member_role` = `"Project Admin"`|`"Project User"` (title case,
with spaces, as enum labels). Cosmetic but a footgun: string comparisons and display code
must remember which convention applies where. Standardize on one convention if these enums
are touched during remediation.

### D5 — MEDIUM: status columns are free text with no constraint

`projects.status` (`Active`, plus 4 NULLs from the synthetic rows), `changes.status`
(`Approved`/`Pending`), `invoices.status` (`Draft`), `risks.status` (`Open`),
`subcontracts.status` (`Active`), `subcontract_line_items.status`
(`Approved`/`Forecast`/`Pending`/`Rejected`), `progress_reporting_periods.status` (`Open`).
All free text, all title case, no enum/CHECK. Same class as D1 — enum candidates. Lower
severity than D1 because status typos degrade to "unknown status shown in UI" rather than
wrong financial math, but the same fix applies.

### D6 — needs per-value classification (Phase 5): stored derived values vs frozen snapshots

Stored values that are computed from leaves and could drift from them:
- `cost_codes`: `approved_budget_previous`/`_movement`, `estimate_at_completion_previous`/
  `_movement`, `cost_variance_previous`/`_movement` (a period-delta sextet; note there is
  **no** stored "current" — current = previous + movement, computed)
- `forecast_rows`: `budget`, `committed_cost`, `actual_cost_to_date`, `cost_to_go`, `eac`
- `etc_details.total_etc_previous`
- `period_snapshots.cost_codes` (jsonb blob of a whole period's cost codes)

Per the leaves-only rule: `period_snapshots` is a legitimate **frozen historical snapshot**
(period-close capture) — must be *labelled* as as-of-a-timestamp everywhere it's shown and
never used as the live value (Phase 4 must verify no live read path uses it). The
`_previous` columns are also plausibly frozen prior-period values (legitimate if labelled
and only written at period rollover). The `forecast_rows` EAC/cost-to-go and any "current"
derived value are the concern: Phase 4 must confirm they're recomputed on read (via
`src/domain/eac.ts`) and not stored-and-trusted. Not yet verified; flagged.

### D7 — LOW: no `user_id` column has a foreign key to `auth.users`

`enterprise_members.user_id`, `project_members.user_id`, `user_profiles.user_id`,
`user_roles.user_id`, `saved_views.user_id`, `cost_code_assigned_users.user_id`,
`projects.created_by`/`modified_by`, `sheets.created_by`, etc. are all bare UUIDs. A
membership can reference a deleted/nonexistent auth user with no referential guard. Low
severity (Supabase pattern; auth.users is in a different schema and FKs to it are
discouraged) but worth a note and a periodic orphan-check.

### D8 — LOW: no `updated_at` maintenance triggers

Every `updated_at` is app-maintained (Phase 0: only one trigger exists in the whole DB,
the platform_role guard). Any direct DB write or any adapter path that forgets to set
`updated_at` leaves a stale timestamp. Cheap to fix with a generic `set_updated_at` trigger
per table; low priority.

### D9 — MEDIUM: dual-scope tables and RLS-ignored scope columns can hold incoherent rows

- `calendars` and `procurement_step_definitions` have nullable `project_id` AND nullable
  `enterprise_id`; the policy is `(project_id NOT NULL AND ...) OR (enterprise_id NOT NULL
  AND ...)`. A row with **both null** satisfies neither branch → invisible to all client
  roles, orphaned. No CHECK constraint prevents it. Add `CHECK (num_nonnulls(project_id,
  enterprise_id) = 1)`.
- `cost_phasing` and `etc_details` carry a nullable `project_id` column that RLS **ignores**
  (it routes via `cost_code_id → cost_codes.project_id`). The stored `project_id` can
  therefore disagree with the cost_code's true project. Either drop the redundant column or
  enforce it equals the cost_code's project (ties into F1's composite-FK fix).

### D10 — MEDIUM: `projects` (40+ columns) copies enterprise-level defaults per project

`projects` duplicates enterprise defaults into per-project columns: `categories`,
`control_accounts`, `order_numbers`, `cost_elements`, and the whole `*_attributes` bucket
family (`cost_code_attributes`, `subcontract_attributes`, `change_attributes`,
`risk_attributes`, `procurement_attributes`, `progress_attributes`, `line_item_attributes`),
plus `change_types`, `risk_types`, `resource_rates`. These are copy-on-create from the
enterprise. Once copied they drift — an enterprise-level change to a default doesn't
propagate, and there's no record of whether a project's value is "inherited" or
"overridden." This is a classic denormalization-drift surface and it gets **worse with a
hierarchy** (each new level would copy again). Flag for the hierarchy design: model
inheritance explicitly (null = inherit from parent) rather than eager-copy.

### Enum-vs-boolean fitness (Bernard's specific question)

The boolean columns that exist (`sheets.locked_status`, `procurement_step_definitions.
is_enterprise_standard`, `etc_details.is_enterprise_resource`) are genuinely binary —
boolean is the correct choice; none should be enums. The fitness problem runs the *other*
direction: values that ARE categorical (D1, D5) are stored as unconstrained text instead of
enums. So the answer to "should some of these be booleans not enums" is: the booleans are
fine; it's the free-text categoricals that need to become enums.

## Department / sub-department hierarchy readiness (directional)

Current model is strictly two-level: `enterprise → project`, with every project-scoped
table FKing `projects` and deriving enterprise through it. This is actually a *favorable*
starting shape for inserting intermediate levels:

**Low-friction, because:** the 19 Pattern-A tables never reference enterprise directly —
they route through `can_access_project(project_id)`. Adding `departments` +
`projects.department_id` (nullable during migration) would not touch those tables or their
policies at all. The access-helper functions would gain a department tier
(`can_access_department`, department-level roles) but the child tables are insulated.

**Where the cost concentrates:**
1. The access-helper functions and a new `department_members` (or a generalized
   `memberships(scope_type, scope_id, role)` table — worth considering to end the
   membership fragmentation of D2 in one move).
2. `enterprise_members` role model would need department-scoped roles.
3. **The copy-on-create defaults problem (D10) compounds per level** — fix D10 first
   (model inheritance as null=inherit) or the hierarchy multiplies the drift surface.
4. **F1's composite-FK fix must be coordinated here.** If tenancy/hierarchy adds a column
   that becomes part of the "owning scope," the composite keys that fix F1 should include
   it, so those FKs aren't migrated twice. This is the concrete Phase-1→Phase-2→Phase-5
   dependency: **do not implement F1's composite FKs until the hierarchy's tenancy column
   is decided** — even though the decision itself is only "directional" for now, the shape
   it would take is knowable and should be pinned before the F1 migration is written.

**Recommendation given "directional, not committed":** don't build the hierarchy migration
now. But make two forward-compatible choices when doing the Phase 5 remediations that are
happening anyway: (a) fix D10 as null=inherit rather than eager-copy, and (b) when fixing
F1, design the composite key around a generalized "owning project (+ future department)"
so adding the level later doesn't re-migrate. Both cost little now and save a double
migration later.

## Cross-phase dependencies recorded

- **F1 (Phase 1) fix ⟶ depends on** the D10/hierarchy inheritance decision and the tenancy
  column shape. Sequence: settle D10 + hierarchy-column direction → then write F1 composite FKs.
- **D3 subsumes** Phase 1 F3 and GitHub #12/#13.
- **D6 verification** hands off to Phase 4 (find the read paths for the derived values).
- **D1/D5 enum migration** is the single highest-value structural fix; independent of the
  hierarchy, can proceed first.
