import { supabase } from '../client';
import { toRow, fromRow } from '../caseConvert';
import type { Database } from '../database.types';
import type { Enterprise } from '../../../domain/types';
import type { EnterpriseRepository } from '../../ports/enterprise.port';
import type { Unsubscribe } from '../../ports/index';

type EnterpriseInsert = Database['public']['Tables']['enterprises']['Insert'];
type EnterpriseUpdate = Database['public']['Tables']['enterprises']['Update'];

// Enterprise.adminUsers / Enterprise.users (a denormalized map with cached
// email/displayName/photoURL, since Firestore can't easily join) are now
// real rows in enterprise_members. Reconstructed here from role only --
// the cached profile fields aren't stored per-membership in the normalized
// schema (they live in auth.users / user_profiles, not reachable via a
// plain client join against the public schema). Callers that need those
// fields should read them from user_profiles directly rather than expect
// this adapter to fabricate them.
async function attachMembers(enterprise: Enterprise): Promise<Enterprise> {
  const { data: members } = await supabase
    .from('enterprise_members')
    .select('user_id, role')
    .eq('enterprise_id', enterprise.id);
  const adminUsers = (members ?? []).filter((m) => m.role === 'admin').map((m) => m.user_id);
  const users: Enterprise['users'] = {};
  for (const m of members ?? []) {
    users[m.user_id] = { email: '', role: m.role === 'admin' ? 'Enterprise System Admin' : 'Enterprise User' };
  }
  return { ...enterprise, adminUsers, users };
}

export class PostgresEnterpriseAdapter implements EnterpriseRepository {
  async get(enterpriseId: string): Promise<Enterprise | null> {
    const { data, error } = await supabase.from('enterprises').select('*').eq('id', enterpriseId).maybeSingle();
    if (error) throw error;
    return data ? attachMembers(fromRow<Enterprise>(data)) : null;
  }

