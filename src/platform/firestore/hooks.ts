export { usePlatform, FirestoreProvider } from './context';

import { useState, useEffect } from 'react';
import { usePlatform } from './context';
import type { AuthUser } from '../ports/auth.port';
import type { UserRoles, EnterpriseRole } from '../../domain/roles';

export const useEnterpriseRepo = () => usePlatform().enterprise;
export const useProjectRepo = () => usePlatform().project;
export const useCostRepo = () => usePlatform().cost;
export const useChangeRepo = () => usePlatform().change;
export const useRiskRepo = () => usePlatform().risk;
export const useSubcontractRepo = () => usePlatform().subcontract;
export const useProgressRepo = () => usePlatform().progress;
export const useProcurementRepo = () => usePlatform().procurement;
export const useScheduleRepo = () => usePlatform().schedule;
export const useUtilityRepo = () => usePlatform().utility;
export const useAuthRepo = () => usePlatform().auth;
export const useUserRoleRepo = () => usePlatform().userRole;

export interface AuthState {
  user: AuthUser | null;
  roles: UserRoles | null;
  loading: boolean;
  isPlatformAdmin: boolean;
  enterpriseRole: (enterpriseId: string) => EnterpriseRole | null;
}

export function useAuth(): AuthState {
  const { auth, userRole } = usePlatform();
  const [user, setUser] = useState<AuthUser | null>(() => auth.getCurrentUser());
  const [roles, setRoles] = useState<UserRoles | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubRoles: (() => void) | null = null;

    const unsubAuth = auth.subscribeToAuth((u) => {
      setUser(u);
      unsubRoles?.();
      unsubRoles = null;

      if (!u) {
        setRoles(null);
        setLoading(false);
        return;
      }

      unsubRoles = userRole.subscribeUserRoles(u.id, (r) => {
        setRoles(r);
        setLoading(false);
      });
    });

    return () => {
      unsubAuth();
      unsubRoles?.();
    };
  }, [auth, userRole]);

  const SYSTEM_OWNER_EMAILS = ['tarek.guindy@gmail.com', 'tarek_guindy@hotmail.com'];
  const isPlatformAdmin =
    roles?.platformRole === 'platform_admin' ||
    SYSTEM_OWNER_EMAILS.includes(user?.email?.toLowerCase() ?? '');

  const enterpriseRole = (enterpriseId: string): EnterpriseRole | null => {
    if (isPlatformAdmin) return 'enterprise_admin';
    return roles?.memberships.find(m => m.enterpriseId === enterpriseId)?.role ?? null;
  };

  return { user, roles, loading, isPlatformAdmin, enterpriseRole };
}
