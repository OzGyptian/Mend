/**
 * Force emailVerified=true for a Firebase Auth user via Admin SDK.
 *
 * Usage:
 *   npx tsx scripts/fix-email-verified.ts --email=bernard.w.leung@gmail.com
 */

import { initializeApp, cert, type ServiceAccount } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const firebaseConfig = JSON.parse(
  readFileSync(join(__dirname, '../firebase-applet-config.json'), 'utf8')
) as { projectId: string };

const args = Object.fromEntries(
  process.argv.slice(2).map(arg => {
    const [key, value] = arg.replace(/^--/, '').split('=');
    return [key, value];
  })
);

if (!args.email) {
  console.error('Usage: npx tsx scripts/fix-email-verified.ts --email=<email>');
  process.exit(1);
}

const serviceAccount = JSON.parse(
  readFileSync(join(__dirname, 'service-account.json'), 'utf8')
) as ServiceAccount;

const app = initializeApp({
  credential: cert(serviceAccount),
  projectId: firebaseConfig.projectId,
});

const auth = getAuth(app);

async function main() {
  const user = await auth.getUserByEmail(args.email);
  console.log(`Found user: ${user.uid} (emailVerified: ${user.emailVerified})`);

  if (user.emailVerified) {
    console.log('Already verified — nothing to do.');
    process.exit(0);
  }

  await auth.updateUser(user.uid, { emailVerified: true });
  console.log('Done — emailVerified set to true.');
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
