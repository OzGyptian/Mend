import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ColDef, ColGroupDef, ValueFormatterParams } from 'ag-grid-community';
import { Project, Enterprise, Calendar as ProjectCalendar, ScheduleItem } from '../../types';
import { cn, formatCurrency, formatNumber } from '../../lib/utils';

// ─────────────────────────────────────────────────────────────────────────────
// ETC Details column definitions
// ─────────────────────────────────────────────────────────────────────────────

export interface EtcColumnDepsType {
  project: Project;
  enterprise: Enterprise;
  calendars: ProjectCalendar[];
  scheduleItems: ScheduleItem[];
  enterpriseLineItemAttrs: Array<{ id: string; title: string; values: Array<{ id: string; description: string }> }>;
  projectLineItemAttrs: Array<{ id: string; title: string; values: Array<{ id: string; description: string }> }>;
  DEFAULT_CATEGORIES: string[];
  handleDeleteEtcRow: (rowId: string) => void;
  handleUpdateEtcRow: (rowId: string, data: any) => void;
  dateFormatter: (params: any) => string;
  safeDateSetter: (field: string) => (params: any) => boolean;
}

export function buildEtcColumnDefs(deps: EtcColumnDepsType): (ColDef | ColGroupDef)[] {
  const {
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
  } = deps;

  const allPeriods = project.reportingPeriods?.periods || [];
  const currentPeriodId = project.reportingPeriods?.currentPeriodId;
  const currentIndex = allPeriods.findIndex(p => p.id === currentPeriodId);

  // Only show future periods
  const periods = allPeriods.slice(currentIndex + 1);

  const defs: (ColDef | ColGroupDef)[] = [
    {
      headerName: 'Core Information',
      openByDefault: true,
      children: [
        {
          headerName: '',
          width: 40,
          pinned: 'left',
          checkboxSelection: true,
          headerCheckboxSelection: true,
          headerCheckboxSelectionFilteredOnly: true,
          cellRenderer: (params: any) => {
            if (params.node.rowPinned === 'top') return null;
            return null; // Ag-grid handles checkbox
          }
        },
        {
          headerName: 'Source',
          width: 100,
          pinned: 'left',
          cellRenderer: (params: any) => {
            if (params.node.rowPinned === 'top') return null;
            const source = params.data.source || (params.data.isEnterpriseResource ? 'ENTERPRISE' : 'MANUAL');

            if (source === 'PROJECT') {
              return <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 text-[10px] uppercase font-bold">Project</Badge>;
            }
            if (source === 'ENTERPRISE') {
              return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] uppercase font-bold">Enterprise</Badge>;
            }
            return <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200 text-[10px] uppercase font-bold">Manual</Badge>;
          }
        },
        {
          headerName: 'Item Details',
          pinned: 'left',
          openByDefault: true,
          children: [
            {
              field: 'item',
              headerName: 'Item',
              width: 120,
              pinned: 'left',
              editable: (params) => !params.data.isEnterpriseResource && params.data.source !== 'PROJECT'
            },
            {
              field: 'description',
              headerName: 'Description',
              width: 200,
              pinned: 'left',
              editable: (params) => !params.data.isEnterpriseResource && params.data.source !== 'PROJECT',
              cellRenderer: (params: any) => {
                if (params.node.rowPinned === 'top') {
                  return <span className="font-bold text-blue-600 dark:text-blue-400">SubTotal</span>;
                }
                return params.value;
              }
            },
            {
              field: 'category',
              headerName: 'Resource Category',
              width: 120,
              editable: (params) => !params.data.isEnterpriseResource && params.data.source !== 'PROJECT',
              cellEditor: 'agSelectCellEditor',
              cellEditorParams: {
                values: (enterprise.categories && enterprise.categories.length > 0) ? enterprise.categories : DEFAULT_CATEGORIES
              }
            },
          ]
        },
      ]
    }
  ];

  if (enterpriseLineItemAttrs.length > 0) {
    defs.push({
      headerName: 'Enterprise Line-Item Attributes',
      openByDefault: true,
      children: enterpriseLineItemAttrs.map((attr, index) => ({
        headerName: attr.title,
        field: `enterpriseAttributes.${attr.id}`,
        width: 150,
        columnGroupShow: index === 0 ? undefined : 'open',
        editable: (params: any) => params.node.rowPinned !== 'top',
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: attr.values.map(v => v.id),
        },
        valueSetter: (params: any) => {
          if (!params.data || params.newValue === undefined) return false;
          if (!params.data.enterpriseAttributes) {
            params.data.enterpriseAttributes = {};
          }
          let val = params.newValue;
          if (typeof val === 'string' && val.includes(' - ')) {
            val = val.split(' - ')[0];
          }
          params.data.enterpriseAttributes[attr.id] = val;
          return true;
        },
        valueFormatter: (params: any) => {
          const v = attr.values.find(v => v.id === params.value);
          return v ? `${v.id} - ${v.description}` : params.value;
        }
      }))
    });
  }

  if (projectLineItemAttrs.length > 0) {
    defs.push({
      headerName: 'Project Line-Item Attributes',
      openByDefault: true,
      children: projectLineItemAttrs.map((attr, index) => ({
        headerName: attr.title,
        field: `projectAttributes.${attr.id}`,
        width: 150,
        columnGroupShow: index === 0 ? undefined : 'open',
        editable: (params: any) => params.node.rowPinned !== 'top',
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: attr.values.map(v => v.id),
        },
        valueSetter: (params: any) => {
          if (!params.data || params.newValue === undefined) return false;
          if (!params.data.projectAttributes) {
            params.data.projectAttributes = {};
          }
          let val = params.newValue;
          if (typeof val === 'string' && val.includes(' - ')) {
            val = val.split(' - ')[0];
          }
          params.data.projectAttributes[attr.id] = val;
          return true;
        },
        valueFormatter: (params: any) => {
          const v = attr.values.find(v => v.id === params.value);
          return v ? `${v.id} - ${v.description}` : params.value;
        }
      }))
    });
  }

  // 4. User Defined Attributes
  defs.push({
    headerName: 'User Defined',
    openByDefault: true,
    children: [
      ...Array.from({ length: 5 }).map((_, i) => ({
        headerName: `Numeric ${i + 1}`,
        field: `userDefined.num${i + 1}`,
        width: 120,
        type: 'numericColumn',
        columnGroupShow: (i === 0 ? undefined : 'open') as any,
        editable: (params: any) => params.node.rowPinned !== 'top',
        valueParser: (params: any) => Number(params.newValue) || 0,
        valueSetter: (params: any) => {
          if (!params.data.userDefined) params.data.userDefined = {};
          params.data.userDefined[`num${i + 1}`] = params.newValue;
          return true;
        }
      })),
      ...Array.from({ length: 5 }).map((_, i) => ({
        headerName: `Text ${i + 1}`,
        field: `userDefined.text${i + 1}`,
        width: 150,
        columnGroupShow: 'open' as any,
        editable: (params: any) => params.node.rowPinned !== 'top',
        valueParser: (params: any) => {
          if (typeof params.newValue === 'string') {
            return params.newValue.substring(0, 100);
          }
          return params.newValue;
        },
        valueSetter: (params: any) => {
          if (!params.data.userDefined) params.data.userDefined = {};
          params.data.userDefined[`text${i + 1}`] = params.newValue;
          return true;
        }
      }))
    ]
  });

  defs.push({
    headerName: 'Pricing',
    pinned: 'left',
    openByDefault: true,
    children: [
      {
        field: 'qty',
        headerName: 'Qty',
        width: 100,
        type: 'numericColumn',
        aggFunc: 'sum',
        editable: false,
        valueGetter: (params) => {
          if (params.node?.rowPinned === 'top') return params.data.qty;
          if (!params.data) return 0;
          const periodValues = (params.data.periodValues || {}) as Record<string, number>;
          // CRITICAL: Only sum future periods for ETC Qty
          const total = periods.reduce((acc: number, p: any) => acc + (periodValues[p.id] || 0), 0);
          return Math.round(total * 100) / 100;
        },
        valueFormatter: (params) => {
          if (params.node?.rowPinned === 'top') return formatNumber(params.value, 2);
          return formatNumber(params.value, 2);
        },
        cellStyle: (params: any) => {
          const isPinned = params.node.rowPinned === 'top';
          if (isPinned) return {};
          return { backgroundColor: '#f3f4f6', fontWeight: 'bold', color: 'black' };
        }
      },
      {
        field: 'unit',
        headerName: 'Unit',
        width: 100,
        editable: (params) => !params.data.isEnterpriseResource && params.data.source !== 'PROJECT',
        cellStyle: (params: any) => {
          const isReadOnly = params.data?.isEnterpriseResource || params.data?.source === 'PROJECT';
          return {
            backgroundColor: isReadOnly ? '#f3f4f6' : 'white',
            fontWeight: isReadOnly ? 'bold' : 'normal',
            color: 'black'
          };
        }
      },
      {
        field: 'rate',
        headerName: 'Rate',
        width: 100,
        type: 'numericColumn',
        editable: (params) => !params.data.isEnterpriseResource && params.data.source !== 'PROJECT',
        valueFormatter: (params) => {
          if (params.node?.rowPinned === 'top') return '';
          return formatNumber(params.value, 2);
        },
        cellStyle: (params: any) => {
          const isReadOnly = params.data?.isEnterpriseResource || params.data?.source === 'PROJECT';
          return {
            backgroundColor: isReadOnly ? '#f3f4f6' : 'white',
            fontWeight: isReadOnly ? 'bold' : 'normal',
            color: 'black'
          };
        }
      },
      {
        headerName: 'Total ETC',
        width: 120,
        type: 'numericColumn',
        aggFunc: 'sum',
        valueGetter: (params) => {
          if (params.node?.rowPinned === 'top') return params.data.totalEtc;
          if (params.node?.group) return undefined;
          const periodValues = (params.data.periodValues || {}) as Record<string, number>;
          // Only sum future periods for ETC Total
          const qty = periods.reduce((acc: number, p: any) => acc + (periodValues[p.id] || 0), 0);
          return qty * (params.data.rate || 0);
        },
        valueFormatter: (params) => formatNumber(params.value, 2),
        cellStyle: (params: any) => params.node.rowPinned === 'top' ? {} : { backgroundColor: '#f3f4f6', fontWeight: 'bold', color: 'black' }
      },
      {
        headerName: 'Total ETC Previous',
        width: 140,
        type: 'numericColumn',
        aggFunc: 'sum',
        editable: false,
        valueGetter: (params) => {
          if (params.node?.rowPinned === 'top') return params.data.totalEtcPrevious;
          if (params.node?.group) return undefined;
          return params.data.totalEtcPrevious || 0;
        },
        valueFormatter: (params) => formatNumber(params.value, 2),
        cellStyle: (params: any) => params.node.rowPinned === 'top' ? {} : { backgroundColor: '#f3f4f6', fontWeight: 'bold', color: 'black' }
      },
      {
        headerName: 'ETC Mvmt',
        width: 120,
        type: 'numericColumn',
        aggFunc: 'sum',
        editable: false,
        valueGetter: (params) => {
          if (params.node?.rowPinned === 'top') return params.data.etcMvmt;
          if (params.node?.group) return undefined;

          const periodValues = (params.data.periodValues || {}) as Record<string, number>;
          const qty = periods.reduce((acc: number, p: any) => acc + (periodValues[p.id] || 0), 0);
          const totalEtc = qty * (params.data.rate || 0);
          const previous = params.data.totalEtcPrevious || 0;
          return totalEtc - previous;
        },
        valueFormatter: (params) => formatNumber(params.value, 2),
        cellStyle: (params: any) => {
          const isPinned = params.node.rowPinned === 'top';
          if (isPinned) return {};
          const val = params.value || 0;
          return {
            backgroundColor: '#f3f4f6',
            fontWeight: 'bold',
            color: val > 0 ? '#ef4444' : (val < 0 ? '#10b981' : 'black')
          };
        }
      },
    ]
  });

  defs.push({
    headerName: 'Auto-Phasing',
    pinned: 'left',
    openByDefault: true,
    children: [
      {
        field: 'calendarId',
        headerName: 'Calendar',
        width: 150,
        columnGroupShow: 'open',
        editable: (params) => params.data.phasingMethod === 'Auto-Phase',
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: [null, ...calendars.map(c => c.id)],
          formatValue: (val: string) => calendars.find(c => c.id === val)?.name || 'None'
        },
        valueFormatter: (params) => calendars.find(c => c.id === params.value)?.name || 'None',
        cellClass: (params) => params.data.phasingMethod === 'Auto-Phase' ? 'bg-white dark:bg-transparent' : 'bg-gray-100 dark:bg-white/5 text-gray-400'
      },
      {
        field: 'phasingMethod',
        headerName: 'Method',
        width: 120,
        editable: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: ['Manual', 'Auto-Phase']
        },
        cellClass: 'font-medium'
      },
      {
        headerName: 'Activity ID',
        field: 'activityId',
        width: 150,
        editable: true,
        cellEditor: 'agRichSelectCellEditor',
        cellEditorParams: {
          values: [null, ...scheduleItems.map(item => item.activityId).sort()],
          formatValue: (val: string) => {
            const item = scheduleItems.find(i => i.activityId === val);
            return item ? `${item.activityId} - ${item.description}` : val || 'None';
          },
          searchType: 'match',
          allowTyping: true,
          filterList: true,
          highlightMatch: true
        },
        onCellValueChanged: (params) => {
          const newActivityId = params.newValue;
          if (newActivityId) {
            const scheduleItem = scheduleItems.find(s => s.activityId === newActivityId);
            if (scheduleItem) {
              params.data.phasingStartDate = scheduleItem.currentStartDate;
              params.data.phasingEndDate = scheduleItem.currentEndDate;
              params.data.phasingMethod = 'Auto-Phase';
              // Force refresh of the row to update UI
              params.api.refreshCells({ rowNodes: [params.node], force: true });
              handleUpdateEtcRow(params.data.id, params.data);
            }
          } else {
            handleUpdateEtcRow(params.data.id, params.data);
          }
        },
        cellClass: 'bg-emerald-50/10 dark:bg-emerald-900/10'
      },
      {
        field: 'phasingStartDate',
        headerName: 'Start Date',
        width: 120,
        columnGroupShow: 'open',
        editable: (params) => params.data.phasingMethod === 'Auto-Phase' && !params.data.activityId,
        cellEditor: 'agDateCellEditor',
        valueGetter: (params) => {
          const val = params.data.phasingStartDate;
          if (!val) return null;
          const d = new Date(val);
          return isNaN(d.getTime()) ? null : d;
        },
        valueSetter: safeDateSetter('phasingStartDate'),
        valueFormatter: dateFormatter,
        cellClass: (params) => {
          if (params.data.phasingMethod !== 'Auto-Phase') return 'bg-gray-100 dark:bg-white/5 text-gray-400';
          if (params.data.activityId) return 'bg-amber-50/30 dark:bg-amber-900/10 text-gray-500 italic';
          return 'bg-white dark:bg-transparent';
        }
      },
      {
        field: 'phasingEndDate',
        headerName: 'End Date',
        width: 120,
        columnGroupShow: 'open',
        editable: (params) => params.data.phasingMethod === 'Auto-Phase' && !params.data.activityId,
        cellEditor: 'agDateCellEditor',
        valueGetter: (params) => {
          const val = params.data.phasingEndDate;
          if (!val) return null;
          const d = new Date(val);
          return isNaN(d.getTime()) ? null : d;
        },
        valueSetter: safeDateSetter('phasingEndDate'),
        valueFormatter: dateFormatter,
        cellClass: (params) => {
          if (params.data.phasingMethod !== 'Auto-Phase') return 'bg-gray-100 dark:bg-white/5 text-gray-400';
          if (params.data.activityId) return 'bg-amber-50/30 dark:bg-amber-900/10 text-gray-500 italic';
          return 'bg-white dark:bg-transparent';
        }
      },
      {
        field: 'phasingUnit',
        headerName: 'Phasing Unit',
        width: 120,
        columnGroupShow: 'open',
        editable: (params) => params.data.phasingMethod === 'Auto-Phase',
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: ['Daily', 'Weekly', 'Monthly', 'Total', 'Profile']
        },
        cellClass: (params) => params.data.phasingMethod === 'Auto-Phase' ? 'bg-white dark:bg-transparent' : 'bg-gray-100 dark:bg-white/5 text-gray-400'
      },
      {
        field: 'phasingQty',
        headerName: 'Phasing Qty',
        width: 110,
        columnGroupShow: 'open',
        type: 'numericColumn',
        editable: (params) => params.data.phasingMethod === 'Auto-Phase',
        valueFormatter: (params) => formatNumber(params.value, 2),
        cellClass: (params) => params.data.phasingMethod === 'Auto-Phase' ? 'bg-white dark:bg-transparent' : 'bg-gray-100 dark:bg-white/5 text-gray-400'
      }
    ]
  });

  if (periods.length > 0) {
    defs.push({
      headerName: 'Resource Forecasting',
      openByDefault: true,
      children: periods.map((p, _idx) => {
        const date = new Date(p.endDate);
        const month = date.getUTCMonth();
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthName = monthNames[month];
        const year = date.getUTCFullYear().toString().slice(-2);
        const periodNumber = allPeriods.findIndex(per => per.id === p.id) + 1;
        const headerName = `P${periodNumber}\n(${monthName}'${year})`;

        return {
          headerName,
          field: `periodValues.${p.id}`,
          width: 120,
          minWidth: 110,
          type: 'numericColumn',
          aggFunc: 'sum',
          editable: (params: any) => params.data?.phasingMethod !== 'Auto-Phase',
          cellStyle: (params: any) => ({
            backgroundColor: params.data?.phasingMethod === 'Auto-Phase' ? '#f3f4f6' : 'white',
            fontWeight: params.data?.phasingMethod === 'Auto-Phase' ? 'bold' : 'normal',
            color: 'black'
          }),
          valueGetter: (params: any) => {
            if (!params.data) return 0;
            return params.data.periodValues?.[p.id] || 0;
          },
          valueFormatter: (params: any) => formatNumber(params.value, 2),
          valueSetter: (params: any) => {
            if (!params.data) return false;
            const val = Number(params.newValue);
            if (isNaN(val)) return false;
            const periodValues = { ...(params.data.periodValues || {}), [p.id]: val };
            params.data.periodValues = periodValues;
            return true;
          }
        };
      })
    });
  }

  // Add Actions column at the very end
  defs.push({
    headerName: 'Actions',
    width: 80,
    pinned: 'right',
    cellRenderer: (params: any) => {
      if (params.node.rowPinned === 'top') return null;
      return (
        <div className="flex items-center justify-center h-full">
          <button
            onClick={() => handleDeleteEtcRow(params.data.id)}
            className="p-1 hover:bg-gray-100 dark:hover:bg-white/10 rounded text-gray-400 hover:text-red-600 transition-colors"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      );
    }
  });

  return defs;
}

