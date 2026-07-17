import React from 'react';
import { ArrowUp, ArrowDown, ArrowUpRight, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Enterprise, Project } from '../../types';

export interface ProjectColumnDeps {
  isEnterpriseAdmin: boolean;
  userId: string;
  enterprise: Enterprise | null;
  costAggregations: Record<string, {
    baselineBudget: number;
    budgetChanges: number;
    approvedBudget: number;
    actualCost: number;
    etc: number;
    eac: number;
  }>;
  onSelectProject: (project: Project) => void;
  onDeleteProject: (project: Project) => void;
}

export function buildProjectColumnDefs(deps: ProjectColumnDeps): any[] {
  const { isEnterpriseAdmin, userId, enterprise, costAggregations, onSelectProject, onDeleteProject } = deps;

  const canEdit = (data: any) => {
    if (!data) return false;
    return isEnterpriseAdmin || (data.users && data.users[userId] === 'Project Admin');
  };

  const baseColumns = [
    {
      headerName: '',
      width: 50,
      checkboxSelection: (params: any) => {
        if (params.node?.rowPinned) return false;
        return canEdit(params.data);
      },
      headerCheckboxSelection: true,
      headerCheckboxSelectionFilteredOnly: true,
      pinned: 'left',
      lockPosition: 'left',
      suppressMenu: true,
      suppressMovable: true,
      suppressColumnsToolPanel: true,
      headerClass: 'bg-gray-50 dark:bg-[#1a1a1a]',
      cellClass: 'bg-white dark:bg-[#141414]'
    },
    {
      headerName: 'Project ID',
      field: 'projectCode',
      width: 150,
      pinned: 'left',
      editable: false,
      cellClass: 'bg-[#f3f4f6] dark:bg-gray-800',
      cellRenderer: (params: any) => {
        return (
          <span
            data-testid="project-code-link"
            className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer font-mono uppercase text-xs font-bold"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (params.data) onSelectProject(params.data);
            }}
          >
            {params.value}
          </span>
        );
      }
    },
    {
      headerName: 'Project Name',
      field: 'projectName',
      flex: 1,
      minWidth: 200,
      pinned: 'left',
      editable: (params: any) => canEdit(params.data),
      cellStyle: { fontWeight: 'bold' }
    }
  ];

  const validAttributes = (enterprise?.projectAttributes || []).filter(attr => attr.title && attr.title.trim() !== '');

  const attributeColumns = validAttributes.length > 0 ? [{
    headerName: 'Enterprise Project Attributes',
    groupId: 'enterpriseProjectAttributes',
    openByDefault: true,
    children: validAttributes.map((attr, index) => ({
      headerName: attr.title,
      field: `attributes.${attr.id}`,
      width: 200,
      editable: (params: any) => canEdit(params.data),
      columnGroupShow: index === 0 ? undefined : 'open',
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: {
        values: (attr.values || []).map(v => v.id),
        valueListFormatter: (params: any) => {
          const val = attr.values?.find((v: any) => v.id === params.value);
          return val ? `${val.id} | ${val.description}` : params.value;
        }
      },
      valueFormatter: (params: any) => {
        if (!params.value) return '';
        const val = attr.values?.find(v => v.id === params.value);
        return val ? `${val.id} | ${val.description}` : params.value;
      },
      valueGetter: (params: any) => params.data.attributes?.[attr.id] || '',
      valueSetter: (params: any) => {
        const newAttrs = { ...(params.data.attributes || {}), [attr.id]: params.newValue };
        params.data.attributes = newAttrs;
        return true;
      }
    }))
  }] : [];

  const metaDateColumns = [
    {
      headerName: 'Created Date',
      field: 'dateCreated',
      width: 150,
      editable: false,
      valueFormatter: (params: any) => params.value ? new Date(params.value).toLocaleDateString() : ''
    },
    {
      headerName: 'Modified Date',
      field: 'dateLastModified',
      width: 150,
      editable: false,
      valueFormatter: (params: any) => params.value ? new Date(params.value).toLocaleDateString() : ''
    }
  ];

  const costColumns = [{
    headerName: 'Cost Management Module',
    groupId: 'costManagementGroup',
    openByDefault: true,
    children: [
      {
        headerName: 'First Reporting Month',
        field: 'firstCostReportingMonth',
        width: 210,
        editable: false,
        columnGroupShow: undefined,
        valueGetter: (params: any) => {
          const periods = params.data.reportingPeriods?.periods;
          return periods && periods.length > 0 ? periods[0].endDate : '';
        }
      },
      {
        headerName: 'Current Reporting Month',
        field: 'currentReportingMonth',
        width: 210,
        editable: false,
        columnGroupShow: 'open',
        valueGetter: (params: any) => {
          const cpId = params.data.reportingPeriods?.currentPeriodId;
          const periods = params.data.reportingPeriods?.periods;
          return (periods && cpId) ? periods.find((p: any) => p.id === cpId)?.endDate || '' : '';
        }
      },
      {
        headerName: 'Last Reporting Month',
        field: 'lastReportingMonth',
        width: 210,
        editable: false,
        columnGroupShow: 'open',
        valueGetter: (params: any) => {
          const periods = params.data.reportingPeriods?.periods;
          return periods && periods.length > 0 ? periods[periods.length - 1].endDate : '';
        }
      },
      {
        headerName: 'Baseline Budget',
        colId: 'baselineBudget',
        width: 150,
        editable: false,
        columnGroupShow: 'open',
        type: 'numericColumn',
        valueGetter: (params: any) => params.node?.rowPinned ? params.data.baselineBudget : (costAggregations[params.data.id]?.baselineBudget || 0),
        valueFormatter: (params: any) => `$${(params.value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      },
      {
        headerName: 'Budget Changes',
        colId: 'budgetChanges',
        width: 150,
        editable: false,
        columnGroupShow: 'open',
        type: 'numericColumn',
        valueGetter: (params: any) => params.node?.rowPinned ? params.data.budgetChanges : (costAggregations[params.data.id]?.budgetChanges || 0),
        valueFormatter: (params: any) => `$${(params.value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      },
      {
        headerName: 'Approved Budget',
        colId: 'approvedBudget',
        width: 150,
        editable: false,
        columnGroupShow: 'open',
        type: 'numericColumn',
        valueGetter: (params: any) => params.node?.rowPinned ? params.data.approvedBudget : (costAggregations[params.data.id]?.approvedBudget || 0),
        valueFormatter: (params: any) => `$${(params.value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      },
      {
        headerName: 'Actual Cost to Date',
        colId: 'actualCost',
        width: 160,
        editable: false,
        columnGroupShow: 'open',
        type: 'numericColumn',
        valueGetter: (params: any) => params.node?.rowPinned ? params.data.actualCost : (costAggregations[params.data.id]?.actualCost || 0),
        valueFormatter: (params: any) => `$${(params.value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      },
      {
        headerName: 'ETC',
        colId: 'etc',
        width: 150,
        editable: false,
        columnGroupShow: 'open',
        type: 'numericColumn',
        valueGetter: (params: any) => params.node?.rowPinned ? params.data.etc : (costAggregations[params.data.id]?.etc || 0),
        valueFormatter: (params: any) => `$${(params.value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      },
      {
        headerName: 'EAC',
        colId: 'eac',
        width: 150,
        editable: false,
        columnGroupShow: 'open',
        type: 'numericColumn',
        valueGetter: (params: any) => params.node?.rowPinned ? params.data.eac : (costAggregations[params.data.id]?.eac || 0),
        valueFormatter: (params: any) => `$${(params.value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      },
      {
        headerName: 'Cost Variance',
        colId: 'costVariance',
        width: 150,
        editable: false,
        columnGroupShow: 'open',
        type: 'numericColumn',
        valueGetter: (params: any) => {
          const approved = params.node?.rowPinned ? params.data.approvedBudget : (costAggregations[params.data.id]?.approvedBudget || 0);
          const eac = params.node?.rowPinned ? params.data.eac : (costAggregations[params.data.id]?.eac || 0);
          return approved - eac;
        },
        cellRenderer: (params: any) => {
          if (params.value == null || params.value === 0) {
            return `$${(params.value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
          }
          const isPositive = params.value > 0;
          const colorClass = isPositive ? 'text-emerald-600' : 'text-red-600';
          return (
            <div className={`flex items-center gap-1 font-medium justify-end h-full ${colorClass}`}>
              {isPositive ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
              <span>${Math.abs(params.value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          );
        }
      }
    ]
  }];

  const actionColumn = [{
    headerName: '',
    width: 120,
    pinned: 'right',
    editable: false,
    cellRenderer: (params: any) => {
      const ableToEdit = canEdit(params.data);
      return (
        <div className="flex justify-end items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              onSelectProject(params.data);
            }}
            className="w-8 h-8 text-gray-500 hover:text-blue-600"
            title="Open Project"
          >
            <ArrowUpRight className="w-4 h-4" />
          </Button>
          {ableToEdit && (
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteProject(params.data);
              }}
              className="w-8 h-8 text-gray-500 hover:text-red-600"
              title="Delete Project"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      );
    }
  }];

  return [...baseColumns, ...attributeColumns, ...metaDateColumns, ...costColumns, ...actionColumn];
}
