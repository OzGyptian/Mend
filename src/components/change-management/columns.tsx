import React from 'react';
import { ColDef, ColGroupDef } from 'ag-grid-community';
import { Trash2 } from 'lucide-react';
import { formatCurrency } from '../../lib/utils';
import { Change, CostCode } from '../../types';

// ---------------------------------------------------------------------------
// Shared attribute type (mirrors the shape used by Enterprise / Project attrs)
// ---------------------------------------------------------------------------

interface AttributeValue {
  id: string;
  description: string;
}

interface Attribute {
  id: string;
  title: string;
  values: AttributeValue[];
}

// ---------------------------------------------------------------------------
// buildChangeColumnDefs
// ---------------------------------------------------------------------------

export interface ChangeColumnDeps {
  /** project.reportingPeriods?.periods */
  reportingPeriodsList: Array<{ id: string; name: string; startDate: string }>;
  enterpriseChangeAttrs: Attribute[];
  projectChangeAttrs: Attribute[];
  setSelectedChangeId: (id: string | null) => void;
  setChangeToDelete: (change: Change | null) => void;
  setIsDeleteChangeOpen: (open: boolean) => void;
}

export function buildChangeColumnDefs(deps: ChangeColumnDeps): (ColDef | ColGroupDef)[] {
  const {
    reportingPeriodsList,
    enterpriseChangeAttrs,
    projectChangeAttrs,
    setSelectedChangeId,
    setChangeToDelete,
    setIsDeleteChangeOpen,
  } = deps;

  const cols: (ColDef | ColGroupDef)[] = [
    {
      headerName: '',
      headerCheckboxSelection: true,
      checkboxSelection: true,
      headerCheckboxSelectionFilteredOnly: true,
      width: 50,
      pinned: 'left',
      sortable: false,
      filter: false
    },
    {
      headerName: 'Change ID',
      field: 'changeId',
      pinned: 'left',
      width: 150,
      sort: 'asc',
      cellRenderer: (params: any) => {
        if (params.node.rowPinned) return params.value;
        return (
          <button
            onClick={() => setSelectedChangeId(params.data.id)}
            className="text-blue-600 hover:text-blue-800 hover:underline font-bold text-left transition-colors"
          >
            {params.value}
          </button>
        );
      },
      enableRowGroup: true
    },
    {
      headerName: 'Period',
      field: 'periodId',
      editable: true,
      width: 150,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: {
        values: reportingPeriodsList.map(p => p.id)
      },
      valueFormatter: (p: any) => {
        const period = reportingPeriodsList.find(per => per.id === p.value);
        return period ? period.name : p.value;
      },
      enableRowGroup: true
    },
    {
      headerName: 'Description',
      field: 'description',
      editable: true,
      width: 300,
      enableRowGroup: true
    },
    {
      headerName: 'Status',
      field: 'status',
      editable: true,
      width: 150,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: {
        values: ['Approved', 'Pending', 'Rejected', 'Withdrawn']
      },
      cellClassRules: {
        'text-emerald-600 font-bold': (p: any) => p.value === 'Approved',
        'text-amber-600 font-bold': (p: any) => p.value === 'Pending',
        'text-red-600 font-bold': (p: any) => p.value === 'Rejected',
        'text-gray-500 font-bold': (p: any) => p.value === 'Withdrawn',
      },
      enableRowGroup: true
    },
    {
      headerName: 'Initiator',
      field: 'initiator',
      editable: true,
      width: 150,
      enableRowGroup: true
    },
    {
      headerName: 'Reference',
      field: 'reference',
      editable: true,
      width: 150,
      enableRowGroup: true
    },
    {
      headerName: 'Budget',
      field: 'budget',
      width: 150,
      valueFormatter: (p) => formatCurrency(p.value),
      type: 'numericColumn',
      cellStyle: { fontWeight: 'bold' },
      aggFunc: 'sum'
    },
    {
      headerName: 'EAC',
      field: 'eac',
      width: 150,
      valueFormatter: (p) => formatCurrency(p.value),
      type: 'numericColumn',
      cellStyle: { fontWeight: 'bold' },
      aggFunc: 'sum'
    },
  ];

  // Dynamically add enterprise change attributes (before Actions)
  if (enterpriseChangeAttrs.length > 0) {
    cols.push({
      headerName: 'Enterprise Change Attributes',
      openByDefault: true,
      children: enterpriseChangeAttrs.map((attr, index) => ({
        headerName: attr.title,
        field: `enterpriseAttributes.${attr.id}`,
        width: 200,
        columnGroupShow: index === 0 ? undefined : ('open' as const),
        editable: true,
        cellEditor: 'agRichSelectCellEditor',
        cellEditorParams: {
          values: (attr.values || [])
            .sort((a, b) => (a.id || '').localeCompare(b.id || ''))
            .map(v => `${v.id} | ${v.description}`),
          searchType: 'matchAny',
          allowTyping: true,
          filterList: true
        },
        enableRowGroup: true
      }))
    });
  }

  // Dynamically add project change attributes (before Actions)
  if (projectChangeAttrs.length > 0) {
    cols.push({
      headerName: 'Project Change Attributes',
      openByDefault: true,
      children: projectChangeAttrs.map((attr, index) => ({
        headerName: attr.title,
        field: `projectAttributes.${attr.id}`,
        width: 200,
        columnGroupShow: index === 0 ? undefined : ('open' as const),
        editable: true,
        cellEditor: 'agRichSelectCellEditor',
        cellEditorParams: {
          values: (attr.values || [])
            .sort((a, b) => (a.id || '').localeCompare(b.id || ''))
            .map(v => `${v.id} | ${v.description}`),
          searchType: 'matchAny',
          allowTyping: true,
          filterList: true
        },
        enableRowGroup: true
      }))
    });
  }

  // Actions column — always last
  cols.push({
    headerName: 'Actions',
    width: 100,
    pinned: 'right',
    cellRenderer: (p: any) => {
      if (p.node.rowPinned) return null;
      return (
        <div className="flex items-center gap-2 h-full">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setChangeToDelete(p.data);
              setIsDeleteChangeOpen(true);
            }}
            className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      );
    }
  });

  return cols;
}

