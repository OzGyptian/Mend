/**
 * Seed realistic Brisbane 2032 Olympic construction data for testing & demos.
 *
 * Usage:
 *   npx tsx scripts/seed-test-data.ts --uid=<firebase-uid>
 *
 * Creates:
 *   - Enterprise: Olympia Build Group Pty Ltd
 *   - 3 Projects: Athletes Village, Gabba Precinct, Chandler Aquatics
 *   - Full dataset: cost codes, budgets, actuals, subcontracts, risks,
 *     changes, procurement, progress, schedule, ETC details
 */

import { initializeApp, cert, type ServiceAccount } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Setup ────────────────────────────────────────────────────────────────────

const firebaseConfig = JSON.parse(
  readFileSync(join(__dirname, '../firebase-applet-config.json'), 'utf8')
) as { projectId: string; firestoreDatabaseId?: string };

const DATABASE_ID = firebaseConfig.firestoreDatabaseId ?? '(default)';

const args = Object.fromEntries(
  process.argv.slice(2).map(arg => {
    const [k, v] = arg.replace(/^--/, '').split('=');
    return [k, v];
  })
);

if (!args.uid) {
  console.error('Usage: npx tsx scripts/seed-test-data.ts --uid=<firebase-uid>');
  process.exit(1);
}

const UID = args.uid;

const serviceAccount = JSON.parse(
  readFileSync(join(__dirname, 'service-account.json'), 'utf8')
) as ServiceAccount;

initializeApp({ credential: cert(serviceAccount), projectId: firebaseConfig.projectId });
const db: Firestore = getFirestore(DATABASE_ID);

// ── Helpers ──────────────────────────────────────────────────────────────────

const uuid = () => randomUUID();
const now = () => new Date().toISOString();

