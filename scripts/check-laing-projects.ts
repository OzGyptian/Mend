import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const sa = JSON.parse(readFileSync(join(__dirname, 'service-account.json'), 'utf8'));
const cfg = JSON.parse(readFileSync(join(__dirname, '../firebase-applet-config.json'), 'utf8'));

initializeApp({ credential: cert(sa), projectId: cfg.projectId });
const db = getFirestore(cfg.firestoreDatabaseId);

const BERNARD_UID = '9vuBKmwGroSXqr6N9uhW8dkB98C2';

async function main() {
  const ents = await db.collection('enterprises').where('name', '==', "Laing O'Rourke").get();
  const leid = ents.docs[0]?.id;
  const entData = ents.docs[0]?.data();
  console.log('Laing OR id:', leid);
  console.log('adminUsers:', entData?.adminUsers);
  console.log('Bernard in adminUsers:', entData?.adminUsers?.includes(BERNARD_UID));

  const projs = await db.collection('projects').where('enterpriseId', '==', leid).get();
  console.log('\nProjects with enterpriseId == Laing OR id:', projs.docs.length);
  for (const doc of projs.docs) {
    const d = doc.data();
    console.log(' -', doc.id, '|', d.projectName, '| users:', Object.keys(d.users ?? {}));
  }

  // Also check any projects with "bernie" or Bernard-created
  const allProjs = await db.collection('projects').get();
  const bernardProjs = allProjs.docs.filter(d => {
    const users = d.data().users ?? {};
    return BERNARD_UID in users || d.data().createdBy === BERNARD_UID;
  });
  console.log('\nAll projects created by or involving Bernard:', bernardProjs.length);
  for (const doc of bernardProjs) {
    const d = doc.data();
    console.log(' -', doc.id, '|', d.projectName, '| enterpriseId:', d.enterpriseId);
  }
}

main().catch(console.error);
