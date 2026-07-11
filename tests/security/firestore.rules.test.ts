import { readFileSync } from 'fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';

// Phase 13.A gate tests (SYSTEM_REVIEW.md v2, F3 / F2 residue).
//
// These pin the two security fixes made in this phase directly against the
// deployed rules text, independent of any client code:
//   F3 — a non-invited authenticated user must NOT be able to add themselves
//        to an enterprise's adminUsers (the old isJoiningViaInvitation() hole).
//   F2 — a user must NOT be able to self-grant platformRole: 'platform_admin'
//        on their own userRoles doc.
//
// Requires the Firestore emulator (Java). Run with:
//   firebase emulators:exec --only firestore "vitest run tests/security"

let testEnv: RulesTestEnvironment;

const ENTERPRISE_ID = 'ent-1';
const ATTACKER_UID = 'attacker-uid';
const OWNER_UID = 'owner-uid';

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'mend-rules-test',
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

afterAll(async () => {
  await testEnv?.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

describe('F3 — enterprise membership cannot be self-granted', () => {
  it('rejects an uninvited authenticated user adding themselves to adminUsers', async () => {
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      await adminCtx.firestore().collection('enterprises').doc(ENTERPRISE_ID).set({
        name: 'Acme',
        adminUsers: [OWNER_UID],
        users: { [OWNER_UID]: { name: 'Owner', role: 'Enterprise Admin' } },
      });
    });

    const attacker = testEnv.authenticatedContext(ATTACKER_UID, { email: 'attacker@example.com' });
    const enterpriseRef = attacker.firestore().collection('enterprises').doc(ENTERPRISE_ID);

    await assertFails(
      enterpriseRef.update({
        adminUsers: [OWNER_UID, ATTACKER_UID],
        [`users.${ATTACKER_UID}`]: { name: 'Attacker', role: 'Enterprise User' },
      }),
    );
  });

  it('still allows an existing admin to update the enterprise', async () => {
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      await adminCtx.firestore().collection('enterprises').doc(ENTERPRISE_ID).set({
        name: 'Acme',
        adminUsers: [OWNER_UID],
        users: { [OWNER_UID]: { name: 'Owner', role: 'Enterprise Admin' } },
      });
    });

    const owner = testEnv.authenticatedContext(OWNER_UID, { email: 'owner@example.com' });
    const enterpriseRef = owner.firestore().collection('enterprises').doc(ENTERPRISE_ID);

    await assertSucceeds(enterpriseRef.update({ name: 'Acme Renamed' }));
  });

  it('rejects a client writing an invitation status directly (server-only path now)', async () => {
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      await adminCtx.firestore().collection('invitations').doc('invite-1').set({
        email: 'attacker@example.com',
        enterpriseId: ENTERPRISE_ID,
        token: 'tok-1',
        status: 'pending',
        expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      });
    });

    const attacker = testEnv.authenticatedContext(ATTACKER_UID, { email: 'attacker@example.com' });
    const inviteRef = attacker.firestore().collection('invitations').doc('invite-1');

    await assertFails(inviteRef.update({ status: 'accepted' }));
  });
});

describe('F2 residue — platformRole cannot be self-granted', () => {
  it('rejects self-creating a userRoles doc with platformRole set', async () => {
    const attacker = testEnv.authenticatedContext(ATTACKER_UID, { email: 'attacker@example.com' });
    const roleRef = attacker.firestore().collection('userRoles').doc(ATTACKER_UID);

    await assertFails(roleRef.set({ platformRole: 'platform_admin', memberships: [] }));
  });

  it('allows self-creating a userRoles doc with platformRole omitted/null', async () => {
    const attacker = testEnv.authenticatedContext(ATTACKER_UID, { email: 'attacker@example.com' });
    const roleRef = attacker.firestore().collection('userRoles').doc(ATTACKER_UID);

    await assertSucceeds(roleRef.set({ platformRole: null, memberships: [] }));
  });

  it('rejects self-updating platformRole from null to platform_admin', async () => {
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      await adminCtx.firestore().collection('userRoles').doc(ATTACKER_UID).set({
        platformRole: null,
        memberships: [],
      });
    });

    const attacker = testEnv.authenticatedContext(ATTACKER_UID, { email: 'attacker@example.com' });
    const roleRef = attacker.firestore().collection('userRoles').doc(ATTACKER_UID);

    await assertFails(roleRef.update({ platformRole: 'platform_admin' }));
  });

  it('still allows self-updating unrelated fields (e.g. memberships) without touching platformRole', async () => {
    await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
      await adminCtx.firestore().collection('userRoles').doc(ATTACKER_UID).set({
        platformRole: null,
        memberships: [],
      });
    });

    const owner = testEnv.authenticatedContext(ATTACKER_UID, { email: 'attacker@example.com' });
    const roleRef = owner.firestore().collection('userRoles').doc(ATTACKER_UID);

    await assertSucceeds(
      roleRef.update({ platformRole: null, memberships: [{ projectId: 'p1', role: 'viewer' }] }),
    );
  });
});
