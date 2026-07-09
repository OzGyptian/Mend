import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const serviceAccount = JSON.parse(readFileSync(join(__dirname, 'service-account.json'), 'utf8'));
const config = JSON.parse(readFileSync(join(__dirname, '../firebase-applet-config.json'), 'utf8'));

initializeApp({ credential: cert(serviceAccount), projectId: config.projectId });
const db = getFirestore(config.firestoreDatabaseId);

const BERNARD_UID = '9vuBKmwGroSXqr6N9uhW8dkB98C2';

async function main() {
  const snap = await db.collection('enterprises').get();
  console.log(`Found ${snap.docs.length} enterprises`);

  for (const doc of snap.docs) {
    const data = doc.data();
    const adminUsers: string[] = data.adminUsers ?? [];
    if (adminUsers.includes(BERNARD_UID)) {
      console.log(`  ✓ ${data.name} — already has Bernard`);
    } else {
      await doc.ref.update({ adminUsers: FieldValue.arrayUnion(BERNARD_UID) });
      console.log(`  + ${data.name} — added Bernard`);
    }
  }
  console.log('Done.');
}

main().catch(console.error);
