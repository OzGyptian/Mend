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

const serviceAccount = JSON.parse(readFileSync('./scripts/service-account.json', 'utf8'));
const config = JSON.parse(readFileSync('./firebase-applet-config.json', 'utf8'));
initializeApp({ credential: cert(serviceAccount), projectId: config.projectId });
const firestore: Firestore = getFirestore(config.firestoreDatabaseId);

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

  const { data: inserted, error } = await supabase
    .schema('etl').from('id_mappings')
    .insert({ collection_name: collectionName, firestore_id: firestoreId })
    .select('new_id').single();
  if (error) throw error;
  idCache.set(cacheKey, inserted.new_id);
  return inserted.new_id;
}

async function mapIdIfPresent(collectionName: string, firestoreId: string | undefined | null): Promise<string | null> {
  if (!firestoreId) return null;
  return mapId(collectionName, firestoreId);
}

// ---- Load helper: chunked insert, report-only unless --apply ----

interface LoadStats { collection: string; read: number; loaded: number; }
const stats: LoadStats[] = [];

async function loadRows(table: string, rows: Record<string, unknown>[]): Promise<void> {
  stats.push({ collection: table, read: rows.length, loaded: APPLY ? rows.length : 0 });
  if (!APPLY || rows.length === 0) return;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from(table).insert(chunk);
    if (error) throw new Error(`Insert into ${table} failed: ${error.message}`);
  }
}

// ---- Per-collection migration functions, in dependency order ----

async function migrateEnterprise(enterpriseId: string): Promise<void> {
  const snap = await firestore.collection('enterprises').doc(enterpriseId).get();
  if (!snap.exists) return;
  const data = snap.data()!;
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
    createdAt: data.createdAt,
  });
  await loadRows('enterprises', [row]);

  // Vendors are embedded on Enterprise.vendors[] in Firestore, but their own
  // table in Postgres (subcontracts/invoices FK to them directly).
  const vendors = (data.vendors ?? []) as Array<Record<string, unknown>>;
  const vendorRows = await Promise.all(vendors.map(async (v) => {
    const vendorId = await mapId('vendors', v.id as string);
    return camelToRow({
      id: vendorId, enterpriseId: id, name: v.name, code: v.code,
      contactEmail: v.contactEmail, contactName: v.contactName,
    });
  }));
  await loadRows('vendors', vendorRows);
}

async function migrateProject(projectId: string): Promise<{ enterpriseId: string }> {
  const snap = await firestore.collection('projects').doc(projectId).get();
  if (!snap.exists) throw new Error(`Project ${projectId} not found`);
  const data = snap.data()!;
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
    createdAt: data.dateCreated,
    updatedAt: data.dateLastModified,
    // created_by / modified_by (auth.users FKs) intentionally left null --
    // see the file header on user-dependent tables.
  });
  await loadRows('projects', [row]);
  return { enterpriseId };
}

async function migrateCalendars(projectId: string, newProjectId: string): Promise<void> {
  const snap = await firestore.collection('calendars').where('projectId', '==', projectId).get();
  const rows = await Promise.all(snap.docs.map(async (d) => {
    const data = d.data();
    const id = await mapId('calendars', d.id);
    return camelToRow({
      id, projectId: newProjectId, enterpriseId: null,
      name: data.name, weekends: data.weekends ?? [], holidays: data.holidays ?? [],
      createdAt: data.createdAt,
    });
  }));
  await loadRows('calendars', rows);
}

async function migrateProcurementStepDefinitions(projectId: string, newProjectId: string): Promise<Map<string, string>> {
  const snap = await firestore.collection('procurementStepDefinitions').where('projectId', '==', projectId).get();
  const idMap = new Map<string, string>();
  const rows = await Promise.all(snap.docs.map(async (d) => {
    const data = d.data();
    const id = await mapId('procurementStepDefinitions', d.id);
    idMap.set(d.id, id);
    return camelToRow({
      id, projectId: newProjectId, enterpriseId: null,
      name: data.name, order: data.order,
      isEnterpriseStandard: data.isEnterpriseStandard ?? false,
      defaultDurationDays: data.defaultDurationDays,
      enterpriseStepId: null, // cross-project enterprise-standard linkage resolved in a later pass if needed
    });
  }));
  await loadRows('procurement_step_definitions', rows);
  return idMap;
}

