import React from 'react';
import { ColDef, ColGroupDef } from 'ag-grid-community';
import { Project, Enterprise, CostCode, Calendar as ProjectCalendar, ScheduleItem } from '../../types';
import { ProjectAttribute } from '../../domain/types';
import { cn, formatNumber } from '../../lib/utils';
import { Trash2 } from 'lucide-react';

export const DEFAULT_ETC_CATEGORIES = ['Labour', 'Plant', 'Material', 'Subcontractor', 'Sundries', 'Staff'];

export interface EtcColumnDeps {
  project: Project;
  enterprise: Enterprise;
  calendars: ProjectCalendar[];
  enterpriseLineItemAttrs: ProjectAttribute[];
  projectLineItemAttrs: ProjectAttribute[];
  costCodes: CostCode[];
  scheduleItems: ScheduleItem[];
  theme?: string;
  handleUpdateEtcRow: (rowId: string, data: any) => Promise<void>;
  handleDeleteEtcRow: (rowId: string) => Promise<void>;
}

export function buildEtcColumnDefs(deps: EtcColumnDeps): (ColDef | ColGroupDef)[] {
  const { project, enterprise, calendars, enterpriseLineItemAttrs, projectLineItemAttrs, costCodes, scheduleItems, theme = 'light', handleUpdateEtcRow, handleDeleteEtcRow } = deps;
  const DEFAULT_CATEGORIES = DEFAULT_ETC_CATEGORIES;

    const allPeriods = project.reportingPeriods?.periods || [];
    const currentPeriodId = project.reportingPeriods?.currentPeriodId;
    const currentIndex = allPeriods.findIndex(p => p.id === currentPeriodId);
    const periods = allPeriods.slice(currentIndex + 1);

    const defs: (ColDef | ColGroupDef)[] = [
      {
        headerName: 'Item Details',
        pinned: 'left',
        openByDefault: true,
        children: [
          {
            headerName: 'Cost Code ID',
            field: 'costCode',
            width: 150,
            pinned: 'left',
            editable: true,
            cellEditor: 'agRichSelectCellEditor',
            cellEditorParams: {
              values: ['', ...costCodes.map(c => c.code)],
              searchType: 'match',
              allowTyping: true,
              filterList: true
            },
            cellClass: (params) => cn(
              'font-bold',
              params.node.rowPinned === 'bottom' ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-blue-50/50 dark:bg-blue-900/10'
            )
          },
          { 
            field: 'item', 
            headerName: 'Item', 
            width: 150, 
            checkboxSelection: true, 
            headerCheckboxSelection: true,
            headerCheckboxSelectionFilteredOnly: true,
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
            field: 'description', 
            headerName: 'Description', 
            width: 250, 
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
            field: 'category', 
            headerName: 'Resource Category', 
            width: 150, 
            editable: (params) => !params.data.isEnterpriseResource && params.data.source !== 'PROJECT',
            cellEditor: 'agSelectCellEditor',
            cellEditorParams: {
              values: (enterprise.categories && enterprise.categories.length > 0) ? enterprise.categories : DEFAULT_ETC_CATEGORIES
            },
            cellStyle: (params: any) => {
              const isReadOnly = params.data?.isEnterpriseResource || params.data?.source === 'PROJECT';
              return {
                backgroundColor: isReadOnly ? (theme === 'dark' ? '#1e293b' : '#f3f4f6') : (theme === 'dark' ? '#0f172a' : 'white'),
                fontWeight: isReadOnly ? 'bold' : 'normal',
                color: theme === 'dark' ? 'white' : 'black'
              };
            }
          }
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
            if (!params.data) return 0;
            const periodValues = (params.data.periodValues || {}) as Record<string, number>;
            const total = periods.reduce((acc: number, p: any) => acc + (periodValues[p.id] || 0), 0);
            return Math.round(total * 100) / 100;
          },
          valueFormatter: (params) => formatNumber(params.value, 2),
          cellStyle: (params) => {
            return { 
              backgroundColor: params.node?.rowPinned === 'bottom' ? '#fef3c7' : '#f3f4f6', 
              fontWeight: 'bold', 
              color: 'black' 
            };
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
          valueFormatter: (params) => formatNumber(params.value, 2),
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
            if (params.node?.group) return undefined;
            if (params.node?.rowPinned === 'bottom') return params.data.totalEtc;
            const periodValues = (params.data.periodValues || {}) as Record<string, number>;
            const qty = periods.reduce((acc: number, p: any) => acc + (periodValues[p.id] || 0), 0);
            return qty * (params.data.rate || 0);
          },
          valueFormatter: (params) => formatNumber(params.value, 2),
          cellStyle: (params) => {
            return { 
              backgroundColor: params.node?.rowPinned === 'bottom' ? '#fef3c7' : '#f3f4f6', 
              fontWeight: 'bold', 
              color: 'black' 
            };
          }
        },
        { 
          headerName: 'Total ETC Previous', 
          width: 140, 
          type: 'numericColumn',
          aggFunc: 'sum',
          editable: false,
          valueGetter: (params) => {
            if (params.node?.group) return undefined;
            if (params.node?.rowPinned === 'bottom') return params.data.totalEtcPrevious;
            return params.data.totalEtcPrevious || 0;
          },
          valueFormatter: (params) => formatNumber(params.value, 2),
          cellStyle: (params) => ({
            backgroundColor: params.node?.rowPinned === 'bottom' ? '#fef3c7' : '#f3f4f6',
            fontWeight: 'bold',
            color: 'black'
          })
        },
        { 
          headerName: 'ETC Mvmt', 
          width: 120, 
          type: 'numericColumn',
          aggFunc: 'sum',
          editable: false,
          valueGetter: (params) => {
            if (params.node?.group) return undefined;
            if (params.node?.rowPinned === 'bottom') return params.data.etcMvmt;
            
            const periodValues = (params.data.periodValues || {}) as Record<string, number>;
            const qty = periods.reduce((acc: number, p: any) => acc + (periodValues[p.id] || 0), 0);
            const totalEtc = qty * (params.data.rate || 0);
            const previous = params.data.totalEtcPrevious || 0;
            return totalEtc - previous;
          },
          valueFormatter: (params) => formatNumber(params.value, 2),
          cellStyle: (params) => {
            const isPinned = params.node?.rowPinned === 'bottom';
            const val = params.value || 0;
            return {
              backgroundColor: isPinned ? '#fef3c7' : '#f3f4f6',
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
          valueSetter: (params) => {
            if (!params.newValue) {
              params.data.phasingStartDate = '';
              return true;
            }
            const val = params.newValue;
            if (val instanceof Date) {
              params.data.phasingStartDate = val.toISOString();
              return true;
            }
            params.data.phasingStartDate = val;
            return true;
          },
          valueFormatter: (params) => {
            if (!params.value) return '';
            const date = params.value instanceof Date ? params.value : new Date(params.value);
            if (isNaN(date.getTime())) return params.value;
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            return `${day}/${month}/${year}`;
          },
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
          valueSetter: (params) => {
            if (!params.newValue) {
              params.data.phasingEndDate = '';
              return true;
            }
            const val = params.newValue;
            if (val instanceof Date) {
              params.data.phasingEndDate = val.toISOString();
              return true;
            }
            params.data.phasingEndDate = val;
            return true;
          },
          valueFormatter: (params) => {
            if (!params.value) return '';
            const date = params.value instanceof Date ? params.value : new Date(params.value);
            if (isNaN(date.getTime())) return params.value;
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            return `${day}/${month}/${year}`;
          },
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
        children: periods.map((p, idx) => {
          const date = new Date(p.endDate);
          const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          const monthName = monthNames[date.getUTCMonth()];
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
            cellStyle: (params: any) => {
              const isPinned = params.node?.rowPinned === 'bottom';
              const isAuto = params.data?.phasingMethod === 'Auto-Phase';
              return {
                backgroundColor: isPinned ? '#fef3c7' : (isAuto ? '#f3f4f6' : 'white'),
                fontWeight: (isPinned || isAuto) ? 'bold' : 'normal',
                color: 'black'
              };
            },
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

    defs.push({
      headerName: 'Actions',
      width: 80,
      pinned: 'right',
      cellRenderer: (params: any) => {
        if (params.node.rowPinned) return null;
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
