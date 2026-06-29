import type { SavedView, PeriodSnapshot } from '../../domain/types';
import type { Unsubscribe } from './index';

export interface UtilityRepository {
  // Saved Views
  subscribeSavedViews(userId: string, tableId: string, callback: (views: SavedView[]) => void): Unsubscribe;
  createSavedView(data: Omit<SavedView, 'id' | 'createdAt'>): Promise<SavedView>;
  updateSavedView(id: string, data: Partial<SavedView>): Promise<void>;
  deleteSavedView(id: string): Promise<void>;

  // Period Snapshots (write-only — used when closing a reporting period)
  createPeriodSnapshot(data: Omit<PeriodSnapshot, 'id' | 'createdAt'>): Promise<void>;
  batchCreatePeriodSnapshots(records: Array<Omit<PeriodSnapshot, 'id' | 'createdAt'>>): Promise<void>;

  // Invitations (write-only)
  createInvitation(data: {
    email: string;
    enterpriseId: string;
    enterpriseName: string;
    invitedBy: string;
    status: 'pending';
    createdAt: string;
  }): Promise<{ id: string }>;

  // Audit log (write-only)
  logAudit(data: {
    enterpriseId: string;
    projectId: string | null;
    userId: string;
    userEmail: string;
    action: string;
    timestamp: string;
    details?: Record<string, unknown>;
  }): Promise<void>;
}