/** Add months to a YYYY-MM string */
function addMonths(ym: string, n: number): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Last calendar day of a YYYY-MM */
function lastDay(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return `${ym}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleString('en-AU', { month: 'long', year: 'numeric' });
}

function monthDiff(from: string, to: string): number {
  const [fy, fm] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  return (ty - fy) * 12 + (tm - fm);
}

/** S-curve weight factor for month i out of n (0-indexed) */
function sCurveWeight(i: number, n: number): number {
  const t = (i + 0.5) / n;
  return Math.max(0, Math.sin(t * Math.PI));
}

/**
 * Generate a time-phased monthly budget allocation.
 * Returns array of { ym, amount } for n months starting at startYm.
 */
function phaseBudget(
  totalBudget: number,
  startYm: string,
  months: number,
  curve: 'even' | 'bell' | 'front' | 'back' = 'bell'
): Array<{ ym: string; amount: number }> {
  const weights: number[] = [];
  for (let i = 0; i < months; i++) {
    switch (curve) {
      case 'even': weights.push(1); break;
      case 'bell': weights.push(sCurveWeight(i, months)); break;
      case 'front': weights.push(Math.pow(1 - i / months, 1.5)); break;
      case 'back': weights.push(Math.pow(i / months, 1.5)); break;
    }
  }
  const sum = weights.reduce((a, b) => a + b, 0);
  return weights.map((w, i) => ({
    ym: addMonths(startYm, i),
    amount: Math.round((totalBudget * w) / sum),
  }));
}

/** Simulate actuals as % of planned with small variance */
function simulateActuals(
  phases: Array<{ ym: string; amount: number }>,
  upToYm: string,
  variance = 0.08
): Array<{ ym: string; amount: number }> {
  return phases
    .filter(p => p.ym <= upToYm)
    .map(p => ({
      ym: p.ym,
      amount: Math.round(p.amount * (1 + (Math.random() * 2 - 1) * variance)),
    }));
}

function sum(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0);
}

// Firestore batch writer (handles 500-doc limit)
async function batchWrite(docs: Array<{ ref: FirebaseFirestore.DocumentReference; data: object }>) {
  const CHUNK = 490;
  for (let i = 0; i < docs.length; i += CHUNK) {
    const batch = db.batch();
    docs.slice(i, i + CHUNK).forEach(({ ref, data }) => batch.set(ref, data, { merge: true }));
    await batch.commit();
    console.log(`  Wrote batch ${Math.floor(i / CHUNK) + 1}/${Math.ceil(docs.length / CHUNK)} (${Math.min(i + CHUNK, docs.length)} docs)`);
  }
}

// ── Constants ────────────────────────────────────────────────────────────────

const CURRENT_YM = '2026-06'; // Last closed reporting month

// ── Project Definitions ──────────────────────────────────────────────────────

interface ProjectDef {
  id: string;
  code: string;
  name: string;
  client: string;
  description: string;
  pm: string;
  totalBudget: number;
  startYm: string;
  endYm: string;
  costCodes: CostCodeDef[];
}

interface CostCodeDef {
  id: string;
  code: string;
  name: string;
  budget: number;
  curve: 'even' | 'bell' | 'front' | 'back';
  subStartOffset: number; // months after project start when this code's spend starts
  duration: number;       // months of spend
}

const P1_ID = uuid(); // Athletes Village
const P2_ID = uuid(); // Gabba Precinct
const P3_ID = uuid(); // Chandler Aquatics

const PROJECTS: ProjectDef[] = [
  {
    id: P1_ID,
    code: 'BRV-2032',
    name: 'Brisbane 2032 Athletes Village',
    client: 'Brisbane 2032 Organising Committee',
    description: 'Design and construction of the Brisbane 2032 Olympic and Paralympic Athletes Village at Northshore Hamilton, providing accommodation for 15,000 athletes and officials. Post-Games conversion to 3,500+ residential apartments.',
    pm: 'Sarah Mitchell',
    totalBudget: 1_243_700_000,
    startYm: '2025-09',
    endYm: '2031-10',
    costCodes: [
      { id: uuid(), code: '01', name: 'Project Management & Administration', budget: 48_200_000, curve: 'even', subStartOffset: 0, duration: 73 },
      { id: uuid(), code: '02', name: 'Design & Detailed Engineering', budget: 67_800_000, curve: 'front', subStartOffset: 0, duration: 36 },
      { id: uuid(), code: '03', name: 'Site Preparation & Demolition', budget: 18_500_000, curve: 'bell', subStartOffset: 2, duration: 10 },
      { id: uuid(), code: '04', name: 'Civil Works & Earthworks', budget: 95_300_000, curve: 'bell', subStartOffset: 4, duration: 18 },
      { id: uuid(), code: '05', name: 'Structural Concrete & Steel Frame', budget: 243_700_000, curve: 'bell', subStartOffset: 10, duration: 24 },
      { id: uuid(), code: '06', name: 'Building Envelope & Façade', budget: 178_900_000, curve: 'bell', subStartOffset: 18, duration: 18 },
      { id: uuid(), code: '07', name: 'Mechanical Services (HVAC/BMS)', budget: 121_400_000, curve: 'bell', subStartOffset: 22, duration: 18 },
      { id: uuid(), code: '08', name: 'Electrical Services & Communications', budget: 98_600_000, curve: 'bell', subStartOffset: 22, duration: 16 },
      { id: uuid(), code: '09', name: 'Plumbing, Fire & Hydraulics', budget: 82_300_000, curve: 'bell', subStartOffset: 24, duration: 16 },
      { id: uuid(), code: '10', name: 'Interior Fit-out & Finishes', budget: 154_200_000, curve: 'back', subStartOffset: 30, duration: 20 },
      { id: uuid(), code: '11', name: 'External Works & Landscaping', budget: 58_400_000, curve: 'back', subStartOffset: 50, duration: 12 },
      { id: uuid(), code: '12', name: 'Infrastructure, Utilities & Connections', budget: 72_600_000, curve: 'bell', subStartOffset: 6, duration: 24 },
      { id: uuid(), code: '13', name: 'Provisional Sums', budget: 55_000_000, curve: 'even', subStartOffset: 12, duration: 48 },
      { id: uuid(), code: '14', name: 'Escalation & Contingency', budget: 148_800_000, curve: 'even', subStartOffset: 0, duration: 73 },
    ],
  },
  {
    id: P2_ID,
    code: 'GAB-2032',
    name: 'Gabba Precinct Redevelopment',
    client: 'Queensland Major Events Corporation / Department of Infrastructure',
    description: 'Full demolition and reconstruction of The Gabba (Brisbane Cricket Ground) to deliver a 50,000-seat Olympic standard stadium. Includes new public domain, precinct infrastructure, and transport upgrades for the 2032 Opening and Closing Ceremonies.',
    pm: 'David Nguyen',
    totalBudget: 2_713_000_000,
    startYm: '2024-03',
    endYm: '2031-09',
    costCodes: [
      { id: uuid(), code: '01', name: 'Project Management & Programme Controls', budget: 108_500_000, curve: 'even', subStartOffset: 0, duration: 90 },
      { id: uuid(), code: '02', name: 'Design & Engineering', budget: 162_800_000, curve: 'front', subStartOffset: 0, duration: 42 },
      { id: uuid(), code: '03', name: 'Demolition & Site Clearing', budget: 38_500_000, curve: 'front', subStartOffset: 3, duration: 12 },
      { id: uuid(), code: '04', name: 'Piling, Substructure & Basement', budget: 195_400_000, curve: 'bell', subStartOffset: 8, duration: 18 },
      { id: uuid(), code: '05', name: 'Structural Steel Bowl & Roof', budget: 542_600_000, curve: 'bell', subStartOffset: 16, duration: 24 },
      { id: uuid(), code: '06', name: 'Concrete Terrace & Concourse', budget: 318_200_000, curve: 'bell', subStartOffset: 14, duration: 22 },
      { id: uuid(), code: '07', name: 'Roof Membrane & ETFE Canopy', budget: 187_400_000, curve: 'bell', subStartOffset: 32, duration: 16 },
      { id: uuid(), code: '08', name: 'Mechanical, Electrical & Plumbing', budget: 324_800_000, curve: 'bell', subStartOffset: 28, duration: 24 },
      { id: uuid(), code: '09', name: 'Seating, Field of Play & Sports Infrastructure', budget: 147_900_000, curve: 'back', subStartOffset: 52, duration: 16 },
      { id: uuid(), code: '10', name: 'Façade, Cladding & Glazing', budget: 203_500_000, curve: 'bell', subStartOffset: 36, duration: 20 },
      { id: uuid(), code: '11', name: 'Precinct Public Domain & Landscaping', budget: 148_600_000, curve: 'back', subStartOffset: 62, duration: 16 },
      { id: uuid(), code: '12', name: 'Transport Infrastructure & Pedestrian Links', budget: 216_800_000, curve: 'bell', subStartOffset: 20, duration: 36 },
      { id: uuid(), code: '13', name: 'ICT, Audiovisual & Broadcast Infrastructure', budget: 89_400_000, curve: 'back', subStartOffset: 54, duration: 20 },
      { id: uuid(), code: '14', name: 'Provisional Sums', budget: 135_000_000, curve: 'even', subStartOffset: 18, duration: 54 },
      { id: uuid(), code: '15', name: 'Escalation Allowance', budget: 193_600_000, curve: 'even', subStartOffset: 0, duration: 90 },
    ],
  },
  {
    id: P3_ID,
    code: 'CAC-2032',
    name: 'Chandler Aquatics Centre — Olympic Upgrade',
    client: 'Brisbane City Council / Queensland Government',
    description: 'Major upgrade and expansion of the Brisbane Aquatics Centre at Chandler to Olympic standard. New 50-metre indoor competition pool, warm-up pool, diving facility, spectator grandstand expansion to 8,000 seats, and amenities upgrade.',
    pm: 'Amelia Chen',
    totalBudget: 184_500_000,
    startYm: '2026-03',
    endYm: '2031-05',
    costCodes: [
      { id: uuid(), code: '01', name: 'Project Management & Administration', budget: 7_380_000, curve: 'even', subStartOffset: 0, duration: 62 },
      { id: uuid(), code: '02', name: 'Design, Engineering & Approvals', budget: 11_070_000, curve: 'front', subStartOffset: 0, duration: 24 },
      { id: uuid(), code: '03', name: 'Demolition & Site Works', budget: 4_610_000, curve: 'front', subStartOffset: 4, duration: 8 },
      { id: uuid(), code: '04', name: 'Civil & Earthworks', budget: 12_280_000, curve: 'bell', subStartOffset: 6, duration: 12 },
      { id: uuid(), code: '05', name: 'Pool Structure & Waterproofing', budget: 32_490_000, curve: 'bell', subStartOffset: 10, duration: 18 },
      { id: uuid(), code: '06', name: 'Grandstand Structure & Seating', budget: 24_790_000, curve: 'bell', subStartOffset: 16, duration: 16 },
      { id: uuid(), code: '07', name: 'Roof & Building Envelope', budget: 18_820_000, curve: 'bell', subStartOffset: 20, duration: 14 },
      { id: uuid(), code: '08', name: 'Pool Filtration & Water Treatment Plant', budget: 14_350_000, curve: 'bell', subStartOffset: 24, duration: 12 },
      { id: uuid(), code: '09', name: 'Mechanical, Electrical & Plumbing', budget: 22_480_000, curve: 'bell', subStartOffset: 22, duration: 16 },
      { id: uuid(), code: '10', name: 'Interior Fit-out & Finishes', budget: 16_230_000, curve: 'back', subStartOffset: 36, duration: 14 },
      { id: uuid(), code: '11', name: 'External Works & Car Park', budget: 8_300_000, curve: 'back', subStartOffset: 46, duration: 10 },
      { id: uuid(), code: '12', name: 'Contingency', budget: 11_700_000, curve: 'even', subStartOffset: 0, duration: 62 },
    ],
  },
];

// ── Enterprise ────────────────────────────────────────────────────────────────

async function getOrCreateEnterpriseId(): Promise<string> {
  const rolesDoc = await db.collection('userRoles').doc(UID).get();
  if (rolesDoc.exists) {
    const data = rolesDoc.data() as any;
    const enterpriseId =
      data?.enterpriseId ||
      (data?.memberships && data.memberships[0]?.enterpriseId);
    if (enterpriseId) {
      console.log(`Found existing enterprise: ${enterpriseId}`);
      return enterpriseId;
    }
  }
  const newId = uuid();
  console.log(`Creating new enterprise: ${newId}`);
  return newId;
}

function buildEnterprise(enterpriseId: string) {
  return {
    ref: db.collection('enterprises').doc(enterpriseId),
    data: {
      id: enterpriseId,
      name: 'Olympia Build Group Pty Ltd',
      description: 'Major construction company specialising in large-scale public infrastructure, sports facilities, and mixed-use developments. Lead contractor for multiple Brisbane 2032 Olympic venue packages.',
      logoUrl: null,
      address: '1 Olympic Boulevard, Northshore Hamilton QLD 4007',
      abn: '47 123 456 789',
      adminUsers: [UID],
      users: {
        [UID]: {
          uid: UID,
          email: 'bernard.w.leung@gmail.com',
          displayName: 'Bernard Leung',
          role: 'enterprise_admin',
          joinedAt: now(),
        },
      },
      // Reference data — cost elements, vendors, unit rates, etc.
      costElements: [
        { id: 'ce-1', code: 'LAB', name: 'Labour' },
        { id: 'ce-2', code: 'MAT', name: 'Materials' },
        { id: 'ce-3', code: 'PLT', name: 'Plant & Equipment' },
        { id: 'ce-4', code: 'SUB', name: 'Subcontract' },
        { id: 'ce-5', code: 'PMC', name: 'Project Management Costs' },
        { id: 'ce-6', code: 'DSG', name: 'Design & Engineering' },
        { id: 'ce-7', code: 'PRO', name: 'Preliminaries & Overheads' },
        { id: 'ce-8', code: 'OTH', name: 'Other Direct Costs' },
      ],
      vendors: [
        { id: 'v-1', name: 'Fulton Hogan Construction', abn: '12 000 111 222', category: 'Civil' },
        { id: 'v-2', name: 'BlueScope Steel', abn: '12 000 222 333', category: 'Structural' },
        { id: 'v-3', name: 'Watpac Civil & Mining', abn: '12 000 333 444', category: 'Civil' },
        { id: 'v-4', name: 'Multiplex Constructions', abn: '12 000 444 555', category: 'General' },
        { id: 'v-5', name: 'Lendlease Engineering', abn: '12 000 555 666', category: 'General' },
        { id: 'v-6', name: 'Otis Elevator Company', abn: '12 000 666 777', category: 'Lifts' },
        { id: 'v-7', name: 'Downer Group', abn: '12 000 777 888', category: 'Infrastructure' },
        { id: 'v-8', name: 'Arup', abn: '12 000 888 999', category: 'Engineering' },
        { id: 'v-9', name: 'Aurecon', abn: '12 000 999 000', category: 'Engineering' },
        { id: 'v-10', name: 'Allstaff Air Conditioning', abn: '12 001 000 111', category: 'Mechanical' },
        { id: 'v-11', name: 'Stowe Australia', abn: '12 001 111 222', category: 'Electrical' },
        { id: 'v-12', name: 'Nuflow Technologies', abn: '12 001 222 333', category: 'Plumbing' },
        { id: 'v-13', name: 'Decmil Group', abn: '12 001 333 444', category: 'Civil' },
        { id: 'v-14', name: 'Besix Watpac', abn: '12 001 444 555', category: 'General' },
        { id: 'v-15', name: 'Hansen Yuncken', abn: '12 001 555 666', category: 'General' },
      ],
      riskCategories: [
        'Design & Technical', 'Procurement & Supply Chain', 'Construction & Site',
        'Commercial & Contract', 'Programme & Schedule', 'Environmental & Approvals',
        'Stakeholder & Community', 'Weather & Force Majeure',
      ],
      changeTypes: [
        'Client Variation', 'Design Development', 'Regulatory / Compliance',
        'Unforeseen Site Conditions', 'Scope Addition', 'Scope Reduction',
        'Provisional Sum Adjustment', 'Extension of Time',
      ],
      procurementCategories: [
        'Civil & Earthworks', 'Structural Steel', 'Concrete Supply',
        'Building Envelope', 'MEP', 'Fit-out', 'Specialist Equipment',
        'Professional Services', 'Other',
      ],
      createdAt: now(),
      updatedAt: now(),
    },
  };
}

// ── Projects ─────────────────────────────────────────────────────────────────

function buildProject(p: ProjectDef, enterpriseId: string) {
  const totalMonths = monthDiff(p.startYm, p.endYm) + 1;
  const closedMonths = Math.max(0, monthDiff(p.startYm, CURRENT_YM) + 1);

  // Generate monthly periods
  const periods: any[] = [];
  for (let i = 0; i < totalMonths; i++) {
    const ym = addMonths(p.startYm, i);
    periods.push({
      id: `period-${ym}`,
      startDate: `${ym}-01`,
      endDate: lastDay(ym),
      name: monthLabel(ym),
      status: i < closedMonths ? 'closed' : 'open',
    });
  }

  return {
    ref: db.collection('projects').doc(p.id),
    data: {
      id: p.id,
      enterpriseId,
      code: p.code,
      name: p.name,
      description: p.description,
      client: p.client,
      projectManager: p.pm,
      status: 'active',
      startDate: `${p.startYm}-01`,
      endDate: lastDay(p.endYm),
      totalBudget: p.totalBudget,
      currency: 'AUD',
      contingencyPercent: 5,
      escalationPercent: 3,
      reportingPeriods: {
        baseDate: `${p.startYm}-01`,
        duration: 'month',
        numberOfPeriods: totalMonths,
        periods,
        currentPeriodId: closedMonths < totalMonths ? `period-${addMonths(p.startYm, closedMonths)}` : `period-${p.endYm}`,
      },
      firstCostReportingMonth: p.startYm,
      currentReportingMonth: CURRENT_YM,
      location: p.id === P1_ID ? 'Northshore Hamilton, Brisbane QLD'
        : p.id === P2_ID ? 'Woolloongabba, Brisbane QLD'
        : 'Chandler, Brisbane QLD',
      contractType: p.id === P2_ID ? 'Design & Construct' : 'Construct Only',
      procurementMethod: 'Lump Sum Competitive Tender',
      createdAt: now(),
      updatedAt: now(),
      createdBy: UID,
    },
  };
}

// ── Cost Codes ───────────────────────────────────────────────────────────────

function buildCostCodes(p: ProjectDef, enterpriseId: string) {
  return p.costCodes.map(cc => {
    const phases = phaseBudget(cc.budget, addMonths(p.startYm, cc.subStartOffset), cc.duration, cc.curve);
    const actuals = simulateActuals(phases, CURRENT_YM);
    const totalActual = sum(actuals.map(a => a.amount));
    const pctComplete = totalActual / cc.budget;
    // EAC: slight variance on some codes
    const eacMultiplier = 1 + (Math.random() * 0.08 - 0.02);
    const eac = Math.round(cc.budget * Math.max(0.98, Math.min(1.12, eacMultiplier)));

    return {
      ref: db.collection('costCodes').doc(cc.id),
      data: {
        id: cc.id,
        projectId: p.id,
        enterpriseId,
        code: cc.code,
        name: cc.name,
        originalBudget: cc.budget,
        approvedBudget: cc.budget,
        actualCostToDate: totalActual,
        eac: eac,
        etc: Math.max(0, eac - totalActual),
        variance: cc.budget - eac,
        pctComplete: Math.min(1, pctComplete),
        pctSpent: totalActual / cc.budget,
        forecastEndDate: lastDay(addMonths(p.startYm, cc.subStartOffset + cc.duration - 1)),
        etcMethod: pctComplete > 0.8 ? 'manual' : 'cpi',
        cpi: totalActual > 0 ? (cc.budget * pctComplete) / totalActual : 1,
        spi: 1 + (Math.random() * 0.1 - 0.05),
        phasing: phases.map(ph => ({ ym: ph.ym, planned: ph.amount })),
        status: pctComplete >= 1 ? 'complete' : pctComplete > 0 ? 'active' : 'pending',
        createdAt: now(),
        updatedAt: now(),
      },
    };
  });
}

// ── Actual Costs ─────────────────────────────────────────────────────────────

function buildActualCosts(p: ProjectDef, enterpriseId: string) {
  const docs: any[] = [];
  for (const cc of p.costCodes) {
    const phases = phaseBudget(cc.budget, addMonths(p.startYm, cc.subStartOffset), cc.duration, cc.curve);
    const actuals = simulateActuals(phases, CURRENT_YM);
    for (const a of actuals) {
      if (a.amount <= 0) continue;
      const id = uuid();
      docs.push({
        ref: db.collection('actualCosts').doc(id),
        data: {
          id,
          projectId: p.id,
          costCodeId: cc.id,
          enterpriseId,
          reportingMonth: a.ym,
          amount: a.amount,
          costElement: ['SUB', 'MAT', 'LAB', 'PLT', 'PRO'][Math.floor(Math.random() * 5)],
          description: `${cc.name} — ${monthLabel(a.ym)}`,
          invoiceRef: `INV-${a.ym.replace('-', '')}-${cc.code.padStart(3, '0')}`,
          createdAt: now(),
        },
      });
    }
  }
  return docs;
}

// ── Baseline Budgets ──────────────────────────────────────────────────────────

function buildBaselineBudgets(p: ProjectDef, enterpriseId: string) {
  return p.costCodes.map(cc => {
    const id = uuid();
    return {
      ref: db.collection('baselineBudgets').doc(id),
      data: {
        id,
        projectId: p.id,
        costCodeId: cc.id,
        enterpriseId,
        name: 'Original Baseline',
        amount: cc.budget,
        approvedDate: `${p.startYm}-01`,
        approvedBy: p.pm,
        version: 1,
        phasing: phaseBudget(cc.budget, addMonths(p.startYm, cc.subStartOffset), cc.duration, cc.curve),
        createdAt: now(),
      },
    };
  });
}

// ── Subcontracts ──────────────────────────────────────────────────────────────

interface SubcontractDef {
  code: string;
  scope: string;
  vendor: string;
  awardedValue: number;
  approvedValue: number;
  startDate: string;
  endDate: string;
  status: string;
  costCodeId: string;
}

function buildSubcontracts(p: ProjectDef, enterpriseId: string) {
  const defs: SubcontractDef[] = p.id === P1_ID ? [
    { code: 'SC-001', scope: 'Civil Works & Earthworks Package', vendor: 'Fulton Hogan Construction', awardedValue: 88_000_000, approvedValue: 91_500_000, startDate: `${addMonths(p.startYm, 4)}-01`, endDate: lastDay(addMonths(p.startYm, 21)), status: 'active', costCodeId: p.costCodes[3].id },
    { code: 'SC-002', scope: 'Structural Concrete & Formwork', vendor: 'Besix Watpac', awardedValue: 215_000_000, approvedValue: 221_000_000, startDate: `${addMonths(p.startYm, 10)}-01`, endDate: lastDay(addMonths(p.startYm, 33)), status: 'active', costCodeId: p.costCodes[4].id },
    { code: 'SC-003', scope: 'Structural Steelwork Supply & Erection', vendor: 'BlueScope Steel', awardedValue: 28_700_000, approvedValue: 28_700_000, startDate: `${addMonths(p.startYm, 12)}-01`, endDate: lastDay(addMonths(p.startYm, 28)), status: 'pending', costCodeId: p.costCodes[4].id },
    { code: 'SC-004', scope: 'Building Façade & Cladding', vendor: 'Multiplex Constructions', awardedValue: 162_000_000, approvedValue: 165_500_000, startDate: `${addMonths(p.startYm, 18)}-01`, endDate: lastDay(addMonths(p.startYm, 35)), status: 'pending', costCodeId: p.costCodes[5].id },
    { code: 'SC-005', scope: 'Mechanical HVAC & BMS', vendor: 'Allstaff Air Conditioning', awardedValue: 108_000_000, approvedValue: 108_000_000, startDate: `${addMonths(p.startYm, 22)}-01`, endDate: lastDay(addMonths(p.startYm, 39)), status: 'pending', costCodeId: p.costCodes[6].id },
    { code: 'SC-006', scope: 'Electrical Services & Data Infrastructure', vendor: 'Stowe Australia', awardedValue: 89_500_000, approvedValue: 89_500_000, startDate: `${addMonths(p.startYm, 22)}-01`, endDate: lastDay(addMonths(p.startYm, 37)), status: 'pending', costCodeId: p.costCodes[7].id },
  ] : p.id === P2_ID ? [
    { code: 'SC-001', scope: 'Demolition, Site Clearing & Remediation', vendor: 'Watpac Civil & Mining', awardedValue: 36_200_000, approvedValue: 38_800_000, startDate: `${addMonths(p.startYm, 3)}-01`, endDate: lastDay(addMonths(p.startYm, 14)), status: 'complete', costCodeId: p.costCodes[2].id },
    { code: 'SC-002', scope: 'Piling & Deep Foundation Works', vendor: 'Downer Group', awardedValue: 178_000_000, approvedValue: 185_400_000, startDate: `${addMonths(p.startYm, 8)}-01`, endDate: lastDay(addMonths(p.startYm, 25)), status: 'active', costCodeId: p.costCodes[3].id },
    { code: 'SC-003', scope: 'Primary Structural Steel Bowl & Roof Frame', vendor: 'BlueScope Steel', awardedValue: 498_000_000, approvedValue: 518_600_000, startDate: `${addMonths(p.startYm, 16)}-01`, endDate: lastDay(addMonths(p.startYm, 39)), status: 'active', costCodeId: p.costCodes[4].id },
    { code: 'SC-004', scope: 'Concrete Terrace, Concourse & Bowl', vendor: 'Lendlease Engineering', awardedValue: 295_000_000, approvedValue: 303_200_000, startDate: `${addMonths(p.startYm, 14)}-01`, endDate: lastDay(addMonths(p.startYm, 35)), status: 'active', costCodeId: p.costCodes[5].id },
    { code: 'SC-005', scope: 'MEP Integrated Package', vendor: 'Stowe Australia', awardedValue: 298_000_000, approvedValue: 298_000_000, startDate: `${addMonths(p.startYm, 28)}-01`, endDate: lastDay(addMonths(p.startYm, 51)), status: 'pending', costCodeId: p.costCodes[7].id },
    { code: 'SC-006', scope: 'Transport & Public Domain Infrastructure', vendor: 'Fulton Hogan Construction', awardedValue: 198_000_000, approvedValue: 204_500_000, startDate: `${addMonths(p.startYm, 20)}-01`, endDate: lastDay(addMonths(p.startYm, 55)), status: 'active', costCodeId: p.costCodes[11].id },
  ] : [
    { code: 'SC-001', scope: 'Civil Works & Pool Excavation', vendor: 'Fulton Hogan Construction', awardedValue: 11_400_000, approvedValue: 11_400_000, startDate: `${addMonths(p.startYm, 4)}-01`, endDate: lastDay(addMonths(p.startYm, 15)), status: 'pending', costCodeId: p.costCodes[3].id },
    { code: 'SC-002', scope: 'Pool Structure, Waterproofing & Tiling', vendor: 'Hansen Yuncken', awardedValue: 29_500_000, approvedValue: 29_500_000, startDate: `${addMonths(p.startYm, 10)}-01`, endDate: lastDay(addMonths(p.startYm, 27)), status: 'pending', costCodeId: p.costCodes[4].id },
    { code: 'SC-003', scope: 'Pool Water Treatment Plant & Filtration', vendor: 'Nuflow Technologies', awardedValue: 12_800_000, approvedValue: 12_800_000, startDate: `${addMonths(p.startYm, 24)}-01`, endDate: lastDay(addMonths(p.startYm, 35)), status: 'pending', costCodeId: p.costCodes[7].id },
    { code: 'SC-004', scope: 'MEP Services Package', vendor: 'Allstaff Air Conditioning', awardedValue: 20_200_000, approvedValue: 20_200_000, startDate: `${addMonths(p.startYm, 22)}-01`, endDate: lastDay(addMonths(p.startYm, 37)), status: 'pending', costCodeId: p.costCodes[8].id },
  ];

  const subcDocs: any[] = [];
  const invoiceDocs: any[] = [];

  for (const def of defs) {
    const scId = uuid();
    const totalInvoiced = def.status === 'complete' ? def.approvedValue
      : def.status === 'active' ? Math.round(def.approvedValue * (0.2 + Math.random() * 0.35))
      : 0;

    subcDocs.push({
      ref: db.collection('subcontracts').doc(scId),
      data: {
        id: scId,
        projectId: p.id,
        enterpriseId,
        code: def.code,
        scope: def.scope,
        vendor: def.vendor,
        awardedValue: def.awardedValue,
        approvedValue: def.approvedValue,
        invoicedToDate: totalInvoiced,
        retentionPercent: 5,
        retentionHeld: Math.round(totalInvoiced * 0.05),
        startDate: def.startDate,
        endDate: def.endDate,
        status: def.status,
        costCodeId: def.costCodeId,
        contractType: 'Lump Sum',
        paymentTerms: '30 days from invoice',
        createdAt: now(),
        updatedAt: now(),
      },
    });

    if (totalInvoiced > 0) {
      const numInvoices = def.status === 'complete' ? Math.floor(2 + Math.random() * 4)
        : Math.floor(1 + Math.random() * 3);
      for (let i = 0; i < numInvoices; i++) {
        const invId = uuid();
        const amt = i === numInvoices - 1
          ? totalInvoiced - Math.round(totalInvoiced * (0.3 * i) / numInvoices) * numInvoices
          : Math.round(totalInvoiced * 0.3 / numInvoices * (1 + Math.random() * 0.4));
        invoiceDocs.push({
          ref: db.collection('invoices').doc(invId),
          data: {
            id: invId,
            subcontractId: scId,
            projectId: p.id,
            enterpriseId,
            invoiceNumber: `${def.code.replace('-', '')}-INV-${String(i + 1).padStart(3, '0')}`,
            amount: Math.max(0, amt),
            gstAmount: Math.round(Math.max(0, amt) * 0.1),
            invoiceDate: lastDay(addMonths(def.startDate.substring(0, 7), i * 2)),
            dueDate: lastDay(addMonths(def.startDate.substring(0, 7), i * 2 + 1)),
            status: 'paid',
            progressClaimed: Math.min(100, Math.round((i + 1) * 100 / numInvoices)),
            createdAt: now(),
          },
        });
      }
    }
  }

  return { subcDocs, invoiceDocs };
}

// ── Risks ─────────────────────────────────────────────────────────────────────

function buildRisks(p: ProjectDef, enterpriseId: string) {
  interface RiskDef {
    title: string;
    description: string;
    category: string;
    likelihood: number;
    consequence: string;
    min: number;
    ml: number;
    max: number;
    status: string;
    mitigation: string;
    owner: string;
  }

  const riskDefs: RiskDef[] = p.id === P1_ID ? [
    { title: 'Ground Contamination — Former Industrial Site', description: 'Northshore Hamilton was previously an industrial port. Unexpected contaminated soil or groundwater during earthworks could require costly remediation and cause programme delays.', category: 'Construction & Site', likelihood: 3, consequence: 'High', min: 3_500_000, ml: 8_200_000, max: 22_000_000, status: 'open', mitigation: 'Phase 1 ESA completed. Phase 2 intrusive investigation underway. Provisional sum of $8M included in budget. Monitoring wells installed.', owner: 'David Nguyen' },
    { title: 'Structural Steel Price Escalation', description: 'Global steel market volatility (geopolitical tensions, Chinese demand) could push structural steel costs beyond current estimates and EAC.', category: 'Procurement & Supply Chain', likelihood: 4, consequence: 'Medium', min: 4_200_000, ml: 9_800_000, max: 18_500_000, status: 'open', mitigation: 'Steel supply agreement locked for 65% of requirement. CPI escalation clause included in subcontract. Monitoring LME steel index monthly.', owner: 'Sarah Mitchell' },
    { title: 'Labour Shortage — Skilled Trades Peak Demand', description: 'Multiple major Olympic projects and QLD government infrastructure programmes running concurrently. Risk of trade availability constraints (formwork, MEP) causing cost escalation and delays.', category: 'Construction & Site', likelihood: 4, consequence: 'High', min: 6_000_000, ml: 15_400_000, max: 38_000_000, status: 'open', mitigation: 'Early engagement of subcontractors. Skills training programme with TAFE QLD. Interstate mobilisation packages prepared for critical trades.', owner: 'Sarah Mitchell' },
    { title: 'Design Development Scope Creep', description: 'Olympic body (World Athletics, IOC) may require design changes post-schematic stage, particularly around athlete amenities, security infrastructure, and broadcast facilities.', category: 'Design & Technical', likelihood: 3, consequence: 'Medium', min: 2_800_000, ml: 6_500_000, max: 14_000_000, status: 'open', mitigation: 'Design freeze protocol agreed with client. Change control board established. Contingency allowance provisioned.', owner: 'Amelia Chen' },
    { title: 'Approval Delays — Heritage & Planning', description: 'Northshore Hamilton precinct contains heritage shipping infrastructure. Brisbane City Council approvals may be delayed due to heritage impact assessment requirements.', category: 'Environmental & Approvals', likelihood: 2, consequence: 'High', min: 1_500_000, ml: 4_200_000, max: 12_500_000, status: 'open', mitigation: 'Heritage consultant engaged. Pre-lodgement meetings held with BCC. Alternative design options developed for sensitive areas.', owner: p.pm },
  ] : p.id === P2_ID ? [
    { title: 'Asbestos in Existing Structure', description: 'The 1993 Gabba roof and grandstand structures contain extensive asbestos cement sheeting. Volume and complexity of removal may exceed estimates.', category: 'Construction & Site', likelihood: 4, consequence: 'High', min: 8_000_000, ml: 18_500_000, max: 42_000_000, status: 'active', mitigation: 'Licensed asbestos removalist contracted. Air monitoring underway. Provisional sum of $18M in budget. WHSQ monitoring programme established.', owner: 'David Nguyen' },
    { title: 'Programme Overrun — Opening Ceremony Deadline Non-Negotiable', description: 'The Gabba Opening Ceremony date of 23 July 2032 is immovable. Any programme slippage creates extreme client and reputational risk. Critical path analysis shows 4-month float only.', category: 'Programme & Schedule', likelihood: 3, consequence: 'Critical', min: 25_000_000, ml: 65_000_000, max: 180_000_000, status: 'open', mitigation: '4D BIM programme model developed. Weekly programme reviews. Acceleration plan pre-agreed with 6-week and 12-week triggers. Night shift capability maintained.', owner: 'David Nguyen' },
    { title: 'Structural Steel Fabrication Delay — Offshore Supplier', description: 'Primary bowl steelwork fabricated in South Korea. Shipping delays, quality hold points, or currency movement could impact delivery programme.', category: 'Procurement & Supply Chain', likelihood: 3, consequence: 'High', min: 5_500_000, ml: 14_000_000, max: 35_000_000, status: 'open', mitigation: 'Third-party QA inspectors embedded in fabrication facility. 8-week float in delivery schedule. Alternative Australian supply investigated (35% premium).', owner: p.pm },
    { title: 'Underground Services Conflicts', description: 'High density of legacy underground services (telco, water, power, gas) around the Gabba precinct. Services mapping incomplete. Risk of undocumented services causing delays.', category: 'Construction & Site', likelihood: 4, consequence: 'Medium', min: 2_200_000, ml: 5_800_000, max: 12_000_000, status: 'open', mitigation: 'Dial Before You Dig completed. Ground penetrating radar survey commissioned. DBYD register maintained. Service relocations budgeted separately.', owner: p.pm },
    { title: 'Community Opposition — Demolition of Heritage Stadium', description: 'Significant public opposition to Gabba demolition. Risk of legal challenges, protest activity disrupting works, or political direction to redesign (retain existing structure).', category: 'Stakeholder & Community', likelihood: 3, consequence: 'High', min: 8_000_000, ml: 22_000_000, max: 75_000_000, status: 'open', mitigation: 'Community engagement programme active. Legal review of project approvals. DG letters from Planning Minister obtained. Contingency redesign scope scoped (not budgeted).', owner: 'David Nguyen' },
    { title: 'Currency Risk — USD/AUD on Steel Imports', description: 'Steel, mechanical plant, and specialist equipment priced in USD. AUD/USD movement of 10% could add ~$25M to overall project cost.', category: 'Commercial & Contract', likelihood: 3, consequence: 'Medium', min: 8_000_000, ml: 19_500_000, max: 38_000_000, status: 'open', mitigation: 'Forward exchange contracts covering 70% of USD exposure. Monthly hedging review. Cost model updated quarterly with current FX rates.', owner: p.pm },
  ] : [
    { title: 'Pool Waterproofing Defect', description: 'Complex pool geometry with expansion joints creates risk of waterproofing failures requiring costly rectification during or post-construction.', category: 'Design & Technical', likelihood: 2, consequence: 'High', min: 800_000, ml: 2_400_000, max: 7_500_000, status: 'open', mitigation: 'Specialist waterproofing consultant peer reviewing design. Flood testing protocol agreed. 25-year warranty required from waterproofing subcontractor.', owner: p.pm },
    { title: 'Pool Water Treatment Specialist Procurement', description: 'Olympic-specification pool water treatment equipment has limited suppliers globally. Long lead times (18-20 months) create programme risk.', category: 'Procurement & Supply Chain', likelihood: 3, consequence: 'High', min: 1_200_000, ml: 3_800_000, max: 9_500_000, status: 'open', mitigation: 'Early market engagement commenced. Preferred supplier identified in Germany. Advance payment terms negotiated to secure manufacturing slot.', owner: p.pm },
    { title: 'Grandstand Soil Bearing Capacity', description: 'Geotechnical reports indicate variable fill material under the proposed grandstand extension. May require additional piling beyond design allowance.', category: 'Construction & Site', likelihood: 3, consequence: 'Medium', min: 600_000, ml: 1_800_000, max: 4_500_000, status: 'open', mitigation: 'Additional boreholes ordered. Structural engineer reviewing pile design with conservative parameters. Contingency sum included.', owner: p.pm },
  ];

  const riskDocs: any[] = [];
  const riskRecordDocs: any[] = [];

  for (const def of riskDefs) {
    const riskId = uuid();
    const exposure = Math.round((def.min + 4 * def.ml + def.max) / 6);
    riskDocs.push({
      ref: db.collection('risks').doc(riskId),
      data: {
        id: riskId,
        projectId: p.id,
        enterpriseId,
        title: def.title,
        description: def.description,
        category: def.category,
        likelihood: def.likelihood,
        consequence: def.consequence,
        owner: def.owner,
        status: def.status,
        mitigation: def.mitigation,
        betaPertMin: def.min,
        betaPertMostLikely: def.ml,
        betaPertMax: def.max,
        betaPertExposure: exposure,
        createdAt: now(),
        updatedAt: now(),
      },
    });

    // Risk records (monthly snapshots)
    for (let i = 0; i < 2; i++) {
      const rrId = uuid();
      const variance = 0.05 * (i + 1);
      riskRecordDocs.push({
        ref: db.collection('riskRecords').doc(rrId),
        data: {
          id: rrId,
          riskId,
          projectId: p.id,
          enterpriseId,
          reportingMonth: addMonths(CURRENT_YM, -(i + 1)),
          likelihood: def.likelihood,
          consequence: def.consequence,
          betaPertMin: Math.round(def.min * (1 - variance)),
          betaPertMostLikely: Math.round(def.ml * (1 - variance * 0.5)),
          betaPertMax: Math.round(def.max * (1 - variance * 0.3)),
          betaPertImpactAmount: Math.round(exposure * (1 - variance * 0.4)),
          notes: i === 0 ? 'Risk reviewed and confirmed. Mitigation measures progressing.' : 'Initial risk identification and quantification.',
          createdAt: now(),
        },
      });
    }
  }

  return { riskDocs, riskRecordDocs };
}

// ── Changes ──────────────────────────────────────────────────────────────────

function buildChanges(p: ProjectDef, enterpriseId: string) {
  interface ChangeDef {
    number: string;
    title: string;
    type: string;
    status: string;
    value: number;
    submittedDate: string;
    approvedDate?: string;
    description: string;
    costCodeId: string;
  }

  const defs: ChangeDef[] = p.id === P1_ID ? [
    { number: 'VO-001', title: 'Athlete Village Security Upgrades — ASIO Requirement', type: 'Regulatory / Compliance', status: 'approved', value: 4_850_000, submittedDate: `${addMonths(p.startYm, 3)}-15`, approvedDate: `${addMonths(p.startYm, 4)}-10`, description: 'Additional CPTED (Crime Prevention Through Environmental Design) measures and surveillance infrastructure mandated by ASIO Olympic Security Unit. Includes CCTV network, access control at all building entrances, and secure perimeter fencing to Village boundary.', costCodeId: p.costCodes[7].id },
    { number: 'VO-002', title: 'Design Development — Lobby & Amenities Upgrade', type: 'Design Development', status: 'approved', value: 2_380_000, submittedDate: `${addMonths(p.startYm, 4)}-20`, approvedDate: `${addMonths(p.startYm, 5)}-18`, description: 'Client-directed upgrade to ground-floor lobby finishes and athlete amenity spaces following IOC Village Inspection in Month 4. Upgrade to natural stone lobby floors, feature lighting, and sports recovery facilities (cryo-therapy, hydrotherapy).', costCodeId: p.costCodes[9].id },
    { number: 'VO-003', title: 'Additional Basement Car Park Level', type: 'Scope Addition', status: 'submitted', value: 7_200_000, submittedDate: `${addMonths(p.startYm, 7)}-05`, description: 'BCC transport planning requirement for additional 280 car spaces to service legacy residential use post-Games. New basement Level B3 added to structural design. Currently under client review — awaiting approval.', costCodeId: p.costCodes[3].id },
    { number: 'VO-004', title: 'Curtain Wall Specification Change — Double to Triple Glazing', type: 'Client Variation', status: 'approved', value: 3_620_000, submittedDate: `${addMonths(p.startYm, 5)}-28`, approvedDate: `${addMonths(p.startYm, 7)}-02`, description: 'Client elected to upgrade all external curtain wall glazing from double to triple glazed units to achieve NatHERS 7-star energy rating for residential legacy use. Results in improved acoustic performance also.', costCodeId: p.costCodes[5].id },
    { number: 'VO-005', title: 'EOT — Design Approval Delays', type: 'Extension of Time', status: 'approved', value: 0, submittedDate: `${addMonths(p.startYm, 6)}-15`, approvedDate: `${addMonths(p.startYm, 8)}-01`, description: 'Client-caused design approval delays to IFC package 2B (residential towers) of 6 weeks. EOT of 6 weeks granted with no cost. Programme recovery plan submitted separately.', costCodeId: p.costCodes[0].id },
  ] : p.id === P2_ID ? [
    { number: 'VO-001', title: 'Additional Asbestos Removal Scope', type: 'Unforeseen Site Conditions', status: 'approved', value: 8_700_000, submittedDate: `${addMonths(p.startYm, 5)}-10`, approvedDate: `${addMonths(p.startYm, 6)}-15`, description: 'Upon commencement of demolition, three additional asbestos-containing material types identified beyond ESA scope: spray-applied fire-resistant coating on structural steel (friable asbestos class A), floor tile adhesive, and pipe insulation. Requires class A removal protocol.', costCodeId: p.costCodes[2].id },
    { number: 'VO-002', title: 'Underground Services Relocation — Energex HV Cable', type: 'Unforeseen Site Conditions', status: 'approved', value: 3_250_000, submittedDate: `${addMonths(p.startYm, 7)}-22`, approvedDate: `${addMonths(p.startYm, 9)}-05`, description: 'Undocumented Energex 11kV high-voltage cable discovered at piling locations D4-D8. Permanent relocation of 340m of cable required. Energex design and approval process added 11 weeks to critical path.', costCodeId: p.costCodes[11].id },
    { number: 'VO-003', title: 'Olympic Broadcast Requirements — Additional Roof Penetrations', type: 'Client Variation', status: 'approved', value: 5_480_000, submittedDate: `${addMonths(p.startYm, 10)}-14`, approvedDate: `${addMonths(p.startYm, 12)}-02`, description: 'Host broadcast authority (OBS) requires 14 additional roof penetrations for camera gantry cable management plus upgrade to broadcast compound power supply to 4MVA. Structural assessment and roof membrane redesign required.', costCodeId: p.costCodes[7].id },
    { number: 'VO-004', title: 'Scope Reduction — Lower Grandstand Scope Deleted', type: 'Scope Reduction', status: 'approved', value: -12_400_000, submittedDate: `${addMonths(p.startYm, 14)}-08`, approvedDate: `${addMonths(p.startYm, 15)}-20`, description: 'QME directed deletion of lower western grandstand refurbishment scope (rows A-L, 2,800 seats) as legacy seating retained in revised configuration. Saving reallocated to broadcast infrastructure budget.', costCodeId: p.costCodes[5].id },
    { number: 'VO-005', title: 'Escalation Adjustment — Steel Market Q4 2025', type: 'Provisional Sum Adjustment', status: 'approved', value: 22_800_000, submittedDate: `${addMonths(p.startYm, 18)}-01`, approvedDate: `${addMonths(p.startYm, 19)}-15`, description: 'Structural steel market price increase of 8.4% recorded Q4 2025 against construction index base date. Escalation provisional sum adjustment as per contract mechanism. Supported by Rawlinsons QLD Steel Index.', costCodeId: p.costCodes[14].id },
    { number: 'VO-006', title: 'Additional Transport Upgrades — Cross River Rail Interface', type: 'Scope Addition', status: 'submitted', value: 18_600_000, submittedDate: `${addMonths(p.startYm, 22)}-15`, description: 'TMR requirement to upgrade pedestrian links between new Gabba Cross River Rail station and stadium precinct beyond original scope. Includes elevated walkway, wayfinding, and security screening plaza. Under review.', costCodeId: p.costCodes[11].id },
  ] : [
    { number: 'VO-001', title: 'Design Review — Pool End Wall Geometry Change', type: 'Design Development', status: 'approved', value: 320_000, submittedDate: `${addMonths(p.startYm, 1)}-20`, approvedDate: `${addMonths(p.startYm, 2)}-18`, description: 'FINA/World Aquatics technical representative required modification to pool end wall geometry for legal lane length compliance at all water levels. Impacts formwork design and waterproofing detailing.', costCodeId: p.costCodes[4].id },
    { number: 'VO-002', title: 'Additional Spectator Seating Upgrade', type: 'Client Variation', status: 'submitted', value: 1_850_000, submittedDate: `${addMonths(p.startYm, 2)}-10`, description: 'BCC requested upgrade of 1,200 grandstand seats from standard plastic to premium padded seats to improve spectator experience for post-Games community use. Under review.', costCodeId: p.costCodes[5].id },
  ];

  const changeDocs: any[] = [];
  const changeRecordDocs: any[] = [];

  for (const def of defs) {
    const changeId = uuid();
    changeDocs.push({
      ref: db.collection('changes').doc(changeId),
      data: {
        id: changeId,
        projectId: p.id,
        enterpriseId,
        number: def.number,
        title: def.title,
        type: def.type,
        status: def.status,
        value: def.value,
        description: def.description,
        costCodeId: def.costCodeId,
        submittedDate: def.submittedDate,
        approvedDate: def.approvedDate ?? null,
        submittedBy: p.pm,
        approvedBy: def.approvedDate ? 'Client Representative' : null,
        createdAt: now(),
        updatedAt: now(),
      },
    });

    if (def.status === 'approved') {
      const rrId = uuid();
      changeRecordDocs.push({
        ref: db.collection('changeRecords').doc(rrId),
        data: {
          id: rrId,
          changeId,
          projectId: p.id,
          enterpriseId,
          reportingMonth: def.approvedDate?.substring(0, 7) ?? CURRENT_YM,
          action: 'approved',
          value: def.value,
          notes: `Approved by client on ${def.approvedDate}. Budget adjusted accordingly.`,
          updatedBy: p.pm,
          createdAt: now(),
        },
      });
    }
  }

  return { changeDocs, changeRecordDocs };
}

// ── Procurement ──────────────────────────────────────────────────────────────

function buildProcurementStepDefs(p: ProjectDef, enterpriseId: string) {
  const id = uuid();
  return [{
    ref: db.collection('procurementStepDefinitions').doc(id),
    data: {
      id,
      projectId: p.id,
      enterpriseId,
      steps: [
        { id: 'step-1', name: 'Market Sounding', durationDays: 14, order: 1 },
        { id: 'step-2', name: 'RFT Issue', durationDays: 7, order: 2 },
        { id: 'step-3', name: 'Tender Period', durationDays: 28, order: 3 },
        { id: 'step-4', name: 'Tender Evaluation', durationDays: 21, order: 4 },
        { id: 'step-5', name: 'Negotiation & BAFO', durationDays: 14, order: 5 },
        { id: 'step-6', name: 'Approval & Award', durationDays: 14, order: 6 },
        { id: 'step-7', name: 'Contract Execution', durationDays: 7, order: 7 },
      ],
      createdAt: now(),
    },
  }];
}

function buildProcurementItems(p: ProjectDef, enterpriseId: string) {
  interface ProcDef {
    code: string;
    title: string;
    category: string;
    estimatedValue: number;
    strategy: string;
    requireByDate: string;
    status: string;
    costCodeId: string;
  }

  const defs: ProcDef[] = p.id === P1_ID ? [
    { code: 'PR-001', title: 'Civil Works & Earthworks', category: 'Civil & Earthworks', estimatedValue: 95_000_000, strategy: 'Lump Sum Competitive Tender (min 3 compliant)', requireByDate: `${addMonths(p.startYm, 3)}-01`, status: 'awarded', costCodeId: p.costCodes[3].id },
    { code: 'PR-002', title: 'Structural Concrete Subcontract Package', category: 'Civil & Earthworks', estimatedValue: 243_000_000, strategy: 'Lump Sum Competitive Tender (min 4 compliant)', requireByDate: `${addMonths(p.startYm, 8)}-01`, status: 'awarded', costCodeId: p.costCodes[4].id },
    { code: 'PR-003', title: 'Building Façade & External Cladding', category: 'Building Envelope', estimatedValue: 178_000_000, strategy: 'Design & Construct Tender with Novation', requireByDate: `${addMonths(p.startYm, 15)}-01`, status: 'evaluation', costCodeId: p.costCodes[5].id },
    { code: 'PR-004', title: 'HVAC, BMS & Mechanical Services', category: 'MEP', estimatedValue: 120_000_000, strategy: 'Lump Sum Competitive Tender', requireByDate: `${addMonths(p.startYm, 19)}-01`, status: 'tender', costCodeId: p.costCodes[6].id },
    { code: 'PR-005', title: 'Electrical, Communications & Security', category: 'MEP', estimatedValue: 98_000_000, strategy: 'Lump Sum Competitive Tender', requireByDate: `${addMonths(p.startYm, 19)}-01`, status: 'planning', costCodeId: p.costCodes[7].id },
  ] : p.id === P2_ID ? [
    { code: 'PR-001', title: 'Demolition & Asbestos Removal', category: 'Civil & Earthworks', estimatedValue: 40_000_000, strategy: 'Lump Sum — Pre-qualified contractors only', requireByDate: `${addMonths(p.startYm, 2)}-01`, status: 'awarded', costCodeId: p.costCodes[2].id },
    { code: 'PR-002', title: 'Piling & Foundation Works', category: 'Civil & Earthworks', estimatedValue: 195_000_000, strategy: 'Lump Sum Competitive Tender (specialist contractors)', requireByDate: `${addMonths(p.startYm, 6)}-01`, status: 'awarded', costCodeId: p.costCodes[3].id },
    { code: 'PR-003', title: 'Primary Structural Steelwork Bowl & Roof', category: 'Structural Steel', estimatedValue: 545_000_000, strategy: 'EPC Contractor — Supply, Fabrication & Erection', requireByDate: `${addMonths(p.startYm, 13)}-01`, status: 'awarded', costCodeId: p.costCodes[4].id },
    { code: 'PR-004', title: 'MEP Integrated Package', category: 'MEP', estimatedValue: 325_000_000, strategy: 'Design & Construct MEP Contractor', requireByDate: `${addMonths(p.startYm, 25)}-01`, status: 'tender', costCodeId: p.costCodes[7].id },
    { code: 'PR-005', title: 'Seating & Sports Field of Play Equipment', category: 'Specialist Equipment', estimatedValue: 148_000_000, strategy: 'Direct Negotiation — World Athletics accredited suppliers', requireByDate: `${addMonths(p.startYm, 48)}-01`, status: 'planning', costCodeId: p.costCodes[8].id },
    { code: 'PR-006', title: 'ICT, AV & Broadcast Infrastructure', category: 'Specialist Equipment', estimatedValue: 89_000_000, strategy: 'OBS/IOC Preferred Supplier List', requireByDate: `${addMonths(p.startYm, 48)}-01`, status: 'planning', costCodeId: p.costCodes[12].id },
  ] : [
    { code: 'PR-001', title: 'Pool Structure, Waterproofing & Tiling Package', category: 'Civil & Earthworks', estimatedValue: 32_000_000, strategy: 'Lump Sum Competitive Tender (aquatic specialists)', requireByDate: `${addMonths(p.startYm, 8)}-01`, status: 'planning', costCodeId: p.costCodes[4].id },
    { code: 'PR-002', title: 'Pool Water Treatment Plant & Filtration', category: 'Specialist Equipment', estimatedValue: 14_000_000, strategy: 'International Tender — FINA accredited equipment', requireByDate: `${addMonths(p.startYm, 6)}-01`, status: 'evaluation', costCodeId: p.costCodes[7].id },
    { code: 'PR-003', title: 'MEP Services Package', category: 'MEP', estimatedValue: 22_000_000, strategy: 'Lump Sum Competitive Tender', requireByDate: `${addMonths(p.startYm, 20)}-01`, status: 'planning', costCodeId: p.costCodes[8].id },
  ];

  return defs.map(def => {
    const id = uuid();
    return {
      ref: db.collection('procurementItems').doc(id),
      data: {
        id,
        projectId: p.id,
        enterpriseId,
        code: def.code,
        title: def.title,
        category: def.category,
        estimatedValue: def.estimatedValue,
        awardedValue: def.status === 'awarded' ? Math.round(def.estimatedValue * (0.92 + Math.random() * 0.12)) : null,
        strategy: def.strategy,
        requireByDate: def.requireByDate,
        status: def.status,
        costCodeId: def.costCodeId,
        currentStep: def.status === 'awarded' ? 'step-7' : def.status === 'evaluation' ? 'step-4' : def.status === 'tender' ? 'step-3' : 'step-1',
        stepHistory: def.status === 'awarded' ? [
          { stepId: 'step-1', completedDate: addMonths(def.requireByDate.substring(0, 7), -4) + '-01', notes: 'Market sounding complete. 8 expressions of interest received.' },
          { stepId: 'step-2', completedDate: addMonths(def.requireByDate.substring(0, 7), -3) + '-01', notes: 'RFT issued to 5 pre-qualified contractors.' },
          { stepId: 'step-3', completedDate: addMonths(def.requireByDate.substring(0, 7), -2) + '-05', notes: '4 compliant tenders received.' },
          { stepId: 'step-4', completedDate: addMonths(def.requireByDate.substring(0, 7), -1) + '-10', notes: 'Preferred contractor recommended to client.' },
          { stepId: 'step-5', completedDate: addMonths(def.requireByDate.substring(0, 7), -1) + '-25', notes: 'BAFO received and accepted.' },
          { stepId: 'step-6', completedDate: def.requireByDate, notes: 'Client approval obtained. Award recommendation accepted.' },
          { stepId: 'step-7', completedDate: addMonths(def.requireByDate.substring(0, 7), 1) + '-10', notes: 'Contract executed. Subcontractor NTP issued.' },
        ] : [],
        createdAt: now(),
        updatedAt: now(),
      },
    };
  });
}

// ── Progress ─────────────────────────────────────────────────────────────────

function buildProgress(p: ProjectDef, enterpriseId: string) {
  const packageDocs: any[] = [];
  const itemDocs: any[] = [];
  const periodDocs: any[] = [];
  const rocDocs: any[] = [];

  // Rules of Credit
  const rocIds = ['roc-1', 'roc-2', 'roc-3'].map(k => ({ key: k, id: uuid() }));
  const rocData = [
    { name: '0/100 Rule', description: 'No credit until fully complete. 100% on completion only.', steps: [{ pct: 0, milestone: 'Start' }, { pct: 100, milestone: 'Complete' }] },
    { name: '20/80 Rule', description: '20% on commencement, 80% on completion.', steps: [{ pct: 20, milestone: 'Commenced' }, { pct: 100, milestone: 'Complete' }] },
    { name: 'Milestone', description: 'Progress claimed at defined milestones.', steps: [{ pct: 10, milestone: 'Foundations' }, { pct: 40, milestone: 'Structure' }, { pct: 70, milestone: 'Fitout' }, { pct: 100, milestone: 'Practical Completion' }] },
  ];

  rocIds.forEach(({ id }, i) => {
    rocDocs.push({
      ref: db.collection('rulesOfCredit').doc(id),
      data: { id, projectId: p.id, enterpriseId, ...rocData[i], createdAt: now() },
    });
  });

  // Progress packages (3 per project)
  const packageDefs = [
    { code: 'PP-01', name: 'Design & Pre-Construction Works', costCodeId: p.costCodes[1].id, contract: 85 },
    { code: 'PP-02', name: 'Civil & Substructure Works', costCodeId: p.costCodes[3]?.id ?? p.costCodes[0].id, contract: 52 },
    { code: 'PP-03', name: 'Structural Frame', costCodeId: p.costCodes[4]?.id ?? p.costCodes[0].id, contract: 18 },
  ];

  for (const pkg of packageDefs) {
    const pkgId = uuid();
    packageDocs.push({
      ref: db.collection('progressPackages').doc(pkgId),
      data: {
        id: pkgId,
        projectId: p.id,
        enterpriseId,
        code: pkg.code,
        name: pkg.name,
        costCodeId: pkg.costCodeId,
        contractualCompletion: pkg.contract,
        assessedCompletion: Math.min(100, pkg.contract + Math.round((Math.random() - 0.3) * 10)),
        status: pkg.contract >= 100 ? 'complete' : 'active',
        ruleOfCreditId: rocIds[0].id,
        createdAt: now(),
        updatedAt: now(),
      },
    });

    // 2-3 progress items per package
    const itemDefs = [
      { description: 'Preliminary activities & mobilisation', weight: 15, pct: 100 },
      { description: 'Primary scope works', weight: 70, pct: Math.min(100, pkg.contract) },
      { description: 'Commissioning & handover', weight: 15, pct: pkg.contract >= 90 ? 50 : 0 },
    ];

    for (const item of itemDefs) {
      const itemId = uuid();
      itemDocs.push({
        ref: db.collection('progressItems').doc(itemId),
        data: {
          id: itemId,
          packageDocId: pkgId,
          projectId: p.id,
          enterpriseId,
          description: item.description,
          weight: item.weight,
          percentComplete: item.pct,
          earnedValue: Math.round(item.weight * item.pct / 100),
          createdAt: now(),
          updatedAt: now(),
        },
      });
    }
  }

  // Reporting periods (monthly)
  const closedMonths = Math.max(0, monthDiff(p.startYm, CURRENT_YM) + 1);
  for (let i = 0; i < closedMonths; i++) {
    const ym = addMonths(p.startYm, i);
    const periodId = uuid();
    periodDocs.push({
      ref: db.collection('progressReportingPeriods').doc(periodId),
      data: {
        id: periodId,
        projectId: p.id,
        enterpriseId,
        reportingMonth: ym,
        status: i < closedMonths - 1 ? 'closed' : 'open',
        overallProgress: Math.min(95, Math.round((i / closedMonths) * 100 * 0.85 + 5)),
        createdAt: now(),
      },
    });
  }

  return { packageDocs, itemDocs, periodDocs, rocDocs };
}

// ── Schedule ─────────────────────────────────────────────────────────────────

function buildScheduleItems(p: ProjectDef, enterpriseId: string) {
  interface SchedDef { code: string; name: string; type: string; plannedStart: string; plannedEnd: string; duration: number; isMilestone: boolean; criticalPath: boolean }

  const defs: SchedDef[] = p.id === P1_ID ? [
    { code: 'MS-001', name: 'Project Notice to Proceed', type: 'milestone', plannedStart: `${p.startYm}-01`, plannedEnd: `${p.startYm}-01`, duration: 0, isMilestone: true, criticalPath: true },
    { code: 'S-001', name: 'Early Contractor Involvement & Design', type: 'design', plannedStart: `${p.startYm}-01`, plannedEnd: lastDay(addMonths(p.startYm, 11)), duration: 12, isMilestone: false, criticalPath: true },
    { code: 'S-002', name: 'Site Preparation & Demolition', type: 'construction', plannedStart: `${addMonths(p.startYm, 2)}-01`, plannedEnd: lastDay(addMonths(p.startYm, 11)), duration: 10, isMilestone: false, criticalPath: false },
    { code: 'S-003', name: 'Civil Works & Foundations', type: 'construction', plannedStart: `${addMonths(p.startYm, 4)}-01`, plannedEnd: lastDay(addMonths(p.startYm, 21)), duration: 18, isMilestone: false, criticalPath: true },
    { code: 'S-004', name: 'Structural Frame — All Buildings', type: 'construction', plannedStart: `${addMonths(p.startYm, 10)}-01`, plannedEnd: lastDay(addMonths(p.startYm, 33)), duration: 24, isMilestone: false, criticalPath: true },
    { code: 'S-005', name: 'Building Envelope & Façade', type: 'construction', plannedStart: `${addMonths(p.startYm, 18)}-01`, plannedEnd: lastDay(addMonths(p.startYm, 35)), duration: 18, isMilestone: false, criticalPath: true },
    { code: 'S-006', name: 'MEP Rough-in & Services', type: 'construction', plannedStart: `${addMonths(p.startYm, 22)}-01`, plannedEnd: lastDay(addMonths(p.startYm, 43)), duration: 22, isMilestone: false, criticalPath: false },
    { code: 'S-007', name: 'Interior Fit-out & Finishes', type: 'construction', plannedStart: `${addMonths(p.startYm, 30)}-01`, plannedEnd: lastDay(addMonths(p.startYm, 51)), duration: 22, isMilestone: false, criticalPath: false },
    { code: 'S-008', name: 'External Works & Landscaping', type: 'construction', plannedStart: `${addMonths(p.startYm, 50)}-01`, plannedEnd: lastDay(addMonths(p.startYm, 61)), duration: 12, isMilestone: false, criticalPath: false },
    { code: 'MS-002', name: 'Practical Completion', type: 'milestone', plannedStart: lastDay(addMonths(p.startYm, 62)), plannedEnd: lastDay(addMonths(p.startYm, 62)), duration: 0, isMilestone: true, criticalPath: true },
    { code: 'MS-003', name: 'Village Opens for Games', type: 'milestone', plannedStart: '2032-07-01', plannedEnd: '2032-07-01', duration: 0, isMilestone: true, criticalPath: true },
  ] : p.id === P2_ID ? [
    { code: 'MS-001', name: 'Project Notice to Proceed', type: 'milestone', plannedStart: `${p.startYm}-01`, plannedEnd: `${p.startYm}-01`, duration: 0, isMilestone: true, criticalPath: true },
    { code: 'S-001', name: 'Demolition & Asbestos Removal', type: 'demolition', plannedStart: `${addMonths(p.startYm, 3)}-01`, plannedEnd: lastDay(addMonths(p.startYm, 14)), duration: 12, isMilestone: false, criticalPath: true },
    { code: 'S-002', name: 'Piling & Deep Foundations', type: 'construction', plannedStart: `${addMonths(p.startYm, 8)}-01`, plannedEnd: lastDay(addMonths(p.startYm, 25)), duration: 18, isMilestone: false, criticalPath: true },
    { code: 'S-003', name: 'Structural Steel Fabrication (Offshore)', type: 'procurement', plannedStart: `${addMonths(p.startYm, 6)}-01`, plannedEnd: lastDay(addMonths(p.startYm, 24)), duration: 19, isMilestone: false, criticalPath: true },
    { code: 'S-004', name: 'Structural Steel Erection — Bowl', type: 'construction', plannedStart: `${addMonths(p.startYm, 16)}-01`, plannedEnd: lastDay(addMonths(p.startYm, 31)), duration: 16, isMilestone: false, criticalPath: true },
    { code: 'S-005', name: 'Roof Structure & Canopy', type: 'construction', plannedStart: `${addMonths(p.startYm, 28)}-01`, plannedEnd: lastDay(addMonths(p.startYm, 43)), duration: 16, isMilestone: false, criticalPath: true },
    { code: 'S-006', name: 'Concrete Terrace & Concourse', type: 'construction', plannedStart: `${addMonths(p.startYm, 14)}-01`, plannedEnd: lastDay(addMonths(p.startYm, 35)), duration: 22, isMilestone: false, criticalPath: false },
    { code: 'S-007', name: 'MEP Installation', type: 'construction', plannedStart: `${addMonths(p.startYm, 28)}-01`, plannedEnd: lastDay(addMonths(p.startYm, 51)), duration: 24, isMilestone: false, criticalPath: false },
    { code: 'S-008', name: 'Seating Installation', type: 'construction', plannedStart: `${addMonths(p.startYm, 52)}-01`, plannedEnd: lastDay(addMonths(p.startYm, 63)), duration: 12, isMilestone: false, criticalPath: true },
    { code: 'MS-002', name: 'Structural Topping Out', type: 'milestone', plannedStart: lastDay(addMonths(p.startYm, 31)), plannedEnd: lastDay(addMonths(p.startYm, 31)), duration: 0, isMilestone: true, criticalPath: true },
    { code: 'MS-003', name: 'Practical Completion', type: 'milestone', plannedStart: '2031-07-31', plannedEnd: '2031-07-31', duration: 0, isMilestone: true, criticalPath: true },
    { code: 'MS-004', name: 'Opening Ceremony — Paris 2032', type: 'milestone', plannedStart: '2032-07-23', plannedEnd: '2032-07-23', duration: 0, isMilestone: true, criticalPath: true },
  ] : [
    { code: 'MS-001', name: 'Project Commencement', type: 'milestone', plannedStart: `${p.startYm}-01`, plannedEnd: `${p.startYm}-01`, duration: 0, isMilestone: true, criticalPath: true },
    { code: 'S-001', name: 'Design & Engineering', type: 'design', plannedStart: `${p.startYm}-01`, plannedEnd: lastDay(addMonths(p.startYm, 11)), duration: 12, isMilestone: false, criticalPath: true },
    { code: 'S-002', name: 'Civil Works & Pool Excavation', type: 'construction', plannedStart: `${addMonths(p.startYm, 6)}-01`, plannedEnd: lastDay(addMonths(p.startYm, 17)), duration: 12, isMilestone: false, criticalPath: true },
    { code: 'S-003', name: 'Pool Structure & Waterproofing', type: 'construction', plannedStart: `${addMonths(p.startYm, 10)}-01`, plannedEnd: lastDay(addMonths(p.startYm, 27)), duration: 18, isMilestone: false, criticalPath: true },
    { code: 'S-004', name: 'Grandstand Structural Works', type: 'construction', plannedStart: `${addMonths(p.startYm, 16)}-01`, plannedEnd: lastDay(addMonths(p.startYm, 31)), duration: 16, isMilestone: false, criticalPath: false },
    { code: 'S-005', name: 'MEP & Pool Treatment Plant', type: 'construction', plannedStart: `${addMonths(p.startYm, 22)}-01`, plannedEnd: lastDay(addMonths(p.startYm, 37)), duration: 16, isMilestone: false, criticalPath: false },
    { code: 'S-006', name: 'Fit-out & Commissioning', type: 'construction', plannedStart: `${addMonths(p.startYm, 36)}-01`, plannedEnd: lastDay(addMonths(p.startYm, 49)), duration: 14, isMilestone: false, criticalPath: true },
    { code: 'MS-002', name: 'Practical Completion', type: 'milestone', plannedStart: '2031-03-31', plannedEnd: '2031-03-31', duration: 0, isMilestone: true, criticalPath: true },
    { code: 'MS-003', name: 'Ready for Olympic Test Events', type: 'milestone', plannedStart: '2031-11-01', plannedEnd: '2031-11-01', duration: 0, isMilestone: true, criticalPath: true },
  ];

  return defs.map(def => {
    const id = uuid();
    const closedMonths = Math.max(0, monthDiff(p.startYm, CURRENT_YM) + 1);
    const plannedStartMonth = def.plannedStart.substring(0, 7);
    const isStarted = plannedStartMonth <= CURRENT_YM;
    const isComplete = def.plannedEnd.substring(0, 7) < CURRENT_YM;

    return {
      ref: db.collection('scheduleItems').doc(id),
      data: {
        id,
        projectId: p.id,
        enterpriseId,
        code: def.code,
        name: def.name,
        type: def.type,
        plannedStartDate: def.plannedStart,
        plannedEndDate: def.plannedEnd,
        forecastStartDate: def.plannedStart,
        forecastEndDate: def.plannedEnd,
        actualStartDate: isStarted ? def.plannedStart : null,
        actualEndDate: isComplete ? def.plannedEnd : null,
        duration: def.duration,
        isMilestone: def.isMilestone,
        criticalPath: def.criticalPath,
        percentComplete: isComplete ? 100 : isStarted ? Math.round((closedMonths / (def.duration || 1)) * 100 * 0.9) : 0,
        status: isComplete ? 'complete' : isStarted ? 'active' : 'not-started',
        createdAt: now(),
        updatedAt: now(),
      },
    };
  });
}

// ── Calendar ─────────────────────────────────────────────────────────────────

function buildCalendar(p: ProjectDef, enterpriseId: string) {
  const id = uuid();
  return [{
    ref: db.collection('calendars').doc(id),
    data: {
      id,
      projectId: p.id,
      enterpriseId,
      name: 'Standard QLD Construction Calendar',
      workDaysPerWeek: 5,
      workHoursPerDay: 10,
      publicHolidays: [
        { date: '2026-01-01', name: "New Year's Day" },
        { date: '2026-01-26', name: 'Australia Day' },
        { date: '2026-04-03', name: 'Good Friday' },
        { date: '2026-04-04', name: 'Easter Saturday' },
        { date: '2026-04-06', name: 'Easter Monday' },
        { date: '2026-04-25', name: 'ANZAC Day' },
        { date: '2026-05-04', name: 'Labour Day (QLD)' },
        { date: '2026-08-12', name: 'Royal Queensland Show (Brisbane)' },
        { date: '2026-10-05', name: 'Queen\'s Birthday (QLD)' },
        { date: '2026-12-25', name: 'Christmas Day' },
        { date: '2026-12-26', name: 'Boxing Day' },
        { date: '2026-12-28', name: 'Boxing Day (observed)' },
      ],
      createdAt: now(),
    },
  }];
}

// ── ETC Details ──────────────────────────────────────────────────────────────

function buildEtcDetails(p: ProjectDef, enterpriseId: string) {
  // Only create ETC details for cost codes that are active
  return p.costCodes
    .filter((_, i) => i < 4)
    .map(cc => {
      const id = uuid();
      const phases = phaseBudget(cc.budget, addMonths(p.startYm, cc.subStartOffset), cc.duration, cc.curve);
      const actuals = simulateActuals(phases, CURRENT_YM);
      const spent = sum(actuals.map(a => a.amount));
      const eac = Math.round(cc.budget * (1 + Math.random() * 0.05));
      return {
        ref: db.collection('etcDetails').doc(id),
        data: {
          id,
          projectId: p.id,
          costCodeId: cc.id,
          enterpriseId,
          reportingMonth: CURRENT_YM,
          method: 'detailed-reforecast',
          etc: Math.max(0, eac - spent),
          eac,
          assumptions: `Reforecast based on current progress and known commitments. ${cc.name} — ETC derived from remaining work schedule and current unit rates indexed to ${monthLabel(CURRENT_YM)}.`,
          preparedBy: p.pm,
          approvedBy: null,
          status: 'draft',
          createdAt: now(),
        },
      };
    });
}

// ── Cost Phasing ──────────────────────────────────────────────────────────────

function buildCostPhasing(p: ProjectDef, enterpriseId: string) {
  const docs: any[] = [];
  for (const cc of p.costCodes) {
    const phases = phaseBudget(cc.budget, addMonths(p.startYm, cc.subStartOffset), cc.duration, cc.curve);
    for (const ph of phases) {
      if (ph.amount <= 0) continue;
      const id = uuid();
      docs.push({
        ref: db.collection('costPhasing').doc(id),
        data: {
          id,
          projectId: p.id,
          costCodeId: cc.id,
          enterpriseId,
          reportingMonth: ph.ym,
          plannedAmount: ph.amount,
          budgetVersion: 'current',
          createdAt: now(),
        },
      });
    }
  }
  return docs;
}

// ── Period Snapshots ──────────────────────────────────────────────────────────

function buildPeriodSnapshots(p: ProjectDef, enterpriseId: string) {
  const docs: any[] = [];
  const closedMonths = Math.max(0, monthDiff(p.startYm, CURRENT_YM) + 1);
  for (let i = 0; i < closedMonths; i++) {
    const ym = addMonths(p.startYm, i);
    const totalBudget = p.totalBudget;
    const cumulativeSpend = Math.round(totalBudget * (i / closedMonths) * 0.4 * Math.min(1, i / (closedMonths * 0.5)));
    const id = uuid();
    docs.push({
      ref: db.collection('periodSnapshots').doc(id),
      data: {
        id,
        projectId: p.id,
        enterpriseId,
        reportingMonth: ym,
        totalBudget,
        approvedBudget: totalBudget,
        eac: Math.round(totalBudget * (1 + Math.random() * 0.04)),
        actualCostToDate: cumulativeSpend,
        committedCosts: Math.round(cumulativeSpend * 1.15),
        percentComplete: Math.round((i / closedMonths) * 60),
        createdAt: now(),
      },
    });
  }
  return docs;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🏗️  Olympia Build Group — Brisbane 2032 Seed Script');
  console.log('='.repeat(55));

  const enterpriseId = await getOrCreateEnterpriseId();
  const allDocs: Array<{ ref: FirebaseFirestore.DocumentReference; data: object }> = [];

  // Enterprise
  console.log('\n→ Enterprise...');
  allDocs.push(buildEnterprise(enterpriseId));

  // Update userRoles to include enterprise membership
  allDocs.push({
    ref: db.collection('userRoles').doc(UID),
    data: {
      uid: UID,
      enterpriseId,
      platformRole: 'platform_admin',
      memberships: [{ enterpriseId, role: 'enterprise_admin' }],
      updatedAt: now(),
    },
  });

  for (const p of PROJECTS) {
    console.log(`\n→ Project: ${p.name}...`);

    // Project
    allDocs.push(buildProject(p, enterpriseId));

    // Cost codes
    const ccDocs = buildCostCodes(p, enterpriseId);
    allDocs.push(...ccDocs);

    // Actuals
    const actualDocs = buildActualCosts(p, enterpriseId);
    allDocs.push(...actualDocs);

    // Baseline budgets
    const bbDocs = buildBaselineBudgets(p, enterpriseId);
    allDocs.push(...bbDocs);

    // Cost phasing
    const phasingDocs = buildCostPhasing(p, enterpriseId);
    allDocs.push(...phasingDocs);

    // Period snapshots
    const snapshotDocs = buildPeriodSnapshots(p, enterpriseId);
    allDocs.push(...snapshotDocs);

    // Subcontracts + invoices
    const { subcDocs, invoiceDocs } = buildSubcontracts(p, enterpriseId);
    allDocs.push(...subcDocs, ...invoiceDocs);

    // Risks + records
    const { riskDocs, riskRecordDocs } = buildRisks(p, enterpriseId);
    allDocs.push(...riskDocs, ...riskRecordDocs);

    // Changes + records
    const { changeDocs, changeRecordDocs } = buildChanges(p, enterpriseId);
    allDocs.push(...changeDocs, ...changeRecordDocs);

    // Procurement
    const stepDefs = buildProcurementStepDefs(p, enterpriseId);
    const procItems = buildProcurementItems(p, enterpriseId);
    allDocs.push(...stepDefs, ...procItems);

    // Progress
    const { packageDocs, itemDocs, periodDocs, rocDocs } = buildProgress(p, enterpriseId);
    allDocs.push(...packageDocs, ...itemDocs, ...periodDocs, ...rocDocs);

    // Schedule
    const schedDocs = buildScheduleItems(p, enterpriseId);
    allDocs.push(...schedDocs);

    // ETC details
    const etcDocs = buildEtcDetails(p, enterpriseId);
    allDocs.push(...etcDocs);

    // Calendar
    const calDocs = buildCalendar(p, enterpriseId);
    allDocs.push(...calDocs);

    console.log(`   Cost codes: ${ccDocs.length}, Actuals: ${actualDocs.length}, Budgets: ${bbDocs.length}`);
    console.log(`   Subcontracts: ${subcDocs.length}, Invoices: ${invoiceDocs.length}`);
    console.log(`   Risks: ${riskDocs.length}, Changes: ${changeDocs.length}`);
    console.log(`   Procurement: ${procItems.length}, Progress pkgs: ${packageDocs.length}`);
    console.log(`   Schedule: ${schedDocs.length}, Snapshots: ${snapshotDocs.length}`);
  }

  console.log(`\n→ Writing ${allDocs.length} documents to Firestore...`);
  await batchWrite(allDocs);

  console.log('\n✅ Seed complete!');
  console.log(`   Enterprise: ${enterpriseId}`);
  console.log(`   Projects:   ${PROJECTS.map(p => p.code).join(', ')}`);
  console.log(`   Total docs: ${allDocs.length}`);
  process.exit(0);
}

main().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
