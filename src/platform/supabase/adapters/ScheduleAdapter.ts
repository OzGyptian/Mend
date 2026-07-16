import { supabase } from '../client';
import { toRow, fromRow } from '../caseConvert';
import type { Database } from '../database.types';
import type { ScheduleItem, Calendar } from '../../../domain/types';
import type { ScheduleRepository } from '../../ports/schedule.port';
import type { Unsubscribe } from '../../ports/index';

type ScheduleItemInsert = Database['public']['Tables']['schedule_items']['Insert'];
type ScheduleItemUpdate = Database['public']['Tables']['schedule_items']['Update'];
type CalendarInsert = Database['public']['Tables']['calendars']['Insert'];
type CalendarUpdate = Database['public']['Tables']['calendars']['Update'];

export class PostgresScheduleAdapter implements ScheduleRepository {
  subscribeScheduleItems(projectId: string, callback: (items: ScheduleItem[]) => void): Unsubscribe {
    const fetchAndEmit = async () => {
      const { data } = await supabase.from('schedule_items').select('*').eq('project_id', projectId);
      callback((data ?? []).map((row) => fromRow<ScheduleItem>(row)));
    };
    fetchAndEmit();
    const channel = supabase
      .channel(`schedule_items:${projectId}:${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'schedule_items', filter: `project_id=eq.${projectId}` }, fetchAndEmit)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }

  async listScheduleItems(projectId: string): Promise<ScheduleItem[]> {
    const { data, error } = await supabase.from('schedule_items').select('*').eq('project_id', projectId);
    if (error) throw error;
    return (data ?? []).map((row) => fromRow<ScheduleItem>(row));
  }

  async createScheduleItem(data: Omit<ScheduleItem, 'id' | 'updatedAt'>): Promise<ScheduleItem> {
    const row = toRow<ScheduleItemInsert>(data);
    const { data: inserted, error } = await supabase.from('schedule_items').insert(row).select().single();
    if (error) throw error;
    return fromRow<ScheduleItem>(inserted);
  }

  async createManyScheduleItems(data: Array<Omit<ScheduleItem, 'id' | 'updatedAt'>>): Promise<void> {
    const rows = data.map((d) => toRow<ScheduleItemInsert>(d));
    const { error } = await supabase.from('schedule_items').insert(rows);
    if (error) throw error;
  }

  async updateScheduleItem(id: string, data: Partial<ScheduleItem>): Promise<void> {
    const { error } = await supabase.from('schedule_items').update(toRow<ScheduleItemUpdate>(data)).eq('id', id);
    if (error) throw error;
  }

  async updateManyScheduleItems(updates: Array<{ id: string; data: Partial<ScheduleItem> }>): Promise<void> {
    const results = await Promise.all(
      updates.map(({ id, data }) => supabase.from('schedule_items').update(toRow<ScheduleItemUpdate>(data)).eq('id', id))
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) throw failed.error;
  }

  async deleteScheduleItem(id: string): Promise<void> {
    const { error } = await supabase.from('schedule_items').delete().eq('id', id);
    if (error) throw error;
  }

  subscribeProjectCalendars(projectId: string, callback: (calendars: Calendar[]) => void): Unsubscribe {
    const fetchAndEmit = async () => {
      const { data } = await supabase.from('calendars').select('*').eq('project_id', projectId);
      callback((data ?? []).map((row) => fromRow<Calendar>(row)));
    };
    fetchAndEmit();
    const channel = supabase
      .channel(`calendars_project:${projectId}:${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calendars', filter: `project_id=eq.${projectId}` }, fetchAndEmit)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }

  subscribeEnterpriseCalendars(enterpriseId: string, callback: (calendars: Calendar[]) => void): Unsubscribe {
    const fetchAndEmit = async () => {
      const { data } = await supabase.from('calendars').select('*').eq('enterprise_id', enterpriseId);
      callback((data ?? []).map((row) => fromRow<Calendar>(row)));
    };
    fetchAndEmit();
    const channel = supabase
      .channel(`calendars_enterprise:${enterpriseId}:${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calendars', filter: `enterprise_id=eq.${enterpriseId}` }, fetchAndEmit)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }

  async listProjectCalendars(projectId: string): Promise<Calendar[]> {
    const { data, error } = await supabase.from('calendars').select('*').eq('project_id', projectId);
    if (error) throw error;
    return (data ?? []).map((row) => fromRow<Calendar>(row));
  }

  async listEnterpriseCalendars(enterpriseId: string): Promise<Calendar[]> {
    const { data, error } = await supabase.from('calendars').select('*').eq('enterprise_id', enterpriseId);
    if (error) throw error;
    return (data ?? []).map((row) => fromRow<Calendar>(row));
  }

  async getCalendar(id: string): Promise<Calendar | null> {
    const { data, error } = await supabase.from('calendars').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data ? fromRow<Calendar>(data) : null;
  }

  async createCalendar(data: Omit<Calendar, 'id' | 'createdAt'>): Promise<Calendar> {
    const row = toRow<CalendarInsert>(data);
    const { data: inserted, error } = await supabase.from('calendars').insert(row).select().single();
    if (error) throw error;
    return fromRow<Calendar>(inserted);
  }

  async updateCalendar(id: string, data: Partial<Calendar>): Promise<void> {
    const { error } = await supabase.from('calendars').update(toRow<CalendarUpdate>(data)).eq('id', id);
    if (error) throw error;
  }

  async deleteCalendar(id: string): Promise<void> {
    const { error } = await supabase.from('calendars').delete().eq('id', id);
    if (error) throw error;
  }
}