interface CostCodeMaps { idMap: Map<string, string>; codeMap: Map<string, string>; }

async function migrateCostCodes(projectId: string, newProjectId: string): Promise<CostCodeMaps> {
  const snap = await firestore.collection('costCodes').where('projectId', '==', projectId).get();
  const idMap = new Map<string, string>(); // firestore doc id -> new uuid
  const codeMap = new Map<string, string>(); // human code -> new uuid (for etc_details/cost_phasing keyed by code)
  const rows = await Promise.all(snap.docs.map(async (d) => {
    const data = d.data();
    const id = await mapId('costCodes', d.id);
    idMap.set(d.id, id);
    codeMap.set(data.code, id);
    return camelToRow({
      id, projectId: newProjectId, code: data.code, name: data.name,
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
      createdAt: data.createdAt, updatedAt: data.updatedAt,
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
    const data = d.data();
    const id = await mapId('sheets', d.id);
    idMap.set(d.id, id);
    return camelToRow({
      id, projectId: newProjectId, sheetName: data.sheetName,
      forecastMethod: data.forecastMethod ?? 'Manual', version: data.version ?? '1',
      lockedStatus: data.lockedStatus ?? false, createdBy: null,
      users: [], createdAt: data.createdAt, updatedAt: data.updatedAt,
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
      const data = d.data();
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
  const rows = await Promise.all(snap.docs.map(async (d) => {
    const data = d.data();
    const id = await mapId('etcDetails', d.id);
    return camelToRow({
      id, projectId: newProjectId,
      costCodeId: costCodeCodeMap.get(data.costCode) ?? null, // EtcDetail keys by code, not id -- resolved here
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
      createdAt: data.createdAt, updatedAt: data.updatedAt,
      isEnterpriseResource: data.isEnterpriseResource ?? false,
      resourceId: data.resourceId, totalEtcPrevious: data.totalEtcPrevious,
    });
  }));
  await loadRows('etc_details', rows);
}

async function migrateActualCosts(projectId: string, newProjectId: string, costCodeIdMap: Map<string, string>, costCodeCodeMap: Map<string, string>): Promise<void> {
  const snap = await firestore.collection('actualCosts').where('projectId', '==', projectId).get();
  const rows = (await Promise.all(snap.docs.map(async (d) => {
    const data = d.data();
    const costCodeId = costCodeIdMap.get(data.costCodeId) ?? costCodeCodeMap.get(data.costCodeId);
    if (!costCodeId) return null; // orphaned reference -- see normalize-costcode-fk.ts's philosophy, skip rather than guess
    return camelToRow({
      id: await mapId('actualCosts', d.id), projectId: newProjectId, costCodeId,
      period: data.period, amount: data.amount ?? 0, description: data.description,
      createdAt: data.createdAt,
    });
  }))).filter((r): r is Record<string, unknown> => r !== null);
  await loadRows('actual_costs', rows);
}

async function migrateBaselineBudgets(projectId: string, newProjectId: string, costCodeIdMap: Map<string, string>, costCodeCodeMap: Map<string, string>): Promise<void> {
  const snap = await firestore.collection('baselineBudgets').where('projectId', '==', projectId).get();
  const rows = (await Promise.all(snap.docs.map(async (d) => {
    const data = d.data();
    const costCodeId = costCodeIdMap.get(data.costCodeId) ?? costCodeCodeMap.get(data.costCodeId);
    if (!costCodeId) return null;
    return camelToRow({
      id: await mapId('baselineBudgets', d.id), projectId: newProjectId, costCodeId,
      amount: data.amount ?? 0, effectiveDate: data.effectiveDate, createdAt: data.createdAt,
    });
  }))).filter((r): r is Record<string, unknown> => r !== null);
  await loadRows('baseline_budgets', rows);
}

async function migrateCostPhasing(projectId: string, newProjectId: string, costCodeIdMap: Map<string, string>, costCodeCodeMap: Map<string, string>): Promise<void> {
  const snap = await firestore.collection('costPhasing').where('projectId', '==', projectId).get();
  const rows = (await Promise.all(snap.docs.map(async (d) => {
    const data = d.data();
    const costCodeId = costCodeIdMap.get(data.costCodeId) ?? costCodeCodeMap.get(data.costCodeId);
    if (!costCodeId) return null;
    return camelToRow({
      id: await mapId('costPhasing', d.id), projectId: newProjectId, costCodeId,
      periodValues: data.periodValues ?? {}, distributionMethod: data.distributionMethod ?? 'Even',
      createdAt: data.createdAt, updatedAt: data.updatedAt,
    });
  }))).filter((r): r is Record<string, unknown> => r !== null);
  await loadRows('cost_phasing', rows);
}

async function migratePeriodSnapshots(projectId: string, newProjectId: string): Promise<void> {
  const snap = await firestore.collection('periodSnapshots').where('projectId', '==', projectId).get();
  const rows = await Promise.all(snap.docs.map(async (d) => {
    const data = d.data();
    return camelToRow({
      id: await mapId('periodSnapshots', d.id), projectId: newProjectId,
      periodId: data.periodId, periodName: data.periodName,
      costCodes: data.costCodes ?? [], createdAt: data.createdAt,
    });
  }));
  await loadRows('period_snapshots', rows);
}

async function migrateRisksAndRecords(projectId: string, newProjectId: string, costCodeIdMap: Map<string, string>): Promise<void> {
  const risksSnap = await firestore.collection('risks').where('projectId', '==', projectId).get();
  const riskIdMap = new Map<string, string>();
  const riskRows = await Promise.all(risksSnap.docs.map(async (d) => {
    const data = d.data();
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
      createdAt: data.createdAt, updatedAt: data.updatedAt,
    });
  }));
  await loadRows('risks', riskRows);

  const recordRows: Record<string, unknown>[] = [];
  for (const [firestoreRiskId, newRiskId] of riskIdMap) {
    const recSnap = await firestore.collection('riskRecords').where('riskId', '==', firestoreRiskId).get();
    for (const d of recSnap.docs) {
      const data = d.data();
      const costCodeId = costCodeIdMap.get(data.costCodeId) ?? null;
      recordRows.push(toRow<Record<string, unknown>>({
        id: await mapId('riskRecords', d.id), riskId: newRiskId, projectId: newProjectId,
        costCodeId, scope: data.scope,
        enterpriseAttributes: data.enterpriseAttributes ?? {},
        projectAttributes: data.projectAttributes ?? {},
        probability: data.probability, minImpactAmount: data.minImpactAmount ?? 0,
        mostLikelyImpactAmount: data.mostLikelyImpactAmount ?? 0, maxImpactAmount: data.maxImpactAmount ?? 0,
        // betaPertImpactAmount is GENERATED -- never write it.
        createdAt: data.createdAt, updatedAt: data.updatedAt,
      }, {}, ['beta_pert_impact_amount']));
    }
  }
  await loadRows('risk_records', recordRows);
}

async function migrateChangesAndRecords(projectId: string, newProjectId: string, costCodeIdMap: Map<string, string>): Promise<void> {
  const changesSnap = await firestore.collection('changes').where('projectId', '==', projectId).get();
  const changeIdMap = new Map<string, string>();
  const changeRows = await Promise.all(changesSnap.docs.map(async (d) => {
    const data = d.data();
    const id = await mapId('changes', d.id);
    changeIdMap.set(d.id, id);
    return camelToRow({
      id, projectId: newProjectId, changeCode: data.changeId,
      description: data.description, status: data.status,
      enterpriseAttributes: data.enterpriseAttributes ?? {},
      projectAttributes: data.projectAttributes ?? {},
      createdAt: data.createdAt, updatedAt: data.updatedAt,
    });
  }));
  await loadRows('changes', changeRows);

  const recordRows: Record<string, unknown>[] = [];
  for (const [firestoreChangeId, newChangeId] of changeIdMap) {
    const recSnap = await firestore.collection('changeRecords').where('changeId', '==', firestoreChangeId).get();
    for (const d of recSnap.docs) {
      const data = d.data();
      const costCodeId = costCodeIdMap.get(data.costCodeId) ?? null;
      recordRows.push(camelToRow({
        id: await mapId('changeRecords', d.id), changeId: newChangeId, projectId: newProjectId,
        costCodeId, budgetAmount: data.budgetAmount ?? 0, eacAmount: data.eacAmount ?? 0,
        enterpriseAttributes: data.enterpriseAttributes ?? {},
        projectAttributes: data.projectAttributes ?? {},
        createdAt: data.createdAt, updatedAt: data.updatedAt,
      }));
    }
  }
  await loadRows('change_records', recordRows);
}

async function migrateProgressDomain(projectId: string, newProjectId: string, costCodeIdMap: Map<string, string>): Promise<void> {
  const rulesSnap = await firestore.collection('rulesOfCredit').where('projectId', '==', projectId).get();
  const ruleIdMap = new Map<string, string>();
  const ruleRows = await Promise.all(rulesSnap.docs.map(async (d) => {
    const data = d.data();
    const id = await mapId('rulesOfCredit', d.id);
    ruleIdMap.set(d.id, id);
    return camelToRow({
      id, projectId: newProjectId, ruleCode: data.ruleId, description: data.description,
      packageId: null, // resolved after packages are migrated, if needed
      userField1: data.userField1, userField2: data.userField2, userField3: data.userField3,
      userField4: data.userField4, userField5: data.userField5, createdAt: data.createdAt,
    });
  }));
  await loadRows('rules_of_credit', ruleRows);

  const stepRows: Record<string, unknown>[] = [];
  for (const [firestoreRuleId, newRuleId] of ruleIdMap) {
    const ruleData = rulesSnap.docs.find((d) => d.id === firestoreRuleId)!.data();
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
  const packageRows = await Promise.all(packagesSnap.docs.map(async (d) => {
    const data = d.data();
    const id = await mapId('progressPackages', d.id);
    packageIdMap.set(d.id, id);
    return camelToRow({
      id, projectId: newProjectId, packageCode: data.packageId, description: data.description,
      ruleOfCreditId: data.ruleOfCreditId ? ruleIdMap.get(data.ruleOfCreditId) ?? null : null,
      unit: data.unit, attributes: data.attributes ?? {},
      defaultStartDate: data.defaultStartDate, defaultEndDate: data.defaultEndDate,
      defaultPhasingMethod: data.defaultPhasingMethod, defaultPhasingCurve: data.defaultPhasingCurve,
      createdAt: data.createdAt, updatedAt: data.updatedAt,
    });
  }));
  await loadRows('progress_packages', packageRows);

  const itemRows: Record<string, unknown>[] = [];
  for (const [firestorePackageDocId, newPackageId] of packageIdMap) {
    const itemsSnap = await firestore.collection('progressItems')
      .where('projectId', '==', projectId).where('packageDocId', '==', firestorePackageDocId).get();
    for (const d of itemsSnap.docs) {
      const data = d.data();
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
        sortOrder: data.sortOrder, createdAt: data.createdAt, updatedAt: data.updatedAt,
      }));
    }
  }
  await loadRows('progress_items', itemRows);

  const periodsSnap = await firestore.collection('progressReportingPeriods').where('projectId', '==', projectId).get();
  const periodRows = await Promise.all(periodsSnap.docs.map(async (d) => {
    const data = d.data();
    return camelToRow({
      id: await mapId('progressReportingPeriods', d.id), projectId: newProjectId,
      periodName: data.periodName, startDate: data.startDate, endDate: data.endDate,
      status: data.status ?? 'Open', createdAt: data.createdAt,
    });
  }));
  await loadRows('progress_reporting_periods', periodRows);

  const attrsSnap = await firestore.collection('progressAttributes').where('projectId', '==', projectId).get();
  const attrRows = await Promise.all(attrsSnap.docs.map(async (d) => {
    const data = d.data();
    return camelToRow({
      id: await mapId('progressAttributes', d.id), projectId: newProjectId,
      title: data.title, type: data.type, values: data.values ?? [],
    });
  }));
  await loadRows('progress_attributes', attrRows);
}

async function migrateScheduleItems(projectId: string, newProjectId: string): Promise<void> {
  const snap = await firestore.collection('scheduleItems').where('projectId', '==', projectId).get();
  const rows = await Promise.all(snap.docs.map(async (d) => {
    const data = d.data();
    return camelToRow({
      id: await mapId('scheduleItems', d.id), projectId: newProjectId,
      activityId: data.activityId, description: data.description,
      activityPercentComplete: data.activityPercentComplete ?? 0,
      baselineStartDate: data.baselineStartDate, baselineEndDate: data.baselineEndDate,
      plannedStartDate: data.plannedStartDate, plannedEndDate: data.plannedEndDate,
      currentStartDate: data.currentStartDate, currentEndDate: data.currentEndDate,
      updatedAt: data.updatedAt,
    });
  }));
  await loadRows('schedule_items', rows);
}

async function migrateProcurementItems(projectId: string, newProjectId: string, calendarIdMap: Map<string, string>): Promise<void> {
  const snap = await firestore.collection('procurementItems').where('projectId', '==', projectId).get();
  const rows = await Promise.all(snap.docs.map(async (d) => {
    const data = d.data();
    return camelToRow({
      id: await mapId('procurementItems', d.id), projectId: newProjectId,
      packageId: data.packageId, description: data.description,
      calendarId: data.calendarId ? calendarIdMap.get(data.calendarId) ?? null : null,
      category: data.category,
      enterpriseAttributes: data.enterpriseAttributes ?? {},
      projectAttributes: data.projectAttributes ?? {},
      stepData: data.stepData ?? {}, createdAt: data.createdAt, updatedAt: data.updatedAt,
    });
  }));
  await loadRows('procurement_items', rows);
}

async function migrateSubcontractsInvoicesAndLineItems(
  projectId: string, newProjectId: string, newEnterpriseId: string, costCodeIdMap: Map<string, string>,
): Promise<void> {
  const subsSnap = await firestore.collection('subcontracts').where('projectId', '==', projectId).get();
  const subIdMap = new Map<string, string>();
  const subRows = await Promise.all(subsSnap.docs.map(async (d) => {
    const data = d.data();
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
      createdAt: data.createdAt, updatedAt: data.updatedAt,
      // createdBy (auth.users FK) intentionally left null for now.
    });
  }));
  await loadRows('subcontracts', subRows);

  const lineItemIdMap = new Map<string, string>(); // firestore subcontract lineItem id -> new uuid
  const lineItemRows: Record<string, unknown>[] = [];
  for (const [firestoreSubId, newSubId] of subIdMap) {
    const subData = subsSnap.docs.find((d) => d.id === firestoreSubId)!.data();
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
    const data = d.data();
    const subcontractId = subIdMap.get(data.subcontractId);
    if (!subcontractId) return null; // orphaned reference, skip rather than guess
    const id = await mapId('invoices', d.id);
    invoiceIdMap.set(d.id, id);
    const vendorId = await mapId('vendors', data.vendorId);
    return camelToRow({
      id, subcontractId, projectId: newProjectId, enterpriseId: newEnterpriseId,
      invoiceCode: data.invoiceId, description: data.description,
      submittedDate: data.submittedDate, certifiedDate: data.certifiedDate, paymentDate: data.paymentDate,
      status: data.status ?? 'Draft', initiator: data.initiator, vendorId,
      totalAmount: data.totalAmount ?? 0, certifiedAmount: data.certifiedAmount ?? 0,
      createdAt: data.createdAt, updatedAt: data.updatedAt,
    });
  }))).filter((r): r is Record<string, unknown> => r !== null);
  await loadRows('invoices', invoiceRows);

  const invoiceItemRows: Record<string, unknown>[] = [];
  for (const [firestoreInvoiceId, newInvoiceId] of invoiceIdMap) {
    const invData = invoicesSnap.docs.find((d) => d.id === firestoreInvoiceId)!.data();
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
    const data = d.data();
    return camelToRow({
      id: undefined, enterpriseId: newEnterpriseId, projectId: newProjectId,
      actorUserId: null, actorEmail: data.userEmail, action: data.action,
      details: data.details ?? {}, createdAt: data.timestamp,
    });
  });
  await loadRows('audit_logs', rows);
}

