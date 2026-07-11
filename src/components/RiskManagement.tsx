import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Project, Enterprise, Risk, RiskRecord, CostCode } from '../types';
import { useRiskRepo, useCostRepo } from '../platform/firestore/hooks';
import { 
  Search, 
  Plus, 
  Trash2, 
  Edit2, 
  Download, 
  Upload,
  Filter, 
  RefreshCw,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2,
  X,
  RefreshCcw,
  PlusCircle,
  Calculator,
  AlertTriangle,
  BarChart3,
  PieChart,
  TrendingUp,
  DollarSign,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  Database,
  Save,
  Layout,
  Columns,
  RotateCcw,
  History,
  Activity,
  Briefcase,
  ClipboardList,
  ShieldCheck,
  ShieldAlert
} from 'lucide-react';
import { AgGridReact } from 'ag-grid-react';
import { 
  ColDef, 
  ColGroupDef,
  GridApi, 
  GridReadyEvent, 
  CellValueChangedEvent,
  RowNode,
  ValueFormatterParams,
  SideBarDef,
  StatusPanelDef
} from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';
import 'ag-grid-enterprise';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { cn, formatCurrency } from '../lib/utils';
import { useRiskRollups } from '../lib/riskRollups';
import { betaPertExposure } from '../domain/risk';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell, 
  PieChart as RePie, 
  Pie,
  Legend,
  ComposedChart,
  Line
} from 'recharts';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { buildRiskColumnDefs, buildRiskRecordColumnDefs } from './risk-management/columns';
import RiskRecordsPanel from './risk-management/panels/RiskRecordsPanel';
import RiskFormDialog from './risk-management/panels/RiskFormDialog';


interface RiskManagementProps {
  project: Project;
  enterprise: Enterprise;
}

