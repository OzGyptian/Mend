import type { ScheduleItem, Calendar } from '../../domain/types';
import type { Unsubscribe } from './index';

export interface ScheduleRepository {
  subscribeItems(projectId: string, callback: (items: ScheduleItem[]) => void): Unsubscribe;
  listItems(projectId: string): Promise<ScheduleItem[]>;
  createItem(data: Omit<ScheduleItem, 'id' | 'updatedAt'>): Promise<ScheduleItem>;
  updateItem(id: string, data: Partial<ScheduleItem>): Promise<void>;
  deleteItem(id: string): Promise<void>;
  batchUpdateItems(updates: Array<{ id: string; data: Partial<ScheduleItem> }>): Promise<void>;

  subscribeCalendars(
    scope: { projectId?: string; enterpriseId?: string },
    callback: (calendars: Calendar[]) => void
  ): Unsubscribe;
  listCalendars(scope: { projectId?: string; enterpriseId?: string }): Promise<Calendar[]>;
  getCalendar(id: string): Promise<Calendar | null>;
  createCalendar(data: Omit<Calendar, 'id' | 'createdAt'>): Promise<Calendar>;
  updateCalendar(id: string, data: Partial<Calendar>): Promise<void>;
  deleteCalendar(id: string): Promise<void>;
}
