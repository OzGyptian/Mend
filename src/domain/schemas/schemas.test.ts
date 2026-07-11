import { describe, test, expect } from 'vitest';
import {
  ProjectAttributeValueSchema,
  ProjectAttributeSchema,
  ResourceRateSchema,
  CostElementSchema,
  VendorSchema,
  EnterpriseSchema,
  ForecastMethodSchema,
  DistributionMethodSchema,
  ProjectStatusSchema,
  ProjectCostElementSchema,
  ProjectSchema,
  SheetSchema,
  ForecastRowSchema,
  SavedViewSchema,
  UserProfileSchema,
  CostCodeSchema,
  ActualCostRecordSchema,
  BaselineBudgetRecordSchema,
  CostPhasingRecordSchema,
  EtcDetailSchema,
  PeriodSnapshotSchema,
  SubcontractSchema,
  SubcontractLineItemSchema,
  InvoiceSchema,
  InvoiceItemSchema,
  RiskSchema,
  RiskRecordSchema,
  ChangeSchema,
  ChangeRecordSchema,
  ProgressPackageSchema,
  ProgressItemSchema,
  ProgressReportingPeriodSchema,
  ProgressAttributeSchema,
  RuleOfCreditSchema,
  RuleOfCreditStepSchema,
  ProcurementStepDefinitionSchema,
  ProcurementStepDataSchema,
  ProcurementItemSchema,
  CalendarSchema,
  ScheduleItemSchema,
} from './index';

describe('enterprise schemas', () => {
  test('ProjectAttributeValueSchema accepts a valid value', () => {
    expect(() =>
      ProjectAttributeValueSchema.parse({ id: 'v1', description: 'North', sortOrder: 1 })
    ).not.toThrow();
  });

  test('ProjectAttributeSchema accepts a valid attribute', () => {
    expect(() =>
      ProjectAttributeSchema.parse({
        id: '01',
        title: 'Region',
        values: [{ id: 'v1', description: 'North', sortOrder: 1 }],
      })
    ).not.toThrow();
  });

  test('ResourceRateSchema accepts a valid rate with optional fields omitted', () => {
    expect(() =>
      ResourceRateSchema.parse({ id: 'r1', name: 'Labourer', unit: 'hr' })
    ).not.toThrow();
  });

  test('CostElementSchema accepts a valid element', () => {
    expect(() =>
      CostElementSchema.parse({ id: 'ce1', description: 'Labour', sortCode: '01' })
    ).not.toThrow();
  });

  test('VendorSchema accepts a valid vendor with optional fields omitted', () => {
    expect(() => VendorSchema.parse({ id: 'ven1', name: 'Acme Co' })).not.toThrow();
  });

  test('EnterpriseSchema accepts a minimal valid enterprise', () => {
    expect(() =>
      EnterpriseSchema.parse({
        id: 'ent1',
        enterpriseId: 'ENT-1',
        name: 'Acme Construction',
        adminUsers: ['user1@example.com'],
        createdAt: '2026-01-01T00:00:00.000Z',
      })
    ).not.toThrow();
  });

  test('EnterpriseSchema accepts a full enterprise including nested users map', () => {
    expect(() =>
      EnterpriseSchema.parse({
        id: 'ent1',
        enterpriseId: 'ENT-1',
        name: 'Acme Construction',
        logoURL: 'https://example.com/logo.png',
        adminUsers: ['user1@example.com'],
        createdAt: '2026-01-01T00:00:00.000Z',
        theme: 'dark',
        users: {
          uid1: {
            email: 'user1@example.com',
            role: 'Enterprise System Admin',
          },
        },
        projectAttributes: [{ id: '01', title: 'Region', values: [] }],
        vendors: [{ id: 'ven1', name: 'Acme Co' }],
        resourceRates: [{ id: 'r1', name: 'Labourer', unit: 'hr' }],
        costElements: [{ id: 'ce1', description: 'Labour', sortCode: '01' }],
      })
    ).not.toThrow();
  });
});

