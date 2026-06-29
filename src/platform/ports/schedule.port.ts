import type { ScheduleItem, Calendar } from '../../domain/types';
import type { Unsubscribe } from './index';

export interface ScheduleRepository {
  subscribeScheduleItems(projectId: string, callback: (items: ScheduleItem[]) => void): Unsubscribe;
  listScheduleItems(projectId: string): Promise<ScheduleItem[]>;
  createScheduleItem(data: Omit<ScheduleItem, 'id' | 'updatedAt'>): Promise<ScheduleItem>;
  updateScheduleItem(id: string, data: Partial<ScheduleItem>): Promise<void>;
  deleteScheduleItem(id: string): Promise<void>;
  updateManyScheduleItems(updates: Array<{ id: string; data: Partial<ScheduleItem> }>): Promise<void>;

  subscribeProjectCalendars(projectId: string, callback: (calendars: Calendar[]) => void): Unsubscribe;
  subscribeEnterpriseCalendars(enterpriseId: string, callback: (calendars: Calendar[]) => void): Unsubscribe;
  listProjectCalendars(projectId: string): Promise<Calendar[]>;
  listEnterpriseCalendars(enterpriseId: string): Promise<Calendar[]>;
  getCalendar(id: string): Promise<Calendar | null>;
  createCalendar(data: Omit<Calendar, 'id' | 'createdAt'>): Promise<Calendar>;
  updateCalendar(id: string, data: Partial<Calendar>): Promise<void>;
  deleteCalendar(id: string): Promise<void>;
}
