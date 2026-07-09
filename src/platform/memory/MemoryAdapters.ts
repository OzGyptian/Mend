import { MemoryStore, makeId, now } from './store';
import type { AuthUser } from '../ports/auth.port';
import type { UserRoleRepository } from '../ports/userRole.port';
import type { UserRoles, EnterpriseRole, ProjectRole, EnterpriseMembership } from '../../domain/roles';
import type {
  Enterprise, Project,
  CostCode, Sheet, ForecastRow, EtcDetail, ActualCostRecord, BaselineBudgetRecord, CostPhasingRecord,
  Change, ChangeRecord,
  Risk, RiskRecord,
  Subcontract, Invoice,
  ProgressPackage, ProgressItem, RuleOfCredit,
  ScheduleItem, Calendar,
  ProcurementItem, ProcurementStepDefinition,
  SavedView,
} from '../../domain/types';

// ── Auth ─────────────────────────────────────────────────────────────────────

export class MemoryAuthAdapter {
  private current: AuthUser | null = {
    id: 'memory-user',
    email: 'dev@memory.local',
    displayName: 'Memory User',
    emailVerified: true,
    avatarUrl: null,
  };
  private listeners = new Set<(u: AuthUser | null) => void>();

  getCurrentUser() { return this.current; }

  subscribeToAuth(cb: (u: AuthUser | null) => void) {
    this.listeners.add(cb);
    cb(this.current);
    return () => this.listeners.delete(cb);
  }

  async signInWithOAuth() { return this.current!; }
  async signInWithCredentials(_e: string, _p: string) { return this.current!; }
  async registerWithCredentials(_e: string, _p: string) { return this.current!; }
  async signOut() { this.current = null; this.listeners.forEach(l => l(null)); }
  async sendVerificationEmail() {}
  async updateDisplayName(name: string) {
    if (this.current) { this.current = { ...this.current, displayName: name }; this.listeners.forEach(l => l(this.current)); }
  }
  async sendPasswordReset(_email: string) {}
  async updatePassword(_currentPassword: string, _newPassword: string) {}
  getLinkedProviders(): string[] { return ['password']; }
  async linkEmailPassword(_newPassword: string) {}
}

// ── Enterprise ───────────────────────────────────────────────────────────────

const enterpriseStore = new MemoryStore<Enterprise>();

export class MemoryEnterpriseAdapter {
  private seed() {
    if (enterpriseStore.list().length === 0) {
      const id = 'demo-enterprise';
      enterpriseStore.set(id, { id, name: 'Demo Enterprise', adminUsers: ['memory-user'], users: { 'memory-user': { name: 'Memory User', role: 'Enterprise System Admin' } }, settings: {}, createdAt: now() } as any);
    }
  }

  subscribe(eid: string, cb: (e: Enterprise | null) => void) {
    this.seed();
    return enterpriseStore.subscribe(rows => cb(rows.find(r => r.id === eid) ?? null));
  }

  subscribeAll(cb: (e: Enterprise[]) => void) { this.seed(); return enterpriseStore.subscribe(cb); }
  subscribeByAdmin(_email: string, cb: (e: Enterprise[]) => void) { this.seed(); return enterpriseStore.subscribe(cb); }
  subscribeByUserId(_uid: string, cb: (e: Enterprise[]) => void) { this.seed(); return enterpriseStore.subscribe(cb); }
  subscribeById(eid: string, cb: (e: Enterprise | null) => void) { this.seed(); return enterpriseStore.subscribe(rows => cb(rows.find(r => r.id === eid) ?? null)); }

  async get(id: string) { return enterpriseStore.get(id) ?? null; }

  async create(data: Omit<Enterprise, 'id'>) {
    const id = makeId();
    const ent = { ...data, id, createdAt: now() } as Enterprise;
    enterpriseStore.set(id, ent);
    return ent;
  }

  async update(id: string, data: Partial<Enterprise>) { enterpriseStore.update(id, data); }
  async delete(id: string) { enterpriseStore.delete(id); }

  async bootstrapIfEmpty(userId: string, name: string, role: string) {
    if (enterpriseStore.list().length === 0) {
      await this.create({ name, adminUsers: [userId], users: { [userId]: { name, role } }, settings: {} } as any);
    }
  }

  async acceptInvitation() { return null; }

  subscribeProjects(_eid: string, _email: string, _cb: any) { return () => {}; }
  subscribeUsers(_eid: string, _cb: any) { return () => {}; }
  deleteProjectWithSheets(_pid: string) { return Promise.resolve(); }
  checkProjectCodeExists(_eid: string, _code: string) { return Promise.resolve(false); }
}

// ── Project ───────────────────────────────────────────────────────────────────