  subscribe(enterpriseId: string, callback: (enterprise: Enterprise | null) => void): Unsubscribe {
    const fetchAndEmit = async () => {
      callback(await this.get(enterpriseId));
    };
    fetchAndEmit();
    const channel = supabase
      .channel(`enterprise:${enterpriseId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'enterprises', filter: `id=eq.${enterpriseId}` }, fetchAndEmit)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'enterprise_members', filter: `enterprise_id=eq.${enterpriseId}` }, fetchAndEmit)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }

  subscribeById(enterpriseId: string, callback: (enterprise: Enterprise | null) => void): Unsubscribe {
    return this.subscribe(enterpriseId, callback);
  }

  subscribeByAdmin(adminUserEmail: string, callback: (enterprises: Enterprise[]) => void): Unsubscribe {
    // Firestore matched on email stored in adminUsers array; the normalized
    // equivalent is a user id in enterprise_members with role='admin'. This
    // adapter is keyed by email at the port boundary, so resolve to a user
    // id via user_profiles first.
    const fetchAndEmit = async () => {
      const { data: profile } = await supabase.from('user_profiles').select('user_id').eq('email', adminUserEmail).maybeSingle();
      if (!profile) { callback([]); return; }
      const { data: members } = await supabase.from('enterprise_members').select('enterprise_id').eq('user_id', profile.user_id).eq('role', 'admin');
      const ids = (members ?? []).map((m) => m.enterprise_id);
      if (ids.length === 0) { callback([]); return; }
      const { data } = await supabase.from('enterprises').select('*').in('id', ids);
      callback(await Promise.all((data ?? []).map((row) => attachMembers(fromRow<Enterprise>(row)))));
    };
    fetchAndEmit();
    const channel = supabase
      .channel(`enterprises_admin:${adminUserEmail}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'enterprise_members' }, fetchAndEmit)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }

  subscribeByUserId(userId: string, callback: (enterprises: Enterprise[]) => void): Unsubscribe {
    const fetchAndEmit = async () => {
      const { data: members } = await supabase.from('enterprise_members').select('enterprise_id').eq('user_id', userId);
      const ids = (members ?? []).map((m) => m.enterprise_id);
      if (ids.length === 0) { callback([]); return; }
      const { data } = await supabase.from('enterprises').select('*').in('id', ids);
      callback(await Promise.all((data ?? []).map((row) => attachMembers(fromRow<Enterprise>(row)))));
    };
    fetchAndEmit();
    const channel = supabase
      .channel(`enterprises_user:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'enterprise_members', filter: `user_id=eq.${userId}` }, fetchAndEmit)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }

  subscribeAll(callback: (enterprises: Enterprise[]) => void): () => void {
    const fetchAndEmit = async () => {
      const { data } = await supabase.from('enterprises').select('*');
      callback(await Promise.all((data ?? []).map((row) => attachMembers(fromRow<Enterprise>(row)))));
    };
    fetchAndEmit();
    const channel = supabase
      .channel('enterprises_all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'enterprises' }, fetchAndEmit)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }

  async bootstrapIfEmpty(userId: string, name: string, _role: string): Promise<void> {
    const { count } = await supabase.from('enterprises').select('*', { count: 'exact', head: true });
    if (count && count > 0) return;
    const { data: created, error } = await supabase.from('enterprises').insert({ name, theme: 'dark' }).select().single();
    if (error) throw error;
    const { error: memberError } = await supabase
      .from('enterprise_members').insert({ enterprise_id: created.id, user_id: userId, role: 'admin' });
    if (memberError) throw memberError;
  }

  // F3 fix: acceptance is verified server-side (POST /api/accept-invite)
  // against the caller's own ID token -- unchanged from the Firestore
  // adapter's trust boundary. The server endpoint itself needs its own
  // follow-up to verify against Supabase Auth instead of Firebase Admin --
  // out of scope for this adapter (part of the auth migration, which needs
  // Tarek's sign-off per POSTGRES_MIGRATION_PLAN.md).
  async acceptInvitation(token: string): Promise<{ enterpriseName: string } | null> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;

    const res = await fetch('/api/accept-invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: session.access_token, token }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(body.error || 'Failed to accept invitation.');
    }
    window.history.replaceState({}, document.title, window.location.pathname);
    return body.result ?? null;
  }

  async update(enterpriseId: string, data: Partial<Enterprise>): Promise<void> {
    const { adminUsers: _adminUsers, users: _users, ...rest } = data;
    const { error } = await supabase.from('enterprises').update(toRow<EnterpriseUpdate>(rest)).eq('id', enterpriseId);
    if (error) throw error;
  }

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('enterprises').delete().eq('id', id);
    if (error) throw error;
  }

  async deleteMany(ids: string[]): Promise<void> {
    const { error } = await supabase.from('enterprises').delete().in('id', ids);
    if (error) throw error;
  }

  async createMany(records: Array<Omit<Enterprise, 'id'>>): Promise<void> {
    const rows = records.map((r) => {
      const { adminUsers: _adminUsers, users: _users, ...rest } = r;
      return toRow<EnterpriseInsert>(rest);
    });
    const { error } = await supabase.from('enterprises').insert(rows);
    if (error) throw error;
  }

  async create(data: Omit<Enterprise, 'id'>): Promise<Enterprise> {
    const { adminUsers, users: _users, ...rest } = data;
    const row = toRow<EnterpriseInsert>(rest);
    const { data: inserted, error } = await supabase.from('enterprises').insert(row).select().single();
    if (error) throw error;
    if (adminUsers?.length) {
      const memberRows = adminUsers.map((uid) => ({ enterprise_id: inserted.id, user_id: uid, role: 'admin' as const }));
      const { error: memberError } = await supabase.from('enterprise_members').insert(memberRows);
      if (memberError) throw memberError;
    }
    return attachMembers(fromRow<Enterprise>(inserted));
  }
}
