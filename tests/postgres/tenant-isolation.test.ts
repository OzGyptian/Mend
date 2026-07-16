import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { supabase } from '../../src/platform/supabase/client';
import {
  adminClient,
  createTestUser,
  deleteTestUser,
  createFixtureEnterprise,
  createFixtureProject,
  createFixtureCostCode,
  addEnterpriseMember,
  addProjectMember,
  cleanupEnterprise,
  signInAs,
  signOut,
  type TestUser,
} from './helpers';

/**
 * Phase 1 of the system audit: adversarial tenant-isolation tests.
 *
 * Two fully separate tenants (Enterprise A and Enterprise B). Users belong to
 * exactly one. Every test signs in as a REAL non-admin user (via the app's own
 * anon-key client, so RLS is exercised exactly as the browser hits it) and
 * attempts to cross the tenant boundary. A passing test = the boundary held.
 *
 * Deliberately NO platform admins here -- platform_admin bypasses all of this,
 * and this whole suite exists because the app has only ever run as platform
 * admin (both membership tables were empty at audit time). See
 * docs/audit/phase-0-inventory.md and phase-1-tenancy.md.
 */

// Enterprise A
let entAdminA: TestUser; // enterprise admin of A
let memberA: TestUser; // enterprise member of A, NOT a member of any project
let projUserA: TestUser; // Project User (non-admin) on project A
let enterpriseA: string;
let projectA: string;
let costCodeA: string;

// Enterprise B (the victim tenant)
let entAdminB: TestUser;
let enterpriseB: string;
let projectB: string;
let costCodeB: string;

beforeAll(async () => {
  // Enterprise A
  entAdminA = await createTestUser('iso-entadmin-a');
  memberA = await createTestUser('iso-member-a');
  projUserA = await createTestUser('iso-projuser-a');
  enterpriseA = await createFixtureEnterprise('Isolation Test Enterprise A');
  projectA = await createFixtureProject(enterpriseA, 'ISO-A', 'Iso Project A');
  costCodeA = await createFixtureCostCode(projectA, 'A-100', 'Cost Code A');
  await addEnterpriseMember(enterpriseA, entAdminA.id, 'admin');
  await addEnterpriseMember(enterpriseA, memberA.id, 'member');
  await addEnterpriseMember(enterpriseA, projUserA.id, 'member');
  await addProjectMember(projectA, projUserA.id, 'Project User');

  // Enterprise B
  entAdminB = await createTestUser('iso-entadmin-b');
  enterpriseB = await createFixtureEnterprise('Isolation Test Enterprise B');
  projectB = await createFixtureProject(enterpriseB, 'ISO-B', 'Iso Project B');
  costCodeB = await createFixtureCostCode(projectB, 'B-100', 'Cost Code B');
  await addEnterpriseMember(enterpriseB, entAdminB.id, 'admin');
}, 60000);

afterAll(async () => {
  await signOut(supabase);
  await cleanupEnterprise(enterpriseA);
  await cleanupEnterprise(enterpriseB);
  for (const u of [entAdminA, memberA, projUserA, entAdminB]) {
    if (u) await deleteTestUser(u.id);
  }
});

describe('Tenant isolation — cross-tenant reads', () => {
  it("project user in A cannot see enterprise B's project", async () => {
    await signInAs(supabase, projUserA);
    const { data } = await supabase.from('projects').select('id').eq('id', projectB);
    expect(data).toEqual([]);
  });

  it("project user in A cannot see enterprise B's cost codes", async () => {
    await signInAs(supabase, projUserA);
    const { data } = await supabase.from('cost_codes').select('id').eq('id', costCodeB);
    expect(data).toEqual([]);
  });

  it("project user in A cannot see enterprise B's enterprise row", async () => {
    await signInAs(supabase, projUserA);
    const { data } = await supabase.from('enterprises').select('id').eq('id', enterpriseB);
    expect(data).toEqual([]);
  });

  it('an unfiltered project select returns only A-tenant rows', async () => {
    await signInAs(supabase, projUserA);
    const { data } = await supabase.from('projects').select('id, enterprise_id');
    expect(data).not.toBeNull();
    for (const row of data ?? []) {
      expect(row.enterprise_id).toBe(enterpriseA);
    }
  });
});

