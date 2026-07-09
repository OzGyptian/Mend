import { doc, getDoc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type { UserRoleRepository } from '../../ports/userRole.port';
import type { UserRoles, EnterpriseRole, ProjectRole, EnterpriseMembership } from '../../../domain/roles';

const EMPTY_ROLES: UserRoles = { platformRole: null, memberships: [] };

function toUserRoles(data: Record<string, unknown> | undefined): UserRoles {
  if (!data) return EMPTY_ROLES;
  return {
    platformRole: (data.platformRole as UserRoles['platformRole']) ?? null,
    memberships: (data.memberships as EnterpriseMembership[]) ?? [],
  };
}

export class UserRoleAdapter implements UserRoleRepository {
  async getUserRoles(uid: string): Promise<UserRoles> {
    const snap = await getDoc(doc(db, 'userRoles', uid));
    return toUserRoles(snap.data() as Record<string, unknown> | undefined);
  }

  subscribeUserRoles(uid: string, callback: (roles: UserRoles) => void): () => void {
    return onSnapshot(doc(db, 'userRoles', uid), (snap) => {
      callback(toUserRoles(snap.data() as Record<string, unknown> | undefined));
    });
  }

  async setEnterpriseRole(uid: string, enterpriseId: string, role: EnterpriseRole): Promise<void> {
    const current = await this.getUserRoles(uid);
    const existing = current.memberships.find(m => m.enterpriseId === enterpriseId);
    const updated: EnterpriseMembership[] = existing
      ? current.memberships.map(m =>
          m.enterpriseId === enterpriseId ? { ...m, role } : m
        )
      : [...current.memberships, { enterpriseId, role, projectRoles: {} }];
    await setDoc(doc(db, 'userRoles', uid), { ...current, memberships: updated }, { merge: true });
  }

  async setProjectRole(uid: string, enterpriseId: string, projectId: string, role: ProjectRole): Promise<void> {
    const current = await this.getUserRoles(uid);
    const membership = current.memberships.find(m => m.enterpriseId === enterpriseId);
    const updated: EnterpriseMembership[] = membership
      ? current.memberships.map(m =>
          m.enterpriseId === enterpriseId
            ? { ...m, projectRoles: { ...m.projectRoles, [projectId]: role } }
            : m
        )
      : [...current.memberships, { enterpriseId, role: 'enterprise_member', projectRoles: { [projectId]: role } }];
    await setDoc(doc(db, 'userRoles', uid), { ...current, memberships: updated }, { merge: true });
  }

  async removeProjectRole(uid: string, enterpriseId: string, projectId: string): Promise<void> {
    const current = await this.getUserRoles(uid);
    const updated: EnterpriseMembership[] = current.memberships.map(m => {
      if (m.enterpriseId !== enterpriseId) return m;
      const { [projectId]: _removed, ...rest } = m.projectRoles;
      return { ...m, projectRoles: rest };
    });
    await updateDoc(doc(db, 'userRoles', uid), { memberships: updated });
  }
}
