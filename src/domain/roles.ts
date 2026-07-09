export type PlatformRole = 'platform_admin';

export type EnterpriseRole = 'enterprise_admin' | 'enterprise_member';

export type ProjectRole =
  | 'project_admin'
  | 'project_writer'
  | 'project_reader'
  | 'project_guest';

export interface EnterpriseMembership {
  enterpriseId: string;
  role: EnterpriseRole;
  // Keyed by projectId. Extensible: add divisionRoles, businessUnitRoles, etc.
  projectRoles: Record<string, ProjectRole>;
}

export interface UserRoles {
  platformRole: PlatformRole | null;
  // Array supports users who belong to multiple enterprises (e.g. consultants).
  memberships: EnterpriseMembership[];
}

// Maps legacy strings stored in project.users to typed ProjectRole.
// project.users is a Record<uid, string> on each Project document in Firestore.
const PROJECT_ROLE_MAP: Record<string, ProjectRole> = {
  'Project Admin': 'project_admin',
  'Project Writer': 'project_writer',
  'Project Reader': 'project_reader',
  'Project Guest': 'project_guest',
  project_admin: 'project_admin',
  project_writer: 'project_writer',
  project_reader: 'project_reader',
  project_guest: 'project_guest',
};

export function getProjectRole(
  users: Record<string, string> | undefined,
  uid: string
): ProjectRole | null {
  const raw = users?.[uid];
  return raw ? (PROJECT_ROLE_MAP[raw] ?? null) : null;
}
