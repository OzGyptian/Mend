import React, { useState, useRef, useMemo } from 'react';
import {
  Plus,
  Trash2,
  Edit2,
  RefreshCw,
  Download,
  Upload,
  Maximize2,
  Minimize2,
  BarChart3,
  Search,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import {
  Enterprise,
  Project,
  Subcontract,
  SubcontractLineItem,
  Invoice,
  CostCode,
} from '../../../types';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { cn, formatCurrency, formatDate, dateToISO, calculatePhasing } from '@/lib/utils';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, CellValueChangedEvent } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';
import 'ag-grid-enterprise';
import { buildLineItemColumnDefs } from '../columns';
import { X } from 'lucide-react';
import { useConfirm } from '../../ConfirmDialogProvider';

export interface LineItemsPanelProps {
  selectedSubcontractId: string | null;
  selectedSubcontract: Subcontract | null | undefined;
  invoices: Invoice[];
  costCodes: CostCode[];
  enterprise: Enterprise;
  project: Project;
  theme: 'light' | 'dark';
  subcontractRepo: {
    updateSubcontract: (id: string, data: Partial<Subcontract>) => Promise<void>;
  };
  isBottomPanelCollapsed: boolean;
  /** Called when user clicks "Close" in the bottom-panel toolbar */
  onClose: () => void;
}

