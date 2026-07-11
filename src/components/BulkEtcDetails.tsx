import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { buildEtcColumnDefs, DEFAULT_ETC_CATEGORIES } from './bulk-etc-details/columns';
import ResourceLibraryModal from './bulk-etc-details/ResourceLibraryModal';
import EtcBulkUpdateDialog, { EtcBulkUpdatePayload } from './bulk-etc-details/EtcBulkUpdateDialog';
import { createPortal } from 'react-dom';
import { Project, Enterprise, CostCode, Calendar as ProjectCalendar, EtcDetail, ResourceRate, ScheduleItem } from '../types';
import { useCostRepo, useAuthRepo, useScheduleRepo } from '../platform/firestore/hooks';
import { 
  Search, 
  Plus, 
  Trash2, 
  Upload, 
  Download, 
  Filter, 
  Layout, 
  Eye, 
  Maximize2,
  Minimize2,
  MoreVertical,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Settings,
  Calculator,
  Briefcase,
  ClipboardList,
  Database,
  X,
  Edit2,
  BarChart3
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
  Legend,
  LabelList
} from 'recharts';
import * as XLSX from 'xlsx';
import DataGridModule from './DataGridModule';
import { cn, formatNumber } from '../lib/utils';
import { isWorkingDay as domainIsWorkingDay } from '../domain/procurement';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { Badge } from '@/components/ui/badge';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { AgGridReact } from 'ag-grid-react';
import { 
  ColDef, 
  ColGroupDef,
  GridReadyEvent, 
  GridApi,
  CellValueChangedEvent,
  ValueFormatterParams,
  ColumnGroup
} from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';
import 'ag-grid-enterprise';

interface BulkEtcDetailsProps {
  project: Project;
  enterprise: Enterprise;
  theme?: 'light' | 'dark';
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export default function BulkEtcDetails({ project, enterprise, theme = 'light' }: BulkEtcDetailsProps) {
  const costRepo = useCostRepo();
  const authRepo = useAuthRepo();
  const scheduleRepo = useScheduleRepo();
  const [etcRows, setEtcRows] = useState<any[]>([]);
  const [costCodes, setCostCodes] = useState<CostCode[]>([]);
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>([]);
  const [calendars, setCalendars] = useState<ProjectCalendar[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEtcLoading, setIsEtcLoading] = useState(false);
  
  // Table State
  const [etcQuickFilterText, setEtcQuickFilterText] = useState('');
  const [selectedEtcIds, setSelectedEtcIds] = useState<Set<string>>(new Set());
  
  // UI State
  const [isSaving, setIsSaving] = useState(false);
  const [isEtcBulkUpdating, setIsEtcBulkUpdating] = useState(false);
  
  const [isEtcChartVisible, setIsEtcChartVisible] = useState(false);
  const [weekEndingDay] = useState<number>(0); // 0: Sun, 5: Fri, 6: Sat
  const [addRowsCount, setAddRowsCount] = useState(1);
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'selected' | 'all'; count: number } | null>(null);
  const [isResourceModalOpen, setIsResourceModalOpen] = useState(false);

  const handleFirestoreError = (error: any, operationType: OperationType, path: string | null) => {
    const errInfo = {
      error: error instanceof Error ? error.message : String(error),
      authInfo: {
        userId: authRepo.getCurrentUser()?.id,
        email: authRepo.getCurrentUser()?.email,
      },
      operationType,
      path
    };
    console.error('Firestore Error: ', JSON.stringify(errInfo));
    throw new Error(JSON.stringify(errInfo));
  };

  const etcGridRef = useRef<AgGridReact>(null);
  const etcColumnDefsRef = useRef<any[]>([]);
  const etcFileInputRef = useRef<HTMLInputElement>(null);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  // Fetch Cost Codes
  useEffect(() => {
    if (!project.id) return;
    return costRepo.subscribeCostCodes(project.id, setCostCodes);
  }, [project.id]);

  // Fetch Calendars
  useEffect(() => {
    return scheduleRepo.subscribeProjectCalendars(project.id, (cals) => setCalendars(cals as any[]));
  }, [project.id]);

  // Fetch ALL ETC Details for the project
  useEffect(() => {
    setIsEtcLoading(true);
    const unsubscribe = costRepo.subscribeEtcDetails(project.id, (rows) => {
      const sortedRows = [...rows].sort((a: any, b: any) => {
        if (a.costCode !== b.costCode) return (a.costCode || '').localeCompare(b.costCode || '');
        const orderA = (a as any).sortOrder ?? -1;
        const orderB = (b as any).sortOrder ?? -1;
        if (orderA !== orderB) return orderA - orderB;
        return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
      });
      setEtcRows(sortedRows as any[]);
      setIsEtcLoading(false);
      setLoading(false);
    });

    const unsubSch = scheduleRepo.subscribeScheduleItems(project.id, setScheduleItems);

    return () => {
      unsubscribe();
      unsubSch();
    };
  }, [project.id]);