describe('project schemas', () => {
  test('ForecastMethodSchema accepts valid literals', () => {
    expect(() => ForecastMethodSchema.parse('commitment')).not.toThrow();
    expect(() => ForecastMethodSchema.parse('time-based')).not.toThrow();
  });

  test('DistributionMethodSchema accepts valid literals', () => {
    expect(() => DistributionMethodSchema.parse('even')).not.toThrow();
  });

  test('ProjectStatusSchema accepts valid literals', () => {
    expect(() => ProjectStatusSchema.parse('Active')).not.toThrow();
  });

  test('ProjectCostElementSchema accepts a valid element', () => {
    expect(() =>
      ProjectCostElementSchema.parse({ id: 'pce1', description: 'Labour', sortCode: '01' })
    ).not.toThrow();
  });

  const validProject = {
    id: 'proj1',
    enterpriseId: 'ent1',
    projectName: 'Riverside Tower',
    projectCode: 'RT-001',
    projectBudget: 1000000,
    startDate: '2026-01-01',
    endDate: '2027-01-01',
    cutoffDate: '2026-06-30',
    users: { uid1: 'Project Admin' },
    dateCreated: '2026-01-01T00:00:00.000Z',
    dateLastModified: '2026-01-01T00:00:00.000Z',
  };

  test('ProjectSchema accepts a minimal valid project', () => {
    expect(() => ProjectSchema.parse(validProject)).not.toThrow();
  });

  test('ProjectSchema accepts a project with reportingPeriods and procurementDefaults', () => {
    expect(() =>
      ProjectSchema.parse({
        ...validProject,
        status: 'Active',
        procurementDefaults: {
          calendarId: 'cal1',
          stepDurations: { step1: 5 },
        },
        reportingPeriods: {
          baseDate: '2026-01-01',
          duration: 'month',
          numberOfPeriods: 12,
          periods: [
            { id: 'p1', startDate: '2026-01-01', endDate: '2026-01-31', name: 'Jan', status: 'open' },
          ],
        },
      })
    ).not.toThrow();
  });

  test('ProjectSchema throws when a required field is missing', () => {
    const { projectBudget, ...missingBudget } = validProject;
    expect(() => ProjectSchema.parse(missingBudget)).toThrow();
  });

  test('SheetSchema accepts a valid sheet', () => {
    expect(() =>
      SheetSchema.parse({
        id: 'sheet1',
        projectId: 'proj1',
        sheetName: 'Base Forecast',
        forecastMethod: 'commitment',
        version: '1.0',
        lockedStatus: false,
        createdBy: 'uid1',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      })
    ).not.toThrow();
  });

  test('ForecastRowSchema accepts a valid row', () => {
    expect(() =>
      ForecastRowSchema.parse({
        id: 'row1',
        sheetId: 'sheet1',
        costCode: 'CC-01',
        description: 'Concrete works',
        vendor: 'Acme Co',
        budget: 50000,
        committedCost: 40000,
        actualCostToDate: 10000,
        costToGo: 40000,
        eac: 50000,
        timePhasing: { '2026-01': 5000 },
        distributionMethod: 'even',
      })
    ).not.toThrow();
  });

  test('SavedViewSchema accepts a valid view', () => {
    expect(() =>
      SavedViewSchema.parse({
        id: 'view1',
        name: 'My View',
        tableId: 'forecast',
        columns: ['costCode', 'budget'],
        userId: 'uid1',
        createdAt: '2026-01-01T00:00:00.000Z',
      })
    ).not.toThrow();
  });

  test('UserProfileSchema accepts a valid profile', () => {
    expect(() =>
      UserProfileSchema.parse({ uid: 'uid1', email: 'user@example.com', displayName: 'User One' })
    ).not.toThrow();
  });
});