const projectStore = new MemoryStore<Project>();

export class MemoryProjectAdapter {
  subscribe(id: string, cb: (p: Project | null) => void) {
    return projectStore.subscribe(rows => cb(rows.find(r => r.id === id) ?? null));
  }

  subscribeByEnterprise(eid: string, _email: string, cb: (p: Project[]) => void) {
    return projectStore.subscribe(rows => cb(rows.filter(r => r.enterpriseId === eid)));
  }

  async listByEnterprise(eid: string) { return projectStore.list(r => r.enterpriseId === eid); }

  async create(data: Omit<Project, 'id'>) {
    const id = makeId();
    const proj = { ...data, id, createdAt: now() } as Project;
    projectStore.set(id, proj);
    return proj;
  }

  async update(id: string, data: Partial<Project>) { projectStore.update(id, data); return projectStore.get(id) ?? null as any; }
  async delete(id: string) { projectStore.delete(id); }
  async get(id: string) { return projectStore.get(id) ?? null; }
  async getAll() { return projectStore.list(); }

  checkProjectCodeExists(_eid: string, _code: string) { return Promise.resolve(false); }
  deleteProjectWithSheets(id: string) { projectStore.delete(id); return Promise.resolve(); }

  subscribeSheet(sheetId: string, cb: (s: any) => void) {
    cb(null);
    return () => {};
  }

  async createSheet(data: Record<string, unknown>) { const id = makeId(); return { id }; }
  async createSheetRow(_sheetId: string, _data: Record<string, unknown>) {}
  async findSheetsByName(_pid: string, _name: string) { return []; }
}

// ── Cost ──────────────────────────────────────────────────────────────────────

const costCodeStore = new MemoryStore<CostCode>();
const etcStore = new MemoryStore<EtcDetail>();
const actualStore = new MemoryStore<ActualCostRecord>();
const baselineStore = new MemoryStore<BaselineBudgetRecord>();
const phasingStore = new MemoryStore<CostPhasingRecord>();

export class MemoryCostAdapter {
  subscribeCostCodes(pid: string, cb: (c: CostCode[]) => void) {
    return costCodeStore.subscribe(rows => cb(rows.filter(r => r.projectId === pid)));
  }

  subscribeCostCodesByProjectIds(ids: string[], cb: (c: CostCode[]) => void) {
    return costCodeStore.subscribe(rows => cb(rows.filter(r => ids.includes(r.projectId))));
  }

  async createCostCode(data: Omit<CostCode, 'id'>) {
    const id = makeId();
    const cc = { ...data, id, createdAt: now() } as CostCode;
    costCodeStore.set(id, cc);
    return cc;
  }

  async updateCostCode(id: string, data: Partial<CostCode>) { costCodeStore.update(id, data); }
  async updateManyCostCodes(updates: Array<{ id: string; data: Partial<CostCode> }>) { updates.forEach(u => costCodeStore.update(u.id, u.data)); }
  async deleteCostCode(id: string) { costCodeStore.delete(id); }

  subscribeEtcDetails(pid: string, cb: (e: EtcDetail[]) => void) {
    return etcStore.subscribe(rows => cb(rows.filter(r => r.projectId === pid)));
  }

  async createEtcDetail(data: Omit<EtcDetail, 'id' | 'createdAt'>) {
    const id = makeId();
    const row = { ...data, id, createdAt: now() } as EtcDetail;
    etcStore.set(id, row);
    return row;
  }

  async createManyEtcDetails(data: Array<Omit<EtcDetail, 'id' | 'createdAt'>>) {
    data.forEach(d => { const id = makeId(); etcStore.set(id, { ...d, id, createdAt: now() } as any); });
  }

  async updateEtcDetail(id: string, data: Partial<EtcDetail>) { etcStore.update(id, data); }
  async updateManyEtcDetails(updates: Array<{ id: string; data: any }>) { updates.forEach(u => etcStore.update(u.id, u.data)); }
  async deleteEtcDetail(id: string) { etcStore.delete(id); }
  async deleteManyEtcDetails(ids: string[]) { ids.forEach(id => etcStore.delete(id)); }
  async listEtcDetails(pid: string) { return etcStore.list(r => r.projectId === pid); }

  subscribeActualCosts(pid: string, cb: (a: ActualCostRecord[]) => void) {
    return actualStore.subscribe(rows => cb(rows.filter(r => r.projectId === pid)));
  }

  async createActualCost(data: any) { const id = makeId(); const r = { ...data, id, createdAt: now() } as any; actualStore.set(id, r); return r; }
  async updateActualCost(id: string, data: any) { actualStore.update(id, data); }
  async deleteManyActualCosts(ids: string[]) { ids.forEach(id => actualStore.delete(id)); }
  async listActualCosts(pid: string) { return actualStore.list(r => r.projectId === pid); }

