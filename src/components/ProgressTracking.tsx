import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useProgressRepo, useScheduleRepo, useCostRepo, useAuth } from '../platform/firestore/hooks';
import { getProjectRole } from '../domain/roles';
import {
  Plus,
  Search,
  Trash2,
  Edit2,
  ChevronRight,
  ChevronDown,
  Building2,
  Calendar,
  DollarSign,
  FileText,
  Activity,
  Hash,
  ChevronUp,
  X,
  Save,
  Loader2,
  Download,
  Upload
} from 'lucide-react';
import { Enterprise, Project, ProgressPackage, ProgressItem, CostCode, RuleOfCredit, ScheduleItem } from '../types';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { AgGridReact } from 'ag-grid-react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import {
  ColDef,
  ColGroupDef,
  GridReadyEvent,
  GridApi,
  ModuleRegistry
} from 'ag-grid-community';
import { buildPackageColumnDefs, buildItemColumnDefs } from './progress-tracking/columns';
import ProgressItemsPanel from './progress-tracking/panels/ProgressItemsPanel';
import PackageFormDialog from './progress-tracking/panels/PackageFormDialog';
import { AllEnterpriseModule } from 'ag-grid-enterprise';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';
import { rocPercentComplete, earnedQty, overallPercentComplete } from '../domain/progress';

ModuleRegistry.registerModules([AllEnterpriseModule]);

interface ProgressTrackingProps {
  enterprise: Enterprise;
  project: Project;
  user: any;
  theme?: 'light' | 'dark';
  isAdmin?: boolean;
  setIsSidebarCollapsed?: (collapsed: boolean) => void;
}

