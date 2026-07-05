/**
 * Seed a user as a Platform Admin in Firestore.
 *
 * Prerequisites:
 *   1. Download a service account key from Firebase console:
 *      Firebase console → Project Settings → Service Accounts → Generate new private key
 *      Save the JSON file as: scripts/service-account.json
 *      (This file is gitignored — never commit it.)
 *
 *   2. Install firebase-admin (one-time):
 *      npm install --save-dev firebase-admin
 *
 * Usage:
 *   npx tsx scripts/seed-platform-admin.ts --uid=<firebase-auth-uid>
 *   npx tsx scripts/seed-platform-admin.ts --uid=<uid> --enterprise-id=<uuid>
 *
 * Get your UID: Firebase console → Authentication → Users → copy the User UID column.
 *
 * The script is idempotent — safe to run multiple times for different UIDs.
 */

import { initializeApp, cert, type ServiceAccount } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';

// ── Config ────────────────────────────────────────────────────────────────────

const firebaseConfig = JSON.parse(
  readFileSync(join(__dirname, '../firebase-applet-config.json'), 'utf8')
) as { projectId: string; firestoreDatabaseId?: string };

const PROJECT_ID = firebaseConfig.projectId;
const DATABASE_ID = firebaseConfig.firestoreDatabaseId ?? '(default)';

// ── Args ──────────────────────────────────────────────────────────────────────

function parseArgs(): { uid: string; enterpriseId: string } {
  const args = Object.fromEntries(
    process.argv.slice(2).map(arg => {
      const [key, value] = arg.replace(/^--/, '').split('=');
      return [key, value];
    })
  );

  if (!args.uid) {
    console.error('Error: --uid is required.');
    console.error('Usage: npx tsx scripts/seed-platform-admin.ts --uid=<firebase-auth-uid>');
    process.exit(1);
  }

  return {
    uid: args.uid,
    enterpriseId: args['enterprise-id'] ?? randomUUID(),
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const { uid, enterpriseId } = parseArgs();

  // Load service account key
  const serviceAccountPath = join(__dirname, 'service-account.json');
  let serviceAccount: ServiceAccount;
  try {
    serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8')) as ServiceAccount;
  } catch {
    console.error('Error: Could not read scripts/service-account.json');
    console.error('Download it from: Firebase console → Project Settings → Service Accounts → Generate new private key');
    process.exit(1);
  }

  // Initialise Admin SDK
  const app = initializeApp({ credential: cert(serviceAccount), projectId: PROJECT_ID });
  const db = getFirestore(app, DATABASE_ID);

  // Check if document already exists
  const ref = db.collection('userRoles').doc(uid);
  const existing = await ref.get();

  if (existing.exists) {
    const data = existing.data();
    console.log(`\nExisting userRoles document found for UID: ${uid}`);
    console.log('Current platformRole:', data?.platformRole ?? 'none');

    if (data?.platformRole === 'platform_admin') {
      console.log('Already a platform admin — no changes made.\n');
      process.exit(0);
    }

    // Upgrade to platform admin, preserve existing memberships
    await ref.update({ platformRole: 'platform_admin' });
    console.log('Updated to platform_admin.\n');
  } else {
    // Create fresh document
    const userRolesDoc = {
      platformRole: 'platform_admin',
      memberships: [
        {
          enterpriseId,
          role: 'enterprise_admin',
          projectRoles: {},
        },
      ],
    };

    await ref.set(userRolesDoc);

    console.log(`\nCreated userRoles document for UID: ${uid}`);
    console.log(`  platformRole:  platform_admin`);
    console.log(`  enterpriseId:  ${enterpriseId}  ← save this UUID`);
    console.log(`  enterpriseRole: enterprise_admin\n`);
    console.log('Note: if you run this script again for another user (e.g. Tarek),');
    console.log(`pass the same --enterprise-id=${enterpriseId} so they share the same enterprise.\n`);
  }

  process.exit(0);
}

main().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