  subscribeBaselineBudgets(pid: string, cb: (b: BaselineBudgetRecord[]) => void) {
    return baselineStore.subscribe(rows => cb(rows.filter(r => r.projectId === pid)));
  }

  async createBaselineBudget(data: any) { const id = makeId(); const r = { ...data, id, createdAt: now() } as any; baselineStore.set(id, r); return r; }
  async updateBaselineBudget(id: string, data: any) { baselineStore.update(id, data); }
  async listBaselineBudgets(pid: string) { return baselineStore.list(r => r.projectId === pid); }

  subscribeCostPhasing(pid: string, costCodeId: string, cb: (p: any[]) => void) {
    return phasingStore.subscribe(rows => cb(rows.filter(r => r.projectId === pid && (r as any).costCodeId === costCodeId)));
  }

  async saveCostPhasing(records: any[]) { records.forEach(r => { const id = makeId(); phasingStore.set(id, { ...r, id, createdAt: now() }); }); }
  async updateCostPhasing(id: string, data: any) { phasingStore.update(id, data); }

  async listAllCostPhasing(pid: string) { return phasingStore.list(r => r.projectId === pid); }

  async updateManyPhasing(updates: Array<{ id: string; data: any }>) { updates.forEach(u => phasingStore.update(u.id, u.data)); }

  async getCostCode(id: string) { return costCodeStore.get(id) ?? null; }
  async listCostCodes(pid: string) { return costCodeStore.list(r => r.projectId === pid); }

  // ── Sheets ──
  subscribeSheets(pid: string, cb: (s: Sheet[]) => void) {
    return sheetStore.subscribe(rows => cb(rows.filter(r => r.projectId === pid)));
  }
  async getSheet(id: string) { return sheetStore.get(id) ?? null; }
  async createSheet(data: Omit<Sheet, 'id' | 'createdAt' | 'updatedAt'>) {
    const id = makeId(); const s = { ...data, id, createdAt: now(), updatedAt: now() } as Sheet;
    sheetStore.set(id, s); return s;
  }
  async updateSheet(id: string, data: Partial<Sheet>) { sheetStore.update(id, { ...data, updatedAt: now() }); }
  async deleteSheet(id: string) { sheetStore.delete(id); }

  // ── Forecast rows ──
  subscribeForecastRows(sheetId: string, cb: (rows: ForecastRow[]) => void) {
    return forecastRowStore.subscribe(rows => cb(rows.filter(r => r.sheetId === sheetId)));
  }
  async listForecastRows(sheetId: string) { return forecastRowStore.list(r => r.sheetId === sheetId); }
  async createForecastRow(data: Omit<ForecastRow, 'id'>) {
    const id = makeId(); const r = { ...data, id } as ForecastRow; forecastRowStore.set(id, r); return r;
  }
  async createManyForecastRows(rows: Array<Omit<ForecastRow, 'id'>>) {
    rows.forEach(row => { const id = makeId(); forecastRowStore.set(id, { ...row, id } as ForecastRow); });
  }
  async updateForecastRow(_sheetId: string, rowId: string, data: Partial<ForecastRow>) { forecastRowStore.update(rowId, data); }
  async deleteForecastRow(_sheetId: string, rowId: string) { forecastRowStore.delete(rowId); }
  async updateManyForecastRows(_sheetId: string, updates: Array<{ id: string; data: Partial<ForecastRow> }>) {
    updates.forEach(u => forecastRowStore.update(u.id, u.data));
  }
  async deleteManyForecastRows(_sheetId: string, rowIds: string[]) { rowIds.forEach(id => forecastRowStore.delete(id)); }

  // ── Actuals / baseline extras ──
  async saveManyActualCosts(records: Array<Omit<ActualCostRecord, 'id' | 'createdAt'>>) {
    records.forEach(rec => { const id = makeId(); actualStore.set(id, { ...rec, id, createdAt: now() } as ActualCostRecord); });
  }
  async deleteActualCost(id: string) { actualStore.delete(id); }
  async updateManyActualCosts(updates: Array<{ id: string; data: Partial<ActualCostRecord> }>) {
    updates.forEach(u => actualStore.update(u.id, u.data));
  }
  async deleteBaselineBudget(id: string) { baselineStore.delete(id); }
  async updateManyBaselineBudgets(updates: Array<{ id: string; data: Partial<BaselineBudgetRecord> }>) {
    updates.forEach(u => baselineStore.update(u.id, u.data));
  }
  async listCostPhasing(pid: string, costCodeId?: string) {
    return phasingStore.list(r => r.projectId === pid && (!costCodeId || (r as any).costCodeId === costCodeId));
  }
}

