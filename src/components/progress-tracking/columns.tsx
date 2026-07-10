import React from 'react';
import {
  ColDef,
  ColGroupDef,
  ICellRendererParams,
  ValueFormatterParams,
} from 'ag-grid-community';
import { Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  CostCode,
  Enterprise,
  ProgressItem,
  ProgressPackage,
  Project,
  RuleOfCredit,
  ScheduleItem,
} from '../../types';
import {
  rocPercentComplete,
  earnedQty,
  overallPercentComplete,
} from '../../domain/progress';

// ─── Package Column Defs ───────────────────────────────────────────────────────

export interface PackageColumnDeps {
  items: ProgressItem[];
  rulesOfCredit: RuleOfCredit[];
  project: Project;
  setSelectedPackageId: (id: string | null) => void;
  updatePackage: (pkgId: string, updates: any) => Promise<void>;
  deletePackage: (pkg: ProgressPackage) => Promise<void>;
}

export function buildPackageColumnDefs(
  deps: PackageColumnDeps,
): (ColDef | ColGroupDef)[] {
  const { items, rulesOfCredit, project, setSelectedPackageId, updatePackage, deletePackage } = deps;

  const baseCols: ColDef[] = [
    {
      field: 'packageId',
      headerName: 'Commodity ID',
      pinned: 'left',
      width: 150,
      checkboxSelection: true,
      headerCheckboxSelection: true,
      cellRenderer: (params: ICellRendererParams) => (
        <span
          onClick={() => setSelectedPackageId(params.data.id)}
          className="font-mono font-bold text-blue-600 dark:text-blue-400 cursor-pointer hover:underline"
        >
          {params.value}
        </span>
      ),
    },
    {
      field: 'description',
      headerName: 'Commodity Description',
      flex: 1,
      minWidth: 200,
      editable: true,
      onCellValueChanged: (params) =>
        updatePackage(params.data.id, { description: params.newValue }),
    },
    {
      field: 'unit',
      headerName: 'Unit',
      width: 100,
      editable: true,
      onCellValueChanged: (params) =>
        updatePackage(params.data.id, { unit: params.newValue }),
    },
  ];

  const summaryCols: ColDef[] = [
    {
      headerName: 'Total Qty',
      width: 120,
      type: 'numericColumn',
      valueGetter: (params) => {
        if (params.data?._isTotal) return params.data.totalQty;
        const pkgItems = items.filter((i) => i.packageDocId === params.data.id);
        return pkgItems.reduce((sum, i) => sum + (i.totalQty || 0), 0);
      },
      valueFormatter: (params) => params.value.toLocaleString(),
    },
    {
      headerName: 'Total Qty Prev',
      width: 130,
      type: 'numericColumn',
      valueGetter: (params) => {
        if (params.data?._isTotal) return params.data.totalQtyPrev;
        const pkgItems = items.filter((i) => i.packageDocId === params.data.id);
        return pkgItems.reduce((sum, i) => sum + (i.totalQtyPrevious || 0), 0);
      },
      valueFormatter: (params) => params.value.toLocaleString(),
    },
    {
      headerName: 'Qty Movement',
      width: 130,
      type: 'numericColumn',
      valueGetter: (params) => {
        if (params.data?._isTotal)
          return (params.data.totalQty || 0) - (params.data.totalQtyPrev || 0);
        const pkgItems = items.filter((i) => i.packageDocId === params.data.id);
        const curr = pkgItems.reduce((sum, i) => sum + (i.totalQty || 0), 0);
        const prev = pkgItems.reduce((sum, i) => sum + (i.totalQtyPrevious || 0), 0);
        return curr - prev;
      },
      valueFormatter: (params) => params.value.toLocaleString(),
      cellClass: (params) =>
        params.value > 0 ? 'text-blue-600' : params.value < 0 ? 'text-red-600' : '',
    },
    {
      headerName: 'Earned Qty',
      width: 120,
      type: 'numericColumn',
      valueGetter: (params) => {
        if (params.data?._isTotal) return params.data.totalEarned;
        const pkgItems = items.filter((i) => i.packageDocId === params.data.id);
        const roc = (rulesOfCredit || []).find(
          (r) =>
            r.id === params.data.ruleOfCreditId ||
            r.ruleId === params.data.ruleOfCreditId,
        );
        if (!roc?.steps) return 0;
        return pkgItems.reduce((sum, item) => {
          const progress = item.ruleOfCreditProgress || {};
          const percent = rocPercentComplete(roc.steps, progress);
          return sum + earnedQty(percent, item.totalQty || 0);
        }, 0);
      },
      valueFormatter: (params) =>
        params.value.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }),
      cellClass: 'font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50/30',
    },
    {
      headerName: 'Earned Prev',
      width: 120,
      type: 'numericColumn',
      valueGetter: (params) => {
        if (params.data?._isTotal) return params.data.totalEarnedPrev;
        const pkgItems = items.filter((i) => i.packageDocId === params.data.id);
        return pkgItems.reduce((sum, i) => sum + (i.earnedQtyPrevious || 0), 0);
      },
      valueFormatter: (params) => params.value.toLocaleString(),
    },
    {
      headerName: 'Earned This Period',
      width: 150,
      type: 'numericColumn',
      valueGetter: (params) => {
        if (params.data?._isTotal)
          return (params.data.totalEarned || 0) - (params.data.totalEarnedPrev || 0);
        const pkgItems = items.filter((i) => i.packageDocId === params.data.id);
        const roc = (rulesOfCredit || []).find(
          (r) =>
            r.id === params.data.ruleOfCreditId ||
            r.ruleId === params.data.ruleOfCreditId,
        );
        if (!roc?.steps) return 0;
        const earned = pkgItems.reduce((sum, item) => {
          const progress = item.ruleOfCreditProgress || {};
          const percent = rocPercentComplete(roc.steps, progress);
          return sum + earnedQty(percent, item.totalQty || 0);
        }, 0);
        const prev = pkgItems.reduce((sum, i) => sum + (i.earnedQtyPrevious || 0), 0);
        return earned - prev;
      },
      valueFormatter: (params) =>
        params.value.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }),
      cellClass: (params) =>
        params.value > 0
          ? 'text-emerald-600'
          : params.value < 0
          ? 'text-red-600'
          : '',
    },
    {
      headerName: 'Remaining Qty',
      width: 130,
      type: 'numericColumn',
      valueGetter: (params) => {
        if (params.data?._isTotal)
          return (params.data.totalQty || 0) - (params.data.totalEarned || 0);
        const pkgItems = items.filter((i) => i.packageDocId === params.data.id);
        const total = pkgItems.reduce((sum, i) => sum + (i.totalQty || 0), 0);
        const roc = (rulesOfCredit || []).find(
          (r) =>
            r.id === params.data.ruleOfCreditId ||
            r.ruleId === params.data.ruleOfCreditId,
        );
        if (!roc?.steps) return total;
        const earned = pkgItems.reduce((sum, item) => {
          const progress = item.ruleOfCreditProgress || {};
          const percent = rocPercentComplete(roc.steps, progress);
          return sum + earnedQty(percent, item.totalQty || 0);
        }, 0);
        return total - earned;
      },
      valueFormatter: (params) => params.value.toLocaleString(),
    },
    {
      headerName: '% Complete',
      width: 150,
      type: 'numericColumn',
      valueGetter: (params) => {
        let total = 0;
        let earned = 0;
        if (params.data?._isTotal) {
          total = params.data.totalQty || 0;
          earned = params.data.totalEarned || 0;
        } else {
          const pkgItems = items.filter((i) => i.packageDocId === params.data.id);
          total = pkgItems.reduce((sum, i) => sum + (i.totalQty || 0), 0);
          const roc = (rulesOfCredit || []).find(
            (r) =>
              r.id === params.data.ruleOfCreditId ||
              r.ruleId === params.data.ruleOfCreditId,
          );
          if (roc?.steps) {
            earned = pkgItems.reduce((sum, item) => {
              const progress = item.ruleOfCreditProgress || {};
              const percent = rocPercentComplete(roc.steps, progress);
              return sum + earnedQty(percent, item.totalQty || 0);
            }, 0);
          }
        }
        return overallPercentComplete(earned, total);
      },
      cellRenderer: (params: any) => {
        if (params.value === undefined) return null;
        const val = Math.min(100, Math.max(0, params.value));
        return (
          <div className="w-full h-full flex items-center px-2 py-1">
            <div className="w-full bg-gray-100 dark:bg-gray-800 h-6 rounded-full overflow-hidden relative border border-gray-200 dark:border-gray-700 shadow-inner">
              <div
                className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-700 ease-out"
                style={{ width: `${val}%` }}
              />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span
                  className={cn(
                    'text-[11px] font-bold tracking-tighter drop-shadow-sm',
                    val > 55
                      ? 'text-white'
                      : 'text-emerald-950 dark:text-emerald-50',
                  )}
                >
                  {val.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        );
      },
      sortable: true,
      filter: 'agNumberColumnFilter',
    },
  ];

  const ruleOfCreditCol: ColDef = {
    field: 'ruleOfCreditId',
    headerName: 'Rule of Credit',
    width: 180,
    editable: true,
    cellEditor: 'agSelectCellEditor',
    cellEditorParams: {
      values: ['', ...rulesOfCredit.map((r) => r.id)],
      formatValue: (id: string) => {
        const rule = rulesOfCredit.find((r) => r.id === id);
        return rule ? rule.ruleId : id || '--';
      },
    },
    valueFormatter: (params: ValueFormatterParams) => {
      if (!params.value || params.value === '') return '--';
      const rule = (rulesOfCredit || []).find(
        (r) => r.id === params.value || r.ruleId === params.value,
      );
      return rule ? rule.ruleId : params.value;
    },
    onCellValueChanged: (params) =>
      updatePackage(params.data.id, { ruleOfCreditId: params.newValue }),
  };

  // Dynamic Attribute Columns
  const attrCols: ColDef[] = (project.progressAttributes || [])
    .filter((attr) => attr.title && attr.title.trim() !== '')
    .map((attr) => ({
      headerName: attr.title,
      field: `attributes.${attr.id}`,
      width: 150,
      editable: true,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: {
        values: ['', ...(attr.values || []).map((v) => v.id)],
        formatValue: (id: string) => {
          const val = attr.values?.find((v) => v.id === id);
          return val ? `${val.id} - ${val.description}` : id || '--';
        },
      },
      valueFormatter: (params: ValueFormatterParams) => {
        const val = attr.values?.find((v) => v.id === params.value);
        return val ? `${val.id} - ${val.description}` : params.value || '--';
      },
      onCellValueChanged: (params: any) => {
        const currentAttrs = params.data.attributes || {};
        updatePackage(params.data.id, {
          attributes: { ...currentAttrs, [attr.id]: params.newValue },
        });
      },
    }));

  const actionsCol: ColDef = {
    headerName: 'Actions',
    width: 100,
    pinned: 'right',
    cellRenderer: (params: ICellRendererParams) => (
      <div className="flex items-center gap-1 h-full">
        <button
          onClick={(e) => {
            e.stopPropagation();
            deletePackage(params.data);
          }}
          className="p-1.5 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-lg transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    ),
  };

  const summaryGroup: ColGroupDef = {
    headerName: 'Commodity Summary',
    children: summaryCols,
    marryChildren: true,
  };

  const finalCols: (ColDef | ColGroupDef)[] = [
    ...baseCols,
    summaryGroup,
    ruleOfCreditCol,
  ];

  if (attrCols.length > 0) {
    finalCols.push({
      headerName: 'Commodity Attributes',
      children: attrCols.map((col, idx) => ({
        ...col,
        columnGroupShow: idx === 0 ? undefined : 'open',
      })),
      marryChildren: true,
      openByDefault: true,
    } as ColGroupDef);
  }

  finalCols.push(actionsCol);
  return finalCols;
}

