import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { GoogleAuth } from 'google-auth-library';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const serviceAccountPath = join(__dirname, 'service-account.json');
const config = JSON.parse(readFileSync(join(__dirname, '../firebase-applet-config.json'), 'utf8'));
const rulesContent = readFileSync(join(__dirname, '../firestore.rules'), 'utf8');

const PROJECT_ID = config.projectId;
const DATABASE_ID = config.firestoreDatabaseId;
const RELEASE_NAME = `cloud.firestore/${DATABASE_ID}`;

async function main() {
  const auth = new GoogleAuth({
    keyFile: serviceAccountPath,
    scopes: ['https://www.googleapis.com/auth/firebase'],
  });
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  const headers = { Authorization: `Bearer ${token.token}`, 'Content-Type': 'application/json' };
  const base = `https://firebaserules.googleapis.com/v1/projects/${PROJECT_ID}`;

  // Create ruleset
  console.log('Creating ruleset...');
  const rulesetRes = await fetch(`${base}/rulesets`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ source: { files: [{ name: 'firestore.rules', content: rulesContent }] } }),
  });
  const ruleset = await rulesetRes.json() as { name?: string; error?: unknown };
  if (!ruleset.name) { console.error('Ruleset creation failed:', ruleset); process.exit(1); }
  console.log('Ruleset:', ruleset.name);

  // Update release
  console.log('Updating release...');
  const releaseRes = await fetch(`${base}/releases/${encodeURIComponent(RELEASE_NAME)}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ release: { name: `projects/${PROJECT_ID}/releases/${RELEASE_NAME}`, rulesetName: ruleset.name } }),
  });
  const release = await releaseRes.json() as { name?: string; error?: unknown };
  if (!release.name) { console.error('Release update failed:', release); process.exit(1); }
  console.log('Release updated:', release.name);
  console.log('Rules deployed successfully.');
}

main().catch(console.error);