export function LineItemsPanel({
  selectedSubcontractId,
  selectedSubcontract,
  invoices,
  costCodes,
  enterprise,
  project,
  theme,
  subcontractRepo,
  isBottomPanelCollapsed,
  onClose,
}: LineItemsPanelProps) {
  const confirmDialog = useConfirm();

  // --- Local state owned by this panel ---
  const [selectedLineItemIds, setSelectedLineItemIds] = useState<Set<string>>(new Set());
  const [lineItemQuickFilterText, setLineItemQuickFilterText] = useState('');
  const [isHistogramVisible, setIsHistogramVisible] = useState(false);
  const [isLineItemBulkUpdating, setIsLineItemBulkUpdating] = useState(false);
  const [lineItemBulkUpdateData, setLineItemBulkUpdateData] = useState<Partial<SubcontractLineItem>>({
    enterpriseAttributes: {},
    projectAttributes: {},
    userDefined: {},
  });

  const lineItemsGridRef = useRef<AgGridReact>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Derived data (depends on parent-supplied invoices) ---
  const lineItemInvoiceAggregates = useMemo(() => {
    const aggregates: Record<string, { claimed: number; certified: number }> = {};

    const sortedInvoices = [...invoices].sort((a, b) => {
      const aNo = parseInt(a.invoiceId?.replace(/\D/g, '') || '0');
      const bNo = parseInt(b.invoiceId?.replace(/\D/g, '') || '0');
      return bNo - aNo;
    });

    const processedLineItems = new Set<string>();

    sortedInvoices.forEach((inv) => {
      (inv.items || []).forEach((item) => {
        const lineId = item.subcontractLineItemId;
        if (processedLineItems.has(lineId)) return;
        aggregates[lineId] = {
          claimed: item.claimValue || 0,
          certified: item.certifiedValue || 0,
        };
        processedLineItems.add(lineId);
      });
    });

    return aggregates;
  }, [invoices]);

  const phasingHistogramData = useMemo(() => {
    if (!selectedSubcontract || !project.reportingPeriods?.periods) return [];

    const periods = project.reportingPeriods.periods;
    const currentPeriodId = project.reportingPeriods.currentPeriodId;
    const currentPeriodIndex = periods.findIndex((p) => p.id === currentPeriodId);

    const lineItems = selectedSubcontract.lineItems || [];

    const initialClaimed = lineItems.reduce((sum, li) => {
      return sum + (lineItemInvoiceAggregates[li.id]?.claimed || 0);
    }, 0);

    let cumulative = initialClaimed;

    const startIndex = Math.max(0, currentPeriodIndex);
    const relevantPeriods = periods.slice(startIndex);

    return relevantPeriods.map((p) => {
      const isPastOrCurrent = periods.indexOf(p) <= currentPeriodIndex;
      const periodValue = isPastOrCurrent
        ? 0
        : lineItems.reduce((sum, li) => {
            return sum + (Number(li.periodValues?.[p.id]) || 0);
          }, 0);

      cumulative += periodValue;

      const date = new Date(p.endDate);
      const month = date.toLocaleString('default', { month: 'short' });
      const year = date.getFullYear().toString().slice(-2);
      const periodNumber = periods.findIndex((per) => per.id === p.id) + 1;

      return {
        name: `P${periodNumber} (${month}'${year})`,
        periodic: Math.round(periodValue * 100) / 100,
        cumulative: Math.round(cumulative * 100) / 100,
      };
    });
  }, [selectedSubcontract, project.reportingPeriods, lineItemInvoiceAggregates]);

  const lineItemColumnDefs = useMemo<any[]>(
    () =>
      buildLineItemColumnDefs({
        selectedSubcontractId,
        selectedSubcontract,
        costCodes,
        enterprise,
        project,
        lineItemInvoiceAggregates,
        subcontractRepo,
        toast,
        confirmDialog,
      }),
    [selectedSubcontractId, selectedSubcontract, costCodes, enterprise, project]
  );

  const lineItemPinnedTopRowData = useMemo(() => {
    if (!selectedSubcontract) return [];

    const periods = project.reportingPeriods?.periods || [];
    const currentPeriodId = project.reportingPeriods?.currentPeriodId;
    const currentPeriodIndex = periods.findIndex((p) => p.id === currentPeriodId);

    const lineItems = selectedSubcontract.lineItems || [];
    const totalContract = lineItems.reduce((sum, li) => sum + (li.total || 0), 0);
    const totalClaimed = lineItems.reduce(
      (sum, li) => sum + (lineItemInvoiceAggregates[li.id]?.claimed || 0),
      0
    );
    const totalCertified = lineItems.reduce(
      (sum, li) => sum + (lineItemInvoiceAggregates[li.id]?.certified || 0),
      0
    );

    return [
      {
        id: 'subtotal',
        description: 'SUB-TOTAL',
        total: totalContract,
        claimedTotal: totalClaimed,
        certifiedTotal: totalCertified,
        totalPhased: lineItems.reduce((sum, li) => {
          return (
            sum +
            periods
              .filter((_, idx) => idx > currentPeriodIndex)
              .reduce((s, p) => s + (Number(li.periodValues?.[p.id]) || 0), 0)
          );
        }, 0),
      },
    ];
  }, [selectedSubcontract, lineItemInvoiceAggregates, project.reportingPeriods]);

  // --- Handlers ---
  const handleAddLineItem = async () => {
    if (!selectedSubcontractId || !selectedSubcontract) return;

    try {
      const currentLineItems = selectedSubcontract?.lineItems || [];

      let nextNum = 1;
      if (currentLineItems.length > 0) {
        const lastItem = currentLineItems[currentLineItems.length - 1];
        const lastNum = parseInt(lastItem.itemNo);
        if (!isNaN(lastNum)) {
          nextNum = lastNum + 1;
        } else {
          nextNum = currentLineItems.length + 1;
        }
      }
      const itemNo = String(nextNum).padStart(3, '0');

      const newLineItem: SubcontractLineItem = {
        id: Math.random().toString(36).substring(2, 9),
        subcontractId: selectedSubcontractId,
        projectId: project.id,
        itemNo,
        description: 'New Line Item',
        qty: 0,
        unit: 'ea',
        rate: 0,
        total: 0,
        type: 'Original',
        status: 'Approved',
        date: new Date().toISOString().split('T')[0],
        phasingSource: selectedSubcontract.defaultPhasingSource || 'Manual',
        startDate: selectedSubcontract.defaultStartDate || '',
        endDate: selectedSubcontract.defaultEndDate || '',
        distribution: selectedSubcontract.defaultDistribution || 'Even',
        enterpriseAttributes: {},
        projectAttributes: {},
        userDefined: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const updatedLineItems = [...currentLineItems, newLineItem];
      const totalAmount = updatedLineItems.reduce((sum, li) => sum + li.total, 0);

      await subcontractRepo.updateSubcontract(selectedSubcontractId, {
        lineItems: updatedLineItems,
        totalAmount,
        updatedAt: new Date().toISOString(),
      });

      toast.success('Line item added.');
    } catch (error) {
      console.error('Error adding line item:', error);
      toast.error('Failed to add line item.');
    }
  };

  const handleLineItemBulkDelete = async () => {
    if (!selectedSubcontractId || !selectedSubcontract || selectedLineItemIds.size === 0) return;
    if (
      !(await confirmDialog(
        `Are you sure you want to delete ${selectedLineItemIds.size} selected line items?`
      ))
    )
      return;

    try {
      const updatedItems = (selectedSubcontract?.lineItems || []).filter(
        (li) => !selectedLineItemIds.has(li.id)
      );
      const newTotal = updatedItems.reduce((sum, li) => sum + (li.total || 0), 0);

      await subcontractRepo.updateSubcontract(selectedSubcontractId, {
        lineItems: updatedItems,
        totalAmount: newTotal,
        updatedAt: new Date().toISOString(),
      });

      setSelectedLineItemIds(new Set());
      toast.success(`Deleted ${selectedLineItemIds.size} line items.`);
    } catch (error) {
      console.error('Error bulk deleting line items:', error);
      toast.error('Failed to delete line items.');
    }
  };

  const handleLineItemBulkUpdate = async () => {
    if (!selectedSubcontractId || !selectedSubcontract || selectedLineItemIds.size === 0) return;

    try {
      const updatedItems = (selectedSubcontract?.lineItems || []).map((li) => {
        if (selectedLineItemIds.has(li.id)) {
          const updatedLi = { ...li };
          if (lineItemBulkUpdateData.costCodeId) updatedLi.costCodeId = lineItemBulkUpdateData.costCodeId;
          if (lineItemBulkUpdateData.date) updatedLi.date = lineItemBulkUpdateData.date;
          if (lineItemBulkUpdateData.startDate) updatedLi.startDate = lineItemBulkUpdateData.startDate;
          if (lineItemBulkUpdateData.endDate) updatedLi.endDate = lineItemBulkUpdateData.endDate;
          if (lineItemBulkUpdateData.phasingSource) updatedLi.phasingSource = lineItemBulkUpdateData.phasingSource;
          if (lineItemBulkUpdateData.distribution) updatedLi.distribution = lineItemBulkUpdateData.distribution;
          if (lineItemBulkUpdateData.type) updatedLi.type = lineItemBulkUpdateData.type;
          if (lineItemBulkUpdateData.status) updatedLi.status = lineItemBulkUpdateData.status;

          if (lineItemBulkUpdateData.enterpriseAttributes) {
            const updatedEntAttrs = { ...updatedLi.enterpriseAttributes };
            Object.entries(lineItemBulkUpdateData.enterpriseAttributes).forEach(([key, val]) => {
              if (val === 'CLEAR') {
                delete updatedEntAttrs[key];
              } else if (val) {
                updatedEntAttrs[key] = val as string;
              }
            });
            updatedLi.enterpriseAttributes = updatedEntAttrs;
          }
          if (lineItemBulkUpdateData.projectAttributes) {
            const updatedProjAttrs = { ...updatedLi.projectAttributes };
            Object.entries(lineItemBulkUpdateData.projectAttributes).forEach(([key, val]) => {
              if (val === 'CLEAR') {
                delete updatedProjAttrs[key];
              } else if (val) {
                updatedProjAttrs[key] = val as string;
              }
            });
            updatedLi.projectAttributes = updatedProjAttrs;
          }
          if (lineItemBulkUpdateData.userDefined) {
            const updatedUserAttrs = { ...updatedLi.userDefined };
            Object.entries(lineItemBulkUpdateData.userDefined).forEach(([key, val]) => {
              if (val === 'CLEAR') {
                delete updatedUserAttrs[key];
              } else if (val) {
                updatedUserAttrs[key] = val as string;
              }
            });
            updatedLi.userDefined = updatedUserAttrs;
          }

          updatedLi.updatedAt = new Date().toISOString();
          return updatedLi;
        }
        return li;
      });

      const newTotal = updatedItems.reduce((sum, li) => sum + (li.total || 0), 0);

      await subcontractRepo.updateSubcontract(selectedSubcontractId, {
        lineItems: updatedItems,
        totalAmount: newTotal,
        updatedAt: new Date().toISOString(),
      });

      setIsLineItemBulkUpdating(false);
      setSelectedLineItemIds(new Set());
      toast.success('Bulk update successful.');
    } catch (error) {
      console.error('Error bulk updating line items:', error);
      toast.error('Failed to update line items.');
    }
  };

  const handleLineItemExport = () => {
    if (!selectedSubcontract) return;
    const exportData = (selectedSubcontract?.lineItems || []).map((li) => ({
      'No.': li.itemNo,
      Description: li.description,
      'Cost Code ID': li.costCodeId || '',
      Date: li.date || '',
      Type: li.type,
      Status: li.status,
      Qty: li.qty,
      Unit: li.unit,
      Rate: li.rate,
      Total: li.total,
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'LineItems');
    XLSX.writeFile(wb, `${selectedSubcontract.orderId}_LineItems.xlsx`);
  };

  const handleLineItemImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedSubcontractId || !selectedSubcontract) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        const currentItems = [...(selectedSubcontract?.lineItems || [])];

        data.forEach((row: any) => {
          const itemNo = row['No.'] || row.itemNo || '';
          const description = row['Description'] || row.description || '';
          if (!description) return;

          const newLineItem: SubcontractLineItem = {
            id: Math.random().toString(36).substring(2, 9),
            subcontractId: selectedSubcontractId,
            projectId: project.id,
            itemNo: String(itemNo),
            description: String(description),
            costCodeId: row['Cost Code ID'] || row.costCodeId || '',
            date: row['Date'] || row.date || dateToISO(new Date()),
            qty: Number(row['Qty'] || row.qty) || 0,
            unit: String(row['Unit'] || row.unit || 'ea'),
            rate: Number(row['Rate'] || row.rate) || 0,
            total: 0,
            type: (row['Type'] || row.type || 'Original') as any,
            status: (row['Status'] || row.status || 'Approved') as any,
            phasingSource: selectedSubcontract.defaultPhasingSource || 'Manual',
            startDate: selectedSubcontract.defaultStartDate || '',
            endDate: selectedSubcontract.defaultEndDate || '',
            distribution: selectedSubcontract.defaultDistribution || 'Even',
            enterpriseAttributes: {},
            projectAttributes: {},
            userDefined: {},
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          newLineItem.total = newLineItem.qty * newLineItem.rate;
          currentItems.push(newLineItem);
        });

        const totals = currentItems.reduce(
          (acc, li) => {
            const isOriginal = li.type === 'Original';
            const isApproved = li.type === 'ChangeOrder' && li.status === 'Approved';
            const isForecast = li.type === 'ChangeOrder' && li.status === 'Forecast';
            if (isOriginal || isApproved || isForecast) {
              acc.total += li.total || 0;
            }
            if (isForecast) {
              acc.forecast += li.total || 0;
            }
            return acc;
          },
          { total: 0, forecast: 0 }
        );

        await subcontractRepo.updateSubcontract(selectedSubcontractId, {
          lineItems: currentItems,
          totalAmount: totals.total,
          forecastChanges: totals.forecast,
          updatedAt: new Date().toISOString(),
        });
        toast.success('Import successful.');
      } catch (error) {
        console.error('Error importing line items:', error);
        toast.error('Failed to import line items.');
      }
    };
    reader.readAsBinaryString(file);
  };

  const onLineItemCellValueChanged = async (event: CellValueChangedEvent) => {
    const { data, colDef, newValue, oldValue } = event;

    if (newValue === oldValue && oldValue !== undefined) return;
    if (!colDef.field || !selectedSubcontractId || !selectedSubcontract) return;

    try {
      const field = colDef.field;
      const updatedItems = (selectedSubcontract?.lineItems || []).map((li) => {
        if (li.id === data.id) {
          const updatedLi = { ...li, updatedAt: new Date().toISOString() };

          if (field.includes('.')) {
            const parts = field.split('.');
            let current: any = updatedLi;

            for (let i = 0; i < parts.length - 1; i++) {
              const part = parts[i];
              current[part] = current[part] ? { ...current[part] } : {};
              current = current[part];
            }

            current[parts[parts.length - 1]] =
              newValue instanceof Date ? dateToISO(newValue) : newValue;
          } else {
            (updatedLi as any)[field] =
              newValue instanceof Date ? dateToISO(newValue) : newValue;
          }

          // Recalculate total when qty or rate changes
          if (field === 'qty' || field === 'rate') {
            updatedLi.total = (updatedLi.qty || 0) * (updatedLi.rate || 0);
          }

          return updatedLi;
        }
        return li;
      });

      const totalAmount = updatedItems.reduce((sum, li) => sum + (li.total || 0), 0);

      await subcontractRepo.updateSubcontract(selectedSubcontractId, {
        lineItems: updatedItems,
        totalAmount,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error updating line item:', error);
      toast.error('Failed to update line item.');
    }
  };

  const handleCalculateLineItemAutoPhasing = async () => {
    if (!selectedSubcontractId || !selectedSubcontract) return;

    const selectedNodes = lineItemsGridRef.current?.api.getSelectedNodes();
    const selectedRows = selectedNodes?.map((node) => node.data) || [];

    let itemsToProcess: SubcontractLineItem[] = [];
    if (selectedRows.length > 0) {
      itemsToProcess = selectedRows.filter((r) => r.phasingSource === 'Auto');
      if (itemsToProcess.length === 0) {
        toast.info("Selected items are not set to 'Auto' phasing source.");
        return;
      }
    } else {
      itemsToProcess = (selectedSubcontract.lineItems || []).filter(
        (r) => r.phasingSource === 'Auto'
      );
      if (itemsToProcess.length === 0) {
        toast.info("No line items set to 'Auto' phasing source.");
        return;
      }
    }

    try {
      const periods = project.reportingPeriods?.periods || [];
      const currentPeriodId = project.reportingPeriods?.currentPeriodId;
      const currentPeriod = periods.find((p) => p.id === currentPeriodId);
      const currentPeriodEnd = currentPeriod ? new Date(currentPeriod.endDate) : null;
      const currentIndex = periods.findIndex((p) => p.id === currentPeriodId);
      const nextPeriodStart =
        currentIndex !== -1 && currentIndex < periods.length - 1
          ? periods[currentIndex + 1].startDate
          : null;

      const updatedLineItems = (selectedSubcontract.lineItems || []).map((li) => {
        const targetItem = itemsToProcess.find((item) => item.id === li.id);
        if (targetItem && li.startDate && li.endDate && li.distribution) {
          const total = (li.qty || 0) * (li.rate || 0);
          const claimedValue = lineItemInvoiceAggregates[li.id]?.claimed || 0;
          const remainingToClaim = Math.max(0, total - claimedValue);

          let effectiveStartDate = li.startDate;
          if (currentPeriodEnd && nextPeriodStart) {
            const userStart = new Date(li.startDate);
            if (userStart <= currentPeriodEnd) {
              effectiveStartDate = nextPeriodStart;
            }
          }

          const newPhasing = calculatePhasing(
            remainingToClaim,
            effectiveStartDate,
            li.endDate,
            li.distribution,
            periods,
            li.periodValues
          );

          return {
            ...li,
            periodValues: newPhasing,
            updatedAt: new Date().toISOString(),
          };
        }
        return li;
      });

      await subcontractRepo.updateSubcontract(selectedSubcontractId, {
        lineItems: updatedLineItems,
        updatedAt: new Date().toISOString(),
      });

      toast.success(`Recalculated phasing for ${itemsToProcess.length} line item(s).`);
    } catch (error) {
      console.error('Error calculating auto phasing:', error);
      toast.error('Failed to calculate auto phasing.');
    }
  };

  const toggleAllLineItemColumnGroups = (opened: boolean) => {
    if (!lineItemsGridRef.current) return;
    const api = lineItemsGridRef.current.api;
    const groups = api.getColumnGroupState();
    const newState = groups.map((g) => ({
      groupId: g.groupId,
      open: opened,
    }));
    api.setColumnGroupState(newState);
  };

  // --- Render ---
  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 dark:border-white/10 bg-white dark:bg-[#141414] shrink-0">
        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 left-2.5 absolute top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Filter..."
              value={lineItemQuickFilterText}
              onChange={(e) => setLineItemQuickFilterText(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg outline-none focus:ring-1 focus:ring-blue-500 h-6 dark:text-white w-36"
            />
          </div>

          <div className="w-px h-6 bg-gray-200 dark:bg-white/10 mx-1" />

          {/* Histogram toggle */}
          <button
            onClick={() => setIsHistogramVisible(!isHistogramVisible)}
            className={cn(
              'p-1.5 rounded-lg transition-colors text-gray-400 hover:text-gray-600 dark:hover:text-gray-300',
              isHistogramVisible && 'bg-purple-100 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400'
            )}
            title="Toggle Histogram"
          >
            <BarChart3 className="w-5 h-5" />
          </button>

          {/* Column group toggles */}
          <>
            <button
              onClick={() => toggleAllLineItemColumnGroups(true)}
              className="p-1 rounded-md text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
              title="Expand All Groups"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => toggleAllLineItemColumnGroups(false)}
              className="p-1 rounded-md text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
              title="Collapse All Groups"
            >
              <Minimize2 className="w-4 h-4" />
            </button>
            <div className="w-px h-6 bg-gray-200 dark:bg-white/10 mx-1" />
          </>

          {/* Bulk actions (only when rows selected) */}
          {selectedLineItemIds.size > 0 && (
            <>
              <button
                onClick={() => setIsLineItemBulkUpdating(true)}
                className="flex items-center gap-2 bg-black dark:bg-white text-white dark:text-black px-3 py-1.5 rounded-lg text-xs font-bold hover:opacity-90 transition-all shadow-lg shadow-black/10"
                title={`Bulk Update (${selectedLineItemIds.size})`}
              >
                <Edit2 className="w-4 h-4" /> ({selectedLineItemIds.size})
              </button>
              <button
                onClick={handleLineItemBulkDelete}
                className="flex items-center gap-2 bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-600/10"
                title={`Bulk Delete (${selectedLineItemIds.size})`}
              >
                <Trash2 className="w-4 h-4" /> ({selectedLineItemIds.size})
              </button>
              <div className="w-px h-6 bg-gray-200 dark:bg-white/10 mx-1" />
            </>
          )}

          {/* Calculate Phasing */}
          <Button
            size="sm"
            onClick={handleCalculateLineItemAutoPhasing}
            className="h-8 text-[10px] font-bold uppercase tracking-widest gap-2 bg-black dark:bg-white text-white dark:text-black border-none hover:opacity-90 transition-opacity"
          >
            <RefreshCw className="w-3 h-3" />
            Calculate Phasing
          </Button>

          {/* Add Item */}
          <Button
            size="sm"
            onClick={handleAddLineItem}
            className="h-8 text-xs bg-black dark:bg-white text-white dark:text-black"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Item
          </Button>

          {/* Export / Import */}
          <button
            onClick={handleLineItemExport}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
            title="Export Line Items"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
            title="Import Line Items"
          >
            <Upload className="w-4 h-4" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={handleLineItemImport}
          />
        </div>

        {/* Close */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="h-8 text-xs"
        >
          Close
        </Button>
      </div>

      {/* Histogram */}
      <AnimatePresence>
        {isHistogramVisible && !isBottomPanelCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-white dark:bg-[#141414] border-b border-gray-200 dark:border-white/10 px-6 py-6 overflow-hidden"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                    Remaining to Claim Projection
                  </span>
                  <h4 className="text-sm font-bold dark:text-white">Monthly Phasing Histogram</h4>
                </div>
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-purple-500/80 shadow-sm shadow-purple-500/20" />
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                      Periodic Value
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-0.5 bg-orange-500 rounded-full" />
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                      Cumulative Value
                    </span>
                  </div>
                </div>
              </div>

              <div className="h-72 w-full bg-gray-50/50 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/10 p-6">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={phasingHistogramData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke={theme === 'dark' ? '#333' : '#eee'}
                    />
                    <XAxis
                      dataKey="name"
                      fontSize={10}
                      tick={{ fill: theme === 'dark' ? '#999' : '#666' }}
                      axisLine={false}
                      tickLine={false}
                      dy={10}
                    />
                    <YAxis
                      yAxisId="left"
                      fontSize={10}
                      tick={{ fill: theme === 'dark' ? '#999' : '#666' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      fontSize={10}
                      tick={{ fill: theme === 'dark' ? '#999' : '#666' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: theme === 'dark' ? '#1a1a1a' : '#fff',
                        border: 'none',
                        borderRadius: '12px',
                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                        fontSize: '12px',
                      }}
                      formatter={(val: number) => formatCurrency(val)}
                    />
                    <Bar
                      yAxisId="left"
                      dataKey="periodic"
                      fill="#a855f7"
                      opacity={0.8}
                      radius={[4, 4, 0, 0]}
                      barSize={40}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="cumulative"
                      stroke="#f97316"
                      strokeWidth={3}
                      dot={{ r: 4, fill: '#f97316', strokeWidth: 2, stroke: '#fff' }}
                      activeDot={{ r: 6, strokeWidth: 0 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Grid */}
      <div className={cn('flex-1 min-h-0 relative', isBottomPanelCollapsed && 'hidden')}>
        <div
          className={cn(
            'absolute inset-0 ag-theme-quartz',
            theme === 'dark' ? 'ag-theme-quartz-dark' : ''
          )}
        >
          <AgGridReact
            theme="legacy"
            key="lineItemsGrid"
            ref={lineItemsGridRef}
            rowData={selectedSubcontract?.lineItems || []}
            columnDefs={lineItemColumnDefs}
            pinnedTopRowData={lineItemPinnedTopRowData}
            getRowClass={(params) => {
              if (params.node.rowPinned) return 'pinned-row-highlight';
              return '';
            }}
            quickFilterText={lineItemQuickFilterText}
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
            rowSelection="multiple"
            suppressRowClickSelection={true}
            onSelectionChanged={(event) => {
              const selectedRows = event.api.getSelectedRows();
              setSelectedLineItemIds(
                new Set(selectedRows.map((row) => row?.id).filter((id) => !!id))
              );
            }}
            onCellValueChanged={onLineItemCellValueChanged}
            animateRows={true}
            enableFillHandle={true}
            enableRangeSelection={true}
            getRowId={(params) => params.data.id}
            sideBar={{
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
            }}
          />
        </div>
      </div>

      {/* Bulk Update Modal */}
      {isLineItemBulkUpdating && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl w-full max-w-3xl p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold dark:text-white">
                Bulk Update Line Items ({selectedLineItemIds.size})
              </h2>
              <button
                onClick={() => setIsLineItemBulkUpdating(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="space-y-8 max-h-[60vh] overflow-y-auto pr-2">
              {/* Core Details */}
              <section className="space-y-4">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest border-b border-gray-100 dark:border-white/10 pb-2">
                  Core Details
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                      Cost Code ID
                    </label>
                    <select
                      value={lineItemBulkUpdateData.costCodeId || ''}
                      onChange={(e) =>
                        setLineItemBulkUpdateData({ ...lineItemBulkUpdateData, costCodeId: e.target.value })
                      }
                      className="w-full px-4 py-2 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-xl text-sm outline-none dark:text-white"
                    >
                      <option value="">No Change</option>
                      {costCodes.map((c) => (
                        <option key={c.id} value={c.code}>
                          {c.code} - {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Date</label>
                    <Input
                      type="date"
                      value={lineItemBulkUpdateData.date || ''}
                      onChange={(e) =>
                        setLineItemBulkUpdateData({ ...lineItemBulkUpdateData, date: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Type</label>
                    <select
                      value={lineItemBulkUpdateData.type || ''}
                      onChange={(e) =>
                        setLineItemBulkUpdateData({ ...lineItemBulkUpdateData, type: e.target.value as any })
                      }
                      className="w-full px-4 py-2 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-xl text-sm outline-none dark:text-white"
                    >
                      <option value="">No Change</option>
                      <option value="Original">Original</option>
                      <option value="ChangeOrder">ChangeOrder</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Status</label>
                    <select
                      value={lineItemBulkUpdateData.status || ''}
                      onChange={(e) =>
                        setLineItemBulkUpdateData({ ...lineItemBulkUpdateData, status: e.target.value as any })
                      }
                      className="w-full px-4 py-2 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-xl text-sm outline-none dark:text-white"
                    >
                      <option value="">No Change</option>
                      <option value="Approved">Approved</option>
                      <option value="Pending">Pending</option>
                      <option value="Forecast">Forecast</option>
                      <option value="Rejected">Rejected</option>
                    </select>
                  </div>
                </div>
              </section>

              {/* Timephasing */}
              <section className="space-y-4">
                <h3 className="text-xs font-bold text-blue-500 uppercase tracking-widest border-b border-blue-100 dark:border-blue-500/10 pb-2">
                  Timephasing
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                      Phasing Source
                    </label>
                    <select
                      value={lineItemBulkUpdateData.phasingSource || ''}
                      onChange={(e) =>
                        setLineItemBulkUpdateData({ ...lineItemBulkUpdateData, phasingSource: e.target.value as any })
                      }
                      className="w-full px-4 py-2 bg-white dark:bg-[#1a1a1a] border border-blue-200 dark:border-blue-500/10 rounded-xl text-sm outline-none dark:text-white"
                    >
                      <option value="">No Change</option>
                      <option value="Auto">Auto</option>
                      <option value="Manual">Manual</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                      Distribution
                    </label>
                    <select
                      value={lineItemBulkUpdateData.distribution || ''}
                      onChange={(e) =>
                        setLineItemBulkUpdateData({ ...lineItemBulkUpdateData, distribution: e.target.value as any })
                      }
                      className="w-full px-4 py-2 bg-white dark:bg-[#1a1a1a] border border-blue-200 dark:border-blue-500/10 rounded-xl text-sm outline-none dark:text-white"
                    >
                      <option value="">No Change</option>
                      <option value="Even">Even</option>
                      <option value="Bell Curve">Bell Curve</option>
                      <option value="Front load">Front load</option>
                      <option value="Back load">Back load</option>
                      <option value="S-Curve">S-Curve</option>
                      <option value="Profile">Profile</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Start Date</label>
                    <Input
                      type="date"
                      value={lineItemBulkUpdateData.startDate || ''}
                      onChange={(e) =>
                        setLineItemBulkUpdateData({ ...lineItemBulkUpdateData, startDate: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">End Date</label>
                    <Input
                      type="date"
                      value={lineItemBulkUpdateData.endDate || ''}
                      onChange={(e) =>
                        setLineItemBulkUpdateData({ ...lineItemBulkUpdateData, endDate: e.target.value })
                      }
                    />
                  </div>
                </div>
              </section>

              {/* Enterprise Attributes */}
              {enterprise.lineItemAttributes?.some(
                (attr) => attr.title && attr.title.trim() !== ''
              ) && (
                <section className="space-y-4">
                  <h3 className="text-xs font-bold text-green-600 uppercase tracking-widest border-b border-green-100 dark:border-green-500/10 pb-2">
                    Enterprise Attributes
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    {enterprise.lineItemAttributes
                      ?.filter((attr) => attr.title && attr.title.trim() !== '')
                      .map((attr) => (
                        <div key={attr.id} className="space-y-2">
                          <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                            {attr.title}
                          </label>
                          <select
                            value={lineItemBulkUpdateData.enterpriseAttributes?.[attr.id] || ''}
                            onChange={(e) =>
                              setLineItemBulkUpdateData({
                                ...lineItemBulkUpdateData,
                                enterpriseAttributes: {
                                  ...lineItemBulkUpdateData.enterpriseAttributes,
                                  [attr.id]: e.target.value,
                                },
                              })
                            }
                            className="w-full px-4 py-2 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-xl text-sm outline-none dark:text-white"
                          >
                            <option value="">No Change</option>
                            <option value="CLEAR">CLEAR FIELD</option>
                            {attr.values.map((v) => (
                              <option key={v.id} value={v.id}>
                                {v.id} - {v.description}
                              </option>
                            ))}
                          </select>
                        </div>
                      ))}
                  </div>
                </section>
              )}

              {/* Project Attributes */}
              {project.lineItemAttributes?.some(
                (attr) => attr.title && attr.title.trim() !== ''
              ) && (
                <section className="space-y-4">
                  <h3 className="text-xs font-bold text-blue-400 uppercase tracking-widest border-b border-blue-100 dark:border-blue-500/10 pb-2">
                    Project Attributes
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    {project.lineItemAttributes
                      ?.filter((attr) => attr.title && attr.title.trim() !== '')
                      .map((attr) => (
                        <div key={attr.id} className="space-y-2">
                          <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                            {attr.title}
                          </label>
                          <select
                            value={lineItemBulkUpdateData.projectAttributes?.[attr.id] || ''}
                            onChange={(e) =>
                              setLineItemBulkUpdateData({
                                ...lineItemBulkUpdateData,
                                projectAttributes: {
                                  ...lineItemBulkUpdateData.projectAttributes,
                                  [attr.id]: e.target.value,
                                },
                              })
                            }
                            className="w-full px-4 py-2 bg-white dark:bg-[#1a1a1a] border border-blue-100 dark:border-blue-500/10 rounded-xl text-sm outline-none dark:text-white"
                          >
                            <option value="">No Change</option>
                            <option value="CLEAR">CLEAR FIELD</option>
                            {attr.values.map((v) => (
                              <option key={v.id} value={v.id}>
                                {v.id} - {v.description}
                              </option>
                            ))}
                          </select>
                        </div>
                      ))}
                  </div>
                </section>
              )}

              {/* User Defined */}
              <section className="space-y-4">
                <h3 className="text-xs font-bold text-orange-500 uppercase tracking-widest border-b border-orange-100 dark:border-orange-500/10 pb-2">
                  User Defined Fields
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={`num${i}`} className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                        {`Numeric ${i + 1}`}
                      </label>
                      <Input
                        type="number"
                        placeholder="No Change"
                        value={
                          lineItemBulkUpdateData.userDefined?.[`num${i + 1}`] === undefined
                            ? ''
                            : lineItemBulkUpdateData.userDefined[`num${i + 1}`]
                        }
                        onChange={(e) =>
                          setLineItemBulkUpdateData({
                            ...lineItemBulkUpdateData,
                            userDefined: {
                              ...lineItemBulkUpdateData.userDefined,
                              [`num${i + 1}`]:
                                e.target.value === '' ? undefined : Number(e.target.value),
                            },
                          })
                        }
                      />
                    </div>
                  ))}
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={`text${i}`} className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                        {`Text ${i + 1}`}
                      </label>
                      <Input
                        type="text"
                        placeholder="No Change"
                        value={lineItemBulkUpdateData.userDefined?.[`text${i + 1}`] || ''}
                        onChange={(e) =>
                          setLineItemBulkUpdateData({
                            ...lineItemBulkUpdateData,
                            userDefined: {
                              ...lineItemBulkUpdateData.userDefined,
                              [`text${i + 1}`]: e.target.value,
                            },
                          })
                        }
                      />
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <div className="flex justify-end gap-3 pt-6 border-t border-gray-100 dark:border-white/10 mt-6">
              <Button variant="ghost" onClick={() => setIsLineItemBulkUpdating(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleLineItemBulkUpdate}
                className="bg-black dark:bg-white text-white dark:text-black"
              >
                Update {selectedLineItemIds.size} Items
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </>
  );
}