// ─── Item Column Defs ──────────────────────────────────────────────────────────

export interface ItemColumnDeps {
  theme: 'light' | 'dark';
  isAdmin: boolean;
  costCodes: CostCode[];
  scheduleItems: ScheduleItem[];
  enterprise: Enterprise;
  project: Project;
  selectedRuleOfCredit: RuleOfCredit | null | undefined;
  updateItem: (itemId: string, updates: Partial<ProgressItem>) => Promise<void>;
  deleteItem: (item: ProgressItem) => Promise<void>;
  formatGridDate: (params: any) => string;
  parseGridDate: (val: any) => string | null;
}

export function buildItemColumnDefs(deps: ItemColumnDeps): (ColDef | ColGroupDef)[] {
  const {
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
  } = deps;

  const rowSpan = (params: any) => (params.data.rowType === 'Planned' ? 2 : 1);
  const hideOnSubRows = {
    'opacity-0 pointer-events-none': (params: any) =>
      params.data.rowType !== 'Planned',
  };

  const bg = theme === 'dark' ? '#182126' : '#ffffff';
  const blueBg = theme === 'dark' ? '#1e293b' : '#eff6ff';
  const greenBg = theme === 'dark' ? '#065f46' : '#f0fdf4';
  const borderColor = theme === 'dark' ? '#334155' : '#e2e8f0';

  const leftAlignedStyle = (_params: any) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingLeft: '12px',
    backgroundColor: bg,
    borderBottom: `1px solid ${borderColor}`,
  });

  const centeredStyle = { display: 'flex', alignItems: 'center', justifyContent: 'center' };
  const spannedCellStyle = (_params: any) => ({
    ...centeredStyle,
    backgroundColor: bg,
    borderBottom: `1px solid ${borderColor}`,
  });
  const standardCellStyle = (_params: any) => ({
    borderBottom: `1px solid ${borderColor}`,
  });

  const baseCols: ColDef[] = [
    {
      field: 'itemId',
      headerName: 'Item ID',
      width: 120,
      pinned: 'left',
      editable: true,
      checkboxSelection: true,
      headerCheckboxSelection: true,
      onCellValueChanged: (params) =>
        updateItem(params.data.id, { itemId: params.newValue }),
      rowSpan,
      cellClassRules: hideOnSubRows,
      cellStyle: spannedCellStyle,
    },
    {
      field: 'activityId',
      headerName: 'Activity ID',
      width: 130,
      pinned: 'left',
      editable: true,
      rowSpan,
      cellClassRules: hideOnSubRows,
      cellStyle: spannedCellStyle,
      cellEditor: 'agRichSelectCellEditor',
      cellEditorParams: {
        values: scheduleItems.map((item) => item.activityId).sort(),
        formatValue: (val: string) => {
          const item = scheduleItems.find((i) => i.activityId === val);
          return item ? `${item.activityId} - ${item.description}` : val;
        },
        searchType: 'match',
        allowTyping: true,
        filterList: true,
        highlightMatch: true,
      },
      onCellValueChanged: (params) => {
        const newActivityId = params.newValue;
        const updates: any = { activityId: newActivityId };
        if (newActivityId) {
          const scheduleItem = scheduleItems.find(
            (s) => s.activityId === newActivityId,
          );
          if (scheduleItem) {
            updates.plannedStartDate = scheduleItem.plannedStartDate;
            updates.plannedEndDate = scheduleItem.plannedEndDate;
            updates.currentStartDate = scheduleItem.currentStartDate;
            updates.currentEndDate = scheduleItem.currentEndDate;
          }
        }
        updateItem(params.data.id, updates);
      },
    },
    {
      field: 'description',
      headerName: 'Item Description',
      width: 250,
      pinned: 'left',
      editable: true,
      onCellValueChanged: (params) =>
        updateItem(params.data.id, { description: params.newValue }),
      rowSpan,
      cellClassRules: hideOnSubRows,
      cellStyle: leftAlignedStyle,
    },
    {
      field: 'costCodeId',
      headerName: 'Cost Code',
      width: 180,
      editable: true,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: {
        values: costCodes.map((c) => c.id),
        formatValue: (id: string) => {
          const cc = costCodes.find((c) => c.id === id);
          return cc ? `${cc.code} - ${cc.name}` : id;
        },
      },
      rowSpan,
      cellClassRules: hideOnSubRows,
      cellStyle: spannedCellStyle,
      valueFormatter: (params: ValueFormatterParams) => {
        const cc = costCodes.find((c) => c.id === params.value);
        return cc ? `${cc.code} - ${cc.name}` : params.value;
      },
      onCellValueChanged: (params) =>
        updateItem(params.data.id, { costCodeId: params.newValue }),
    },
  ];

  // Enterprise Line Item Attributes
  const enterpriseItemAttrCols: ColDef[] = (enterprise.lineItemAttributes || [])
    .filter((attr) => attr.title && attr.title.trim() !== '')
    .map((attr) => ({
      headerName: attr.title,
      field: `enterpriseAttributes.${attr.id}`,
      width: 150,
      editable: true,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: {
        values: ['', ...(attr.values || []).map((v) => v.id)],
        formatValue: (id: string) => {
          const val = attr.values?.find((v) => v.id === id);
          return val ? `${val.id} - ${val.description}` : id || '--';
        },
      },
      valueFormatter: (params: ValueFormatterParams) => {
        const val = attr.values?.find((v) => v.id === params.value);
        return val ? `${val.id} - ${val.description}` : params.value || '--';
      },
      onCellValueChanged: (params: any) => {
        const currentAttrs = params.data.enterpriseAttributes || {};
        updateItem(params.data.id, {
          enterpriseAttributes: { ...currentAttrs, [attr.id]: params.newValue },
        });
      },
      rowSpan,
      cellClassRules: hideOnSubRows,
      cellStyle: spannedCellStyle,
    }));

  // Project Line Item Attributes
  const projectItemAttrCols: ColDef[] = (project.lineItemAttributes || [])
    .filter((attr) => attr.title && attr.title.trim() !== '')
    .map((attr) => ({
      headerName: attr.title,
      field: `projectAttributes.${attr.id}`,
      width: 150,
      editable: true,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: {
        values: ['', ...(attr.values || []).map((v) => v.id)],
        formatValue: (id: string) => {
          const val = attr.values?.find((v) => v.id === id);
          return val ? `${val.id} - ${val.description}` : id || '--';
        },
      },
      valueFormatter: (params: ValueFormatterParams) => {
        const val = attr.values?.find((v) => v.id === params.value);
        return val ? `${val.id} - ${val.description}` : params.value || '--';
      },
      onCellValueChanged: (params: any) => {
        const currentAttrs = params.data.projectAttributes || {};
        updateItem(params.data.id, {
          projectAttributes: { ...currentAttrs, [attr.id]: params.newValue },
        });
      },
      rowSpan,
      cellClassRules: hideOnSubRows,
      cellStyle: spannedCellStyle,
    }));

  // Rule of Credit Progress Steps
  const rocStepCols: ColDef[] = (selectedRuleOfCredit?.steps || [])
    .sort((a, b) => a.orderNo - b.orderNo)
    .map((step) => ({
      headerName: `${step.description} (${step.weight}%)`,
      field: `ruleOfCreditProgress.${step.id}`,
      width: 150,
      type: 'numericColumn',
      editable: true,
      rowSpan,
      cellClassRules: hideOnSubRows,
      cellStyle: spannedCellStyle,
      valueFormatter: (params: any) =>
        params.value != null ? `${params.value}%` : '0%',
      onCellValueChanged: (params: any) => {
        const currentProgress = params.data.ruleOfCreditProgress || {};
        updateItem(params.data.id, {
          ruleOfCreditProgress: {
            ...currentProgress,
            [step.id]: parseFloat(params.newValue) || 0,
          },
        });
      },
    }));

  // Physical Progress Calculation
  const percentCompleteCol: ColDef = {
    headerName: '% Complete',
    width: 120,
    type: 'numericColumn',
    rowSpan,
    valueGetter: (params) => {
      if (params.data._isTotal) {
        return params.data.overallPercent || 0;
      }
      if (!selectedRuleOfCredit || !selectedRuleOfCredit.steps) return 0;
      const progress = params.data.ruleOfCreditProgress || {};
      return rocPercentComplete(selectedRuleOfCredit.steps, progress);
    },
    valueFormatter: (params) => `${params.value.toFixed(2)}%`,
    cellClassRules: hideOnSubRows,
    cellStyle: (_params: any) => ({
      ...centeredStyle,
      fontWeight: 'bold',
      backgroundColor: blueBg,
      color: theme === 'dark' ? '#60a5fa' : '#2563eb',
      borderBottom: `1px solid ${borderColor}`,
    }),
  };

  const earnedQtyCol: ColDef = {
    headerName: 'Earned Qty',
    width: 120,
    type: 'numericColumn',
    rowSpan,
    cellClassRules: hideOnSubRows,
    cellStyle: (_params: any) => ({
      ...centeredStyle,
      fontWeight: 'bold',
      backgroundColor: greenBg,
      color: theme === 'dark' ? '#34d399' : '#059669',
      borderBottom: `1px solid ${borderColor}`,
    }),
    valueGetter: (params) => {
      if (params.data._isTotal) {
        return params.data.totalEarnedQty || 0;
      }
      if (!selectedRuleOfCredit || !selectedRuleOfCredit.steps) return 0;
      const progress = params.data.ruleOfCreditProgress || {};
      const percent = rocPercentComplete(selectedRuleOfCredit.steps, progress);
      return earnedQty(percent, params.data.totalQty || 0);
    },
    valueFormatter: (params) =>
      params.value.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
  };

  // Quantity Tracking
  const qtyTrackingCols: ColDef[] = [
    {
      field: 'totalQty',
      headerName: 'Total Qty',
      width: 110,
      type: 'numericColumn',
      editable: true,
      rowSpan,
      cellClassRules: hideOnSubRows,
      cellStyle: spannedCellStyle,
      onCellValueChanged: (params) =>
        updateItem(params.data.id, { totalQty: parseFloat(params.newValue) || 0 }),
    },
    {
      field: 'totalQtyPrevious',
      headerName: 'Total Qty Prev',
      width: 130,
      type: 'numericColumn',
      editable: false,
      rowSpan,
      cellClassRules: hideOnSubRows,
      cellStyle: spannedCellStyle,
      valueFormatter: (params) => params.value?.toLocaleString() || '0',
    },
    {
      headerName: 'Qty Movement',
      width: 130,
      type: 'numericColumn',
      rowSpan,
      cellClassRules: hideOnSubRows,
      cellStyle: (params: any) => ({
        ...centeredStyle,
        color:
          params.value > 0
            ? '#2563eb'
            : params.value < 0
            ? '#dc2626'
            : undefined,
        backgroundColor: bg,
        borderBottom: `1px solid ${borderColor}`,
      }),
      valueGetter: (params) =>
        (params.data.totalQty || 0) - (params.data.totalQtyPrevious || 0),
      valueFormatter: (params) => params.value.toLocaleString(),
    },
    earnedQtyCol,
    {
      headerName: 'Earned Prev',
      width: 120,
      type: 'numericColumn',
      editable: false,
      rowSpan,
      cellClassRules: hideOnSubRows,
      cellStyle: spannedCellStyle,
      valueFormatter: (params) => params.value?.toLocaleString() || '0',
    },
    {
      headerName: 'Earned This Period',
      width: 150,
      type: 'numericColumn',
      rowSpan,
      cellClassRules: hideOnSubRows,
      cellStyle: (params: any) => ({
        ...centeredStyle,
        color:
          params.value > 0
            ? '#059669'
            : params.value < 0
            ? '#dc2626'
            : undefined,
        backgroundColor: bg,
        borderBottom: `1px solid ${borderColor}`,
      }),
      valueGetter: (params) => {
        if (params.data._isTotal) {
          return (params.data.totalEarnedQty || 0) - (params.data.earnedQtyPrevious || 0);
        }
        if (!selectedRuleOfCredit || !selectedRuleOfCredit.steps) return 0;
        const progress = params.data.ruleOfCreditProgress || {};
        const percent = rocPercentComplete(selectedRuleOfCredit.steps, progress);
        const earned = earnedQty(percent, params.data.totalQty || 0);
        return earned - (params.data.earnedQtyPrevious || 0);
      },
      valueFormatter: (params) =>
        params.value.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }),
    },
    {
      headerName: 'Remaining Qty',
      width: 130,
      type: 'numericColumn',
      rowSpan,
      cellClassRules: hideOnSubRows,
      cellStyle: spannedCellStyle,
      valueGetter: (params) => {
        if (params.data._isTotal) {
          return (params.data.totalQty || 0) - (params.data.totalEarnedQty || 0);
        }
        if (!selectedRuleOfCredit || !selectedRuleOfCredit.steps)
          return params.data.totalQty || 0;
        const progress = params.data.ruleOfCreditProgress || {};
        const percent = rocPercentComplete(selectedRuleOfCredit.steps, progress);
        const earned = earnedQty(percent, params.data.totalQty || 0);
        return (params.data.totalQty || 0) - earned;
      },
      valueFormatter: (params) => params.value.toLocaleString(),
    },
  ];

  // Dates and Phasing Method
  const scheduleCols: ColDef[] = [
    {
      headerName: 'Type',
      field: 'rowType',
      width: 100,
      cellStyle: standardCellStyle,
      cellClass: (params) =>
        cn(
          'font-bold text-[11px] uppercase tracking-wider h-full flex items-center px-2 border-r border-gray-200 dark:border-gray-700',
          params.data.rowType === 'Planned'
            ? 'text-blue-600 bg-blue-50/40 dark:bg-blue-900/20'
            : 'text-emerald-600 bg-emerald-50/40 dark:bg-emerald-900/20',
        ),
      valueFormatter: (params) => params.value,
    },
    {
      headerName: 'PHASING CHECK',
      headerClass:
        'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 font-bold',
      children: [
        {
          headerName: 'Planned Phasing',
          children: [
            {
              headerName: 'Phased Qty',
              width: 110,
              type: 'numericColumn',
              valueGetter: (params) => {
                if (params.data.rowType !== 'Planned') return null;
                const values: Record<string, number> = params.data.periodValues || {};
                return Object.values(values).reduce((a, b) => a + (b || 0), 0);
              },
              valueFormatter: (params) =>
                params.value != null
                  ? params.value.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })
                  : '',
              cellStyle: standardCellStyle,
            },
            {
              headerName: 'Variance',
              width: 100,
              type: 'numericColumn',
              valueGetter: (params) => {
                if (params.data.rowType !== 'Planned') return null;
                const values: Record<string, number> = params.data.periodValues || {};
                const phased = Object.values(values).reduce((a, b) => a + (b || 0), 0);
                return phased - (params.data.totalQty || 0);
              },
              valueFormatter: (params) =>
                params.value != null
                  ? params.value.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })
                  : '',
              cellStyle: (params) => {
                const style = standardCellStyle(params);
                if (params.value != null && Math.abs(params.value) > 0.1) {
                  return { ...style, color: '#ef4444', fontWeight: 'bold' };
                }
                return style;
              },
            },
          ],
        } as any,
        {
          headerName: 'Actual (Earned To-Date)',
          children: [
            {
              headerName: 'Total Actuals',
              width: 110,
              type: 'numericColumn',
              valueGetter: (params) => {
                if (params.data.rowType !== 'Current') return null;
                const values: Record<string, number> =
                  params.data.actualPeriodValues || {};
                return Object.values(values).reduce((a, b) => a + (b || 0), 0);
              },
              valueFormatter: (params) =>
                params.value != null
                  ? params.value.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })
                  : '',
              cellStyle: standardCellStyle,
            },
            {
              headerName: 'Variance',
              width: 100,
              type: 'numericColumn',
              valueGetter: (params) => {
                if (params.data.rowType !== 'Current') return null;
                const values: Record<string, number> =
                  params.data.actualPeriodValues || {};
                const phased = Object.values(values).reduce((a, b) => a + (b || 0), 0);
                const progress = params.data.ruleOfCreditProgress || {};
                const percent = selectedRuleOfCredit?.steps
                  ? rocPercentComplete(selectedRuleOfCredit.steps, progress)
                  : 0;
                const earned = earnedQty(percent, params.data.totalQty || 0);
                return phased - earned;
              },
              valueFormatter: (params) =>
                params.value != null
                  ? params.value.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })
                  : '',
              cellStyle: (params) => {
                const style = standardCellStyle(params);
                if (params.value != null && Math.abs(params.value) > 0.5) {
                  return { ...style, color: '#ef4444', fontWeight: 'bold' };
                }
                return style;
              },
            },
          ],
        } as any,
        {
          headerName: 'Forecast (Next to-Go)',
          children: [
            {
              headerName: 'Total Forecast',
              width: 110,
              type: 'numericColumn',
              valueGetter: (params) => {
                if (params.data.rowType !== 'Current') return null;
                const values: Record<string, number> =
                  params.data.currentPeriodValues || {};
                return Object.values(values).reduce((a, b) => a + (b || 0), 0);
              },
              valueFormatter: (params) =>
                params.value != null
                  ? params.value.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })
                  : '',
              cellStyle: standardCellStyle,
            },
            {
              headerName: 'Variance',
              width: 100,
              type: 'numericColumn',
              valueGetter: (params) => {
                if (params.data.rowType !== 'Current') return null;
                const values: Record<string, number> =
                  params.data.currentPeriodValues || {};
                const phased = Object.values(values).reduce((a, b) => a + (b || 0), 0);
                const progress = params.data.ruleOfCreditProgress || {};
                const percent = selectedRuleOfCredit?.steps
                  ? rocPercentComplete(selectedRuleOfCredit.steps, progress)
                  : 0;
                const earned = earnedQty(percent, params.data.totalQty || 0);
                const remaining = (params.data.totalQty || 0) - earned;
                return phased - remaining;
              },
              valueFormatter: (params) =>
                params.value != null
                  ? params.value.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })
                  : '',
              cellStyle: (params) => {
                const style = standardCellStyle(params);
                if (params.value != null && Math.abs(params.value) > 0.1) {
                  return { ...style, color: '#ef4444', fontWeight: 'bold' };
                }
                return style;
              },
            },
          ],
        } as any,
      ],
    } as any,
    {
      headerName: 'Start Date',
      width: 130,
      editable: (params) => !params.data?.activityId,
      cellEditor: 'agDateCellEditor',
      cellStyle: standardCellStyle,
      valueGetter: (params) => {
        if (!params.data) return null;
        let val =
          params.data.rowType === 'Planned'
            ? params.data.plannedStartDate
            : params.data.currentStartDate;
        if (!val) return null;
        if (val && typeof val === 'object' && 'seconds' in val) {
          val = new Date((val as any).seconds * 1000);
        }
        const date = val instanceof Date ? val : new Date(val);
        return isNaN(date.getTime()) ? null : date;
      },
      valueFormatter: formatGridDate,
      valueSetter: (params) => {
        if (!params.data) return false;
        const field =
          params.data.rowType === 'Planned' ? 'plannedStartDate' : 'currentStartDate';
        let finalVal = parseGridDate(params.newValue);
        if (finalVal && params.data.rowType === 'Current') {
          const currentPeriod = project.progressPeriods?.periods?.find(
            (p) => p.status === 'open',
          );
          if (currentPeriod?.startDate) {
            const pStart = new Date(currentPeriod.startDate);
            const userStart = new Date(finalVal);
            if (userStart < pStart) {
              finalVal = currentPeriod.startDate;
            }
          }
        }
        if (params.data.rowType === 'Planned') params.data.plannedStartDate = finalVal;
        else params.data.currentStartDate = finalVal;
        updateItem(params.data.id, { [field]: finalVal });
        return true;
      },
    },
    {
      headerName: 'End Date',
      width: 130,
      editable: (params) => !params.data?.activityId,
      cellEditor: 'agDateCellEditor',
      cellStyle: standardCellStyle,
      valueGetter: (params) => {
        if (!params.data) return null;
        let val =
          params.data.rowType === 'Planned'
            ? params.data.plannedEndDate
            : params.data.currentEndDate;
        if (!val) return null;
        if (val && typeof val === 'object' && 'seconds' in val) {
          val = new Date((val as any).seconds * 1000);
        }
        const date = val instanceof Date ? val : new Date(val);
        return isNaN(date.getTime()) ? null : date;
      },
      valueFormatter: formatGridDate,
      valueSetter: (params) => {
        if (!params.data) return false;
        const field =
          params.data.rowType === 'Planned' ? 'plannedEndDate' : 'currentEndDate';
        let finalVal = parseGridDate(params.newValue);
        const startVal =
          params.data.rowType === 'Planned'
            ? params.data.plannedStartDate
            : params.data.currentStartDate;
        if (startVal && finalVal) {
          const startDate = new Date(startVal);
          let endDate = new Date(finalVal);
          if (endDate <= startDate) {
            endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + 7);
            finalVal = endDate.toISOString().split('T')[0];
          }
        }
        if (params.data.rowType === 'Planned') params.data.plannedEndDate = finalVal;
        else params.data.currentEndDate = finalVal;
        updateItem(params.data.id, { [field]: finalVal });
        return true;
      },
    },
    {
      headerName: 'Phasing Method',
      width: 120,
      editable: true,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: { values: ['Auto', 'Manual'] },
      cellStyle: standardCellStyle,
      valueGetter: (params) =>
        params.data.rowType === 'Planned'
          ? params.data.phasingMethod || 'Auto'
          : params.data.currentPhasingMethod || 'Auto',
      valueSetter: (params) => {
        const newVal = params.newValue;
        const field =
          params.data.rowType === 'Planned' ? 'phasingMethod' : 'currentPhasingMethod';
        if (params.data.rowType === 'Planned') params.data.phasingMethod = newVal;
        else params.data.currentPhasingMethod = newVal;
        updateItem(params.data.id, { [field]: newVal });
        return true;
      },
    },
    {
      headerName: 'Phasing Curve',
      width: 140,
      editable: (params: any) => {
        const method =
          params.data.rowType === 'Planned'
            ? params.data.phasingMethod || 'Auto'
            : params.data.currentPhasingMethod || 'Auto';
        return method === 'Auto';
      },
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: {
        values: ['Scurve', 'Bell', 'front load', 'back load', 'even'],
      },
      cellStyle: (params: any) => {
        const method =
          params.data.rowType === 'Planned'
            ? params.data.phasingMethod || 'Auto'
            : params.data.currentPhasingMethod || 'Auto';
        return {
          ...standardCellStyle(params),
          backgroundColor:
            method === 'Manual'
              ? theme === 'dark'
                ? '#1e293b'
                : '#f1f5f9'
              : undefined,
          opacity: method === 'Manual' ? 0.5 : 1,
        };
      },
      valueGetter: (params: any) =>
        params.data.rowType === 'Planned'
          ? params.data.phasingCurve || 'even'
          : params.data.currentPhasingCurve || 'even',
      valueSetter: (params: any) => {
        const newVal = params.newValue;
        const field =
          params.data.rowType === 'Planned' ? 'phasingCurve' : 'currentPhasingCurve';
        if (params.data.rowType === 'Planned') params.data.phasingCurve = newVal;
        else params.data.currentPhasingCurve = newVal;
        updateItem(params.data.id, { [field]: newVal });
        return true;
      },
    },
  ];

  // Phasing columns (Monthly/Weekly based on progress periods)
  const phasingCols: any[] = (project.progressPeriods?.periods || []).map((p) => {
    const isWeekly = project.progressPeriods?.duration === 'week';
    const periodMatch = p.name.match(/\d+/);
    const periodNum = periodMatch
      ? periodMatch[0]
      : (project.progressPeriods?.periods.indexOf(p) ?? 0) + 1;

    let dateStr = '';
    if (p.endDate) {
      const d = new Date(p.endDate);
      if (!isNaN(d.getTime())) {
        if (isWeekly) {
          // Full date for weekly: dd/mm/yyyy
          dateStr = ` ${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1)
            .toString()
            .padStart(2, '0')}/${d.getFullYear()}`;
        } else {
          // Month'Year for monthly: (Apr'26)
          const month = d.toLocaleString('default', { month: 'short' });
          const year = d.getFullYear().toString().slice(-2);
          dateStr = ` (${month}'${year})`;
        }
      }
    }
    const headerName = `P${periodNum}${dateStr}`;

    return {
      headerName,
      width: 140,
      type: 'numericColumn',
      editable: (params: any) => {
        if (params.data.rowType === 'Actual') return isAdmin;
        if (p.status === 'closed') return isAdmin;
        if (p.status === 'open' && !isAdmin) return false;

        const method =
          params.data.rowType === 'Planned'
            ? params.data.phasingMethod || 'Auto'
            : params.data.currentPhasingMethod || 'Auto';
        return method === 'Manual';
      },
      cellClass: p.status === 'closed' ? 'bg-gray-100 dark:bg-white/5 opacity-50' : '',
      cellStyle: (params: any) => {
        const method =
          params.data.rowType === 'Planned'
            ? params.data.phasingMethod || 'Auto'
            : params.data.currentPhasingMethod || 'Auto';
        const isActuallyEditable =
          (params.data.rowType === 'Actual' && isAdmin) ||
          (params.data.rowType !== 'Actual' &&
            method === 'Manual' &&
            (isAdmin || (p.status !== 'closed' && p.status !== 'open')));

        return {
          ...standardCellStyle(params),
          backgroundColor: !isActuallyEditable
            ? theme === 'dark'
              ? '#1e293b'
              : '#f8fafc'
            : undefined,
          opacity: !isActuallyEditable ? 0.7 : 1,
          color:
            params.data.rowType === 'Actual'
              ? theme === 'dark'
                ? '#fbbf24'
                : '#b45309'
              : undefined,
        };
      },
      valueGetter: (params: any) => {
        if (params.data.rowType === 'Planned') {
          return params.data.periodValues?.[p.id] || 0;
        }
        // Current row logic: actual is closed + open periods, future = forecast
        if (p.status === 'closed' || p.status === 'open') {
          return params.data.actualPeriodValues?.[p.id] || 0;
        }
        // Future periods show forecast
        return params.data.currentPeriodValues?.[p.id] || 0;
      },
      onCellValueChanged: (params: any) => {
        let field = 'periodValues';
        if (params.data.rowType === 'Current') {
          if (p.status === 'closed' || p.status === 'open') field = 'actualPeriodValues';
          else field = 'currentPeriodValues';
        }
        const currentValues = params.data[field] || {};
        updateItem(params.data.id, {
          [field]: { ...currentValues, [p.id]: parseFloat(params.newValue) || 0 },
        });
      },
    };
  });

  const actionsCol: ColDef = {
    headerName: '',
    width: 50,
    pinned: 'right',
    rowSpan,
    cellClassRules: hideOnSubRows,
    cellStyle: (_spanning: any) => ({
      ...centeredStyle,
      backgroundColor: bg,
      borderBottom: `1px solid ${borderColor}`,
    }),
    cellRenderer: (params: any) => (
      <button
        onClick={() => deleteItem(params.data)}
        className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors mt-1"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    ),
  };

  const finalCols: (ColDef | ColGroupDef)[] = [
    ...baseCols,
    {
      headerName: 'Enterprise Line Item Attributes',
      children: enterpriseItemAttrCols,
      marryChildren: true,
      openByDefault: true,
    } as ColGroupDef,
    {
      headerName: 'Project Line Item Attributes',
      children: projectItemAttrCols,
      marryChildren: true,
      openByDefault: true,
    } as ColGroupDef,
    {
      headerName: 'Quantity Tracking',
      children: qtyTrackingCols,
      marryChildren: true,
    } as ColGroupDef,
    {
      headerName: 'Rules of Credit',
      children: [...rocStepCols, percentCompleteCol],
      marryChildren: true,
    } as ColGroupDef,
    {
      headerName: 'Schedule & Phasing Method',
      children: scheduleCols,
      marryChildren: true,
      openByDefault: false,
    } as ColGroupDef,
    {
      headerName: 'Phasing (Progress Periods)',
      children: phasingCols,
      marryChildren: true,
    } as ColGroupDef,
    actionsCol,
  ];

  return finalCols;
}
