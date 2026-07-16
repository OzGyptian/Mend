import { supabase } from '../client';
import { toRow, fromRow } from '../caseConvert';
import type { Database } from '../database.types';
import type { Project, Sheet } from '../../../domain/types';
import type { ProjectRepository } from '../../ports/project.port';
import type { Unsubscribe } from '../../ports/index';

type ProjectInsert = Database['public']['Tables']['projects']['Insert'];
type ProjectUpdate = Database['public']['Tables']['projects']['Update'];

// Project.users (Record<uid, 'Project Admin' | 'Project User'>) is now real
// rows in project_members -- reconstructed here the same way
// EnterpriseAdapter reconstructs Enterprise.adminUsers/users.
async function attachMembers(project: Project): Promise<Project> {
  const { data: members } = await supabase.from('project_members').select('user_id, role').eq('project_id', project.id);
  const users: Project['users'] = {};
  for (const m of members ?? []) users[m.user_id] = m.role as 'Project Admin' | 'Project User';
  return { ...project, users };
}

async function resolveUserId(email: string): Promise<string | null> {
  const { data } = await supabase.from('user_profiles').select('user_id').eq('email', email).maybeSingle();
  return data?.user_id ?? null;
}

export class PostgresProjectAdapter implements ProjectRepository {
  async get(projectId: string): Promise<Project | null> {
    const { data, error } = await supabase.from('projects').select('*').eq('id', projectId).maybeSingle();
    if (error) throw error;
    return data ? attachMembers(fromRow<Project>(data)) : null;
  }

  async list(enterpriseId: string, userEmail: string): Promise<Project[]> {
    // Matches the original Firestore adapter: an empty/falsy userEmail means
    // "no member filter -- return every project in the enterprise" (callers
    // like EnterpriseDashboard.tsx pass '' deliberately and do their own
    // admin-vs-member filtering afterward). The Postgres port dropped this
    // branch and always filtered by membership, so an empty string resolved
    // to no user and silently returned nothing for every caller relying on
    // the "give me everything" behavior -- e.g. the enterprise admin's own
    // "Active Projects" grid never showing newly created projects.
    if (!userEmail) return this.listByEnterprise(enterpriseId);
    const userId = await resolveUserId(userEmail);
    if (!userId) return [];
    const { data: memberships } = await supabase.from('project_members').select('project_id').eq('user_id', userId);
    const projectIds = (memberships ?? []).map((m) => m.project_id);
    if (projectIds.length === 0) return [];
    const { data, error } = await supabase.from('projects').select('*').eq('enterprise_id', enterpriseId).in('id', projectIds);
    if (error) throw error;
    return Promise.all((data ?? []).map((row) => attachMembers(fromRow<Project>(row))));
  }

  subscribe(projectId: string, callback: (project: Project | null) => void): Unsubscribe {
    const fetchAndEmit = async () => { callback(await this.get(projectId)); };
    fetchAndEmit();
    const channel = supabase
      .channel(`project:${projectId}:${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects', filter: `id=eq.${projectId}` }, fetchAndEmit)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_members', filter: `project_id=eq.${projectId}` }, fetchAndEmit)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }

  subscribeByEnterprise(enterpriseId: string, userEmail: string, callback: (projects: Project[]) => void): Unsubscribe {
    const fetchAndEmit = async () => {
      callback(await this.list(enterpriseId, userEmail));
    };
    fetchAndEmit();
    const channel = supabase
      .channel(`projects_enterprise:${enterpriseId}:${userEmail}:${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_members' }, fetchAndEmit)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects', filter: `enterprise_id=eq.${enterpriseId}` }, fetchAndEmit)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }

  async listByEnterprise(enterpriseId: string): Promise<Project[]> {
    const { data, error } = await supabase.from('projects').select('*').eq('enterprise_id', enterpriseId);
    if (error) throw error;
    return Promise.all((data ?? []).map((row) => attachMembers(fromRow<Project>(row))));
  }

