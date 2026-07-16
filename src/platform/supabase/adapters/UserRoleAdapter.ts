import { supabase } from '../client';
import type { Json } from '../database.types';
import type { UserRoleRepository } from '../../ports/userRole.port';
import type { UserRoles, EnterpriseRole, ProjectRole, EnterpriseMembership } from '../../../domain/roles';

const EMPTY_ROLES: UserRoles = { platformRole: null, memberships: [] };

function toUserRoles(row: { platform_role: string | null; memberships: unknown } | null): UserRoles {
  if (!row) return EMPTY_ROLES;
  return {
    platformRole: (row.platform_role as UserRoles['platformRole']) ?? null,
    memberships: (row.memberships as EnterpriseMembership[]) ?? [],
  };
}

export class PostgresUserRoleAdapter implements UserRoleRepository {
  async getUserRoles(uid: string): Promise<UserRoles> {
    const { data, error } = await supabase.from('user_roles').select('*').eq('user_id', uid).maybeSingle();
    if (error) throw error;
    return toUserRoles(data);
  }

  subscribeUserRoles(uid: string, callback: (roles: UserRoles) => void): () => void {
    const fetchAndEmit = async () => {
      const { data, error } = await supabase.from('user_roles').select('*').eq('user_id', uid).maybeSingle();
      if (error) {
        console.error('UserRoleAdapter.subscribeUserRoles: failed to fetch roles', error);
        return;
      }
      callback(toUserRoles(data));
    };
    fetchAndEmit();
    // useAuth() (which calls this) is used by 8+ components -- App.tsx,
    // Sidebar, and several sub-panes -- all mounted concurrently on any
    // authenticated page, each independently subscribing for the *same*
    // uid. A channel name scoped only by uid still collides the moment two
    // of those mount at once, which is every page load, not an edge case.
    // Same root cause and fix as EnterpriseAdapter.subscribeAll().
    const channel = supabase
      .channel(`user_roles:${uid}:${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_roles', filter: `user_id=eq.${uid}` }, fetchAndEmit)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }

  async setEnterpriseRole(uid: string, enterpriseId: string, role: EnterpriseRole): Promise<void> {
    const current = await this.getUserRoles(uid);
    const existing = current.memberships.find((m) => m.enterpriseId === enterpriseId);
    const updated: EnterpriseMembership[] = existing
      ? current.memberships.map((m) => (m.enterpriseId === enterpriseId ? { ...m, role } : m))
      : [...current.memberships, { enterpriseId, role, projectRoles: {} }];
    const { error } = await supabase
      .from('user_roles')
      .upsert({ user_id: uid, platform_role: current.platformRole, memberships: updated as unknown as Json });
    if (error) throw error;
  }

  async setProjectRole(uid: string, enterpriseId: string, projectId: string, role: ProjectRole): Promise<void> {
    const current = await this.getUserRoles(uid);
    const membership = current.memberships.find((m) => m.enterpriseId === enterpriseId);
    const updated: EnterpriseMembership[] = membership
      ? current.memberships.map((m) =>
          m.enterpriseId === enterpriseId ? { ...m, projectRoles: { ...m.projectRoles, [projectId]: role } } : m
        )
      : [...current.memberships, { enterpriseId, role: 'enterprise_member', projectRoles: { [projectId]: role } }];
    const { error } = await supabase
      .from('user_roles')
      .upsert({ user_id: uid, platform_role: current.platformRole, memberships: updated as unknown as Json });
    if (error) throw error;
  }

  async removeProjectRole(uid: string, enterpriseId: string, projectId: string): Promise<void> {
    const current = await this.getUserRoles(uid);
    const updated: EnterpriseMembership[] = current.memberships.map((m) => {
      if (m.enterpriseId !== enterpriseId) return m;
      const { [projectId]: _removed, ...rest } = m.projectRoles;
      return { ...m, projectRoles: rest };
    });
    const { error } = await supabase.from('user_roles').update({ memberships: updated as unknown as Json }).eq('user_id', uid);
    if (error) throw error;
  }
}
