import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useChangeRepo, useCostRepo, useAuthRepo } from '../platform/firestore/hooks';
import { Project, Enterprise, Change, ChangeRecord, CostCode } from '../types';
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
  History,
  Activity,
  Briefcase,
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
import { useChangeRollups } from '../lib/changeRollups';
import {
  buildChangeColumnDefs,
  buildChangeRecordColumnDefs,
} from './change-management/columns';
import ChangeRecordsPanel from './change-management/panels/ChangeRecordsPanel';
import ChangeFormDialog from './change-management/panels/ChangeFormDialog';
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


interface ChangeManagementProps {
  project: Project;
  enterprise: Enterprise;
}

export default function ChangeManagement({ project, enterprise }: ChangeManagementProps) {
  const changeRepo = useChangeRepo();
  const costRepo = useCostRepo();
  const authRepo = useAuthRepo();
  const [changes, setChanges] = useState<Change[]>([]);
  const [changeRecords, setChangeRecords] = useState<ChangeRecord[]>([]);
  const [costCodes, setCostCodes] = useState<CostCode[]>([]);

  // Phase 13.B1.6: compute-on-read budget/eac totals (SYSTEM_REVIEW.md v2 / PLAN.md F1).
  // Replaces the stored budget/eac fields and updateParentTotals() (duplicated in
  // BulkChangeRecords.tsx too). Neither field was ever editable in this grid.
  const changeRollups = useChangeRollups(project.id, changes);
  const changesWithRollups = useMemo(
    () => changes.map((c) => ({ ...c, ...changeRollups.get(c.id) })),
    [changes, changeRollups],
  );
  const [isLoading, setIsLoading] = useState(true);
  const [selectedChangeId, setSelectedChangeId] = useState<string | null>(null);
  const [quickFilterText, setQuickFilterText] = useState('');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isChartsVisible, setIsChartsVisible] = useState(false);
  const [chartMetric, setChartMetric] = useState<'budget' | 'eac'>('budget');

  // Modal States
  const [isCreateChangeOpen, setIsCreateChangeOpen] = useState(false);
  const [isDeleteChangeOpen, setIsDeleteChangeOpen] = useState(false);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [changeToDelete, setChangeToDelete] = useState<Change | null>(null);

  const [newChange, setNewChange] = useState({
    changeId: '',
    description: '',
    status: 'Pending' as Change['status'],
    initiator: '',
    reference: '',
    periodId: '',
  });

  const [isMainTableCollapsed, setIsMainTableCollapsed] = useState(false);

  const gridRef = useRef<AgGridReact>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

    // Sort periods by start date to ensure correct chronological order
    const periods = [...project.reportingPeriods.periods].sort((a, b) => 
      new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
    );
    
    let cumulativeBudget = 0;
    let cumulativeEac = 0;

    const data = periods.map((p, index) => {
      const periodChanges = changesWithRollups.filter(c => c.periodId === p.id);
      const budget = periodChanges.reduce((sum, c) => sum + (c.budget || 0), 0);
      const eac = periodChanges.reduce((sum, c) => sum + (c.eac || 0), 0);
      
      cumulativeBudget += budget;
      cumulativeEac += eac;

      // Format date label (e.g., Aug'26)
      const date = new Date(p.startDate);
      const month = date.toLocaleString('en-US', { month: 'short' });
      const year = date.getFullYear().toString().slice(-2);
      const dateLabel = `${month}'${year}`;

      return {
        name: `P${index + 1} (${dateLabel})`,
        budget,
        eac,
        cumulativeBudget,
        cumulativeEac
      };
    });

    return data;
  }, [changesWithRollups, project.reportingPeriods]);

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

  useEffect(() => {
    const root = document.documentElement;
    setTheme(root.classList.contains('dark') ? 'dark' : 'light');
  }, []);

  // Fetch Changes
  useEffect(() => {
    return changeRepo.subscribeChanges(project.id, (data) => {
      setChanges(data);
      setIsLoading(false);
    });
  }, [project.id]);

  // Fetch all change records for project; filter by selectedChangeId
  const [allChangeRecords, setAllChangeRecords] = useState<ChangeRecord[]>([]);
  useEffect(() => {
    return changeRepo.subscribeChangeRecords(project.id, setAllChangeRecords);
  }, [project.id]);
  useEffect(() => {
    if (!selectedChangeId) { setChangeRecords([]); return; }
    setChangeRecords(allChangeRecords.filter(r => r.changeId === selectedChangeId));
  }, [selectedChangeId, allChangeRecords]);

  // Fetch Cost Codes for dropdown
  useEffect(() => {
    return costRepo.subscribeCostCodes(project.id, (data) => {
      setCostCodes([...data].sort((a, b) => a.sortOrder - b.sortOrder));
    });
  }, [project.id]);

  const handleCreateChange = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!newChange.changeId.trim()) {
      toast.error("Change ID is required");
      return;
    }
    if (newChange.changeId.length > 20) {
      toast.error("Change ID must be max 20 characters");
      return;
    }
    
    // Unique check
    const isDuplicate = changes.some(c => c.changeId.toLowerCase() === newChange.changeId.toLowerCase());
    if (isDuplicate) {
      toast.error("Change ID must be unique per project");
      return;
    }

    try {
      const changeData: Omit<Change, 'id'> = {
        projectId: project.id,
        changeId: newChange.changeId.trim(),
        description: newChange.description,
        type: '',
        status: newChange.status,
        initiator: newChange.initiator.slice(0, 50),
        reference: newChange.reference.slice(0, 50),
        budget: 0,
        eac: 0,
        periodId: newChange.periodId,
        enterpriseAttributes: {},
        projectAttributes: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await changeRepo.createChange(changeData as any);
      toast.success("Change created successfully");
      setIsCreateChangeOpen(false);
      setNewChange({ changeId: '', description: '', status: 'Pending', initiator: '', reference: '', periodId: '' });
    } catch (error) {
      console.error(error);
      toast.error("Failed to create change");
    }
  };

  const handleDeleteChange = async () => {
    if (!changeToDelete) return;
    try {
      const recordIds = allChangeRecords.filter(r => r.changeId === changeToDelete.id).map(r => r.id);
      await Promise.all(recordIds.map(id => changeRepo.deleteChangeRecord(id)));
      await changeRepo.deleteChange(changeToDelete.id);
      toast.success("Change and associated records deleted");
      setIsDeleteChangeOpen(false);
      setChangeToDelete(null);
      if (selectedChangeId === changeToDelete.id) setSelectedChangeId(null);
      setSelectedIds(prev => { const next = new Set(prev); next.delete(changeToDelete.id); return next; });
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete change");
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    try {
      for (const id of selectedIds) {
        const recordIds = allChangeRecords.filter(r => r.changeId === id).map(r => r.id);
        await Promise.all(recordIds.map(rid => changeRepo.deleteChangeRecord(rid)));
        await changeRepo.deleteChange(id);
      }
      toast.success(`Deleted ${selectedIds.size} changes`);
      setSelectedIds(new Set());
      setIsBulkDeleteOpen(false);
      if (selectedChangeId && selectedIds.has(selectedChangeId)) setSelectedChangeId(null);
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete changes");
    }
  };

  const toggleAllChangeColumnGroups = (opened: boolean) => {
    if (!gridRef.current) return;
    const api = gridRef.current.api;
    const groups = api.getColumnGroupState();
    const newState = groups.map(g => ({
      groupId: g.groupId,
      open: opened
    }));
    api.setColumnGroupState(newState);
  };

  const changesPinnedBottomRowData = useMemo(() => {
    if (changesWithRollups.length === 0) return [];
    const totalBudget = changesWithRollups.reduce((sum, c) => sum + (Number(c.budget) || 0), 0);
    const totalEac = changesWithRollups.reduce((sum, c) => sum + (Number(c.eac) || 0), 0);
    return [{
      changeId: 'Total',
      budget: totalBudget,
      eac: totalEac,
      isTotalRow: true
    }];
  }, [changesWithRollups]);

  const handleExport = () => {
    const exportData = changesWithRollups.map(c => {
      const row: any = {
        'Change ID': c.changeId,
        'Description': c.description,
        'Status': c.status,
        'Initiator': c.initiator,
        'Reference': c.reference,
        'Budget': c.budget,
        'EAC': c.eac
      };
      
      // Add Enterprise Change Attributes
      enterprise.changeAttributes?.forEach(attr => {
        const val = c.enterpriseAttributes?.[attr.id];
        const v = attr.values.find(v => v.id === val);
        row[`[E] ${attr.title}`] = v ? `${v.id} - ${v.description}` : val || '';
      });
      
      // Add Project Change Attributes
      project.changeAttributes?.forEach(attr => {
        const val = c.projectAttributes?.[attr.id];
        const v = attr.values.find(v => v.id === val);
        row[`[P] ${attr.title}`] = v ? `${v.id} - ${v.description}` : val || '';
      });
      
      return row;
    });
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Changes");
    XLSX.writeFile(wb, `Changes_${project.projectName}_${new Date().toISOString().split('T')[0]}.xlsx`);
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

        const importCreates: any[] = [];
        let addedCount = 0;
        let duplicateCount = 0;

        for (const row of data) {
          const changeId = String(row['Change ID'] || '').trim();
          if (!changeId) continue;
          const isDuplicate = changes.some(c => c.changeId.toLowerCase() === changeId.toLowerCase());
          if (isDuplicate) { duplicateCount++; continue; }

          const entAttrs: Record<string, string> = {};
          enterprise.changeAttributes?.forEach(attr => {
            const key = `[E] ${attr.title}`;
            if (row[key]) entAttrs[attr.id] = String(row[key]).split(' - ')[0];
          });

          const prjAttrs: Record<string, string> = {};
          project.changeAttributes?.forEach(attr => {
            const key = `[P] ${attr.title}`;
            if (row[key]) prjAttrs[attr.id] = String(row[key]).split(' - ')[0];
          });

          importCreates.push({ projectId: project.id, changeId: changeId.slice(0, 20), description: row['Description'] || '', type: '', status: row['Status'] || 'Pending', initiator: String(row['Initiator'] || '').slice(0, 50), reference: String(row['Reference'] || '').slice(0, 50), budget: Number(row['Budget']) || 0, eac: Number(row['EAC']) || 0, enterpriseAttributes: entAttrs, projectAttributes: prjAttrs });
          addedCount++;
        }

        if (addedCount > 0) {
          await Promise.all(importCreates.map(c => changeRepo.createChange(c)));
          toast.success(`Imported ${addedCount} changes. ${duplicateCount > 0 ? `${duplicateCount} duplicates skipped.` : ''}`);
        } else if (duplicateCount > 0) {
          toast.warning(`No changes added. ${duplicateCount} duplicates found.`);
        }
      } catch (error) {
        toast.error("Failed to import Excel file");
        console.error(error);
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const enterpriseLineItemAttrs = useMemo(() => 
    (enterprise.lineItemAttributes || []).filter(attr => attr.title && attr.title.trim() !== '' && attr.values && attr.values.length > 0),
    [enterprise.lineItemAttributes]
  );

  const projectLineItemAttrs = useMemo(() => 
    (project.lineItemAttributes || []).filter(attr => attr.title && attr.title.trim() !== '' && attr.values && attr.values.length > 0),
    [project.lineItemAttributes]
  );

  const onCellValueChanged = async (params: CellValueChangedEvent) => {
    const { data, colDef } = params;
    if (!data.id) return;

    try {
      let updates: any = {
        [colDef.field!]: params.newValue,
        updatedAt: new Date().toISOString()
      };
      
      // Handle attribute updates
      if (colDef.field?.startsWith('enterpriseAttributes.') || colDef.field?.startsWith('projectAttributes.')) {
        const parts = colDef.field.split('.');
        const attrField = parts[0];
        const attrId = parts[1];
        updates = {
          [`${attrField}.${attrId}`]: params.newValue,
          updatedAt: new Date().toISOString()
        };
      }

      // Enforce character limits
      if (colDef.field === 'initiator' || colDef.field === 'reference') {
        updates[colDef.field] = String(params.newValue).slice(0, 50);
      }

      await changeRepo.updateChange(data.id, updates);
    } catch (error) {
      console.error(error);
      toast.error("Failed to update");
    }
  };

  const onRecordCellValueChanged = async (params: CellValueChangedEvent) => {
    const { data, colDef } = params;
    if (!data.id) return;
    try {
      let updates: any = { [colDef.field!]: params.newValue };
      if (colDef.field?.startsWith('enterpriseAttributes.') || colDef.field?.startsWith('projectAttributes.')) {
        const [attrField, attrId] = colDef.field.split('.');
        updates = { [`${attrField}.${attrId}`]: params.newValue };
      }
      if (colDef.field === 'scope') updates.scope = String(params.newValue).slice(0, 100);
      await changeRepo.updateChangeRecord(data.id, updates);
    } catch (error) {
      console.error(error);
      toast.error("Failed to update record");
    }
  };

  const enterpriseChangeAttrs = (enterprise.changeAttributes || []).filter(
    attr => attr.title && attr.title.trim() !== '' && attr.values && attr.values.length > 0
  );
  const projectChangeAttrs = (project.changeAttributes || []).filter(
    attr => attr.title && attr.title.trim() !== '' && attr.values && attr.values.length > 0
  );

  const changeColumnDefs = buildChangeColumnDefs({
    reportingPeriodsList: project.reportingPeriods?.periods || [],
    enterpriseChangeAttrs,
    projectChangeAttrs,
    setSelectedChangeId,
    setChangeToDelete,
    setIsDeleteChangeOpen,
  });

  const recordColumnDefs = useMemo(
    () =>
      buildChangeRecordColumnDefs({
        costCodes,
        enterpriseLineItemAttrs,
        projectLineItemAttrs,
        deleteChangeRecord: (id) => changeRepo.deleteChangeRecord(id),
      }),
    [costCodes, enterpriseLineItemAttrs, projectLineItemAttrs]
  );

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-[#141414] border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden">
      {/* Header / Toolbar */}
      <div className="p-6 border-b border-gray-100 dark:border-white/10 flex justify-between items-center bg-gray-50/50 dark:bg-white/5 shrink-0">
        <div className="flex items-center gap-8">
          <div>
            <h3 className="text-xl font-bold dark:text-white">Change Management</h3>
            <p className="text-sm text-gray-900 dark:text-gray-400">Manage project changes and their cost impacts.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search changes..."
              value={quickFilterText}
              onChange={(e) => setQuickFilterText(e.target.value)}
              className="pl-10 pr-4 py-2 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none w-64 dark:text-white"
            />
          </div>
          
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept=".xlsx,.xls,.csv"
            onChange={handleImport}
          />
          
          <button onClick={() => fileInputRef.current?.click()} className="p-2 text-gray-400 hover:text-black dark:hover:text-white transition-colors" title="Import"><Upload className="w-5 h-5" /></button>
          <button onClick={handleExport} className="p-2 text-gray-400 hover:text-black dark:hover:text-white transition-colors" title="Export"><Download className="w-5 h-5" /></button>
          
          <div className="w-px h-6 bg-gray-200 dark:bg-white/10 mx-1" />
          
          <button 
            onClick={() => toggleAllChangeColumnGroups(true)}
            className="p-2 text-gray-400 hover:text-black dark:hover:text-white transition-colors"
            title="Expand All Groups"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          <button 
            onClick={() => toggleAllChangeColumnGroups(false)}
            className="p-2 text-gray-400 hover:text-black dark:hover:text-white transition-colors"
            title="Collapse All Groups"
          >
            <Minimize2 className="w-4 h-4" />
          </button>
          
          <div className="w-px h-6 bg-gray-200 dark:bg-white/10 mx-1" />
          
          <button 
            onClick={() => setIsChartsVisible(!isChartsVisible)}
            className={cn(
              "p-2 rounded-lg transition-all",
              isChartsVisible 
                ? "bg-black text-white dark:bg-white dark:text-black shadow-lg" 
                : "text-gray-400 hover:text-black dark:hover:text-white"
            )}
            title={isChartsVisible ? "Hide Charts" : "Show Charts"}
          >
            <BarChart3 className="w-5 h-5" />
          </button>

          {selectedIds.size > 0 && (
            <div className="flex gap-2">
              <select 
                onChange={async (e) => {
                  const newStatus = e.target.value;
                  if (!newStatus) return;
                  try {
                    await changeRepo.updateManyChanges([...selectedIds].map(id => ({ id, data: { status: newStatus as any } })));
                    toast.success(`Updated ${selectedIds.size} changes to ${newStatus}`);
                    e.target.value = '';
                  } catch (error) {
                    toast.error("Failed to bulk update");
                  }
                }}
                className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs font-bold outline-none dark:text-white"
              >
                <option value="">Bulk Update Status</option>
                <option value="Approved">Approved</option>
                <option value="Pending">Pending</option>
                <option value="Rejected">Rejected</option>
                <option value="Withdrawn">Withdrawn</option>
              </select>

              <button 
                onClick={() => setIsBulkDeleteOpen(true)}
                className="px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-red-700 transition-colors shadow-lg shadow-red-600/20"
              >
                <Trash2 className="w-4 h-4" /> Delete ({selectedIds.size})
              </button>
            </div>
          )}

          <button 
            onClick={() => setIsCreateChangeOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-black dark:bg-white text-white dark:text-black rounded-xl text-sm font-bold hover:bg-black/90 dark:hover:bg-white/90 transition-all shadow-lg shadow-black/10 dark:shadow-white/10"
          >
            <Plus className="w-4 h-4" />
            Add
          </button>
        </div>
      </div>

      {/* Table Area */}
      <div className={cn(
        "flex flex-col transition-all duration-500 ease-in-out overflow-hidden",
        selectedChangeId 
          ? (isMainTableCollapsed ? "h-[60px]" : "h-[40%]") 
          : "flex-1"
      )}>
        <div className="flex items-center justify-between px-4 py-2 bg-gray-100 dark:bg-white/5 border-b border-gray-200 dark:border-white/10">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Layout className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-bold uppercase tracking-wider dark:text-white">Changes List</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Approved</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-amber-500" />
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Pending</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {selectedChangeId && (
              <button 
                onClick={() => setIsMainTableCollapsed(!isMainTableCollapsed)}
                className="p-1.5 hover:bg-gray-200 dark:hover:bg-white/10 rounded-lg transition-colors"
                title={isMainTableCollapsed ? "Expand Table" : "Collapse Table"}
              >
                {isMainTableCollapsed ? <ChevronDown className="w-4 h-4 dark:text-white" /> : <ChevronUp className="w-4 h-4 dark:text-white" />}
              </button>
            )}
          </div>
        </div>

        {/* Charts Section */}
        <AnimatePresence>
          {isChartsVisible && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="shrink-0 overflow-hidden bg-gray-50/50 dark:bg-white/5 border-b border-gray-200 dark:border-white/10"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <h3 className="text-sm font-bold dark:text-white uppercase tracking-widest text-gray-400">
                      {chartMetric === 'budget' ? 'Budget' : 'EAC'} Changes by Period
                    </h3>
                    <div className="flex bg-gray-200 dark:bg-white/10 p-1 rounded-lg">
                      <button
                        onClick={() => setChartMetric('budget')}
                        className={cn(
                          "px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all",
                          chartMetric === 'budget' 
                            ? "bg-white dark:bg-[#141414] text-blue-600 shadow-sm" 
                            : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                        )}
                      >
                        Budget
                      </button>
                      <button
                        onClick={() => setChartMetric('eac')}
                        className={cn(
                          "px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all",
                          chartMetric === 'eac' 
                            ? "bg-white dark:bg-[#141414] text-emerald-600 shadow-sm" 
                            : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                        )}
                      >
                        EAC
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <div className={cn("w-3 h-3 rounded-sm", chartMetric === 'budget' ? "bg-blue-500" : "bg-emerald-500")} />
                      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                        {chartMetric === 'budget' ? 'Budget Amount' : 'EAC Amount'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={cn("w-3 h-0.5", chartMetric === 'budget' ? "bg-blue-400" : "bg-emerald-400")} />
                      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Cumulative</span>
                    </div>
                  </div>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#333' : '#eee'} />
                      <XAxis 
                        dataKey="name" 
                        fontSize={10} 
                        tick={{ fill: '#9ca3af' }} 
                        axisLine={false} 
                        tickLine={false} 
                      />
                      <YAxis 
                        yAxisId="left"
                        fontSize={10} 
                        tick={{ fill: '#9ca3af' }} 
                        axisLine={false} 
                        tickLine={false} 
                        tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`}
                        domain={[0, 'auto']}
                      />
                      <YAxis 
                        yAxisId="right"
                        orientation="right"
                        fontSize={10} 
                        tick={{ fill: '#9ca3af' }} 
                        axisLine={false} 
                        tickLine={false} 
                        tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`}
                        domain={[0, 'auto']}
                      />
                      <Tooltip 
                        contentStyle={{ backgroundColor: theme === 'dark' ? '#1a1a1a' : '#fff', border: 'none', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                        formatter={(v: number) => formatCurrency(v)}
                      />
                      <Bar 
                        yAxisId="left"
                        dataKey={chartMetric} 
                        fill={chartMetric === 'budget' ? "#3B82F6" : "#10B981"} 
                        radius={[4, 4, 0, 0]} 
                        barSize={40} 
                      />
                      <Line 
                        yAxisId="right"
                        type="monotone" 
                        dataKey={chartMetric === 'budget' ? "cumulativeBudget" : "cumulativeEac"} 
                        stroke={chartMetric === 'budget' ? "#60A5FA" : "#34D399"} 
                        strokeWidth={2} 
                        dot={{ fill: chartMetric === 'budget' ? "#60A5FA" : "#34D399", r: 4 }} 
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex-1 relative">
          <div className={cn(
            "absolute inset-0 ag-theme-quartz",
            theme === 'dark' ? "ag-theme-quartz-dark" : ""
          )}>
            <AgGridReact
              theme="legacy"
              ref={gridRef}
              rowData={changesWithRollups}
              columnDefs={changeColumnDefs}
              pinnedTopRowData={changesPinnedBottomRowData}
              groupDefaultExpanded={-1}
              getRowClass={(params) => {
                if (params.node.rowPinned) return 'pinned-row-highlight';
                return '';
              }}
              quickFilterText={quickFilterText}
              onCellValueChanged={onCellValueChanged}
              onSelectionChanged={(p) => {
                const selectedRows = p.api.getSelectedRows();
                const displayedSelected = selectedRows.filter(row => {
                  const node = p.api.getRowNode(row.id);
                  return node && node.displayed;
                });
                setSelectedIds(new Set(displayedSelected.map(r => r.id)));
              }}
              onFilterChanged={(p) => {
                const selectedRows = p.api.getSelectedRows();
                const displayedSelected = selectedRows.filter(row => {
                  const node = p.api.getRowNode(row.id);
                  return node && node.displayed;
                });
                setSelectedIds(new Set(displayedSelected.map(r => r.id)));
              }}
              getRowId={(params) => params.data.id}
              rowSelection="multiple"
              suppressRowClickSelection={true}
              sideBar={sideBar}
              statusBar={statusBar}
              rowGroupPanelShow="always"
              pivotPanelShow="always"
              groupDisplayType="multipleColumns"
              enableRangeSelection={true}
              enableFillHandle={true}
              undoRedoCellEditing={true}
              animateRows={true}
              defaultColDef={{
                sortable: true,
                filter: true,
                resizable: true,
                enableRowGroup: true,
                enablePivot: true,
                enableValue: true,
              }}
            />
          </div>
        </div>
      </div>

      <ChangeRecordsPanel
        project={project}
        enterprise={enterprise}
        theme={theme}
        selectedChangeId={selectedChangeId}
        onClose={() => setSelectedChangeId(null)}
        changes={changes}
        changeRecords={changeRecords}
        costCodes={costCodes}
        isMainTableCollapsed={isMainTableCollapsed}
        recordColumnDefs={recordColumnDefs}
        onCellValueChanged={onRecordCellValueChanged}
      />

      <ChangeFormDialog
        project={project}
        isOpen={isCreateChangeOpen}
        onOpenChange={setIsCreateChangeOpen}
        newChange={newChange}
        setNewChange={setNewChange}
        onSubmit={handleCreateChange}
      />

      {/* Delete Confirmation */}
      <Dialog open={isDeleteChangeOpen} onOpenChange={setIsDeleteChangeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              Confirm Deletion
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete change <span className="font-bold">"{changeToDelete?.changeId}"</span>? This will also delete all associated change records. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteChangeOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteChange}>Delete Change</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Confirmation */}
      <Dialog open={isBulkDeleteOpen} onOpenChange={setIsBulkDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              Confirm Bulk Deletion
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <span className="font-bold">{selectedIds.size}</span> selected changes? This will also delete all associated change records. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBulkDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleBulkDelete}>Delete Selected</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