// ─────────────────────────────────────────────────────────────────────────────
// Timephasing column definitions
// ─────────────────────────────────────────────────────────────────────────────

export interface TimephasingColumnDepsType {
  project: Project;
  scheduleItems: ScheduleItem[];
  currencyFormatter: (params: ValueFormatterParams) => string;
  dateFormatter: (params: any) => string;
  safeDateSetter: (field: string) => (params: any) => boolean;
}

export function buildTimephasingColumnDefs(deps: TimephasingColumnDepsType): (ColDef | ColGroupDef)[] {
  const { project, scheduleItems, currencyFormatter, dateFormatter, safeDateSetter } = deps;

  const periods = project.reportingPeriods?.periods || [];
  const currentPeriodId = project.reportingPeriods?.currentPeriodId;
  const currentPeriodIndex = periods.findIndex(p => p.id === currentPeriodId);

  const defs: (ColDef | ColGroupDef)[] = [
    {
      headerName: 'Type',
      field: 'type',
      width: 180,
      pinned: 'left',
      lockPosition: 'left',
      suppressMovable: true,
      checkboxSelection: true,
      headerCheckboxSelection: true,
      cellClass: 'font-bold bg-slate-50 dark:bg-slate-900',
    },
    {
      headerName: 'Phasing Source',
      field: 'phasingSource',
      width: 130,
      editable: true,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: (params: any) => {
        if (params.data.id === 'eac') {
          const values = ['SubContract', 'Manual', 'Auto'];
          if (params.data.eacMethod === 'ETC Details') {
            values.unshift('ETC Details');
          }
          return { values };
        }
        return { values: ['Manual', 'Auto'] };
      },
      cellClass: 'bg-white dark:bg-slate-900',
    },
    {
      headerName: 'Activity ID',
      field: 'activityId',
      width: 150,
      editable: true,
      cellEditor: 'agRichSelectCellEditor',
      cellEditorParams: {
        values: [null, ...scheduleItems.map(item => item.activityId).sort()],
        formatValue: (val: string) => {
          const item = scheduleItems.find(i => i.activityId === val);
          return item ? `${item.activityId} - ${item.description}` : val || 'None';
        },
        searchType: 'match',
        allowTyping: true,
        filterList: true,
        highlightMatch: true
      },
      onCellValueChanged: (params: any) => {
        const newActivityId = params.newValue;
        if (newActivityId) {
          const scheduleItem = scheduleItems.find(s => s.activityId === newActivityId);
          if (scheduleItem) {
            params.data.startDate = scheduleItem.currentStartDate;
            params.data.endDate = scheduleItem.currentEndDate;
            params.data.phasingSource = 'Auto';
            // Force refresh of the row to update UI
            params.api.refreshCells({ rowNodes: [params.node], force: true });
          }
        }
      },
      cellClass: 'bg-emerald-50/10 dark:bg-emerald-900/10'
    },
    {
      headerName: 'Start Date',
      field: 'startDate',
      width: 120,
      editable: (params: any) => params.data.phasingSource === 'Auto',
      valueGetter: (params) => {
        const val = params.data.startDate;
        if (!val) return null;
        const d = new Date(val);
        return isNaN(d.getTime()) ? null : d;
      },
      valueFormatter: dateFormatter,
      valueSetter: safeDateSetter('startDate'),
      cellEditor: 'agDateCellEditor',
      cellClass: (params: any) => params.data.phasingSource === 'Auto' ? 'bg-white dark:bg-slate-900' : 'bg-slate-50 dark:bg-slate-900/50',
    },
    {
      headerName: 'End Date',
      field: 'endDate',
      width: 120,
      editable: (params: any) => params.data.phasingSource === 'Auto',
      valueGetter: (params) => {
        const val = params.data.endDate;
        if (!val) return null;
        const d = new Date(val);
        return isNaN(d.getTime()) ? null : d;
      },
      valueFormatter: dateFormatter,
      valueSetter: safeDateSetter('endDate'),
      cellEditor: 'agDateCellEditor',
      cellClass: (params: any) => params.data.phasingSource === 'Auto' ? 'bg-white dark:bg-slate-900' : 'bg-slate-50 dark:bg-slate-900/50',
    },
    {
      headerName: 'Distribution',
      field: 'distribution',
      width: 130,
      editable: (params: any) => params.data.phasingSource === 'Auto',
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: {
        values: ['Even', 'Bell Curve', 'Front load', 'Back load', 'S-Curve', 'Profile']
      },
      cellClass: (params: any) => params.data.phasingSource === 'Auto' ? 'bg-white dark:bg-slate-900' : 'bg-slate-50 dark:bg-slate-900/50',
    },
    {
      headerName: 'Total Phased',
      width: 130,
      type: 'numericColumn',
      valueFormatter: currencyFormatter,
      valueGetter: (params) => {
        if (!params.data?.periodValues) return 0;
        return Object.values(params.data.periodValues).reduce((acc: number, val: any) => acc + (Number(val) || 0), 0);
      },
      cellClass: 'font-bold bg-slate-100 dark:bg-slate-800',
    },
    {
      headerName: 'Total',
      field: 'totalFromCode',
      width: 130,
      type: 'numericColumn',
      valueFormatter: currencyFormatter,
      cellClass: 'font-bold bg-slate-50 dark:bg-slate-900 text-blue-600',
    },
    {
      headerName: 'Difference',
      width: 130,
      type: 'numericColumn',
      valueFormatter: currencyFormatter,
      valueGetter: (params) => {
        const totalPhased = Object.values(params.data?.periodValues || {}).reduce((acc: number, val: any) => acc + (Number(val) || 0), 0) as number;
        const totalFromCode = (params.data?.totalFromCode || 0) as number;
        return totalPhased - totalFromCode;
      },
      cellClassRules: {
        'text-red-600 font-bold': (params: any) => Math.abs(Number(params.value)) > 0.01,
        'text-emerald-600 font-bold': (params: any) => Math.abs(Number(params.value)) <= 0.01,
      },
      cellClass: 'bg-slate-50 dark:bg-slate-900',
    },
    {
      headerName: 'Periods',
      children: periods.map(p => {
        const date = new Date(p.endDate);
        const month = date.toLocaleString('default', { month: 'short' });
        const year = date.getFullYear().toString().slice(-2);
        const periodNumber = periods.findIndex(per => per.id === p.id) + 1;
        const headerName = `P${periodNumber}\n(${month}'${year})`;
        const periodIndex = periods.findIndex(per => per.id === p.id);

        return {
          headerName,
          field: `periodValues.${p.id}`,
          width: 120,
          minWidth: 110,
          type: 'numericColumn',
          valueFormatter: currencyFormatter,
          editable: (params: any) => {
            // Baseline and Approved are always editable if source is Manual
            if (params.data.id === 'baseline' || params.data.id === 'approved') {
              return params.data.phasingSource === 'Manual';
            }
            // EAC is editable only for Future periods and if source is Manual
            if (params.data.id === 'eac') {
              return params.data.phasingSource === 'Manual' && periodIndex > currentPeriodIndex;
            }
            return false;
          },
          cellClass: (params: any) => {
            const isEditable = (params.data.id === 'baseline' || params.data.id === 'approved')
              ? params.data.phasingSource === 'Manual'
              : (params.data.id === 'eac' && params.data.phasingSource === 'Manual' && periodIndex > currentPeriodIndex);

            if (isEditable) {
              return 'bg-white dark:bg-slate-900';
            }
            return 'bg-slate-50 dark:bg-slate-900/50 text-slate-400';
          },
          valueSetter: (params: any) => {
            if (!params.data.periodValues) params.data.periodValues = {};
            params.data.periodValues[p.id] = Number(params.newValue) || 0;
            return true;
          }
        };
      })
    }
  ];

  return defs;
}

