# Postgres/Supabase Migration Plan

Status: DRAFT — design only, no code written against this plan yet. Requires
Bernard sign-off (and Tarek's, for the auth/user-facing pieces) before any
implementation begins.

## Why

Firestore's lack of real foreign keys is a recurring, structural source of
bugs — not a one-off. The 2026-07-11/12 FK audit found 575 records with
`costCodeId` stored ambiguously (as a human-readable code instead of a doc
id) across 3 live projects, traced to a UI write path with no server-side
constraint stopping it. Postgres closes this entire class of bug
permanently via `FOREIGN KEY` constraints enforced at the database layer,
instead of an app-level audit script that has to be run and re-run by hand.

The existing ports & adapters seam (`src/platform/ports/`, one interface
per domain, zero `firebase/*` imports outside `src/platform/`) means this
migration can happen by writing new adapters behind the existing
interfaces — no domain or product code needs to change.

## Decisions locked in (2026-07-12)

| Decision | Choice | Why |
|---|---|---|
| Auth | Migrate to Supabase Auth (not just data) | One platform instead of two; enables RLS with native `auth.uid()` |
| Authorization | Postgres RLS policies from day one | Idiomatic Supabase; matches the auth decision above |
| Primary keys | Regenerate as native UUIDs | More idiomatic Postgres; accepted the cost of an ID-mapping pass |
| Cutover | Big-bang, all 26 collections at once | Matches the "full migration" scope decision; single verified cutover window rather than a long strangler period |

These were explicit trade-off choices, not defaults — each has a more
conservative alternative (keep Firebase Auth, app-layer authorization,
keep string IDs, phased cutover) that was considered and rejected in favor
of the more idiomatic/thorough path. Flagging here so future-me doesn't
"simplify" this back without knowing it was deliberate.

## Schema design

### Membership becomes real join tables

Firestore's `enterprises.adminUsers` (array of uids) and
`projects.users` (map of uid → role) become normalized join tables. This
is the natural place to also retire the `isSystemAdmin()` hardcoded email
check (currently 9 files, see the `backlog-system-owner-refactor` memory)
in favor of a real `platform_role` column — the migration is a forcing
function to finally do that refactor, not a separate later effort.

```sql
enterprises            (id uuid pk, name, created_at, ...)
enterprise_members     (enterprise_id fk, user_id fk -> auth.users, role, pk(enterprise_id, user_id))
projects               (id uuid pk, enterprise_id fk, name, project_id_code, created_at, ...)
project_members        (project_id fk, user_id fk -> auth.users, role, pk(project_id, user_id))
user_profiles          (user_id pk fk -> auth.users, platform_role, display_name, ...)  -- replaces platformRole self-grant lockout logic
```

### Core domain tables (one per Firestore collection, FK-normalized)

```
cost_codes                    (id uuid pk, project_id fk, code, name, ...)
sheets
etc_details                   (id uuid pk, cost_code_id fk -> cost_codes, ...)
changes
change_records                (id uuid pk, change_id fk -> changes, cost_code_id fk -> cost_codes)
risks
risk_records                  (id uuid pk, risk_id fk -> risks, cost_code_id fk -> cost_codes)
subcontracts                  (id uuid pk, project_id fk, default_cost_code_id fk -> cost_codes nullable, vendor_id fk)
subcontract_line_items        (id uuid pk, subcontract_id fk -> subcontracts, cost_code_id fk -> cost_codes)  -- was Subcontract.lineItems[], embedded array
invoices                      (id uuid pk, subcontract_id fk -> subcontracts)
invoice_items                 (id uuid pk, invoice_id fk -> invoices, line_item_id fk -> subcontract_line_items)
progress_packages
progress_items                (id uuid pk, package_id fk -> progress_packages, cost_code_id fk -> cost_codes)
progress_reporting_periods
rules_of_credit
schedule_items
procurement_items
procurement_step_definitions
calendars
saved_views                   (id uuid pk, user_id fk -> auth.users)
actual_costs                  (id uuid pk, project_id fk, cost_code_id fk -> cost_codes)
baseline_budgets              (id uuid pk, project_id fk, cost_code_id fk -> cost_codes)
cost_phasing                  (id uuid pk, cost_code_id fk -> cost_codes)  -- currently keyed by code string per domain/rollups.ts comment; becomes a real FK
period_snapshots               -- historical/frozen, see "Frozen snapshots" rule in coding-style.md; never used as live authoritative data
invitations                    (id uuid pk, enterprise_id fk, invited_email, status, ...)
audit_logs                     (id uuid pk, actor_user_id fk -> auth.users, ..., write-only, no update/delete policy)
vendors                        -- currently implicit; formalize as its own table since subcontracts.vendor and vendor-user access both reference it
```

**Not yet resolved — needs a second pass once the exact current shape of
each Firestore document is inventoried field-by-field:** the 4 collections
noted in CLAUDE.md as having no corresponding type in `types.ts`
(`actualCosts`, `baselineBudgets`, `costPhasing`, `periodSnapshots`) need
their fields extracted from live data or component code before the
`CREATE TABLE` statements can be finalized, same gap CLAUDE.md already
flagged for Chunk 2.

### JSONB vs. fully-normalized attributes

Enterprise/project custom attributes (`enterpriseAttributes`,
`projectAttributes` — user-defined key-value fields, arbitrary per
enterprise) become `jsonb` columns rather than fully normalized
attribute-definition + attribute-value tables. This is a deliberate
pragmatic choice, not full 3NF — flagging as a tradeoff since it means
these fields don't get FK/type enforcement. Revisit if attribute misuse
becomes its own bug class the way `costCodeId` was.

## Row-Level Security design

Translated directly from `firestore.rules` (579 lines, read in full for
this plan) rather than redesigned from scratch, so the authorization
*behavior* doesn't silently change during the migration:

```sql
-- Mirrors isSystemAdmin() — currently 3 hardcoded emails in firestore.rules
-- AND 9 hardcoded email-check sites in src/ (backlog-system-owner-refactor).
-- Both collapse into this one function.
create function is_platform_admin() returns boolean as $$
  select exists (
    select 1 from user_profiles
    where user_id = auth.uid() and platform_role = 'admin'
  );
$$ language sql security definer;

-- Mirrors isAdminOfEnterprise(enterpriseId)
create function is_enterprise_admin(ent_id uuid) returns boolean as $$
  select is_platform_admin() or exists (
    select 1 from enterprise_members
    where enterprise_id = ent_id and user_id = auth.uid() and role = 'admin'
  );
$$ language sql security definer;

-- Mirrors canAccessProject(projectId)
create function can_access_project(proj_id uuid) returns boolean as $$
  select exists (
    select 1 from project_members pm
    join projects p on p.id = proj_id
    where pm.project_id = proj_id and pm.user_id = auth.uid()
  ) or is_enterprise_admin((select enterprise_id from projects where id = proj_id));
$$ language sql security definer;
```

Every project-scoped table gets a policy of the shape:
`USING (can_access_project(project_id))` (directly, or via a join up to
the owning subcontract/change/risk row for line-item-style tables).

**Special case not yet designed:** `firestore.rules` grants vendor
representatives read access to their own subcontract + invoices via an
email-based `vendorUsers` array (not `uid`-based, since vendor contacts
aren't necessarily platform users). Needs a decision: require vendor
reps to have a real Supabase Auth account (clean RLS, but changes the
vendor-invite flow), or keep an email-list-based policy
(`auth.jwt() ->> 'email' = ANY(vendor_users)` — works but is a slightly
unusual RLS pattern worth calling out explicitly rather than baking in
silently).

**Special case already handled by design, not just convention:** the
existing rule that `platformRole` can only be changed by a system admin
(closes the self-grant hole fixed in Phase 13.A) needs a trigger, not just
a row policy — RLS alone doesn't restrict which *columns* an otherwise-
authorized update can touch. A `BEFORE UPDATE` trigger on `user_profiles`
rejecting `platform_role` changes unless `is_platform_admin()` preserves
this invariant at the DB layer instead of the app layer, which is strictly
stronger than what Firestore rules could do today.

## Auth migration (Firebase Auth → Supabase Auth)

The one piece of this plan with a real, unavoidable user-facing
consequence, called out on its own:

**Password hashes cannot be migrated directly.** Firebase Auth uses scrypt
with Firebase-specific parameters; Supabase (GoTrue) expects bcrypt.
There is no lossless conversion. Practical options:
1. **Force a password reset for every user on cutover day** (simplest,
   standard practice for this exact migration, but means real users get a
   "reset your password" email and can't log in until they do.)
2. Firebase does support exporting scrypt hash + salt + Firebase's KDF
   parameters, and some migration tooling can get GoTrue to accept them
   via a custom verification function — meaningfully more engineering
   effort for a small user base, likely not worth it here.

**Recommendation: option 1**, but this is Tarek's call, not just a
technical one — it directly affects his team's login experience on
cutover day. Needs explicit sign-off before the auth migration script is
written, separately from the general plan sign-off.

Migration mechanics (once approved):
- Export all Firebase users via Admin SDK `listUsers()`
- Create matching Supabase Auth users via the Admin API, preserving
  original UID as user metadata (needed as a join key during data ETL,
  before things stabilize on the new Supabase `auth.users.id`)
- Update `src/platform/auth/` (the only place besides `src/platform/firestore/`
  allowed to import platform SDKs directly, per CLAUDE.md's non-negotiable
  rule) to wrap the Supabase client instead of Firebase Auth
- Update `/api/accept-invite` (server.ts) - currently verifies Firebase ID
  tokens via `FIREBASE_SERVICE_ACCOUNT_KEY`; needs the equivalent Supabase
  server-side verification instead

## ID strategy & ETL script design

Because IDs are being regenerated (not carried over as-is), every foreign
key reference across every collection needs remapping during migration.
This is the main technical risk of the big-bang approach — a proposed
design to make it tractable and auditable:

1. **Read phase (report-only, mirrors `normalize-costcode-fk.ts`'s own
   philosophy of never writing during discovery):** read every document
   in every one of the 26 collections across every project, output raw
   JSON snapshots to disk. No Postgres writes yet.
2. **ID mapping phase:** generate one `uuid` per Firestore doc id, write
   to a single `id_mappings(collection_name, firestore_id, new_uuid)`
   table (in Postgres, built first, before anything else - this table
   both drives and records the migration).
3. **Transform phase:** re-serialize every document's foreign-key-shaped
   fields (`costCodeId`, `projectId`, `subcontractId`, etc.) through the
   mapping table, in dependency order (enterprises → projects → cost
   codes → everything that references cost codes → ...).
4. **Load phase:** bulk insert in the same dependency order, inside a
   single transaction per collection so a failure mid-collection doesn't
   leave partial data.
5. **Verify phase:** row-count parity check per collection (Firestore
   count == Postgres count), plus a spot-check of computed values (e.g.
   re-run `computeCostCodeRollup` against both the Firestore-sourced and
   Postgres-sourced leaf data for a sample of projects, confirm identical
   output) before treating the migration as trustworthy.

Because `VITE_ADAPTER` already cleanly swaps the entire data layer, the
actual application cutover is just changing that one environment variable
in Vercel once the above is verified - trivially reversible if something's
wrong, *provided* the migration script only ever reads from Firestore and
never mutates or deletes it. Firestore should stay fully intact and
readable as a fallback for a verification window after cutover, not
decommissioned immediately.

## Open risks needing explicit sign-off before implementation

1. **Auth cutover UX** (force password reset) - Tarek's call, see above.
2. **Vendor-by-email RLS pattern** - needs a decision, see above.
3. **4 untyped collections** (`actualCosts`, `baselineBudgets`,
   `costPhasing`, `periodSnapshots`) need their real shape inventoried
   before final `CREATE TABLE` statements - not blocking the plan, but
   blocking the first line of actual schema code.
4. **No Supabase project exists yet** for Mend (checked 2026-07-12) -
   provisioning one is itself an action worth a explicit go-ahead, not
   assumed as part of "the plan is approved."
5. **This is the biggest, highest-blast-radius piece of work in the
   project's history so far** - unlike everything done up to this point,
   a botched cutover affects real production data and real user logins.
   Recommend a dry run against a scratch Supabase project first, however
   the phased-vs-big-bang decision is resolved for implementation order.

## Suggested build order (even though cutover itself is big-bang)

1. Provision Supabase project (needs go-ahead - risk #4 above)
2. Write full `CREATE TABLE` + RLS SQL (needs risk #3 resolved first)
3. Build the ETL script (read → map → transform → load → verify), test
   against the scratch project with production-shaped but non-production
   data first
4. Build Postgres adapters behind the existing 12 ports - zero domain/
   product code changes required, per the seam's whole purpose
5. Auth migration tooling (needs risk #1 resolved first)
6. Full dry-run cutover against the scratch project, verify row counts
   and computed values
7. Real cutover: run ETL against production Firestore data into the real
   Supabase project, flip `VITE_ADAPTER`, keep Firestore readable as
   fallback for a verification window