describe('cost schemas', () => {
  const validCostCode = {
    id: 'cc1',
    code: 'CC-01',
    projectId: 'proj1',
    name: 'Concrete',
    enterpriseAttributes: {},
    projectAttributes: {},
    eacMethod: 'Manual',
    sortOrder: 1,
    baselineBudget: 10000,
    budgetChanges: 0,
    approvedBudget: 10000,
    approvedBudgetPrevious: 10000,
    approvedBudgetMovement: 0,
    actualCostThisPeriod: 1000,
    actualCostToDate: 1000,
    estimateToComplete: 9000,
    estimateAtCompletion: 10000,
    estimateAtCompletionPrevious: 10000,
    estimateAtCompletionMovement: 0,
    costVariance: 0,
    costVariancePrevious: 0,
    costVarianceMovement: 0,
  };

  test('CostCodeSchema accepts a valid cost code', () => {
    expect(() => CostCodeSchema.parse(validCostCode)).not.toThrow();
  });

  test('CostCodeSchema throws when a required field is missing', () => {
    const { baselineBudget, ...missingBudget } = validCostCode;
    expect(() => CostCodeSchema.parse(missingBudget)).toThrow();
  });

  test('ActualCostRecordSchema accepts a valid record', () => {
    expect(() =>
      ActualCostRecordSchema.parse({
        id: 'ac1',
        projectId: 'proj1',
        costCodeId: 'cc1',
        item: 'Invoice 123',
        description: 'Concrete delivery',
        source: 'MAN',
        cost: 5000,
        reportingPeriodId: 'p1',
        createdAt: '2026-01-01T00:00:00.000Z',
      })
    ).not.toThrow();
  });

  test('BaselineBudgetRecordSchema accepts a valid record', () => {
    expect(() =>
      BaselineBudgetRecordSchema.parse({
        id: 'bb1',
        projectId: 'proj1',
        costCodeId: 'cc1',
        item: 'Estimate line',
        description: 'Concrete budget',
        source: 'EST',
        amount: 10000,
        reportingPeriodId: 'p1',
        createdAt: '2026-01-01T00:00:00.000Z',
      })
    ).not.toThrow();
  });

  test('CostPhasingRecordSchema accepts a valid record', () => {
    expect(() =>
      CostPhasingRecordSchema.parse({
        id: 'cp1',
        projectId: 'proj1',
        costCodeId: 'cc1',
        periodValues: { '2026-01': 1000 },
        type: 'baseline',
        createdAt: '2026-01-01T00:00:00.000Z',
      })
    ).not.toThrow();
  });

  test('EtcDetailSchema accepts a valid detail', () => {
    expect(() =>
      EtcDetailSchema.parse({
        id: 'etc1',
        projectId: 'proj1',
        costCode: 'CC-01',
        item: 'Formwork',
        description: 'Formwork labour',
        orderNumber: 'PO-1',
        udf1: '',
        udf2: '',
        udf3: '',
        udf4: '',
        qty: 100,
        unit: 'm2',
        rate: 50,
        phasingMethod: 'Manual',
        phasingStartDate: '2026-01-01',
        phasingEndDate: '2026-03-01',
        phasingUnit: 'Daily',
        phasingQty: 100,
        periodValues: { '2026-01': 20 },
        sortOrder: 1,
        createdAt: '2026-01-01T00:00:00.000Z',
      })
    ).not.toThrow();
  });

  test('PeriodSnapshotSchema accepts a valid snapshot', () => {
    expect(() =>
      PeriodSnapshotSchema.parse({
        id: 'ps1',
        projectId: 'proj1',
        periodId: 'p1',
        periodName: 'January 2026',
        costCodes: [
          {
            costCodeId: 'cc1',
            costCode: 'CC-01',
            name: 'Concrete',
            approvedBudget: 10000,
            actualCostToDate: 1000,
            estimateToComplete: 9000,
            estimateAtCompletion: 10000,
            costVariance: 0,
          },
        ],
        createdAt: '2026-01-01T00:00:00.000Z',
      })
    ).not.toThrow();
  });
});

