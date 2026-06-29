import type { Enterprise } from '../../domain/types';
import type { Unsubscribe } from './index';

export interface EnterpriseRepository {
  get(enterpriseId: string): Promise<Enterprise | null>;
  subscribe(enterpriseId: string, callback: (enterprise: Enterprise | null) => void): Unsubscribe;
  subscribeAll(adminUserEmail: string, callback: (enterprises: Enterprise[]) => void): Unsubscribe;
  update(enterpriseId: string, data: Partial<Enterprise>): Promise<void>;
  create(data: Omit<Enterprise, 'id'>): Promise<Enterprise>;
}
