import React from 'react';
import { ColDef, ColGroupDef } from 'ag-grid-community';
import { Trash2 } from 'lucide-react';
import { Project, Enterprise, CostCode } from '../../types';
import { betaPertExposure } from '../../domain/risk';
import { formatCurrency } from '../../lib/utils';

// ---------------------------------------------------------------------------
// Risk column defs
// ---------------------------------------------------------------------------

export interface RiskColumnDeps {
  project: Project;
  enterprise: Enterprise;
  setSelectedRiskId: (id: string | null) => void;
  setRiskToDelete: (risk: any) => void;
  setIsDeleteRiskOpen: (open: boolean) => void;
}

export function buildRiskColumnDefs(deps: RiskColumnDeps): (ColDef | ColGroupDef)[] {
  const { project, enterprise, setSelectedRiskId, setRiskToDelete, setIsDeleteRiskOpen } = deps;

  const defs: (ColDef | ColGroupDef)[] = [
    {
      headerName: '', headerCheckboxSelection: true, checkboxSelection: true, headerCheckboxSelectionFilteredOnly: true, width: 50, pinned: 'left',
    },
    {
      headerName: 'Risk ID', field: 'riskId', pinned: 'left', width: 150, sort: 'asc',
      cellRenderer: (params: any) => {
        if (params.node.rowPinned) return <span className="font-bold">{params.value}</span>;
        return (
          <button onClick={() => setSelectedRiskId(params.data.id)} className="text-blue-600 hover:text-blue-800 hover:underline font-bold text-left capitalize truncate">
            {params.value}
          </button>
        );
      }
    },
    { headerName: 'Period', field: 'periodId', editable: true, width: 120, cellEditor: 'agSelectCellEditor', cellEditorParams: { values: project.reportingPeriods?.periods.map(p => p.id) || [] }, valueFormatter: (p: any) => project.reportingPeriods?.periods.find(per => per.id === p.value)?.name || p.value },
    { headerName: 'Description', field: 'description', editable: true, width: 250 },
    { headerName: 'Type', field: 'type', editable: true, width: 150, cellEditor: 'agSelectCellEditor', cellEditorParams: { values: enterprise.riskTypes || [] } },
    {
      headerName: 'Status', field: 'status', editable: true, width: 130,
      cellEditor: 'agSelectCellEditor', cellEditorParams: { values: ['Open', 'Mitigated', 'Closed', 'Realized'] },
      cellClassRules: {
        'text-amber-600 font-bold': (p: any) => p.value === 'Open',
        'text-blue-600 font-bold': (p: any) => p.value === 'Mitigated',
        'text-gray-500 font-bold': (p: any) => p.value === 'Closed',
        'text-red-600 font-bold': (p: any) => p.value === 'Realized',
      }
    },
    {
      headerName: 'Strategy', field: 'strategy', editable: true, width: 130,
      cellEditor: 'agSelectCellEditor', cellEditorParams: { values: ['Avoid', 'Mitigate', 'Transfer', 'Accept'] }
    },
    { headerName: 'Min Value $', field: 'minImpactTotal', width: 130, valueFormatter: (p) => formatCurrency(p.value), type: 'numericColumn' },
    { headerName: 'Most Likely $', field: 'mostLikelyImpactTotal', width: 130, valueFormatter: (p) => formatCurrency(p.value), type: 'numericColumn' },
    { headerName: 'Max Value $', field: 'maxImpactTotal', width: 130, valueFormatter: (p) => formatCurrency(p.value), type: 'numericColumn' },
    { headerName: 'Beta Pert Exposure', field: 'exposure', width: 160, valueFormatter: (p) => formatCurrency(p.value), type: 'numericColumn', cellStyle: { fontWeight: 'bold', color: '#dc2626' } },
    {
      headerName: 'Actions', width: 80, pinned: 'right',
      cellRenderer: (p: any) => p.node.rowPinned ? null : (
        <button onClick={() => { setRiskToDelete(p.data); setIsDeleteRiskOpen(true); }} className="p-1.5 text-gray-400 hover:text-red-600">
          <Trash2 className="w-4 h-4" />
        </button>
      )
    }
  ];

  // Enterprise Risk Attributes
  const enterpriseRiskAttrs = (enterprise.riskAttributes || []).filter(attr => attr.title && attr.title.trim() !== '' && attr.values && attr.values.length > 0);
  if (enterpriseRiskAttrs.length > 0) {
    defs.splice(defs.length - 1, 0, {
      headerName: 'Enterprise Risk Attributes',
      openByDefault: true,
      children: enterpriseRiskAttrs.map(attr => ({
        headerName: attr.title,
        field: `enterpriseAttributes.${attr.id}`,
        width: 200,
        editable: true,
        cellEditor: 'agRichSelectCellEditor',
        cellEditorParams: {
          values: (attr.values || [])
            .sort((a, b) => (a.id || '').localeCompare(b.id || ''))
            .map(v => `${v.id} | ${v.description}`),
          searchType: 'matchAny',
          allowTyping: true,
          filterList: true
        }
      }))
    });
  }

  // Project Risk Attributes
  const projectRiskAttrs = (project.riskAttributes || []).filter(attr => attr.title && attr.title.trim() !== '' && attr.values && attr.values.length > 0);
  if (projectRiskAttrs.length > 0) {
    defs.splice(defs.length - 1, 0, {
      headerName: 'Project Risk Attributes',
      openByDefault: true,
      children: projectRiskAttrs.map(attr => ({
        headerName: attr.title,
        field: `projectAttributes.${attr.id}`,
        width: 200,
        editable: true,
        cellEditor: 'agRichSelectCellEditor',
        cellEditorParams: {
          values: (attr.values || [])
            .sort((a, b) => (a.id || '').localeCompare(b.id || ''))
            .map(v => `${v.id} | ${v.description}`),
          searchType: 'matchAny',
          allowTyping: true,
          filterList: true
        }
      }))
    });
  }

  return defs;
}

