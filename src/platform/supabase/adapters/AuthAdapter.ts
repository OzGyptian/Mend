import { supabase } from '../client';
import type { User } from '@supabase/supabase-js';
import type { AuthUser, AuthRepository } from '../../ports/auth.port';

function toAuthUser(user: User): AuthUser {
  return {
    id: user.id,
    email: user.email ?? null,
    displayName: (user.user_metadata?.display_name as string) ?? null,
    avatarUrl: (user.user_metadata?.avatar_url as string) ?? null,
    emailVerified: user.email_confirmed_at != null,
  };
}

// Port.getCurrentUser() is synchronous (matches Firebase Auth's cached
// currentUser accessor) -- Supabase's client is async-only
// (getSession()/getUser() both return a Promise), so this adapter keeps its
// own in-memory cache, kept current via onAuthStateChange, which fires
// immediately with the existing session on subscription and again on every
// change thereafter.
export class PostgresAuthAdapter implements AuthRepository {
  private cachedUser: AuthUser | null = null;

  constructor() {
    supabase.auth.onAuthStateChange((_event, session) => {
      this.cachedUser = session?.user ? toAuthUser(session.user) : null;
    });
  }

  getCurrentUser(): AuthUser | null {
    return this.cachedUser;
  }

  async signInWithOAuth(): Promise<AuthUser> {
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
    if (error) throw error;
    // signInWithOAuth redirects the browser; there's no user to return
    // synchronously here (unlike Firebase's popup-based flow) -- callers
    // should rely on subscribeToAuth for the post-redirect result.
    throw new Error('OAuth sign-in redirects; listen via subscribeToAuth for the result.');
  }

  async signInWithCredentials(email: string, password: string): Promise<AuthUser> {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return toAuthUser(data.user);
  }

  async registerWithCredentials(email: string, password: string): Promise<AuthUser> {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    if (!data.user) throw new Error('Registration did not return a user.');
    return toAuthUser(data.user);
  }

  async sendVerificationEmail(): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) throw new Error('No authenticated user');
    const { error } = await supabase.auth.resend({ type: 'signup', email: user.email });
    if (error) throw error;
  }

  async signOut(): Promise<void> {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }

  subscribeToAuth(callback: (user: AuthUser | null) => void): () => void {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      callback(session?.user ? toAuthUser(session.user) : null);
    });
    return () => subscription.unsubscribe();
  }

  async updateDisplayName(name: string): Promise<void> {
    const { error } = await supabase.auth.updateUser({ data: { display_name: name } });
    if (error) throw error;
  }

  async sendPasswordReset(email: string): Promise<void> {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw error;
  }

  async updatePassword(_currentPassword: string, newPassword: string): Promise<void> {
    // Supabase's updateUser doesn't require re-authenticating with the
    // current password first (unlike Firebase's reauthenticateWithCredential
    // requirement) -- the existing session is already the proof of identity.
    // currentPassword is accepted for port-interface parity but unused here.
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
  }

  getLinkedProviders(): string[] {
    // Supabase doesn't expose linked-identity providers on the cached user
    // the same synchronous way Firebase's providerData does -- would need
    // supabase.auth.getUserIdentities() (async). Returning empty rather than
    // faking a synchronous result; callers needing this should be updated to
    // call the real async API once this adapter is wired in for real.
    return [];
  }

  async linkEmailPassword(newPassword: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) throw new Error('No authenticated user');
    const { error } = await supabase.auth.updateUser({ email: user.email, password: newPassword });
    if (error) throw error;
  }
}
