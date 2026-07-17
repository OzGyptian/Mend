/**
 * Firestore -> Postgres ETL, per POSTGRES_MIGRATION_PLAN.md's design:
 * read -> map ids -> transform -> load -> verify.
 *
 * SCOPE: deliberately excludes every table with a required (not null)
 * foreign key to auth.users -- enterprise_members, project_members,
 * user_profiles, user_roles, cost_code_assigned_users, saved_views. Those
 * rows can't be migrated correctly until the Firebase Auth -> Supabase
 * Auth user migration has actually happened (still gated on Tarek's
 * sign-off on the forced-password-reset UX, per the plan doc's risk
 * list) -- there is no real Supabase Auth user id to point them at yet.
 * Nullable user FKs (created_by, modified_by, actor_user_id) are populated
 * as null for now; a follow-up backfill pass can set them once the user-id
 * mapping exists.
 *
 * Every other collection -- enterprises, projects, vendors, calendars,
 * procurement step definitions, cost codes, sheets, risks, changes,
 * progress packages/rules of credit/schedule items/reporting periods/
 * attributes, etc details, actual costs, baseline budgets, cost phasing,
 * risk records, change records, subcontracts, forecast rows, progress
 * items, rule of credit steps, procurement items, subcontract line items,
 * invoices, invoice items, period snapshots, audit logs -- is migrated in
 * full, in dependency order.
 *
 * ID strategy: every Firestore doc gets a fresh UUID, recorded in
 * etl.id_mappings(collection_name, firestore_id, new_id) so re-running
 * this script is idempotent -- an already-migrated doc gets its existing
 * UUID back rather than a new one, keeping foreign keys consistent across
 * incremental or resumed runs.
 *
 * Default mode is REPORT ONLY -- it reads Firestore and prints what would
 * be migrated, but never writes to Postgres. Pass --apply to actually load.
 * This never mutates Firestore in any way, at any point.
 *
 * Usage:
 *   npx tsx scripts/etl-firestore-to-postgres.ts --project <projectId>              (report only)
 *   npx tsx scripts/etl-firestore-to-postgres.ts --project <projectId> --apply       (loads into Postgres)
 *   npx tsx scripts/etl-firestore-to-postgres.ts --all-projects --apply
 *
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment
 * (the service role key bypasses RLS for bulk loading -- never expose it
 * client-side, same handling as FIREBASE_SERVICE_ACCOUNT_KEY).
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { randomUUID } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { camelToRow, toRow } from '../src/platform/supabase/caseConvert';
import { convertTimestamps } from './lib/convert-timestamps';
import { createLocalDumpFirestore, type LocalDumpFirestore } from './lib/local-dump-firestore';

// --from-dump [dir] reads from a local JSON dump (scripts/dump-firestore.ts)
// instead of live Firestore -- every debug/re-run iteration against the
// same dump costs zero read quota. Falls back to live Firestore (and only
// then needs the service account credential) when the flag is absent.
const fromDumpArgIndex = process.argv.indexOf('--from-dump');
const dumpDir = fromDumpArgIndex !== -1 ? (process.argv[fromDumpArgIndex + 1] ?? 'firestore-dump') : null;

const config = JSON.parse(readFileSync('./firebase-applet-config.json', 'utf8'));
const firestore: Firestore | LocalDumpFirestore = dumpDir
  ? createLocalDumpFirestore(dumpDir)
  : (() => {
      const serviceAccount = JSON.parse(readFileSync('./scripts/service-account.json', 'utf8'));
      initializeApp({ credential: cert(serviceAccount), projectId: config.projectId });
      return getFirestore(config.firestoreDatabaseId);
    })();

// convertTimestamps (shared with dump-firestore.ts) mirrors
// src/platform/firestore/converters.ts::fromDoc's Timestamp handling -- see
// scripts/lib/convert-timestamps.ts for why this is needed at all. A dump
// already ran documents through it at dump time, so re-running it here on
// dump-backed reads is a harmless no-op (no Timestamp instances survive
// JSON serialization to begin with).
//
// Typed as a minimal structural shape rather than
// FirebaseFirestore.DocumentSnapshot so the same function works for both
// live Firestore reads and local-dump-firestore's fake snapshots.
function docData(doc: { data(): Record<string, unknown> | undefined }): Record<string, any> {
  return convertTimestamps(doc.data() ?? {}) as Record<string, any>;
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.');
}
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const APPLY = process.argv.includes('--apply');
const ALL_PROJECTS = process.argv.includes('--all-projects');
const projectArgIndex = process.argv.indexOf('--project');
const singleProjectId = projectArgIndex !== -1 ? process.argv[projectArgIndex + 1] : null;

const BATCH_SIZE = 500;

// ---- ID mapping (etl.id_mappings), idempotent across runs ----

const idCache = new Map<string, string>(); // `${collection}:${firestoreId}` -> new uuid

async function mapId(collectionName: string, firestoreId: string): Promise<string> {
  const cacheKey = `${collectionName}:${firestoreId}`;
  const cached = idCache.get(cacheKey);
  if (cached) return cached;

  // The lookup is a read, safe in report-only mode. Only the insert below
  // is gated behind --apply -- a report-only run must never write to
  // Postgres at all, including this bookkeeping table.
  const { data: existing } = await supabase
    .schema('etl').from('id_mappings')
    .select('new_id').eq('collection_name', collectionName).eq('firestore_id', firestoreId).maybeSingle();
  if (existing) {
    idCache.set(cacheKey, existing.new_id);
    return existing.new_id;
  }

  if (!APPLY) {
    // Ephemeral, in-memory only -- not persisted, so a repeated report-only
    // run may show different ids across runs for docs not yet migrated.
    // That's fine for a dry-run report; only --apply's ids need to be stable.
    const ephemeral = randomUUID();
    idCache.set(cacheKey, ephemeral);
    return ephemeral;
  }

  // Upsert, not insert -- id_mappings' primary key is (collection_name,
  // firestore_id), and mapId() can genuinely be called twice concurrently
  // for the same pair (e.g. Promise.all(docs.map(...)) racing against a
  // network retry on the same request). The plain SELECT-then-INSERT above
  // is only a fast path for the common case; this is the actual guarantee
  // -- ON CONFLICT DO UPDATE with a no-op field re-write still returns the
  // existing row's new_id via RETURNING instead of throwing a duplicate-key
  // error out from under a concurrent caller.
  const { data: inserted, error } = await supabase
    .schema('etl').from('id_mappings')
    .upsert(
      { collection_name: collectionName, firestore_id: firestoreId },
      { onConflict: 'collection_name,firestore_id' },
    )
    .select('new_id').single();
  if (error) throw error;
  idCache.set(cacheKey, inserted.new_id);
  return inserted.new_id;
}

async function mapIdIfPresent(collectionName: string, firestoreId: string | undefined | null): Promise<string | null> {
  if (!firestoreId) return null;
  return mapId(collectionName, firestoreId);
}

// Some real Firestore documents have an explicit `null` stored for
// createdAt/updatedAt rather than simply omitting the field (confirmed by
// the ETL's first --apply run hitting a not-null violation on
// cost_codes.created_at) -- an explicit null bypasses the column's
// DEFAULT now(), unlike an omitted/undefined key. Falls back to "now" as
// a reasonable stamp for "we don't know when this was really created."
function orNow(value: string | null | undefined): string {
  return value ?? new Date().toISOString();
}

// ---- Load helper: chunked insert, report-only unless --apply ----

interface LoadStats { collection: string; read: number; loaded: number; }
const stats: LoadStats[] = [];

// Firestore doesn't enforce types, so real documents have empty strings
// ("") sitting in fields that should be a date, number, or absent entirely
// -- Postgres rejects "" for date/numeric/uuid columns (unlike null, which
// is fine for nullable columns). Blanket-converts exactly-empty strings to
// null before every load rather than chasing each date/numeric field
// individually across ~20 migration functions. Deliberate simplification:
// for the handful of genuine optional text fields (description, note,
// scope) this also turns "" into null, which is an acceptable semantic
// merge for this app -- nothing here distinguishes "explicitly blank" from
// "no value" in a way that matters.
function blankStringsToNull(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    out[key] = value === '' ? null : value;
  }
  return out;
}

async function loadRows(table: string, rows: Record<string, unknown>[]): Promise<void> {
  stats.push({ collection: table, read: rows.length, loaded: APPLY ? rows.length : 0 });
  if (!APPLY || rows.length === 0) return;
  const sanitized = rows.map(blankStringsToNull);
  for (let i = 0; i < sanitized.length; i += BATCH_SIZE) {
    const chunk = sanitized.slice(i, i + BATCH_SIZE);
    // Upsert on id, not a plain insert -- ids are already stable across runs
    // via etl.id_mappings, so a retry after a partial failure (a later
    // collection erroring after earlier ones already loaded) re-applies the
    // same rows instead of hitting duplicate-key errors on what succeeded
    // last time.
    const { error } = await supabase.from(table).upsert(chunk, { onConflict: 'id' });
    if (error) throw new Error(`Insert into ${table} failed: ${error.message}`);
  }
}

// ---- Per-collection migration functions, in dependency order ----

// Returns false when the enterprise doc referenced by a project doesn't
// actually exist in Firestore -- a genuinely orphaned reference in the
// source data (same class of bug as the costCodeId ambiguity that started
// this whole migration, just one level up the hierarchy). Callers must
// check this before migrating the project itself: mapId() still hands
// back a stable uuid for a non-existent Firestore doc, so proceeding
// anyway would insert a project with a dangling enterprise_id FK.
async function migrateEnterprise(enterpriseId: string): Promise<boolean> {
  const snap = await firestore.collection('enterprises').doc(enterpriseId).get();
  if (!snap.exists) return false;
  const data = docData(snap)!;
  const id = await mapId('enterprises', enterpriseId);
  const row = camelToRow({
    id,
    name: data.name,
    enterpriseCode: data.enterpriseId,
    logoUrl: data.logoURL,
    theme: data.theme,
    projectAttributes: data.projectAttributes ?? [],
    lineItemAttributes: data.lineItemAttributes ?? [],
    costCodeAttributes: data.costCodeAttributes ?? [],
    subcontractAttributes: data.subcontractAttributes ?? [],
    changeAttributes: data.changeAttributes ?? [],
    riskAttributes: data.riskAttributes ?? [],
    procurementAttributes: data.procurementAttributes ?? [],
    progressAttributes: data.progressAttributes ?? [],
    changeTypes: data.changeTypes ?? [],
    riskTypes: data.riskTypes ?? [],
    resourceRates: data.resourceRates ?? [],
    costElements: data.costElements ?? [],
    categories: data.categories ?? [],
    controlAccounts: data.controlAccounts ?? [],
    orderNumbers: data.orderNumbers ?? [],
    createdAt: orNow(data.createdAt),
  });
  await loadRows('enterprises', [row]);

  // Vendors are embedded on Enterprise.vendors[] in Firestore, but their own
  // table in Postgres (subcontracts/invoices FK to them directly).
  const vendors = (data.vendors ?? []) as Array<Record<string, unknown>>;
  const vendorRows = (await Promise.all(vendors.map(async (v) => {
    if (!v.id) {
      console.warn(`  [warn] enterprises/${enterpriseId} has a vendor entry with no id -- skipping rather than fabricating one`);
      return null;
    }
    const vendorId = await mapId('vendors', v.id as string);
    return camelToRow({
      id: vendorId, enterpriseId: id, name: v.name, code: v.code,
      contactEmail: v.contactEmail, contactName: v.contactName,
    });
  }))).filter((r): r is Record<string, unknown> => r !== null);
  await loadRows('vendors', vendorRows);
  return true;
}

async function migrateProject(projectId: string): Promise<{ enterpriseId: string }> {
  const snap = await firestore.collection('projects').doc(projectId).get();
  if (!snap.exists) throw new Error(`Project ${projectId} not found`);
  const data = docData(snap)!;
  const id = await mapId('projects', projectId);
  const enterpriseId = await mapId('enterprises', data.enterpriseId);
  const row = camelToRow({
    id, enterpriseId,
    projectName: data.projectName,
    projectCode: data.projectCode,
    status: data.status,
    projectBudget: data.projectBudget ?? 0,
    startDate: data.startDate,
    endDate: data.endDate,
    cutoffDate: data.cutoffDate,
    attributes: data.attributes ?? {},
    photoUrl: data.photoURL,
    scopeDescription: data.scopeDescription,
    clientName: data.clientName,
    projectManagerName: data.projectManagerName,
    createdByEmail: data.createdByEmail,
    modifiedByEmail: data.modifiedByEmail,
    categories: data.categories ?? [],
    controlAccounts: data.controlAccounts ?? [],
    orderNumbers: data.orderNumbers ?? [],
    costElements: data.costElements ?? [],
    costCodeAttributes: data.costCodeAttributes ?? [],
    subcontractAttributes: data.subcontractAttributes ?? [],
    changeAttributes: data.changeAttributes ?? [],
    riskAttributes: data.riskAttributes ?? [],
    procurementAttributes: data.procurementAttributes ?? [],
    progressAttributes: data.progressAttributes ?? [],
    procurementDefaults: data.procurementDefaults ?? {},
    changeTypes: data.changeTypes ?? [],
    riskTypes: data.riskTypes ?? [],
    lineItemAttributes: data.lineItemAttributes ?? [],
    resourceRates: data.resourceRates ?? [],
    reportingPeriods: data.reportingPeriods ?? {},
    progressPeriods: data.progressPeriods ?? {},
    firstCostReportingMonth: data.firstCostReportingMonth,
    currentReportingMonth: data.currentReportingMonth,
    lastReportingMonth: data.lastReportingMonth,
    createdAt: orNow(data.dateCreated),
    updatedAt: orNow(data.dateLastModified),
    // created_by / modified_by (auth.users FKs) intentionally left null --
    // see the file header on user-dependent tables.
  });
  await loadRows('projects', [row]);
  return { enterpriseId };
}

async function migrateCalendars(projectId: string, newProjectId: string): Promise<void> {
  const snap = await firestore.collection('calendars').where('projectId', '==', projectId).get();
  const rows = await Promise.all(snap.docs.map(async (d) => {
    const data = docData(d);
    const id = await mapId('calendars', d.id);
    return camelToRow({
      id, projectId: newProjectId, enterpriseId: null,
      name: data.name, weekends: data.weekends ?? [], holidays: data.holidays ?? [],
      createdAt: orNow(data.createdAt),
    });
  }));
  await loadRows('calendars', rows);
}

async function migrateProcurementStepDefinitions(projectId: string, newProjectId: string): Promise<Map<string, string>> {
  const snap = await firestore.collection('procurementStepDefinitions').where('projectId', '==', projectId).get();
  const idMap = new Map<string, string>();
  const rows = (await Promise.all(snap.docs.map(async (d) => {
    const data = docData(d);
    if (!data.name) {
      console.warn(`  [warn] procurementStepDefinitions/${d.id} has no name -- skipping rather than fabricating a step label`);
      return null;
    }
    const id = await mapId('procurementStepDefinitions', d.id);
    idMap.set(d.id, id);
    return camelToRow({
      id, projectId: newProjectId, enterpriseId: null,
      name: data.name, order: data.order,
      isEnterpriseStandard: data.isEnterpriseStandard ?? false,
      defaultDurationDays: data.defaultDurationDays,
      enterpriseStepId: null, // cross-project enterprise-standard linkage resolved in a later pass if needed
    });
  }))).filter((r): r is Record<string, unknown> => r !== null);
  await loadRows('procurement_step_definitions', rows);
  return idMap;
}

interface CostCodeMaps { idMap: Map<string, string>; codeMap: Map<string, string>; }

async function migrateCostCodes(projectId: string, newProjectId: string): Promise<CostCodeMaps> {
  const snap = await firestore.collection('costCodes').where('projectId', '==', projectId).get();
  const idMap = new Map<string, string>(); // firestore doc id -> new uuid
  const codeMap = new Map<string, string>(); // human code -> new uuid (for etc_details/cost_phasing keyed by code)
  const rows = await Promise.all(snap.docs.map(async (d) => {
    const data = docData(d);
    const id = await mapId('costCodes', d.id);
    idMap.set(d.id, id);
    codeMap.set(data.code, id);
    if (!data.name) {
      console.warn(`  [warn] cost code ${d.id} (code "${data.code}") has no name in Firestore -- using code as a placeholder`);
    }
    return camelToRow({
      id, projectId: newProjectId, code: data.code, name: data.name || data.code || '(unnamed)',
      enterpriseAttributes: data.enterpriseAttributes ?? {},
      projectAttributes: data.projectAttributes ?? {},
      eacMethod: data.eacMethod ?? 'Auto',
      sortOrder: data.sortOrder, activityId: data.activityId,
      plannedStartDate: data.plannedStartDate, plannedEndDate: data.plannedEndDate,
      baselineBudget: data.baselineBudget ?? 0,
      approvedBudgetPrevious: data.approvedBudgetPrevious,
      approvedBudgetMovement: data.approvedBudgetMovement,
      estimateAtCompletionPrevious: data.estimateAtCompletionPrevious,
      estimateAtCompletionMovement: data.estimateAtCompletionMovement,
      costVariancePrevious: data.costVariancePrevious,
      costVarianceMovement: data.costVarianceMovement,
      createdAt: orNow(data.createdAt), updatedAt: orNow(data.updatedAt),
      // approvedBudget/actualCostToDate/estimateToComplete/estimateAtCompletion/
      // costVariance/budgetChanges are compute-on-read (Phase 13.B1) -- not
      // stored, matching the schema's own single-source-of-truth design.
    });
  }));
  await loadRows('cost_codes', rows);
  return { idMap, codeMap };
}

async function migrateSheets(projectId: string, newProjectId: string): Promise<Map<string, string>> {
  const snap = await firestore.collection('sheets').where('projectId', '==', projectId).get();
  const idMap = new Map<string, string>();
  const rows = await Promise.all(snap.docs.map(async (d) => {
    const data = docData(d);
    const id = await mapId('sheets', d.id);
    idMap.set(d.id, id);
    return camelToRow({
      id, projectId: newProjectId, sheetName: data.sheetName,
      forecastMethod: data.forecastMethod ?? 'Manual', version: data.version ?? '1',
      lockedStatus: data.lockedStatus ?? false, createdBy: null,
      users: [], createdAt: orNow(data.createdAt), updatedAt: orNow(data.updatedAt),
    });
  }));
  await loadRows('sheets', rows);
  return idMap;
}

async function migrateForecastRows(sheetsIdMap: Map<string, string>): Promise<void> {
  const allRows: Record<string, unknown>[] = [];
  for (const [firestoreSheetId, newSheetId] of sheetsIdMap) {
    const rowsSnap = await firestore.collection('sheets').doc(firestoreSheetId).collection('rows').get();
    for (const d of rowsSnap.docs) {
      const data = docData(d);
      allRows.push(camelToRow({
        id: await mapId('forecastRows', d.id), sheetId: newSheetId,
        costCode: data.costCode, description: data.description, vendor: data.vendor,
        qty: data.qty, rate: data.rate, budget: data.budget ?? 0,
        committedCost: data.committedCost ?? 0, actualCostToDate: data.actualCostToDate ?? 0,
        costToGo: data.costToGo ?? 0, eac: data.eac ?? 0,
        startDate: data.startDate, endDate: data.endDate,
        timePhasing: data.timePhasing ?? {}, distributionMethod: data.distributionMethod ?? 'Even',
        enterpriseCostCodeAttributes: data.enterpriseCostCodeAttributes ?? {},
        enterpriseLineItemAttributes: data.enterpriseLineItemAttributes ?? {},
        enterpriseSubcontractAttributes: data.enterpriseSubcontractAttributes ?? {},
        enterpriseChangeAttributes: data.enterpriseChangeAttributes ?? {},
        projectAttributes: data.projectAttributes ?? {},
      }));
    }
  }
  await loadRows('forecast_rows', allRows);
}

async function migrateEtcDetails(projectId: string, newProjectId: string, costCodeIdMap: Map<string, string>, costCodeCodeMap: Map<string, string>): Promise<void> {
  const snap = await firestore.collection('etcDetails').where('projectId', '==', projectId).get();
  const rows = (await Promise.all(snap.docs.map(async (d) => {
    const data = docData(d);
    const costCodeId = costCodeCodeMap.get(data.costCode);
    if (!costCodeId) {
      console.warn(`  [warn] etcDetails/${d.id} references cost code "${data.costCode}", which doesn't resolve -- skipping rather than inserting a dangling reference`);
      return null;
    }
    const id = await mapId('etcDetails', d.id);
    return camelToRow({
      id, projectId: newProjectId,
      costCodeId, // EtcDetail keys by code, not id -- resolved above
      costCode: data.costCode, calendarId: null, category: data.category,
      item: data.item, description: data.description, orderNumber: data.orderNumber,
      udf1: data.udf1, udf2: data.udf2, udf3: data.udf3, udf4: data.udf4,
      qty: data.qty, unit: data.unit, rate: data.rate,
      phasingMethod: data.phasingMethod ?? 'Manual',
      phasingStartDate: data.phasingStartDate, phasingEndDate: data.phasingEndDate,
      activityId: data.activityId, phasingUnit: data.phasingUnit ?? 'Total',
      phasingQty: data.phasingQty ?? 0,
      enterpriseAttributes: data.enterpriseAttributes ?? {},
      projectAttributes: data.projectAttributes ?? {},
      periodValues: data.periodValues ?? {}, sortOrder: data.sortOrder ?? 0,
      createdAt: orNow(data.createdAt), updatedAt: orNow(data.updatedAt),
      isEnterpriseResource: data.isEnterpriseResource ?? false,
      resourceId: data.resourceId, totalEtcPrevious: data.totalEtcPrevious,
    });
  }))).filter((r): r is Record<string, unknown> => r !== null);
  await loadRows('etc_details', rows);
}

async function migrateActualCosts(projectId: string, newProjectId: string, costCodeIdMap: Map<string, string>, costCodeCodeMap: Map<string, string>): Promise<void> {
  const snap = await firestore.collection('actualCosts').where('projectId', '==', projectId).get();
  const rows = (await Promise.all(snap.docs.map(async (d) => {
    const data = docData(d);
    const costCodeId = costCodeIdMap.get(data.costCodeId) ?? costCodeCodeMap.get(data.costCodeId);
    if (!costCodeId) return null; // orphaned reference -- see normalize-costcode-fk.ts's philosophy, skip rather than guess
    // Real Firestore docs store these as reportingPeriodId/cost, not
    // period/amount -- confirmed by inspecting live data (2026-07-13).
    // The old field names never matched anything, so every actualCosts
    // record either got skipped ("has no period") or, worse, got inserted
    // with amount defaulting to 0 -- a fabricated zero for real financial
    // data, not a skip.
    if (!data.reportingPeriodId) {
      console.warn(`  [warn] actualCosts/${d.id} has no reportingPeriodId -- skipping rather than guessing which reporting period it belongs to`);
      return null;
    }
    if (data.cost === undefined || data.cost === null) {
      console.warn(`  [warn] actualCosts/${d.id} has no cost -- skipping rather than fabricating a $0 amount`);
      return null;
    }
    return camelToRow({
      id: await mapId('actualCosts', d.id), projectId: newProjectId, costCodeId,
      period: data.reportingPeriodId, amount: data.cost, description: data.description,
      createdAt: orNow(data.createdAt),
    });
  }))).filter((r): r is Record<string, unknown> => r !== null);
  await loadRows('actual_costs', rows);
}

async function migrateBaselineBudgets(projectId: string, newProjectId: string, costCodeIdMap: Map<string, string>, costCodeCodeMap: Map<string, string>): Promise<void> {
  const snap = await firestore.collection('baselineBudgets').where('projectId', '==', projectId).get();
  const rows = (await Promise.all(snap.docs.map(async (d) => {
    const data = docData(d);
    const costCodeId = costCodeIdMap.get(data.costCodeId) ?? costCodeCodeMap.get(data.costCodeId);
    if (!costCodeId) return null;
    return camelToRow({
      id: await mapId('baselineBudgets', d.id), projectId: newProjectId, costCodeId,
      amount: data.amount ?? 0, effectiveDate: data.effectiveDate, createdAt: orNow(data.createdAt),
    });
  }))).filter((r): r is Record<string, unknown> => r !== null);
  await loadRows('baseline_budgets', rows);
}

async function migrateCostPhasing(projectId: string, newProjectId: string, costCodeIdMap: Map<string, string>, costCodeCodeMap: Map<string, string>): Promise<void> {
  const snap = await firestore.collection('costPhasing').where('projectId', '==', projectId).get();
  const rows = (await Promise.all(snap.docs.map(async (d) => {
    const data = docData(d);
    const costCodeId = costCodeIdMap.get(data.costCodeId) ?? costCodeCodeMap.get(data.costCodeId);
    if (!costCodeId) return null;
    return camelToRow({
      id: await mapId('costPhasing', d.id), projectId: newProjectId, costCodeId,
      periodValues: data.periodValues ?? {}, distributionMethod: data.distributionMethod ?? 'Even',
      createdAt: orNow(data.createdAt), updatedAt: orNow(data.updatedAt),
    });
  }))).filter((r): r is Record<string, unknown> => r !== null);
  await loadRows('cost_phasing', rows);
}

async function migratePeriodSnapshots(projectId: string, newProjectId: string): Promise<void> {
  const snap = await firestore.collection('periodSnapshots').where('projectId', '==', projectId).get();
  const rows = await Promise.all(snap.docs.map(async (d) => {
    const data = docData(d);
    if (!data.periodId) {
      console.warn(`  [warn] periodSnapshots/${d.id} has no periodId -- skipping rather than guessing which period it belongs to`);
      return null;
    }
    return camelToRow({
      id: await mapId('periodSnapshots', d.id), projectId: newProjectId,
      periodId: data.periodId, periodName: data.periodName,
      costCodes: data.costCodes ?? [], createdAt: orNow(data.createdAt),
    });
  }));
  await loadRows('period_snapshots', rows.filter((r) => r !== null));
}

async function migrateRisksAndRecords(projectId: string, newProjectId: string, costCodeIdMap: Map<string, string>): Promise<void> {
  const risksSnap = await firestore.collection('risks').where('projectId', '==', projectId).get();
  const riskIdMap = new Map<string, string>();
  const riskRows = (await Promise.all(risksSnap.docs.map(async (d) => {
    const data = docData(d);
    if (!data.description) {
      console.warn(`  [warn] risks/${d.id} has no description -- skipping rather than fabricating substantive content`);
      return null;
    }
    if (!data.riskId) {
      console.warn(`  [warn] risks/${d.id} has no riskId (the human-facing risk code) -- skipping rather than fabricating one`);
      return null;
    }
    const id = await mapId('risks', d.id);
    riskIdMap.set(d.id, id);
    return camelToRow({
      id, projectId: newProjectId, riskCode: data.riskId, description: data.description,
      type: data.type, status: data.status ?? 'Open', strategy: data.strategy,
      initiator: data.initiator, reference: data.reference,
      mitigation: data.mitigation, residualExposure: data.residualExposure,
      periodId: data.periodId,
      enterpriseAttributes: data.enterpriseAttributes ?? {},
      projectAttributes: data.projectAttributes ?? {},
      createdAt: orNow(data.createdAt), updatedAt: orNow(data.updatedAt),
    });
  }))).filter((r): r is Record<string, unknown> => r !== null);
  await loadRows('risks', riskRows);

  const recordRows: Record<string, unknown>[] = [];
  for (const [firestoreRiskId, newRiskId] of riskIdMap) {
    const recSnap = await firestore.collection('riskRecords').where('riskId', '==', firestoreRiskId).get();
    for (const d of recSnap.docs) {
      const data = docData(d);
      // Two riskRecords shapes exist in real data (confirmed against a live
      // export 2026-07-14, see JOURNAL.md): the older/majority shape has
      // probability + a single impactAmount, with no separate min/likely/max
      // at all. The Postgres column is a true three-point beta-PERT input
      // (min_impact_amount/most_likely_impact_amount/max_impact_amount),
      // confirmed against Tarek's own formula. Rather than silently default
      // the missing min/likely/max to 0 (which would understate every
      // pre-existing risk record's exposure to zero), collapse the old
      // shape's single impactAmount into a degenerate three-point estimate
      // (min = likely = max = impactAmount) -- the formula
      // (min + 4*likely + max)/6 * probability reduces to exactly
      // impactAmount * probability in that case, i.e. precisely what the
      // old shape's data already meant under the simpler model.
      //
      // A newer shape also exists (2 projects) with betaPertMin/
      // betaPertMostLikely/betaPertMax but no probability field at all
      // (only an unrelated `likelihood` field Tarek confirmed shouldn't
      // exist) -- skipped below rather than guessing a probability, pending
      // his answer on whether there's an intended default.
      const min = data.minImpactAmount ?? data.betaPertMin ?? data.impactAmount;
      const mostLikely = data.mostLikelyImpactAmount ?? data.betaPertMostLikely ?? data.impactAmount;
      const max = data.maxImpactAmount ?? data.betaPertMax ?? data.impactAmount;
      if (min === undefined || mostLikely === undefined || max === undefined) {
        console.warn(`  [warn] riskRecords/${d.id} has no min/most-likely/max impact amount (and no impactAmount to fall back to) -- skipping rather than fabricating one`);
        continue;
      }
      if (data.probability === undefined || data.probability === null) {
        console.warn(`  [warn] riskRecords/${d.id} has no probability -- skipping rather than guessing one (pending confirmation on how the newer risk-record shape's likelihood maps to a probability, if at all)`);
        continue;
      }
      const costCodeId = costCodeIdMap.get(data.costCodeId) ?? null;
      // min/mostLikely/max/probability -> risk_model + model_inputs jsonb,
      // not fixed columns -- see supabase/migrations/0037_risk_model_flexibility.sql
      // and src/domain/risk.ts. Every real riskRecords doc seen so far
      // (both the old single-impactAmount shape and the newer
      // betaPertMin/MostLikely/Max shape) reduces to the same
      // beta_pert_3point model once normalized above; a future model would
      // need its own branch here once one actually exists.
      recordRows.push(toRow<Record<string, unknown>>({
        id: await mapId('riskRecords', d.id), riskId: newRiskId, projectId: newProjectId,
        costCodeId, scope: data.scope,
        enterpriseAttributes: data.enterpriseAttributes ?? {},
        projectAttributes: data.projectAttributes ?? {},
        probability: data.probability,
        riskModel: 'beta_pert_3point',
        modelInputs: { min, mostLikely, max },
        createdAt: orNow(data.createdAt), updatedAt: orNow(data.updatedAt),
      }));
    }
  }
  await loadRows('risk_records', recordRows);
}

async function migrateChangesAndRecords(projectId: string, newProjectId: string, costCodeIdMap: Map<string, string>): Promise<void> {
  const changesSnap = await firestore.collection('changes').where('projectId', '==', projectId).get();
  const changeIdMap = new Map<string, string>();
  const changeRows = await Promise.all(changesSnap.docs.map(async (d) => {
    const data = docData(d);
    const id = await mapId('changes', d.id);
    changeIdMap.set(d.id, id);
    return camelToRow({
      id, projectId: newProjectId, changeCode: data.changeId,
      description: data.description, status: data.status,
      enterpriseAttributes: data.enterpriseAttributes ?? {},
      projectAttributes: data.projectAttributes ?? {},
      createdAt: orNow(data.createdAt), updatedAt: orNow(data.updatedAt),
    });
  }));
  await loadRows('changes', changeRows);

  const recordRows: Record<string, unknown>[] = [];
  for (const [firestoreChangeId, newChangeId] of changeIdMap) {
    const recSnap = await firestore.collection('changeRecords').where('changeId', '==', firestoreChangeId).get();
    for (const d of recSnap.docs) {
      const data = docData(d);
      const costCodeId = costCodeIdMap.get(data.costCodeId) ?? null;
      recordRows.push(camelToRow({
        id: await mapId('changeRecords', d.id), changeId: newChangeId, projectId: newProjectId,
        costCodeId, budgetAmount: data.budgetAmount ?? 0, eacAmount: data.eacAmount ?? 0,
        enterpriseAttributes: data.enterpriseAttributes ?? {},
        projectAttributes: data.projectAttributes ?? {},
        createdAt: orNow(data.createdAt), updatedAt: orNow(data.updatedAt),
      }));
    }
  }
  await loadRows('change_records', recordRows);
}

async function migrateProgressDomain(projectId: string, newProjectId: string, costCodeIdMap: Map<string, string>): Promise<void> {
  const rulesSnap = await firestore.collection('rulesOfCredit').where('projectId', '==', projectId).get();
  const ruleIdMap = new Map<string, string>();
  const ruleRows = (await Promise.all(rulesSnap.docs.map(async (d) => {
    const data = docData(d);
    if (!data.ruleId) {
      console.warn(`  [warn] rulesOfCredit/${d.id} has no ruleId (the human-facing rule code) -- skipping rather than fabricating one`);
      return null;
    }
    if (!data.description) {
      console.warn(`  [warn] rulesOfCredit/${d.id} has no description -- skipping rather than fabricating substantive content`);
      return null;
    }
    const id = await mapId('rulesOfCredit', d.id);
    ruleIdMap.set(d.id, id);
    return camelToRow({
      id, projectId: newProjectId, ruleCode: data.ruleId, description: data.description,
      packageId: null, // resolved after packages are migrated, if needed
      userField1: data.userField1, userField2: data.userField2, userField3: data.userField3,
      userField4: data.userField4, userField5: data.userField5, createdAt: orNow(data.createdAt),
    });
  }))).filter((r) => r !== null);
  await loadRows('rules_of_credit', ruleRows);

  const stepRows: Record<string, unknown>[] = [];
  for (const [firestoreRuleId, newRuleId] of ruleIdMap) {
    const ruleData = docData(rulesSnap.docs.find((d) => d.id === firestoreRuleId)!);
    for (const step of (ruleData.steps ?? []) as Array<Record<string, unknown>>) {
      stepRows.push(camelToRow({
        id: await mapId('ruleOfCreditSteps', step.id as string), ruleOfCreditId: newRuleId,
        orderNo: step.orderNo, description: step.description, weight: step.weight,
      }));
    }
  }
  await loadRows('rule_of_credit_steps', stepRows);

  const packagesSnap = await firestore.collection('progressPackages').where('projectId', '==', projectId).get();
  const packageIdMap = new Map<string, string>();
  const packageRows = (await Promise.all(packagesSnap.docs.map(async (d) => {
    const data = docData(d);
    // Validate before mapId()/packageIdMap.set() -- progress_items below
    // resolves packageDocId through packageIdMap, so a skipped-but-already-
    // mapped package would leave items pointing at a row never inserted.
    if (!data.packageId) {
      console.warn(`  [warn] progressPackages/${d.id} has no packageId (the human-facing package code) -- skipping rather than fabricating one`);
      return null;
    }
    if (!data.description) {
      console.warn(`  [warn] progressPackages/${d.id} has no description -- skipping rather than fabricating substantive content`);
      return null;
    }
    const id = await mapId('progressPackages', d.id);
    packageIdMap.set(d.id, id);
    return camelToRow({
      id, projectId: newProjectId, packageCode: data.packageId, description: data.description,
      ruleOfCreditId: data.ruleOfCreditId ? ruleIdMap.get(data.ruleOfCreditId) ?? null : null,
      unit: data.unit, attributes: data.attributes ?? {},
      defaultStartDate: data.defaultStartDate, defaultEndDate: data.defaultEndDate,
      defaultPhasingMethod: data.defaultPhasingMethod, defaultPhasingCurve: data.defaultPhasingCurve,
      createdAt: orNow(data.createdAt), updatedAt: orNow(data.updatedAt),
    });
  }))).filter((r): r is Record<string, unknown> => r !== null);
  await loadRows('progress_packages', packageRows);

  // Single project-scoped query, filtered by packageDocId in memory below --
  // the previous per-package compound where('projectId', ...).where('packageDocId', ...)
  // requires a composite index that was never deployed (missing from
  // firestore.indexes.json), so it threw FAILED_PRECONDITION on every project,
  // silently skipping every progress item (and, since the throw happened
  // inside migrateProgressDomain before the code below it ran, every
  // reporting period and attribute too). This form also costs one read per
  // project instead of one per package, which matters given the quota.
  const itemRows: Record<string, unknown>[] = [];
  const allItemsSnap = await firestore.collection('progressItems').where('projectId', '==', projectId).get();
  for (const d of allItemsSnap.docs) {
    const data = docData(d);
    const newPackageId = data.packageDocId ? packageIdMap.get(data.packageDocId) : undefined;
    if (!newPackageId) continue; // orphaned reference, skip rather than guess
    const costCodeId = costCodeIdMap.get(data.costCodeId);
    if (!costCodeId) continue; // orphaned reference, skip rather than guess
    itemRows.push(camelToRow({
      id: await mapId('progressItems', d.id), projectId: newProjectId, packageId: newPackageId,
      itemCode: data.itemId, activityId: data.activityId, description: data.description, costCodeId,
      totalQty: data.totalQty ?? 0, totalQtyPrevious: data.totalQtyPrevious, earnedQtyPrevious: data.earnedQtyPrevious,
      plannedStartDate: data.plannedStartDate, plannedEndDate: data.plannedEndDate,
      phasingMethod: data.phasingMethod ?? 'Auto', phasingCurve: data.phasingCurve ?? 'even',
      projectAttributes: data.projectAttributes ?? {}, enterpriseAttributes: data.enterpriseAttributes ?? {},
      ruleOfCreditId: data.ruleOfCreditId ? ruleIdMap.get(data.ruleOfCreditId) ?? null : null,
      ruleOfCreditProgress: data.ruleOfCreditProgress ?? {}, periodValues: data.periodValues ?? {},
      currentStartDate: data.currentStartDate, currentEndDate: data.currentEndDate,
      currentPhasingMethod: data.currentPhasingMethod, currentPhasingCurve: data.currentPhasingCurve,
      currentPeriodValues: data.currentPeriodValues ?? {}, actualPeriodValues: data.actualPeriodValues ?? {},
      sortOrder: data.sortOrder, createdAt: orNow(data.createdAt), updatedAt: orNow(data.updatedAt),
    }));
  }
  await loadRows('progress_items', itemRows);

  const periodsSnap = await firestore.collection('progressReportingPeriods').where('projectId', '==', projectId).get();
  const periodRows = (await Promise.all(periodsSnap.docs.map(async (d) => {
    const data = docData(d);
    if (!data.periodName) {
      console.warn(`  [warn] progressReportingPeriods/${d.id} has no periodName -- skipping rather than fabricating one`);
      return null;
    }
    return camelToRow({
      id: await mapId('progressReportingPeriods', d.id), projectId: newProjectId,
      periodName: data.periodName, startDate: data.startDate, endDate: data.endDate,
      status: data.status ?? 'Open', createdAt: orNow(data.createdAt),
    });
  }))).filter((r): r is Record<string, unknown> => r !== null);
  await loadRows('progress_reporting_periods', periodRows);

  const attrsSnap = await firestore.collection('progressAttributes').where('projectId', '==', projectId).get();
  const attrRows = await Promise.all(attrsSnap.docs.map(async (d) => {
    const data = docData(d);
    return camelToRow({
      id: await mapId('progressAttributes', d.id), projectId: newProjectId,
      title: data.title, type: data.type, values: data.values ?? [],
    });
  }));
  await loadRows('progress_attributes', attrRows);
}

async function migrateScheduleItems(projectId: string, newProjectId: string): Promise<void> {
  const snap = await firestore.collection('scheduleItems').where('projectId', '==', projectId).get();
  const rows = (await Promise.all(snap.docs.map(async (d) => {
    const data = docData(d);
    if (!data.activityId) {
      console.warn(`  [warn] scheduleItems/${d.id} has no activityId -- skipping rather than leaving the record unidentifiable`);
      return null;
    }
    return camelToRow({
      id: await mapId('scheduleItems', d.id), projectId: newProjectId,
      activityId: data.activityId, description: data.description,
      activityPercentComplete: data.activityPercentComplete ?? 0,
      baselineStartDate: data.baselineStartDate, baselineEndDate: data.baselineEndDate,
      plannedStartDate: data.plannedStartDate, plannedEndDate: data.plannedEndDate,
      currentStartDate: data.currentStartDate, currentEndDate: data.currentEndDate,
      updatedAt: orNow(data.updatedAt),
    });
  }))).filter((r): r is Record<string, unknown> => r !== null);
  await loadRows('schedule_items', rows);
}

async function migrateProcurementItems(projectId: string, newProjectId: string, calendarIdMap: Map<string, string>): Promise<void> {
  const snap = await firestore.collection('procurementItems').where('projectId', '==', projectId).get();
  const rows = (await Promise.all(snap.docs.map(async (d) => {
    const data = docData(d);
    if (!data.description) {
      console.warn(`  [warn] procurementItems/${d.id} has no description -- skipping rather than fabricating substantive content`);
      return null;
    }
    return camelToRow({
      id: await mapId('procurementItems', d.id), projectId: newProjectId,
      packageId: data.packageId, description: data.description,
      calendarId: data.calendarId ? calendarIdMap.get(data.calendarId) ?? null : null,
      category: data.category,
      enterpriseAttributes: data.enterpriseAttributes ?? {},
      projectAttributes: data.projectAttributes ?? {},
      stepData: data.stepData ?? {}, createdAt: orNow(data.createdAt), updatedAt: orNow(data.updatedAt),
    });
  }))).filter((r): r is Record<string, unknown> => r !== null);
  await loadRows('procurement_items', rows);
}

async function migrateSubcontractsInvoicesAndLineItems(
  projectId: string, newProjectId: string, newEnterpriseId: string, costCodeIdMap: Map<string, string>,
): Promise<void> {
  const subsSnap = await firestore.collection('subcontracts').where('projectId', '==', projectId).get();
  const subIdMap = new Map<string, string>();
  const subRows = (await Promise.all(subsSnap.docs.map(async (d) => {
    const data = docData(d);
    // Validate before mapId()/subIdMap.set() -- both are relied on by line
    // items and invoices below, so a skipped-but-already-mapped subcontract
    // would leave them pointing at a row that was never actually inserted.
    if (!data.vendorId) {
      console.warn(`  [warn] subcontracts/${d.id} has no vendorId -- skipping rather than guessing which vendor it belongs to`);
      return null;
    }
    if (!data.orderName) {
      console.warn(`  [warn] subcontracts/${d.id} has no orderName -- skipping rather than fabricating one`);
      return null;
    }
    const id = await mapId('subcontracts', d.id);
    subIdMap.set(d.id, id);
    const vendorId = await mapId('vendors', data.vendorId);
    return camelToRow({
      id, projectId: newProjectId, enterpriseId: newEnterpriseId, orderCode: data.orderId,
      orderName: data.orderName, orderScope: data.orderScope, status: data.status ?? 'Active',
      defaultCostCodeId: data.defaultCostCodeId ? costCodeIdMap.get(data.defaultCostCodeId) ?? null : null,
      defaultPhasingSource: data.defaultPhasingSource, defaultStartDate: data.defaultStartDate,
      defaultEndDate: data.defaultEndDate, defaultDistribution: data.defaultDistribution,
      paymentType: data.paymentType, awardDate: data.awardDate, vendorId,
      vendorUsers: data.vendorUsers ?? [], totalAmount: data.totalAmount ?? 0,
      forecastChanges: data.forecastChanges,
      enterpriseSubcontractAttributes: data.enterpriseSubcontractAttributes ?? {},
      projectAttributes: data.projectAttributes ?? {},
      createdAt: orNow(data.createdAt), updatedAt: orNow(data.updatedAt),
      // createdBy (auth.users FK) intentionally left null for now.
    });
  }))).filter((r): r is Record<string, unknown> => r !== null);
  await loadRows('subcontracts', subRows);

  const lineItemIdMap = new Map<string, string>(); // firestore subcontract lineItem id -> new uuid
  const lineItemRows: Record<string, unknown>[] = [];
  for (const [firestoreSubId, newSubId] of subIdMap) {
    const subData = docData(subsSnap.docs.find((d) => d.id === firestoreSubId)!);
    for (const li of (subData.lineItems ?? []) as Array<Record<string, unknown>>) {
      const liId = await mapId('subcontractLineItems', li.id as string);
      lineItemIdMap.set(li.id as string, liId);
      lineItemRows.push(camelToRow({
        id: liId, subcontractId: newSubId, projectId: newProjectId,
        itemNo: li.itemNo, description: li.description, activityId: li.activityId,
        costCodeId: li.costCodeId ? costCodeIdMap.get(li.costCodeId as string) ?? null : null,
        date: li.date, qty: li.qty ?? 0, unit: li.unit, rate: li.rate ?? 0, total: li.total ?? 0,
        type: li.type ?? 'Original', status: li.status ?? 'Pending',
        startDate: li.startDate, endDate: li.endDate, phasingSource: li.phasingSource,
        distribution: li.distribution, periodValues: li.periodValues ?? {},
        enterpriseAttributes: li.enterpriseAttributes ?? {}, projectAttributes: li.projectAttributes ?? {},
        userDefined: li.userDefined ?? {}, note: li.note,
        createdAt: li.createdAt, updatedAt: li.updatedAt,
      }));
    }
  }
  await loadRows('subcontract_line_items', lineItemRows);

  const invoicesSnap = await firestore.collection('invoices').where('projectId', '==', projectId).get();
  const invoiceIdMap = new Map<string, string>();
  const invoiceRows = (await Promise.all(invoicesSnap.docs.map(async (d) => {
    const data = docData(d);
    const subcontractId = subIdMap.get(data.subcontractId);
    if (!subcontractId) return null; // orphaned reference, skip rather than guess
    if (!data.vendorId) {
      // Same mapId(collection, undefined) hazard as subcontracts above --
      // validate before mapId()/invoiceIdMap.set() for the same reason.
      console.warn(`  [warn] invoices/${d.id} has no vendorId -- skipping rather than guessing which vendor it belongs to`);
      return null;
    }
    const id = await mapId('invoices', d.id);
    invoiceIdMap.set(d.id, id);
    const vendorId = await mapId('vendors', data.vendorId);
    return camelToRow({
      id, subcontractId, projectId: newProjectId, enterpriseId: newEnterpriseId,
      invoiceCode: data.invoiceId, description: data.description,
      submittedDate: data.submittedDate, certifiedDate: data.certifiedDate, paymentDate: data.paymentDate,
      status: data.status ?? 'Draft', initiator: data.initiator, vendorId,
      totalAmount: data.totalAmount ?? 0, certifiedAmount: data.certifiedAmount ?? 0,
      createdAt: orNow(data.createdAt), updatedAt: orNow(data.updatedAt),
    });
  }))).filter((r): r is Record<string, unknown> => r !== null);
  await loadRows('invoices', invoiceRows);

  const invoiceItemRows: Record<string, unknown>[] = [];
  for (const [firestoreInvoiceId, newInvoiceId] of invoiceIdMap) {
    const invData = docData(invoicesSnap.docs.find((d) => d.id === firestoreInvoiceId)!);
    for (const item of (invData.items ?? []) as Array<Record<string, unknown>>) {
      const lineItemId = lineItemIdMap.get(item.subcontractLineItemId as string);
      if (!lineItemId) continue; // orphaned reference, skip rather than guess
      invoiceItemRows.push(camelToRow({
        id: await mapId('invoiceItems', item.id as string), invoiceId: newInvoiceId,
        subcontractLineItemId: lineItemId, itemNo: item.itemNo, description: item.description,
        qty: item.qty ?? 0, unit: item.unit, rate: item.rate ?? 0, total: item.total ?? 0, type: item.type,
        claimQty: item.claimQty ?? 0, claimPercent: item.claimPercent ?? 0, claimValue: item.claimValue ?? 0,
        periodicClaimQty: item.periodicClaimQty, periodicClaimPercent: item.periodicClaimPercent,
        periodicClaimValue: item.periodicClaimValue,
        certifiedQty: item.certifiedQty ?? 0, certifiedPercent: item.certifiedPercent ?? 0,
        certifiedValue: item.certifiedValue ?? 0,
        periodicCertifiedQty: item.periodicCertifiedQty, periodicCertifiedPercent: item.periodicCertifiedPercent,
        periodicCertifiedValue: item.periodicCertifiedValue, commentary: item.commentary,
      }));
    }
  }
  await loadRows('invoice_items', invoiceItemRows);
}

async function migrateAuditLogs(projectId: string, newProjectId: string, newEnterpriseId: string): Promise<void> {
  const snap = await firestore.collection('auditLogs')
    .where('projectId', '==', projectId).get();
  const rows = snap.docs.map((d) => {
    const data = docData(d);
    // No `id` key at all -- letting the column's own `default
    // gen_random_uuid()` apply. Setting id: undefined explicitly here
    // previously serialized to a literal null over the wire, which
    // overrides a DEFAULT the same way an explicit null does anywhere else
    // (same root cause as the createdAt/updatedAt null issue this session).
    return camelToRow({
      enterpriseId: newEnterpriseId, projectId: newProjectId,
      actorUserId: null, actorEmail: data.userEmail, action: data.action,
      details: data.details ?? {}, createdAt: orNow(data.timestamp),
    });
  });
  await loadRows('audit_logs', rows);
}

// ---- Orchestration ----

const failures: Array<{ step: string; error: string }> = [];

// One collection's data-quality surprise (a not-null violation, a bad type,
// etc.) used to abort the entire run at the first hit -- every fix meant
// another full round-trip. This runs every step to completion regardless,
// logging failures instead of throwing, and returns the fallback so
// downstream steps that depend on this one's output degrade gracefully
// (e.g. everything referencing cost codes just finds no matches and skips,
// rather than crashing on an undefined map) instead of also aborting.
// Supabase's PostgrestError (and similar API error shapes) aren't Error
// instances -- String(err) on a plain object produces the useless
// "[object Object]" instead of the actual message, hiding what really
// failed. Checking for a .message property directly (the common shape for
// non-Error API errors) before falling back to String().
function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === 'object' && 'message' in err) return String((err as { message: unknown }).message);
  // Fallback for plain objects with no .message (e.g. some Postgrest/gRPC
  // error shapes) -- String(err) on these produces the useless
  // "[object Object]", which happened here once already and hid the real
  // cause. JSON.stringify at least shows the actual shape.
  if (err && typeof err === 'object') {
    try {
      return JSON.stringify(err);
    } catch {
      // fall through to String(err) below (e.g. circular structure)
    }
  }
  return String(err);
}

async function safeStep<T>(label: string, fallback: T, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const message = errorMessage(err);
    console.error(`  [FAILED] ${label}: ${message}`);
    failures.push({ step: label, error: message });
    return fallback;
  }
}

async function migrateProjectFull(projectId: string): Promise<void> {
  console.log(`\n=== Project ${projectId} ===`);
  const projSnap = await firestore.collection('projects').doc(projectId).get();
  if (!projSnap.exists) { console.log('  not found, skipping'); return; }
  const enterpriseFirestoreId = docData(projSnap)!.enterpriseId;

  const enterpriseExists = await safeStep('enterprise', false, () => migrateEnterprise(enterpriseFirestoreId));
  if (!enterpriseExists) {
    console.warn(`  [warn] project ${projectId} references enterprise ${enterpriseFirestoreId}, which doesn't exist in Firestore -- skipping the whole project rather than inserting it with a dangling enterprise_id`);
    return;
  }
  const { enterpriseId: newEnterpriseId } = await safeStep('project', { enterpriseId: '' }, () => migrateProject(projectId));
  const newProjectId = await mapId('projects', projectId);

  await safeStep('calendars', undefined, () => migrateCalendars(projectId, newProjectId));
  const calendarsSnap = await firestore.collection('calendars').where('projectId', '==', projectId).get();
  const calendarIdMap = new Map<string, string>();
  for (const d of calendarsSnap.docs) calendarIdMap.set(d.id, await mapId('calendars', d.id));

  await safeStep('procurementStepDefinitions', undefined, () => migrateProcurementStepDefinitions(projectId, newProjectId));
  const { idMap: costCodeIdMap, codeMap: costCodeCodeMap } = await safeStep(
    'costCodes', { idMap: new Map<string, string>(), codeMap: new Map<string, string>() },
    () => migrateCostCodes(projectId, newProjectId)
  );
  const sheetsIdMap = await safeStep('sheets', new Map<string, string>(), () => migrateSheets(projectId, newProjectId));
  await safeStep('forecastRows', undefined, () => migrateForecastRows(sheetsIdMap));

  await safeStep('etcDetails', undefined, () => migrateEtcDetails(projectId, newProjectId, costCodeIdMap, costCodeCodeMap));
  await safeStep('actualCosts', undefined, () => migrateActualCosts(projectId, newProjectId, costCodeIdMap, costCodeCodeMap));
  await safeStep('baselineBudgets', undefined, () => migrateBaselineBudgets(projectId, newProjectId, costCodeIdMap, costCodeCodeMap));
  await safeStep('costPhasing', undefined, () => migrateCostPhasing(projectId, newProjectId, costCodeIdMap, costCodeCodeMap));
  await safeStep('periodSnapshots', undefined, () => migratePeriodSnapshots(projectId, newProjectId));

  await safeStep('risksAndRecords', undefined, () => migrateRisksAndRecords(projectId, newProjectId, costCodeIdMap));
  await safeStep('changesAndRecords', undefined, () => migrateChangesAndRecords(projectId, newProjectId, costCodeIdMap));
  await safeStep('progressDomain', undefined, () => migrateProgressDomain(projectId, newProjectId, costCodeIdMap));
  await safeStep('scheduleItems', undefined, () => migrateScheduleItems(projectId, newProjectId));
  await safeStep('procurementItems', undefined, () => migrateProcurementItems(projectId, newProjectId, calendarIdMap));
  await safeStep(
    'subcontractsInvoicesAndLineItems', undefined,
    () => migrateSubcontractsInvoicesAndLineItems(projectId, newProjectId, newEnterpriseId, costCodeIdMap)
  );
  await safeStep('auditLogs', undefined, () => migrateAuditLogs(projectId, newProjectId, newEnterpriseId));

  if (failures.length > 0) {
    console.log(`\n=== ${failures.length} step(s) failed for this project (see [FAILED] lines above) ===`);
  }
}

async function verify(): Promise<void> {
  console.log('\n=== Verification (Postgres row counts vs. rows this run reported) ===');
  for (const s of stats) {
    if (s.read === 0) continue;
    const { count } = await supabase.from(s.collection).select('*', { count: 'exact', head: true });
    const mark = APPLY ? (count !== null && count >= s.loaded ? 'OK' : 'MISMATCH') : 'n/a (report-only)';
    console.log(`  ${s.collection}: read ${s.read}, ${APPLY ? `loaded ${s.loaded}, table now has ${count}` : 'not applied'} [${mark}]`);
  }
}

async function main(): Promise<void> {
  console.log(APPLY ? 'Mode: APPLY (writing to Postgres)' : 'Mode: REPORT ONLY (no writes)');

  if (ALL_PROJECTS) {
    const projectsSnap = await firestore.collection('projects').get();
    for (const d of projectsSnap.docs) {
      // A fatal error at the top of migrateProjectFull (e.g. Firestore
      // quota exhaustion mid-run, confirmed by the first --all-projects
      // attempt) used to abort every remaining project, not just the one
      // that hit it -- the same "one bad step shouldn't block everything
      // else" fix already applied inside migrateProjectFull's own steps,
      // just one level up. A re-run is always safe regardless (idempotent
      // ids + upserts), so the remaining projects aren't lost either way,
      // but this means a single quota exhaustion doesn't waste the rest of
      // today's allowance on projects that would have succeeded.
      try {
        await migrateProjectFull(d.id);
      } catch (err) {
        const message = errorMessage(err);
        console.error(`  [FAILED] project ${d.id} did not complete: ${message}`);
        failures.push({ step: `project ${d.id}`, error: message });
      }
    }
  } else if (singleProjectId) {
    await migrateProjectFull(singleProjectId);
  } else {
    console.error('Usage: --project <projectId> [--apply]  or  --all-projects [--apply]');
    process.exit(1);
  }

  await verify();

  if (failures.length > 0) {
    console.log(`\n=== TOTAL: ${failures.length} failure(s) across this run ===`);
    for (const f of failures) console.log(`  - ${f.step}: ${f.error}`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('ETL failed:', err);
  process.exit(1);
});
