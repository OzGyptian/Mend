// Migrates the two real Tarek Firebase Auth accounts to Supabase Auth via
// invite (Supabase emails the person a set-password link; this script never
// sets or sees a password itself). Grants platform_admin to both, matching
// the platform_admin grant already given to tarek.guindy@gmail.com earlier
// in this migration (bernard.w.leung@gmail.com asked for this directly).
//
// bernard.w.leung@gmail.com is intentionally excluded -- already has a
// native Supabase account. user@123.com and buddha.leung@gmail.com are
// intentionally excluded -- unverified Firebase accounts with no real data,
// confirmed with Bernard to skip.
//
// Run with --apply to actually invite; without it, dry-runs and prints
// what would happen.

import { createClient, type User } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.');
}
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const APPLY = process.argv.includes('--apply');

const ACCOUNTS_TO_MIGRATE = [
  { email: 'tarek.guindy@gmail.com', displayName: 'Tarek Guindy' },
  { email: 'tarek_guindy@hotmail.com', displayName: 'Tarek Guindy' },
];

async function main() {
  console.log(APPLY ? 'APPLY mode -- will invite real users and grant platform_admin.' : 'DRY RUN -- pass --apply to actually run this.');

  for (const account of ACCOUNTS_TO_MIGRATE) {
    console.log(`\n--- ${account.email} ---`);

    if (!APPLY) {
      console.log('Would invite via supabase.auth.admin.inviteUserByEmail(...)');
      console.log('Would upsert user_profiles(platform_role=admin), user_roles(platform_role=platform_admin)');
      continue;
    }

    const listResult = await supabase.auth.admin.listUsers();
    if (listResult.error) {
      console.error(`FAILED to list existing users while checking ${account.email}:`, listResult.error.message);
      continue;
    }
    const users: User[] = listResult.data.users;
    const already = users.find((u) => u.email?.toLowerCase() === account.email.toLowerCase());

    let userId: string;
    if (already) {
      console.log(`Already exists in Supabase Auth as ${already.id} -- skipping invite, will still ensure roles.`);
      userId = already.id;
    } else {
      const { data, error } = await supabase.auth.admin.inviteUserByEmail(account.email, {
        data: { display_name: account.displayName },
      });
      if (error) {
        console.error(`FAILED to invite ${account.email}:`, error.message);
        continue;
      }
      userId = data.user.id;
      console.log(`Invited. New Supabase user id: ${userId}`);
    }

    const { error: profileError } = await supabase
      .from('user_profiles')
      .upsert(
        { user_id: userId, email: account.email, display_name: account.displayName, platform_role: 'admin' },
        { onConflict: 'user_id' },
      );
    if (profileError) console.error(`user_profiles upsert failed for ${account.email}:`, profileError.message);
    else console.log('user_profiles.platform_role = admin');

    const { error: roleError } = await supabase
      .from('user_roles')
      .upsert({ user_id: userId, platform_role: 'platform_admin' }, { onConflict: 'user_id' });
    if (roleError) console.error(`user_roles upsert failed for ${account.email}:`, roleError.message);
    else console.log('user_roles.platform_role = platform_admin');
  }

  console.log('\nDone.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
