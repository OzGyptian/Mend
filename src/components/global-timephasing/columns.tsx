import { ColDef, ColGroupDef, ValueFormatterParams } from 'ag-grid-community';
import { ScheduleItem } from '../../types';

export interface ColumnDepsProps {
  periods: Array<{ id: string; endDate: string; name?: string }>;
  currentPeriodId: string | undefined;
  currencyFormatter: (params: ValueFormatterParams) => string;
  dateFormatter: (params: any) => string;
  safeDateSetter: (field: string) => (params: any) => boolean;
  scheduleItems: ScheduleItem[];
  theme: 'light' | 'dark';
}

export function buildColumnDefs(deps: ColumnDepsProps): (ColDef | ColGroupDef)[] {
  const {
    periods,
    currentPeriodId,
    currencyFormatter,
    dateFormatter,
    safeDateSetter,
    scheduleItems,
    theme,
  } = deps;

  const currentPeriodIndex = periods.findIndex(p => p.id === currentPeriodId);

  return [
    {
      headerName: 'Cost Code',
      field: 'costCode',
      sort: 'asc',
      width: 150,
      pinned: 'left',
      lockPosition: 'left',
      suppressMovable: true,
      rowSpan: (params) => {
        if (params.data.rowType === 'baseline') return 3;
        return 1;
      },
      cellStyle: (params) => {
        if (params.data.rowType === 'baseline') {
          return {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            fontWeight: 'bold',
            backgroundColor: theme === 'dark' ? '#1a1a1a' : '#f8fafc',
            borderBottom: theme === 'dark' ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e2e8f0',
          };
        }
        return {};
      },
      cellClassRules: {
        'hidden': (params) => params.data.rowType !== 'baseline'
      },
      valueGetter: (params) => `${params.data.costCode} - ${params.data.costCodeName}`,
      tooltipValueGetter: (params) => params.value,
    },
    {
      headerName: 'Type',
      field: 'type',
      width: 180,
      pinned: 'left',
      lockPosition: 'left',
      suppressMovable: true,
      checkboxSelection: true,
      headerCheckboxSelection: true,
      headerCheckboxSelectionFilteredOnly: true,
      cellClass: 'font-bold bg-slate-50 dark:bg-slate-900',
    },
    {
      headerName: 'Activity ID',
      field: 'activityId',
      width: 150,
      editable: (params: any) => params.data.phasingSource === 'Auto',
      cellEditor: 'agRichSelectCellEditor',
      cellEditorParams: {
        values: scheduleItems.map(item => item.activityId).sort(),
        formatValue: (val: string) => {
          const item = scheduleItems.find(i => i.activityId === val);
          return item ? `${item.activityId} - ${item.description}` : val;
        },
        searchType: 'match',
        allowTyping: true,
        filterList: true,
        highlightMatch: true
      },
      cellClass: (params: any) => params.data.phasingSource === 'Auto' ? 'bg-white dark:bg-slate-900 border-l-2 border-l-emerald-500' : 'bg-slate-50 dark:bg-slate-900/50',
    },
    {
      headerName: 'Phasing Source',
      field: 'phasingSource',
      width: 130,
      editable: true,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: (params: any) => {
        if (params.data.rowType === 'eac') {
          return { values: ['ETC Details', 'SubContract', 'Manual', 'Auto'] };
        }
        return { values: ['Manual', 'Auto'] };
      },
      cellClass: 'bg-white dark:bg-slate-900',
    },
    {
      headerName: 'Start Date',
      field: 'startDate',
      width: 120,
      editable: (params: any) => params.data.phasingSource === 'Auto' && !params.data.activityId,
      valueGetter: (params) => {
        const val = params.data.startDate;
        if (!val) return null;
        const d = val instanceof Date ? val : new Date(val);
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
      editable: (params: any) => params.data.phasingSource === 'Auto' && !params.data.activityId,
      valueGetter: (params) => {
        const val = params.data.endDate;
        if (!val) return null;
        const d = val instanceof Date ? val : new Date(val);
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
            if (params.data.rowType === 'baseline' || params.data.rowType === 'approved') {
              return params.data.phasingSource === 'Manual';
            }
            if (params.data.rowType === 'eac') {
              return params.data.phasingSource === 'Manual' && periodIndex > currentPeriodIndex;
            }
            return false;
          },
          cellClass: (params: any) => {
            const isEditable = (params.data.rowType === 'baseline' || params.data.rowType === 'approved')
              ? params.data.phasingSource === 'Manual'
              : params.data.phasingSource === 'Manual' && periodIndex > currentPeriodIndex;
            return isEditable ? 'bg-white dark:bg-slate-900' : 'bg-slate-50 dark:bg-slate-900/50 text-gray-500';
          },
          valueGetter: (params: any) => params.data.periodValues?.[p.id] || 0,
          valueSetter: (params: any) => {
            const val = Number(params.newValue);
            if (isNaN(val)) return false;
            params.data.periodValues = { ...params.data.periodValues, [p.id]: val };
            return true;
          }
        };
      })
    }
  ];
}
