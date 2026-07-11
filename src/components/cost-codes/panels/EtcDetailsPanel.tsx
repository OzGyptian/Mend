import React, { useState, useRef, useMemo, useCallback } from 'react';
import {
  Search,
  Upload,
  Download,
  Maximize2,
  Minimize2,
  Calculator,
  Plus,
  X,
  Trash2,
  Edit2,
  BarChart3,
  Database,
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
  LabelList,
} from 'recharts';
import * as XLSX from 'xlsx';
import { cn } from '../../../lib/utils';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { AgGridReact } from 'ag-grid-react';
import {
  ColDef,
  ColGroupDef,
  CellValueChangedEvent,
  RowDataUpdatedEvent,
} from 'ag-grid-community';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Project, Enterprise, Calendar as ProjectCalendar } from '../../../types';
import { useCostRepo } from '../../../platform/firestore/hooks';
import { useConfirm } from '../../ConfirmDialogProvider';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';
import 'ag-grid-enterprise';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface EtcDetailsPanelProps {
  project: Project;
  enterprise: Enterprise;
  calendars: ProjectCalendar[];
  theme: string;
  selectedEtcCode: string;
  etcRows: any[];
  isEtcLoading: boolean;
  etcPinnedTopRowData: any[];
  etcColumnDefs: (ColDef | ColGroupDef)[];
  autoGroupColumnDef: any;
  sideBar: any;
  statusBar: any;
  etcChartData: any[];
  enterpriseLineItemAttrs: Array<{ id: string; title: string; values: Array<{ id: string; description: string }> }>;
  projectLineItemAttrs: Array<{ id: string; title: string; values: Array<{ id: string; description: string }> }>;
  isMainTableCollapsed: boolean;
  onClose: () => void;
  onUpdateEtcRow: (rowId: string, data: any) => Promise<void>;
  onDeleteEtcRow: (rowId: string) => Promise<void>;
  onCalculatePhasing: () => Promise<void>;
  onEtcCellValueChanged: (params: CellValueChangedEvent) => void;
  onEtcRowDataUpdated: (params: RowDataUpdatedEvent) => void;
  getEtcRowId: (params: any) => string;
  getEtcRowClass: (params: any) => string;
  etcGridRef: React.RefObject<AgGridReact>;
  etcGroupStateRef: React.MutableRefObject<any>;
  // Bulk update / delete triggers — trigger modals in parent
  onTriggerBulkUpdate: () => void;
  onTriggerDeleteSelected: (ids: Set<string>) => void;
  onTriggerDeleteAll: () => void;
  // ETC ids for selection sync
  selectedEtcIds: Set<string>;
  onSelectedEtcIdsChange: (ids: Set<string>) => void;
}