const sheetStore = new MemoryStore<Sheet>();
const forecastRowStore = new MemoryStore<ForecastRow>();

// ── Change ────────────────────────────────────────────────────────────────────

const changeStore = new MemoryStore<Change>();
const changeRecordStore = new MemoryStore<ChangeRecord>();

export class MemoryChangeAdapter {
  subscribeChanges(pid: string, cb: (c: Change[]) => void) {
    return changeStore.subscribe(rows => cb(rows.filter(r => r.projectId === pid)));
  }

  async listChanges(pid: string) { return changeStore.list(r => r.projectId === pid); }
  async getChange(id: string) { return changeStore.get(id) ?? null; }

  async createChange(data: Omit<Change, 'id'>) {
    const id = makeId();
    const c = { ...data, id, createdAt: now() } as Change;
    changeStore.set(id, c);
    return c;
  }

  async updateChange(id: string, data: Partial<Change>) { changeStore.update(id, data); }
  async updateManyChanges(updates: Array<{ id: string; data: Partial<Change> }>) { updates.forEach(u => changeStore.update(u.id, u.data)); }
  async deleteChange(id: string) { changeStore.delete(id); }

  subscribeChangeRecords(pid: string, cb: (r: ChangeRecord[]) => void) {
    return changeRecordStore.subscribe(rows => cb(rows.filter(r => r.projectId === pid)));
  }

  async listChangeRecords(pid: string, changeId?: string) {
    return changeRecordStore.list(r => r.projectId === pid && (!changeId || r.changeId === changeId));
  }

  async createChangeRecord(data: Omit<ChangeRecord, 'id'>) {
    const id = makeId();
    const r = { ...data, id, createdAt: now() } as ChangeRecord;
    changeRecordStore.set(id, r);
    return r;
  }

  async updateChangeRecord(id: string, data: Partial<ChangeRecord>) { changeRecordStore.update(id, data); }
  async deleteChangeRecord(id: string) { changeRecordStore.delete(id); }
  async deleteManyChangeRecords(ids: string[]) { ids.forEach(id => changeRecordStore.delete(id)); }
}

// ── Risk ──────────────────────────────────────────────────────────────────────

const riskStore = new MemoryStore<Risk>();
const riskRecordStore = new MemoryStore<RiskRecord>();

export class MemoryRiskAdapter {
  subscribeRisks(pid: string, cb: (r: Risk[]) => void) {
    return riskStore.subscribe(rows => cb(rows.filter(r => r.projectId === pid)));
  }

  async listRisks(pid: string): Promise<Risk[]> {
    return riskStore.list(r => r.projectId === pid);
  }

  async createRisk(data: Omit<Risk, 'id'>) {
    const id = makeId();
    const r = { ...data, id, createdAt: now() } as Risk;
    riskStore.set(id, r);
    return r;
  }

  async createManyRisks(items: Omit<Risk, 'id'>[]) {
    return items.map(data => {
      const id = makeId();
      const r = { ...data, id, createdAt: now() } as Risk;
      riskStore.set(id, r);
      return r;
    });
  }

  async updateRisk(id: string, data: Partial<Risk>) { riskStore.update(id, data); }

  async updateManyRisks(updates: { id: string; data: Partial<Risk> }[]) {
    updates.forEach(u => riskStore.update(u.id, u.data));
  }

  async deleteRisk(id: string) { riskStore.delete(id); }

  async deleteManyRisks(ids: string[]) { ids.forEach(id => riskStore.delete(id)); }

  subscribeRiskRecords(pid: string, cb: (r: RiskRecord[]) => void) {
    return riskRecordStore.subscribe(rows => cb(rows.filter(r => r.projectId === pid)));
  }

  async listRiskRecords(pid: string, riskId?: string): Promise<RiskRecord[]> {
    return riskRecordStore.list(r => r.projectId === pid && (!riskId || r.riskId === riskId));
  }

  async createRiskRecord(data: Omit<RiskRecord, 'id'>) {
    const id = makeId();
    const r = { ...data, id, createdAt: now() } as RiskRecord;
    riskRecordStore.set(id, r);
    return r;
  }

  async createManyRiskRecords(items: Omit<RiskRecord, 'id'>[]) {
    return items.map(data => {
      const id = makeId();
      const r = { ...data, id, createdAt: now() } as RiskRecord;
      riskRecordStore.set(id, r);
      return r;
    });
  }

  async updateRiskRecord(id: string, data: Partial<RiskRecord>) { riskRecordStore.update(id, data); }

  async updateManyRiskRecords(updates: { id: string; data: Partial<RiskRecord> }[]) {
    updates.forEach(u => riskRecordStore.update(u.id, u.data));
  }

