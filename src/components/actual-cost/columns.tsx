import React from 'react';
import { ColDef, ColGroupDef } from 'ag-grid-community';
import { Trash2 } from 'lucide-react';
import { CostCode, Enterprise, Project } from '../../types';
import { formatCurrency } from '../../lib/utils';

export interface ActualCostColumnDeps {
  costCodes: CostCode[];
  reportingPeriods: Project['reportingPeriods'];
  enterpriseLineItemAttributes: Enterprise['lineItemAttributes'];
  projectLineItemAttributes: Project['lineItemAttributes'];
  isProjectAdmin: boolean | null | undefined;
  onDeleteRecord: (id: string, costCodeId: string) => void;
}

export function buildActualCostColumnDefs(deps: ActualCostColumnDeps): (ColDef | ColGroupDef)[] {
  const {
    costCodes,
    reportingPeriods,
    enterpriseLineItemAttributes,
    projectLineItemAttributes,
    isProjectAdmin,
    onDeleteRecord,
  } = deps;

  const periods = reportingPeriods?.periods || [];
  const currentPeriodId = reportingPeriods?.currentPeriodId;
  const currentPeriodIndex = periods.findIndex(p => p.id === currentPeriodId);
  const allowedPeriods = periods.slice(0, currentPeriodIndex + 1);

  const enterpriseAttrs = (enterpriseLineItemAttributes || []).filter(a => a.title);
  const projectAttrs = (projectLineItemAttributes || []).filter(a => a.title);

  const defs: (ColDef | ColGroupDef)[] = [
    {
      headerName: 'Core Information',
      children: [
        {
          headerName: 'Cost Code ID',
          field: 'costCodeId',
          sort: 'asc',
          width: 180,
          checkboxSelection: true,
          headerCheckboxSelection: true,
          headerCheckboxSelectionFilteredOnly: true,
          editable: isProjectAdmin,
          cellEditor: 'agRichSelectCellEditor',
          cellEditorParams: {
            values: ['', ...costCodes.map(c => c.id)],
            formatValue: (id: string) => {
              if (!id) return '';
              const cc = costCodes.find(c => c.id === id);
              return cc ? `${cc.code} - ${cc.name}` : id;
            },
            searchType: 'match',
            allowTyping: true,
            filterList: true
          },
          valueFormatter: (params) => {
            if (!params.value) return '';
            return costCodes.find(c => c.id === params.value)?.code || params.value;
          },
          filter: 'agSetColumnFilter',
        },
        {
          headerName: 'Item',
          field: 'item',
          width: 150,
          editable: isProjectAdmin,
          filter: 'agTextColumnFilter',
        },
        {
          headerName: 'Description',
          field: 'description',
          width: 250,
          editable: isProjectAdmin,
          filter: 'agTextColumnFilter',
        },
        {
          headerName: 'Source',
          field: 'source',
          width: 100,
          editable: isProjectAdmin,
          cellEditor: 'agSelectCellEditor',
          cellEditorParams: {
            values: ['MAN', 'ACC', 'FIN', 'REV'],
          },
          filter: 'agSetColumnFilter',
        },
        {
          headerName: 'Cost',
          field: 'cost',
          width: 120,
          type: 'numericColumn',
          editable: isProjectAdmin,
          valueFormatter: (params) => formatCurrency(params.value),
          aggFunc: 'sum',
        },
        {
          headerName: 'Reporting Period',
          field: 'reportingPeriodId',
          width: 180,
          editable: isProjectAdmin,
          cellEditor: 'agSelectCellEditor',
          cellEditorParams: {
            values: allowedPeriods.map(p => p.id),
          },
          valueFormatter: (params) => {
            const index = periods.findIndex(p => p.id === params.value);
            return index !== -1 ? (index + 1).toString() : '';
          },
          filter: 'agSetColumnFilter',
          filterParams: {
            valueFormatter: (params: any) => {
              const index = periods.findIndex(p => p.id === params.value);
              return index !== -1 ? (index + 1).toString() : params.value;
            }
          }
        },
      ]
    }
  ];

  if (enterpriseAttrs.length > 0) {
    defs.push({
      headerName: 'Enterprise Attributes',
      children: enterpriseAttrs.map(attr => ({
        headerName: attr.title,
        field: `enterpriseAttributes.${attr.id}`,
        width: 150,
        editable: isProjectAdmin,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: attr.values.map(v => v.id),
        },
        valueFormatter: (params: any) => {
          const v = attr.values.find(v => v.id === params.value);
          return v ? `${v.id} - ${v.description}` : params.value;
        },
        valueSetter: (params: any) => {
          if (!params.data.enterpriseAttributes) params.data.enterpriseAttributes = {};
          params.data.enterpriseAttributes[attr.id] = params.newValue;
          return true;
        }
      }))
    });
  }

  if (projectAttrs.length > 0) {
    defs.push({
      headerName: 'Project Attributes',
      children: projectAttrs.map(attr => ({
        headerName: attr.title,
        field: `projectAttributes.${attr.id}`,
        width: 150,
        editable: isProjectAdmin,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: attr.values.map(v => v.id),
        },
        valueFormatter: (params: any) => {
          const v = attr.values.find(v => v.id === params.value);
          return v ? `${v.id} - ${v.description}` : params.value;
        },
        valueSetter: (params: any) => {
          if (!params.data.projectAttributes) params.data.projectAttributes = {};
          params.data.projectAttributes[attr.id] = params.newValue;
          return true;
        }
      }))
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
            onClick={() => onDeleteRecord(params.data.id, params.data.costCodeId)}
            className="p-1 hover:bg-red-50 text-gray-400 hover:text-red-600 rounded transition-colors"
            disabled={!isProjectAdmin}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      );
    }
  });

  return defs;
}
