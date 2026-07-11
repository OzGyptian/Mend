import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useCostRepo, useAuthRepo, useScheduleRepo, useChangeRepo, useRiskRepo, useSubcontractRepo, useProjectRepo } from '../platform/firestore/hooks';
import { createPortal } from 'react-dom';
import { Project, Enterprise, CostCode, SavedView, Calendar as ProjectCalendar, Change, ChangeRecord, Subcontract, ScheduleItem } from '../types';
import {
  Calendar,
  Search,
  Trash2,
  Edit2,
  X,
  Download,
  Filter,
  Layout,
  Lock,
  Unlock,
  Hash,
  Eye,
  Maximize2,
  Minimize2,
  MoreVertical,
  PieChart,
  ChevronRight,
  ChevronLeft,
  List,
  RefreshCw,
  FileText,
  ChevronDown,
  ChevronUp,
  Layers,
  Settings,
  History,
  Target,
  Columns,
  RotateCcw,
  ArrowUp,
  Calculator,
  ArrowDown,
  ClipboardList,
  Activity,
  DollarSign,
  Database,
  CheckCircle2,
  BarChart3,
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Line, 
  ComposedChart,
  Area,
  Cell,
  Legend,
  LabelList
} from 'recharts';
import * as XLSX from 'xlsx';
import { cn, formatCurrency, formatNumber } from '../lib/utils';
import { useCostCodeRollups } from '../lib/costCodeRollups';
import { calculatePhasing } from '../domain/phasing';
import { isWorkingDay as domainIsWorkingDay } from '../domain/procurement';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { AgGridReact } from 'ag-grid-react';
import DataGridModule from './DataGridModule';
import { 
  ColDef, 
  ColGroupDef,
  GridReadyEvent, 
  GridApi,
  CellValueChangedEvent,
  RowDataUpdatedEvent,
  ValueFormatterParams,
  ICellRendererParams,
  RowGroupingDisplayType
} from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';
import 'ag-grid-enterprise';
import { ActionsCellRenderer } from './cost-codes/CostCodesCellRenderers';
import {
  buildEtcColumnDefs,
  buildTimephasingColumnDefs,
  buildActualsColumnDefs,
  buildBaselineColumnDefs,
  buildMainColumnDefs,
  buildSubcontractBreakdownColumnDefs,
  buildChangesColumnDefs,
} from './cost-codes/columns';
import EtcDetailsPanel from './cost-codes/panels/EtcDetailsPanel';
import TimephasingPanel from './cost-codes/panels/TimephasingPanel';
import ActualsPanel from './cost-codes/panels/ActualsPanel';
import SubcontractBreakdownPanel from './cost-codes/panels/SubcontractBreakdownPanel';
import ChangesPanel from './cost-codes/panels/ChangesPanel';
import CostCodeFormDialog from './cost-codes/CostCodeFormDialog';
import ImportPreviewDialog from './cost-codes/ImportPreviewDialog';

interface CostCodesProps {
  project: Project;
  enterprise: Enterprise;
  theme?: 'light' | 'dark';
}

// ActionsCellRenderer is defined in ./cost-codes/CostCodesCellRenderers.tsx