  async deleteRiskRecord(id: string) { riskRecordStore.delete(id); }

  async deleteManyRiskRecords(ids: string[]) { ids.forEach(id => riskRecordStore.delete(id)); }
}

// ── Subcontract ───────────────────────────────────────────────────────────────

const subcontractStore = new MemoryStore<Subcontract>();
const invoiceStore = new MemoryStore<Invoice>();

export class MemorySubcontractAdapter {
  subscribeSubcontracts(pid: string, cb: (s: Subcontract[]) => void) {
    return subcontractStore.subscribe(rows => cb(rows.filter(r => r.projectId === pid)));
  }

  subscribeInvoices(pid: string, cb: (i: Invoice[]) => void) {
    return invoiceStore.subscribe(rows => cb(rows.filter(r => r.projectId === pid)));
  }

  async listSubcontracts(pid: string) { return subcontractStore.list(r => r.projectId === pid); }

  async createSubcontract(data: Omit<Subcontract, 'id'>) {
    const id = makeId();
    const s = { ...data, id, createdAt: now() } as Subcontract;
    subcontractStore.set(id, s);
    return s;
  }

  async updateSubcontract(id: string, data: Partial<Subcontract>) { subcontractStore.update(id, data); }
  async deleteSubcontract(id: string) { subcontractStore.delete(id); }

  async createInvoice(data: Omit<Invoice, 'id'>) {
    const id = makeId();
    const inv = { ...data, id, createdAt: now() } as Invoice;
    invoiceStore.set(id, inv);
    return inv;
  }

  async getInvoice(id: string) { return invoiceStore.get(id) ?? null; }
  async listInvoices(pid: string, subcontractId?: string) {
    return invoiceStore.list(r => r.projectId === pid && (!subcontractId || r.subcontractId === subcontractId));
  }
  async updateInvoice(id: string, data: Partial<Invoice>) { invoiceStore.update(id, data); }
  async updateManyInvoices(updates: Array<{ id: string; data: Partial<Invoice> }>) {
    updates.forEach(u => invoiceStore.update(u.id, u.data));
  }
  async deleteInvoice(id: string) { invoiceStore.delete(id); }
  async deleteManyInvoices(ids: string[]) { ids.forEach(id => invoiceStore.delete(id)); }
  async createManyInvoices(invoices: Array<Omit<Invoice, 'id'>>) {
    return invoices.map(data => {
      const id = makeId();
      const inv = { ...data, id, createdAt: now() } as Invoice;
      invoiceStore.set(id, inv);
      return inv;
    });
  }
}

// ── Progress ──────────────────────────────────────────────────────────────────

const progressPackageStore = new MemoryStore<ProgressPackage>();
const progressItemStore = new MemoryStore<ProgressItem>();
const rocStore = new MemoryStore<RuleOfCredit>();

export class MemoryProgressAdapter {
  subscribeProgressPackages(pid: string, cb: (p: ProgressPackage[]) => void) {
    return progressPackageStore.subscribe(rows => cb(rows.filter(r => r.projectId === pid)));
  }

  async createProgressPackage(data: Omit<ProgressPackage, 'id'>) {
    const id = makeId();
    const p = { ...data, id, createdAt: now() } as ProgressPackage;
    progressPackageStore.set(id, p);
    return p;
  }

  async updateProgressPackage(id: string, data: Partial<ProgressPackage>) { progressPackageStore.update(id, data); }
  async updateManyProgressPackages(updates: Array<{ id: string; data: Partial<ProgressPackage> }>) { updates.forEach(u => progressPackageStore.update(u.id, u.data)); }
  async deleteProgressPackage(id: string) { progressPackageStore.delete(id); }

  subscribeProgressItems(pid: string, cb: (i: ProgressItem[]) => void) {
    return progressItemStore.subscribe(rows => cb(rows.filter(r => r.projectId === pid)));
  }

  async createProgressItem(data: Omit<ProgressItem, 'id'>) {
    const id = makeId();
    const item = { ...data, id, createdAt: now() } as ProgressItem;
    progressItemStore.set(id, item);
    return item;
  }

  async updateProgressItem(id: string, data: Partial<ProgressItem>) { progressItemStore.update(id, data); }
  async updateManyProgressItems(updates: Array<{ id: string; data: Partial<ProgressItem> }>) { updates.forEach(u => progressItemStore.update(u.id, u.data)); }
  async deleteProgressItem(id: string) { progressItemStore.delete(id); }

  subscribeRulesOfCredit(pid: string, cb: (r: RuleOfCredit[]) => void) {
    return rocStore.subscribe(rows => cb(rows.filter(r => r.projectId === pid)));
  }

