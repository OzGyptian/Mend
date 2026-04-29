import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Project, Enterprise, Risk, RiskRecord, CostCode } from '../types';
import { db, auth } from '../firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  getDocs,
  writeBatch,
  doc,
  updateDoc,
  addDoc,
  deleteDoc
} from 'firebase/firestore';
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

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  toast.error(`Database Error: ${errInfo.error}`);
  throw new Error(JSON.stringify(errInfo));
}

interface RiskManagementProps {
  project: Project;
  enterprise: Enterprise;
}

export default function RiskManagement({ project, enterprise }: RiskManagementProps) {
  const [risks, setRisks] = useState<Risk[]>([]);
  const [riskRecords, setRiskRecords] = useState<RiskRecord[]>([]);
  const [costCodes, setCostCodes] = useState<CostCode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRiskId, setSelectedRiskId] = useState<string | null>(null);
  const [quickFilterText, setQuickFilterText] = useState('');
  const [recordsQuickFilterText, setRecordsQuickFilterText] = useState('');
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
      const batch = writeBatch(db);
      const updates: any = { updatedAt: new Date().toISOString() };
      if (bulkRiskUpdateData.status) updates.status = bulkRiskUpdateData.status;
      if (bulkRiskUpdateData.strategy) updates.strategy = bulkRiskUpdateData.strategy;
      if (bulkRiskUpdateData.initiator) updates.initiator = bulkRiskUpdateData.initiator;
      if (bulkRiskUpdateData.type) updates.type = bulkRiskUpdateData.type;

      selectedIds.forEach(id => {
        batch.update(doc(db, 'risks', id), updates);
      });
      await batch.commit();
      toast.success("Risks Updated Successfully");
      setIsBulkRiskUpdateOpen(false);
      setSelectedIds(new Set());
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'risks/bulk');
    }
  };

  const handleBulkDeleteRisks = async () => {
    if (selectedIds.size === 0) return;
    try {
      const batch = writeBatch(db);
      // Also need to delete children records to avoid orphans
      for (const riskId of Array.from(selectedIds)) {
        const recordsSnap = await getDocs(query(collection(db, 'riskRecords'), where('riskId', '==', riskId)));
        recordsSnap.docs.forEach(d => batch.delete(d.ref));
        batch.delete(doc(db, 'risks', riskId));
      }
      await batch.commit();
      toast.success("Risks and associated records deleted");
      setIsBulkRiskDeleteOpen(false);
      setSelectedIds(new Set());
      if (selectedRiskId && selectedIds.has(selectedRiskId)) setSelectedRiskId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'risks/bulk');
    }
  };
  const [bulkRecordUpdateData, setBulkRecordUpdateData] = useState<{
    costCodeId: string;
    scope: string;
    probability: string;
    impactAmount: string;
    strategy: string;
    mitigationCost: string;
    residualProbability: string;
    residualImpactAmount: string;
    enterpriseAttributes: Record<string, any>;
    projectAttributes: Record<string, any>;
  }>({
    costCodeId: '',
    scope: '',
    probability: '',
    impactAmount: '',
    strategy: 'Mitigate',
    mitigationCost: '',
    residualProbability: '',
    residualImpactAmount: '',
    enterpriseAttributes: {},
    projectAttributes: {}
  });
  
  // Modal States
  const [isCreateRiskOpen, setIsCreateRiskOpen] = useState(false);
  const [isDeleteRiskOpen, setIsDeleteRiskOpen] = useState(false);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [riskToDelete, setRiskToDelete] = useState<Risk | null>(null);
  
  const [newRisk, setNewRisk] = useState({
    riskId: '',
    description: '',
    type: '',
    status: 'Open' as Risk['status'],
    strategy: 'Mitigate' as Risk['strategy'],
    initiator: '',
    reference: '',
    periodId: ''
  });

  const [isMainTableCollapsed, setIsMainTableCollapsed] = useState(false);

  const gridRef = useRef<AgGridReact>(null);
  const recordsGridRef = useRef<AgGridReact>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recordFileInputRef = useRef<HTMLInputElement>(null);

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

  const toggleAllRecordColumnGroups = (opened: boolean) => {
    if (!recordsGridRef.current) return;
    const api = recordsGridRef.current.api;
    const groups = api.getColumnGroupState();
    const newState = groups.map(g => ({
      groupId: g.groupId,
      open: opened
    }));
    api.setColumnGroupState(newState);
  };

  const handleExport = () => {
    const exportData = risks.map(r => {
      const row: any = {
        'Risk ID': r.riskId,
        'Description': r.description,
        'Type': r.type,
        'Status': r.status,
        'Strategy': r.strategy,
        'Initiator': r.initiator,
        'Reference': r.reference,
        'Exposure': r.exposure,
        'Mitigation': r.mitigation,
        'Residual Exposure': r.residualExposure
      };
      enterprise.riskAttributes?.forEach(attr => {
        const val = r.enterpriseAttributes?.[attr.id];
        const v = attr.values.find(v => v.id === val);
        row[`[E] ${attr.title}`] = v ? `${v.id} - ${v.description}` : val || '';
      });
      project.riskAttributes?.forEach(attr => {
        const val = r.projectAttributes?.[attr.id];
        const v = attr.values.find(v => v.id === val);
        row[`[P] ${attr.title}`] = v ? `${v.id} - ${v.description}` : val || '';
      });
      return row;
    });
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Risks");
    XLSX.writeFile(wb, `Risks_${project.projectName}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];
        const batch = writeBatch(db);
        let addedCount = 0;
        for (const row of data) {
          const riskId = String(row['Risk ID'] || '').trim();
          if (!riskId || risks.some(r => r.riskId.toLowerCase() === riskId.toLowerCase())) continue;
          const newRiskRef = doc(collection(db, 'risks'));
          batch.set(newRiskRef, {
            projectId: project.id,
            riskId: riskId.slice(0, 20),
            description: row['Description'] || '',
            type: row['Type'] || (enterprise.riskTypes?.[0] || ''),
            status: row['Status'] || 'Open',
            strategy: row['Strategy'] || 'Mitigate',
            initiator: String(row['Initiator'] || '').slice(0, 50),
            reference: String(row['Reference'] || '').slice(0, 50),
            exposure: 0,
            mitigation: 0,
            residualExposure: 0,
            enterpriseAttributes: {},
            projectAttributes: {},
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
          addedCount++;
        }
        if (addedCount > 0) {
          await batch.commit();
          toast.success(`Imported ${addedCount} risks`);
        }
      } catch (error) { toast.error("Import failed"); }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const handleExportRecords = () => {
    if (riskRecords.length === 0) return;
    const exportData = riskRecords.map(r => ({
      'Risk ID': risks.find(x => x.id === r.riskId)?.riskId || 'Unknown',
      'Cost Code': r.costCodeId,
      'Scope': r.scope,
      'Prob %': (r.probability || 0) * 100,
      'Impact $': r.impactAmount,
      'Mitigation Cost $': r.mitigationCost,
      'Res. Prob %': (r.residualProbability || 0) * 100,
      'Res. Impact $': r.residualImpactAmount
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Risk Records");
    XLSX.writeFile(wb, `Risk_Records_${selectedRiskId}.xlsx`);
  };

  const handleImportRecords = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedRiskId) return;
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];
        const batch = writeBatch(db);
        let addedCount = 0;
        for (const row of data) {
          const newRecordRef = doc(collection(db, 'riskRecords'));
          batch.set(newRecordRef, {
            riskId: selectedRiskId,
            projectId: project.id,
            costCodeId: String(row['Cost Code'] || '').trim(),
            scope: String(row['Scope'] || ''),
            probability: (Number(row['Prob %']) || 100) / 100,
            impactAmount: Number(row['Impact $']) || 0,
            mitigationCost: Number(row['Mitigation Cost $']) || 0,
            residualProbability: (Number(row['Res. Prob %']) || 100) / 100,
            residualImpactAmount: Number(row['Res. Impact $']) || 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
          addedCount++;
        }
        if (addedCount > 0) {
          await batch.commit();
          await updateParentTotals(selectedRiskId);
          toast.success(`Imported ${addedCount} records`);
        }
      } catch (error) { toast.error("Import failed"); }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const riskPinnedBottomRowData = useMemo(() => {
    if (risks.length === 0) return [];
    return [{
      riskId: 'TOTALS',
      exposure: risks.reduce((sum, r) => sum + (r.exposure || 0), 0),
      mitigation: risks.reduce((sum, r) => sum + (r.mitigation || 0), 0),
      residualExposure: risks.reduce((sum, r) => sum + (r.residualExposure || 0), 0)
    }];
  }, [risks]);

  const recordPinnedBottomRowData = useMemo(() => {
    if (riskRecords.length === 0) return [];
    return [{
      costCodeId: 'TOTALS',
      impactAmount: riskRecords.reduce((sum, r) => sum + (r.impactAmount || 0), 0),
      mitigationCost: riskRecords.reduce((sum, r) => sum + (r.mitigationCost || 0), 0),
      residualImpactAmount: riskRecords.reduce((sum, r) => sum + (r.residualImpactAmount || 0), 0),
      // Computed EMVs
      probability: null, // EMV is what matters for totals
      initialEMV: riskRecords.reduce((sum, r) => sum + ((r.probability || 0) * (r.impactAmount || 0)), 0),
      residualEMV: riskRecords.reduce((sum, r) => sum + ((r.residualProbability || 0) * (r.residualImpactAmount || 0)), 0)
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
      const periodRisks = risks.filter(r => r.periodId === p.id);
      const exposure = periodRisks.reduce((sum, r) => sum + (r.exposure || 0), 0);
      const mitigation = periodRisks.reduce((sum, r) => sum + (r.mitigation || 0), 0);
      const residual = periodRisks.reduce((sum, r) => sum + (r.residualExposure || 0), 0);
      
      cumulativeExposure += exposure;
      cumulativeMitigation += mitigation;
      cumulativeResidual += residual;

      const date = new Date(p.startDate);
      const month = date.toLocaleString('en-US', { month: 'short' });
      const year = date.getFullYear().toString().slice(-2);
      const dateLabel = `${month}'${year}`;

      return {
        name: `P${index + 1} (${dateLabel})`,
        exposure,
        mitigation,
        residualExposure: residual,
        cumulativeExposure,
        cumulativeMitigation,
        cumulativeResidual
      };
    });

    return data;
  }, [risks, project.reportingPeriods]);

  useEffect(() => {
    const root = document.documentElement;
    setTheme(root.classList.contains('dark') ? 'dark' : 'light');
  }, []);

  // Fetch Risks
  useEffect(() => {
    const q = query(collection(db, 'risks'), where('projectId', '==', project.id));
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Risk));
      setRisks(data);
      setIsLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'risks');
      setIsLoading(false);
    });
    return () => unsub();
  }, [project.id]);

  // Fetch Risk Records
  useEffect(() => {
    if (!selectedRiskId) {
      setRiskRecords([]);
      return;
    }
    const q = query(
      collection(db, 'riskRecords'), 
      where('projectId', '==', project.id),
      where('riskId', '==', selectedRiskId)
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as RiskRecord));
      setRiskRecords(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'riskRecords');
    });
    return () => unsub();
  }, [selectedRiskId]);

  // Fetch Cost Codes
  useEffect(() => {
    const q = query(collection(db, 'costCodes'), where('projectId', '==', project.id));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as CostCode));
      setCostCodes(data.sort((a, b) => a.sortOrder - b.sortOrder));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'costCodes');
    });
    return () => unsubscribe();
  }, [project.id]);

  const handleCreateRisk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRisk.riskId.trim()) { toast.error("Risk ID is required"); return; }
    if (newRisk.riskId.length > 20) { toast.error("Risk ID must be max 20 characters"); return; }
    if (risks.some(r => r.riskId.toLowerCase() === newRisk.riskId.toLowerCase())) { toast.error("Risk ID must be unique"); return; }

    try {
      const riskData: Omit<Risk, 'id'> = {
        projectId: project.id,
        riskId: newRisk.riskId.trim(),
        description: newRisk.description,
        type: newRisk.type || (enterprise.riskTypes?.[0] || ''),
        status: newRisk.status,
        strategy: newRisk.strategy,
        initiator: newRisk.initiator.slice(0, 50),
        reference: newRisk.reference.slice(0, 50),
        exposure: 0,
        mitigation: 0,
        residualExposure: 0,
        periodId: newRisk.periodId,
        enterpriseAttributes: {},
        projectAttributes: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await addDoc(collection(db, 'risks'), riskData);
      toast.success("Risk created successfully");
      setIsCreateRiskOpen(false);
      setNewRisk({ riskId: '', description: '', type: '', status: 'Open', strategy: 'Mitigate', initiator: '', reference: '', periodId: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'risks');
    }
  };

  const handleDeleteRisk = async () => {
    if (!riskToDelete) return;
    try {
      const batch = writeBatch(db);
      const recordsSnap = await getDocs(query(collection(db, 'riskRecords'), where('riskId', '==', riskToDelete.id)));
      recordsSnap.docs.forEach(d => batch.delete(d.ref));
      batch.delete(doc(db, 'risks', riskToDelete.id));
      await batch.commit();
      toast.success("Risk and records deleted");
      setIsDeleteRiskOpen(false);
      setRiskToDelete(null);
      if (selectedRiskId === riskToDelete.id) setSelectedRiskId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'risks');
    }
  };

  const updateParentTotals = async (riskId: string) => {
    try {
      const recordsSnap = await getDocs(query(collection(db, 'riskRecords'), where('riskId', '==', riskId)));
      const records = recordsSnap.docs.map(d => d.data() as RiskRecord);
      const totalInitialExposure = records.reduce((sum, r) => sum + ((Number(r.probability) || 0) * (Number(r.impactAmount) || 0)), 0);
      const totalMitigation = records.reduce((sum, r) => sum + (Number(r.mitigationCost) || 0), 0);
      const totalResidualExposure = records.reduce((sum, r) => sum + ((Number(r.residualProbability) || 0) * (Number(r.residualImpactAmount) || 0)), 0);
      
      await updateDoc(doc(db, 'risks', riskId), {
        exposure: totalInitialExposure,
        mitigation: totalMitigation,
        residualExposure: totalResidualExposure,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `risks/${riskId}/totals`);
    }
  };

  const riskColumnDefs = useMemo<(ColDef | ColGroupDef)[]>(() => {
    const defs: (ColDef | ColGroupDef)[] = [
      {
        headerName: '', headerCheckboxSelection: true, checkboxSelection: true, headerCheckboxSelectionFilteredOnly: true, width: 50, pinned: 'left',
      },
      {
        headerName: 'Risk ID', field: 'riskId', pinned: 'left', width: 150, sort: 'asc',
        cellRenderer: (params: any) => {
          if (params.node.rowPinned) return <span className="font-bold">{params.value}</span>;
          return (
            <button onClick={() => setSelectedRiskId(params.data.id)} className="text-blue-600 hover:text-blue-800 hover:underline font-bold text-left capitalize truncate">
              {params.value}
            </button>
          );
        }
      },
      { headerName: 'Period', field: 'periodId', editable: true, width: 120, cellEditor: 'agSelectCellEditor', cellEditorParams: { values: project.reportingPeriods?.periods.map(p => p.id) || [] }, valueFormatter: (p: any) => project.reportingPeriods?.periods.find(per => per.id === p.value)?.name || p.value },
      { headerName: 'Description', field: 'description', editable: true, width: 250 },
      { headerName: 'Type', field: 'type', editable: true, width: 150, cellEditor: 'agSelectCellEditor', cellEditorParams: { values: enterprise.riskTypes || [] } },
      {
        headerName: 'Status', field: 'status', editable: true, width: 130,
        cellEditor: 'agSelectCellEditor', cellEditorParams: { values: ['Open', 'Mitigated', 'Closed', 'Realized'] },
        cellClassRules: {
          'text-amber-600 font-bold': (p: any) => p.value === 'Open',
          'text-blue-600 font-bold': (p: any) => p.value === 'Mitigated',
          'text-gray-500 font-bold': (p: any) => p.value === 'Closed',
          'text-red-600 font-bold': (p: any) => p.value === 'Realized',
        }
      },
      {
        headerName: 'Strategy', field: 'strategy', editable: true, width: 130,
        cellEditor: 'agSelectCellEditor', cellEditorParams: { values: ['Avoid', 'Mitigate', 'Transfer', 'Accept'] }
      },
      { headerName: 'Initial Exposure (EMV)', field: 'exposure', width: 160, valueFormatter: (p) => formatCurrency(p.value), type: 'numericColumn', cellStyle: { fontWeight: 'bold', color: '#dc2626' } },
      { headerName: 'Mitigation Cost', field: 'mitigation', width: 140, valueFormatter: (p) => formatCurrency(p.value), type: 'numericColumn', cellStyle: { fontWeight: 'bold' } },
      { headerName: 'Residual Exposure', field: 'residualExposure', width: 160, valueFormatter: (p) => formatCurrency(p.value), type: 'numericColumn', cellStyle: { fontWeight: 'bold', color: '#2563eb' } },
      {
        headerName: 'Actions', width: 80, pinned: 'right',
        cellRenderer: (p: any) => p.node.rowPinned ? null : (
          <button onClick={() => { setRiskToDelete(p.data); setIsDeleteRiskOpen(true); }} className="p-1.5 text-gray-400 hover:text-red-600">
            <Trash2 className="w-4 h-4" />
          </button>
        )
      }
    ];

    // Enterprise Risk Attributes
    const enterpriseRiskAttrs = (enterprise.riskAttributes || []).filter(attr => attr.title && attr.title.trim() !== '' && attr.values && attr.values.length > 0);
    if (enterpriseRiskAttrs.length > 0) {
      defs.splice(defs.length - 1, 0, {
        headerName: 'Enterprise Risk Attributes',
        openByDefault: true,
        children: enterpriseRiskAttrs.map(attr => ({
          headerName: attr.title,
          field: `enterpriseAttributes.${attr.id}`,
          width: 150,
          editable: true,
          cellEditor: 'agRichSelectCellEditor',
          cellEditorParams: {
            values: attr.values.map(v => v.id),
            searchType: 'match',
            allowTyping: true,
            filterList: true
          },
          valueFormatter: (params: any) => {
            const v = attr.values.find(v => v.id === params.value);
            return v ? `${v.id} - ${v.description}` : params.value;
          }
        }))
      });
    }

    // Project Risk Attributes
    const projectRiskAttrs = (project.riskAttributes || []).filter(attr => attr.title && attr.title.trim() !== '' && attr.values && attr.values.length > 0);
    if (projectRiskAttrs.length > 0) {
      defs.splice(defs.length - 1, 0, {
        headerName: 'Project Risk Attributes',
        openByDefault: true,
        children: projectRiskAttrs.map(attr => ({
          headerName: attr.title,
          field: `projectAttributes.${attr.id}`,
          width: 150,
          editable: true,
          cellEditor: 'agRichSelectCellEditor',
          cellEditorParams: {
            values: attr.values.map(v => v.id),
            searchType: 'match',
            allowTyping: true,
            filterList: true
          },
          valueFormatter: (params: any) => {
            const v = attr.values.find(v => v.id === params.value);
            return v ? `${v.id} - ${v.description}` : params.value;
          }
        }))
      });
    }

    return defs;
  }, [project, enterprise, risks]);

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
      await updateDoc(doc(db, 'risks', data.id), updates);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `risks/${data.id}`);
    }
  };

  const recordColumnDefs = useMemo<(ColDef | ColGroupDef)[]>(() => {
    const defs: (ColDef | ColGroupDef)[] = [
      { headerName: '', checkboxSelection: true, headerCheckboxSelection: true, headerCheckboxSelectionFilteredOnly: true, width: 50, pinned: 'left' },
      {
        headerName: 'Cost Code', field: 'costCodeId', editable: true, width: 180,
        cellEditor: 'agRichSelectCellEditor', cellEditorParams: { values: costCodes.map(c => c.code), searchType: 'match', allowTyping: true, filterList: true },
        cellRenderer: (params: any) => params.node.rowPinned ? <span className="font-bold">{params.value}</span> : params.value
      },
      { headerName: 'Scope', field: 'scope', editable: true, width: 250 },
      {
        headerName: 'Initial Risk Analysis',
        openByDefault: true,
        children: [
          {
            headerName: 'Prob %', field: 'probability', editable: true, width: 100,
            valueFormatter: (p) => p.value === null ? '' : `${((p.value || 0) * 100).toFixed(0)}%`,
            cellEditor: 'agNumberCellEditor',
            cellEditorParams: { min: 0, max: 1 },
            valueParser: (p) => Number(p.newValue) > 1 ? Number(p.newValue) / 100 : Number(p.newValue)
          },
          {
            headerName: 'Impact $', field: 'impactAmount', editable: true, width: 130, type: 'numericColumn',
            valueFormatter: (p) => formatCurrency(p.value), cellEditor: 'agNumberCellEditor'
          },
          {
            headerName: 'EMV', width: 120, type: 'numericColumn',
            valueGetter: (p) => {
              if (p.node.rowPinned) return p.data.initialEMV;
              return (Number(p.data.probability) || 0) * (Number(p.data.impactAmount) || 0);
            },
            valueFormatter: (p) => formatCurrency(p.value),
            cellStyle: { backgroundColor: 'rgba(220, 38, 38, 0.05)', fontWeight: 'bold' }
          }
        ]
      },
      {
        headerName: 'Mitigation Cost $', field: 'mitigationCost', editable: true, width: 160, type: 'numericColumn',
        valueFormatter: (p) => formatCurrency(p.value), cellEditor: 'agNumberCellEditor'
      },
      {
        headerName: 'Residual Risk Analysis',
        openByDefault: true,
        children: [
          {
            headerName: 'Res. Prob %', field: 'residualProbability', editable: true, width: 110,
            valueFormatter: (p) => p.value === null ? '' : `${((p.value || 0) * 100).toFixed(0)}%`,
            cellEditor: 'agNumberCellEditor',
            cellEditorParams: { min: 0, max: 1 },
            valueParser: (p) => Number(p.newValue) > 1 ? Number(p.newValue) / 100 : Number(p.newValue)
          },
          {
            headerName: 'Res. Impact $', field: 'residualImpactAmount', editable: true, width: 130, type: 'numericColumn',
            valueFormatter: (p) => formatCurrency(p.value), cellEditor: 'agNumberCellEditor'
          },
          {
            headerName: 'Res. EMV', width: 120, type: 'numericColumn',
            valueGetter: (p) => {
              if (p.node.rowPinned) return p.data.residualEMV;
              return (Number(p.data.residualProbability) || 0) * (Number(p.data.residualImpactAmount) || 0);
            },
            valueFormatter: (p) => formatCurrency(p.value),
            cellStyle: { backgroundColor: 'rgba(37, 99, 235, 0.05)', fontWeight: 'bold' }
          }
        ]
      },
      {
         headerName: 'Actions', width: 80, pinned: 'right',
         cellRenderer: (p: any) => p.node.rowPinned ? null : (
           <button onClick={async () => {
             await deleteDoc(doc(db, 'riskRecords', p.data.id));
             updateParentTotals(p.data.riskId);
           }} className="p-1.5 text-gray-400 hover:text-red-600">
             <Trash2 className="w-4 h-4" />
           </button>
         )
      }
    ];

    return defs;
  }, [costCodes]);

  const onRecordCellValueChanged = async (params: CellValueChangedEvent) => {
    const { data, colDef } = params;
    if (!data.id) return;
    try {
      let updates: any = { [colDef.field!]: params.newValue, updatedAt: new Date().toISOString() };
      await updateDoc(doc(db, 'riskRecords', data.id), updates);
      if (['probability', 'impactAmount', 'mitigationCost', 'residualProbability', 'residualImpactAmount'].includes(colDef.field!)) {
        updateParentTotals(data.riskId);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `riskRecords/${data.id}`);
    }
  };

  const handleAddRecord = async () => {
    if (!selectedRiskId) return;
    try {
      await addDoc(collection(db, 'riskRecords'), {
        riskId: selectedRiskId,
        projectId: project.id,
        costCodeId: '',
        scope: '',
        probability: 1.0,
        impactAmount: 0,
        mitigationCost: 0,
        residualProbability: 1.0,
        residualImpactAmount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      toast.success("Record added (Default Prob 100%)");
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'riskRecords');
    }
  };

  const handleBulkUpdateRecords = async () => {
    if (selectedRecordIds.size === 0 || !selectedRiskId) return;
    try {
      const batch = writeBatch(db);
      const updates: any = { updatedAt: new Date().toISOString() };
      if (bulkRecordUpdateData.costCodeId) updates.costCodeId = bulkRecordUpdateData.costCodeId;
      if (bulkRecordUpdateData.scope) updates.scope = bulkRecordUpdateData.scope;
      if (bulkRecordUpdateData.probability) updates.probability = Number(bulkRecordUpdateData.probability) > 1 ? Number(bulkRecordUpdateData.probability) / 100 : Number(bulkRecordUpdateData.probability);
      if (bulkRecordUpdateData.impactAmount) updates.impactAmount = Number(bulkRecordUpdateData.impactAmount);
      if (bulkRecordUpdateData.mitigationCost) updates.mitigationCost = Number(bulkRecordUpdateData.mitigationCost);
      if (bulkRecordUpdateData.residualProbability) updates.residualProbability = Number(bulkRecordUpdateData.residualProbability) > 1 ? Number(bulkRecordUpdateData.residualProbability) / 100 : Number(bulkRecordUpdateData.residualProbability);
      if (bulkRecordUpdateData.residualImpactAmount) updates.residualImpactAmount = Number(bulkRecordUpdateData.residualImpactAmount);

      selectedRecordIds.forEach(id => {
        batch.update(doc(db, 'riskRecords', id), updates);
      });
      await batch.commit();
      await updateParentTotals(selectedRiskId);
      toast.success("Updated Successfully");
      setIsBulkRecordUpdateOpen(false);
      setSelectedRecordIds(new Set());
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'riskRecords/bulk');
    }
  };

  const handleBulkDeleteRecords = async () => {
    if (selectedRecordIds.size === 0 || !selectedRiskId) return;
    try {
      const batch = writeBatch(db);
      selectedRecordIds.forEach(id => {
        batch.delete(doc(db, 'riskRecords', id));
      });
      await batch.commit();
      await updateParentTotals(selectedRiskId);
      toast.success("Deleted Successfully");
      setIsBulkRecordDeleteOpen(false);
      setSelectedRecordIds(new Set());
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'riskRecords/bulk');
    }
  };

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
        <div className="grid grid-cols-4 gap-4 p-6 bg-gray-50 dark:bg-white/5 border-b border-gray-200 dark:border-white/10 shrink-0">
          <div className="bg-white dark:bg-[#1a1a1a] p-4 rounded-xl border border-gray-200 dark:border-white/10">
            <h4 className="text-xs font-bold text-gray-500 uppercase mb-1">Total Initial EMV</h4>
            <div className="flex items-center justify-between">
              <span className="text-xl font-bold text-red-600">{formatCurrency(risks.reduce((sum, r) => sum + (r.exposure || 0), 0))}</span>
              <AlertTriangle className="w-5 h-5 text-red-500 opacity-20" />
            </div>
          </div>
          <div className="bg-white dark:bg-[#1a1a1a] p-4 rounded-xl border border-gray-200 dark:border-white/10">
            <h4 className="text-xs font-bold text-gray-500 uppercase mb-1">Total Mitigation Cost</h4>
            <div className="flex items-center justify-between">
              <span className="text-xl font-bold dark:text-white">{formatCurrency(risks.reduce((sum, r) => sum + (r.mitigation || 0), 0))}</span>
              <ShieldCheck className="w-5 h-5 text-emerald-500 opacity-20" />
            </div>
          </div>
          <div className="bg-white dark:bg-[#1a1a1a] p-4 rounded-xl border border-gray-200 dark:border-white/10">
            <h4 className="text-xs font-bold text-gray-500 uppercase mb-1">Total Residual EMV</h4>
            <div className="flex items-center justify-between">
              <span className="text-xl font-bold text-blue-600">{formatCurrency(risks.reduce((sum, r) => sum + (r.residualExposure || 0), 0))}</span>
              <Activity className="w-5 h-5 text-blue-500 opacity-20" />
            </div>
          </div>
          <div className="bg-white dark:bg-[#1a1a1a] p-4 rounded-xl border border-gray-200 dark:border-white/10">
            <h4 className="text-xs font-bold text-gray-500 uppercase mb-1">Risk Reduction</h4>
            <div className="flex items-center justify-between">
              {(() => {
                const initial = risks.reduce((sum, r) => sum + (r.exposure || 0), 0);
                const residual = risks.reduce((sum, r) => sum + (r.residualExposure || 0), 0);
                const reduction = initial - residual;
                const percent = initial > 0 ? (reduction / initial) * 100 : 0;
                return (
                  <>
                    <span className="text-xl font-bold text-emerald-600">+{percent.toFixed(1)}%</span>
                    <TrendingUp className="w-5 h-5 text-emerald-500 opacity-20" />
                  </>
                );
              })()}
            </div>
          </div>
        </div>

        <div className="flex-1 relative">
          <div className={cn("absolute inset-0 ag-theme-quartz", theme === 'dark' ? "ag-theme-quartz-dark" : "")}>
            <AgGridReact
              ref={gridRef} rowData={risks} columnDefs={riskColumnDefs} quickFilterText={quickFilterText}
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
          <motion.div initial={{ height: 0 }} animate={{ height: isMainTableCollapsed ? 'calc(100% - 60px)' : '60%' }} exit={{ height: 0 }} className="border-t border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#0a0a0a] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 bg-gray-100 dark:bg-white/5 border-b border-gray-200 dark:border-white/10 shrink-0">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-bold uppercase tracking-wider dark:text-white">
                    Risk Impacts: <span className="text-blue-600 ml-1">{risks.find(r => r.id === selectedRiskId)?.riskId}</span>
                  </span>
                </div>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input 
                    type="text" placeholder="Search records..." value={recordsQuickFilterText} onChange={(e) => setRecordsQuickFilterText(e.target.value)}
                    className="pl-8 pr-3 py-1 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-lg text-[10px] w-48 dark:text-white outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input type="file" ref={recordFileInputRef} className="hidden" accept=".xlsx,.xls" onChange={handleImportRecords} />
                <button onClick={() => recordFileInputRef.current?.click()} className="p-1.5 text-gray-400 hover:text-black dark:hover:text-white transition-colors" title="Import Records"><Upload className="w-4 h-4" /></button>
                <button onClick={handleExportRecords} className="p-1.5 text-gray-400 hover:text-black dark:hover:text-white transition-colors" title="Export Records"><Download className="w-4 h-4" /></button>
                
                <div className="w-px h-4 bg-gray-200 dark:bg-white/10 mx-1" />
                
                <button onClick={() => toggleAllRecordColumnGroups(true)} className="p-1.5 text-gray-400 hover:text-black dark:hover:text-white transition-colors" title="Expand All"><Maximize2 className="w-3.5 h-3.5" /></button>
                <button onClick={() => toggleAllRecordColumnGroups(false)} className="p-1.5 text-gray-400 hover:text-black dark:hover:text-white transition-colors" title="Collapse All"><Minimize2 className="w-3.5 h-3.5" /></button>

                <div className="w-px h-4 bg-gray-200 dark:border-white/10 mx-1" />

                {selectedRecordIds.size > 0 && (
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => setIsBulkRecordUpdateOpen(true)} className="px-2 py-1 bg-blue-600 text-white rounded text-[10px] font-bold shadow-lg shadow-blue-600/20 hover:bg-blue-700">Update ({selectedRecordIds.size})</button>
                    <button onClick={() => setIsBulkRecordDeleteOpen(true)} className="px-2 py-1 bg-red-600 text-white rounded text-[10px] font-bold shadow-lg shadow-red-600/20 hover:bg-red-700">Delete ({selectedRecordIds.size})</button>
                  </div>
                )}
                <button onClick={handleAddRecord} className="flex items-center gap-1.5 px-3 py-1 bg-blue-600 text-white rounded-lg text-[10px] font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20"><Plus className="w-3 h-3" /> Add Impact</button>
                <button onClick={() => setSelectedRiskId(null)} className="p-1.5 hover:bg-gray-200 dark:hover:bg-white/10 rounded-lg transition-colors"><X className="w-4 h-4 dark:text-white" /></button>
              </div>
            </div>
            <div className="flex-1 relative ag-theme-quartz-dark">
              <AgGridReact 
                ref={recordsGridRef} rowData={riskRecords} columnDefs={recordColumnDefs}
                onCellValueChanged={onRecordCellValueChanged} quickFilterText={recordsQuickFilterText}
                pinnedBottomRowData={recordPinnedBottomRowData}
                rowSelection="multiple"
                onSelectionChanged={(p) => setSelectedRecordIds(new Set(p.api.getSelectedRows().map(r => r.id)))}
                defaultColDef={{ sortable: true, filter: true, resizable: true }}
              />
            </div>
          </motion.div>
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

      <Dialog open={isCreateRiskOpen} onOpenChange={setIsCreateRiskOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add New Risk</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Input placeholder="Risk ID (e.g. RSK-001)" value={newRisk.riskId} onChange={e => setNewRisk({...newRisk, riskId: e.target.value})} />
            <Input placeholder="Description" value={newRisk.description} onChange={e => setNewRisk({...newRisk, description: e.target.value})} />
            <div className="grid grid-cols-2 gap-4">
              <Select onValueChange={v => setNewRisk({...newRisk, status: v as any})} defaultValue="Open">
                <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Open">Open</SelectItem>
                  <SelectItem value="Mitigated">Mitigated</SelectItem>
                  <SelectItem value="Closed">Closed</SelectItem>
                  <SelectItem value="Realized">Realized</SelectItem>
                </SelectContent>
              </Select>
              <Select onValueChange={v => setNewRisk({...newRisk, strategy: v as any})} defaultValue="Mitigate">
                <SelectTrigger><SelectValue placeholder="Strategy" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Avoid">Avoid</SelectItem>
                  <SelectItem value="Mitigate">Mitigate</SelectItem>
                  <SelectItem value="Transfer">Transfer</SelectItem>
                  <SelectItem value="Accept">Accept</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" onClick={handleCreateRisk}>Create</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isBulkRecordUpdateOpen} onOpenChange={setIsBulkRecordUpdateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Bulk Update Risk Records</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto pr-2">
            <Input placeholder="Scope" value={bulkRecordUpdateData.scope} onChange={e => setBulkRecordUpdateData({...bulkRecordUpdateData, scope: e.target.value})} />
            <div className="grid grid-cols-2 gap-4">
              <Input type="number" placeholder="Prob % (0-100)" value={bulkRecordUpdateData.probability} onChange={e => setBulkRecordUpdateData({...bulkRecordUpdateData, probability: e.target.value})} />
              <Input type="number" placeholder="Impact $" value={bulkRecordUpdateData.impactAmount} onChange={e => setBulkRecordUpdateData({...bulkRecordUpdateData, impactAmount: e.target.value})} />
            </div>
            <Input type="number" placeholder="Mitigation Cost $" value={bulkRecordUpdateData.mitigationCost} onChange={e => setBulkRecordUpdateData({...bulkRecordUpdateData, mitigationCost: e.target.value})} />
            <div className="grid grid-cols-2 gap-4">
              <Input type="number" placeholder="Res. Prob % (0-100)" value={bulkRecordUpdateData.residualProbability} onChange={e => setBulkRecordUpdateData({...bulkRecordUpdateData, residualProbability: e.target.value})} />
              <Input type="number" placeholder="Res. Impact $" value={bulkRecordUpdateData.residualImpactAmount} onChange={e => setBulkRecordUpdateData({...bulkRecordUpdateData, residualImpactAmount: e.target.value})} />
            </div>
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
    </div>
  );
}