export default function ProgressTracking({ enterprise, project, user, theme = 'light', isAdmin: isAdminProp, setIsSidebarCollapsed }: ProgressTrackingProps) {
  const progressRepo = useProgressRepo();
  const scheduleRepo = useScheduleRepo();
  const costRepo = useCostRepo();
  const { user: authUser, isPlatformAdmin } = useAuth();
  const [packages, setPackages] = useState<ProgressPackage[]>([]);
  const [items, setItems] = useState<ProgressItem[]>([]);
  const [costCodes, setCostCodes] = useState<CostCode[]>([]);
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>([]);
  const [rulesOfCredit, setRulesOfCredit] = useState<RuleOfCredit[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [isMainTableCollapsed, setIsMainTableCollapsed] = useState(false);
  
  const [isAddingPackage, setIsAddingPackage] = useState(false);
  const [packageFormData, setPackageFormData] = useState<Partial<ProgressPackage>>({
    packageId: '',
    description: '',
    unit: 'EA'
  });

  const [selectedPackageIds, setSelectedPackageIds] = useState<string[]>([]);
  const [isBulkUpdateOpen, setIsBulkUpdateOpen] = useState(false);
  const [bulkUpdateData, setBulkUpdateData] = useState({ field: '', value: '' });

  const isAdmin = isAdminProp !== undefined ? isAdminProp : (getProjectRole(project.users, authUser?.id ?? '') === 'project_admin' || isPlatformAdmin);

  const gridRef = useRef<AgGridReact>(null);

  useEffect(() => {
    if (!project.id) return;

    const u1 = progressRepo.subscribeProgressPackages(project.id, (data) => { setPackages(data); setLoading(false); });
    const u2 = costRepo.subscribeCostCodes(project.id, setCostCodes);
    const u3 = progressRepo.subscribeRulesOfCredit(project.id, setRulesOfCredit);
    const u4 = scheduleRepo.subscribeScheduleItems(project.id, setScheduleItems);
    const u5 = progressRepo.subscribeProgressItems(project.id, setItems);
    return () => { u1(); u2(); u3(); u4(); u5(); };
  }, [project.id]);

  const filteredItems = useMemo(() => {
    if (!selectedPackageId) return [];
    return items.filter(i => i.packageDocId === selectedPackageId).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  }, [items, selectedPackageId]);

  const selectedPackage = useMemo(() => 
    packages.find(p => p.id === selectedPackageId), 
    [packages, selectedPackageId]
  );

  const projectAttributes = useMemo(() => 
    (project.progressAttributes || []).filter(attr => attr.title && attr.title.trim() !== ''),
    [project.progressAttributes]
  );

  const enterpriseAttributes = useMemo(() => 
    (enterprise.progressAttributes || []).filter(attr => attr.title && attr.title.trim() !== ''),
    [enterprise.progressAttributes]
  );

  const handleAddPackage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project.id || !packageFormData.packageId) return;

    const exists = packages.some(p => p.packageId.toLowerCase() === packageFormData.packageId?.toLowerCase());
    if (exists) {
      toast.error('Package ID must be unique per project.');
      return;
    }

    try {
      const newPackage = {
        ...packageFormData,
        projectId: project.id,
        unit: packageFormData.unit || 'EA',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const created = await progressRepo.createProgressPackage(newPackage as any);
      setIsAddingPackage(false);
      setPackageFormData({ packageId: '', description: '' });
      setSelectedPackageId(created.id);
    } catch (error) {
      console.error('Error adding package:', error);
    }
  };

  const deletePackage = async (pkg: ProgressPackage) => {
    if (!window.confirm(`Are you sure you want to delete commodity ${pkg.packageId}? This will also delete all related items.`)) return;
    try {
      const itemIds = items.filter(i => (i as any).packageDocId === pkg.id).map(i => i.id);
      await Promise.all(itemIds.map(id => progressRepo.deleteProgressItem(id)));
      await progressRepo.deleteProgressPackage(pkg.id);
      toast.success(`Deleted commodity ${pkg.packageId} and its items`);
      if (selectedPackageId === pkg.id) setSelectedPackageId(null);
    } catch (error) {
      console.error('Delete failed', error);
      toast.error('Failed to delete commodity');
    }
  };

  const updatePackage = async (pkgId: string, updates: any) => {
    try {
      await progressRepo.updateProgressPackage(pkgId, updates);
    } catch (error) {
      console.error('Update package failed', error);
      toast.error('Failed to update commodity');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedPackageIds.length === 0) return;
    if (!window.confirm(`Delete ${selectedPackageIds.length} commodities and all their related items?`)) return;
    try {
      for (const id of selectedPackageIds) {
        const itemIds = items.filter(i => (i as any).packageDocId === id).map(i => i.id);
        await Promise.all(itemIds.map(iid => progressRepo.deleteProgressItem(iid)));
        await progressRepo.deleteProgressPackage(id);
      }
      toast.success(`Deleted ${selectedPackageIds.length} commodities`);
      setSelectedPackageIds([]);
      if (selectedPackageIds.includes(selectedPackageId || '')) setSelectedPackageId(null);
    } catch (error) {
      console.error('Bulk delete failed', error);
      toast.error('Failed to perform bulk delete');
    }
  };

  const handleBulkUpdate = async () => {
    if (!bulkUpdateData.field || selectedPackageIds.length === 0) return;
    try {
      await progressRepo.updateManyProgressPackages(selectedPackageIds.map(id => ({ id, data: { [bulkUpdateData.field]: bulkUpdateData.value } })));
      toast.success(`Updated ${selectedPackageIds.length} commodities`);
      setIsBulkUpdateOpen(false);
      setSelectedPackageIds([]);
    } catch (error) {
      console.error('Bulk update failed', error);
      toast.error('Failed to perform bulk update');
    }
  };

  const exportToExcel = () => {
    const data = packages.map(p => ({
      'Commodity ID': p.packageId,
      'Commodity Description': p.description,
      'Rule of Credit': rulesOfCredit.find(r => r.id === p.ruleOfCreditId)?.ruleId || '',
      'Created At': p.createdAt,
      'Updated At': p.updatedAt
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Commodities');
    XLSX.writeFile(wb, `${project.projectName}_Commodities.xlsx`);
    toast.success('Exported to Excel');
  };

  const [isImporting, setIsImporting] = useState(false);
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        const importUpdates: Array<{ id: string; data: any }> = [];
        const importCreates: any[] = [];
        let count = 0;

        for (const row of data) {
          const commodityId = (row['Commodity ID'] || row['Package ID'])?.toString().trim();
          if (!commodityId) continue;
          const existing = packages.find(p => p.packageId.toLowerCase() === commodityId.toLowerCase());
          const payload = { packageId: commodityId, description: (row['Commodity Description'] || row['Description'])?.toString() || '', ruleOfCreditId: (row['Rule of Credit ID'] || row['ruleOfCreditId'] || row['Rule of Credit'])?.toString() || '', projectId: project.id };
          if (existing) importUpdates.push({ id: existing.id, data: payload });
          else importCreates.push(payload);
          count++;
        }

        await Promise.all([
          ...importUpdates.map(u => progressRepo.updateProgressPackage(u.id, u.data)),
          ...importCreates.map(c => progressRepo.createProgressPackage(c as any)),
        ]);
        toast.success(`Successfully imported/updated ${count} commodities`);
      } catch (error) {
        console.error('Import error:', error);
        toast.error('Failed to import from Excel');
      } finally {
        setIsImporting(false);
        if (e.target) e.target.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  const deleteItem = async (item: ProgressItem) => {
    if (!window.confirm(`Delete commodity item ${item.description}?`)) return;
    try {
      await progressRepo.deleteProgressItem(item.id);
    } catch (error) {
      console.error('Delete failed', error);
    }
  };

  const updateItem = async (itemId: string, updates: Partial<ProgressItem>) => {
    try {
      await progressRepo.updateProgressItem(itemId, updates);
    } catch (error) {
      console.error('Update failed', error);
    }
  };

  const packageColumnDefs = useMemo<(ColDef | ColGroupDef)[]>(
    () =>
      buildPackageColumnDefs({
        items,
        rulesOfCredit,
        project,
        setSelectedPackageId,
        updatePackage,
        deletePackage,
      }),
    [packages, selectedPackageId, project.progressAttributes, rulesOfCredit, items],
  );
  const selectedRuleOfCredit = useMemo(() => {
    if (!selectedPackage?.ruleOfCreditId) return null;
    return (rulesOfCredit || []).find(r => r.id === selectedPackage.ruleOfCreditId || r.ruleId === selectedPackage.ruleOfCreditId);
  }, [selectedPackage, rulesOfCredit]);

  const processedItems = useMemo(() => {
    const result: any[] = [];
    filteredItems.forEach(item => {
      // Row 1: Planned
      result.push({
        ...item,
        rowId: `${item.id}_planned`,
        rowType: 'Planned',
        isPlanned: true
      });
      // Row 2: Current (Actual + Forecast)
      result.push({
        ...item,
        rowId: `${item.id}_current`,
        rowType: 'Current',
        isPlanned: false
      });
    });
    return result;
  }, [filteredItems]);

  const formatGridDate = (params: any) => {
    let val = params.value;
    if (!val) return '';
    
    // Handle Firestore Timestamp
    if (val && typeof val === 'object' && 'seconds' in val) {
      val = new Date(val.seconds * 1000);
    }
    
    const date = val instanceof Date ? val : new Date(val);
    if (isNaN(date.getTime())) return '';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const parseGridDate = (val: any) => {
    if (!val) return null;
    const date = val instanceof Date ? val : new Date(val);
    if (isNaN(date.getTime())) return null;
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const calculateDistribution = (total: number, startStr: string, endStr: string, curve: string, periods: any[]) => {
    if (total === 0 || !startStr || !endStr || periods.length === 0) return {};
    
    const start = new Date(startStr);
    const end = new Date(endStr);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return {};

    // Filter periods that overlap with the item's date range
    const relevantPeriods = periods.filter(p => {
      if (!p.startDate || !p.endDate) return false;
      const pStart = new Date(p.startDate);
      const pEnd = new Date(p.endDate);
      return (pStart <= end && pEnd >= start);
    });

    if (relevantPeriods.length === 0) return {};

    const values: Record<string, number> = {};
    const n = relevantPeriods.length;

    // Distribution weights based on curve
    let weights: number[] = [];
    if (curve === 'even') {
      weights = Array(n).fill(1/n);
    } else if (curve === 'front load') {
      const sum = (n * (n + 1)) / 2;
      weights = Array.from({length: n}, (_, i) => (n - i) / sum);
    } else if (curve === 'back load') {
      const sum = (n * (n + 1)) / 2;
      weights = Array.from({length: n}, (_, i) => (i + 1) / sum);
    } else if (curve === 'Bell' || curve === 'Scurve') {
      // Bell and S-curve (phasing distribution) approximation
      const s_weights = Array.from({length: n}, (_, i) => {
         const x = (i + 0.5) / n;
         return Math.sin(Math.PI * x);
      });
      const sum = s_weights.reduce((a, b) => a + b, 0);
      weights = s_weights.map(v => v / sum);
    } else {
      weights = Array(n).fill(1/n);
    }

    relevantPeriods.forEach((p, i) => {
      values[p.id] = Number((total * weights[i]).toFixed(2));
    });

    return values;
  };

  const handleCalculate = async () => {
    if (items.length === 0) return;
    
    const allPeriods = project.progressPeriods?.periods || [];
    const openPeriods = allPeriods.filter(p => p.status !== 'closed');
    const currentOpenPeriod = allPeriods.find(p => p.status === 'open');
    const closedPeriods = allPeriods.filter(p => p.status === 'closed');

    if (openPeriods.length === 0 && !currentOpenPeriod) {
      toast.error('No open or future progress periods available');
      return;
    }

    try {
      const calcUpdates: Array<{ id: string; data: any }> = [];
      let updateCount = 0;
      
      // Process all items
      items.forEach(item => {
        let hasChanges = false;
        const updates: any = { updatedAt: new Date().toISOString() };

        // 1. Calculate Earned To Date using the RoC for this specific item
        const itemPackage = packages.find(p => p.id === item.packageDocId);
        const rocId = item.ruleOfCreditId || itemPackage?.ruleOfCreditId;
        const roc = rulesOfCredit.find(r => r.id === rocId || r.ruleId === rocId);
        
        let earnedToDate = 0;
        if (roc?.steps) {
          const progress = item.ruleOfCreditProgress || {};
          const percent = rocPercentComplete(roc.steps, progress);
          earnedToDate = earnedQty(percent, item.totalQty || 0);
        }

        // 2. Populate Earned in the Current Period
        if (currentOpenPeriod) {
          // Logic: Earned in Current Period = Earned to Date - Earned in all previous periods
          const currentPeriodIndex = allPeriods.findIndex(p => p.id === currentOpenPeriod.id);
          const previousPeriods = allPeriods.slice(0, currentPeriodIndex);
          const prevEarnedSum = previousPeriods.reduce((sum, p) => sum + (item.actualPeriodValues?.[p.id] || 0), 0);
          const earnedThisPeriod = Math.max(0, earnedToDate - prevEarnedSum);
          
          const currentActualValue = item.actualPeriodValues?.[currentOpenPeriod.id] || 0;
          if (Math.abs(currentActualValue - earnedThisPeriod) > 0.001) {
            updates.actualPeriodValues = { ...(item.actualPeriodValues || {}), [currentOpenPeriod.id]: earnedThisPeriod };
            hasChanges = true;
          }
        }

        // 3. Calculate for Planned Phasing (Auto)
        if (item.phasingMethod === 'Auto' && item.plannedStartDate && item.plannedEndDate) {
          let startDate = item.plannedStartDate;
          let endDate = item.plannedEndDate;

          const s = new Date(startDate);
          let e = new Date(endDate);
          if (e <= s) {
            e = new Date(s);
            e.setDate(e.getDate() + 7);
            endDate = e.toISOString().split('T')[0];
          }

          const totalQty = item.totalQty || 0;
          const distributed = calculateDistribution(totalQty, startDate, endDate, item.phasingCurve || 'even', openPeriods);
          updates.periodValues = distributed;
          updates.plannedEndDate = endDate;
          hasChanges = true;
        }

        // 4. Calculate for Current Phasing (Forecast Auto)
        const cMethod = item.currentPhasingMethod || 'Auto';
        if (cMethod === 'Auto' && item.currentStartDate && item.currentEndDate) {
          let startDate = item.currentStartDate;
          let endDate = item.currentEndDate;

          if (currentOpenPeriod?.startDate) {
            const pStart = new Date(currentOpenPeriod.startDate);
            const userStart = new Date(startDate);
            if (userStart < pStart) {
              startDate = currentOpenPeriod.startDate;
            }
          }

          const s = new Date(startDate);
          let e = new Date(endDate);
          if (e <= s) {
            e = new Date(s);
            e.setDate(e.getDate() + 7);
            endDate = e.toISOString().split('T')[0];
          }

          const remainingQty = Math.max(0, (item.totalQty || 0) - earnedToDate);
          const distributed = calculateDistribution(remainingQty, startDate, endDate, item.currentPhasingCurve || 'even', openPeriods);
          
          updates.currentPeriodValues = distributed;
          updates.currentStartDate = startDate;
          updates.currentEndDate = endDate;
          hasChanges = true;
        }

        if (hasChanges) {
          calcUpdates.push({ id: item.id, data: updates });
          updateCount++;
        }
      });

      if (updateCount > 0) {
        await progressRepo.updateManyProgressItems(calcUpdates);
        toast.success(`Calculated and updated ${updateCount} items`);
      } else {
        toast.info('Calculation complete: No changes needed');
      }
    } catch (error) {
      console.error('Calculation failed', error);
      toast.error('Failed to perform calculation');
    }
  };

  const itemColumnDefs = useMemo<any[]>(
    () =>
      buildItemColumnDefs({
        theme,
        isAdmin,
        costCodes,
        scheduleItems,
        enterprise,
        project,
        selectedRuleOfCredit,
        updateItem,
        deleteItem,
        formatGridDate,
        parseGridDate,
      }),
    [costCodes, items, selectedRuleOfCredit, project, enterprise],
  );
  const pinnedTopRowData = useMemo(() => {
    // If no package selected, this grid isn't shown anyway.
    // If package selected, show total row even if items empty.
    let totalQty = 0;
    let totalQtyPrevious = 0;
    let totalEarnedQty = 0;
    let totalEarnedQtyPrevious = 0;
    
    if (filteredItems.length > 0) {
      filteredItems.forEach(item => {
        totalQty += item.totalQty || 0;
        totalQtyPrevious += item.totalQtyPrevious || 0;
        totalEarnedQtyPrevious += item.earnedQtyPrevious || 0;
        
        // Calculate earned for this item
        if (selectedRuleOfCredit?.steps) {
          const progress = item.ruleOfCreditProgress || {};
          const percent = rocPercentComplete(selectedRuleOfCredit.steps, progress);
          totalEarnedQty += earnedQty(percent, item.totalQty || 0);
        }
      });
    }

    const overallPercent = overallPercentComplete(totalEarnedQty, totalQty);

    return [{
      itemId: 'TOTAL',
      description: 'GRAND TOTAL',
      totalQty,
      totalQtyPrevious,
      earnedQtyPrevious: totalEarnedQtyPrevious,
      totalEarnedQty,
      overallPercent,
      ruleOfCreditProgress: {}, 
      _isTotal: true,
    }];
  }, [filteredItems, selectedRuleOfCredit]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-[#141414] border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden">
      {/* Toolbar */}
      <div className="p-6 border-b border-gray-100 dark:border-white/10 bg-gray-50/50 dark:bg-white/5 shrink-0">
        <div className="flex justify-between items-center mb-4">
          <div className="flex flex-col">
            <h3 className="text-2xl font-black tracking-tight dark:text-white">
              COMMODITY TRACKING
            </h3>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mt-2">Physical progress, phasing and variance control center.</p>
          </div>
          <div className="flex gap-3 items-center">
          {selectedPackageIds.length > 0 && (
            <div className="flex items-center gap-2 mr-4 pr-4 border-r border-gray-200 dark:border-white/10">
              <span className="text-xs font-bold text-blue-600 dark:text-blue-400">{selectedPackageIds.length} Selected</span>
              <Button 
                onClick={() => setIsBulkUpdateOpen(true)}
                className="h-8 rounded-lg font-bold bg-black hover:bg-slate-800 text-white dark:bg-white dark:text-black"
              >
                <Edit2 className="w-3.5 h-3.5 mr-1" />
                Update
              </Button>
              <Button 
                onClick={handleBulkDelete}
                className="h-8 rounded-lg font-bold bg-black hover:bg-slate-800 text-white dark:bg-white dark:text-black"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" />
                Delete
              </Button>
            </div>
          )}

          <Button variant="outline" onClick={exportToExcel} className="font-bold border-emerald-200 text-emerald-600 hover:bg-emerald-50 dark:border-emerald-500/20 dark:text-emerald-400 rounded-xl h-10 px-4">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>

          <div className="relative">
            <input
              type="file"
              accept=".xlsx, .xls, .csv"
              onChange={handleImport}
              className="hidden"
              id="commodity-import"
              disabled={isImporting}
            />
            <label 
              htmlFor="commodity-import" 
              className={cn(
                "cursor-pointer flex items-center font-bold border-blue-200 text-blue-600 hover:bg-blue-50 dark:border-blue-500/20 dark:text-blue-400 rounded-xl px-4 h-10 border text-sm transition-colors",
                isImporting && "opacity-50 pointer-events-none"
              )}
            >
              {isImporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
              Import
            </label>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text"
              placeholder="Search commodities..."
              className="pl-10 pr-4 py-2 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none w-64 dark:text-white h-10"
            />
          </div>
          
          <div className="w-px h-6 bg-gray-200 dark:bg-white/10 mx-1" />

          <Button 
            onClick={() => setIsAddingPackage(true)}
            className="px-4 py-2 bg-black dark:bg-white text-white dark:text-black rounded-xl text-sm font-bold flex items-center gap-2 hover:opacity-90 transition-all shadow-lg shadow-black/10 h-10"
          >
            <Plus className="w-4 h-4" />
            Add Commodity
          </Button>
        </div>
      </div>
    </div>

      {/* Main Content - Top/Bottom Split */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Table: Packages */}
        <div className={cn(
          "flex flex-col transition-all duration-500 ease-in-out overflow-hidden",
          selectedPackageId 
            ? (isMainTableCollapsed ? "h-[60px]" : "h-[40%]") 
            : "flex-1"
        )}>
          <div className="flex items-center justify-between px-4 py-2 bg-gray-100 dark:bg-white/5 border-b border-gray-200 dark:border-white/10">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Hash className="w-4 h-4 text-gray-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Commodities</span>
              </div>
              {(() => {
                const periods = project.progressPeriods?.periods || [];
                const currentPeriodId = project.progressPeriods?.currentPeriodId;
                const currentPeriod = periods.find(p => p.id === currentPeriodId) || periods.find(p => p.status === 'open');
                if (!currentPeriod) return null;
                
                const date = new Date(currentPeriod.endDate);
                const month = date.toLocaleString('default', { month: 'short' });
                const year = date.getFullYear().toString().slice(-2);
                const periodNumber = periods.indexOf(currentPeriod) + 1;
                const dateStr = `P${periodNumber} (${month}'${year})`;
                
                return (
                  <div className="flex items-center gap-4 border-l border-gray-200 dark:border-white/10 pl-6">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-blue-600" />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-blue-600">Current Period:</span>
                    </div>
                    <span className="text-xs font-bold text-blue-600">{dateStr}</span>
                    <div className="w-px h-4 bg-gray-200 dark:bg-white/10 mx-2" />
                    <Button 
                      size="sm"
                      variant="secondary"
                      onClick={handleCalculate}
                      className="h-7 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-bold flex items-center gap-1.5 transition-all shadow-sm"
                    >
                      <Activity className="w-3.5 h-3.5" />
                      Calculate All
                    </Button>
                  </div>
                );
              })()}
            </div>
            {selectedPackageId && (
              <button 
                onClick={() => setIsMainTableCollapsed(!isMainTableCollapsed)}
                className="p-1 hover:bg-gray-200 dark:hover:bg-white/10 rounded-md transition-colors text-gray-500"
              >
                {isMainTableCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              </button>
            )}
          </div>
          <div className="flex-1 min-h-0 relative">
            <div className={cn(
              "absolute inset-0 ag-theme-quartz",
              theme === 'dark' ? "ag-theme-quartz-dark" : ""
            )}>
                  <AgGridReact
                    theme="legacy"
                    ref={gridRef}
                    rowData={selectedPackageId ? packages.filter(p => p.id === selectedPackageId) : packages}
                    columnDefs={packageColumnDefs}
                    rowSelection="multiple"
                    suppressRowClickSelection={true}
                    onSelectionChanged={p => setSelectedPackageIds(p.api.getSelectedRows().map(r => r.id))}
                    animateRows={true}
                    pagination={!selectedPackageId}
                    paginationPageSize={10}
                    enableFillHandle={true}
                    fillHandleDirection="xy"
                    enableRangeSelection={true}
                    cellSelection={true}
                  />
            </div>
          </div>
        </div>

        <ProgressItemsPanel
          project={project}
          enterprise={enterprise}
          theme={theme}
          selectedPackageId={selectedPackageId}
          selectedPackage={selectedPackage}
          isMainTableCollapsed={isMainTableCollapsed}
          items={filteredItems}
          processedItems={processedItems}
          pinnedTopRowData={pinnedTopRowData}
          itemColumnDefs={itemColumnDefs}
          costCodes={costCodes}
          onCloseDetails={() => {
            setSelectedPackageId(null);
            setIsMainTableCollapsed(false);
          }}
        />
      </div>

      <PackageFormDialog
        isOpen={isAddingPackage}
        onClose={() => setIsAddingPackage(false)}
        packageFormData={packageFormData}
        setPackageFormData={setPackageFormData}
        onSubmit={handleAddPackage}
        rulesOfCredit={rulesOfCredit}
        projectAttributes={projectAttributes}
      />

      {/* Bulk Update Modal */}
      <Dialog open={isBulkUpdateOpen} onOpenChange={setIsBulkUpdateOpen}>
        <DialogContent className="max-w-md bg-white dark:bg-[#1a1a1a] border dark:border-white/10">
          <DialogHeader>
            <DialogTitle>Bulk Update {selectedPackageIds.length} Commodities</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Select Field</label>
              <Select onValueChange={(val: string) => setBulkUpdateData(prev => ({ ...prev, field: val }))}>
                <SelectTrigger className="w-full h-12 bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 rounded-xl">
                  <SelectValue placeholder="-- Select Field --" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="description">Commodity Description</SelectItem>
                  <SelectItem value="ruleOfCreditId">Rule of Credit</SelectItem>
                  {(project.progressAttributes || [])
                    .filter(a => a.title && a.title.trim() !== '')
                    .map(a => (
                      <SelectItem key={a.id} value={`attributes.${a.id}`}>{a.title}</SelectItem>
                    ))
                  }
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">New Value</label>
              {bulkUpdateData.field === 'ruleOfCreditId' ? (
                <Select onValueChange={(val: string) => setBulkUpdateData(prev => ({ ...prev, value: val }))}>
                  <SelectTrigger className="w-full h-12 bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 rounded-xl">
                    <SelectValue placeholder="-- Select Rule of Credit --" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">-- Clear --</SelectItem>
                    {rulesOfCredit.map(rule => (
                      <SelectItem key={rule.id} value={rule.id}>{rule.ruleId} - {rule.description}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : bulkUpdateData.field.startsWith('attributes.') ? (
                <Select onValueChange={(val: string) => setBulkUpdateData(prev => ({ ...prev, value: val }))}>
                  <SelectTrigger className="w-full h-12 bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 rounded-xl">
                    <SelectValue placeholder="-- Select Value --" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">-- Clear --</SelectItem>
                    {(project.progressAttributes?.find(a => `attributes.${a.id}` === bulkUpdateData.field)?.values || [])
                      .map(v => (
                        <SelectItem key={v.id} value={v.id}>{v.id} - {v.description}</SelectItem>
                      ))
                    }
                  </SelectContent>
                </Select>
              ) : (
                <Input 
                  value={bulkUpdateData.value}
                  onChange={e => setBulkUpdateData(prev => ({ ...prev, value: e.target.value }))}
                  placeholder="Enter new value"
                  className="h-12 rounded-xl bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10"
                />
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsBulkUpdateOpen(false)} className="rounded-xl font-bold">Cancel</Button>
            <Button onClick={handleBulkUpdate} className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold px-8">
              Update Commodities
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