// ─────────────────────────────────────────────────────────────────────────────
// Actuals column definitions
// ─────────────────────────────────────────────────────────────────────────────

export interface ActualsColumnDepsType {
  project: Project;
  dateFormatter: (params: any) => string;
  currencyFormatter: (params: ValueFormatterParams) => string;
}

export function buildActualsColumnDefs(deps: ActualsColumnDepsType): ColDef[] {
  const { project, dateFormatter, currencyFormatter } = deps;

  return [
    {
      headerName: 'Date',
      field: 'date',
      width: 120,
      valueGetter: params => params.data?.date ? new Date(params.data.date) : null,
      valueFormatter: dateFormatter,
      cellRenderer: (params: any) => {
        if (params.node.rowPinned === 'top') return <span className="font-bold text-blue-800 dark:text-blue-200">TOTAL</span>;
        return params.valueFormatted || params.value;
      }
    },
    { headerName: 'Description', field: 'description', flex: 1 },
    { headerName: 'Source', field: 'source', width: 150 },
    {
      headerName: 'Reporting Period',
      field: 'reportingPeriodId',
      width: 150,
      valueFormatter: (params) => {
        const period = project.reportingPeriods?.periods.find(p => p.id === params.value);
        if (period) return period.name;
        // Fallback for numeric periods
        const num = Number(params.value);
        if (!isNaN(num) && project.reportingPeriods?.periods[num - 1]) {
          return project.reportingPeriods.periods[num - 1].name;
        }
        return params.value;
      }
    },
    {
      headerName: 'Cost',
      field: 'cost',
      width: 150,
      type: 'numericColumn',
      valueFormatter: currencyFormatter,
      cellClass: 'font-bold',
      aggFunc: 'sum'
    }
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// Baseline column definitions
// ─────────────────────────────────────────────────────────────────────────────

export interface BaselineColumnDepsType {
  currencyFormatter: (params: ValueFormatterParams) => string;
}

export function buildBaselineColumnDefs(deps: BaselineColumnDepsType): ColDef[] {
  const { currencyFormatter } = deps;

  return [
    {
      headerName: 'Item',
      field: 'item',
      width: 150,
      cellRenderer: (params: any) => {
        if (params.node.rowPinned === 'top') return <span className="font-bold text-amber-800 dark:text-amber-200">TOTAL</span>;
        return params.value;
      }
    },
    { headerName: 'Description', field: 'description', flex: 1 },
    {
      headerName: 'Amount',
      field: 'amount',
      width: 150,
      type: 'numericColumn',
      valueFormatter: currencyFormatter,
      cellClass: 'font-bold',
      aggFunc: 'sum'
    },
    {
      headerName: 'Created',
      field: 'createdAt',
      width: 150,
      valueFormatter: (params) => params.value ? format(parseISO(params.value), 'MMM dd, yyyy') : ''
    }
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// Main cost codes grid column definitions
// ─────────────────────────────────────────────────────────────────────────────

export interface MainColumnDepsType {
  enterprise: Enterprise;
  project: Project;
  enterpriseAttrs: Array<{ id: string; title: string; values: Array<{ id: string; description: string }> }>;
  projectAttrs: Array<{ id: string; title: string; values: Array<{ id: string; description: string }> }>;
  selectedEtcCode: string | null;
  riskExposureByCostCode: Record<string, { initialEMV: number; mitigationCost: number; residualEMV: number }>;
  currencyFormatter: (params: ValueFormatterParams) => string;
  movementRenderer: (params: any, type: 'budget' | 'eac' | 'variance') => React.ReactNode;
}

export function buildMainColumnDefs(deps: MainColumnDepsType): (ColDef | ColGroupDef)[] {
  const {
    enterprise,
    project,
    enterpriseAttrs,
    projectAttrs,
    riskExposureByCostCode,
    currencyFormatter,
    movementRenderer,
  } = deps;

  const defs: (ColDef | ColGroupDef)[] = [
    {
      headerName: 'General',
      headerClass: 'header-group-general',
      openByDefault: true,
      children: [
        {
          headerName: 'Cost Code ID',
          field: 'code',
          sort: 'asc',
          cellStyle: { backgroundColor: '#f3f4f6', fontWeight: 'bold', color: 'black' },
          checkboxSelection: true,
          headerCheckboxSelection: true,
          headerCheckboxSelectionFilteredOnly: true,
          width: 150,
          pinned: 'left',
          filter: 'agTextColumnFilter',
          sortable: true,
          enableRowGroup: true,
          cellRenderer: (params: any) => {
            if (params.node.footer || params.node.rowPinned === 'top') {
              return <span className="font-bold text-blue-800 dark:text-blue-200">GRAND TOTAL</span>;
            }
            return params.value;
          },
        },
        {
          field: 'name',
          headerName: 'Cost Code Description',
          width: 250,
          pinned: 'left',
          filter: 'agTextColumnFilter',
          sortable: true,
          editable: true,
          cellStyle: { backgroundColor: 'white', color: 'black' },
          enableRowGroup: true,
        },
        {
          headerName: 'EAC Method',
          field: 'eacMethod',
          width: 150,
          editable: true,
          cellStyle: { backgroundColor: 'white', color: 'black' },
          cellEditor: 'agSelectCellEditor',
          cellEditorParams: {
            values: ['Manual', 'Change Management', 'ETC Details', 'Sub-Contract Management']
          },
          filter: 'agSetColumnFilter',
          sortable: true,
          enableRowGroup: true,
        },
        {
          headerName: 'Users',
          field: 'assignedUsers',
          width: 200,
          editable: true,
          cellClass: 'bg-white dark:bg-slate-900',
          cellRenderer: (params: any) => {
            if (!params.value || !Array.isArray(params.value)) return '';
            return params.value
              .map((uid: string) => enterprise.users?.[uid]?.email || uid)
              .join(', ');
          },
          cellEditor: 'agSelectCellEditor',
          cellEditorParams: {
            values: Object.keys(project.users || {}),
            valueListMaxHeight: 200,
            // Note: Built-in select editor doesn't support multi-select.
            // For a true multi-select, a custom cell editor would be needed.
          },
          valueFormatter: (params: any) => {
            if (!params.value || !Array.isArray(params.value)) return '';
            return params.value
              .map((uid: string) => enterprise.users?.[uid]?.email || uid)
              .join(', ');
          },
          filter: 'agSetColumnFilter',
          sortable: true,
          enableRowGroup: true,
        },
      ]
    }
  ];

  // 2. Enterprise Attributes
  if (enterpriseAttrs.length > 0) {
    defs.push({
      headerName: 'Enterprise Attributes',
      headerClass: 'header-group-enterprise',
      openByDefault: true,
      children: enterpriseAttrs.map((attr, index) => ({
        headerName: attr.title,
        field: `enterpriseAttributes.${attr.id}`,
        width: 150,
        columnGroupShow: index === 0 ? undefined : 'open',
        filter: 'agSetColumnFilter',
        sortable: true,
        enableRowGroup: true,
        editable: true,
        cellClass: 'bg-white dark:bg-slate-900',
        cellEditor: 'agRichSelectCellEditor',
        cellEditorParams: {
          values: attr.values.map(v => v.id),
          formatValue: (id: string) => {
            if (!id) return '';
            const match = attr.values.find(v => v.id === id);
            return match ? `${match.id} - ${match.description}` : id;
          },
          searchType: 'match',
          allowTyping: true,
          filterList: true,
          highlightMatch: true
        },
        refData: Object.fromEntries(attr.values.map(v => [v.id, `${v.id} - ${v.description}`])),
        valueSetter: (params: any) => {
          if (!params.data || params.newValue === undefined) return false;
          if (!params.data.enterpriseAttributes) {
            params.data.enterpriseAttributes = {};
          }
          let val = params.newValue;
          if (typeof val === 'string' && val.includes(' - ')) {
            val = val.split(' - ')[0];
          }
          params.data.enterpriseAttributes[attr.id] = val;
          return true;
        },
        valueGetter: (params: any) => {
          if (!params.data) return '';
          return params.data.enterpriseAttributes?.[attr.id] || '';
        }
      }))
    });
  }

  // 3. Project Attributes
  if (projectAttrs.length > 0) {
    defs.push({
      headerName: 'Project Attributes',
      headerClass: 'header-group-project',
      openByDefault: true,
      children: projectAttrs.map((attr, index) => ({
        headerName: attr.title,
        field: `projectAttributes.${attr.id}`,
        width: 150,
        columnGroupShow: index === 0 ? undefined : 'open',
        filter: 'agSetColumnFilter',
        sortable: true,
        enableRowGroup: true,
        editable: true,
        cellClass: 'bg-white dark:bg-slate-900',
        cellEditor: 'agRichSelectCellEditor',
        cellEditorParams: {
          values: attr.values.map(v => v.id),
          formatValue: (id: string) => {
            if (!id) return '';
            const match = attr.values.find(v => v.id === id);
            return match ? `${match.id} - ${match.description}` : id;
          },
          searchType: 'match',
          allowTyping: true,
          filterList: true,
          highlightMatch: true
        },
        refData: Object.fromEntries(attr.values.map(v => [v.id, `${v.id} - ${v.description}`])),
        valueSetter: (params: any) => {
          if (!params.data || params.newValue === undefined) return false;
          if (!params.data.projectAttributes) {
            params.data.projectAttributes = {};
          }
          let val = params.newValue;
          if (typeof val === 'string' && val.includes(' - ')) {
            val = val.split(' - ')[0];
          }
          params.data.projectAttributes[attr.id] = val;
          return true;
        },
        valueGetter: (params: any) => {
          if (!params.data) return '';
          return params.data.projectAttributes?.[attr.id] || '';
        }
      }))
    });
  }

  // 4. EAC Method - MOVED TO GENERAL

  // 5. Budget
  defs.push({
    headerName: 'Budget',
    headerClass: 'header-group-budget',
    openByDefault: true,
    children: [
      {
        headerName: 'Baseline',
        field: 'baselineBudget',
        width: 130,
        type: 'numericColumn',
        valueFormatter: currencyFormatter,
        editable: false,
        cellClass: 'bg-slate-100 dark:bg-slate-800 font-medium',
        aggFunc: 'sum',
      },
      {
        headerName: 'Budget Changes',
        field: 'budgetChanges',
        width: 130,
        type: 'numericColumn',
        valueFormatter: currencyFormatter,
        cellClass: 'bg-slate-100 dark:bg-slate-800',
        aggFunc: 'sum',
      },
      {
        headerName: 'Approved Budget',
        field: 'approvedBudget',
        width: 150,
        type: 'numericColumn',
        valueFormatter: currencyFormatter,
        cellClass: 'font-bold bg-slate-100 dark:bg-slate-800',
        aggFunc: 'sum',
      },
      {
        headerName: 'Appr Prev',
        field: 'approvedBudgetPrevious',
        width: 130,
        type: 'numericColumn',
        valueFormatter: currencyFormatter,
        cellClass: 'bg-slate-100 dark:bg-slate-800',
        aggFunc: 'sum',
      },
      {
        headerName: 'Mvmt',
        width: 130,
        type: 'numericColumn',
        valueGetter: (params: any) => {
          if (params.node?.group) return undefined;
          const current = params.data?.approvedBudget || 0;
          const previous = params.data?.approvedBudgetPrevious || 0;
          return current - previous;
        },
        cellRenderer: (params: any) => movementRenderer(params, 'budget'),
        cellClass: 'bg-slate-100 dark:bg-slate-800',
        aggFunc: 'sum',
      }
    ]
  });

  // 6. Actual Cost
  defs.push({
    headerName: 'Actual Cost',
    headerClass: 'header-group-actuals',
    openByDefault: true,
    children: [
      {
        headerName: 'This Period',
        field: 'actualCostThisPeriod',
        width: 130,
        type: 'numericColumn',
        valueFormatter: currencyFormatter,
        editable: false,
        cellClass: 'bg-slate-100 dark:bg-slate-800',
        aggFunc: 'sum',
      },
      {
        headerName: 'To Date',
        field: 'actualCostToDate',
        width: 130,
        type: 'numericColumn',
        valueFormatter: currencyFormatter,
        editable: false,
        cellClass: 'bg-slate-100 dark:bg-slate-800',
        aggFunc: 'sum',
      }
    ]
  });

  // 7. ETC & EAC
  defs.push({
    headerName: 'ETC & EAC',
    headerClass: 'header-group-eac',
    openByDefault: true,
    children: [
      {
        headerName: 'ETC',
        field: 'estimateToComplete',
        width: 130,
        type: 'numericColumn',
        valueFormatter: currencyFormatter,
        cellClass: 'bg-slate-100 dark:bg-slate-800',
        aggFunc: 'sum',
      },
      {
        headerName: 'EAC',
        field: 'estimateAtCompletion',
        width: 130,
        type: 'numericColumn',
        valueFormatter: currencyFormatter,
        editable: (params) => params.data?.eacMethod === 'Manual',
        cellClass: (params) => cn(
          "font-bold",
          params.data?.eacMethod === 'Manual' ? "bg-white dark:bg-slate-900" : "bg-slate-100 dark:bg-slate-800"
        ),
        aggFunc: 'sum',
      },
      {
        headerName: 'EAC Prev',
        field: 'estimateAtCompletionPrevious',
        width: 130,
        type: 'numericColumn',
        valueFormatter: currencyFormatter,
        cellClass: 'bg-slate-100 dark:bg-slate-800',
        aggFunc: 'sum',
      },
      {
        headerName: 'Mvmt',
        width: 130,
        type: 'numericColumn',
        valueGetter: (params: any) => {
          if (params.node?.group) return undefined;
          const current = params.data?.estimateAtCompletion || 0;
          const previous = params.data?.estimateAtCompletionPrevious || 0;
          return current - previous;
        },
        cellRenderer: (params: any) => movementRenderer(params, 'eac'),
        cellClass: 'bg-slate-100 dark:bg-slate-800',
        aggFunc: 'sum',
      }
    ]
  });

  // 8. Risk Management
  defs.push({
    headerName: 'Risk Management',
    headerClass: 'header-group-risk',
    openByDefault: true,
    children: [
      {
        headerName: 'Initial EMV Exposure',
        width: 130,
        type: 'numericColumn',
        valueGetter: (params: any) => {
          if (params.node?.group) return undefined;
          const cc = params.data;
          if (!cc) return 0;
          // The link is the risk records cost code. In our system, costCodeId in record matches cc.id or cc.code
          return riskExposureByCostCode[cc.id]?.initialEMV || riskExposureByCostCode[cc.code]?.initialEMV || 0;
        },
        valueFormatter: currencyFormatter,
        cellClass: 'bg-slate-100 dark:bg-slate-800',
        aggFunc: 'sum',
      },
      {
        headerName: 'Mitigation Cost',
        width: 130,
        type: 'numericColumn',
        valueGetter: (params: any) => {
          if (params.node?.group) return undefined;
          const cc = params.data;
          if (!cc) return 0;
          return riskExposureByCostCode[cc.id]?.mitigationCost || riskExposureByCostCode[cc.code]?.mitigationCost || 0;
        },
        valueFormatter: currencyFormatter,
        cellClass: 'bg-slate-100 dark:bg-slate-800',
        aggFunc: 'sum',
      },
      {
        headerName: 'Residual Exposure',
        width: 130,
        type: 'numericColumn',
        valueGetter: (params: any) => {
          if (params.node?.group) return undefined;
          const cc = params.data;
          if (!cc) return 0;
          return riskExposureByCostCode[cc.id]?.residualEMV || riskExposureByCostCode[cc.code]?.residualEMV || 0;
        },
        valueFormatter: currencyFormatter,
        cellClass: 'bg-slate-100 dark:bg-slate-800 font-bold',
        aggFunc: 'sum',
      }
    ]
  });

  // 8. Cost Variance
  defs.push({
    headerName: 'Cost Variance',
    headerClass: 'header-group-variance',
    openByDefault: true,
    children: [
      {
        headerName: 'Cost Variance',
        width: 130,
        type: 'numericColumn',
        valueGetter: (params: any) => {
          if (params.node?.group) return undefined;
          const budget = params.data?.approvedBudget || 0;
          const eac = params.data?.estimateAtCompletion || 0;
          return budget - eac;
        },
        valueFormatter: currencyFormatter,
        cellClass: 'bg-slate-100 dark:bg-slate-800',
        cellClassRules: {
          'text-red-600 font-bold': (params: any) => params.value < 0,
          'text-emerald-600 font-bold': (params: any) => params.value > 0,
        },
        aggFunc: 'sum',
      },
      {
        headerName: 'Var Prev',
        width: 130,
        type: 'numericColumn',
        valueGetter: (params: any) => {
          if (params.node?.group) return undefined;
          const budgetPrev = params.data?.approvedBudgetPrevious || 0;
          const eacPrev = params.data?.estimateAtCompletionPrevious || 0;
          return budgetPrev - eacPrev;
        },
        valueFormatter: currencyFormatter,
        cellClass: 'bg-slate-100 dark:bg-slate-800',
        aggFunc: 'sum',
      },
      {
        headerName: 'Var Mvmt',
        width: 130,
        type: 'numericColumn',
        valueGetter: (params: any) => {
          if (params.node?.group) return undefined;
          const budget = params.data?.approvedBudget || 0;
          const eac = params.data?.estimateAtCompletion || 0;
          const budgetPrev = params.data?.approvedBudgetPrevious || 0;
          const eacPrev = params.data?.estimateAtCompletionPrevious || 0;
          return (budget - eac) - (budgetPrev - eacPrev);
        },
        cellRenderer: (params: any) => movementRenderer(params, 'variance'),
        cellClass: 'bg-slate-100 dark:bg-slate-800',
        aggFunc: 'sum',
      }
    ]
  });

  // 9. Actions
  defs.push({
    headerName: 'Actions',
    width: 160,
    pinned: 'right',
    cellRenderer: 'actionsRenderer',
    cellClass: 'overflow-visible',
    suppressNavigable: true,
  });

  return defs;
}

// ─────────────────────────────────────────────────────────────────────────────
// Subcontract breakdown column definitions (inline JSX)
// ─────────────────────────────────────────────────────────────────────────────

export interface SubcontractBreakdownColumnDepsType {
  currencyFormatter: (params: ValueFormatterParams) => string;
}

export function buildSubcontractBreakdownColumnDefs(deps: SubcontractBreakdownColumnDepsType): ColDef[] {
  const { currencyFormatter } = deps;

  return [
    { field: 'subcontractId', headerName: 'Subcontract ID', width: 140, pinned: 'left', cellStyle: { fontWeight: 'bold' } },
    { field: 'subcontractName', headerName: 'Subcontract Name', width: 200 },
    { field: 'vendorName', headerName: 'Vendor', width: 180 },
    { field: 'itemNo', headerName: 'Item No', width: 100 },
    {
      field: 'description',
      headerName: 'Description',
      width: 250,
      cellRenderer: (params: any) => {
        if (params.node.rowPinned === 'bottom') {
          return <span className="text-green-600 font-bold">SubTotal</span>;
        }
        return params.value;
      }
    },
    { field: 'qty', headerName: 'Qty', width: 100, type: 'numericColumn' },
    { field: 'unit', headerName: 'Unit', width: 80 },
    { field: 'rate', headerName: 'Rate', width: 120, type: 'numericColumn', valueFormatter: currencyFormatter },
    { field: 'total', headerName: 'Total', width: 140, type: 'numericColumn', valueFormatter: currencyFormatter, cellClass: 'font-bold' },
    { field: 'status', headerName: 'Status', width: 120 },
    { field: 'type', headerName: 'Type', width: 120 }
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// Changes grid column definitions (inline JSX)
// ─────────────────────────────────────────────────────────────────────────────

export interface ChangesColumnDepsType {
  formatCurrency: (value: number) => string;
}

export function buildChangesColumnDefs(deps: ChangesColumnDepsType): ColDef[] {
  const { formatCurrency: fc } = deps;

  return [
    {
      headerName: 'Change ID',
      field: 'changeIdStr',
      width: 150,
      cellStyle: { fontWeight: 'bold' },
      pinned: 'left'
    },
    {
      headerName: 'Status',
      field: 'changeStatus',
      width: 120,
      cellClassRules: {
        'text-emerald-600 font-bold': (p: any) => p.value === 'Approved',
        'text-amber-600 font-bold': (p: any) => p.value === 'Pending',
        'text-red-600 font-bold': (p: any) => p.value === 'Rejected',
        'text-gray-500 font-bold': (p: any) => p.value === 'Withdrawn',
      }
    },
    {
      headerName: 'Type',
      field: 'changeType',
      width: 120
    },
    {
      headerName: 'Change Description',
      field: 'changeDescription',
      width: 250
    },
    {
      headerName: 'Scope',
      field: 'scope',
      width: 200
    },
    {
      headerName: 'Budget Amount',
      field: 'budgetAmount',
      width: 150,
      type: 'numericColumn',
      valueFormatter: (p: any) => fc(p.value),
      cellStyle: { fontWeight: 'bold' }
    },
    {
      headerName: 'EAC Amount',
      field: 'eacAmount',
      width: 150,
      type: 'numericColumn',
      valueFormatter: (p: any) => fc(p.value),
      cellStyle: { fontWeight: 'bold' }
    }
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// Movement cell renderer helper (used in main column defs)
// ─────────────────────────────────────────────────────────────────────────────

export function buildMovementRenderer(
  fc: (value: number) => string
): (params: any, type: 'budget' | 'eac' | 'variance') => React.ReactNode {
  return (params: any, type: 'budget' | 'eac' | 'variance') => {
    if (params.value == null || params.value === 0) return fc(params.value || 0);
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
        <span>{fc(params.value)}</span>
      </div>
    );
  };
}