// ---------------------------------------------------------------------------
// buildChangeRecordColumnDefs
// ---------------------------------------------------------------------------

export interface RecordColumnDeps {
  costCodes: CostCode[];
  enterpriseLineItemAttrs: Attribute[];
  projectLineItemAttrs: Attribute[];
  deleteChangeRecord: (id: string) => Promise<void>;
}

export function buildChangeRecordColumnDefs(deps: RecordColumnDeps): (ColDef | ColGroupDef)[] {
  const {
    costCodes,
    enterpriseLineItemAttrs,
    projectLineItemAttrs,
    deleteChangeRecord,
  } = deps;

  return [
    {
      headerName: '',
      headerCheckboxSelection: true,
      checkboxSelection: true,
      headerCheckboxSelectionFilteredOnly: true,
      width: 50,
      pinned: 'left',
      sortable: false,
      filter: false
    },
    {
      headerName: 'Cost Code',
      field: 'costCodeId',
      editable: true,
      width: 200,
      cellEditor: 'agRichSelectCellEditor',
      cellEditorParams: {
        values: costCodes.map(c => c.code),
        searchType: 'match',
        allowTyping: true,
        filterList: true
      },
      enableRowGroup: true
    },
    {
      headerName: 'Scope',
      field: 'scope',
      editable: true,
      width: 250,
      enableRowGroup: true
    },
    {
      headerName: 'Enterprise Line-Item Attributes',
      openByDefault: true,
      children: enterpriseLineItemAttrs.map((attr, index) => ({
        headerName: attr.title,
        field: `enterpriseAttributes.${attr.id}`,
        width: 200,
        columnGroupShow: index === 0 ? undefined : ('open' as const),
        editable: true,
        cellEditor: 'agRichSelectCellEditor',
        cellEditorParams: {
          values: (attr.values || [])
            .sort((a, b) => (a.id || '').localeCompare(b.id || ''))
            .map(v => `${v.id} | ${v.description}`),
          searchType: 'matchAny',
          allowTyping: true,
          filterList: true
        },
        enableRowGroup: true
      }))
    },
    {
      headerName: 'Project Line-Item Attributes',
      openByDefault: true,
      children: projectLineItemAttrs.map((attr, index) => ({
        headerName: attr.title,
        field: `projectAttributes.${attr.id}`,
        width: 200,
        columnGroupShow: index === 0 ? undefined : ('open' as const),
        editable: true,
        cellEditor: 'agRichSelectCellEditor',
        cellEditorParams: {
          values: (attr.values || [])
            .sort((a, b) => (a.id || '').localeCompare(b.id || ''))
            .map(v => `${v.id} | ${v.description}`),
          searchType: 'matchAny',
          allowTyping: true,
          filterList: true
        },
        enableRowGroup: true
      }))
    },
    {
      headerName: 'Budget Amount',
      field: 'budgetAmount',
      editable: true,
      width: 150,
      type: 'numericColumn',
      valueFormatter: (p) => formatCurrency(p.value),
      cellEditor: 'agNumberCellEditor',
      aggFunc: 'sum'
    },
    {
      headerName: 'EAC Amount',
      field: 'eacAmount',
      editable: true,
      width: 150,
      type: 'numericColumn',
      valueFormatter: (p) => formatCurrency(p.value),
      cellEditor: 'agNumberCellEditor',
      aggFunc: 'sum'
    },
    {
      headerName: 'Actions',
      width: 100,
      pinned: 'right',
      cellRenderer: (p: any) => {
        if (p.node.rowPinned) return null;
        return (
          <div className="flex items-center gap-2 h-full">
            <button
              onClick={async (e) => {
                e.stopPropagation();
                await deleteChangeRecord(p.data.id);
              }}
              className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        );
      }
    }
  ];
}