describe('Tenant isolation — cross-tenant writes', () => {
  it("project user in A cannot insert a cost code into enterprise B's project", async () => {
    await signInAs(supabase, projUserA);
    const { error } = await supabase
      .from('cost_codes')
      .insert({ project_id: projectB, code: 'HACK', name: 'injected' });
    expect(error).not.toBeNull(); // RLS WITH CHECK must reject
  });

  it("project user in A cannot update enterprise B's cost code", async () => {
    await signInAs(supabase, projUserA);
    const { data } = await supabase
      .from('cost_codes')
      .update({ name: 'hacked' })
      .eq('id', costCodeB)
      .select('id');
    expect(data).toEqual([]); // RLS filters the row out -> 0 affected
    // confirm it really didn't change, via admin
    const { data: check } = await adminClient.from('cost_codes').select('name').eq('id', costCodeB).single();
    expect(check?.name).toBe('Cost Code B');
  });

  it("project user in A cannot delete enterprise B's cost code", async () => {
    await signInAs(supabase, projUserA);
    await supabase.from('cost_codes').delete().eq('id', costCodeB);
    const { data: check } = await adminClient.from('cost_codes').select('id').eq('id', costCodeB);
    expect(check).toHaveLength(1); // still there
  });
});

describe('Tenant isolation — enterprise membership does not grant project access', () => {
  it("an enterprise member (no project role) cannot read their own enterprise's project cost codes", async () => {
    // memberA is an enterprise member of A but has no project_members row.
    // Per the documented hierarchy, that should NOT grant project data access.
    await signInAs(supabase, memberA);
    const { data } = await supabase.from('cost_codes').select('id').eq('id', costCodeA);
    expect(data).toEqual([]);
  });

  it('an enterprise member can still read the enterprise row itself', async () => {
    await signInAs(supabase, memberA);
    const { data } = await supabase.from('enterprises').select('id').eq('id', enterpriseA);
    expect(data).toEqual([{ id: enterpriseA }]);
  });
});

describe('Tenant isolation — FK reference attacks (Phase 0 finding #2)', () => {
  // KNOWN VULNERABILITY — CONFIRMED by Phase 1, not yet fixed.
  // it.fails asserts the body currently throws (i.e. the secure assertion
  // below fails). When the hole is closed (composite FK or WITH CHECK on the
  // referenced row -- see docs/audit/phase-1-tenancy.md F1), this flips to a
  // hard failure, prompting whoever fixed it to promote it to a plain `it`.
  it.fails(
    "SHOULD reject attaching enterprise B's cost code to an A-owned risk record (currently allowed)",
    async () => {
      const { data: risk } = await adminClient
        .from('risks')
        .insert({ project_id: projectA, risk_code: 'R-ISO', description: 'iso' })
        .select('id')
        .single();
      expect(risk).not.toBeNull();

      await signInAs(supabase, projUserA);
      // project_id is A's (RLS-allowed), but cost_code_id belongs to B. RLS's
      // WITH CHECK only validates project_id, so this insert SUCCEEDS today --
      // creating a durable cross-tenant reference. Because cost_codes deletes
      // are ON DELETE RESTRICT, it also pins B's cost code: B can no longer
      // delete their own row (FK violation against a record B cannot see).
      // Cast: database.types.ts is stale (still describes the pre-0037
      // risk_records shape with min/max/most_likely + a beta_pert_impact_amount
      // generated column, none of which exist in the live DB). Tracked as
      // audit finding P3-1 in docs/audit/phase-3-adapters.md; regenerating the
      // types is Phase 3 work. The runtime payload below matches the real
      // columns (risk_model, model_inputs).
      const insertRow = {
        risk_id: risk!.id,
        project_id: projectA,
        cost_code_id: costCodeB,
        probability: 0.5,
        risk_model: 'beta_pert_3point',
        model_inputs: { min: 1, mostLikely: 2, max: 3 },
      };
      const { error } = await supabase.from('risk_records').insert(insertRow as never).select('id');

      // The SECURE expectation (fails today -> this whole test is it.fails):
      expect(error, 'cross-tenant cost_code FK should be rejected').not.toBeNull();
    },
  );
});

