/**
 * Phase 13.B2.1 (SYSTEM_REVIEW.md v2 / PLAN.md F5): audit — and, only with
 * --apply, fix — the ambiguous costCodeId foreign key across the four
 * collections that accept either a CostCode's Firestore doc id OR its
 * human-entered `code` string (the `id || code` fallback pattern preserved
 * in src/domain/rollups.ts::sumByIdOrCode until this is normalized):
 *   - actualCosts        (ActualCostRecord.costCodeId)
 *   - baselineBudgets    (BaselineBudgetRecord.costCodeId)
 *   - changeRecords      (ChangeRecord.costCodeId)
 *   - subcontracts       (Subcontract.lineItems[].costCodeId, embedded array)
 *   - subcontracts       (Subcontract.defaultCostCodeId, scalar field)
 *
 * NOT in scope: costPhasing and etcDetails key by `code` consistently (no
 * ambiguity — a different convention, not a bug), so they're left alone.
 *
 * Default mode is a REPORT ONLY — it never writes to Firestore. Pass
 * --apply to actually normalize ambiguous costCodeId values to the doc id.
 * Orphaned records (costCodeId matches neither an id nor a code) are never
 * auto-fixed — they're reported for manual review only, in both modes.
 *
 * Usage:
 *   npx tsx scripts/normalize-costcode-fk.ts --project <projectId>              (report only)
 *   npx tsx scripts/normalize-costcode-fk.ts --project <projectId> --apply      (writes fixes)
 *   npx tsx scripts/normalize-costcode-fk.ts --all-projects                     (report only, every project)
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(readFileSync('./scripts/service-account.json', 'utf8'));
const config = JSON.parse(readFileSync('./firebase-applet-config.json', 'utf8'));

initializeApp({ credential: cert(serviceAccount), projectId: config.projectId });
const db = getFirestore(config.firestoreDatabaseId);

const APPLY = process.argv.includes('--apply');
const ALL_PROJECTS = process.argv.includes('--all-projects');
const projectArgIndex = process.argv.indexOf('--project');
const singleProjectId = projectArgIndex !== -1 ? process.argv[projectArgIndex + 1] : null;

interface CostCodeLookup {
  idSet: Set<string>;
  codeToId: Map<string, string>;
}

interface AuditResult {
  ok: number;
  ambiguous: number;
  orphaned: number;
  ambiguousSamples: Array<{ collection: string; docId: string; costCodeId: string; resolvesToId: string }>;
  orphanedSamples: Array<{ collection: string; docId: string; costCodeId: string }>;
}

function classify(costCodeId: string | undefined, lookup: CostCodeLookup): 'ok' | 'ambiguous' | 'orphaned' | 'empty' {
  if (!costCodeId) return 'empty';
  if (lookup.idSet.has(costCodeId)) return 'ok';
  if (lookup.codeToId.has(costCodeId)) return 'ambiguous';
  return 'orphaned';
}

async function buildLookup(projectId: string): Promise<CostCodeLookup> {
  const snap = await db.collection('costCodes').where('projectId', '==', projectId).get();
  const idSet = new Set<string>();
  const codeToId = new Map<string, string>();
  snap.docs.forEach((d) => {
    idSet.add(d.id);
    const code = d.data().code;
    if (code) codeToId.set(String(code), d.id);
  });
  return { idSet, codeToId };
}

async function auditTopLevelCollection(
  collectionName: string,
  projectId: string,
  lookup: CostCodeLookup,
  result: AuditResult,
  fieldName: string = 'costCodeId',
  sampleLabel: string = collectionName,
): Promise<Array<{ ref: FirebaseFirestore.DocumentReference; newCostCodeId: string }>> {
  const snap = await db.collection(collectionName).where('projectId', '==', projectId).get();
  const fixes: Array<{ ref: FirebaseFirestore.DocumentReference; newCostCodeId: string }> = [];

  snap.docs.forEach((doc) => {
    const costCodeId = doc.data()[fieldName] as string | undefined;
    const status = classify(costCodeId, lookup);
    if (status === 'ok' || status === 'empty') { if (status === 'ok') result.ok++; return; }
    if (status === 'ambiguous') {
      const resolvesToId = lookup.codeToId.get(costCodeId!)!;
      result.ambiguous++;
      if (result.ambiguousSamples.length < 10) {
        result.ambiguousSamples.push({ collection: sampleLabel, docId: doc.id, costCodeId: costCodeId!, resolvesToId });
      }
      fixes.push({ ref: doc.ref, newCostCodeId: resolvesToId });
    } else {
      result.orphaned++;
      if (result.orphanedSamples.length < 10) {
        result.orphanedSamples.push({ collection: sampleLabel, docId: doc.id, costCodeId: costCodeId! });
      }
    }
  });

  return fixes;
}

async function auditSubcontractLineItems(
  projectId: string,
  lookup: CostCodeLookup,
  result: AuditResult,
): Promise<Array<{ ref: FirebaseFirestore.DocumentReference; lineItems: any[] }>> {
  const snap = await db.collection('subcontracts').where('projectId', '==', projectId).get();
  const fixes: Array<{ ref: FirebaseFirestore.DocumentReference; lineItems: any[] }> = [];

  snap.docs.forEach((doc) => {
    const lineItems = (doc.data().lineItems || []) as any[];
    let changed = false;
    const newLineItems = lineItems.map((li) => {
      const status = classify(li.costCodeId, lookup);
      if (status === 'ok' || status === 'empty') { if (status === 'ok') result.ok++; return li; }
      if (status === 'ambiguous') {
        const resolvesToId = lookup.codeToId.get(li.costCodeId)!;
        result.ambiguous++;
        if (result.ambiguousSamples.length < 10) {
          result.ambiguousSamples.push({ collection: 'subcontracts.lineItems', docId: doc.id, costCodeId: li.costCodeId, resolvesToId });
        }
        changed = true;
        return { ...li, costCodeId: resolvesToId };
      }
      result.orphaned++;
      if (result.orphanedSamples.length < 10) {
        result.orphanedSamples.push({ collection: 'subcontracts.lineItems', docId: doc.id, costCodeId: li.costCodeId });
      }
      return li;
    });
    if (changed) fixes.push({ ref: doc.ref, lineItems: newLineItems });
  });

  return fixes;
}

async function auditProject(projectId: string): Promise<void> {
  console.log(`\n=== Project ${projectId} ===`);
  const lookup = await buildLookup(projectId);
  console.log(`  ${lookup.idSet.size} cost codes found`);

  const result: AuditResult = { ok: 0, ambiguous: 0, orphaned: 0, ambiguousSamples: [], orphanedSamples: [] };

  const actualCostFixes = await auditTopLevelCollection('actualCosts', projectId, lookup, result);
  const baselineFixes = await auditTopLevelCollection('baselineBudgets', projectId, lookup, result);
  const changeRecordFixes = await auditTopLevelCollection('changeRecords', projectId, lookup, result);
  const subcontractFixes = await auditSubcontractLineItems(projectId, lookup, result);
  const defaultCostCodeFixes = await auditTopLevelCollection(
    'subcontracts', projectId, lookup, result, 'defaultCostCodeId', 'subcontracts.defaultCostCodeId'
  );

  console.log(`  ok: ${result.ok}  ambiguous (code used as id): ${result.ambiguous}  orphaned (matches nothing): ${result.orphaned}`);
  if (result.ambiguousSamples.length > 0) {
    console.log('  Ambiguous samples (first 10):');
    result.ambiguousSamples.forEach((s) => console.log(`    [${s.collection}] ${s.docId}: costCodeId="${s.costCodeId}" -> would become "${s.resolvesToId}"`));
  }
  if (result.orphanedSamples.length > 0) {
    console.log('  ORPHANED samples (first 10, needs manual review, NEVER auto-fixed):');
    result.orphanedSamples.forEach((s) => console.log(`    [${s.collection}] ${s.docId}: costCodeId="${s.costCodeId}" matches no cost code by id or code`));
  }

  if (!APPLY) {
    if (result.ambiguous > 0) console.log(`  DRY RUN — re-run with --apply to fix the ${result.ambiguous} ambiguous record(s) above.`);
    return;
  }

  if (result.ambiguous === 0) { console.log('  Nothing to fix.'); return; }

  console.log(`  Applying ${result.ambiguous} fixes...`);
  const writes: Array<(b: FirebaseFirestore.WriteBatch) => void> = [
    ...actualCostFixes.map((fix) => (b: FirebaseFirestore.WriteBatch) => b.update(fix.ref, { costCodeId: fix.newCostCodeId })),
    ...baselineFixes.map((fix) => (b: FirebaseFirestore.WriteBatch) => b.update(fix.ref, { costCodeId: fix.newCostCodeId })),
    ...changeRecordFixes.map((fix) => (b: FirebaseFirestore.WriteBatch) => b.update(fix.ref, { costCodeId: fix.newCostCodeId })),
    ...subcontractFixes.map((fix) => (b: FirebaseFirestore.WriteBatch) => b.update(fix.ref, { lineItems: fix.lineItems })),
    ...defaultCostCodeFixes.map((fix) => (b: FirebaseFirestore.WriteBatch) => b.update(fix.ref, { defaultCostCodeId: fix.newCostCodeId })),
  ];

  const BATCH_LIMIT = 400; // stay under Firestore's 500-write-per-batch limit
  let written = 0;
  for (let i = 0; i < writes.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    const chunk = writes.slice(i, i + BATCH_LIMIT);
    chunk.forEach((write) => write(batch));
    await batch.commit();
    written += chunk.length;
  }
  console.log(`  Done. Wrote ${written} updates across ${Math.ceil(writes.length / BATCH_LIMIT)} batch(es).`);
}

async function main(): Promise<void> {
  if (ALL_PROJECTS) {
    const projectsSnap = await db.collection('projects').get();
    for (const p of projectsSnap.docs) await auditProject(p.id);
    return;
  }
  if (!singleProjectId) {
    console.error('Usage: npx tsx scripts/normalize-costcode-fk.ts --project <projectId> [--apply]');
    console.error('   or: npx tsx scripts/normalize-costcode-fk.ts --all-projects  (report only)');
    process.exit(1);
  }
  await auditProject(singleProjectId);
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
