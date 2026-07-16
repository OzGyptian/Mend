import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../src/platform/supabase/database.types';

// Service-role client for fixture setup/teardown only -- bypasses RLS. Never
// used to exercise adapter behavior itself (that goes through the app's own
// anon-key singleton in src/platform/supabase/client.ts, signed in as a real
// test user, so RLS is genuinely exercised the same way the app hits it).
const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) {
  throw new Error('tests/postgres requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (see npm run test:postgres)');
}
export const adminClient: SupabaseClient<Database> = createClient<Database>(url, serviceRoleKey);

export interface TestUser {
  id: string;
  email: string;
  password: string;
}

let userCounter = 0;

export async function createTestUser(label: string): Promise<TestUser> {
  userCounter += 1;
  const email = `test-${label}-${Date.now()}-${userCounter}@mend-test.invalid`;
  const password = `Test-${Math.random().toString(36).slice(2)}-Aa1!`;
  const { data, error } = await adminClient.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error(`createTestUser(${label}) failed: ${error?.message}`);
  return { id: data.user.id, email, password };
}

export async function deleteTestUser(userId: string): Promise<void> {
  await adminClient.auth.admin.deleteUser(userId);
}

export async function createFixtureEnterprise(name: string): Promise<string> {
  const { data, error } = await adminClient.from('enterprises').insert({ name }).select('id').single();
  if (error || !data) throw new Error(`createFixtureEnterprise(${name}) failed: ${error?.message}`);
  return data.id;
}

export async function createFixtureProject(
  enterpriseId: string,
  projectCode: string,
  projectName: string,
): Promise<string> {
  const { data, error } = await adminClient
    .from('projects')
    .insert({ enterprise_id: enterpriseId, project_code: projectCode, project_name: projectName })
    .select('id')
    .single();
  if (error || !data) throw new Error(`createFixtureProject(${projectName}) failed: ${error?.message}`);
  return data.id;
}

export async function createFixtureCostCode(
  projectId: string,
  code: string,
  name: string,
): Promise<string> {
  const { data, error } = await adminClient
    .from('cost_codes')
    .insert({ project_id: projectId, code, name })
    .select('id')
    .single();
  if (error || !data) throw new Error(`createFixtureCostCode(${code}) failed: ${error?.message}`);
  return data.id;
}

export async function makePlatformAdmin(userId: string, email: string): Promise<void> {
  const { error } = await adminClient
    .from('user_profiles')
    .insert({ user_id: userId, email, platform_role: 'admin' });
  if (error) throw new Error(`makePlatformAdmin failed: ${error.message}`);
}

export async function addEnterpriseMember(
  enterpriseId: string,
  userId: string,
  role: 'admin' | 'member' = 'admin',
): Promise<void> {
  const { error } = await adminClient
    .from('enterprise_members')
    .insert({ enterprise_id: enterpriseId, user_id: userId, role });
  if (error) throw new Error(`addEnterpriseMember failed: ${error.message}`);
}

export async function addProjectMember(
  projectId: string,
  userId: string,
  role: 'Project Admin' | 'Project User' = 'Project Admin',
): Promise<void> {
  const { error } = await adminClient
    .from('project_members')
    .insert({ project_id: projectId, user_id: userId, role });
  if (error) throw new Error(`addProjectMember failed: ${error.message}`);
}

// Deletes the enterprise; project_members/enterprise_members/projects and
// their children cascade via FK ON DELETE CASCADE (see supabase/migrations).
export async function cleanupEnterprise(enterpriseId: string): Promise<void> {
  const { error } = await adminClient.from('enterprises').delete().eq('id', enterpriseId);
  if (error) throw new Error(`cleanupEnterprise(${enterpriseId}) failed: ${error.message}`);
}

export async function signInAs(client: SupabaseClient<Database>, user: TestUser): Promise<void> {
  const { error } = await client.auth.signInWithPassword({ email: user.email, password: user.password });
  if (error) throw new Error(`signInAs(${user.email}) failed: ${error.message}`);
}

export async function signOut(client: SupabaseClient<Database>): Promise<void> {
  await client.auth.signOut();
}
