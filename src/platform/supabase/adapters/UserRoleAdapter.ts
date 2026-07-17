import { supabase } from '../client';
import type { UserRoleRepository } from '../../ports/userRole.port';
import type { UserRoles, EnterpriseRole, ProjectRole } from '../../../domain/roles';


export class PostgresUserRoleAdapter implements UserRoleRepository {
  async getUserRoles(uid: string): Promise<UserRoles> {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('platform_role')
      .eq('user_id', uid)
      .maybeSingle();
    if (error) throw error;
    return {
      platformRole: data?.platform_role === 'admin' ? 'platform_admin' : null,
      memberships: [],
    };
  }

  subscribeUserRoles(uid: string, callback: (roles: UserRoles) => void): () => void {
    const fetchAndEmit = async () => {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('platform_role')
        .eq('user_id', uid)
        .maybeSingle();
      if (error) {
        console.error('UserRoleAdapter.subscribeUserRoles: failed to fetch roles', error);
        return;
      }
      callback({
        platformRole: data?.platform_role === 'admin' ? 'platform_admin' : null,
        memberships: [],
      });
    };
    fetchAndEmit();
    const channel = supabase
      .channel(`user_profiles_role:${uid}:${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_profiles', filter: `user_id=eq.${uid}` }, fetchAndEmit)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }

  // Membership management writes directly to the junction tables in Postgres.
  // The legacy user_roles.memberships jsonb blob is gone (migration 0041).

  async setEnterpriseRole(uid: string, enterpriseId: string, role: EnterpriseRole): Promise<void> {
    const dbRole = role === 'enterprise_admin' ? 'admin' : 'member';
    const { error } = await supabase
      .from('enterprise_members')
      .upsert({ user_id: uid, enterprise_id: enterpriseId, role: dbRole });
    if (error) throw error;
  }

  async setProjectRole(uid: string, enterpriseId: string, projectId: string, role: ProjectRole): Promise<void> {
    // Ensure enterprise membership exists first
    await this.setEnterpriseRole(uid, enterpriseId, 'enterprise_member');
    const { error } = await supabase
      .from('project_members')
      .upsert({ user_id: uid, project_id: projectId, role: role as 'Project Admin' | 'Project User' });
    if (error) throw error;
  }

  async removeProjectRole(uid: string, _enterpriseId: string, projectId: string): Promise<void> {
    const { error } = await supabase
      .from('project_members')
      .delete()
      .eq('user_id', uid)
      .eq('project_id', projectId);
    if (error) throw error;
  }
}
