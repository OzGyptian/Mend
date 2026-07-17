/**
 * Builds a small, deliberately well-formed synthetic dataset covering every
 * collection the ETL touches, written in the exact dump format
 * dump-firestore.ts/local-dump-firestore.ts expect. Independent of the real
 * Firestore dump entirely -- no quota, no network, safe to regenerate any
 * time. Exists to answer "does our migration code work correctly" without
 * that question being tangled up with "is 6 months of accumulated real test
 * data clean" (it isn't, see JOURNAL.md) -- this is the regression fixture
 * for the former; real data cleanup is a separate, tracked conversation
 * with Tarek.
 *
 * Usage: node scripts/generate-synthetic-dump.mjs [outputDir]  (default: firestore-dump-synthetic)
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const outputDir = process.argv[2] ?? 'firestore-dump-synthetic';
mkdirSync(outputDir, { recursive: true });

const now = new Date().toISOString();
const ENT = 'synth-enterprise-1';
const PROJ = 'synth-project-1';
const ADMIN_USER = 'synth-user-admin';
const VENDOR_1 = 'synth-vendor-1';
const CC_SUB = 'synth-cc-substructure';
const CC_SUPER = 'synth-cc-superstructure';
const CC_MEP = 'synth-cc-mep';
const SHEET = 'synth-sheet-1';
const PKG = 'synth-progress-pkg-1';
const RULE = 'synth-rule-1';
const RISK = 'synth-risk-1';
const CHANGE = 'synth-change-1';
const CAL = 'synth-calendar-1';
const SUBK = 'synth-subcontract-1';

const collections = {
  enterprises: [{
    __id: ENT, name: 'Synthetic Test Enterprise', theme: 'dark',
    adminUsers: [ADMIN_USER],
    users: { [ADMIN_USER]: { email: 'synth-admin@example.invalid', name: 'Synth Admin', role: 'Enterprise System Admin', joinedAt: now } },
    vendors: [{ id: VENDOR_1, name: 'Synthetic Steelworks Pty Ltd', code: 'SYNVEND-1', contactEmail: 'vendor@example.invalid', contactName: 'Vendor Contact' }],
    createdAt: now,
  }],
  projects: [{
    __id: PROJ, enterpriseId: ENT, projectName: 'Synthetic Test Project', projectCode: 'SYN-001',
    status: 'Active', projectBudget: 1000000,
    startDate: '2026-01-01', endDate: '2026-12-31', cutoffDate: '2026-06-30',
    users: { [ADMIN_USER]: 'Project Admin' },
    firstCostReportingMonth: '2026-01', currentReportingMonth: '2026-06', lastReportingMonth: '2026-12',
    dateCreated: now, dateLastModified: now,
  }],
  costCodes: [
    { __id: CC_SUB, code: 'CC-100', projectId: PROJ, name: 'Substructure', eacMethod: 'Manual', sortOrder: 1, enterpriseAttributes: {}, projectAttributes: {} },
    { __id: CC_SUPER, code: 'CC-200', projectId: PROJ, name: 'Superstructure', eacMethod: 'Manual', sortOrder: 2, enterpriseAttributes: {}, projectAttributes: {} },
    { __id: CC_MEP, code: 'CC-300', projectId: PROJ, name: 'Mechanical & Electrical', eacMethod: 'Manual', sortOrder: 3, enterpriseAttributes: {}, projectAttributes: {} },
  ],
  sheets: [{
    __id: SHEET, projectId: PROJ, sheetName: 'Synthetic Budget Sheet', forecastMethod: 'commitment',
    version: '1.0', lockedStatus: false, createdBy: ADMIN_USER, createdAt: now, updatedAt: now,
  }],
  baselineBudgets: [
    { __id: 'synth-bb-1', projectId: PROJ, costCodeId: CC_SUB, amount: 250000, createdAt: now },
    { __id: 'synth-bb-2', projectId: PROJ, costCodeId: CC_SUPER, amount: 400000, createdAt: now },
    { __id: 'synth-bb-3', projectId: PROJ, costCodeId: CC_MEP, amount: 150000, createdAt: now },
  ],
  costPhasing: [
    { __id: 'synth-cp-1', projectId: PROJ, costCodeId: CC_SUB, periodValues: { '2026-01': 50000, '2026-02': 100000, '2026-03': 100000 }, distributionMethod: 'manual', updatedAt: now },
    { __id: 'synth-cp-2', projectId: PROJ, costCodeId: CC_SUPER, periodValues: { '2026-02': 100000, '2026-03': 150000, '2026-04': 150000 }, distributionMethod: 'even', updatedAt: now },
  ],
  etcDetails: [
    { __id: 'synth-etc-1', projectId: PROJ, costCode: 'CC-100', etc: 260000, method: 'Manual', createdAt: now, updatedAt: now },
  ],
  actualCosts: [
    { __id: 'synth-ac-1', projectId: PROJ, costCodeId: CC_SUB, reportingPeriodId: '2026-06', cost: 180000, description: 'Progress claim #4', createdAt: now },
    { __id: 'synth-ac-2', projectId: PROJ, costCodeId: CC_SUPER, reportingPeriodId: '2026-06', cost: 220000, description: 'Progress claim #4', createdAt: now },
  ],
  changes: [
    { __id: CHANGE, projectId: PROJ, changeId: 'CHG-001', description: 'Owner-directed scope addition -- extra fire stairs', status: 'Approved', enterpriseAttributes: {}, projectAttributes: {}, createdAt: now, updatedAt: now },
  ],
  changeRecords: [
    { __id: 'synth-cr-1', projectId: PROJ, changeId: CHANGE, costCodeId: CC_SUPER, budgetAmount: 35000, eacAmount: 35000, enterpriseAttributes: {}, projectAttributes: {}, createdAt: now, updatedAt: now },
  ],
  risks: [
    { __id: RISK, projectId: PROJ, riskId: 'RISK-001', description: 'Adverse weather delaying critical-path concrete pours', type: 'Schedule', status: 'Open', strategy: 'Accept', initiator: 'Project Manager', reference: 'Weather forecast review 2026-05', mitigation: '', residualExposure: '', enterpriseAttributes: {}, projectAttributes: {}, createdAt: now, updatedAt: now },
  ],
  riskRecords: [
    { __id: 'synth-rr-1', riskId: RISK, projectId: PROJ, costCodeId: CC_SUPER, scope: 'Superstructure works', probability: 0.4, minImpactAmount: 20000, mostLikelyImpactAmount: 45000, maxImpactAmount: 90000, enterpriseAttributes: {}, projectAttributes: {}, createdAt: now, updatedAt: now },
  ],
  subcontracts: [
    { __id: SUBK, projectId: PROJ, enterpriseId: ENT, orderId: 'SC-001', orderName: 'Structural Steel Package', orderScope: 'Supply and install structural steel', status: 'Active', paymentType: 'LumpSum', awardDate: '2026-02-01', vendorId: VENDOR_1, vendorUsers: [], totalAmount: 380000, enterpriseSubcontractAttributes: {}, projectAttributes: {}, createdAt: now, updatedAt: now },
  ],
  invoices: [
    { __id: 'synth-inv-1', projectId: PROJ, subcontractId: SUBK, vendorId: VENDOR_1, invoiceId: 'INV-001', totalAmount: 95000, certifiedAmount: 90000, gstAmount: 9500, createdAt: now, updatedAt: now },
  ],
  progressPackages: [
    { __id: PKG, projectId: PROJ, packageId: 'PKG-001', description: 'Substructure progress package', createdAt: now, updatedAt: now },
  ],
  progressItems: [
    { __id: 'synth-pi-1', projectId: PROJ, packageDocId: PKG, itemId: 'ITEM-001', activityId: 'ACT-100', description: 'Pile caps', costCodeId: CC_SUB, totalQty: 40, phasingMethod: 'Auto', phasingCurve: 'even', projectAttributes: {}, enterpriseAttributes: {}, ruleOfCreditProgress: {}, periodValues: {}, currentPeriodValues: {}, actualPeriodValues: {}, createdAt: now, updatedAt: now },
  ],
  progressAttributes: [],
  rulesOfCredit: [
    { __id: RULE, projectId: PROJ, ruleId: 'ROC-001', description: 'Standard 3-step rule of credit', createdAt: now },
  ],
  progressReportingPeriods: [
    { __id: 'synth-prp-1', projectId: PROJ, periodName: '2026-06', startDate: '2026-06-01', endDate: '2026-06-30', status: 'Open', createdAt: now },
  ],
  periodSnapshots: [
    { __id: 'synth-ps-1', projectId: PROJ, periodId: '2026-06', periodName: 'June 2026', costCodes: [], createdAt: now },
  ],
  scheduleItems: [
    { __id: 'synth-si-1', projectId: PROJ, activityId: 'ACT-100', description: 'Pile caps', activityPercentComplete: 60, updatedAt: now },
  ],
  calendars: [
    { __id: CAL, projectId: PROJ, name: 'Standard 5-day calendar', weekends: [0, 6], holidays: ['2026-12-25', '2026-12-26'], createdAt: now },
  ],
  procurementItems: [
    { __id: 'synth-proc-1', projectId: PROJ, packageId: 'PROC-PKG-1', description: 'Precast concrete panels', calendarId: CAL, category: 'Materials', enterpriseAttributes: {}, projectAttributes: {}, stepData: {}, createdAt: now, updatedAt: now },
  ],
  procurementStepDefinitions: [
    { __id: 'synth-psd-1', projectId: PROJ, name: 'RFQ Issued', order: 1, defaultDurationDays: 10, createdAt: now },
  ],
  auditLogs: [
    { __id: 'synth-audit-1', projectId: PROJ, enterpriseId: ENT, action: 'project.created', userId: ADMIN_USER, createdAt: now },
  ],
};

for (const [name, docs] of Object.entries(collections)) {
  writeFileSync(join(outputDir, `${name}.json`), JSON.stringify(docs, null, 2));
  console.log(`  ${name}: ${docs.length} docs`);
}

// sheets/{id}/rows
const sheetRows = { [SHEET]: [
  { __id: 'synth-row-1', costCodeId: CC_SUB, values: { budget: 250000 } },
  { __id: 'synth-row-2', costCodeId: CC_SUPER, values: { budget: 400000 } },
] };
writeFileSync(join(outputDir, 'sheet-rows.json'), JSON.stringify(sheetRows, null, 2));
console.log(`  sheets/{id}/rows: ${sheetRows[SHEET].length} docs`);

writeFileSync(join(outputDir, 'manifest.json'), JSON.stringify({ dumpedAt: now, synthetic: true }, null, 2));
console.log(`\nSynthetic dump written to ${outputDir}/.`);
console.log(`Run: npx dotenv -e .env.local -- npx tsx scripts/etl-firestore-to-postgres.ts --from-dump ${outputDir} --project ${PROJ} --apply`);
