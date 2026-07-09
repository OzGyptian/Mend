import type { Enterprise } from '../../domain/types';
import type { Unsubscribe } from './index';

export interface EnterpriseRepository {
  subscribeAll(callback: (enterprises: Enterprise[]) => void): Unsubscribe;
  get(enterpriseId: string): Promise<Enterprise | null>;
  subscribe(enterpriseId: string, callback: (enterprise: Enterprise | null) => void): Unsubscribe;
  subscribeByAdmin(adminUserEmail: string, callback: (enterprises: Enterprise[]) => void): Unsubscribe;
  subscribeByUserId(userId: string, callback: (enterprises: Enterprise[]) => void): Unsubscribe;
  subscribeById(enterpriseId: string, callback: (enterprise: Enterprise | null) => void): Unsubscribe;
  bootstrapIfEmpty(userId: string, name: string, role: string): Promise<void>;
  acceptInvitation(token: string, userId: string, userEmail: string, displayName: string): Promise<{ enterpriseName: string } | null>;
  update(enterpriseId: string, data: Partial<Enterprise>): Promise<void>;
  create(data: Omit<Enterprise, 'id'>): Promise<Enterprise>;
  createMany(records: Array<Omit<Enterprise, 'id'>>): Promise<void>;
  delete(id: string): Promise<void>;
  deleteMany(ids: string[]): Promise<void>;
}
