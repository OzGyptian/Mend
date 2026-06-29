import type { SavedView, PeriodSnapshot } from '../../domain/types';
import type { Unsubscribe } from './index';

export interface UtilityRepository {
  // Saved Views
  subscribeSavedViews(userId: string, tableId: string, callback: (views: SavedView[]) => void): Unsubscribe;
  createSavedView(data: Omit<SavedView, 'id' | 'createdAt'>): Promise<SavedView>;
  updateSavedView(id: string, data: Partial<SavedView>): Promise<void>;
  deleteSavedView(id: string): Promise<void>;

  // Period Snapshots — recorded when a reporting period is closed; never updated
  savePeriodSnapshot(data: Omit<PeriodSnapshot, 'id' | 'createdAt'>): Promise<void>;
  savePeriodSnapshots(records: Array<Omit<PeriodSnapshot, 'id' | 'createdAt'>>): Promise<void>;

  // Invitations — write-only; status lifecycle managed server-side
  createInvitation(data: {
    email: string;
    enterpriseId: string;
    enterpriseName: string;
    invitedBy: string;
    status: 'pending';
    createdAt: string;
  }): Promise<{ id: string }>;

  // Audit trail — append-only record of significant domain events
  recordAuditEvent(data: {
    enterpriseId: string;
    projectId: string | null;
    userId: string;
    userEmail: string;
    action: string;
    occurredAt: string;
    details?: Record<string, unknown>;
  }): Promise<void>;
}