// ---------------------------------------------------------------------------
// Risk record column defs
// ---------------------------------------------------------------------------

export interface RiskRecordColumnDeps {
  costCodes: CostCode[];
  enterpriseLineItemAttrs: any[];
  projectLineItemAttrs: any[];
  riskRepo: any;
}

export function buildRiskRecordColumnDefs(deps: RiskRecordColumnDeps): (ColDef | ColGroupDef)[] {
  const { costCodes, enterpriseLineItemAttrs, projectLineItemAttrs, riskRepo } = deps;

  const defs: (ColDef | ColGroupDef)[] = [
    { headerName: '', checkboxSelection: true, headerCheckboxSelection: true, headerCheckboxSelectionFilteredOnly: true, width: 50, pinned: 'left' },
    {
      headerName: 'Cost Code', field: 'costCodeId', editable: true, width: 180,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: {
        values: ['', ...costCodes.map(c => c.id)],
        valueListGap: 0,
        formatValue: (id: string) => {
          if (!id) return 'Select Cost Code...';
          const cc = costCodes.find(c => c.id === id);
          return cc ? `${cc.code} - ${cc.name}` : id;
        }
      },
      valueFormatter: (params) => {
        if (!params.value) return '';
        const cc = costCodes.find(c => c.id === params.value || c.code === params.value);
        return cc ? cc.code : params.value;
      },
      tooltipValueGetter: (params) => {
        const cc = costCodes.find(c => c.id === params.value || c.code === params.value);
        return cc ? `${cc.code} - ${cc.name}` : params.value;
      }
    },
    { headerName: 'Scope', field: 'scope', editable: true, width: 250 },
    {
      headerName: 'Risk Impact Analysis',
      openByDefault: true,
      children: [
        {
          headerName: 'Prob %', field: 'probability', editable: true, width: 100,
          valueFormatter: (p) => p.value === null ? '' : `${((p.value || 0) * 100).toFixed(0)}%`,
          cellEditor: 'agNumberCellEditor',
          cellEditorParams: { min: 0, max: 1 },
          valueParser: (p) => Number(p.newValue) > 1 ? Number(p.newValue) / 100 : Number(p.newValue)
        },
        {
          headerName: 'Min Value $', field: 'minImpactAmount', editable: true, width: 130, type: 'numericColumn',
          valueFormatter: (p) => formatCurrency(p.value), cellEditor: 'agNumberCellEditor'
        },
        {
          headerName: 'Most Likely $', field: 'mostLikelyImpactAmount', editable: true, width: 130, type: 'numericColumn',
          valueFormatter: (p) => formatCurrency(p.value), cellEditor: 'agNumberCellEditor'
        },
        {
          headerName: 'Maximum Value $', field: 'maxImpactAmount', editable: true, width: 130, type: 'numericColumn',
          valueFormatter: (p) => formatCurrency(p.value), cellEditor: 'agNumberCellEditor'
        },
        {
          headerName: 'Beta Pert', width: 120, type: 'numericColumn',
          field: 'betaPertImpactAmount',
          valueGetter: (p) => {
            if (p.node.rowPinned) return p.data.betaPertImpactAmount;
            const prob = Number(p.data.probability) || 0;
            const min = Number(p.data.minImpactAmount) || 0;
            const ml = Number(p.data.mostLikelyImpactAmount) || 0;
            const max = Number(p.data.maxImpactAmount) || 0;
            return betaPertExposure(min, ml, max, prob);
          },
          valueFormatter: (p) => formatCurrency(p.value),
          cellStyle: { backgroundColor: 'rgba(220, 38, 38, 0.05)', fontWeight: 'bold' }
        }
      ]
    },
    {
       headerName: 'Actions', width: 80, pinned: 'right',
       cellRenderer: (p: any) => p.node.rowPinned ? null : (
         <button onClick={async () => {
           await riskRepo.deleteRiskRecord(p.data.id);
         }} className="p-1.5 text-gray-400 hover:text-red-600">
           <Trash2 className="w-4 h-4" />
         </button>
       )
    }
  ];

  // Enterprise Line Item Attributes
  if (enterpriseLineItemAttrs.length > 0) {
    defs.splice(defs.length - 1, 0, {
      headerName: 'Enterprise Line-Item Attributes',
      openByDefault: true,
      children: enterpriseLineItemAttrs.map(attr => ({
        headerName: attr.title,
        field: `enterpriseAttributes.${attr.id}`,
        width: 200,
        editable: true,
        cellEditor: 'agRichSelectCellEditor',
        cellEditorParams: {
          values: (attr.values || [])
            .sort((a, b) => (a.id || '').localeCompare(b.id || ''))
            .map(v => `${v.id} | ${v.description}`),
          searchType: 'matchAny',
          allowTyping: true,
          filterList: true
        }
      }))
    });
  }

  // Project Line Item Attributes
  if (projectLineItemAttrs.length > 0) {
    defs.splice(defs.length - 1, 0, {
      headerName: 'Project Line-Item Attributes',
      openByDefault: true,
      children: projectLineItemAttrs.map(attr => ({
        headerName: attr.title,
        field: `projectAttributes.${attr.id}`,
        width: 200,
        editable: true,
        cellEditor: 'agRichSelectCellEditor',
        cellEditorParams: {
          values: (attr.values || [])
            .sort((a, b) => (a.id || '').localeCompare(b.id || ''))
            .map(v => `${v.id} | ${v.description}`),
          searchType: 'matchAny',
          allowTyping: true,
          filterList: true
        }
      }))
    });
  }

  return defs;
}