  const etcChartData = useMemo(() => {
    if (!project.reportingPeriods?.periods || etcRows.length === 0) return [];
    
    const currentPeriodId = project.reportingPeriods?.currentPeriodId;
    const currentPeriodIndex = project.reportingPeriods?.periods.findIndex(p => p.id === currentPeriodId) ?? -1;
    const periods = project.reportingPeriods.periods.slice(currentPeriodIndex + 1);
    
    // Calculate initial cumulative from all cost codes' actual cost to date
    const initialActualCost = costCodes.reduce((sum, cc) => sum + (cc.actualCostToDate || 0), 0);
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
  }, [etcRows, project.reportingPeriods, costCodes]);

  const enterpriseLineItemAttrs = useMemo(() => 
    enterprise.lineItemAttributes?.filter(attr => attr.title && attr.title.trim() !== '') || []
  , [enterprise.lineItemAttributes]);

  const projectLineItemAttrs = useMemo(() => 
    project.lineItemAttributes?.filter(attr => attr.title && attr.title.trim() !== '') || []
  , [project.lineItemAttributes]);

  const handleUpdateEtcRow = useCallback(async (rowId: string, data: any) => {
    if (!rowId) return;
    try {
      const allPeriods = project.reportingPeriods?.periods || [];
      const currentPeriodId = project.reportingPeriods?.currentPeriodId;
      const currentIndex = allPeriods.findIndex(p => p.id === currentPeriodId);
      const futurePeriodIds = allPeriods.slice(currentIndex + 1).map(p => p.id);

      const updates: any = {
        updatedAt: new Date().toISOString()
      };

      const allowedFields = [
        'costCode', 'activityId', 'item', 'description', 'category', 'unit', 'rate', 'qty', 
        'phasingMethod', 'phasingStartDate', 'phasingEndDate', 
        'phasingUnit', 'phasingQty', 'calendarId', 'periodValues',
        'enterpriseAttributes', 'projectAttributes', 'userDefined',
        'source', 'isEnterpriseResource', 'externalId'
      ];

      allowedFields.forEach(field => {
        if (data[field] !== undefined) {
          let val = data[field];
          
          if (val === null) {
            if (field === 'item' || field === 'description' || field === 'unit' || field === 'category' || field === 'costCode') {
              val = '';
            } else if (field === 'qty' || field === 'rate' || field === 'phasingQty') {
              val = 0;
            } else if (field === 'periodValues' || field === 'enterpriseAttributes' || field === 'projectAttributes' || field === 'userDefined') {
              val = {};
            }
          }
          
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

      await costRepo.updateEtcDetail(rowId, updates as any);
    } catch (error) {
      console.error("Error updating ETC row:", error);
      toast.error("Failed to update row");
    }
  }, [project.reportingPeriods]);

  const handleDeleteEtcRows = async () => {
    if (!deleteConfirm) return;
    
    const rowsToDelete = deleteConfirm.type === 'selected' 
      ? Array.from(selectedEtcIds) 
      : etcRows.map(r => r.id);

    if (rowsToDelete.length === 0) {
      setDeleteConfirm(null);
      return;
    }

    setIsSaving(true);
    try {
      await costRepo.deleteManyEtcDetails(rowsToDelete);
      setSelectedEtcIds(new Set());
      setDeleteConfirm(null);
      toast.success(`${rowsToDelete.length} row(s) deleted`);
    } catch (error) {
      console.error("Error bulk deleting ETC rows:", error);
      toast.error("Failed to delete rows");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddEtcRow = async () => {
    try {
      const count = Math.max(1, Math.min(500, addRowsCount));
      let insertSortOrder: number;
      const selectedRows = etcGridRef.current?.api.getSelectedRows() || [];
      if (selectedRows.length > 0) {
        const lastSelected = selectedRows[selectedRows.length - 1];
        insertSortOrder = (lastSelected as any).sortOrder + 1;
        const toShift = etcRows.filter(r => (r as any).sortOrder >= insertSortOrder);
        if (toShift.length > 0) {
          await costRepo.updateManyEtcDetails(toShift.map(r => ({ id: r.id, data: { sortOrder: (r as any).sortOrder + count } })));
        }
      } else {
        const maxSortOrder = etcRows.length > 0 ? Math.max(...etcRows.map(r => (r as any).sortOrder || 0)) : -1;
        insertSortOrder = maxSortOrder + 1;
      }
      const toCreate = Array.from({ length: count }, (_, i) => ({ projectId: project.id, costCode: '', item: '', description: '', qty: 0, unit: '', rate: 0, phasingMethod: 'Manual', phasingStartDate: '', phasingEndDate: '', phasingUnit: '', phasingQty: 0, category: '', periodValues: {}, enterpriseAttributes: {}, projectAttributes: {}, userDefined: {}, sortOrder: insertSortOrder + i, source: 'MANUAL', isEnterpriseResource: false }));
      await costRepo.createManyEtcDetails(toCreate as any);
      toast.success(`${count} row(s) added successfully`);
    } catch (error) {
      console.error("Error adding row:", error);
      toast.error("Failed to add row");
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

  const handleBulkUpdateEtc = async (payload: EtcBulkUpdatePayload) => {
    if (selectedEtcIds.size === 0) return;

    setIsSaving(true);
    try {
      const bulkUpdates: Array<{ id: string; data: any }> = [];
      selectedEtcIds.forEach(id => {
        const row = etcRows.find(r => r.id === id);
        const updateObj: any = {};
        const isLibraryResource = (row as any)?.isEnterpriseResource || (row as any)?.source === 'PROJECT';
        if (payload.category && !isLibraryResource) updateObj.category = payload.category;
        if (payload.calendarId) updateObj.calendarId = payload.calendarId;
        if (payload.phasingMethod) updateObj.phasingMethod = payload.phasingMethod;
        if (payload.phasingUnit) updateObj.phasingUnit = payload.phasingUnit;
        if (Object.keys(payload.enterpriseAttributes).length > 0) updateObj.enterpriseAttributes = { ...(row as any)?.enterpriseAttributes, ...payload.enterpriseAttributes };
        if (Object.keys(payload.projectAttributes).length > 0) updateObj.projectAttributes = { ...(row as any)?.projectAttributes, ...payload.projectAttributes };
        if (Object.keys(payload.userDefined || {}).length > 0) updateObj.userDefined = { ...(row as any)?.userDefined, ...payload.userDefined };
        bulkUpdates.push({ id, data: updateObj });
      });
      await costRepo.updateManyEtcDetails(bulkUpdates);
      setIsEtcBulkUpdating(false);
      setSelectedEtcIds(new Set());
      toast.success(`Updated ${selectedEtcIds.size} rows`);
    } catch (error) {
      console.error("Error bulk updating ETC:", error);
      toast.error("Failed to update rows");
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportEtc = () => {
    const allPeriods = project.reportingPeriods?.periods || [];
    const currentPeriodId = project.reportingPeriods?.currentPeriodId;
    const currentIndex = allPeriods.findIndex(p => p.id === currentPeriodId);
    const futurePeriods = allPeriods.slice(currentIndex + 1);

    const data = etcRows.map(row => {
      const exportRow: any = {
        'Cost Code ID': row.costCode,
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
    XLSX.writeFile(wb, `Bulk_ETC_Details_${project.projectName}.xlsx`);
  };

  const toggleAllEtcColumnGroups = (expand: boolean) => {
    if (!etcGridRef.current?.api) return;
    const columnGroups = etcGridRef.current.api.getAllDisplayedColumnGroups();
    columnGroups?.forEach(group => {
      // Use type guard to check if it's a column group
      if ('getGroupId' in group) {
        etcGridRef.current?.api.setColumnGroupOpened((group as any).getGroupId(), expand);
      }
    });
  };

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
    
    // Distribution periods (starting from next period)
    const distributionPeriods = currentIndex !== -1 ? allPeriods.slice(currentIndex + 1) : allPeriods;
    // Clearing periods (starting from current period to ensure no old forecast pollution)
    const periodsToClear = currentIndex !== -1 ? allPeriods.slice(currentIndex) : allPeriods;

    if (distributionPeriods.length === 0) {
      toast.error("No periods available for future phasing");
      return;
    }

    const phasingBatchUpdates: Array<{ id: string; data: any }> = [];
    let updatedCount = 0;

    const parseDateToUTCMidnight = (val: any): Date | null => {
      if (!val) return null;
      if (typeof val === 'string' && val.includes('-')) {
        const parts = val.split('T')[0].split('-');
        if (parts.length >= 3) {
          const p0 = Number(parts[0]);
          const p1 = Number(parts[1]);
          const p2 = Number(parts[2]);
          if (!isNaN(p0) && !isNaN(p1) && !isNaN(p2)) {
            if (parts[0].length === 4) {
              return new Date(Date.UTC(p0, p1 - 1, p2));
            } else if (parts[2].length === 4) {
              return new Date(Date.UTC(p2, p1 - 1, p0));
            }
          }
        }
      }
      let d: Date;
      if (val instanceof Date) d = val;
      else if (typeof val === 'object' && 'toDate' in val) d = val.toDate();
      else d = new Date(val);
      if (isNaN(d.getTime())) return null;
      return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    };

    try {
      for (const row of rowsToPhase) {
        const phasingQty = Number(row.phasingQty) || 0;
        if (!phasingQty || !row.phasingUnit) continue;

        const userStartRaw = parseDateToUTCMidnight(row.phasingStartDate);
        const userEndRaw = parseDateToUTCMidnight(row.phasingEndDate);

        // Retain past periods but clear out all distribution periods before writing new values
        const newPeriodValues: Record<string, number> = { ...(row.periodValues as Record<string, number> || {}) };
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
            let remainingQty = phasingQty;
            distributionPeriods.forEach((p, idx) => {
              if (idx === distributionPeriods.length - 1) {
                newPeriodValues[p.id] = Math.round(remainingQty * 10000) / 10000;
              } else {
                const weight = periodWeights[p.id] || 0;
                const periodQty = Math.round(phasingQty * (weight / totalWeight) * 10000) / 10000;
                newPeriodValues[p.id] = periodQty;
                remainingQty -= periodQty;
              }
            });
          } else {
            let remainingQty = phasingQty;
            const evenQty = Math.round((phasingQty / distributionPeriods.length) * 10000) / 10000;
            distributionPeriods.forEach((p, idx) => {
              if (idx === distributionPeriods.length - 1) {
                newPeriodValues[p.id] = Math.round(remainingQty * 10000) / 10000;
              } else {
                newPeriodValues[p.id] = evenQty;
                remainingQty -= evenQty;
              }
            });
          }
          
          phasingBatchUpdates.push({ id: row.id, data: { periodValues: newPeriodValues, qty: Object.keys(newPeriodValues).filter(key => distributionPeriods.some(dp => dp.id === key)).reduce((sum, key) => sum + (newPeriodValues[key] || 0), 0) } });
          updatedCount++;
          continue;
        }

        if (!userStartRaw || !userEndRaw) continue;

        let userStart = new Date(userStartRaw.getTime());
        let userEnd = new Date(userEndRaw.getTime());

        if (distributionPeriods.length > 0) {
          const futureStartRaw = parseDateToUTCMidnight(distributionPeriods[0].startDate);
          if (futureStartRaw) {
            if (userStart < futureStartRaw) {
              userStart = new Date(futureStartRaw.getTime());
            }
            if (userEnd < futureStartRaw) {
              userEnd = new Date(futureStartRaw.getTime());
            }
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
            totalWorkingDaysInRange++; // Count ALL working days in the user's date range
            const period = distributionPeriods.find(p => {
              const ps = parseDateToUTCMidnight(p.startDate);
              const pe = parseDateToUTCMidnight(p.endDate);
              if (!ps || !pe) return false;
              // IMPORTANT: we only map to periods that are inside the valid timeline (inclusive)
              return tempStep >= ps && tempStep <= pe;
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

        const phasingQtyVal = Number(row.phasingQty) || 0;

        // Total working days strictly covered by configured periods
        const totalDaysInPeriods = distributionPeriodIds.reduce((sum, pid) => sum + workingDaysInPeriod[pid], 0);

        let sumDistributed = 0;
        
        if (row.phasingUnit === 'Total') {
          // As requested: calculate working days from End Date - MAX(StartDate, Next Period)
          // then divide the 'Phasing Qty' by the working days to get daily rate.
          if (totalWorkingDaysInRange > 0) {
            const dailyQty = phasingQtyVal / totalWorkingDaysInRange;
            sumDistributed = 0;
            distributionPeriodIds.forEach((pid, idx) => {
              if (idx === distributionPeriodIds.length - 1) {
                 // Distribute any remaining quantity to the last period to ensure 
                 // the full amount is always phased, even with rounding or period truncation
                 newPeriodValues[pid] = Math.round((phasingQtyVal - sumDistributed) * 10000) / 10000;
              } else {
                 const periodQty = Math.round(dailyQty * workingDaysInPeriod[pid] * 10000) / 10000;
                 newPeriodValues[pid] = periodQty;
                 sumDistributed += periodQty;
              }
            });
          }
        } else if (row.phasingUnit === 'Profile') {
          const existingPeriodValues = (row.periodValues || {}) as Record<string, number>;
          let totalWeight = 0;
          const weights: Record<string, number> = {};
          
          distributionPeriodIds.forEach(pid => {
            let pWeight = Number(existingPeriodValues[pid]) || 0;
            Object.entries(existingPeriodValues).forEach(([key, val]) => {
              if (key.startsWith(pid + '_')) pWeight += Number(val) || 0;
            });
            weights[pid] = pWeight;
            totalWeight += pWeight;
          });

          if (totalWeight > 0) {
            sumDistributed = 0;
            distributionPeriodIds.forEach((pid, idx) => {
              if (idx === distributionPeriodIds.length - 1) {
                newPeriodValues[pid] = Math.round((phasingQtyVal - sumDistributed) * 10000) / 10000;
              } else {
                const weight = weights[pid] / totalWeight;
                const periodQty = Math.round(phasingQtyVal * weight * 10000) / 10000;
                newPeriodValues[pid] = periodQty;
                sumDistributed += periodQty;
              }
            });
          } else {
            // Fallback for profile behaves like distributing purely over the covered periods
            sumDistributed = 0;
            if (totalDaysInPeriods > 0) {
              distributionPeriodIds.forEach((pid, idx) => {
                if (idx === distributionPeriodIds.length - 1) {
                  newPeriodValues[pid] = Math.round((phasingQtyVal - sumDistributed) * 10000) / 10000;
                } else {
                  const weight = workingDaysInPeriod[pid] / totalDaysInPeriods;
                  const periodQty = Math.round(phasingQtyVal * weight * 10000) / 10000;
                  newPeriodValues[pid] = periodQty;
                  sumDistributed += periodQty;
                }
              });
            }
          }
        } else {
          let current = new Date(userStart.getTime());
          while (current <= userEnd) {
            if (!isWorkingDay(current)) {
              current.setUTCDate(current.getUTCDate() + 1);
              continue;
            }

            const period = distributionPeriods.find(p => {
              const ps = parseDateToUTCMidnight(p.startDate);
              const pe = parseDateToUTCMidnight(p.endDate);
              if (!ps || !pe) return false;
              return current >= ps && current <= pe;
            });

            if (period) {
              let dailyQty = 0;
              if (row.phasingUnit === 'Daily') {
                dailyQty = phasingQtyVal;
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
                dailyQty = weekWorkingDays > 0 ? phasingQtyVal / weekWorkingDays : 0;
              } else if (row.phasingUnit === 'Monthly') {
                let monthWorkingDays = 0;
                let monthStart = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), 1));
                let monthEnd = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + 1, 0));
                let monthTemp = new Date(monthStart.getTime());
                while (monthTemp <= monthEnd) {
                  if (isWorkingDay(monthTemp)) monthWorkingDays++;
                  monthTemp.setUTCDate(monthTemp.getUTCDate() + 1);
                }
                dailyQty = monthWorkingDays > 0 ? phasingQtyVal / monthWorkingDays : 0;
              }
              newPeriodValues[period.id] = (newPeriodValues[period.id] || 0) + dailyQty;
            }
            current.setUTCDate(current.getUTCDate() + 1);
          }

          distributionPeriodIds.forEach(pid => {
            newPeriodValues[pid] = Math.round((newPeriodValues[pid] || 0) * 10000) / 10000;
          });
        }

        const newFutureQtyTotal = distributionPeriods.reduce((acc, p) => acc + (newPeriodValues[p.id] || 0), 0);
        
        phasingBatchUpdates.push({ id: row.id, data: { periodValues: newPeriodValues, qty: Math.round(newFutureQtyTotal * 10000) / 10000 } });
        updatedCount++;
      }

      if (updatedCount > 0) {
        await costRepo.updateManyEtcDetails(phasingBatchUpdates);
        toast.success(`Phasing calculated for ${updatedCount} rows`);
      } else {
        toast.warning("No valid rows to calculate. Check highlighted rows.");
      }
    } catch (error) {
      console.error("Error calculating phasing:", error);
      toast.error("Failed to calculate phasing");
    }
  };

  const handleImportEtc = (e: React.ChangeEvent<HTMLInputElement>) => {
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

        const allPeriods = project.reportingPeriods?.periods || [];
        const currentPeriodId = project.reportingPeriods?.currentPeriodId;
        const currentIndex = allPeriods.findIndex(p => p.id === currentPeriodId);
        const futurePeriodIds = allPeriods.slice(currentIndex + 1).map(p => p.id);

        const importCreates: any[] = [];

        data.forEach(row => {
          const periodValues: Record<string, number> = {};
          allPeriods.forEach(p => {
            if (row[p.name] !== undefined) {
              periodValues[p.id] = futurePeriodIds.includes(p.id) ? (Number(row[p.name]) || 0) : 0;
            }
          });

          const enterpriseAttributes: Record<string, string> = {};
          enterpriseLineItemAttrs.forEach(attr => {
            if (row[`E_${attr.title}`] !== undefined) enterpriseAttributes[attr.id] = String(row[`E_${attr.title}`]);
          });

          const projectAttributes: Record<string, string> = {};
          projectLineItemAttrs.forEach(attr => {
            if (row[`P_${attr.title}`] !== undefined) projectAttributes[attr.id] = String(row[`P_${attr.title}`]);
          });

          const userDefined: Record<string, any> = {};
          for (let i = 1; i <= 5; i++) {
            if (row[`Numeric ${i}`] !== undefined) userDefined[`num${i}`] = Number(row[`Numeric ${i}`]) || 0;
            if (row[`Text ${i}`] !== undefined) userDefined[`text${i}`] = String(row[`Text ${i}`]);
          }

          importCreates.push({ projectId: project.id, costCode: row['Cost Code ID'] || '', item: row['Item'] || '', description: row['Description'] || '', qty: 0, unit: row['Unit'] || '', rate: Number(row['Rate']) || 0, periodValues, enterpriseAttributes, projectAttributes, userDefined, source: 'MANUAL', isEnterpriseResource: false });
        });

        await costRepo.createManyEtcDetails(importCreates);
        toast.success(`Imported ${data.length} rows successfully`);
      } catch (error) {
        console.error("Error importing ETC details:", error);
        toast.error("Failed to import rows");
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };


  const handleAddResources = async (resources: any[], source: 'enterprise' | 'project' = 'enterprise') => {
    if (resources.length === 0) return;
    try {
      const count = Math.max(1, Math.min(500, addRowsCount));
      let insertSortOrder: number;
      const selectedRows = etcGridRef.current?.api.getSelectedRows() || [];
      if (selectedRows.length > 0) {
        const lastSelected = selectedRows[selectedRows.length - 1];
        insertSortOrder = (lastSelected as any).sortOrder + 1;
        const totalNewRows = count * resources.length;
        const toShift = etcRows.filter(r => (r as any).sortOrder >= insertSortOrder);
        if (toShift.length > 0) {
          await costRepo.updateManyEtcDetails(toShift.map(r => ({ id: r.id, data: { sortOrder: (r as any).sortOrder + totalNewRows } })));
        }
      } else {
        const maxSortOrder = etcRows.length > 0 ? Math.max(...etcRows.map(r => (r as any).sortOrder || 0)) : -1;
        insertSortOrder = maxSortOrder + 1;
      }

      let currentSortOrder = insertSortOrder;
      const resourcesToCreate: any[] = [];
      for (const resource of resources) {
        for (let i = 0; i < count; i++) {
          resourcesToCreate.push({ projectId: project.id, costCode: '', item: resource.id, description: resource.name, qty: 0, unit: resource.unit || 'HR', rate: resource.rate || 0, phasingMethod: 'Manual', phasingStartDate: '', phasingEndDate: '', phasingUnit: '', phasingQty: 0, category: resource.category || '', periodValues: {}, enterpriseAttributes: {}, projectAttributes: {}, userDefined: {}, sortOrder: currentSortOrder++, isEnterpriseResource: source === 'enterprise', source: source.toUpperCase(), resourceId: resource.id });
        }
      }
      await costRepo.createManyEtcDetails(resourcesToCreate);
      setIsResourceModalOpen(false);
      toast.success(`${resources.length * count} row(s) added successfully`);
    } catch (error) {
      console.error("Error adding resources:", error);
      toast.error("Failed to add resources");
    }
  };

  const pinnedBottomRowData = useMemo(() => {
    if (etcRows.length === 0) return [];
    
    const allPeriods = project.reportingPeriods?.periods || [];
    const currentPeriodId = project.reportingPeriods?.currentPeriodId;
    const currentIndex = allPeriods.findIndex(p => p.id === currentPeriodId);
    const periods = allPeriods.slice(currentIndex + 1);

    let totalQty = 0;
    let totalEtc = 0;
    let totalEtcPrevious = 0;
    const periodTotals: Record<string, number> = {};

    etcRows.forEach(row => {
      const rowPeriodValues = row.periodValues || {};
      let rowQty = 0;
      periods.forEach(p => {
        const val = Number(rowPeriodValues[p.id]) || 0;
        rowQty += val;
        periodTotals[p.id] = (periodTotals[p.id] || 0) + val;
      });
      totalQty += rowQty;
      totalEtc += rowQty * (row.rate || 0);
      totalEtcPrevious += row.totalEtcPrevious || 0;
    });

    return [{
      id: 'total-row',
      costCode: 'Total',
      item: '',
      description: '',
      qty: totalQty,
      rate: null,
      totalEtc: totalEtc,
      totalEtcPrevious: totalEtcPrevious,
      etcMvmt: totalEtc - totalEtcPrevious,
      periodValues: periodTotals,
      isPinnedRow: true
    }];
  }, [etcRows, project.reportingPeriods]);

  const etcColumnDefs = useMemo<(ColDef | ColGroupDef)[]>(() => {
    return buildEtcColumnDefs({ project, enterprise, calendars, enterpriseLineItemAttrs, projectLineItemAttrs, costCodes, scheduleItems, theme, handleUpdateEtcRow, handleDeleteEtcRow });
  }, [project.reportingPeriods, enterprise.resourceRates, calendars, enterpriseLineItemAttrs, projectLineItemAttrs, costCodes, scheduleItems, theme, handleUpdateEtcRow, handleDeleteEtcRow]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col p-8 overflow-hidden bg-gray-50/50 dark:bg-transparent h-full">
      <DataGridModule
        title="Bulk ETC Details Management"
        description="Manage project-wide ETC details and phasing"
        icon={<ClipboardList className="w-4 h-4 text-gray-400" />}
        searchPlaceholder="Search items..."
        quickFilterText={etcQuickFilterText}
        onQuickFilterChange={setEtcQuickFilterText}
        onImport={() => etcFileInputRef.current?.click()}
        onExport={handleExportEtc}
        onCalculate={handleCalculatePhasing}
        onBulkUpdate={() => setIsEtcBulkUpdating(true)}
        selectedCount={selectedEtcIds.size}
        project={project}
        extraToolbarActions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => toggleAllEtcColumnGroups(true)}
              className="p-2 h-9 w-9 rounded-xl border-gray-200 dark:border-white/10"
              title="Expand All Groups"
            >
              <Maximize2 className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => toggleAllEtcColumnGroups(false)}
              className="p-2 h-9 w-9 rounded-xl border-gray-200 dark:border-white/10"
              title="Collapse All Groups"
            >
              <Minimize2 className="w-4 h-4" />
            </Button>
            <div className="w-px h-6 bg-gray-200 dark:bg-white/10 mx-1" />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEtcChartVisible(!isEtcChartVisible)}
              className={cn(
                "p-2 h-9 w-9 rounded-xl border-gray-200 dark:border-white/10 transition-all",
                isEtcChartVisible && "bg-black text-white dark:bg-white dark:text-black shadow-lg"
              )}
              title={isEtcChartVisible ? "Hide Chart" : "Show Chart"}
            >
              <BarChart3 className="w-4 h-4" />
            </Button>
            <div className="w-px h-6 bg-gray-200 dark:bg-white/10 mx-1" />
            <div className="flex items-center gap-2 bg-gray-100 dark:bg-white/5 p-1 rounded-xl">
              <input 
                type="number" 
                value={addRowsCount}
                onChange={(e) => setAddRowsCount(parseInt(e.target.value) || 1)}
                className="w-12 px-2 py-1 bg-white dark:bg-[#141414] border border-gray-200 dark:border-white/10 rounded-lg text-[10px] font-bold focus:outline-none focus:ring-2 focus:ring-orange-500"
                min="1"
                max="500"
              />
              <Button 
                size="sm"
                onClick={handleAddEtcRow}
                className="h-7 px-3 bg-black dark:bg-white text-white dark:text-black rounded-lg text-[10px] font-bold hover:opacity-90 transition-all shadow-lg shadow-black/10"
              >
                <Plus className="w-3 h-3 mr-1" /> Add
              </Button>
              <div className="w-px h-4 bg-gray-200 dark:bg-white/10 mx-1" />
              <Button 
                variant="ghost"
                size="sm"
                onClick={() => setIsResourceModalOpen(true)}
                className="p-1 h-7 w-7 text-black dark:text-white hover:bg-gray-200 dark:hover:bg-white/10 rounded-lg transition-colors"
                title="Resource Library"
              >
                <Database className="w-4 h-4" />
              </Button>
            </div>
            {selectedEtcIds.size > 0 && (
              <Button 
                variant="destructive"
                size="sm"
                onClick={() => setDeleteConfirm({ type: 'selected', count: selectedEtcIds.size })}
                className="h-9 px-3 rounded-xl text-[10px] font-bold shadow-lg shadow-red-600/20"
                title={`Delete Selected (${selectedEtcIds.size})`}
              >
                <Trash2 className="w-4 h-4 mr-1" /> ({selectedEtcIds.size})
              </Button>
            )}
          </div>
        }
        topContent={
          <AnimatePresence>
            {isEtcChartVisible && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 300, opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl mb-6 overflow-hidden"
              >
                <div className="h-full p-6">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={etcChartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#334155' : '#e2e8f0'} />
                      <XAxis 
                        dataKey="name" 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: theme === 'dark' ? '#94a3b8' : '#64748b', fontSize: 10 }}
                        dy={10}
                      />
                      <YAxis 
                        yAxisId="left"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: theme === 'dark' ? '#94a3b8' : '#64748b', fontSize: 10 }}
                        tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`}
                      />
                      <YAxis 
                        yAxisId="right" 
                        orientation="right"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: theme === 'dark' ? '#94a3b8' : '#64748b', fontSize: 10 }}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff',
                          borderColor: theme === 'dark' ? '#334155' : '#e2e8f0',
                          borderRadius: '12px',
                          color: theme === 'dark' ? '#f8fafc' : '#0f172a',
                          fontSize: '12px'
                        }}
                        formatter={(value: number) => formatCurrency(value)}
                      />
                      <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ fontSize: '10px' }} />
                      <Bar yAxisId="left" dataKey="cost" name="Period Cost" fill="#3b82f6" radius={[4, 4, 0, 0]} opacity={0.6} />
                      <Line yAxisId="left" type="monotone" dataKey="cumulative" name="Cumulative Cost" stroke="#ef4444" strokeWidth={3} dot={{ r: 4, fill: '#ef4444' }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        }
        gridRef={etcGridRef}
        rowData={etcRows}
        columnDefs={etcColumnDefs}
        pinnedTopRowData={pinnedBottomRowData}
        theme={theme}
        gridProps={{
          getRowId: (params: any) => params.data.id,
          defaultColDef: {
            sortable: true,
            filter: true,
            resizable: true,
            flex: 0,
            minWidth: 100,
          },
          rowSelection: "multiple",
          suppressRowClickSelection: true,
          onSelectionChanged: (params: any) => {
            const selectedRows = params.api.getSelectedRows();
            const displayedSelected = selectedRows.filter((row: any) => {
              const node = params.api.getRowNode(row.id);
              return node && node.displayed;
            });
            setSelectedEtcIds(new Set(displayedSelected.map((r: any) => r.id)));
          },
          onFilterChanged: (params: any) => {
            const selectedRows = params.api.getSelectedRows();
            const displayedSelected = selectedRows.filter((row: any) => {
              const node = params.api.getRowNode(row.id);
              return node && node.displayed;
            });
            setSelectedEtcIds(new Set(displayedSelected.map((r: any) => r.id)));
          },
          onCellValueChanged: (params: any) => {
            handleUpdateEtcRow(params.data.id, params.data);
          },
          quickFilterText: etcQuickFilterText,
          enableRangeSelection: true,
          enableFillHandle: true,
          undoRedoCellEditing: true,
          animateRows: true,
        }}
      />

      <input 
        type="file" 
        ref={etcFileInputRef} 
        className="hidden" 
        accept=".xlsx,.xls,.csv"
        onChange={handleImportEtc}
      />

      {/* Bulk Update Dialog */}
      <EtcBulkUpdateDialog
        isOpen={isEtcBulkUpdating}
        onClose={() => setIsEtcBulkUpdating(false)}
        onSubmit={handleBulkUpdateEtc}
        enterprise={enterprise}
        calendars={calendars}
        selectedCount={selectedEtcIds.size}
        isSaving={isSaving}
      />

      {/* Resource Library Modal */}
      <ResourceLibraryModal
        isOpen={isResourceModalOpen}
        onClose={() => setIsResourceModalOpen(false)}
        onAdd={handleAddResources}
        enterprise={enterprise}
        project={project}
      />

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirm && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[110] p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-[#141414] rounded-3xl p-8 w-full max-w-md shadow-2xl border border-gray-200 dark:border-white/10 animate-in zoom-in-95 duration-200"
            >
              <div className="w-16 h-16 bg-red-50 dark:bg-red-500/10 rounded-full flex items-center justify-center mb-6">
                <Trash2 className="w-8 h-8 text-red-600" />
              </div>
              <h2 className="text-xl font-bold mb-2 dark:text-white">Confirm Delete</h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-8">
                {deleteConfirm.type === 'selected' 
                  ? `Are you sure you want to delete ${deleteConfirm.count} selected row(s)? This action cannot be undone.`
                  : `Are you sure you want to delete all row(s)? This action cannot be undone.`}
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setDeleteConfirm(null)} 
                  className="flex-1 px-6 py-3 bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 rounded-2xl text-sm font-bold hover:bg-gray-200 dark:hover:bg-white/10 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleDeleteEtcRows} 
                  disabled={isSaving}
                  className="flex-1 px-6 py-3 bg-red-600 text-white rounded-2xl text-sm font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-600/20 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSaving && <RefreshCw className="w-4 h-4 animate-spin" />}
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