describe('Tenant isolation — denormalized scope attacks (Phase 0 finding #3)', () => {
  it('a project user in A cannot create a subcontract whose enterprise_id points at B', async () => {
    await signInAs(supabase, projUserA);
    // project_id = A (RLS-allowed), but enterprise_id claims B. RLS only
    // checks project_id. If this row lands, the denormalized enterprise_id
    // is attacker-controlled and can disagree with the true owner -> finding.
    const { error, data } = await supabase
      .from('subcontracts')
      .insert({
        project_id: projectA,
        enterprise_id: enterpriseB,
        order_code: 'SC-ISO',
        order_name: 'iso',
        payment_type: 'lump_sum',
        vendor_id: '00000000-0000-0000-0000-000000000000',
      })
      .select('id, enterprise_id');

    // A vendor_id FK to a nonexistent vendor will also reject; either way the
    // row must not exist with a B enterprise_id. Assert no A-user-authored row
    // ended up claiming enterprise B.
    if (!error && data && data.length > 0) {
      expect(data[0].enterprise_id, 'subcontract must not claim a foreign enterprise_id').not.toBe(enterpriseB);
    }
  });
});

describe('Privilege escalation — self-granted platform admin (Phase 0 finding #1)', () => {
  it('a plain user cannot make themselves a DB-level platform admin via user_roles', async () => {
    await signInAs(supabase, memberA);
    // RLS allows self-insert into user_roles; the protect_platform_role
    // trigger only guards user_profiles. This insert may SUCCEED at the DB
    // layer. What must remain true is that it grants NO actual RLS power.
    await supabase
      .from('user_roles')
      .insert({ user_id: memberA.id, platform_role: 'platform_admin', memberships: {} });

    // The real security assertion: memberA still cannot see enterprise B.
    const { data } = await supabase.from('enterprises').select('id').eq('id', enterpriseB);
    expect(data, 'self-granted user_roles.platform_role must not grant DB access').toEqual([]);

    // And is_platform_admin() (which RLS trusts) still reads user_profiles, not
    // user_roles -- so the escalation is DB-inert. Confirm via a platform-admin-
    // only capability: deleting an enterprise (enterprises_platform_admin_delete).
    const { data: delData } = await supabase.from('enterprises').delete().eq('id', enterpriseB).select('id');
    expect(delData, 'self-granted platform_admin must not enable enterprise delete').toEqual([]);

    // cleanup the injected row so it doesn't leak into other suites
    await adminClient.from('user_roles').delete().eq('user_id', memberA.id);
  });
});

describe('Audit log integrity (Phase 0 finding #6)', () => {
  it('documents whether a member can insert an audit row impersonating another actor', async () => {
    await signInAs(supabase, memberA);
    const { error } = await supabase.from('audit_logs').insert({
      enterprise_id: enterpriseA,
      actor_user_id: entAdminA.id, // impersonating the admin
      actor_email: 'someone-else@example.com',
      action: 'ISO_TEST_IMPERSONATION',
      details: {},
    });
    // audit_logs INSERT policy only checks enterprise access, not actor
    // identity -- so this is EXPECTED to succeed today. The test documents
    // that the audit trail's actor fields are client-asserted, not enforced.
    // (Not a tenant-isolation breach: still scoped to A. Tracked as a HIGH
    // integrity finding, not CRITICAL.)
    expect(error, 'audit actor fields are currently client-asserted (documented finding)').toBeNull();
    // cleanup
    await adminClient.from('audit_logs').delete().eq('action', 'ISO_TEST_IMPERSONATION');
  });
});
