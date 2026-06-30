import { MemoryStore, makeId, now } from './store';
import type { AuthUser } from '../ports/auth.port';
import type {
  Enterprise, Project,
  CostCode, EtcDetail, ActualCostRecord, BaselineBudgetRecord, CostPhasingRecord,
  Change, ChangeRecord,
  RiskRecord,
  Subcontract, Invoice,
  ProgressPackage, ProgressItem, RuleOfCredit,
  ScheduleItem, Calendar,
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
}

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
}

// ── Risk ──────────────────────────────────────────────────────────────────────

const riskRecordStore = new MemoryStore<RiskRecord>();

export class MemoryRiskAdapter {
  subscribeRiskRecords(pid: string, cb: (r: RiskRecord[]) => void) {
    return riskRecordStore.subscribe(rows => cb(rows.filter(r => r.projectId === pid)));
  }

  async createRiskRecord(data: Omit<RiskRecord, 'id'>) {
    const id = makeId();
    const r = { ...data, id, createdAt: now() } as RiskRecord;
    riskRecordStore.set(id, r);
    return r;
  }

  async updateRiskRecord(id: string, data: Partial<RiskRecord>) { riskRecordStore.update(id, data); }
  async deleteRiskRecord(id: string) { riskRecordStore.delete(id); }
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

  async updateInvoice(id: string, data: Partial<Invoice>) { invoiceStore.update(id, data); }
  async deleteInvoice(id: string) { invoiceStore.delete(id); }
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

export class MemoryProcurementAdapter {
  subscribe(_pid: string, cb: (d: any[]) => void) { cb([]); return () => {}; }
  async create(data: any) { return { ...data, id: makeId(), createdAt: now() }; }
  async update(_id: string, _data: any) {}
  async delete(_id: string) {}
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

  subscribeCalendars(pid: string, cb: (c: Calendar[]) => void) {
    return calendarStore.subscribe(rows => cb(rows.filter(r => r.projectId === pid)));
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
