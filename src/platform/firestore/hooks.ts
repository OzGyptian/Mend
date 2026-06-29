export { usePlatform, FirestoreProvider } from './context';

import { usePlatform } from './context';

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
