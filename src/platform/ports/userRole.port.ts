import type { UserRoles, EnterpriseRole, ProjectRole } from '../../domain/roles';

export type { UserRoles };

export interface UserRoleRepository {
  getUserRoles(uid: string): Promise<UserRoles>;
  subscribeUserRoles(uid: string, callback: (roles: UserRoles) => void): () => void;
  setEnterpriseRole(uid: string, enterpriseId: string, role: EnterpriseRole): Promise<void>;
  setProjectRole(uid: string, enterpriseId: string, projectId: string, role: ProjectRole): Promise<void>;
  removeProjectRole(uid: string, enterpriseId: string, projectId: string): Promise<void>;
}