export default function CostCodes({ project, enterprise, theme = 'light' }: CostCodesProps) {
  const costRepo = useCostRepo();
  const authRepo = useAuthRepo();
  const scheduleRepo = useScheduleRepo();
  const changeRepo = useChangeRepo();
  const riskRepo = useRiskRepo();
  const subcontractRepo = useSubcontractRepo();
  const projectRepo = useProjectRepo();
  const navigate = useNavigate();
  const [costCodes, setCostCodes] = useState<CostCode[]>([]);
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>([]);
  const [calendars, setCalendars] = useState<ProjectCalendar[]>([]);
  const [loading, setLoading] = useState(true);

  // Phase 13.B1.5: compute-on-read financial roll-ups (SYSTEM_REVIEW.md v2 / PLAN.md F1).
  // Replaces the stored baselineBudget/approvedBudget/actualCostToDate/estimateAtCompletion/
  // costVariance (+movements) fields and the "Recalculate" button — those fields are always
  // live-computed from leaves now, never stale. estimateAtCompletion stays user-editable when
  // eacMethod === 'Manual' (it's a genuine leaf in that mode, not a derived value); every other
  // roll-up field was already read-only in the grid (see cost-codes/columns.tsx editable flags),
  // so this changes nothing about what users can type into cells.
  const costCodeRollups = useCostCodeRollups(project, costCodes);
  const costCodesWithRollups = useMemo(
    () => costCodes.map((c) => ({ ...c, ...costCodeRollups.get(c.id) })),
    [costCodes, costCodeRollups],
  );
  
  // Table State
  const [quickFilterText, setQuickFilterText] = useState('');
  const [etcQuickFilterText, setEtcQuickFilterText] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedEtcIds, setSelectedEtcIds] = useState<Set<string>>(new Set());
  
  // UI State
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState<{ id: string | null; insertIndex?: number } | null>(null);
  const [formData, setFormData] = useState<Partial<CostCode>>({ 
    code: '', 
    name: '', 
    enterpriseAttributes: {}, 
    projectAttributes: {}, 
    eacMethod: 'Manual',
    assignedUsers: []
  });
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'single' | 'bulk'; id?: string; name?: string; count?: number } | null>(null);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [isEtcBulkUpdating, setIsEtcBulkUpdating] = useState(false);
  const [etcBulkUpdateData, setEtcBulkUpdateData] = useState<{
    category?: string;
    calendarId?: string;
    phasingMethod?: 'Manual' | 'Auto-Phase';
    phasingUnit?: 'Daily' | 'Weekly' | 'Monthly' | 'Total' | 'Profile';
    enterpriseAttributes: Record<string, string>;
    projectAttributes: Record<string, string>;
    userDefined: Record<string, any>;
  }>({
    enterpriseAttributes: {},
    projectAttributes: {},
    userDefined: {}
  });
  const [selectedEtcCode, setSelectedEtcCode] = useState<string | null>(null);
  const [selectedActualsCode, setSelectedActualsCode] = useState<string | null>(null);
  const [selectedTimephasingCode, setSelectedTimephasingCode] = useState<string | null>(null);
  const [selectedChangesCode, setSelectedChangesCode] = useState<string | null>(null);
  const [selectedBaselineCode, setSelectedBaselineCode] = useState<string | null>(null);
  const [riskRecords, setRiskRecords] = useState<any[]>([]);
  const [changeRecords, setChangeRecords] = useState<ChangeRecord[]>([]);
  const [allChanges, setAllChanges] = useState<Change[]>([]);
  const [isChangesLoading, setIsChangesLoading] = useState(false);
  const [importPreview, setImportPreview] = useState<{ data: any[] } | null>(null);
  const [changesQuickFilterText, setChangesQuickFilterText] = useState('');
  const [etcRows, setEtcRows] = useState<any[]>([]);
  const [actualsRows, setActualsRows] = useState<any[]>([]);
  const [baselineRows, setBaselineRows] = useState<any[]>([]);
  const [costPhasing, setCostPhasing] = useState<any[]>([]);
  const [timephasingRows, setTimephasingRows] = useState<any[]>([]);
  const [isEtcLoading, setIsEtcLoading] = useState(false);
  const [isActualsLoading, setIsActualsLoading] = useState(false);
  const [isBaselineLoading, setIsBaselineLoading] = useState(false);
  const [isTimephasingLoading, setIsTimephasingLoading] = useState(false);
  const [actualsQuickFilterText, setActualsQuickFilterText] = useState('');
  const [baselineQuickFilterText, setBaselineQuickFilterText] = useState('');
  const [timephasingQuickFilterText, setTimephasingQuickFilterText] = useState('');
  const [isActualsChartVisible, setIsActualsChartVisible] = useState(false);
  const [isTimephasingChartVisible, setIsTimephasingChartVisible] = useState(false);
  const [timephasingChartMode, setTimephasingChartMode] = useState<'value' | 'percent'>('value');
  const [isMainTableCollapsed, setIsMainTableCollapsed] = useState(false);
  const [weekEndingDay] = useState<number>(0); // 0: Sun, 5: Fri, 6: Sat
  const [subcontracts, setSubcontracts] = useState<Subcontract[]>([]);
  const [selectedSubcontractBreakdownCode, setSelectedSubcontractBreakdownCode] = useState<string | null>(null);
  const [subcontractQuickFilterText, setSubcontractQuickFilterText] = useState('');

  const dateFormatter = useCallback((params: any) => {
    if (!params.value) return '';
    const date = params.value instanceof Date ? params.value : new Date(params.value);
    if (isNaN(date.getTime())) return '';
    
    // Use local time for display to avoid UTC shifts
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }, []);

  const safeDateSetter = useCallback((field: string) => (params: any) => {
    const val = params.newValue;
    if (!val) {
      params.data[field] = '';
      return true;
    }
    
    const date = val instanceof Date ? val : new Date(val);
    if (isNaN(date.getTime())) {
      console.warn('Invalid date entered:', val);
      return false;
    }

    // Convert to YYYY-MM-DD in local time to avoid UTC shifts
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    params.data[field] = `${y}-${m}-${d}`;
    return true;
  }, []);

  const subcontractBreakdownRows = useMemo(() => {
    if (!selectedSubcontractBreakdownCode) return [];
    
    const targetCode = costCodes.find(c => 
      c.code.trim().toUpperCase() === selectedSubcontractBreakdownCode.trim().toUpperCase()
    );

    const matchCode = selectedSubcontractBreakdownCode.trim().toUpperCase();

    return subcontracts.flatMap(sub => 
      (sub.lineItems || [])
        .filter(li => {
          if (li.status === 'Rejected') return false;
          
          // Capture the assigned code, preferring line item level over subcontract default
          const rawId = li.costCodeId;
          const assignedCodeId = (rawId && rawId.trim() !== '') ? rawId : sub.defaultCostCodeId;
          
          if (!assignedCodeId) return false;

          const assignedClean = assignedCodeId.toString().trim().toUpperCase();
          // Extract the code portion in case it's in "CODE - NAME" format
          const assignedCodeOnly = assignedClean.split(' - ')[0].trim();

          // 1. Direct match with the selected code string (e.g., "E3")
          if (assignedClean === matchCode || assignedCodeOnly === matchCode) return true;
          
          // 2. Match with the full code object's internal ID or code string if found
          if (targetCode) {
            const targetId = (targetCode.id || '').toString().trim().toUpperCase();
            const targetCodeValue = (targetCode.code || '').toString().trim().toUpperCase();
            if (assignedClean === targetId || assignedCodeOnly === targetId || assignedClean === targetCodeValue || assignedCodeOnly === targetCodeValue) return true;
          }

          return false;
        })
        .map(li => ({
          ...li,
          subcontractId: sub.orderId,
          subcontractName: sub.orderName,
          vendorName: sub.vendorName
        }))
    );
  }, [subcontracts, selectedSubcontractBreakdownCode, costCodes]);

  const subcontractBreakdownPinnedBottomRowData = useMemo(() => {
    if (subcontractBreakdownRows.length === 0) return [];
    const total = subcontractBreakdownRows.reduce((sum, row) => sum + (Number(row.total) || 0), 0);
    return [{
      description: 'SubTotal',
      total: total
    }];
  }, [subcontractBreakdownRows]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const currencyFormatter = (params: ValueFormatterParams) => {
    if (params.value == null) return '';
    return formatCurrency(params.value);
  };

  const timephasingChartData = useMemo(() => {
    if (!project.reportingPeriods?.periods || timephasingRows.length === 0) return [];
    
    let cumulativeBaseline = 0;
    let cumulativeApproved = 0;
    let cumulativeEac = 0;
    let cumulativeEacPrevious = 0;

    const baselineRow = timephasingRows.find(r => r.id === 'baseline');
    const approvedRow = timephasingRows.find(r => r.id === 'approved');
    const eacRow = timephasingRows.find(r => r.id === 'eac');
    const eacPrevRow = timephasingRows.find(r => r.id === 'eacPrevious');

    const totalBaseline = baselineRow?.totalFromCode || 1;
    const totalApproved = approvedRow?.totalFromCode || 1;
    const totalEac = eacRow?.totalFromCode || 1;
    const totalEacPrev = eacPrevRow?.totalFromCode || 1;

    return project.reportingPeriods.periods.map(p => {
      const baseline = baselineRow?.periodValues?.[p.id] || 0;
      const approved = approvedRow?.periodValues?.[p.id] || 0;
      const eac = eacRow?.periodValues?.[p.id] || 0;
      const eacPrev = eacPrevRow?.periodValues?.[p.id] || 0;

      cumulativeBaseline += baseline;
      cumulativeApproved += approved;
      cumulativeEac += eac;
      cumulativeEacPrevious += eacPrev;
      
      const date = new Date(p.endDate);
      const month = date.toLocaleString('default', { month: 'short' });
      const year = date.getFullYear().toString().slice(-2);
      const periodNumber = project.reportingPeriods.periods.indexOf(p) + 1;
      const dateStr = `P${periodNumber} (${month}'${year})`;

      if (timephasingChartMode === 'percent') {
        return {
          name: dateStr,
          baseline: (baseline / totalBaseline) * 100,
          approved: (approved / totalApproved) * 100,
          eac: (eac / totalEac) * 100,
          eacPrevious: (eacPrev / totalEacPrev) * 100,
          cumulativeBaseline: (cumulativeBaseline / totalBaseline) * 100,
          cumulativeApproved: (cumulativeApproved / totalApproved) * 100,
          cumulativeEac: (cumulativeEac / totalEac) * 100,
          cumulativeEacPrevious: (cumulativeEacPrevious / totalEacPrev) * 100
        };
      }

      return {
        name: dateStr,
        baseline,
        approved,
        eac,
        eacPrevious: eacPrev,
        cumulativeBaseline,
        cumulativeApproved,
        cumulativeEac,
        cumulativeEacPrevious
      };
    });
  }, [project.reportingPeriods?.periods, timephasingRows, timephasingChartMode]);

  const actualsChartData = useMemo(() => {
    if (!project.reportingPeriods?.periods || actualsRows.length === 0) return [];
    
    // Aggregate actuals by reporting period
    const periodTotals: Record<string, number> = {};
    actualsRows.forEach(row => {
      const periodId = row.reportingPeriodId;
      if (periodId) {
        periodTotals[periodId] = (periodTotals[periodId] || 0) + (row.cost || 0);
      }
    });

    let cumulative = 0;
    return project.reportingPeriods.periods.map(p => {
      const cost = periodTotals[p.id] || 0;
      cumulative += cost;
      
      const date = new Date(p.endDate);
      const month = date.toLocaleString('default', { month: 'short' });
      const year = date.getFullYear().toString().slice(-2);
      const periodNumber = project.reportingPeriods.periods.indexOf(p) + 1;
      const dateStr = `P${periodNumber} (${month}'${year})`;

      return {
        name: dateStr,
        cost: Math.round(cost * 100) / 100,
        cumulative: Math.round(cumulative * 100) / 100
      };
    });
  }, [project.reportingPeriods, actualsRows]);

  const etcChartData = useMemo(() => {
    if (!project.reportingPeriods?.periods || etcRows.length === 0) return [];
    
    const selectedCostCodeObj = costCodes.find(c => c.code === selectedEtcCode);
    const initialActualCost = selectedCostCodeObj?.actualCostToDate || 0;
    
    const currentPeriodId = project.reportingPeriods?.currentPeriodId;
    const currentPeriodIndex = project.reportingPeriods?.periods.findIndex(p => p.id === currentPeriodId) ?? -1;
    const periods = project.reportingPeriods.periods.slice(currentPeriodIndex + 1);
    let cumulative = initialActualCost;
    
    return periods.map(p => {
      const periodCost = etcRows.reduce((sum, row) => {
        const qty = row.periodValues?.[p.id] || 0;
        const rate = row.rate || 0;
        return sum + (qty * rate);
      }, 0);
      const periodQty = etcRows.reduce((sum, row) => {
        return sum + (row.periodValues?.[p.id] || 0);
      }, 0);
      cumulative += periodCost;
      
      // Format date for Monthly
      const date = new Date(p.endDate);
      const month = date.toLocaleString('default', { month: 'short' });
      const year = date.getFullYear().toString().slice(-2);
      const periodNumber = periods.indexOf(p) + 1;
      const dateStr = `P${periodNumber} (${month}'${year})`;

      return {
        name: dateStr,
        cost: Math.round(periodCost * 100) / 100,
        qty: Math.round(periodQty * 100) / 100,
        cumulative: Math.round(cumulative * 100) / 100
      };
    });
  }, [etcRows, project.reportingPeriods, costCodes, selectedEtcCode]);
  const [isEtcChartVisible, setIsEtcChartVisible] = useState(false);
  const [addRowsCount, setAddRowsCount] = useState(1);
  const [isResourceModalOpen, setIsResourceModalOpen] = useState(false);
  const [resourceSearch, setResourceSearch] = useState('');
  const [selectedResourceIds, setSelectedResourceIds] = useState<Set<string>>(new Set());
  const [resourceLibrarySource, setResourceLibrarySource] = useState<'enterprise' | 'project'>('enterprise');
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [bulkUpdateData, setBulkUpdateData] = useState<{
    enterpriseAttributes: Record<string, string>;
    projectAttributes: Record<string, string>;
    eacMethod?: CostCode['eacMethod'];
  }>({
    enterpriseAttributes: {},
    projectAttributes: {},
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const etcFileInputRef = useRef<HTMLInputElement>(null);
  const timephasingFileInputRef = useRef<HTMLInputElement>(null);

  // Real-time duplicate check
  const isDuplicateId = useMemo(() => {
    if (!formData.code || isEditing?.id || isSaving) return false;
    return costCodes.some(c => c.code.toLowerCase() === formData.code?.toLowerCase());
  }, [formData.code, costCodes, isEditing, isSaving]);

  const groupedLibraryResources = useMemo(() => {
    const library = resourceLibrarySource === 'enterprise' ? enterprise.resourceRates : project.resourceRates;
    const filtered = library?.filter(r => 
      r.name.toLowerCase().includes(resourceSearch.toLowerCase()) ||
      r.id.toLowerCase().includes(resourceSearch.toLowerCase()) ||
      r.category?.toLowerCase().includes(resourceSearch.toLowerCase())
    ) || [];

    const grouped = filtered.reduce((acc, resource) => {
      const category = resource.category || 'Uncategorized';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(resource);
      return acc;
    }, {} as Record<string, typeof filtered>);

    return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));
  }, [resourceLibrarySource, enterprise.resourceRates, project.resourceRates, resourceSearch]);

  // ETC Details - project-level subscription
  const [allEtcForProject, setAllEtcForProject] = useState<any[]>([]);
  useEffect(() => {
    setIsEtcLoading(true);
    return costRepo.subscribeEtcDetails(project.id, (rows) => {
      setAllEtcForProject(rows as any[]);
      setIsEtcLoading(false);
    });
  }, [project.id]);
  useEffect(() => {
    if (!selectedEtcCode) { setEtcRows([]); return; }
    const filtered = (allEtcForProject as any[]).filter(r => r.costCode === selectedEtcCode || r.costCodeId === selectedEtcCode);
    const sorted = [...filtered].sort((a: any, b: any) => { const oA = a.sortOrder ?? -1; const oB = b.sortOrder ?? -1; if (oA !== oB) return oA - oB; return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime(); });
    setEtcRows(sorted);
  }, [selectedEtcCode, allEtcForProject]);

  // Baseline subscriptions (project-level)
  const [allBaseline, setAllBaseline] = useState<any[]>([]);
  useEffect(() => {
    return costRepo.subscribeBaselineBudgets(project.id, (rows) => setAllBaseline(rows as any[]));
  }, [project.id]);
  useEffect(() => {
    if (!selectedBaselineCode) { setBaselineRows([]); return; }
    setIsBaselineLoading(true);
    const costCodeObj = costCodes.find(c => c.code === selectedBaselineCode);
    setBaselineRows(allBaseline.filter((a: any) => a.costCodeId === costCodeObj?.id || a.costCodeId === selectedBaselineCode));
    setIsBaselineLoading(false);
  }, [selectedBaselineCode, allBaseline, costCodes]);

  // Actuals subscriptions (project-level)
  const [allActuals, setAllActuals] = useState<any[]>([]);
  useEffect(() => {
    return costRepo.subscribeActualCosts(project.id, (rows) => setAllActuals(rows as any[]));
  }, [project.id]);
  useEffect(() => {
    if (!selectedActualsCode) { setActualsRows([]); return; }
    setIsActualsLoading(true);
    const costCodeObj = costCodes.find(c => c.code === selectedActualsCode);
    const filtered = allActuals.filter((a: any) => a.costCodeId === costCodeObj?.id || a.costCodeId === selectedActualsCode);
    setActualsRows([...filtered].sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()));
    setIsActualsLoading(false);
  }, [selectedActualsCode, allActuals, costCodes]);

  // Cost Phasing subscriptions
  useEffect(() => {
    if (!selectedTimephasingCode) { setCostPhasing([]); return; }
    return costRepo.subscribeCostPhasing(project.id, selectedTimephasingCode, setCostPhasing as any);
  }, [selectedTimephasingCode, project.id]);

  // Changes Effects
  useEffect(() => {
    if (!project.id) return;
    return changeRepo.subscribeChanges(project.id, setAllChanges as any);
  }, [project.id]);

  useEffect(() => {
    if (!project.id) return;
    return subcontractRepo.subscribeSubcontracts(project.id, setSubcontracts as any);
  }, [project.id]);

  // Change records - filter from project-wide subscription
  const [allChangeRecords, setAllChangeRecords] = useState<ChangeRecord[]>([]);
  useEffect(() => {
    if (!project.id) return;
    return changeRepo.subscribeChangeRecords(project.id, setAllChangeRecords);
  }, [project.id]);
  useEffect(() => {
    if (!selectedChangesCode) { setChangeRecords([]); return; }
    setIsChangesLoading(true);
    setChangeRecords(allChangeRecords.filter(r => (r as any).costCodeId === selectedChangesCode));
    setIsChangesLoading(false);
  }, [selectedChangesCode, allChangeRecords]);

  useEffect(() => {
    if (!project.id) return;
    return riskRepo.subscribeRiskRecords(project.id, (rows) => setRiskRecords(rows as any[]));
  }, [project.id]);

  const riskExposureByCostCode = useMemo(() => {
    const aggregates: Record<string, { initialEMV: number; mitigationCost: number; residualEMV: number }> = {};
    
    riskRecords.forEach(record => {
      const ccId = record.costCodeId;
      if (!ccId) return;
      
      if (!aggregates[ccId]) {
        aggregates[ccId] = { initialEMV: 0, mitigationCost: 0, residualEMV: 0 };
      }
      
      const prob = Number(record.probability) || 0;
      const impact = Number(record.impactAmount) || 0;
      const resProb = Number(record.residualProbability) || 0;
      const resImpact = Number(record.residualImpactAmount) || 0;
      const mitCost = Number(record.mitigationCost) || 0;
      
      aggregates[ccId].initialEMV += prob * impact;
      aggregates[ccId].mitigationCost += mitCost;
      aggregates[ccId].residualEMV += resProb * resImpact;
    });
    
    return aggregates;
  }, [riskRecords]);

  const changesPinnedBottomRowData = useMemo(() => {
    if (changeRecords.length === 0) return [];
    const totalBudget = changeRecords.reduce((sum, r) => sum + (Number(r.budgetAmount) || 0), 0);
    const totalEac = changeRecords.reduce((sum, r) => sum + (Number(r.eacAmount) || 0), 0);
    return [{
      changeIdStr: 'Total',
      budgetAmount: totalBudget,
      eacAmount: totalEac,
      isTotalRow: true
    }];
  }, [changeRecords]);

  // Process Timephasing Rows
  useEffect(() => {
    if (!selectedTimephasingCode) {
      setTimephasingRows([]);
      return;
    }

    setIsTimephasingLoading(true);
    
    // We need actuals and etc for EAC calculation
    // Since we might not have them fetched yet (they are fetched in other effects)
    // We should probably fetch them here too or ensure they are available.
    // To be safe and consistent with the user's request for "smart" handling,
    // I'll fetch them specifically for this view if not already there.
    
    const fetchData = async () => {
      try {
        const periods = project.reportingPeriods?.periods || [];
        const currentPeriodId = project.reportingPeriods?.currentPeriodId;
        const currentPeriodIndex = periods.findIndex(p => p.id === currentPeriodId);
        
        // 1. Get Actuals from local state
        const costCodeObj = costCodes.find(c => c.code === selectedTimephasingCode);
        const filteredActuals = allActuals.filter((a: any) => a.costCodeId === costCodeObj?.id || a.costCodeId === selectedTimephasingCode);

        const actualsByPeriod: Record<string, number> = {};
        filteredActuals.forEach((a: any) => {
          actualsByPeriod[a.reportingPeriodId] = (actualsByPeriod[a.reportingPeriodId] || 0) + (a.cost || 0);
        });

        // 2. Get ETC Details from local state
        const etcDetails = allEtcForProject.filter((e: any) => e.costCode === selectedTimephasingCode || e.costCodeId === selectedTimephasingCode);
        
        // 3. Get Subcontract Phasing
        const subphasingByPeriod: Record<string, number> = {};
        const matchCode = selectedTimephasingCode.trim().toUpperCase();
        const targetCodeForSub = costCodes.find(c => 
          c.code.trim().toUpperCase() === matchCode
        );

        subcontracts.forEach(sub => {
          (sub.lineItems || []).forEach(li => {
            if (li.status === 'Rejected') return;
            
            const rawId = li.costCodeId;
            const assignedCodeId = (rawId && rawId.trim() !== '') ? rawId : sub.defaultCostCodeId;
            if (!assignedCodeId) return;

            const assignedClean = assignedCodeId.toString().trim().toUpperCase();
            const assignedCodeOnly = assignedClean.split(' - ')[0].trim();

            let isMatch = (assignedClean === matchCode || assignedCodeOnly === matchCode);
            if (!isMatch && targetCodeForSub) {
              const targetId = (targetCodeForSub.id || '').toString().trim().toUpperCase();
              const targetCodeValue = (targetCodeForSub.code || '').toString().trim().toUpperCase();
              if (assignedClean === targetId || assignedCodeOnly === targetId || assignedClean === targetCodeValue || assignedCodeOnly === targetCodeValue) {
                isMatch = true;
              }
            }

            if (isMatch && li.periodValues) {
              Object.entries(li.periodValues).forEach(([pid, val]) => {
                subphasingByPeriod[pid] = (subphasingByPeriod[pid] || 0) + (Number(val) || 0);
              });
            }
          });
        });

        const etcByPeriod: Record<string, number> = {};
        const futurePeriodIds = periods.slice(currentPeriodIndex + 1).map(p => p.id);

        etcDetails.forEach((etc: any) => {
          if (etc.periodValues) {
            Object.entries(etc.periodValues).forEach(([periodId, value]) => {
              // Only include future periods in ETC aggregation
              if (futurePeriodIds.includes(periodId)) {
                etcByPeriod[periodId] = (etcByPeriod[periodId] || 0) + (Number(value) || 0) * (etc.rate || 0);
              }
            });
          }
        });

        // 3. Get Phasing (Baseline/Approved/EAC settings)
        const codePhasing = costPhasing.filter(p => p.costCodeId === selectedTimephasingCode);
        const baselineDoc = codePhasing.find(p => p.type === 'baseline');
        const approvedDoc = codePhasing.find(p => p.type === 'approved');
        const eacDoc = codePhasing.find(p => p.type === 'eac');

        const baselinePhasing = baselineDoc?.periodValues || {};
        const approvedPhasing = approvedDoc?.periodValues || {};

        const eacPrevDoc = codePhasing.find(p => p.type === 'eacPrevious');

        // 4. Construct Rows
        const selectedCodeData = costCodes.find(c => c.code === selectedTimephasingCode);
        const eacMethod = selectedCodeData?.eacMethod;

        const getPhasingSource = (doc: any, type: string) => {
          const savedSource = doc?.phasingSource;
          if (type === 'eac') {
            // If EAC Method is not ETC Details, Phasing Source cannot be ETC Details
            if (savedSource === 'ETC Details' && eacMethod !== 'ETC Details') {
              return 'Manual';
            }
            return savedSource || (eacMethod === 'ETC Details' ? 'ETC Details' : 'Manual');
          }
          return savedSource || 'Manual';
        };

        const rows: any[] = [
          {
            id: 'baseline',
            type: 'Baseline Budget',
            costCode: selectedTimephasingCode,
            phasingSource: getPhasingSource(baselineDoc, 'baseline'),
            activityId: baselineDoc?.activityId || null,
            startDate: baselineDoc?.startDate ? new Date(baselineDoc.startDate) : '',
            endDate: baselineDoc?.endDate ? new Date(baselineDoc.endDate) : '',
            distribution: baselineDoc?.distribution || 'Even',
            periodValues: periods.reduce((acc, p) => {
              const source = getPhasingSource(baselineDoc, 'baseline');
              if (source === 'SubContract') {
                acc[p.id] = subphasingByPeriod[p.id] || 0;
              } else {
                acc[p.id] = baselineDoc?.periodValues?.[p.id] || 0;
              }
              return acc;
            }, {} as Record<string, number>),
            totalFromCode: selectedCodeData?.baselineBudget || 0,
            docId: baselineDoc?.id,
            eacMethod
          },
          {
            id: 'approved',
            type: 'Approved Budget',
            costCode: selectedTimephasingCode,
            phasingSource: getPhasingSource(approvedDoc, 'approved'),
            activityId: approvedDoc?.activityId || null,
            startDate: approvedDoc?.startDate ? new Date(approvedDoc.startDate) : '',
            endDate: approvedDoc?.endDate ? new Date(approvedDoc.endDate) : '',
            distribution: approvedDoc?.distribution || 'Even',
            periodValues: periods.reduce((acc, p) => {
              const source = getPhasingSource(approvedDoc, 'approved');
              if (source === 'SubContract') {
                acc[p.id] = subphasingByPeriod[p.id] || 0;
              } else {
                acc[p.id] = approvedDoc?.periodValues?.[p.id] || 0;
              }
              return acc;
            }, {} as Record<string, number>),
            totalFromCode: selectedCodeData?.approvedBudget || 0,
            docId: approvedDoc?.id,
            eacMethod
          },
          {
            id: 'eac',
            type: 'Estimate At Completion',
            costCode: selectedTimephasingCode,
            phasingSource: getPhasingSource(eacDoc, 'eac'),
            activityId: eacDoc?.activityId || null,
            startDate: eacDoc?.startDate ? new Date(eacDoc.startDate) : '',
            endDate: eacDoc?.endDate ? new Date(eacDoc.endDate) : '',
            distribution: eacDoc?.distribution || 'Even',
            totalFromCode: selectedCodeData?.estimateAtCompletion || 0,
            docId: eacDoc?.id,
            eacMethod,
            periodValues: periods.reduce((acc, p, idx) => {
              const phasingSource = getPhasingSource(eacDoc, 'eac');
              
              if (phasingSource === 'ETC Details') {
                if (idx <= currentPeriodIndex) {
                  acc[p.id] = actualsByPeriod[p.id] || 0;
                } else {
                  acc[p.id] = etcByPeriod[p.id] || 0;
                }
              } else if (phasingSource === 'SubContract') {
                if (idx <= currentPeriodIndex) {
                  acc[p.id] = actualsByPeriod[p.id] || 0;
                } else {
                  acc[p.id] = subphasingByPeriod[p.id] || 0;
                }
              } else if (phasingSource === 'Manual' || phasingSource === 'Auto') {
                acc[p.id] = eacDoc?.periodValues?.[p.id] || 0;
                if (idx <= currentPeriodIndex) {
                  acc[p.id] = actualsByPeriod[p.id] || 0;
                }
              }
              return acc;
            }, {} as Record<string, number>)
          }
        ];

        if (eacPrevDoc) {
          rows.push({
            id: 'eacPrevious',
            type: 'EAC Previous',
            costCode: selectedTimephasingCode,
            periodValues: eacPrevDoc.periodValues || {},
            totalFromCode: selectedCodeData?.estimateAtCompletionPrevious || 0,
            docId: eacPrevDoc.id,
            hidden: true
          });
        }

        setTimephasingRows(rows);
        setIsTimephasingLoading(false);
      } catch (error) {
        console.error("Error processing timephasing data:", error);
        setIsTimephasingLoading(false);
      }
    };

    fetchData();
  }, [selectedTimephasingCode, project.id, costCodes, costPhasing, project.reportingPeriods, subcontracts]);


  const handleAddEtcRow = async () => {
    if (!selectedEtcCode) return;
    try {
      const count = Math.max(1, Math.min(500, addRowsCount));
      let insertSortOrder: number;
      const selectedRows = etcGridRef.current?.api.getSelectedRows() || [];
      if (selectedRows.length > 0) {
        const lastSelected = selectedRows[selectedRows.length - 1];
        insertSortOrder = lastSelected.sortOrder + 1;
        const toShift = etcRows.filter(r => r.sortOrder >= insertSortOrder);
        await costRepo.updateManyEtcDetails(toShift.map(r => ({ id: r.id, data: { sortOrder: r.sortOrder + count } })));
      } else {
        const maxSortOrder = etcRows.length > 0 ? Math.max(...etcRows.map(r => r.sortOrder || 0)) : -1;
        insertSortOrder = maxSortOrder + 1;
      }
      const newRows = Array.from({ length: count }, (_, i) => ({
        projectId: project.id, costCode: selectedEtcCode, item: '', description: '',
        qty: 0, unit: '', rate: 0, phasingMethod: 'Manual', phasingStartDate: '', phasingEndDate: '',
        phasingUnit: '', phasingQty: 0, category: '', periodValues: {}, enterpriseAttributes: {},
        projectAttributes: {}, userDefined: {}, sortOrder: insertSortOrder + i, source: 'MANUAL', isEnterpriseResource: false
      }));
      await costRepo.createManyEtcDetails(newRows as any);
      toast.success(`${count} row(s) added successfully`);
    } catch (error) {
      console.error(error);
      toast.error("Failed to add row. Check console for details.");
    }
  };


  const handleAddResources = async (resources: any[], source: 'enterprise' | 'project' = 'enterprise') => {
    if (!selectedEtcCode || resources.length === 0) return;
    try {
      const count = Math.max(1, Math.min(500, addRowsCount));
      let insertSortOrder: number;
      const selectedRows = etcGridRef.current?.api.getSelectedRows() || [];
      if (selectedRows.length > 0) {
        const lastSelected = selectedRows[selectedRows.length - 1];
        insertSortOrder = lastSelected.sortOrder + 1;
        const totalNewRows = count * resources.length;
        const toShift = etcRows.filter(r => r.sortOrder >= insertSortOrder);
        await costRepo.updateManyEtcDetails(toShift.map(r => ({ id: r.id, data: { sortOrder: r.sortOrder + totalNewRows } })));
      } else {
        const maxSortOrder = etcRows.length > 0 ? Math.max(...etcRows.map(r => r.sortOrder || 0)) : -1;
        insertSortOrder = maxSortOrder + 1;
      }

      let currentSortOrder = insertSortOrder;
      const newRows: any[] = [];
      for (const resource of resources) {
        for (let i = 0; i < count; i++) {
          newRows.push({ projectId: project.id, costCode: selectedEtcCode, item: resource.id, description: resource.name, qty: 0, unit: resource.unit || 'HR', rate: resource.rate || 0, phasingMethod: 'Manual', phasingStartDate: '', phasingEndDate: '', phasingUnit: '', phasingQty: 0, category: resource.category || '', periodValues: {}, enterpriseAttributes: {}, projectAttributes: {}, userDefined: {}, sortOrder: currentSortOrder++, isEnterpriseResource: source === 'enterprise', source: source.toUpperCase(), resourceId: resource.id });
        }
      }
      await costRepo.createManyEtcDetails(newRows);
      setIsResourceModalOpen(false);
      setSelectedResourceIds(new Set());
      toast.success(`${resources.length * count} row(s) added successfully`);
    } catch (error) {
      console.error("Error adding resources:", error);
      toast.error("Failed to add resources");
    }
  };

  const handleUpdateEtcRow = useCallback(async (rowId: string, data: any) => {
    if (!rowId) return;
    try {
      const allPeriods = project.reportingPeriods?.periods || [];
      const currentPeriodId = project.reportingPeriods?.currentPeriodId;
      const currentIndex = allPeriods.findIndex(p => p.id === currentPeriodId);
      const futurePeriodIds = allPeriods.slice(currentIndex + 1).map(p => p.id);

      // Create a clean update object with only valid fields
      const updates: any = {
        updatedAt: new Date().toISOString()
      };

      // Define allowed fields
      const allowedFields = [
        'item', 'description', 'category', 'unit', 'rate', 'qty', 
        'phasingMethod', 'phasingStartDate', 'phasingEndDate', 
        'phasingUnit', 'phasingQty', 'calendarId', 'periodValues',
        'enterpriseAttributes', 'projectAttributes', 'userDefined',
        'source', 'isEnterpriseResource', 'externalId', 'activityId'
      ];

      allowedFields.forEach(field => {
        if (data[field] !== undefined) {
          let val = data[field];
          
          if (val === null) {
            if (field === 'item' || field === 'description' || field === 'unit' || field === 'category') {
              val = '';
            } else if (field === 'qty' || field === 'rate' || field === 'phasingQty') {
              val = 0;
            } else if (field === 'periodValues' || field === 'enterpriseAttributes' || field === 'projectAttributes' || field === 'userDefined') {
              val = {};
            }
          }
          
          // CRITICAL: Zero out non-future periods for ETC
          if (field === 'periodValues' && val && typeof val === 'object') {
            const cleanedPeriodValues: Record<string, number> = {};
            Object.entries(val).forEach(([periodId, value]) => {
              if (futurePeriodIds.includes(periodId)) {
                cleanedPeriodValues[periodId] = Number(value) || 0;
              } else {
                cleanedPeriodValues[periodId] = 0;
              }
            });
            val = cleanedPeriodValues;
          }

          updates[field] = val;
        }
      });

      await costRepo.updateEtcDetail(rowId, updates);
    } catch (error) {
      console.error(error);
      toast.error("Failed to update row");
    }
  }, [project.id, project.reportingPeriods]);

  const handleCalculatePhasing = async () => {
    const selectedRows = etcGridRef.current?.api.getSelectedRows() || [];
    let rowsToPhase = etcRows.filter(r => r.phasingMethod === 'Auto-Phase');
    
    // If user has selected specific rows, only phase those
    if (selectedRows.length > 0) {
      rowsToPhase = selectedRows;
    }

    if (rowsToPhase.length === 0) {
      toast.info("No rows selected for phasing");
      return;
    }

    if (!project.reportingPeriods?.periods) return;

    const allPeriods = project.reportingPeriods.periods;
    const currentPeriodId = project.reportingPeriods.currentPeriodId;
    const currentIndex = allPeriods.findIndex(p => p.id === currentPeriodId);

    // Clearing periods (starting from current period to ensure no old forecast pollution)
    const periodsToClear = currentIndex !== -1 ? allPeriods.slice(currentIndex) : allPeriods;
    // Distribution periods (starting from next period)
    const distributionPeriods = currentIndex !== -1 ? allPeriods.slice(currentIndex + 1) : allPeriods;

    if (distributionPeriods.length === 0) {
      toast.error("No future periods available for phasing");
      return;
    }

    const phasingUpdates: Array<{ id: string; data: any }> = [];
    let updatedCount = 0;

    const parseDateToUTCMidnight = (val: any): Date | null => {
      if (!val) return null;
      let d: Date;
      if (val instanceof Date) d = val;
      else if (typeof val === 'object' && 'toDate' in val) d = val.toDate();
      else d = new Date(val);
      if (isNaN(d.getTime())) return null;
      return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    };

    for (const row of rowsToPhase) {
        const phasingQty = Number(row.phasingQty) || 0;
        if (!phasingQty || !row.phasingUnit) continue;

        const userStartRaw = parseDateToUTCMidnight(row.phasingStartDate);
        const userEndRaw = parseDateToUTCMidnight(row.phasingEndDate);

        const newPeriodValues: Record<string, number> = { ...(row.periodValues as Record<string, number> || {}) };
        
        // Retain past periods but clear out all distribution periods before writing new values
        periodsToClear.forEach(p => {
          delete newPeriodValues[p.id];
          Object.keys(newPeriodValues).forEach(k => { if (k.startsWith(p.id + '_')) delete newPeriodValues[k]; });
        });

        if (row.phasingUnit === 'Profile' && (!userStartRaw || !userEndRaw)) {
          const existingPeriodValues = (row.periodValues || {}) as Record<string, number>;
          let totalWeight = 0;
          const periodWeights: Record<string, number> = {};
          
          distributionPeriods.forEach(p => {
            let pWeight = Number(existingPeriodValues[p.id]) || 0;
            Object.entries(existingPeriodValues).forEach(([key, val]) => {
              if (key.startsWith(p.id + '_')) pWeight += Number(val) || 0;
            });
            periodWeights[p.id] = pWeight;
            totalWeight += pWeight;
          });

          if (totalWeight > 0) {
            let sumDistributed = 0;
            distributionPeriods.forEach((p, idx) => {
              if (idx === distributionPeriods.length - 1) {
                newPeriodValues[p.id] = Math.round((phasingQty - sumDistributed) * 10000) / 10000;
              } else {
                const weight = (periodWeights[p.id] || 0) / totalWeight;
                const periodQty = Math.round(phasingQty * weight * 10000) / 10000;
                newPeriodValues[p.id] = periodQty;
                sumDistributed += periodQty;
              }
            });
          } else {
            let sumDistributed = 0;
            const evenQty = Math.round((phasingQty / distributionPeriods.length) * 10000) / 10000;
            distributionPeriods.forEach((p, idx) => {
              if (idx === distributionPeriods.length - 1) {
                newPeriodValues[p.id] = Math.round((phasingQty - sumDistributed) * 10000) / 10000;
              } else {
                newPeriodValues[p.id] = evenQty;
                sumDistributed += evenQty;
              }
            });
          }

          phasingUpdates.push({ id: row.id, data: {
            periodValues: newPeriodValues,
            qty: Object.keys(newPeriodValues)
              .filter(key => distributionPeriods.some(dp => dp.id === key))
              .reduce((sum, key) => sum + (newPeriodValues[key] || 0), 0),
          } });
          updatedCount++;
          continue;
        }

        if (!userStartRaw || !userEndRaw) continue;

        let userStart = new Date(userStartRaw.getTime());
        let userEnd = new Date(userEndRaw.getTime());

        // Constrain distribution to future periods
        if (distributionPeriods.length > 0) {
          const futureStartRaw = parseDateToUTCMidnight(distributionPeriods[0].startDate);
          if (futureStartRaw) {
            if (userStart < futureStartRaw) userStart = new Date(futureStartRaw.getTime());
            if (userEnd < futureStartRaw) userEnd = new Date(futureStartRaw.getTime());
          }
        }

        if (userEnd < userStart) continue;

        const calendar = calendars.find(c => c.id === row.calendarId);
        const isWorkingDay = (date: Date) => domainIsWorkingDay(date, calendar!);

        const workingDaysInPeriod: Record<string, number> = {};
        const distributionPeriodIds: string[] = [];
        let totalWorkingDaysInRange = 0;

        let tempStep = new Date(userStart.getTime());
        while (tempStep <= userEnd) {
          if (isWorkingDay(tempStep)) {
            totalWorkingDaysInRange++;
            const period = distributionPeriods.find(p => {
              const ps = parseDateToUTCMidnight(p.startDate);
              const pe = parseDateToUTCMidnight(p.endDate);
              return ps && pe && tempStep >= ps && tempStep <= pe;
            });
            if (period) {
              if (!workingDaysInPeriod[period.id]) {
                distributionPeriodIds.push(period.id);
                workingDaysInPeriod[period.id] = 0;
              }
              workingDaysInPeriod[period.id]++;
            }
          }
          tempStep.setUTCDate(tempStep.getUTCDate() + 1);
        }

        if (totalWorkingDaysInRange === 0 || distributionPeriodIds.length === 0) continue;

        if (row.phasingUnit === 'Total') {
          const dailyQty = phasingQty / totalWorkingDaysInRange;
          let sumDistributed = 0;
          distributionPeriodIds.forEach((pid, idx) => {
            if (idx === distributionPeriodIds.length - 1) {
              newPeriodValues[pid] = Math.round((phasingQty - sumDistributed) * 10000) / 10000;
            } else {
              const periodQty = Math.round(dailyQty * workingDaysInPeriod[pid] * 10000) / 10000;
              newPeriodValues[pid] = periodQty;
              sumDistributed += periodQty;
            }
          });
        } else {
          // Legacy Day-by-Day for Daily/Weekly
          let current = new Date(userStart.getTime());
          while (current <= userEnd) {
            if (!isWorkingDay(current)) {
              current.setUTCDate(current.getUTCDate() + 1);
              continue;
            }

            const dayStr = current.getUTCDate().toString().padStart(2, '0');
            const monthStr = (current.getUTCMonth() + 1).toString().padStart(2, '0');
            
            const period = distributionPeriods.find(p => {
              const ps = parseDateToUTCMidnight(p.startDate);
              const pe = parseDateToUTCMidnight(p.endDate);
              return ps && pe && current >= ps && current <= pe;
            });

            if (period) {
              let dailyQtyAmt = 0;
              if (row.phasingUnit === 'Daily') {
                dailyQtyAmt = phasingQty;
              } else if (row.phasingUnit === 'Weekly') {
                let weekWorkingDays = 0;
                let weekEnd = new Date(current.getTime());
                let diff = (weekEndingDay - weekEnd.getUTCDay() + 7) % 7;
                weekEnd.setUTCDate(weekEnd.getUTCDate() + diff);
                let weekStart = new Date(weekEnd.getTime());
                weekStart.setUTCDate(weekStart.getUTCDate() - 6);
                let weekTemp = new Date(weekStart.getTime());
                while (weekTemp <= weekEnd) {
                  if (isWorkingDay(weekTemp)) weekWorkingDays++;
                  weekTemp.setUTCDate(weekTemp.getUTCDate() + 1);
                }
                dailyQtyAmt = weekWorkingDays > 0 ? phasingQty / weekWorkingDays : 0;
              } else if (row.phasingUnit === 'Monthly') {
                let monthWorkingDays = 0;
                let monthStart = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), 1));
                let monthEnd = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + 1, 0));
                let monthTemp = new Date(monthStart.getTime());
                while (monthTemp <= monthEnd) {
                  if (isWorkingDay(monthTemp)) monthWorkingDays++;
                  monthTemp.setUTCDate(monthTemp.getUTCDate() + 1);
                }
                dailyQtyAmt = monthWorkingDays > 0 ? phasingQty / monthWorkingDays : 0;
              }

              newPeriodValues[period.id] = (newPeriodValues[period.id] || 0) + dailyQtyAmt;

              // Also handle weekly and daily buckets
              let weekId = '';
              let weekStart = new Date(current.getTime());
              let wEnd = new Date(current.getTime());
              let wDiff = (weekEndingDay - wEnd.getUTCDay() + 7) % 7;
              wEnd.setUTCDate(wEnd.getUTCDate() + wDiff);
              
              // Find which week this is in the period
              const pStart = parseDateToUTCMidnight(period.startDate);
              if (pStart) {
                let weekCounter = 1;
                let tempW = new Date(pStart.getTime());
                while (tempW <= parseDateToUTCMidnight(period.endDate)!) {
                  let twEnd = new Date(tempW.getTime());
                  let twDiff = (weekEndingDay - twEnd.getUTCDay() + 7) % 7;
                  twEnd.setUTCDate(twEnd.getUTCDate() + twDiff);
                  if (current >= tempW && current <= twEnd) {
                    weekId = `${period.id}_w${weekCounter}`;
                    break;
                  }
                  tempW = new Date(twEnd.getTime());
                  tempW.setUTCDate(tempW.getUTCDate() + 1);
                  weekCounter++;
                }
              }

              if (weekId) {
                newPeriodValues[weekId] = (newPeriodValues[weekId] || 0) + dailyQtyAmt;
              }
              const dayId = `${period.id}_d${dayStr}${monthStr}`;
              newPeriodValues[dayId] = (newPeriodValues[dayId] || 0) + dailyQtyAmt;
            }
            current.setUTCDate(current.getUTCDate() + 1);
          }
        }

        // Final rounding for all period values
        Object.keys(newPeriodValues).forEach(key => {
          newPeriodValues[key] = Math.round(newPeriodValues[key] * 10000) / 10000;
        });

        phasingUpdates.push({ id: row.id, data: { periodValues: newPeriodValues, qty: Object.keys(newPeriodValues).filter(key => distributionPeriods.some(dp => dp.id === key)).reduce((sum, key) => sum + (newPeriodValues[key] || 0), 0) } });
        updatedCount++;
      }

    if (updatedCount > 0) {
      try {
        await costRepo.updateManyEtcDetails(phasingUpdates);
        toast.success(`Calculated phasing for ${updatedCount} rows`);
      } catch (error) {
        console.error("Error calculating phasing:", error);
        toast.error("Failed to calculate phasing");
      }
    } else {
      toast.warning("No valid rows to calculate. Check highlighted rows.");
    }
  };

  const handleDeleteEtcRow = async (rowId: string) => {
    try {
      await costRepo.deleteEtcDetail(rowId);
      toast.success("Row deleted");
    } catch (error) {
      console.error("Error deleting ETC row:", error);
      toast.error("Failed to delete row");
    }
  };

  const handleDeleteEtcRows = async (type: 'selected' | 'all') => {
    if (!selectedEtcCode) return;
    
    const rowsToDelete = type === 'selected' 
      ? Array.from(selectedEtcIds) 
      : etcRows.map(r => r.id);

    if (rowsToDelete.length === 0) return;

    if (!confirm(`Are you sure you want to delete ${type === 'selected' ? rowsToDelete.length : 'all'} row(s)?`)) return;

    try {
      await costRepo.deleteManyEtcDetails(rowsToDelete);
      setSelectedEtcIds(new Set());
      toast.success(`${rowsToDelete.length} row(s) deleted`);
    } catch (error) {
      console.error("Error bulk deleting ETC rows:", error);
      toast.error("Failed to delete rows");
    }
  };

  const handleBulkUpdateEtc = async () => {
    if (selectedEtcIds.size === 0) return;
    
    setIsSaving(true);
    try {
      const bulkUpdates = Array.from(selectedEtcIds).map(id => {
        const row = etcRows.find(r => r.id === id);
        const updateObj: any = {};
        const isLibraryResource = row?.isEnterpriseResource || row?.source === 'PROJECT';
        if (etcBulkUpdateData.category && !isLibraryResource) updateObj.category = etcBulkUpdateData.category;
        if (etcBulkUpdateData.calendarId) updateObj.calendarId = etcBulkUpdateData.calendarId;
        if (etcBulkUpdateData.phasingMethod) updateObj.phasingMethod = etcBulkUpdateData.phasingMethod;
        if (etcBulkUpdateData.phasingUnit) updateObj.phasingUnit = etcBulkUpdateData.phasingUnit;
        if (Object.keys(etcBulkUpdateData.enterpriseAttributes).length > 0) updateObj.enterpriseAttributes = { ...(row?.enterpriseAttributes || {}), ...etcBulkUpdateData.enterpriseAttributes };
        if (Object.keys(etcBulkUpdateData.projectAttributes).length > 0) updateObj.projectAttributes = { ...(row?.projectAttributes || {}), ...etcBulkUpdateData.projectAttributes };
        if (Object.keys(etcBulkUpdateData.userDefined || {}).length > 0) updateObj.userDefined = { ...(row?.userDefined || {}), ...etcBulkUpdateData.userDefined };
        return { id, data: updateObj };
      });
      await costRepo.updateManyEtcDetails(bulkUpdates);
      setIsEtcBulkUpdating(false);
      setSelectedEtcIds(new Set());
      setEtcBulkUpdateData({ enterpriseAttributes: {}, projectAttributes: {}, userDefined: {} });
      toast.success(`Updated ${selectedEtcIds.size} rows`);
    } catch (error) {
      console.error("Error bulk updating ETC:", error);
      toast.error("Failed to update rows");
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportEtc = () => {
    if (!selectedEtcCode) return;
    const allPeriods = project.reportingPeriods?.periods || [];
    const currentPeriodId = project.reportingPeriods?.currentPeriodId;
    const currentIndex = allPeriods.findIndex(p => p.id === currentPeriodId);
    
    // Only export future periods for ETC
    const futurePeriods = allPeriods.slice(currentIndex + 1);

    const data = etcRows.map(row => {
      const exportRow: any = {
        'Activity ID': row.activityId || '',
        'Item': row.item,
        'Description': row.description,
        'Category': row.category,
        'Unit': row.unit,
        'Rate': row.rate,
      };

      enterpriseLineItemAttrs.forEach(attr => {
        exportRow[`E_${attr.title}`] = row.enterpriseAttributes?.[attr.id] || '';
      });

      projectLineItemAttrs.forEach(attr => {
        exportRow[`P_${attr.title}`] = row.projectAttributes?.[attr.id] || '';
      });

      for (let i = 1; i <= 5; i++) {
        exportRow[`Numeric ${i}`] = row.userDefined?.[`num${i}`] || 0;
        exportRow[`Text ${i}`] = row.userDefined?.[`text${i}`] || '';
      }

      futurePeriods.forEach(p => {
        exportRow[p.name] = row.periodValues?.[p.id] || 0;
      });
      return exportRow;
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'ETC Details');
    XLSX.writeFile(wb, `ETC_Details_${selectedEtcCode}_${project.projectName}.xlsx`);
  };

  const handleImportEtc = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedEtcCode) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        const allPeriods = project.reportingPeriods?.periods || [];
        const currentPeriodId = project.reportingPeriods?.currentPeriodId;
        const currentIndex = allPeriods.findIndex(p => p.id === currentPeriodId);
        const futurePeriodIds = allPeriods.slice(currentIndex + 1).map(p => p.id);

        const importRows: any[] = [];

        data.forEach(row => {
          const periodValues: Record<string, number> = {};
          allPeriods.forEach(p => {
            if (row[p.name] !== undefined) {
              // Only import values for future periods
              if (futurePeriodIds.includes(p.id)) {
                periodValues[p.id] = Number(row[p.name]) || 0;
              } else {
                periodValues[p.id] = 0;
              }
            }
          });

          const enterpriseAttributes: Record<string, string> = {};
          enterpriseLineItemAttrs.forEach(attr => {
            if (row[`E_${attr.title}`] !== undefined) {
              enterpriseAttributes[attr.id] = String(row[`E_${attr.title}`]);
            }
          });

          const projectAttributes: Record<string, string> = {};
          projectLineItemAttrs.forEach(attr => {
            if (row[`P_${attr.title}`] !== undefined) {
              projectAttributes[attr.id] = String(row[`P_${attr.title}`]);
            }
          });

          const userDefined: Record<string, any> = {};
          for (let i = 1; i <= 5; i++) {
            if (row[`Numeric ${i}`] !== undefined) userDefined[`num${i}`] = Number(row[`Numeric ${i}`]) || 0;
            if (row[`Text ${i}`] !== undefined) userDefined[`text${i}`] = String(row[`Text ${i}`]);
          }

          importRows.push({
            projectId: project.id, costCode: selectedEtcCode, activityId: row['Activity ID'] || '',
            item: row['Item'] || '', description: row['Description'] || '', orderNumber: row['Order Number'] || '',
            qty: 0, unit: row['Unit'] || '', rate: Number(row['Rate']) || 0,
            periodValues, enterpriseAttributes, projectAttributes, userDefined
          });
        });

        await costRepo.createManyEtcDetails(importRows);
        toast.success(`Imported ${data.length} rows successfully`);
      } catch (error) {
        console.error("Error importing ETC details:", error);
        toast.error("Failed to import rows");
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const etcPinnedTopRowData = useMemo(() => {
    if (etcRows.length === 0) return [];
    const allPeriods = project.reportingPeriods?.periods || [];
    const currentPeriodId = project.reportingPeriods?.currentPeriodId;
    const currentIndex = allPeriods.findIndex(p => p.id === currentPeriodId);
    
    // Only consider future periods for ETC subtotal
    const futurePeriods = allPeriods.slice(currentIndex + 1);
    const futurePeriodIds = futurePeriods.map(p => p.id);

    const totals: Record<string, number> = {};
    let totalEtcPrevious = 0;
    
    etcRows.forEach(row => {
      const periodValues = row.periodValues || {};
      futurePeriodIds.forEach(pId => {
        totals[pId] = (totals[pId] || 0) + (periodValues[pId] || 0);
        // Also handle sub-periods if any
        Object.keys(periodValues).forEach(key => {
          if (key.startsWith(pId + '_')) {
            totals[key] = (totals[key] || 0) + (periodValues[key] || 0);
          }
        });
      });
      totalEtcPrevious += row.totalEtcPrevious || 0;
    });

    const totalQty = etcRows.reduce((acc, r) => {
      const periodValues = (r.periodValues || {}) as Record<string, number>;
      const rowQty = futurePeriodIds.reduce((sum: number, pId: string) => sum + (periodValues[pId] || 0), 0);
      return acc + rowQty;
    }, 0);

    const totalEtc = etcRows.reduce((acc, r) => {
      const periodValues = (r.periodValues || {}) as Record<string, number>;
      const rowQty = futurePeriodIds.reduce((sum: number, pId: string) => sum + (periodValues[pId] || 0), 0);
      return acc + (rowQty * (r.rate || 0));
    }, 0);

    return [{
      item: '',
      description: 'SubTotal',
      qty: totalQty,
      rate: null,
      totalEtc: totalEtc,
      totalEtcPrevious: totalEtcPrevious,
      etcMvmt: totalEtc - totalEtcPrevious,
      periodValues: totals,
      isSubtotal: true
    }];
  }, [etcRows, project.reportingPeriods]);

  const enterpriseLineItemAttrs = useMemo(() => 
    (enterprise.lineItemAttributes || []).filter(attr => attr.title && attr.title.trim() !== '' && attr.values && attr.values.length > 0),
    [enterprise.lineItemAttributes]
  );

  const projectLineItemAttrs = useMemo(() => 
    (project.lineItemAttributes || []).filter(attr => attr.title && attr.title.trim() !== '' && attr.values && attr.values.length > 0),
    [project.lineItemAttributes]
  );

  const etcColumnDefsRef = useRef<(ColDef | ColGroupDef)[]>([]);
  const DEFAULT_CATEGORIES = ['Labour', 'Plant', 'Material', 'Subcontractor', 'Sundries', 'Staff'];

  const etcColumnDefs = useMemo<(ColDef | ColGroupDef)[]>(() => {
    const defs = buildEtcColumnDefs({
      project,
      enterprise,
      calendars,
      scheduleItems,
      enterpriseLineItemAttrs,
      projectLineItemAttrs,
      DEFAULT_CATEGORIES,
      handleDeleteEtcRow,
      handleUpdateEtcRow,
      dateFormatter,
      safeDateSetter,
    });
    // Stable Reference Pattern: Only return a new object if the content actually changed
    if (JSON.stringify(defs) === JSON.stringify(etcColumnDefsRef.current)) {
      return etcColumnDefsRef.current;
    }
    etcColumnDefsRef.current = defs;
    return defs;
  }, [
    project.reportingPeriods,
    etcRows,
    theme,
    calendars,
    scheduleItems,
    enterpriseLineItemAttrs,
    projectLineItemAttrs
  ]);

  const timephasingColumnDefs = useMemo<(ColDef | ColGroupDef)[]>(() => {
    return buildTimephasingColumnDefs({
      project,
      scheduleItems,
      currencyFormatter,
      dateFormatter,
      safeDateSetter,
    });
  }, [project.reportingPeriods?.periods, project.reportingPeriods?.currentPeriodId, scheduleItems]);

  const handleCalculateAutoPhasing = useCallback(async () => {
    if (!selectedTimephasingCode) return;
    
    // Get selected rows from grid API
    const selectedNodes = timephasingGridRef.current?.api.getSelectedNodes();
    const selectedRows = selectedNodes?.map(node => node.data) || [];
    
    let rowsToProcess = [];
    if (selectedRows.length > 0) {
      rowsToProcess = selectedRows.filter(r => r.phasingSource === 'Auto');
      if (rowsToProcess.length === 0) {
        toast.info("Selected rows are not set to 'Auto' phasing source.");
        return;
      }
    } else {
      rowsToProcess = timephasingRows.filter(r => r.phasingSource === 'Auto');
      if (rowsToProcess.length === 0) {
        toast.info("No rows set to 'Auto' phasing source.");
        return;
      }
    }

    setIsTimephasingLoading(true);
    try {
      const periods = project.reportingPeriods?.periods || [];
      const currentPeriodId = project.reportingPeriods?.currentPeriodId;
      const currentPeriod = periods.find(p => p.id === currentPeriodId);
      const currentPeriodEnd = currentPeriod ? new Date(currentPeriod.endDate) : null;
      const currentIndex = periods.findIndex(p => p.id === currentPeriodId);
      const nextPeriodStart = (currentIndex !== -1 && currentIndex < periods.length - 1) 
        ? periods[currentIndex + 1].startDate 
        : null;

      let updatedCount = 0;

      for (const row of rowsToProcess) {
        if (row.startDate && row.endDate && row.distribution) {
          let total = row.totalFromCode || 0;
          let effectiveStartDate = row.startDate;

          // SPECIAL LOGIC FOR EAC
          if (row.id === 'eac') {
            const code = costCodes.find(c => c.code === selectedTimephasingCode);
            // EAC auto-phasing should only distribute the ETC part
            total = code?.estimateToComplete || 0;
            
            // Validation: if start date <= current period end date, auto phasing starts from next period
            if (currentPeriodEnd && nextPeriodStart) {
              const userStart = new Date(row.startDate);
              if (userStart <= currentPeriodEnd) {
                console.log(`EAC Auto Phasing: Adjusting start date from ${row.startDate} to ${nextPeriodStart} because it was on or before current period.`);
                effectiveStartDate = nextPeriodStart;
              }
            }
          }

          const newPhasing = calculatePhasing(
            total,
            effectiveStartDate,
            row.endDate,
            row.distribution,
            periods,
            row.periodValues
          );

               const updatePayload = {
            projectId: project.id, costCodeId: selectedTimephasingCode, type: row.id,
            phasingSource: 'Auto', startDate: row.startDate instanceof Date ? row.startDate.toISOString() : row.startDate,
            endDate: row.endDate instanceof Date ? row.endDate.toISOString() : row.endDate,
            distribution: row.distribution, periodValues: newPhasing,
          };
          const existing = (costPhasing as any[]).find(p => p.costCodeId === selectedTimephasingCode && p.type === row.id);
          if (existing) {
            await costRepo.updateCostPhasing(existing.id, updatePayload);
          } else {
            await costRepo.saveCostPhasing([updatePayload]);
          }
          updatedCount++;
        }
      }

      if (updatedCount > 0) {
        toast.success(`Recalculated phasing for ${updatedCount} row(s)`);
      } else {
        toast.warning("Incomplete auto-phasing settings (Dates or Distribution missing)");
      }
    } catch (error) {
      console.error("Error calculating auto phasing:", error);
      console.error(error);
      toast.error("Failed to calculate auto phasing");
    } finally {
      setIsTimephasingLoading(false);
    }
  }, [selectedTimephasingCode, timephasingRows, project.id, project.reportingPeriods, costCodes, calculatePhasing]);

  const handleExportTimephasing = () => {
    if (!selectedTimephasingCode) return;
    const periods = project.reportingPeriods?.periods || [];
    
    const data = timephasingRows.map(row => {
      const exportRow: any = {
        'Type': row.type,
        'Phasing Source': row.phasingSource,
        'Start Date': row.startDate ? (row.startDate instanceof Date ? row.startDate.toLocaleDateString() : row.startDate) : '',
        'End Date': row.endDate ? (row.endDate instanceof Date ? row.endDate.toLocaleDateString() : row.endDate) : '',
        'Distribution': row.distribution,
      };

      periods.forEach(p => {
        exportRow[p.name] = row.periodValues?.[p.id] || 0;
      });
      return exportRow;
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Timephasing');
    XLSX.writeFile(wb, `Timephasing_${selectedTimephasingCode}_${project.projectName}.xlsx`);
  };

  const handleImportTimephasing = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedTimephasingCode) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        const periods = project.reportingPeriods?.periods || [];
        const currentPeriodId = project.reportingPeriods?.currentPeriodId;
        const currentPeriodIndex = periods.findIndex(p => p.id === currentPeriodId);
        const futurePeriodIds = periods.slice(currentPeriodIndex + 1).map(p => p.id);

        for (const row of data) {
          const type = row['Type'];
          let phasingType = '';
          if (type === 'Baseline Budget') phasingType = 'baseline';
          else if (type === 'Approved Budget') phasingType = 'approved';
          else if (type === 'Estimate At Completion') phasingType = 'eac';

          if (!phasingType) continue;

          const existingDoc = costPhasing.find(p => p.type === phasingType && p.costCodeId === selectedTimephasingCode);
          
          const periodValues: Record<string, number> = { ...(existingDoc?.periodValues || {}) };
          periods.forEach(p => {
            if (row[p.name] !== undefined) {
              const newValue = Number(row[p.name]) || 0;
              
              if (phasingType === 'eac') {
                // Only update future periods for EAC
                if (futurePeriodIds.includes(p.id)) {
                  periodValues[p.id] = newValue;
                }
              } else {
                // Update all periods for Baseline and Approved
                periodValues[p.id] = newValue;
              }
            }
          });

          const updatePayload: any = { projectId: project.id, costCodeId: selectedTimephasingCode, type: phasingType, phasingSource: row['Phasing Source'] || (phasingType === 'eac' ? 'ETC Details' : 'Manual'), startDate: row['Start Date'] || '', endDate: row['End Date'] || '', distribution: row['Distribution'] || 'Even', periodValues };
          if (existingDoc) {
            await costRepo.updateCostPhasing(existingDoc.id, updatePayload);
          } else {
            await costRepo.saveCostPhasing([updatePayload]);
          }
        }
        toast.success("Timephasing imported successfully");
      } catch (error) {
        console.error("Error importing timephasing:", error);
        toast.error("Failed to import timephasing");
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const onTimephasingCellValueChanged = useCallback(async (event: CellValueChangedEvent) => {
    const { data, colDef, newValue, oldValue } = event;
    const colId = (colDef as ColDef).field;
    
    if (newValue === oldValue) return;
    if (!selectedTimephasingCode) {
      console.error("No cost code selected for timephasing update");
      return;
    }
    if (!project.id) {
      console.error("No project ID available for timephasing update");
      return;
    }

    console.log(`Updating Timephasing: Code=${selectedTimephasingCode}, Type=${data.id}, Field=${colId}, NewValue=${newValue}`);

    try {
      // Ensure dates are strings for Firestore
      let startDateStr = data.startDate;
      if (startDateStr instanceof Date) {
        startDateStr = startDateStr.toISOString();
      } else if (startDateStr && !isNaN(new Date(startDateStr).getTime())) {
        startDateStr = new Date(startDateStr).toISOString();
      } else {
        startDateStr = '';
      }

      let endDateStr = data.endDate;
      if (endDateStr instanceof Date) {
        endDateStr = endDateStr.toISOString();
      } else if (endDateStr && !isNaN(new Date(endDateStr).getTime())) {
        endDateStr = new Date(endDateStr).toISOString();
      } else {
        endDateStr = '';
      }

      const updatePayload = {
        projectId: project.id,
        costCodeId: selectedTimephasingCode,
        type: data.id,
        phasingSource: data.phasingSource || 'Manual',
        activityId: data.activityId || null,
        startDate: startDateStr,
        endDate: endDateStr,
        distribution: data.distribution || 'Even',
        periodValues: data.periodValues || {},
        updatedAt: new Date().toISOString()
      };

      if (data.docId) {
        await costRepo.updateCostPhasing(data.docId, updatePayload);
      } else {
        const existing = costPhasing.find((p: any) => p.costCodeId === selectedTimephasingCode && p.type === data.id);
        if (existing) {
          await costRepo.updateCostPhasing(existing.id, updatePayload);
        } else {
          await costRepo.saveCostPhasing([updatePayload]);
        }
      }
      
      toast.success(`${data.type} updated`);
    } catch (error) {
      console.error("Error updating cost phasing:", error);
      console.error(error);
      toast.error("Failed to update cost phasing");
    }
  }, [project.id, selectedTimephasingCode]);

  const actualsColumnDefs = useMemo<ColDef[]>(
    () => buildActualsColumnDefs({ project, dateFormatter, currencyFormatter }),
    [project.reportingPeriods]
  );
  
  const baselineColumnDefs = useMemo<ColDef[]>(
    () => buildBaselineColumnDefs({ currencyFormatter }),
    []
  );

  // Re-apply column group state when columnDefs change to prevent auto-collapsing
  useEffect(() => {
    // This is now handled by the stable reference pattern, but we keep this as a fallback
    // only if the defs actually changed.
    if (etcGridRef.current?.api && etcGroupStateRef.current) {
      etcGridRef.current.api.setColumnGroupState(etcGroupStateRef.current);
    }
  }, [etcColumnDefs]);

  const onEtcRowDataUpdated = useCallback((params: RowDataUpdatedEvent) => {
    // No longer re-applying state here to avoid flicker during data updates
  }, []);

  const onEtcCellValueChanged = useCallback((params: CellValueChangedEvent) => {
    handleUpdateEtcRow(params.data.id, params.data);
    // Force refresh of the row to update calculated columns like Total ETC and Qty
    params.api.refreshCells({ rowNodes: [params.node], force: true });
  }, [handleUpdateEtcRow]);

  const getEtcRowId = useCallback((params: any) => params.data.id, []);

  const components = useMemo(() => ({
    actionsRenderer: ActionsCellRenderer
  }), []);

  const gridContext = useMemo(() => ({
    setFormData,
    setIsEditing,
    setSelectedEtcCode,
    selectedEtcCode,
    setSelectedActualsCode,
    selectedActualsCode,
    setSelectedTimephasingCode,
    selectedTimephasingCode,
    setSelectedChangesCode,
    selectedChangesCode,
    setSelectedBaselineCode,
    selectedBaselineCode,
    setDeleteConfirm,
    setSelectedSubcontractBreakdownCode,
    selectedSubcontractBreakdownCode
  }), [selectedEtcCode, selectedActualsCode, selectedTimephasingCode, selectedChangesCode, selectedBaselineCode, selectedSubcontractBreakdownCode]);

  // Dynamic Attributes
  const enterpriseAttrs = useMemo(() => 
    (enterprise.costCodeAttributes || []).filter(attr => attr.title && attr.title.trim() !== ''),
    [enterprise.costCodeAttributes]
  );

  const projectAttrs = useMemo(() => 
    (project.costCodeAttributes || []).filter(attr => attr.title && attr.title.trim() !== ''),
    [project.costCodeAttributes]
  );

  // Visible Columns State
  const [visibleColumns, setVisibleColumns] = useState<string[]>([]);

  const handleUpdateField = async (id: string, field: string, value: any) => {
    try {
      await costRepo.updateCostCode(id, { [field]: value } as any);
    } catch (error: any) {
      console.error('Error updating field:', error);
      console.error(error);
      toast.error(`Failed to update field: ${error.message || 'Unknown error'}`);
    }
  };

  useEffect(() => {
    const currentUser = authRepo.getCurrentUser();
    const isAdmin = project.users[currentUser?.id || ''] === 'Project Admin';
    const unsubscribe = costRepo.subscribeCostCodes(project.id, (allCodes) => {
      const filteredCodes = isAdmin ? allCodes : allCodes.filter(code => !code.assignedUsers || code.assignedUsers.length === 0 || code.assignedUsers.includes(currentUser?.id || ''));
      setCostCodes(filteredCodes);
      setLoading(false);
    });
    const unsubSch = scheduleRepo.subscribeScheduleItems(project.id, setScheduleItems);
    return () => { unsubscribe(); unsubSch(); };
  }, [project.id, project.users]);

  useEffect(() => {
    return scheduleRepo.subscribeProjectCalendars(project.id, setCalendars as any);
  }, [project.id]);

  const gridRef = useRef<AgGridReact>(null);
  const etcGridRef = useRef<AgGridReact>(null);
  const timephasingGridRef = useRef<AgGridReact>(null);
  const etcGroupStateRef = useRef<any>(null);
  const [gridApi, setGridApi] = useState<GridApi | null>(null);

  const onGridReady = (params: GridReadyEvent) => {
    setGridApi(params.api);
    // Test-only: exposes the grid API so Playwright can read exact cell
    // values via getCellValue() instead of fighting AG Grid's virtualized
    // DOM (off-screen columns don't exist in the DOM at all). Only present
    // when running against the memory adapter — never in a real build.
    if ((import.meta as any).env?.VITE_ADAPTER === 'memory') {
      (window as any).__costCodesGridApi = params.api;
    }
  };

  const movementRenderer = (params: any, type: 'budget' | 'eac' | 'variance') => {
    if (params.value == null || params.value === 0) return formatCurrency(params.value || 0);
    const isPositive = params.value > 0;
    
    let colorClass = '';
    if (type === 'eac') {
      colorClass = isPositive ? 'text-red-600' : 'text-emerald-600';
    } else {
      colorClass = isPositive ? 'text-emerald-600' : 'text-red-600';
    }

    return (
      <div className={cn("flex items-center gap-1 font-medium justify-end h-full", colorClass)}>
        {isPositive ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
        <span>{formatCurrency(params.value)}</span>
      </div>
    );
  };

  const columnDefs = useMemo<(ColDef | ColGroupDef)[]>(
    () => buildMainColumnDefs({
      enterprise,
      project,
      enterpriseAttrs,
      projectAttrs,
      selectedEtcCode,
      riskExposureByCostCode,
      currencyFormatter,
      movementRenderer,
    }),
    [enterpriseAttrs, projectAttrs, selectedEtcCode, riskExposureByCostCode]
  );

  const subcontractBreakdownColumnDefs = useMemo<ColDef[]>(
    () => buildSubcontractBreakdownColumnDefs({ currencyFormatter }),
    []
  );

  const changesColumnDefs = useMemo<ColDef[]>(
    () => buildChangesColumnDefs({ formatCurrency }),
    []
  );

  const sideBar = useMemo(() => {
    return {
      toolPanels: [
        {
          id: 'columns',
          labelDefault: 'Columns',
          labelKey: 'columns',
          iconKey: 'columns',
          toolPanel: 'agColumnsToolPanel',
          toolPanelParams: {
            suppressRowGroups: false,
            suppressValues: true,
            suppressPivots: true,
            suppressPivotMode: true,
            suppressColumnFilter: false,
            suppressColumnSelectAll: false,
            suppressColumnExpandAll: false,
          },
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
  }, []);

  const statusBar = useMemo(() => {
    return {
      statusPanels: [
        { statusPanel: 'agTotalAndFilteredRowCountComponent', align: 'left' },
        { statusPanel: 'agTotalRowCountComponent', align: 'center' },
        { statusPanel: 'agFilteredRowCountComponent', align: 'center' },
        { statusPanel: 'agSelectedRowCountComponent', align: 'center' },
        { statusPanel: 'agAggregationComponent', align: 'right' },
      ],
    };
  }, []);

  const onSelectionChanged = () => {
    if (gridRef.current?.api) {
      const selectedRows = gridRef.current.api.getSelectedRows().filter(row => {
        const node = gridRef.current?.api.getRowNode(row.id);
        return node && node.displayed;
      });
      setSelectedIds(new Set(selectedRows.map(row => row.id)));
    }
  };

  const defaultColDef = useMemo(() => ({
    resizable: true,
    sortable: true,
    filter: true,
    minWidth: 100,
  }), []);

  const autoGroupColumnDef = useMemo(() => ({
    headerName: 'Group',
    minWidth: 200,
    cellRendererParams: {
      checkbox: true,
    },
  }), []);

  // Phase 13.B1.5: writes only the edited leaf field. Previously this also recomputed and
  // force-wrote all 7 derived roll-up fields (approvedBudget, costVariance, etc.) on every
  // cell edit in this grid, regardless of which field changed — those are compute-on-read now
  // (useCostCodeRollups above), so there's nothing left to derive-and-store here. The only
  // roll-up-adjacent field still genuinely editable is estimateAtCompletion, and only when
  // eacMethod === 'Manual' (see cost-codes/columns.tsx); everything else in this grid was
  // already read-only (editable: false / unset).
  const onCellValueChanged = async (event: CellValueChangedEvent) => {
    const { colDef, newValue, oldValue } = event;
    if (newValue === oldValue) return;
    if (!colDef.field) return;
    if (isSaving) return; // Prevent triggering during bulk calculations or imports

    try {
      await costRepo.updateCostCode(event.data.id, { [colDef.field]: newValue });
    } catch (error: any) {
      console.error('Update error:', error);
      console.error(error);
      toast.error(`Failed to update cell: ${error.message || 'Unknown error'}`);
      event.node.setDataValue(colDef.field, oldValue);
    }
  };

  const toggleAllEtcColumnGroups = (opened: boolean) => {
    if (!etcGridRef.current) return;
    const api = etcGridRef.current.api;
    const groups = api.getColumnGroupState();
    const newState = groups.map(g => ({
      groupId: g.groupId,
      open: opened
    }));
    api.setColumnGroupState(newState);
  };

  const toggleAllCostCodeColumnGroups = (opened: boolean) => {
    if (!gridRef.current) return;
    const api = gridRef.current.api;
    const groups = api.getColumnGroupState();
    const newState = groups.map(g => ({
      groupId: g.groupId,
      open: opened
    }));
    api.setColumnGroupState(newState);
  };

  const clearAllFilters = () => {
    setQuickFilterText('');
    setEtcQuickFilterText('');
    if (gridApi) {
      gridApi.setFilterModel(null);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    if (!formData.code) {
      toast.error('Cost Code ID is required.');
      return;
    }

    setIsSaving(true);
    try {
      if (isEditing?.id) {
        await costRepo.updateCostCode(isEditing.id, formData as any);
        toast.success('Cost code updated.');
      } else {
        const isDuplicate = costCodes.some(c => c.code.toLowerCase() === formData.code?.toLowerCase());
        if (isDuplicate) {
          toast.error(`Cost Code ID "${formData.code}" already exists in this project.`);
          setIsSaving(false);
          return;
        }
        let newSortOrder = 0;
        if (typeof isEditing?.insertIndex === 'number') {
          newSortOrder = isEditing.insertIndex;
          const toShift = costCodes.filter(c => c.sortOrder >= isEditing.insertIndex!);
          await costRepo.updateManyCostCodes(toShift.map(c => ({ id: c.id, data: { sortOrder: c.sortOrder + 1 } })));
        } else {
          newSortOrder = costCodes.length > 0 ? Math.max(...costCodes.map(c => c.sortOrder)) + 1 : 0;
        }
        await costRepo.createCostCode({ ...formData, projectId: project.id, sortOrder: newSortOrder } as any);
        toast.success('Cost code created.');
      }
      setIsEditing(null);
      setFormData({ 
        code: '', 
        name: '', 
        enterpriseAttributes: {}, 
        projectAttributes: {}, 
        eacMethod: 'Manual',
        assignedUsers: []
      });
    } catch (error) {
      console.error('Error saving cost code:', error);
      toast.error('Failed to save changes.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;

    try {
      if (deleteConfirm.type === 'single' && deleteConfirm.id) {
        await costRepo.deleteCostCode(deleteConfirm.id);
      } else if (deleteConfirm.type === 'bulk') {
        await Promise.all(Array.from(selectedIds).map(id => costRepo.deleteCostCode(id)));
      }
      setSelectedIds(new Set());
      setDeleteConfirm(null);
      toast.success('Deleted successfully.');
    } catch (error) {
      console.error('Error deleting:', error);
      toast.error('Failed to delete.');
    }
  };

  const handleBulkUpdate = async () => {
    if (selectedIds.size === 0) return;
    setIsSaving(true);
    try {
      const bulkCCUpdates = Array.from(selectedIds).map(id => {
        const updateObj: any = {};
        if (bulkUpdateData.eacMethod) updateObj.eacMethod = bulkUpdateData.eacMethod;
        const currentCode = costCodes.find(c => c.id === id);
        if (currentCode) { updateObj.enterpriseAttributes = { ...(currentCode.enterpriseAttributes || {}), ...bulkUpdateData.enterpriseAttributes }; updateObj.projectAttributes = { ...(currentCode.projectAttributes || {}), ...bulkUpdateData.projectAttributes }; }
        return { id, data: updateObj };
      });
      await costRepo.updateManyCostCodes(bulkCCUpdates);
      toast.success(`Updated ${selectedIds.size} cost codes.`);
      setIsBulkUpdating(false);
      setSelectedIds(new Set());
      setBulkUpdateData({ enterpriseAttributes: {}, projectAttributes: {} });
    } catch (error) {
      console.error('Error bulk updating:', error);
      toast.error('Failed to bulk update.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenForecast = async (code: CostCode) => {
    try {
      const existingSheets = await projectRepo.findSheetsByName(project.id, `Forecast: ${code.code}`);
      let sheetId = existingSheets.length > 0 ? existingSheets[0].id : '';
      if (!sheetId) {
        const { id } = await projectRepo.createSheet({ projectId: project.id, sheetName: `Forecast: ${code.code}`, forecastMethod: 'time-based', version: '1.0', lockedStatus: false, createdBy: authRepo.getCurrentUser()?.id || 'system' });
        sheetId = id;
        await projectRepo.createSheetRow(sheetId, { sheetId, costCode: code.code, description: code.name, vendor: '', budget: code.baselineBudget || 0, committedCost: 0, actualCostToDate: code.actualCostToDate || 0, costToGo: 0, eac: code.baselineBudget || 0, timePhasing: {}, distributionMethod: 'even', attributes: {} });
      }
      navigate(`/project/${project.id}/sheet/${sheetId}`);
    } catch (error) {
      console.error('Error opening forecast sheet:', error);
      toast.error('Failed to open forecast sheet.');
    }
  };

  useEffect(() => {
    if (gridApi) {
      gridApi.setGridOption('quickFilterText', quickFilterText);
    }
  }, [quickFilterText, gridApi]);

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rows = XLSX.utils.sheet_to_json(ws) as any[];

        setImportPreview({ data: rows });
      } catch (error) {
        console.error("Error reading import file:", error);
        toast.error("Failed to read the excel file.");
      }
    };
    reader.readAsArrayBuffer(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const confirmImport = async () => {
    if (!importPreview || !project.id) return;
    
    const toastId = toast.loading('Importing cost codes...');
    try {
      let currentMaxOrder = costCodes.length > 0 ? Math.max(...costCodes.map(c => c.sortOrder)) : -1;
      let importCount = 0;
      let updateCount = 0;
      const { data } = importPreview;
      const importUpdates: Array<{ id: string; data: any }> = [];
      const importCreates: any[] = [];

      for (const row of data) {
        const code = row.code || row.Code || row['Cost Code ID'] || row['Code'];
        const name = row.name || row.Name || row['Cost Code Name'] || row['Description'] || '';
        const eacMethod = row.eacMethod || row.EACMethod || row['EAC Method'] || 'Manual';

        if (code) {
          const entAttrs: Record<string, string> = {};
          const prjAttrs: Record<string, string> = {};
          enterpriseAttrs.forEach(attr => { const val = row[attr.title]; if (val) { const match = attr.values.find(v => v.description.toLowerCase() === String(val).toLowerCase()); if (match) entAttrs[attr.id] = match.id; } });
          projectAttrs.forEach(attr => { const val = row[attr.title]; if (val) { const match = attr.values.find(v => v.description.toLowerCase() === String(val).toLowerCase()); if (match) prjAttrs[attr.id] = match.id; } });

          const existing = costCodes.find(c => c.code.toLowerCase() === String(code).toLowerCase());
          const costCodeData: any = { code: String(code), name: String(name), eacMethod: String(eacMethod), projectId: project.id, enterpriseAttributes: entAttrs, projectAttributes: prjAttrs };

          if (existing) {
            importUpdates.push({ id: existing.id, data: costCodeData });
            updateCount++;
          } else {
            currentMaxOrder++;
            importCreates.push({ ...costCodeData, sortOrder: currentMaxOrder, actualCostToDate: 0, baselineBudget: 0, approvedChanges: 0, subcontractAmount: 0 });
            importCount++;
          }
        }
      }

      await costRepo.updateManyCostCodes(importUpdates);
      await Promise.all(importCreates.map(cc => costRepo.createCostCode(cc)));
      toast.success(`Import complete: ${importCount} new, ${updateCount} updated.`, { id: toastId });
      setImportPreview(null);
    } catch (error) {
      console.error("Import error:", error);
      toast.error("Failed to complete import.", { id: toastId });
    }
  };

  const { duplicateIds, hasImportDuplicates } = useMemo(() => {
    if (!importPreview) return { duplicateIds: [], hasImportDuplicates: false };
    
    // Check for duplicates within the file itself
    const idsInFile = new Set<string>();
    const duplicates = new Set<string>();
    
    importPreview.data.forEach(row => {
      const id = row.code || row.Code || row['Cost Code ID'] || row['Code'];
      if (id) {
        const normalizedId = id.toString().trim().toLowerCase();
        if (idsInFile.has(normalizedId)) {
          duplicates.add(id.toString().trim());
        }
        idsInFile.add(normalizedId);
      }
    });

    const duplicateList = Array.from(duplicates);
    return { 
      duplicateIds: duplicateList, 
      hasImportDuplicates: duplicateList.length > 0 
    };
  }, [importPreview]);

  const handleExport = () => {
    const exportData = costCodes.map(c => ({
      'Cost Code ID': c.code,
      'Cost Code Name': c.name,
      'EAC Method': c.eacMethod,
      ...Object.fromEntries(enterpriseAttrs.map(a => [a.title, a.values.find(v => v.id === c.enterpriseAttributes?.[a.id])?.description || ''])),
      ...Object.fromEntries(projectAttrs.map(a => [a.title, a.values.find(v => v.id === c.projectAttributes?.[a.id])?.description || '']))
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Cost Codes');
    XLSX.writeFile(wb, `${project.projectCode}_CostCodes.xlsx`);
  };

  const getRowClass = (params: any) => {
    const classes = ['overflow-visible'];
    if (params.node.footer || params.node.rowPinned === 'top') {
      classes.push('bg-blue-50 dark:bg-blue-900/40 font-bold text-blue-800 dark:text-blue-200 border-b-2 border-blue-200 dark:border-blue-800');
    }
    return classes.join(' ');
  };

  const getEtcRowClass = (params: any) => {
    const classes = ['overflow-visible'];
    if (params.node.rowPinned) {
      classes.push('pinned-row-highlight');
    }
    
    // Highlight invalid Auto-Phase rows
    if (params.data?.phasingMethod === 'Auto-Phase') {
      const { phasingStartDate, phasingEndDate, phasingQty, phasingUnit } = params.data;
      if (!phasingStartDate || !phasingEndDate || !phasingQty || !phasingUnit || new Date(phasingEndDate) < new Date(phasingStartDate)) {
        classes.push('bg-red-50 dark:bg-red-900/20');
      }
    }
    
    return classes.join(' ');
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full gap-6 overflow-hidden">
      <DataGridModule
        title="Project Cost Codes"
        description="Define and manage project-specific cost codes and attributes."
        icon={<Hash className="w-4 h-4 text-gray-400" />}
        searchPlaceholder="Search cost codes..."
        quickFilterText={quickFilterText}
        onQuickFilterChange={setQuickFilterText}
        onImport={() => fileInputRef.current?.click()}
        onExport={handleExport}
        selectedCount={selectedIds.size}
        onBulkUpdate={() => setIsBulkUpdating(true)}
        onBulkDelete={() => setDeleteConfirm({ type: 'bulk', count: selectedIds.size })}
        onAdd={() => { setFormData({ code: '', name: '', enterpriseAttributes: {}, projectAttributes: {}, eacMethod: 'Manual', assignedUsers: [] }); setIsEditing({ id: null }); }}
        extraToolbarActions={
          <>
            <button 
              onClick={() => toggleAllCostCodeColumnGroups(true)}
              className="p-2 text-gray-400 hover:text-black dark:hover:text-white transition-colors"
              title="Expand All Groups"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
            <button 
              onClick={() => toggleAllCostCodeColumnGroups(false)}
              className="p-2 text-gray-400 hover:text-black dark:hover:text-white transition-colors"
              title="Collapse All Groups"
            >
              <Minimize2 className="w-4 h-4" />
            </button>
          </>
        }
        gridRef={gridRef}
        rowData={(selectedEtcCode || selectedActualsCode || selectedTimephasingCode || selectedChangesCode || selectedBaselineCode) ? costCodesWithRollups.filter(c => c.code === (selectedEtcCode || selectedActualsCode || selectedTimephasingCode || selectedChangesCode || selectedBaselineCode)) : costCodesWithRollups}
        columnDefs={columnDefs}
        theme={theme}
        isMainTableCollapsed={isMainTableCollapsed}
        onToggleMainTableCollapse={() => setIsMainTableCollapsed(!isMainTableCollapsed)}
        hasSubContent={!!(selectedEtcCode || selectedActualsCode || selectedTimephasingCode || selectedChangesCode || selectedBaselineCode)}
        project={project}
        showCurrentPeriod={true}
        gridProps={{
          getRowId: (params: any) => params.data.id,
          components: components,
          context: gridContext,
          defaultColDef: defaultColDef,
          autoGroupColumnDef: autoGroupColumnDef,
          onGridReady: onGridReady,
          onCellValueChanged: onCellValueChanged,
          onSelectionChanged: onSelectionChanged,
          onFilterChanged: onSelectionChanged,
          processCellFromClipboard: (params: any) => {
            const colId = params.column.getColId();
            if (colId.startsWith('enterpriseAttributes.') || colId.startsWith('projectAttributes.')) {
              const val = params.value;
              if (typeof val === 'string' && val.includes(' - ')) {
                return val.split(' - ')[0];
              }
            }
            return params.value;
          },
          rowSelection: "multiple",
          groupDisplayType: "multipleColumns",
          groupTotalRow: "top",
          grandTotalRow: "top",
          getRowClass: getRowClass,
          sideBar: sideBar,
          statusBar: statusBar,
          suppressRowClickSelection: true,
          paginationPageSize: 50
        }}
      />

      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept=".xlsx,.xls,.csv"
        onChange={handleImport}
      />





      {/* Subcontract Breakdown Details Section */}
      <SubcontractBreakdownPanel
        selectedSubcontractBreakdownCode={selectedSubcontractBreakdownCode}
        subcontractBreakdownRows={subcontractBreakdownRows}
        subcontractBreakdownPinnedBottomRowData={subcontractBreakdownPinnedBottomRowData}
        subcontractBreakdownColumnDefs={subcontractBreakdownColumnDefs}
        subcontractQuickFilterText={subcontractQuickFilterText}
        isMainTableCollapsed={isMainTableCollapsed}
        theme={theme}
        onClose={() => setSelectedSubcontractBreakdownCode(null)}
        onQuickFilterChange={setSubcontractQuickFilterText}
      />

      {/* ETC Details Section */}
      <EtcDetailsPanel
        project={project}
        enterprise={enterprise}
        calendars={calendars}
        theme={theme}
        selectedEtcCode={selectedEtcCode || ''}
        etcRows={etcRows}
        isEtcLoading={isEtcLoading}
        etcPinnedTopRowData={etcPinnedTopRowData}
        etcColumnDefs={etcColumnDefs}
        autoGroupColumnDef={autoGroupColumnDef}
        sideBar={sideBar}
        statusBar={statusBar}
        etcChartData={etcChartData}
        enterpriseLineItemAttrs={enterpriseLineItemAttrs}
        projectLineItemAttrs={projectLineItemAttrs}
        isMainTableCollapsed={isMainTableCollapsed}
        onClose={() => setSelectedEtcCode(null)}
        onUpdateEtcRow={async (id, data) => { await costRepo.updateEtcDetail(id, data); }}
        onDeleteEtcRow={async (id) => { await costRepo.deleteEtcDetail(id); }}
        onCalculatePhasing={handleCalculatePhasing}
        onEtcCellValueChanged={onEtcCellValueChanged}
        onEtcRowDataUpdated={onEtcRowDataUpdated}
        getEtcRowId={getEtcRowId}
        getEtcRowClass={getEtcRowClass}
        etcGridRef={etcGridRef}
        etcGroupStateRef={etcGroupStateRef}
        onTriggerBulkUpdate={() => {}}
        onTriggerDeleteSelected={() => {}}
        onTriggerDeleteAll={() => {}}
        selectedEtcIds={selectedEtcIds}
        onSelectedEtcIdsChange={setSelectedEtcIds}
      />
      
      {/* Changes Details Section */}
      <ChangesPanel
        selectedChangesCode={selectedChangesCode}
        changeRecords={changeRecords}
        allChanges={allChanges}
        changesPinnedBottomRowData={changesPinnedBottomRowData}
        changesColumnDefs={changesColumnDefs}
        changesQuickFilterText={changesQuickFilterText}
        isChangesLoading={isChangesLoading}
        isMainTableCollapsed={isMainTableCollapsed}
        theme={theme}
        onClose={() => setSelectedChangesCode(null)}
        onQuickFilterChange={setChangesQuickFilterText}
      />
      <ActualsPanel
        theme={theme}
        selectedActualsCode={selectedActualsCode || ''}
        actualsRows={actualsRows}
        isActualsLoading={isActualsLoading}
        actualsColumnDefs={actualsColumnDefs}
        actualsChartData={actualsChartData}
        isMainTableCollapsed={isMainTableCollapsed}
        onClose={() => setSelectedActualsCode(null)}
      />

      {/* Timephasing Details Section */}
      <TimephasingPanel
        project={project}
        theme={theme}
        selectedTimephasingCode={selectedTimephasingCode || ''}
        timephasingRows={timephasingRows}
        isTimephasingLoading={isTimephasingLoading}
        timephasingColumnDefs={timephasingColumnDefs}
        timephasingChartData={timephasingChartData}
        costPhasing={costPhasing}
        isMainTableCollapsed={isMainTableCollapsed}
        onClose={() => setSelectedTimephasingCode(null)}
        timephasingGridRef={timephasingGridRef}
      />

      {/* Add/Edit Modal */}
      {isEditing && (
        <CostCodeFormDialog
          isEditing={isEditing}
          formData={formData}
          isSaving={isSaving}
          isDuplicateId={isDuplicateId}
          enterpriseAttrs={enterpriseAttrs}
          projectAttrs={projectAttrs}
          project={project}
          enterprise={enterprise}
          onFormDataChange={setFormData}
          onCancel={() => setIsEditing(null)}
          onSubmit={handleSave}
        />
      )}


      <ImportPreviewDialog
        importPreview={importPreview}
        costCodes={costCodes}
        hasImportDuplicates={hasImportDuplicates}
        duplicateIds={duplicateIds}
        onClose={() => setImportPreview(null)}
        onConfirmImport={confirmImport}
      />
    </div>
  );
}