// ---- Orchestration ----

async function migrateProjectFull(projectId: string): Promise<void> {
  console.log(`\n=== Project ${projectId} ===`);
  const projSnap = await firestore.collection('projects').doc(projectId).get();
  if (!projSnap.exists) { console.log('  not found, skipping'); return; }
  const enterpriseFirestoreId = projSnap.data()!.enterpriseId;

  await migrateEnterprise(enterpriseFirestoreId);
  const { enterpriseId: newEnterpriseId } = await migrateProject(projectId);
  const newProjectId = await mapId('projects', projectId);

  await migrateCalendars(projectId, newProjectId);
  const calendarsSnap = await firestore.collection('calendars').where('projectId', '==', projectId).get();
  const calendarIdMap = new Map<string, string>();
  for (const d of calendarsSnap.docs) calendarIdMap.set(d.id, await mapId('calendars', d.id));

  await migrateProcurementStepDefinitions(projectId, newProjectId);
  const { idMap: costCodeIdMap, codeMap: costCodeCodeMap } = await migrateCostCodes(projectId, newProjectId);
  const sheetsIdMap = await migrateSheets(projectId, newProjectId);
  await migrateForecastRows(sheetsIdMap);

  await migrateEtcDetails(projectId, newProjectId, costCodeIdMap, costCodeCodeMap);
  await migrateActualCosts(projectId, newProjectId, costCodeIdMap, costCodeCodeMap);
  await migrateBaselineBudgets(projectId, newProjectId, costCodeIdMap, costCodeCodeMap);
  await migrateCostPhasing(projectId, newProjectId, costCodeIdMap, costCodeCodeMap);
  await migratePeriodSnapshots(projectId, newProjectId);

  await migrateRisksAndRecords(projectId, newProjectId, costCodeIdMap);
  await migrateChangesAndRecords(projectId, newProjectId, costCodeIdMap);
  await migrateProgressDomain(projectId, newProjectId, costCodeIdMap);
  await migrateScheduleItems(projectId, newProjectId);
  await migrateProcurementItems(projectId, newProjectId, calendarIdMap);
  await migrateSubcontractsInvoicesAndLineItems(projectId, newProjectId, newEnterpriseId, costCodeIdMap);
  await migrateAuditLogs(projectId, newProjectId, newEnterpriseId);
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
    for (const d of projectsSnap.docs) await migrateProjectFull(d.id);
  } else if (singleProjectId) {
    await migrateProjectFull(singleProjectId);
  } else {
    console.error('Usage: --project <projectId> [--apply]  or  --all-projects [--apply]');
    process.exit(1);
  }

  await verify();
}

main().catch((err) => {
  console.error('ETL failed:', err);
  process.exit(1);
});
