import React from 'react';
import { ColDef, ColGroupDef } from 'ag-grid-community';
import { Project, Enterprise, CostCode } from '../../types';
import { Trash2 } from 'lucide-react';
import { formatCurrency } from '../../lib/utils';

export interface BaselineColumnDeps {
  project: Project;
  enterprise: Enterprise;
  costCodes: CostCode[];
  isProjectAdmin: boolean;
  handleDeleteRecord: (id: string, costCodeId: string) => Promise<void>;
}

export function buildBaselineColumnDefs(deps: BaselineColumnDeps): (ColDef | ColGroupDef)[] {
  const { project, enterprise, costCodes, isProjectAdmin, handleDeleteRecord } = deps;
    const periods = project.reportingPeriods?.periods || [];
    const enterpriseAttrs = (enterprise.lineItemAttributes || []).filter(a => a.title);
    const projectAttrs = (project.lineItemAttributes || []).filter(a => a.title);

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
            headerName: 'Amount',
            field: 'amount',
            width: 120,
            type: 'numericColumn',
            editable: isProjectAdmin,
            valueFormatter: (params) => formatCurrency(params.value),
            aggFunc: 'sum',
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
              onClick={() => handleDeleteRecord(params.data.id, params.data.costCodeId)}
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