  async createRuleOfCredit(data: Omit<RuleOfCredit, 'id'>) {
    const id = makeId();
    const r = { ...data, id, createdAt: now() } as RuleOfCredit;
    rocStore.set(id, r);
    return r;
  }

  async updateRuleOfCredit(id: string, data: Partial<RuleOfCredit>) { rocStore.update(id, data); }
  async deleteRuleOfCredit(id: string) { rocStore.delete(id); }
}

// ── Procurement ───────────────────────────────────────────────────────────────

const procurementItemStore = new MemoryStore<ProcurementItem>();
const stepDefinitionStore = new MemoryStore<ProcurementStepDefinition>();

export class MemoryProcurementAdapter {
  subscribeProcurementItems(pid: string, cb: (d: ProcurementItem[]) => void) {
    return procurementItemStore.subscribe(rows => cb(rows.filter(r => r.projectId === pid)));
  }

  async createProcurementItem(data: Omit<ProcurementItem, 'id'>) {
    const id = makeId();
    const item = { ...data, id, createdAt: now() } as ProcurementItem;
    procurementItemStore.set(id, item);
    return item;
  }

  async createManyProcurementItems(items: Omit<ProcurementItem, 'id'>[]) {
    return items.map(data => {
      const id = makeId();
      const item = { ...data, id, createdAt: now() } as ProcurementItem;
      procurementItemStore.set(id, item);
      return item;
    });
  }

  async updateProcurementItem(id: string, data: Partial<ProcurementItem>) {
    procurementItemStore.update(id, data);
  }

  async updateManyProcurementItems(updates: { id: string; data: Partial<ProcurementItem> }[]) {
    updates.forEach(u => procurementItemStore.update(u.id, u.data));
  }

  async deleteManyProcurementItems(ids: string[]) { ids.forEach(id => procurementItemStore.delete(id)); }

  subscribeProjectStepDefinitions(pid: string, cb: (d: ProcurementStepDefinition[]) => void) {
    return stepDefinitionStore.subscribe(rows => cb(rows.filter(r => r.projectId === pid)));
  }

  subscribeEnterpriseStepDefinitions(eid: string, cb: (d: ProcurementStepDefinition[]) => void) {
    return stepDefinitionStore.subscribe(rows => cb(rows.filter(r => r.enterpriseId === eid)));
  }

  async createStepDefinition(data: Omit<ProcurementStepDefinition, 'id'>) {
    const id = makeId();
    const step = { ...data, id, createdAt: now() } as ProcurementStepDefinition;
    stepDefinitionStore.set(id, step);
    return step;
  }

  async updateStepDefinition(id: string, data: Partial<ProcurementStepDefinition>) {
    stepDefinitionStore.update(id, data);
  }

  async deleteStepDefinition(id: string) { stepDefinitionStore.delete(id); }
}

// ── Schedule ──────────────────────────────────────────────────────────────────

const scheduleItemStore = new MemoryStore<ScheduleItem>();
const calendarStore = new MemoryStore<Calendar>();

export class MemoryScheduleAdapter {
  subscribeScheduleItems(pid: string, cb: (s: ScheduleItem[]) => void) {
    return scheduleItemStore.subscribe(rows => cb(rows.filter(r => r.projectId === pid)));
  }

  async createScheduleItem(data: Omit<ScheduleItem, 'id'>) {
    const id = makeId();
    const s = { ...data, id, createdAt: now() } as ScheduleItem;
    scheduleItemStore.set(id, s);
    return s;
  }

  async updateScheduleItem(id: string, data: Partial<ScheduleItem>) { scheduleItemStore.update(id, data); }
  async deleteScheduleItem(id: string) { scheduleItemStore.delete(id); }

  subscribeProjectCalendars(pid: string, cb: (c: Calendar[]) => void) {
    return calendarStore.subscribe(rows => cb(rows.filter(r => r.projectId === pid)));
  }

  subscribeEnterpriseCalendars(enterpriseId: string, cb: (c: Calendar[]) => void) {
    return calendarStore.subscribe(rows => cb(rows.filter(r => r.enterpriseId === enterpriseId)));
  }

  async listEnterpriseCalendars(enterpriseId: string): Promise<Calendar[]> {
    return calendarStore.list(r => r.enterpriseId === enterpriseId);
  }

  getCalendar(id: string): Promise<Calendar | null> {
    return Promise.resolve(calendarStore.get(id) ?? null);
  }

  async createManyScheduleItems(items: Omit<ScheduleItem, 'id'>[]) {
    return items.map(data => {
      const id = makeId();
      const s = { ...data, id, createdAt: now() } as ScheduleItem;
      scheduleItemStore.set(id, s);
      return s;
    });
  }

