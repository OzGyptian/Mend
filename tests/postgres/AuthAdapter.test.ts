import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { supabase } from '../../src/platform/supabase/client';
import { PostgresAuthAdapter } from '../../src/platform/supabase/adapters/AuthAdapter';
import { createTestUser, deleteTestUser, type TestUser } from './helpers';

describe('PostgresAuthAdapter', () => {
  const adapter = new PostgresAuthAdapter();
  const userIds: string[] = [];
  let user: TestUser;

  afterEach(async () => {
    await supabase.auth.signOut();
  });

  afterAll(async () => {
    for (const id of userIds) await deleteTestUser(id);
  });

  it('signs in with credentials and returns the auth user', async () => {
    user = await createTestUser('auth-user');
    userIds.push(user.id);

    const signedIn = await adapter.signInWithCredentials(user.email, user.password);
    expect(signedIn.id).toBe(user.id);
    expect(signedIn.email).toBe(user.email);
  });

  it('getCurrentUser reflects the cached session after sign-in, and clears after sign-out', async () => {
    await adapter.signInWithCredentials(user.email, user.password);
    // The adapter's cache updates via onAuthStateChange, which fires
    // asynchronously -- give it a tick to settle.
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(adapter.getCurrentUser()?.id).toBe(user.id);

    await adapter.signOut();
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(adapter.getCurrentUser()).toBeNull();
  });

  it('updates the display name on the authenticated user', async () => {
    await adapter.signInWithCredentials(user.email, user.password);
    await adapter.updateDisplayName('Test Display Name');

    const { data } = await supabase.auth.getUser();
    expect(data.user?.user_metadata?.display_name).toBe('Test Display Name');
  });

  it('rejects sign-in with the wrong password', async () => {
    await expect(adapter.signInWithCredentials(user.email, 'definitely-wrong-password')).rejects.toThrow();
  });
});