describe('subcontract schemas', () => {
  test('SubcontractLineItemSchema accepts a valid line item', () => {
    expect(() =>
      SubcontractLineItemSchema.parse({
        id: 'sli1',
        subcontractId: 'sub1',
        projectId: 'proj1',
        itemNo: '1.0',
        description: 'Mobilisation',
        qty: 1,
        unit: 'LS',
        rate: 5000,
        total: 5000,
        type: 'Original',
        status: 'Approved',
        enterpriseAttributes: {},
        projectAttributes: {},
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      })
    ).not.toThrow();
  });

  test('SubcontractSchema accepts a valid subcontract with line items', () => {
    expect(() =>
      SubcontractSchema.parse({
        id: 'sub1',
        projectId: 'proj1',
        enterpriseId: 'ent1',
        orderId: 'SC-001',
        orderName: 'Concrete package',
        orderScope: 'Supply and install concrete works',
        status: 'Active',
        paymentType: 'LumpSum',
        awardDate: '2026-01-01',
        vendorId: 'ven1',
        vendorName: 'Acme Co',
        vendorUsers: ['user1@example.com'],
        totalAmount: 100000,
        lineItems: [
          {
            id: 'sli1',
            subcontractId: 'sub1',
            projectId: 'proj1',
            itemNo: '1.0',
            description: 'Mobilisation',
            qty: 1,
            unit: 'LS',
            rate: 5000,
            total: 5000,
            type: 'Original',
            status: 'Approved',
            enterpriseAttributes: {},
            projectAttributes: {},
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      })
    ).not.toThrow();
  });

  test('InvoiceItemSchema accepts a valid item', () => {
    expect(() =>
      InvoiceItemSchema.parse({
        id: 'ii1',
        subcontractLineItemId: 'sli1',
        itemNo: '1.0',
        description: 'Mobilisation',
        qty: 1,
        unit: 'LS',
        rate: 5000,
        total: 5000,
        claimQty: 1,
        claimPercent: 100,
        claimValue: 5000,
        certifiedQty: 1,
        certifiedPercent: 100,
        certifiedValue: 5000,
      })
    ).not.toThrow();
  });

  test('InvoiceSchema accepts a valid invoice with items', () => {
    expect(() =>
      InvoiceSchema.parse({
        id: 'inv1',
        subcontractId: 'sub1',
        projectId: 'proj1',
        enterpriseId: 'ent1',
        invoiceId: 'INV-001',
        description: 'January progress claim',
        status: 'Draft',
        vendorId: 'ven1',
        vendorName: 'Acme Co',
        totalAmount: 5000,
        certifiedAmount: 5000,
        items: [
          {
            id: 'ii1',
            subcontractLineItemId: 'sli1',
            itemNo: '1.0',
            description: 'Mobilisation',
            qty: 1,
            unit: 'LS',
            rate: 5000,
            total: 5000,
            claimQty: 1,
            claimPercent: 100,
            claimValue: 5000,
            certifiedQty: 1,
            certifiedPercent: 100,
            certifiedValue: 5000,
          },
        ],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      })
    ).not.toThrow();
  });
});

describe('risk schemas', () => {
  const validRisk = {
    id: 'risk1',
    projectId: 'proj1',
    riskId: 'R-001',
    description: 'Weather delay',
    type: 'Schedule',
    status: 'Open',
    strategy: 'Mitigate',
    initiator: 'uid1',
    reference: 'REF-1',
    exposure: 5000,
    mitigation: 1000,
    residualExposure: 4000,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  test('RiskSchema accepts a valid risk', () => {
    expect(() => RiskSchema.parse(validRisk)).not.toThrow();
  });

  test('RiskSchema throws when a required field is missing', () => {
    const { exposure, ...missingExposure } = validRisk;
    expect(() => RiskSchema.parse(missingExposure)).toThrow();
  });

  const validRiskRecord = {
    id: 'rr1',
    riskId: 'risk1',
    projectId: 'proj1',
    costCodeId: 'cc1',
    scope: 'Foundations',
    enterpriseAttributes: {},
    projectAttributes: {},
    probability: 0.4,
    minImpactAmount: 1000,
    mostLikelyImpactAmount: 3000,
    maxImpactAmount: 6000,
    betaPertImpactAmount: 3166.67,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  test('RiskRecordSchema accepts a valid record', () => {
    expect(() => RiskRecordSchema.parse(validRiskRecord)).not.toThrow();
  });

  test('RiskRecordSchema throws when a required field is missing', () => {
    const { betaPertImpactAmount, ...missingImpact } = validRiskRecord;
    expect(() => RiskRecordSchema.parse(missingImpact)).toThrow();
  });
});

describe('change schemas', () => {
  const validChange = {
    id: 'chg1',
    projectId: 'proj1',
    changeId: 'CHG-001',
    description: 'Additional scope',
    type: 'Client Request',
    status: 'Approved',
    initiator: 'uid1',
    reference: 'REF-1',
    budget: 10000,
    eac: 10000,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  test('ChangeSchema accepts a valid change', () => {
    expect(() => ChangeSchema.parse(validChange)).not.toThrow();
  });

  test('ChangeSchema throws when a required field is missing', () => {
    const { budget, ...missingBudget } = validChange;
    expect(() => ChangeSchema.parse(missingBudget)).toThrow();
  });

  const validChangeRecord = {
    id: 'cr1',
    changeId: 'chg1',
    projectId: 'proj1',
    costCodeId: 'cc1',
    scope: 'Foundations',
    enterpriseAttributes: {},
    projectAttributes: {},
    budgetAmount: 10000,
    eacAmount: 10000,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  test('ChangeRecordSchema accepts a valid record', () => {
    expect(() => ChangeRecordSchema.parse(validChangeRecord)).not.toThrow();
  });

  test('ChangeRecordSchema throws when a required field is missing', () => {
    const { budgetAmount, ...missingAmount } = validChangeRecord;
    expect(() => ChangeRecordSchema.parse(missingAmount)).toThrow();
  });
});

describe('progress schemas', () => {
  test('RuleOfCreditStepSchema accepts a valid step', () => {
    expect(() =>
      RuleOfCreditStepSchema.parse({ id: 'step1', orderNo: 1, description: 'Design', weight: 20 })
    ).not.toThrow();
  });

  test('RuleOfCreditSchema accepts a valid rule with steps', () => {
    expect(() =>
      RuleOfCreditSchema.parse({
        id: 'roc1',
        projectId: 'proj1',
        ruleId: 'ROC-1',
        description: '3-step rule',
        steps: [{ id: 'step1', orderNo: 1, description: 'Design', weight: 20 }],
        createdAt: '2026-01-01T00:00:00.000Z',
      })
    ).not.toThrow();
  });

  test('ProgressPackageSchema accepts a valid package', () => {
    expect(() =>
      ProgressPackageSchema.parse({
        id: 'pkg1',
        projectId: 'proj1',
        packageId: 'PKG-001',
        description: 'Level 1 slab',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      })
    ).not.toThrow();
  });

  test('ProgressItemSchema accepts a valid item', () => {
    expect(() =>
      ProgressItemSchema.parse({
        id: 'pi1',
        projectId: 'proj1',
        packageId: 'PKG-001',
        packageDocId: 'pkg1',
        itemId: 'ITEM-1',
        description: 'Pour slab',
        costCodeId: 'cc1',
        totalQty: 100,
        plannedStartDate: '2026-01-01',
        plannedEndDate: '2026-01-15',
        phasingMethod: 'Auto',
        phasingCurve: 'Scurve',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      })
    ).not.toThrow();
  });

  test('ProgressReportingPeriodSchema accepts a valid period', () => {
    expect(() =>
      ProgressReportingPeriodSchema.parse({
        id: 'prp1',
        projectId: 'proj1',
        periodName: 'January 2026',
        startDate: '2026-01-01',
        endDate: '2026-01-31',
        status: 'Open',
        createdAt: '2026-01-01T00:00:00.000Z',
      })
    ).not.toThrow();
  });

  test('ProgressAttributeSchema accepts a valid attribute', () => {
    expect(() =>
      ProgressAttributeSchema.parse({
        id: 'pa1',
        projectId: 'proj1',
        title: 'Zone',
        type: 'text',
      })
    ).not.toThrow();
  });
});

describe('procurement schemas', () => {
  test('ProcurementStepDefinitionSchema accepts a valid definition', () => {
    expect(() =>
      ProcurementStepDefinitionSchema.parse({ id: 'psd1', name: 'RFQ Issued', order: 1 })
    ).not.toThrow();
  });

  test('ProcurementStepDataSchema accepts an empty step (all fields optional)', () => {
    expect(() => ProcurementStepDataSchema.parse({})).not.toThrow();
  });

  test('ProcurementStepDataSchema accepts a fully populated step', () => {
    expect(() =>
      ProcurementStepDataSchema.parse({
        plannedDate: '2026-01-01',
        actualDate: '2026-01-02',
        forecastDate: '2026-01-03',
        planDuration: 5,
        forecastDuration: 6,
      })
    ).not.toThrow();
  });

  test('ProcurementItemSchema accepts a valid item', () => {
    expect(() =>
      ProcurementItemSchema.parse({
        id: 'pi1',
        projectId: 'proj1',
        packageId: 'PKG-001',
        description: 'Structural steel',
        stepData: { psd1: { plannedDate: '2026-01-01' } },
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      })
    ).not.toThrow();
  });

  test('CalendarSchema accepts a valid calendar', () => {
    expect(() =>
      CalendarSchema.parse({
        id: 'cal1',
        name: 'Standard Calendar',
        weekends: [0, 6],
        holidays: ['2026-12-25'],
        createdAt: '2026-01-01T00:00:00.000Z',
      })
    ).not.toThrow();
  });

  test('ScheduleItemSchema accepts a valid schedule item', () => {
    expect(() =>
      ScheduleItemSchema.parse({
        id: 'si1',
        projectId: 'proj1',
        activityId: 'A1000',
        description: 'Excavation',
        activityPercentComplete: 50,
        baselineStartDate: '2026-01-01',
        baselineEndDate: '2026-01-15',
        plannedStartDate: '2026-01-01',
        plannedEndDate: '2026-01-15',
        currentStartDate: '2026-01-01',
        currentEndDate: '2026-01-16',
        updatedAt: '2026-01-01T00:00:00.000Z',
      })
    ).not.toThrow();
  });
});
