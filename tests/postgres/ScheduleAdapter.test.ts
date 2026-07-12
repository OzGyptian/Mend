import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { supabase } from '../../src/platform/supabase/client';
import { PostgresScheduleAdapter } from '../../src/platform/supabase/adapters/ScheduleAdapter';
import {
  addProjectMember,
  cleanupEnterprise,
  createFixtureEnterprise,
  createFixtureProject,
  createTestUser,
  deleteTestUser,
  signInAs,
  signOut,
  type TestUser,
} from './helpers';

describe('PostgresScheduleAdapter', () => {
  const adapter = new PostgresScheduleAdapter();
  const enterpriseIds: string[] = [];
  const userIds: string[] = [];
  let projectId: string;
  let projectMember: TestUser;
  let outsider: TestUser;

  beforeAll(async () => {
    projectMember = await createTestUser('sched-project-member');
    outsider = await createTestUser('sched-outsider');
    userIds.push(projectMember.id, outsider.id);

    const enterpriseId = await createFixtureEnterprise('Schedule Test Enterprise');
    enterpriseIds.push(enterpriseId);
    projectId = await createFixtureProject(enterpriseId, 'STP-001', 'Schedule Test Project');
    await addProjectMember(projectId, projectMember.id, 'Project Admin');
  });

  afterAll(async () => {
    await signOut(supabase);
    for (const id of enterpriseIds) await cleanupEnterprise(id);
    for (const id of userIds) await deleteTestUser(id);
  });

  it('lets a project member create, list, update, and delete a schedule item', async () => {
    await signInAs(supabase, projectMember);
    const created = await adapter.createScheduleItem({
      projectId,
      activityId: 'ACT-001',
      description: 'Pour foundations',
      activityPercentComplete: 0,
    } as never);
    expect(created.description).toBe('Pour foundations');

    const list = await adapter.listScheduleItems(projectId);
    expect(list.map((i) => i.id)).toContain(created.id);

    await adapter.updateScheduleItem(created.id, { activityPercentComplete: 50 } as never);
    const afterUpdate = await adapter.listScheduleItems(projectId);
    expect((afterUpdate.find((i) => i.id === created.id) as never as { activityPercentComplete: number })?.activityPercentComplete).toBe(50);

    await adapter.deleteScheduleItem(created.id);
    const afterDelete = await adapter.listScheduleItems(projectId);
    expect(afterDelete.map((i) => i.id)).not.toContain(created.id);
  });

  it('RLS: an outsider with no project membership sees no schedule items', async () => {
    await signInAs(supabase, projectMember);
    await adapter.createScheduleItem({
      projectId,
      activityId: 'ACT-002',
      description: 'Frame structure',
      activityPercentComplete: 0,
    } as never);

    await signInAs(supabase, outsider);
    const list = await adapter.listScheduleItems(projectId);
    expect(list).toHaveLength(0);
  });

  it('lets a project member create a project-scoped calendar', async () => {
    await signInAs(supabase, projectMember);
    const calendar = await adapter.createCalendar({
      projectId,
      name: 'Standard Calendar',
      weekends: [0, 6],
      holidays: [],
    } as never);
    expect(calendar.name).toBe('Standard Calendar');

    await signInAs(supabase, outsider);
    const collected: unknown[] = [];
    await new Promise<void>((resolve) => {
      const unsub = adapter.subscribeProjectCalendars(projectId, (calendars) => {
        collected.push(calendars);
        unsub();
        resolve();
      });
    });
    expect((collected[0] as unknown[])).toHaveLength(0);
  });
});