  async updateManyScheduleItems(updates: { id: string; data: Partial<ScheduleItem> }[]) {
    updates.forEach(u => scheduleItemStore.update(u.id, u.data));
  }

  async createCalendar(data: Omit<Calendar, 'id'>) {
    const id = makeId();
    const c = { ...data, id, createdAt: now() } as Calendar;
    calendarStore.set(id, c);
    return c;
  }

  async updateCalendar(id: string, data: Partial<Calendar>) { calendarStore.update(id, data); }
  async deleteCalendar(id: string) { calendarStore.delete(id); }
}

// ── Utility ───────────────────────────────────────────────────────────────────

const savedViewStore = new MemoryStore<SavedView>();

export class MemoryUtilityAdapter {
  subscribeSavedViews(userId: string, module: string, cb: (v: SavedView[]) => void) {
    return savedViewStore.subscribe(rows => cb(rows.filter(r => r.userId === userId && r.tableId === module)));
  }

  async createSavedView(data: Omit<SavedView, 'id'>) {
    const id = makeId();
    const v = { ...data, id, createdAt: now() } as SavedView;
    savedViewStore.set(id, v);
    return v;
  }

  async updateSavedView(id: string, data: Partial<SavedView>) { savedViewStore.update(id, data); }
  async deleteSavedView(id: string) { savedViewStore.delete(id); }
  async createInvitation(_data: any) { return { id: makeId() }; }
}

const EMPTY_ROLES: UserRoles = { platformRole: null, memberships: [] };

export class MemoryUserRoleAdapter implements UserRoleRepository {
  private store = new Map<string, UserRoles>();

  async getUserRoles(uid: string): Promise<UserRoles> {
    return this.store.get(uid) ?? EMPTY_ROLES;
  }

  subscribeUserRoles(uid: string, callback: (roles: UserRoles) => void): () => void {
    callback(this.store.get(uid) ?? EMPTY_ROLES);
    return () => {};
  }

  async setEnterpriseRole(uid: string, enterpriseId: string, role: EnterpriseRole): Promise<void> {
    const current = this.store.get(uid) ?? EMPTY_ROLES;
    const existing = current.memberships.find(m => m.enterpriseId === enterpriseId);
    const memberships: EnterpriseMembership[] = existing
      ? current.memberships.map(m => m.enterpriseId === enterpriseId ? { ...m, role } : m)
      : [...current.memberships, { enterpriseId, role, projectRoles: {} }];
    this.store.set(uid, { ...current, memberships });
  }

  async setProjectRole(uid: string, enterpriseId: string, projectId: string, role: ProjectRole): Promise<void> {
    const current = this.store.get(uid) ?? EMPTY_ROLES;
    const membership = current.memberships.find(m => m.enterpriseId === enterpriseId);
    const memberships: EnterpriseMembership[] = membership
      ? current.memberships.map(m =>
          m.enterpriseId === enterpriseId
            ? { ...m, projectRoles: { ...m.projectRoles, [projectId]: role } }
            : m
        )
      : [...current.memberships, { enterpriseId, role: 'enterprise_member', projectRoles: { [projectId]: role } }];
    this.store.set(uid, { ...current, memberships });
  }

  async removeProjectRole(uid: string, enterpriseId: string, projectId: string): Promise<void> {
    const current = this.store.get(uid) ?? EMPTY_ROLES;
    const memberships: EnterpriseMembership[] = current.memberships.map(m => {
      if (m.enterpriseId !== enterpriseId) return m;
      const { [projectId]: _removed, ...rest } = m.projectRoles;
      return { ...m, projectRoles: rest };
    });
    this.store.set(uid, { ...current, memberships });
  }
}