const DEFAULT_CATEGORIES = ['Labour', 'Plant', 'Material', 'Subcontractor', 'Sundries', 'Staff'];

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function EtcDetailsPanel({
  project,
  enterprise,
  calendars,
  theme,
  selectedEtcCode,
  etcRows,
  isEtcLoading,
  etcPinnedTopRowData,
  etcColumnDefs,
  autoGroupColumnDef,
  sideBar,
  statusBar,
  etcChartData,
  enterpriseLineItemAttrs,
  projectLineItemAttrs,
  isMainTableCollapsed,
  onClose,
  onUpdateEtcRow,
  onDeleteEtcRow,
  onCalculatePhasing,
  onEtcCellValueChanged,
  onEtcRowDataUpdated,
  getEtcRowId,
  getEtcRowClass,
  etcGridRef,
  etcGroupStateRef,
  onTriggerBulkUpdate,
  onTriggerDeleteSelected,
  onTriggerDeleteAll,
  selectedEtcIds,
  onSelectedEtcIdsChange,
}: EtcDetailsPanelProps) {
  const costRepo = useCostRepo();
  const confirmDialog = useConfirm();

  // ── Local UI state ──────────────────────────────────────────────────────────
  const [etcQuickFilterText, setEtcQuickFilterText] = useState('');
  const [isEtcChartVisible, setIsEtcChartVisible] = useState(false);
  const [addRowsCount, setAddRowsCount] = useState(1);
  const [isResourceModalOpen, setIsResourceModalOpen] = useState(false);
  const [resourceSearch, setResourceSearch] = useState('');
  const [selectedResourceIds, setSelectedResourceIds] = useState<Set<string>>(new Set());
  const [resourceLibrarySource, setResourceLibrarySource] = useState<'enterprise' | 'project'>('enterprise');
  const [isEtcBulkUpdating, setIsEtcBulkUpdating] = useState(false);
  const [etcBulkUpdateData, setEtcBulkUpdateData] = useState<{
    enterpriseAttributes: Record<string, string>;
    projectAttributes: Record<string, string>;
    userDefined?: Record<string, any>;
    category?: string;
    calendarId?: string;
    phasingMethod?: string;
    phasingUnit?: string;
  }>({ enterpriseAttributes: {}, projectAttributes: {} });

  const etcFileInputRef = useRef<HTMLInputElement>(null);

  // ── Derived data ────────────────────────────────────────────────────────────

  const groupedLibraryResources = useMemo(() => {
    const library = resourceLibrarySource === 'enterprise' ? enterprise.resourceRates : project.resourceRates;
    const filtered = library?.filter(r =>
      r.name.toLowerCase().includes(resourceSearch.toLowerCase()) ||
      r.id.toLowerCase().includes(resourceSearch.toLowerCase()) ||
      r.category?.toLowerCase().includes(resourceSearch.toLowerCase())
    ) || [];

    const grouped = filtered.reduce((acc, resource) => {
      const category = resource.category || 'Uncategorized';
      if (!acc[category]) acc[category] = [];
      acc[category].push(resource);
      return acc;
    }, {} as Record<string, typeof filtered>);

    return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));
  }, [resourceLibrarySource, enterprise.resourceRates, project.resourceRates, resourceSearch]);

  // ── Handlers ────────────────────────────────────────────────────────────────

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
          newRows.push({
            projectId: project.id, costCode: selectedEtcCode,
            item: resource.id, description: resource.name, qty: 0, unit: resource.unit || 'HR',
            rate: resource.rate || 0, phasingMethod: 'Manual', phasingStartDate: '', phasingEndDate: '',
            phasingUnit: '', phasingQty: 0, category: resource.category || '', periodValues: {},
            enterpriseAttributes: {}, projectAttributes: {}, userDefined: {},
            sortOrder: currentSortOrder++, isEnterpriseResource: source === 'enterprise',
            source: source.toUpperCase(), resourceId: resource.id
          });
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

  const handleDeleteEtcRows = async (type: 'selected' | 'all') => {
    if (!selectedEtcCode) return;
    const rowsToDelete = type === 'selected'
      ? Array.from(selectedEtcIds)
      : etcRows.map(r => r.id);

    if (rowsToDelete.length === 0) return;
    if (!(await confirmDialog(`Are you sure you want to delete ${type === 'selected' ? rowsToDelete.length : 'all'} row(s)?`))) return;

    try {
      await costRepo.deleteManyEtcDetails(rowsToDelete);
      onSelectedEtcIdsChange(new Set());
      toast.success(`${rowsToDelete.length} row(s) deleted`);
    } catch (error) {
      console.error("Error bulk deleting ETC rows:", error);
      toast.error("Failed to delete rows");
    }
  };

  const handleBulkUpdateEtc = async () => {
    if (selectedEtcIds.size === 0) return;
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
      onSelectedEtcIdsChange(new Set());
      setEtcBulkUpdateData({ enterpriseAttributes: {}, projectAttributes: {}, userDefined: {} });
      toast.success(`Updated ${selectedEtcIds.size} rows`);
    } catch (error) {
      console.error("Error bulk updating ETC:", error);
      toast.error("Failed to update rows");
    }
  };

  const handleExportEtc = () => {
    const allPeriods = project.reportingPeriods?.periods || [];
    const currentPeriodId = project.reportingPeriods?.currentPeriodId;
    const currentIndex = allPeriods.findIndex(p => p.id === currentPeriodId);
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
              periodValues[p.id] = futurePeriodIds.includes(p.id) ? Number(row[p.name]) || 0 : 0;
            }
          });

          const enterpriseAttributes: Record<string, string> = {};
          enterpriseLineItemAttrs.forEach(attr => {
            const val = row[`E_${attr.title}`];
            if (val !== undefined) enterpriseAttributes[attr.id] = String(val);
          });

          const projectAttributes: Record<string, string> = {};
          projectLineItemAttrs.forEach(attr => {
            const val = row[`P_${attr.title}`];
            if (val !== undefined) projectAttributes[attr.id] = String(val);
          });

          const userDefined: Record<string, any> = {};
          for (let i = 1; i <= 5; i++) {
            if (row[`Numeric ${i}`] !== undefined) userDefined[`num${i}`] = Number(row[`Numeric ${i}`]) || 0;
            if (row[`Text ${i}`] !== undefined) userDefined[`text${i}`] = String(row[`Text ${i}`] || '');
          }

          const maxSortOrder = etcRows.length > 0 ? Math.max(...etcRows.map(r => r.sortOrder || 0)) : -1;

          importRows.push({
            projectId: project.id,
            costCode: selectedEtcCode,
            item: String(row['Item'] || ''),
            description: String(row['Description'] || ''),
            category: String(row['Category'] || ''),
            unit: String(row['Unit'] || ''),
            rate: Number(row['Rate']) || 0,
            activityId: row['Activity ID'] || null,
            phasingMethod: 'Manual',
            phasingStartDate: '',
            phasingEndDate: '',
            phasingUnit: '',
            phasingQty: 0,
            periodValues,
            enterpriseAttributes,
            projectAttributes,
            userDefined,
            sortOrder: maxSortOrder + importRows.length + 1,
            source: 'MANUAL',
            isEnterpriseResource: false,
          });
        });

        if (importRows.length > 0) {
          await costRepo.createManyEtcDetails(importRows);
          toast.success(`Imported ${importRows.length} rows`);
        }
      } catch (error) {
        console.error("Error importing ETC details:", error);
        toast.error("Failed to import rows");
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const toggleAllEtcColumnGroups = (opened: boolean) => {
    if (!etcGridRef.current) return;
    const api = etcGridRef.current.api;
    const groups = api.getColumnGroupState();
    api.setColumnGroupState(groups.map(g => ({ groupId: g.groupId, open: opened })));
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <AnimatePresence>
      {selectedEtcCode && (
        <motion.div
          key={selectedEtcCode}
          initial={{ height: 0, opacity: 0 }}
          animate={{
            height: isMainTableCollapsed ? 'calc(100% - 60px)' : '60%',
            opacity: 1
          }}
          exit={{ height: 0, opacity: 0 }}
          className="border-t border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#0a0a0a] flex flex-col overflow-hidden"
        >
          {/* Toolbar */}
          <div className="p-4 flex items-center justify-between bg-white dark:bg-[#141414] border-b border-gray-200 dark:border-white/10">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-orange-600">&#9638;</span>
                <h3 className="font-bold dark:text-white">ETC Details: <span className="text-orange-600">{selectedEtcCode}</span></h3>
              </div>
              <div className="h-4 w-px bg-gray-200 dark:border-white/10" />
              <p className="text-xs text-gray-500">Time-Based Forecasting</p>
            </div>
            <div className="flex items-center gap-2">
              {selectedEtcIds.size > 0 && (
                <button
                  onClick={() => handleDeleteEtcRows('selected')}
                  className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-red-700 transition-colors shadow-sm"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Selected ({selectedEtcIds.size})
                </button>
              )}
              <div className="h-4 w-px bg-gray-200 dark:border-white/10 mx-1" />
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search items..."
                  value={etcQuickFilterText}
                  onChange={(e) => setEtcQuickFilterText(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg text-xs focus:ring-2 focus:ring-orange-500 outline-none w-48 dark:text-white"
                />
              </div>
              <div className="h-4 w-px bg-gray-200 dark:border-white/10 mx-1" />
              <input
                type="file"
                ref={etcFileInputRef}
                className="hidden"
                accept=".xlsx,.xls,.csv"
                onChange={handleImportEtc}
              />
              <button
                onClick={() => etcFileInputRef.current?.click()}
                className="p-2 text-gray-400 hover:text-black dark:hover:text-white transition-colors"
                title="Import Excel"
              >
                <Upload className="w-5 h-5" />
              </button>
              <button
                onClick={handleExportEtc}
                className="p-2 text-gray-400 hover:text-black dark:hover:text-white transition-colors"
                title="Export Excel"
              >
                <Download className="w-5 h-5" />
              </button>
              <div className="w-px h-6 bg-gray-200 dark:bg-white/10 mx-1" />
              <button
                onClick={() => toggleAllEtcColumnGroups(true)}
                className="p-2 text-gray-400 hover:text-black dark:hover:text-white transition-colors"
                title="Expand All Groups"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => toggleAllEtcColumnGroups(false)}
                className="p-2 text-gray-400 hover:text-black dark:hover:text-white transition-colors"
                title="Collapse All Groups"
              >
                <Minimize2 className="w-4 h-4" />
              </button>
              <div className="w-px h-6 bg-gray-200 dark:bg-white/10 mx-1" />
              {selectedEtcIds.size > 0 && (
                <>
                  <button
                    onClick={() => setIsEtcBulkUpdating(true)}
                    className="flex items-center gap-2 bg-black dark:bg-white text-white dark:text-black px-3 py-1.5 rounded-lg text-xs font-bold hover:opacity-90 transition-all shadow-lg shadow-black/10"
                    title={`Bulk Update (${selectedEtcIds.size})`}
                  >
                    <Edit2 className="w-4 h-4" /> ({selectedEtcIds.size})
                  </button>
                  <div className="w-px h-6 bg-gray-200 dark:bg-white/10 mx-1" />
                </>
              )}
              <button
                onClick={() => setIsEtcChartVisible(!isEtcChartVisible)}
                className={cn(
                  "p-2 rounded-lg transition-all",
                  isEtcChartVisible
                    ? "bg-black text-white dark:bg-white dark:text-black shadow-lg"
                    : "text-gray-400 hover:text-black dark:hover:text-white"
                )}
                title={isEtcChartVisible ? "Hide Chart" : "Show Chart"}
              >
                <BarChart3 className="w-5 h-5" />
              </button>
              <div className="w-px h-6 bg-gray-200 dark:bg-white/10 mx-1" />
              <button
                onClick={onCalculatePhasing}
                className="flex items-center gap-2 bg-black dark:bg-white text-white dark:text-black px-4 py-2 rounded-lg text-sm font-bold hover:opacity-90 transition-all shadow-lg shadow-black/10"
              >
                <Calculator className="w-4 h-4" /> Calculate
              </button>
              <div className="w-px h-6 bg-gray-200 dark:bg-white/10 mx-1" />
              <div className="flex items-center gap-2 bg-gray-100 dark:bg-white/5 p-1 rounded-xl">
                <input
                  type="number"
                  value={addRowsCount}
                  onChange={(e) => setAddRowsCount(parseInt(e.target.value) || 1)}
                  className="w-16 px-2 py-1 bg-white dark:bg-[#141414] border border-gray-200 dark:border-white/10 rounded-lg text-xs font-bold focus:outline-none focus:ring-2 focus:ring-orange-500"
                  min="1"
                  max="500"
                />
                <button
                  onClick={handleAddEtcRow}
                  className="flex items-center gap-2 bg-black dark:bg-white text-white dark:text-black px-4 py-2 rounded-lg text-sm font-bold hover:opacity-90 transition-all shadow-lg shadow-black/10"
                >
                  <Plus className="w-4 h-4" /> Add
                </button>
                <div className="w-px h-6 bg-gray-200 dark:bg-white/10 mx-1" />
                <button
                  onClick={() => setIsResourceModalOpen(true)}
                  className="p-2 text-black dark:text-white hover:bg-gray-200 dark:hover:bg-white/10 rounded-lg transition-colors"
                  title="Resource Library"
                >
                  <Database className="w-5 h-5" />
                </button>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-black dark:hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Histogram Chart */}
          <AnimatePresence>
            {isEtcChartVisible && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="bg-white dark:bg-[#141414] border-b border-gray-200 dark:border-white/10 px-4 py-4 overflow-hidden"
              >
                <div className="grid grid-cols-2 gap-8">
                  {/* Qty Histogram */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Quantity Distribution</span>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-purple-500" />
                        <span className="text-[10px] font-bold text-gray-500 uppercase">Periodic Qty</span>
                      </div>
                    </div>
                    <div className="h-64 bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-200 dark:border-white/10 p-4">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={etcChartData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#333' : '#eee'} />
                          <XAxis dataKey="name" fontSize={9} tick={{ fill: theme === 'dark' ? '#999' : '#666' }} axisLine={false} tickLine={false} />
                          <YAxis fontSize={9} tick={{ fill: theme === 'dark' ? '#999' : '#666' }} axisLine={false} tickLine={false} />
                          <Tooltip contentStyle={{ backgroundColor: theme === 'dark' ? '#141414' : '#fff', borderColor: theme === 'dark' ? '#333' : '#eee', borderRadius: '8px', fontSize: '11px', padding: '8px' }} />
                          <Bar dataKey="qty" name="Periodic Qty" fill="#a855f7" radius={[2, 2, 0, 0]} barSize={20}>
                            <LabelList dataKey="qty" position="top" formatter={(val: number) => Math.round(val).toLocaleString()} style={{ fill: theme === 'dark' ? '#fff' : '#000', fontWeight: 'bold', fontSize: '9px' }} />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  {/* Cost Chart */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Cost Distribution (Cost Flow)</span>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full bg-blue-500" />
                          <span className="text-[10px] font-bold text-gray-500 uppercase">Periodic Cost</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-0.5 bg-emerald-500" />
                          <span className="text-[10px] font-bold text-gray-500 uppercase">Cumulative</span>
                        </div>
                      </div>
                    </div>
                    <div className="h-64 bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-200 dark:border-white/10 p-4">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={etcChartData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#333' : '#eee'} />
                          <XAxis dataKey="name" fontSize={9} tick={{ fill: theme === 'dark' ? '#999' : '#666' }} axisLine={false} tickLine={false} />
                          <YAxis yAxisId="left" fontSize={9} tick={{ fill: theme === 'dark' ? '#999' : '#666' }} axisLine={false} tickLine={false} tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`} />
                          <YAxis yAxisId="right" orientation="right" fontSize={9} tick={{ fill: theme === 'dark' ? '#999' : '#666' }} axisLine={false} tickLine={false} tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`} />
                          <Tooltip contentStyle={{ backgroundColor: theme === 'dark' ? '#141414' : '#fff', borderColor: theme === 'dark' ? '#333' : '#eee', borderRadius: '8px', fontSize: '11px', padding: '8px' }} formatter={(val: number) => [`$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, '']} />
                          <Bar yAxisId="left" dataKey="cost" name="Periodic Cost" fill="#3b82f6" radius={[2, 2, 0, 0]} barSize={20}>
                            <LabelList dataKey="cost" position="top" formatter={(val: number) => `${Math.round(val / 1000)}k`} style={{ fill: theme === 'dark' ? '#fff' : '#000', fontWeight: 'bold', fontSize: '9px' }} />
                          </Bar>
                          <Line yAxisId="right" type="monotone" dataKey="cumulative" name="Cumulative" stroke="#10b981" strokeWidth={2} dot={false} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Grid */}
          <div className="flex-1 min-h-0 relative">
            <div className={cn("absolute inset-0 ag-theme-quartz", theme === 'dark' ? "ag-theme-quartz-dark" : "")}>
              <AgGridReact
                theme="legacy"
                ref={etcGridRef}
                rowData={etcRows}
                columnDefs={etcColumnDefs}
                quickFilterText={etcQuickFilterText}
                getRowId={getEtcRowId}
                defaultColDef={{
                  sortable: true,
                  filter: true,
                  resizable: true,
                  wrapHeaderText: true,
                  autoHeaderHeight: true,
                  enableRowGroup: true,
                  enablePivot: true,
                  enableValue: true,
                  minWidth: 100,
                }}
                autoGroupColumnDef={autoGroupColumnDef}
                sideBar={sideBar}
                statusBar={statusBar}
                onCellValueChanged={onEtcCellValueChanged}
                onRowDataUpdated={onEtcRowDataUpdated}
                suppressColumnVirtualisation={true}
                onColumnGroupOpened={(params) => {
                  etcGroupStateRef.current = params.api.getColumnGroupState();
                  const state = params.api.getColumnGroupState();
                  localStorage.setItem(`etcColumnGroupState_${project.id}_${selectedEtcCode}`, JSON.stringify(state));
                }}
                onGridReady={(params) => {
                  const savedState = localStorage.getItem(`etcGridState_${project.id}_${selectedEtcCode}`);
                  if (savedState) {
                    params.api.applyColumnState({ state: JSON.parse(savedState), applyOrder: true });
                  }
                  const savedGroupState = localStorage.getItem(`etcColumnGroupState_${project.id}_${selectedEtcCode}`);
                  if (savedGroupState) {
                    params.api.setColumnGroupState(JSON.parse(savedGroupState));
                    etcGroupStateRef.current = JSON.parse(savedGroupState);
                  }
                }}
                animateRows={false}
                suppressColumnMoveAnimation={true}
                enableRangeSelection={true}
                enableFillHandle={true}
                undoRedoCellEditing={true}
                enableCellTextSelection={true}
                suppressClipboardPaste={false}
                processCellFromClipboard={(params) => {
                  const colId = params.column.getColId();
                  if (colId === 'phasingStartDate' || colId === 'phasingEndDate') {
                    const val = params.value;
                    if (typeof val === 'string') {
                      const trimmed = val.trim();
                      const dmyMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
                      if (dmyMatch) {
                        let day = parseInt(dmyMatch[1]);
                        let month = parseInt(dmyMatch[2]);
                        let year = parseInt(dmyMatch[3]);
                        if (year < 100) year += 2000;
                        const date = new Date(year, month - 1, day);
                        if (!isNaN(date.getTime())) return date.toISOString();
                      }
                    }
                  }
                  if (colId.startsWith('enterpriseAttributes.') || colId.startsWith('projectAttributes.')) {
                    const val = params.value;
                    if (typeof val === 'string' && val.includes(' - ')) {
                      return val.split(' - ')[0];
                    }
                  }
                  return params.value;
                }}
                loading={isEtcLoading}
                pinnedTopRowData={etcPinnedTopRowData}
                getRowClass={getEtcRowClass}
                rowSelection="multiple"
                suppressRowClickSelection={true}
                onSelectionChanged={(event) => {
                  const selectedRows = event.api.getSelectedRows();
                  const displayedSelected = selectedRows.filter(row => {
                    const node = event.api.getRowNode(row.id);
                    return node && node.displayed;
                  });
                  onSelectedEtcIdsChange(new Set(displayedSelected.map(row => row.id)));
                }}
                onFilterChanged={(event) => {
                  const selectedRows = event.api.getSelectedRows();
                  const displayedSelected = selectedRows.filter(row => {
                    const node = event.api.getRowNode(row.id);
                    return node && node.displayed;
                  });
                  onSelectedEtcIdsChange(new Set(displayedSelected.map(row => row.id)));
                }}
              />
            </div>
          </div>
        </motion.div>
      )}

      {/* ETC Bulk Update Modal */}
      {isEtcBulkUpdating && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[100] p-4">
          <div className="bg-white dark:bg-[#141414] rounded-3xl p-8 w-full max-w-2xl shadow-2xl border border-gray-200 dark:border-white/10 animate-in zoom-in-95 duration-200 overflow-y-auto max-h-[90vh] custom-scrollbar">
            <h2 className="text-xl font-bold mb-2 dark:text-white">Bulk Update ETC Details</h2>
            <p className="text-sm text-gray-500 mb-6 uppercase tracking-widest font-bold">Updating {selectedEtcIds.size} selected rows</p>

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Resource Category</label>
                  <select
                    value={etcBulkUpdateData.category || ''}
                    onChange={e => setEtcBulkUpdateData({ ...etcBulkUpdateData, category: e.target.value || undefined })}
                    className="w-full p-4 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-black/5 dark:text-white"
                  >
                    <option value="">No Change</option>
                    {((enterprise.categories && enterprise.categories.length > 0) ? enterprise.categories : DEFAULT_CATEGORIES).map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <p className="text-[9px] text-gray-400 mt-1 italic">* Only applies to manual rows</p>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Calendar</label>
                  <select
                    value={etcBulkUpdateData.calendarId || ''}
                    onChange={e => setEtcBulkUpdateData({ ...etcBulkUpdateData, calendarId: e.target.value || undefined })}
                    className="w-full p-4 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-black/5 dark:text-white"
                  >
                    <option value="">No Change</option>
                    {calendars.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Phasing Method</label>
                  <select
                    value={etcBulkUpdateData.phasingMethod || ''}
                    onChange={e => setEtcBulkUpdateData({ ...etcBulkUpdateData, phasingMethod: e.target.value as any || undefined })}
                    className="w-full p-4 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-black/5 dark:text-white"
                  >
                    <option value="">No Change</option>
                    <option value="Manual">Manual</option>
                    <option value="Auto-Phase">Auto-Phase</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Phasing Unit</label>
                  <select
                    value={etcBulkUpdateData.phasingUnit || ''}
                    onChange={e => setEtcBulkUpdateData({ ...etcBulkUpdateData, phasingUnit: e.target.value as any || undefined })}
                    className="w-full p-4 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-black/5 dark:text-white"
                  >
                    <option value="">No Change</option>
                    {['Daily', 'Weekly', 'Monthly', 'Total'].map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>

              {enterpriseLineItemAttrs.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-4 border-b border-gray-100 dark:border-white/10 pb-2">Enterprise Attributes</p>
                  <div className="grid grid-cols-2 gap-4">
                    {enterpriseLineItemAttrs.map(attr => (
                      <div key={attr.id}>
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">{attr.title}</label>
                        <select
                          value={etcBulkUpdateData.enterpriseAttributes[attr.id] || ''}
                          onChange={e => setEtcBulkUpdateData({ ...etcBulkUpdateData, enterpriseAttributes: { ...etcBulkUpdateData.enterpriseAttributes, [attr.id]: e.target.value } })}
                          className="w-full p-4 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-black/5 dark:text-white"
                        >
                          <option value="">No Change</option>
                          {attr.values.map(v => <option key={v.id} value={v.id}>{v.description}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {projectLineItemAttrs.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-4 border-b border-gray-100 dark:border-white/10 pb-2">Project Attributes</p>
                  <div className="grid grid-cols-2 gap-4">
                    {projectLineItemAttrs.map(attr => (
                      <div key={attr.id}>
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">{attr.title}</label>
                        <select
                          value={etcBulkUpdateData.projectAttributes[attr.id] || ''}
                          onChange={e => setEtcBulkUpdateData({ ...etcBulkUpdateData, projectAttributes: { ...etcBulkUpdateData.projectAttributes, [attr.id]: e.target.value } })}
                          className="w-full p-4 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-black/5 dark:text-white"
                        >
                          <option value="">No Change</option>
                          {attr.values.map(v => <option key={v.id} value={v.id}>{v.description}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-6 border-t border-gray-100 dark:border-white/10 mt-6">
              <button
                onClick={() => setIsEtcBulkUpdating(false)}
                className="px-6 py-3 text-sm font-bold text-gray-500 hover:text-black dark:hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkUpdateEtc}
                disabled={selectedEtcIds.size === 0}
                className="px-8 py-3 rounded-2xl text-sm font-bold bg-black dark:bg-white text-white dark:text-black hover:opacity-90 transition-all shadow-xl shadow-black/10 disabled:opacity-50"
              >
                Update {selectedEtcIds.size} Rows
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Resource Library Modal */}
      {isResourceModalOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsResourceModalOpen(false)}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[100]"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 w-[800px] bg-white dark:bg-[#0A0A0A] shadow-[-20px_0_50px_rgba(0,0,0,0.1)] z-[101] flex flex-col border-l border-gray-200 dark:border-white/10"
          >
            <div className="shrink-0 p-6 border-b bg-white dark:bg-[#0A0A0A]">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20">
                    <Database className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-bold tracking-tight dark:text-white">Resource Library</h2>
                      <div className="flex bg-gray-100 dark:bg-white/5 p-1 rounded-lg ml-4">
                        <button
                          onClick={() => setResourceLibrarySource('enterprise')}
                          className={cn("px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all", resourceLibrarySource === 'enterprise' ? "bg-white dark:bg-[#1a1a1a] shadow-sm text-blue-600" : "text-gray-400 hover:text-gray-600")}
                        >
                          Enterprise
                        </button>
                        <button
                          onClick={() => setResourceLibrarySource('project')}
                          className={cn("px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all", resourceLibrarySource === 'project' ? "bg-white dark:bg-[#1a1a1a] shadow-sm text-blue-600" : "text-gray-400 hover:text-gray-600")}
                        >
                          Project
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                      Adding to <span className="font-bold text-blue-600">{selectedEtcCode}</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-white/5 rounded-lg border border-gray-200 dark:border-white/10">
                    <span className="text-sm font-bold text-blue-600">{selectedResourceIds.size}</span>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Selected</span>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setIsResourceModalOpen(false)} className="w-10 h-10 rounded-xl hover:bg-gray-100 dark:hover:bg-white/10 text-gray-400">
                    <X className="w-5 h-5" />
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder={`Search ${resourceLibrarySource} resources...`}
                    value={resourceSearch}
                    onChange={(e) => setResourceSearch(e.target.value)}
                    className="pl-10 h-10 bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 transition-all"
                  />
                </div>
              </div>
            </div>

            <ScrollArea className="flex-1">
              <div className="p-4 space-y-2">
                {groupedLibraryResources.map(([category, resources]) => (
                  <div key={category}>
                    <button
                      onClick={() => {
                        const allSelected = resources.every(r => selectedResourceIds.has(r.id));
                        const next = new Set(selectedResourceIds);
                        resources.forEach(r => allSelected ? next.delete(r.id) : next.add(r.id));
                        setSelectedResourceIds(next);
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-xl transition-colors mb-1"
                    >
                      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{category}</span>
                      <span className="text-[10px] font-bold text-gray-400">{resources.length} items</span>
                    </button>
                    <div className="space-y-1 pl-2">
                      {resources.map(resource => {
                        const isSelected = selectedResourceIds.has(resource.id);
                        return (
                          <div
                            key={resource.id}
                            onClick={() => {
                              const next = new Set(selectedResourceIds);
                              isSelected ? next.delete(resource.id) : next.add(resource.id);
                              setSelectedResourceIds(next);
                            }}
                            className={cn(
                              "grid grid-cols-[60px_100px_1fr_120px_80px_100px] gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all text-xs",
                              isSelected
                                ? "bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800"
                                : "hover:bg-gray-50 dark:hover:bg-white/5 border border-transparent"
                            )}
                          >
                            <span className={cn("font-mono font-bold truncate", isSelected ? "text-blue-600" : "text-gray-500")}>{resource.id}</span>
                            <span className={cn("font-bold truncate", isSelected ? "text-blue-700 dark:text-blue-300" : "text-gray-700 dark:text-gray-300")}>{resource.name}</span>
                            <span className="text-gray-400 truncate">{resource.category}</span>
                            <span className={cn("text-right font-bold", isSelected ? "text-blue-600" : "text-gray-600 dark:text-gray-400")}>{resource.unit || 'HR'}</span>
                            <span className={cn("text-right font-bold", isSelected ? "text-blue-600" : "text-gray-600 dark:text-gray-400")}>${(resource.rate || 0).toLocaleString()}</span>
                            <span className={cn("text-right font-bold text-[10px] uppercase", isSelected ? "text-blue-500" : "text-gray-400")}>{isSelected ? 'Selected' : 'Select'}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
                {groupedLibraryResources.length === 0 && (
                  <div className="text-center py-12 text-gray-400">
                    <Database className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm font-medium">No resources found</p>
                    <p className="text-xs mt-1">Try a different search or switch source</p>
                  </div>
                )}
              </div>
            </ScrollArea>

            <div className="shrink-0 p-4 border-t border-gray-200 dark:border-white/10 bg-white dark:bg-[#0A0A0A] flex items-center justify-between">
              <button
                onClick={() => { setSelectedResourceIds(new Set()); setIsResourceModalOpen(false); }}
                className="px-4 py-2 text-sm font-bold text-gray-500 hover:text-black dark:hover:text-white transition-colors"
              >
                Cancel
              </button>
              <Button
                onClick={() => {
                  const library = resourceLibrarySource === 'enterprise' ? enterprise.resourceRates : project.resourceRates;
                  const selected = library?.filter(r => selectedResourceIds.has(r.id)) || [];
                  handleAddResources(selected, resourceLibrarySource);
                }}
                disabled={selectedResourceIds.size === 0}
                className="px-6 h-10 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-600/20 disabled:opacity-50 disabled:shadow-none transition-all flex items-center gap-2 text-sm"
              >
                Add to Forecast <Plus className="w-4 h-4" />
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
