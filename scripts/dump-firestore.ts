/**
 * One-time (or "run again when the seed data actually changes") full read
 * of every Firestore collection the ETL touches, written to local JSON.
 * Point etl-firestore-to-postgres.ts at the result with --from-dump to
 * iterate on bug fixes without spending any more Firestore read quota --
 * this script is the only thing that should need live Firestore reads
 * during normal debugging.
 *
 * Usage: npx tsx scripts/dump-firestore.ts [outputDir]  (default: firestore-dump)
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { convertTimestamps } from './lib/convert-timestamps';

const serviceAccount = JSON.parse(readFileSync('./scripts/service-account.json', 'utf8'));
const config = JSON.parse(readFileSync('./firebase-applet-config.json', 'utf8'));
initializeApp({ credential: cert(serviceAccount), projectId: config.projectId });
const firestore: Firestore = getFirestore(config.firestoreDatabaseId);

const outputDir = process.argv[2] ?? 'firestore-dump';
mkdirSync(outputDir, { recursive: true });

// Every top-level collection the ETL reads from (see the grep this was
// derived from: every distinct .collection('X') call site in
// etl-firestore-to-postgres.ts, minus 'rows' which is a sheets subcollection
// handled separately below).
const TOP_LEVEL_COLLECTIONS = [
  'enterprises', 'projects',
  'costCodes', 'sheets', 'baselineBudgets', 'costPhasing', 'etcDetails', 'actualCosts',
  'changes', 'changeRecords', 'risks', 'riskRecords',
  'subcontracts', 'invoices',
  'progressPackages', 'progressItems', 'progressAttributes', 'rulesOfCredit', 'progressReportingPeriods', 'periodSnapshots',
  'scheduleItems', 'calendars',
  'procurementItems', 'procurementStepDefinitions',
  'auditLogs',
];

let totalDocs = 0;

async function dumpCollection(name: string): Promise<Array<{ __id: string }>> {
  const snap = await firestore.collection(name).get();
  const docs = snap.docs.map((d) => ({ __id: d.id, ...(convertTimestamps(d.data()) as object) }));
  writeFileSync(join(outputDir, `${name}.json`), JSON.stringify(docs, null, 2));
  totalDocs += docs.length;
  console.log(`  ${name}: ${docs.length} docs`);
  return docs;
}

async function main() {
  console.log(`Dumping Firestore (database: ${config.firestoreDatabaseId}) to ${outputDir}/ ...`);
  let sheetsDocs: Array<{ __id: string }> = [];
  for (const name of TOP_LEVEL_COLLECTIONS) {
    const docs = await dumpCollection(name);
    if (name === 'sheets') sheetsDocs = docs;
  }

  // sheets/{id}/rows -- the one subcollection the ETL reads. Dumped as a
  // single file keyed by parent sheet id rather than one file per sheet.
  console.log('  sheets/{id}/rows ...');
  const sheetRows: Record<string, Array<{ __id: string }>> = {};
  for (const sheet of sheetsDocs) {
    const rowsSnap = await firestore.collection('sheets').doc(sheet.__id).collection('rows').get();
    const rows = rowsSnap.docs.map((d) => ({ __id: d.id, ...(convertTimestamps(d.data()) as object) }));
    sheetRows[sheet.__id] = rows;
    totalDocs += rows.length;
  }
  writeFileSync(join(outputDir, 'sheet-rows.json'), JSON.stringify(sheetRows, null, 2));
  console.log(`  sheets/{id}/rows: ${Object.values(sheetRows).reduce((n, r) => n + r.length, 0)} docs across ${sheetsDocs.length} sheets`);

  writeFileSync(join(outputDir, 'manifest.json'), JSON.stringify({ dumpedAt: new Date().toISOString(), totalDocs }, null, 2));
  console.log(`\nDone. ${totalDocs} documents dumped to ${outputDir}/.`);
  console.log(`Run the ETL against this dump with: npx tsx scripts/etl-firestore-to-postgres.ts --from-dump ${outputDir} --all-projects --apply`);
}

main().catch((err) => {
  console.error('Dump failed:', err);
  process.exit(1);
});