// ── Deterministic demo fixtures (memory adapter only) ─────────────────────────
// Seeds one project under the auto-seeded `demo-enterprise`, with cost codes whose
// STORED derived values equal what their leaves (actuals / baseline budgets /
// approved change records) compute to. This keeps E2E characterization tests
// stable across the Phase 11.2 "compute-on-read" refactor: whether the UI shows
// the stored field or the recomputed value, the number is identical.
export function seedMemory(): void {
  if (projectStore.list(p => p.id === 'demo-project').length > 0) return;

  const iso = '2026-01-01T00:00:00.000Z';

  projectStore.set('demo-project', {
    id: 'demo-project',
    enterpriseId: 'demo-enterprise',
    projectName: 'Demo Tower',
    projectCode: 'DT-001',
    status: 'Active',
    projectBudget: 950000,
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    cutoffDate: '2026-06-30',
    users: { 'memory-user': 'Project Admin' },
    dateCreated: iso,
    dateLastModified: iso,
  } as Project);

  // CC-100 Substructure: baseline 500k + approved change 50k = approved 550k;
  //   actual 200k + ETC 300k = EAC 500k; variance = 550k - 500k = 50k
  // CC-200 Superstructure: baseline 400k + 0 = approved 400k;
  //   actual 100k + ETC 250k = EAC 350k; variance = 400k - 350k = 50k
  const costCodes: CostCode[] = [
    {
      id: 'cc-100', code: '100', projectId: 'demo-project', name: 'Substructure',
      enterpriseAttributes: {}, projectAttributes: {}, eacMethod: 'Manual', sortOrder: 1,
      baselineBudget: 500000, budgetChanges: 50000, approvedBudget: 550000,
      approvedBudgetPrevious: 500000, approvedBudgetMovement: 50000,
      actualCostThisPeriod: 200000, actualCostToDate: 200000,
      estimateToComplete: 300000, estimateAtCompletion: 500000,
      estimateAtCompletionPrevious: 500000, estimateAtCompletionMovement: 0,
      costVariance: 50000, costVariancePrevious: 0, costVarianceMovement: 50000,
    },
    {
      id: 'cc-200', code: '200', projectId: 'demo-project', name: 'Superstructure',
      enterpriseAttributes: {}, projectAttributes: {}, eacMethod: 'Manual', sortOrder: 2,
      baselineBudget: 400000, budgetChanges: 0, approvedBudget: 400000,
      approvedBudgetPrevious: 400000, approvedBudgetMovement: 0,
      actualCostThisPeriod: 100000, actualCostToDate: 100000,
      estimateToComplete: 250000, estimateAtCompletion: 350000,
      estimateAtCompletionPrevious: 350000, estimateAtCompletionMovement: 0,
      costVariance: 50000, costVariancePrevious: 0, costVarianceMovement: 50000,
    },
  ];
  costCodes.forEach(cc => costCodeStore.set(cc.id, cc));

  // Leaves consistent with the stored derived values above.
  baselineStore.set('bb-100', {
    id: 'bb-100', projectId: 'demo-project', costCodeId: 'cc-100', item: 'B100',
    description: 'Substructure baseline', source: 'EST', amount: 500000,
    reportingPeriodId: 'p1', createdAt: iso,
  } as BaselineBudgetRecord);
  baselineStore.set('bb-200', {
    id: 'bb-200', projectId: 'demo-project', costCodeId: 'cc-200', item: 'B200',
    description: 'Superstructure baseline', source: 'EST', amount: 400000,
    reportingPeriodId: 'p1', createdAt: iso,
  } as BaselineBudgetRecord);

  actualStore.set('ac-100', {
    id: 'ac-100', projectId: 'demo-project', costCodeId: 'cc-100', item: 'A100',
    description: 'Substructure actual', source: 'ACC', cost: 200000,
    reportingPeriodId: 'p1', createdAt: iso,
  } as ActualCostRecord);
  actualStore.set('ac-200', {
    id: 'ac-200', projectId: 'demo-project', costCodeId: 'cc-200', item: 'A200',
    description: 'Superstructure actual', source: 'ACC', cost: 100000,
    reportingPeriodId: 'p1', createdAt: iso,
  } as ActualCostRecord);

  changeStore.set('chg-1', {
    id: 'chg-1', projectId: 'demo-project', changeId: 'CH-001',
    description: 'Approved variation', type: 'Variation', status: 'Approved',
    initiator: 'PM', reference: 'REF-1', budget: 50000, eac: 50000,
    createdAt: iso, updatedAt: iso,
  } as Change);
  changeRecordStore.set('chr-1', {
    id: 'chr-1', changeId: 'chg-1', projectId: 'demo-project', costCodeId: 'cc-100',
    scope: 'Extra piling', enterpriseAttributes: {}, projectAttributes: {},
    budgetAmount: 50000, eacAmount: 50000, createdAt: iso, updatedAt: iso,
  } as ChangeRecord);
}

export function resetAllStores(): void {
  enterpriseStore.clear();
  projectStore.clear();
  costCodeStore.clear();
  etcStore.clear();
  actualStore.clear();
  baselineStore.clear();
  phasingStore.clear();
  sheetStore.clear();
  forecastRowStore.clear();
  changeStore.clear();
  changeRecordStore.clear();
  riskStore.clear();
  riskRecordStore.clear();
  subcontractStore.clear();
  invoiceStore.clear();
  progressPackageStore.clear();
  progressItemStore.clear();
  rocStore.clear();
  procurementItemStore.clear();
  stepDefinitionStore.clear();
  scheduleItemStore.clear();
  calendarStore.clear();
  savedViewStore.clear();
}