export default function RiskManagement({ project, enterprise }: RiskManagementProps) {
  const riskRepo = useRiskRepo();
  const costRepo = useCostRepo();
  const [risks, setRisks] = useState<Risk[]>([]);
  const [riskRecords, setRiskRecords] = useState<RiskRecord[]>([]);
  const [costCodes, setCostCodes] = useState<CostCode[]>([]);

  // Phase 13.B1.6: compute-on-read exposure/impact totals (SYSTEM_REVIEW.md v2 / PLAN.md F1).
  // Replaces the stored exposure/minImpactTotal/mostLikelyImpactTotal/maxImpactTotal fields and
  // the updateParentTotals() write-after-every-edit pattern (duplicated in BulkRiskRecords.tsx
  // too) — those fields are always live-computed from RiskRecord leaves now. None of these
  // columns were ever editable (see risk-management/columns.tsx), so this changes nothing about
  // what users can type into cells.
  const riskRollups = useRiskRollups(project.id, risks);
  const risksWithRollups = useMemo(
    () => risks.map((r) => ({ ...r, ...riskRollups.get(r.id) })),
    [risks, riskRollups],
  );
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRiskId, setSelectedRiskId] = useState<string | null>(null);
  const [quickFilterText, setQuickFilterText] = useState('');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedRecordIds, setSelectedRecordIds] = useState<Set<string>>(new Set());
  const [isChartsVisible, setIsChartsVisible] = useState(false);
  const [chartMetric, setChartMetric] = useState<'exposure' | 'mitigation' | 'residualExposure'>('exposure');
  const [isBulkRiskUpdateOpen, setIsBulkRiskUpdateOpen] = useState(false);
  const [isBulkRiskDeleteOpen, setIsBulkRiskDeleteOpen] = useState(false);
  const [isBulkRecordUpdateOpen, setIsBulkRecordUpdateOpen] = useState(false);
  const [isBulkRecordDeleteOpen, setIsBulkRecordDeleteOpen] = useState(false);
  const [bulkRiskUpdateData, setBulkRiskUpdateData] = useState({
    status: '',
    strategy: '',
    initiator: '',
    type: ''
  });

  const handleBulkUpdateRisks = async () => {
    if (selectedIds.size === 0) return;
    try {
      const updates: any = {};
      if (bulkRiskUpdateData.status) updates.status = bulkRiskUpdateData.status;
      if (bulkRiskUpdateData.strategy) updates.strategy = bulkRiskUpdateData.strategy;
      if (bulkRiskUpdateData.initiator) updates.initiator = bulkRiskUpdateData.initiator;
      if (bulkRiskUpdateData.type) updates.type = bulkRiskUpdateData.type;
      await riskRepo.updateManyRisks([...selectedIds].map(id => ({ id, data: updates })));
      toast.success("Risks Updated Successfully");
      setIsBulkRiskUpdateOpen(false);
      setSelectedIds(new Set());
    } catch (error) {
      console.error('Bulk risk update error:', error);
      toast.error('Failed to update risks.');
    }
  };

  const handleBulkDeleteRisks = async () => {
    if (selectedIds.size === 0) return;
    try {
      const riskIds = [...selectedIds];
      for (const riskId of riskIds) {
        const records = await riskRepo.listRiskRecords(project.id, riskId);
        await riskRepo.deleteManyRiskRecords(records.map(r => r.id));
      }
      await riskRepo.deleteManyRisks(riskIds);
      toast.success("Risks and associated records deleted");
      setIsBulkRiskDeleteOpen(false);
      setSelectedIds(new Set());
      if (selectedRiskId && selectedIds.has(selectedRiskId)) setSelectedRiskId(null);
    } catch (error) {
      console.error('Bulk risk delete error:', error);
      toast.error('Failed to delete risks.');
    }
  };
  const [bulkRecordUpdateData, setBulkRecordUpdateData] = useState<{
    costCodeId: string;
    scope: string;
    probability: string;
    minImpactAmount: string;
    mostLikelyImpactAmount: string;
    maxImpactAmount: string;
    enterpriseAttributes: Record<string, any>;
    projectAttributes: Record<string, any>;
  }>({
    costCodeId: '',
    scope: '',
    probability: '',
    minImpactAmount: '',
    mostLikelyImpactAmount: '',
    maxImpactAmount: '',
    enterpriseAttributes: {},
    projectAttributes: {}
  });
  
  // Modal States
  const [isCreateRiskOpen, setIsCreateRiskOpen] = useState(false);
  const [isDeleteRiskOpen, setIsDeleteRiskOpen] = useState(false);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [riskToDelete, setRiskToDelete] = useState<Risk | null>(null);

  const [isMainTableCollapsed, setIsMainTableCollapsed] = useState(false);

  const enterpriseLineItemAttrs = useMemo(() => 
    (enterprise.lineItemAttributes || []).filter(attr => attr.title && attr.title.trim() !== '' && attr.values && attr.values.length > 0),
    [enterprise.lineItemAttributes]
  );

  const projectLineItemAttrs = useMemo(() => 
    (project.lineItemAttributes || []).filter(attr => attr.title && attr.title.trim() !== '' && attr.values && attr.values.length > 0),
    [project.lineItemAttributes]
  );

  const gridRef = useRef<AgGridReact>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const toggleAllRiskColumnGroups = (opened: boolean) => {
    if (!gridRef.current) return;
    const api = gridRef.current.api;
    const groups = api.getColumnGroupState();
    const newState = groups.map(g => ({
      groupId: g.groupId,
      open: opened
    }));
    api.setColumnGroupState(newState);
  };

  const [importPreview, setImportPreview] = useState<{ type: 'risks' | 'records', data: any[] } | null>(null);

  const handleExport = () => {
    if (gridRef.current?.api) {
      gridRef.current.api.exportDataAsExcel({
        fileName: `${project.projectCode}_Risks_${new Date().toISOString().split('T')[0]}.xlsx`
      });
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];
        if (data.length === 0) {
          toast.error("The file is empty.");
          return;
        }
        setImportPreview({ type: 'risks', data });
      } catch (error) { toast.error("Import failed"); }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const handleImportRecords = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedRiskId) return;
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];
        if (data.length === 0) {
          toast.error("The file is empty.");
          return;
        }
        setImportPreview({ type: 'records', data });
      } catch (error) { toast.error("Import failed"); }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const completeImport = async () => {
    if (!importPreview) return;
    const { type, data } = importPreview;
    try {
      if (type === 'risks') {
        const toUpdate: Array<{ id: string; data: any }> = [];
        const toCreate: Array<Omit<Risk, 'id' | 'createdAt' | 'updatedAt'>> = [];
        for (const row of data) {
          const riskId = String(row['Risk ID'] || row.riskId || row.ID || row.id || '').trim();
          if (!riskId) continue;
          const existing = risks.find(r => r.riskId.toLowerCase() === riskId.toLowerCase());
          const riskData: any = {
            projectId: project.id, riskId: riskId.slice(0, 20),
            description: String(row['Description'] || row.description || ''),
            type: String(row['Type'] || row.type || (enterprise.riskTypes?.[0] || '')),
            status: String(row['Status'] || row.status || 'Open'),
            strategy: String(row['Strategy'] || row.strategy || 'Mitigate'),
            initiator: String(row['Initiator'] || row.initiator || '').slice(0, 50),
            reference: String(row['Reference'] || row.reference || '').slice(0, 50),
          };
          if (existing) {
            toUpdate.push({ id: existing.id, data: riskData });
          } else {
            toCreate.push({ ...riskData, exposure: 0, minImpactTotal: 0, mostLikelyImpactTotal: 0, maxImpactTotal: 0, mitigation: 0, residualExposure: 0, enterpriseAttributes: {}, projectAttributes: {} });
          }
        }
        await riskRepo.updateManyRisks(toUpdate);
        if (toCreate.length > 0) await riskRepo.createManyRisks(toCreate);
        toast.success(`Processed ${toUpdate.length + toCreate.length} risks`);
      } else if (type === 'records' && selectedRiskId) {
        const toCreate: Array<Omit<RiskRecord, 'id' | 'createdAt' | 'updatedAt'>> = [];
        for (const row of data) {
          const costCodeId = String(row['Cost Code'] || row.costCodeId || '').trim();
          if (!costCodeId) continue;
          const min = Number(row['Min Value $'] || row.minImpactAmount || 0);
          const mostLikely = Number(row['Most Likely $'] || row.mostLikelyImpactAmount || 0);
          const max = Number(row['Max Value $'] || row.maxImpactAmount || 0);
          const prob = Number(row['Prob %'] || row.probability || 100) / 100;
          toCreate.push({
            riskId: selectedRiskId, projectId: project.id, costCodeId,
            scope: String(row['Scope'] || row.scope || ''),
            probability: prob, minImpactAmount: min, mostLikelyImpactAmount: mostLikely, maxImpactAmount: max,
            betaPertImpactAmount: betaPertExposure(min, mostLikely, max, prob),
          } as Omit<RiskRecord, 'id' | 'createdAt' | 'updatedAt'>);
        }
        if (toCreate.length > 0) await riskRepo.createManyRiskRecords(toCreate);
        toast.success(`Imported ${toCreate.length} records`);
      }
    } catch (error) {
      console.error('Import commit error:', error);
      toast.error("Failed to finish import");
    }
    setImportPreview(null);
  };

  const riskPinnedBottomRowData = useMemo(() => {
    if (risksWithRollups.length === 0) return [];
    return [{
      riskId: 'TOTALS',
      minImpactTotal: risksWithRollups.reduce((sum, r) => sum + (r.minImpactTotal || 0), 0),
      mostLikelyImpactTotal: risksWithRollups.reduce((sum, r) => sum + (r.mostLikelyImpactTotal || 0), 0),
      maxImpactTotal: risksWithRollups.reduce((sum, r) => sum + (r.maxImpactTotal || 0), 0),
      exposure: risksWithRollups.reduce((sum, r) => sum + (r.exposure || 0), 0)
    }];
  }, [risksWithRollups]);

  const recordPinnedBottomRowData = useMemo(() => {
    if (riskRecords.length === 0) return [];
    return [{
      costCodeId: 'TOTALS',
      minImpactAmount: riskRecords.reduce((sum, r) => sum + (r.minImpactAmount || 0), 0),
      mostLikelyImpactAmount: riskRecords.reduce((sum, r) => sum + (r.mostLikelyImpactAmount || 0), 0),
      maxImpactAmount: riskRecords.reduce((sum, r) => sum + (r.maxImpactAmount || 0), 0),
      betaPertImpactAmount: riskRecords.reduce((sum, r) => sum + betaPertExposure(
        r.minImpactAmount || 0, r.mostLikelyImpactAmount || 0, r.maxImpactAmount || 0, r.probability || 0
      ), 0)
    }];
  }, [riskRecords]);

  const sideBar: SideBarDef = {
    toolPanels: [
      {
        id: 'columns',
        labelDefault: 'Columns',
        labelKey: 'columns',
        iconKey: 'columns',
        toolPanel: 'agColumnsToolPanel',
      },
      {
        id: 'filters',
        labelDefault: 'Filters',
        labelKey: 'filters',
        iconKey: 'filter',
        toolPanel: 'agFiltersToolPanel',
      },
    ],
    defaultToolPanel: '',
  };

  const statusBar: { statusPanels: StatusPanelDef[] } = {
    statusPanels: [
      { statusPanel: 'agTotalAndFilteredRowCountComponent', align: 'left' },
      { statusPanel: 'agSelectedRowCountComponent', align: 'left' },
      { statusPanel: 'agAggregationComponent', align: 'right' },
    ],
  };

  const chartData = useMemo(() => {
    if (!project.reportingPeriods?.periods) return [];

    // Sort periods by start date
    const periods = [...project.reportingPeriods.periods].sort((a, b) => 
      new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
    );
    
    let cumulativeExposure = 0;
    let cumulativeMitigation = 0;
    let cumulativeResidual = 0;

    const data = periods.map((p, index) => {
      const periodRisks = risksWithRollups.filter(r => r.periodId === p.id);
      const exposure = periodRisks.reduce((sum, r) => sum + (r.exposure || 0), 0);
      
      cumulativeExposure += exposure;

      const date = new Date(p.startDate);
      const month = date.toLocaleString('en-US', { month: 'short' });
      const year = date.getFullYear().toString().slice(-2);
      const dateLabel = `${month}'${year}`;

      return {
        name: `P${index + 1} (${dateLabel})`,
        exposure,
        cumulativeExposure
      };
    });

    return data;
  }, [risksWithRollups, project.reportingPeriods]);

  useEffect(() => {
    const root = document.documentElement;
    setTheme(root.classList.contains('dark') ? 'dark' : 'light');
  }, []);

  // Fetch Risks
  useEffect(() => {
    return riskRepo.subscribeRisks(project.id, (data) => {
      setRisks(data);
      setIsLoading(false);
    });
  }, [project.id]);

  // Fetch Risk Records
  useEffect(() => {
    if (!selectedRiskId) { setRiskRecords([]); return; }
    return riskRepo.subscribeRiskRecords(project.id, (data) => {
      setRiskRecords(data.filter(r => r.riskId === selectedRiskId));
    });
  }, [selectedRiskId, project.id]);

  // Fetch Cost Codes
  useEffect(() => {
    return costRepo.subscribeCostCodes(project.id, (data) => {
      setCostCodes(data.sort((a, b) => a.sortOrder - b.sortOrder));
    });
  }, [project.id]);

  const handleCreateRisk = async (riskData: Omit<Risk, 'id'>) => {
    try {
      await riskRepo.createRisk(riskData as Omit<Risk, 'id' | 'createdAt' | 'updatedAt'>);
      toast.success("Risk created successfully");
      setIsCreateRiskOpen(false);
    } catch (error) {
      console.error('Create risk error:', error);
      toast.error('Failed to create risk.');
    }
  };

  const handleDeleteRisk = async () => {
    if (!riskToDelete) return;
    try {
      const records = await riskRepo.listRiskRecords(project.id, riskToDelete.id);
      await riskRepo.deleteManyRiskRecords(records.map(r => r.id));
      await riskRepo.deleteRisk(riskToDelete.id);
      toast.success("Risk and records deleted");
      setIsDeleteRiskOpen(false);
      setRiskToDelete(null);
      if (selectedRiskId === riskToDelete.id) setSelectedRiskId(null);
    } catch (error) {
      console.error('Delete risk error:', error);
      toast.error('Failed to delete risk.');
    }
  };

  const riskColumnDefs = useMemo<(ColDef | ColGroupDef)[]>(() =>
    buildRiskColumnDefs({ project, enterprise, setSelectedRiskId, setRiskToDelete, setIsDeleteRiskOpen }),
    [project, enterprise, risks]
  );

  // Handle cell value changes
  const onCellValueChanged = async (params: CellValueChangedEvent) => {
    const { data, colDef } = params;
    if (!data.id) return;
    try {
      let updates: any = { [colDef.field!]: params.newValue, updatedAt: new Date().toISOString() };
      if (colDef.field?.startsWith('enterpriseAttributes.') || colDef.field?.startsWith('projectAttributes.')) {
        const parts = colDef.field.split('.');
        const attrField = parts[0];
        const attrId = parts[1];
        updates = { [`${attrField}.${attrId}`]: params.newValue, updatedAt: new Date().toISOString() };
      }
      await riskRepo.updateRisk(data.id, updates);
    } catch (error) {
      console.error(`Error updating risk ${data.id}:`, error);
      toast.error('Failed to update risk.');
    }
  };

  const recordColumnDefs = useMemo<(ColDef | ColGroupDef)[]>(() =>
    buildRiskRecordColumnDefs({ costCodes, enterpriseLineItemAttrs, projectLineItemAttrs, riskRepo }),
    [costCodes, enterpriseLineItemAttrs, projectLineItemAttrs]
  );

  const onRecordCellValueChanged = async (params: CellValueChangedEvent) => {
    const { data, colDef } = params;
    if (!data.id) return;
    try {
      let updates: any = { [colDef.field!]: params.newValue, updatedAt: new Date().toISOString() };
      
      // If any PERT input changes, update betaPertImpactAmount
      if (['probability', 'minImpactAmount', 'mostLikelyImpactAmount', 'maxImpactAmount'].includes(colDef.field!)) {
        const prob = Number(colDef.field === 'probability' ? params.newValue : data.probability) || 0;
        const min = Number(colDef.field === 'minImpactAmount' ? params.newValue : data.minImpactAmount) || 0;
        const ml = Number(colDef.field === 'mostLikelyImpactAmount' ? params.newValue : data.mostLikelyImpactAmount) || 0;
        const max = Number(colDef.field === 'maxImpactAmount' ? params.newValue : data.maxImpactAmount) || 0;
        const betaPert = betaPertExposure(min, ml, max, prob);
        updates.betaPertImpactAmount = betaPert;
      }
      
      await riskRepo.updateRiskRecord(data.id, updates);
    } catch (error) {
      console.error(`Error updating risk record ${data.id}:`, error);
      toast.error('Failed to update record.');
    }
  };

  const handleAddRecord = async () => {
    if (!selectedRiskId) return;
    try {
      await riskRepo.createRiskRecord({
        riskId: selectedRiskId, projectId: project.id, costCodeId: '', scope: '',
        probability: 1.0, minImpactAmount: 0, mostLikelyImpactAmount: 0, maxImpactAmount: 0, betaPertImpactAmount: 0,
      } as Omit<RiskRecord, 'id' | 'createdAt' | 'updatedAt'>);
      toast.success("Record added (Default Prob 100%)");
    } catch (error) {
      console.error('Add record error:', error);
      toast.error('Failed to add record.');
    }
  };

  const handleBulkUpdateRecords = async () => {
    if (selectedRecordIds.size === 0 || !selectedRiskId) return;
    try {
      const updates: any = { updatedAt: new Date().toISOString() };
      if (bulkRecordUpdateData.costCodeId) {
        updates.costCodeId = bulkRecordUpdateData.costCodeId === '_' ? '' : bulkRecordUpdateData.costCodeId;
      }
      if (bulkRecordUpdateData.scope) updates.scope = bulkRecordUpdateData.scope;
      if (bulkRecordUpdateData.probability) updates.probability = Number(bulkRecordUpdateData.probability) > 1 ? Number(bulkRecordUpdateData.probability) / 100 : Number(bulkRecordUpdateData.probability);
      
      const hasMinChange = bulkRecordUpdateData.minImpactAmount !== '';
      const hasMLChange = bulkRecordUpdateData.mostLikelyImpactAmount !== '';
      const hasMaxChange = bulkRecordUpdateData.maxImpactAmount !== '';
      
      if (hasMinChange) updates.minImpactAmount = Number(bulkRecordUpdateData.minImpactAmount);
      if (hasMLChange) updates.mostLikelyImpactAmount = Number(bulkRecordUpdateData.mostLikelyImpactAmount);
      if (hasMaxChange) updates.maxImpactAmount = Number(bulkRecordUpdateData.maxImpactAmount);

      // Add Attributes to updates
      Object.entries(bulkRecordUpdateData.enterpriseAttributes).forEach(([id, val]) => {
        if (val) updates[`enterpriseAttributes.${id}`] = val === '_' ? '' : val;
      });
      Object.entries(bulkRecordUpdateData.projectAttributes).forEach(([id, val]) => {
        if (val) updates[`projectAttributes.${id}`] = val === '_' ? '' : val;
      });

      const recordUpdates = [...selectedRecordIds].flatMap(id => {
        const record = riskRecords.find(r => r.id === id);
        if (!record) return [];
        const finalUpdates = { ...updates };
        const hasProbChange = bulkRecordUpdateData.probability !== '';
        if (hasMinChange || hasMLChange || hasMaxChange || hasProbChange) {
          const prob = hasProbChange ? (Number(bulkRecordUpdateData.probability) > 1 ? Number(bulkRecordUpdateData.probability) / 100 : Number(bulkRecordUpdateData.probability)) : (record.probability || 0);
          const min = hasMinChange ? Number(bulkRecordUpdateData.minImpactAmount) : (record.minImpactAmount || 0);
          const ml = hasMLChange ? Number(bulkRecordUpdateData.mostLikelyImpactAmount) : (record.mostLikelyImpactAmount || 0);
          const max = hasMaxChange ? Number(bulkRecordUpdateData.maxImpactAmount) : (record.maxImpactAmount || 0);
          finalUpdates.betaPertImpactAmount = betaPertExposure(min, ml, max, prob);
        }
        return [{ id, data: finalUpdates }];
      });
      await riskRepo.updateManyRiskRecords(recordUpdates);
      toast.success("Updated Successfully");
      setIsBulkRecordUpdateOpen(false);
      setSelectedRecordIds(new Set());
    } catch (error) {
      console.error('Bulk record update error:', error);
      toast.error('Failed to update records.');
    }
  };

  const handleBulkDeleteRecords = async () => {
    if (selectedRecordIds.size === 0 || !selectedRiskId) return;
    try {
      await riskRepo.deleteManyRiskRecords([...selectedRecordIds]);
      toast.success("Deleted Successfully");
      setIsBulkRecordDeleteOpen(false);
      setSelectedRecordIds(new Set());
    } catch (error) {
      console.error('Bulk record delete error:', error);
      toast.error('Failed to delete records.');
    }
  };

  const { duplicateIds, hasImportDuplicates } = useMemo(() => {
    if (!importPreview) return { duplicateIds: [], hasImportDuplicates: false };
    const idsInFile = new Set<string>();
    const fileDuplicates = new Set<string>();
    importPreview.data.forEach(row => {
      const id = importPreview.type === 'risks' 
        ? (row['Risk ID'] || row.riskId || row.ID || row.id)
        : (row['Cost Code'] || row.costCodeId);
      if (id) {
        const normalizedId = id.toString().trim().toLowerCase();
        if (idsInFile.has(normalizedId)) fileDuplicates.add(id.toString().trim());
        idsInFile.add(normalizedId);
      }
    });
    const duplicateList = Array.from(fileDuplicates);
    return { duplicateIds: duplicateList, hasImportDuplicates: duplicateList.length > 0 };
  }, [importPreview]);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-[#141414] border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden">
      <div className="p-6 border-b border-gray-100 dark:border-white/10 flex justify-between items-center bg-gray-50/50 dark:bg-white/5 shrink-0">
        <div className="flex items-center gap-8">
          <div>
            <h3 className="text-xl font-bold dark:text-white">Risk Management</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Identify and mitigate project risks.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text" placeholder="Search risks..." value={quickFilterText} onChange={(e) => setQuickFilterText(e.target.value)}
              className="pl-10 pr-4 py-2 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-xl text-sm w-64 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx,.xls" onChange={handleImport} />
          <button onClick={() => fileInputRef.current?.click()} className="p-2 text-gray-400 hover:text-black dark:hover:text-white transition-colors" title="Import Risks"><Upload className="w-5 h-5" /></button>
          <button onClick={handleExport} className="p-2 text-gray-400 hover:text-black dark:hover:text-white transition-colors" title="Export Risks"><Download className="w-5 h-5" /></button>
          
          <div className="w-px h-6 bg-gray-200 dark:bg-white/10 mx-1" />
          
          <button onClick={() => toggleAllRiskColumnGroups(true)} className="p-2 text-gray-400 hover:text-black dark:hover:text-white transition-colors" title="Expand All Groups"><Maximize2 className="w-4 h-4" /></button>
          <button onClick={() => toggleAllRiskColumnGroups(false)} className="p-2 text-gray-400 hover:text-black dark:hover:text-white transition-colors" title="Collapse All Groups"><Minimize2 className="w-4 h-4" /></button>
          
          <div className="w-px h-6 bg-gray-200 dark:bg-white/10 mx-1" />

          <button onClick={() => setIsChartsVisible(!isChartsVisible)} className={cn("p-2 rounded-lg transition-all", isChartsVisible ? "bg-black text-white dark:bg-white dark:text-black shadow-lg" : "text-gray-400 hover:text-black dark:hover:text-white")} title="Trends"><BarChart3 className="w-5 h-5" /></button>
          
          {selectedIds.size > 0 && (
            <div className="flex gap-2">
              <button onClick={() => setIsBulkRiskUpdateOpen(true)} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-colors">Bulk Update ({selectedIds.size})</button>
              <button onClick={() => setIsBulkRiskDeleteOpen(true)} className="px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-bold shadow-lg shadow-red-600/20 hover:bg-red-700 transition-colors flex items-center gap-2">
                <Trash2 className="w-4 h-4" /> Delete ({selectedIds.size})
              </button>
            </div>
          )}
          <button onClick={() => setIsCreateRiskOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-black dark:bg-white text-white dark:text-black rounded-xl text-sm font-bold shadow-lg shadow-black/10 hover:opacity-90 transition-all"><Plus className="w-4 h-4" /> Add</button>
        </div>
      </div>

      <div className={cn("flex flex-col transition-all duration-500", selectedRiskId ? (isMainTableCollapsed ? "h-[60px]" : "h-[45%]") : "flex-1")}>
        <div className="flex items-center justify-between px-4 py-2 bg-gray-100 dark:bg-white/5 border-b border-gray-200 dark:border-white/10 shrink-0">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-600" />
              <span className="text-xs font-bold uppercase tracking-wider dark:text-white">Active Risks</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {selectedRiskId && (
              <button onClick={() => setIsMainTableCollapsed(!isMainTableCollapsed)} className="p-1.5 hover:bg-gray-200 dark:hover:bg-white/10 rounded-lg transition-colors">
                {isMainTableCollapsed ? <ChevronDown className="w-4 h-4 dark:text-white" /> : <ChevronUp className="w-4 h-4 dark:text-white" />}
              </button>
            )}
          </div>
        </div>

        <AnimatePresence>
          {isChartsVisible && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 300, opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="flex gap-4 p-8 border-b border-gray-100 dark:border-white/10 shrink-0 overflow-hidden">
              <div className="flex-1">
                <h4 className="text-xs font-bold text-gray-400 uppercase mb-4 px-2">Risk Exposure Trend (Beta Pert)</h4>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'} />
                      <XAxis dataKey="name" stroke={theme === 'dark' ? '#94a3b8' : '#64748b'} fontSize={10} axisLine={false} tickLine={false} />
                      <YAxis stroke={theme === 'dark' ? '#94a3b8' : '#64748b'} fontSize={10} axisLine={false} tickLine={false} tickFormatter={(val) => `$${(val / 1000)}k`} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: theme === 'dark' ? '#1a1a1a' : '#fff', border: 'none', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                        formatter={(value: number) => [formatCurrency(value), '']}
                      />
                      <Bar dataKey="exposure" fill="#dc2626" radius={[4, 4, 0, 0]} barSize={30} />
                      <Line type="monotone" dataKey="cumulativeExposure" stroke="#dc2626" strokeWidth={2} dot={{ r: 4 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-2 gap-4 p-6 bg-gray-50 dark:bg-white/5 border-b border-gray-200 dark:border-white/10 shrink-0">
          <div className="bg-white dark:bg-[#1a1a1a] p-4 rounded-xl border border-gray-200 dark:border-white/10">
            <h4 className="text-xs font-bold text-gray-500 uppercase mb-1">Total Beta Pert Exposure</h4>
            <div className="flex items-center justify-between">
              <span className="text-xl font-bold text-red-600">{formatCurrency(risksWithRollups.reduce((sum, r) => sum + (r.exposure || 0), 0))}</span>
              <AlertTriangle className="w-5 h-5 text-red-500 opacity-20" />
            </div>
          </div>
          <div className="bg-white dark:bg-[#1a1a1a] p-4 rounded-xl border border-gray-200 dark:border-white/10">
            <h4 className="text-xs font-bold text-gray-500 uppercase mb-1">Impact Reduction Factor</h4>
            <div className="flex items-center justify-between">
              <span className="text-xl font-bold text-emerald-600">Active Monitoring</span>
              <Activity className="w-5 h-5 text-emerald-500 opacity-20" />
            </div>
          </div>
        </div>

        <div className="flex-1 relative">
          <div className={cn("absolute inset-0 ag-theme-quartz", theme === 'dark' ? "ag-theme-quartz-dark" : "")}>
            <AgGridReact
              theme="legacy"
              ref={gridRef} rowData={risksWithRollups} columnDefs={riskColumnDefs} quickFilterText={quickFilterText}
              onCellValueChanged={onCellValueChanged} rowSelection="multiple" animateRows={true}
              pinnedBottomRowData={riskPinnedBottomRowData}
              onSelectionChanged={(p) => setSelectedIds(new Set(p.api.getSelectedRows().map(r => r.id)))}
              defaultColDef={{ sortable: true, filter: true, resizable: true }}
            />
          </div>
        </div>
      </div>

      <AnimatePresence>
        {selectedRiskId && (
          <RiskRecordsPanel
            selectedRiskId={selectedRiskId}
            risks={risks}
            riskRecords={riskRecords}
            recordColumnDefs={recordColumnDefs}
            recordPinnedBottomRowData={recordPinnedBottomRowData}
            isMainTableCollapsed={isMainTableCollapsed}
            onClose={() => setSelectedRiskId(null)}
            onAddRecord={handleAddRecord}
            onCellValueChanged={onRecordCellValueChanged}
            onImportRecords={handleImportRecords}
            onBulkUpdateOpen={() => setIsBulkRecordUpdateOpen(true)}
            onBulkDeleteOpen={() => setIsBulkRecordDeleteOpen(true)}
            onSelectionChanged={setSelectedRecordIds}
            selectedRecordCount={selectedRecordIds.size}
            theme={theme}
            projectCode={project.projectCode}
          />
        )}
      </AnimatePresence>

      <Dialog open={isBulkRiskUpdateOpen} onOpenChange={setIsBulkRiskUpdateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Bulk Update Risks</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <Select onValueChange={v => setBulkRiskUpdateData({...bulkRiskUpdateData, status: v as any})}>
                <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Open">Open</SelectItem>
                  <SelectItem value="Mitigated">Mitigated</SelectItem>
                  <SelectItem value="Closed">Closed</SelectItem>
                  <SelectItem value="Realized">Realized</SelectItem>
                </SelectContent>
              </Select>
              <Select onValueChange={v => setBulkRiskUpdateData({...bulkRiskUpdateData, strategy: v as any})}>
                <SelectTrigger><SelectValue placeholder="Strategy" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Avoid">Avoid</SelectItem>
                  <SelectItem value="Mitigate">Mitigate</SelectItem>
                  <SelectItem value="Transfer">Transfer</SelectItem>
                  <SelectItem value="Accept">Accept</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Input placeholder="Type" value={bulkRiskUpdateData.type} onChange={e => setBulkRiskUpdateData({...bulkRiskUpdateData, type: e.target.value})} />
            <Input placeholder="Initiator" value={bulkRiskUpdateData.initiator} onChange={e => setBulkRiskUpdateData({...bulkRiskUpdateData, initiator: e.target.value})} />
          </div>
          <DialogFooter><Button onClick={handleBulkUpdateRisks}>Update</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isBulkRiskDeleteOpen} onOpenChange={setIsBulkRiskDeleteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="text-red-600">Bulk Delete Risks</DialogTitle></DialogHeader>
          <div className="py-4 text-sm text-gray-500">
            Are you sure you want to delete {selectedIds.size} risks and their associated records? This action cannot be undone.
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBulkRiskDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleBulkDeleteRisks}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <RiskFormDialog
        isOpen={isCreateRiskOpen}
        onClose={() => setIsCreateRiskOpen(false)}
        onSubmit={handleCreateRisk}
        enterprise={enterprise}
        existingRisks={risks}
        projectId={project.id}
      />

      <Dialog open={isBulkRecordUpdateOpen} onOpenChange={setIsBulkRecordUpdateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Bulk Update Risk Records</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto pr-2">
            <Select onValueChange={v => setBulkRecordUpdateData({...bulkRecordUpdateData, costCodeId: v})} value={bulkRecordUpdateData.costCodeId}>
              <SelectTrigger>
                <SelectValue placeholder="Cost Code">
                  {bulkRecordUpdateData.costCodeId === '_' ? 'Clear Cost Code' : 
                   costCodes.find(cc => cc.id === bulkRecordUpdateData.costCodeId)?.code || 
                   (bulkRecordUpdateData.costCodeId && "Selected")}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_">Clear Cost Code</SelectItem>
                {costCodes.map(cc => (
                  <SelectItem key={cc.id} value={cc.id}>{cc.code} - {cc.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input placeholder="Scope" value={bulkRecordUpdateData.scope} onChange={e => setBulkRecordUpdateData({...bulkRecordUpdateData, scope: e.target.value})} />
            <Input type="number" placeholder="Prob % (0-100)" value={bulkRecordUpdateData.probability} onChange={e => setBulkRecordUpdateData({...bulkRecordUpdateData, probability: e.target.value})} />
            <div className="grid grid-cols-3 gap-4">
              <Input type="number" placeholder="Min Value $" value={bulkRecordUpdateData.minImpactAmount} onChange={e => setBulkRecordUpdateData({...bulkRecordUpdateData, minImpactAmount: e.target.value})} />
              <Input type="number" placeholder="Most Likely $" value={bulkRecordUpdateData.mostLikelyImpactAmount} onChange={e => setBulkRecordUpdateData({...bulkRecordUpdateData, mostLikelyImpactAmount: e.target.value})} />
              <Input type="number" placeholder="Max Value $" value={bulkRecordUpdateData.maxImpactAmount} onChange={e => setBulkRecordUpdateData({...bulkRecordUpdateData, maxImpactAmount: e.target.value})} />
            </div>

            {enterpriseLineItemAttrs.length > 0 && (
              <div className="space-y-3 pt-2 border-t border-gray-100 dark:border-white/5">
                <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Enterprise Line-Item Attributes</h4>
                <div className="grid grid-cols-1 gap-3">
                  {enterpriseLineItemAttrs.map(attr => (
                    <div key={attr.id} className="space-y-1">
                      <label className="text-[10px] font-medium text-gray-500 pl-1">{attr.title}</label>
                      <Select 
                        onValueChange={v => setBulkRecordUpdateData({
                          ...bulkRecordUpdateData, 
                          enterpriseAttributes: { ...bulkRecordUpdateData.enterpriseAttributes, [attr.id]: v }
                        })} 
                        value={bulkRecordUpdateData.enterpriseAttributes[attr.id] || ''}
                      >
                        <SelectTrigger className="h-9 text-xs">
                          <SelectValue placeholder={`Select ${attr.title}...`} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_">Clear Value</SelectItem>
                          {attr.values.map(v => (
                            <SelectItem key={v.id} value={`${v.id} | ${v.description}`}>{v.id} | {v.description}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {projectLineItemAttrs.length > 0 && (
              <div className="space-y-3 pt-2 border-t border-gray-100 dark:border-white/5">
                <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Project Line-Item Attributes</h4>
                <div className="grid grid-cols-1 gap-3">
                  {projectLineItemAttrs.map(attr => (
                    <div key={attr.id} className="space-y-1">
                      <label className="text-[10px] font-medium text-gray-500 pl-1">{attr.title}</label>
                      <Select 
                        onValueChange={v => setBulkRecordUpdateData({
                          ...bulkRecordUpdateData, 
                          projectAttributes: { ...bulkRecordUpdateData.projectAttributes, [attr.id]: v }
                        })} 
                        value={bulkRecordUpdateData.projectAttributes[attr.id] || ''}
                      >
                        <SelectTrigger className="h-9 text-xs">
                          <SelectValue placeholder={`Select ${attr.title}...`} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_">Clear Value</SelectItem>
                          {attr.values.map(v => (
                            <SelectItem key={v.id} value={`${v.id} | ${v.description}`}>{v.id} | {v.description}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter><Button onClick={handleBulkUpdateRecords}>Update</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isBulkRecordDeleteOpen} onOpenChange={setIsBulkRecordDeleteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="text-red-600">Bulk Delete Risk Records</DialogTitle></DialogHeader>
          <div className="py-4">
            <p>Are you sure you want to delete {selectedRecordIds.size} risk records? This action cannot be undone.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBulkRecordDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleBulkDeleteRecords}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AnimatePresence>
        {importPreview && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[110] p-4 font-sans">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-[#141414] rounded-3xl p-8 w-full max-w-4xl shadow-2xl border border-gray-200 dark:border-white/10 flex flex-col max-h-[90vh]"
            >
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-bold dark:text-white">Review {importPreview.type === 'risks' ? 'Risks' : 'Records'} Import</h2>
                  <p className="text-gray-900 dark:text-gray-400 text-sm mt-1">
                    Review the data from your file below. {importPreview.type === 'risks' ? 'Existing Risk IDs will be updated.' : 'New records will be added to the selected risk.'}
                  </p>
                </div>
                <button onClick={() => setImportPreview(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition-colors">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {hasImportDuplicates && (
                <div className="mb-4 p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-2xl flex flex-col gap-2">
                  <div className="flex items-center gap-3 text-red-600 dark:text-red-400 text-[10px] font-black uppercase tracking-[0.15em]">
                    <AlertTriangle className="w-4 h-4" />
                    Duplicate ID found in file
                  </div>
                  <div className="text-sm text-red-600 dark:text-red-400 font-medium leading-relaxed">
                    The following IDs appear multiple times in your excel: <span className="font-bold underline">{duplicateIds.join(', ')}</span>. Please resolve duplicates before importing.
                  </div>
                </div>
              )}

              <div className="flex-1 overflow-auto border border-gray-100 dark:border-white/10 rounded-2xl mb-6 shadow-inner bg-gray-50/50 dark:bg-black/20">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-white dark:bg-[#1a1a1a] sticky top-0 border-b border-gray-200 dark:border-white/10 shadow-sm z-10">
                    <tr>
                      {Object.keys(importPreview.data[0] || {}).map(key => (
                        <th key={key} className="px-4 py-3 font-bold text-gray-900 dark:text-white uppercase tracking-widest text-[10px] bg-white dark:bg-[#1a1a1a]">{key}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                    {importPreview.data.map((row, i) => (
                      <tr key={i} className="hover:bg-gray-100/50 dark:hover:bg-white/5 transition-colors">
                        {Object.values(row).map((val: any, j) => (
                          <td key={j} className="px-4 py-3 text-gray-900 dark:text-gray-300 font-medium whitespace-nowrap">{val?.toString()}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={() => setImportPreview(null)}
                  className="flex-1 py-4 border border-gray-200 dark:border-white/10 rounded-2xl text-sm font-bold uppercase tracking-widest hover:bg-gray-50 dark:hover:bg-white/5 transition-colors dark:text-white"
                >
                  Cancel
                </button>
                <button 
                  onClick={completeImport}
                  disabled={hasImportDuplicates}
                  className="flex-1 py-4 bg-black dark:bg-white text-white dark:text-black rounded-2xl text-sm font-bold uppercase tracking-widest hover:bg-black/90 dark:hover:bg-white/90 transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  Complete Import ({importPreview.data.length} records)
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
