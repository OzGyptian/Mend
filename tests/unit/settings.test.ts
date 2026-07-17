import { describe, it, expect } from 'vitest';
import { resolveProjectSettings } from '../../src/domain/settings';
import type { Enterprise, Project } from '../../src/domain/types';

const baseEnterprise: Enterprise = {
  id: 'ent-1',
  enterpriseId: 'ent-1',
  name: 'Test Enterprise',
  adminUsers: [],
  createdAt: '2024-01-01',
  categories: ['Cat A', 'Cat B'],
  changeTypes: ['Variation', 'Budget Transfer'],
  riskTypes: ['Design', 'Commercial'],
  controlAccounts: ['CA-1'],
  orderNumbers: ['ON-1'],
  costElements: [{ id: 'L', description: 'Labour', sortCode: 'L' }],
  resourceRates: [{ id: 'r1', name: 'Engineer', unit: 'hr', rate: 100 }],
  costCodeAttributes: [{ id: '01', title: 'Phase', values: [] }],
  changeAttributes: [{ id: '01', title: 'Reason', values: [] }],
  riskAttributes: [{ id: '01', title: 'Category', values: [] }],
  subcontractAttributes: [{ id: '01', title: 'Type', values: [] }],
  procurementAttributes: [{ id: '01', title: 'Attr', values: [] }],
  progressAttributes: [{ id: '01', title: 'Attr', values: [] }],
  lineItemAttributes: [{ id: '01', title: 'Cost Type', values: [] }],
};

const baseProject: Project = {
  id: 'proj-1',
  enterpriseId: 'ent-1',
  projectName: 'Test Project',
  projectCode: 'TP-001',
  projectBudget: 0,
  startDate: '2024-01-01',
  endDate: '2024-12-31',
  cutoffDate: '2024-12-31',
  users: {},
  dateCreated: '2024-01-01',
  dateLastModified: '2024-01-01',
};

describe('resolveProjectSettings', () => {
  it('inherits all settings from enterprise when project has none', () => {
    const result = resolveProjectSettings(baseProject, baseEnterprise);

    expect(result.categories).toEqual(['Cat A', 'Cat B']);
    expect(result.changeTypes).toEqual(['Variation', 'Budget Transfer']);
    expect(result.riskTypes).toEqual(['Design', 'Commercial']);
    expect(result.controlAccounts).toEqual(['CA-1']);
    expect(result.orderNumbers).toEqual(['ON-1']);
    expect(result.costElements).toEqual([{ id: 'L', description: 'Labour', sortCode: 'L' }]);
    expect(result.resourceRates).toEqual([{ id: 'r1', name: 'Engineer', unit: 'hr', rate: 100 }]);
    expect(result.costCodeAttributes).toEqual([{ id: '01', title: 'Phase', values: [] }]);
    expect(result.lineItemAttributes).toEqual([{ id: '01', title: 'Cost Type', values: [] }]);
  });

  it('keeps project override when project has set a value', () => {
    const project: Project = {
      ...baseProject,
      categories: ['Project Cat'],
      changeTypes: ['Project Change'],
      costCodeAttributes: [{ id: '01', title: 'Project Phase', values: [] }],
    };

    const result = resolveProjectSettings(project, baseEnterprise);

    expect(result.categories).toEqual(['Project Cat']);
    expect(result.changeTypes).toEqual(['Project Change']);
    expect(result.costCodeAttributes).toEqual([{ id: '01', title: 'Project Phase', values: [] }]);
    // Non-overridden settings still inherit
    expect(result.riskTypes).toEqual(['Design', 'Commercial']);
    expect(result.lineItemAttributes).toEqual([{ id: '01', title: 'Cost Type', values: [] }]);
  });

  it('keeps explicit empty array override ([] ≠ null)', () => {
    const project: Project = {
      ...baseProject,
      categories: [],       // explicit override to empty — project does NOT want enterprise categories
      changeTypes: [],
    };

    const result = resolveProjectSettings(project, baseEnterprise);

    expect(result.categories).toEqual([]);
    expect(result.changeTypes).toEqual([]);
    // Non-overridden settings still inherit
    expect(result.riskTypes).toEqual(['Design', 'Commercial']);
  });

  it('does not mutate the input project', () => {
    const project = { ...baseProject };
    resolveProjectSettings(project, baseEnterprise);
    expect(project.categories).toBeUndefined();
  });

  it('returns enterprise values as undefined when enterprise has none set', () => {
    const emptyEnterprise: Enterprise = {
      ...baseEnterprise,
      categories: undefined,
      changeTypes: undefined,
    };

    const result = resolveProjectSettings(baseProject, emptyEnterprise);

    expect(result.categories).toBeUndefined();
    expect(result.changeTypes).toBeUndefined();
    // Settings enterprise HAS are still inherited
    expect(result.riskTypes).toEqual(['Design', 'Commercial']);
  });
});