  async create(data: Omit<Project, 'id' | 'dateCreated' | 'dateLastModified'>): Promise<Project> {
    const { users, ...rest } = data;
    const row = toRow<ProjectInsert>(rest);
    // insert().select() (RETURNING under the hood) can fail RLS here even
    // though both the insert and a same-row select immediately afterward
    // (as two separate statements) succeed -- can_access_project() re-queries
    // projects by id, and within a single RETURNING command that subquery
    // doesn't reliably see the row it's part of inserting yet. Splitting into
    // a bare insert followed by a separate select avoids it (see the
    // matching fix and longer note in EnterpriseAdapter.create()).
    const id = crypto.randomUUID();
    const { error } = await supabase.from('projects').insert({ ...row, id });
    if (error) throw error;
    const memberRows = Object.entries(users ?? {}).map(([userId, role]) => ({
      project_id: id, user_id: userId, role,
    }));
    if (memberRows.length > 0) {
      const { error: memberError } = await supabase.from('project_members').insert(memberRows);
      if (memberError) throw memberError;
    }
    const { data: inserted, error: fetchError } = await supabase.from('projects').select().eq('id', id).single();
    if (fetchError) throw fetchError;
    return attachMembers(fromRow<Project>(inserted));
  }

  async update(projectId: string, data: Partial<Project>): Promise<void> {
    const { users: _users, ...rest } = data;
    const { error } = await supabase.from('projects').update(toRow<ProjectUpdate>(rest)).eq('id', projectId);
    if (error) throw error;
  }

  async delete(projectId: string): Promise<void> {
    const { error } = await supabase.from('projects').delete().eq('id', projectId);
    if (error) throw error;
  }

  // Firestore had to manually cascade-delete sheets + their row subcollection
  // in a batch. Postgres already cascades via the real FKs on sheets and
  // forecast_rows (ON DELETE CASCADE) -- deleting the project is enough.
  async deleteProjectWithSheets(projectId: string): Promise<void> {
    const { error } = await supabase.from('projects').delete().eq('id', projectId);
    if (error) throw error;
  }

  subscribeSheet(sheetId: string, callback: (sheet: Sheet | null) => void): Unsubscribe {
    const fetchAndEmit = async () => {
      const { data } = await supabase.from('sheets').select('*').eq('id', sheetId).maybeSingle();
      callback(data ? fromRow<Sheet>(data) : null);
    };
    fetchAndEmit();
    const channel = supabase
      .channel(`sheet_project:${sheetId}:${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sheets', filter: `id=eq.${sheetId}` }, fetchAndEmit)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }

  async findSheetsByName(projectId: string, sheetName: string): Promise<Array<{ id: string }>> {
    const { data, error } = await supabase.from('sheets').select('id').eq('project_id', projectId).eq('sheet_name', sheetName);
    if (error) throw error;
    return data ?? [];
  }

  async createSheet(data: Record<string, unknown>): Promise<{ id: string }> {
    const row = toRow<Database['public']['Tables']['sheets']['Insert']>(data);
    const { data: inserted, error } = await supabase.from('sheets').insert(row).select('id').single();
    if (error) throw error;
    return inserted;
  }

  async createSheetRow(sheetId: string, data: Record<string, unknown>): Promise<void> {
    const row = toRow<Database['public']['Tables']['forecast_rows']['Insert']>({ ...data, sheetId });
    const { error } = await supabase.from('forecast_rows').insert(row);
    if (error) throw error;
  }

  async checkProjectCodeExists(enterpriseId: string, projectCode: string): Promise<boolean> {
    const { count, error } = await supabase
      .from('projects').select('*', { count: 'exact', head: true })
      .eq('enterprise_id', enterpriseId).eq('project_code', projectCode);
    if (error) throw error;
    return (count ?? 0) > 0;
  }
}
