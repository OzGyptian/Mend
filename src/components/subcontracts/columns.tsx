import React from 'react';
import { Trash2 } from 'lucide-react';
import { ColDef, ICellRendererParams } from 'ag-grid-community';
import { cn, formatCurrency, formatDate, dateToISO } from '@/lib/utils';
import { Enterprise, Project, Subcontract, CostCode } from '../../types';
import { InvoiceActionsCellRenderer } from './SubcontractsCellRenderers';

// ---------------------------------------------------------------------------
// Types for deps objects
// ---------------------------------------------------------------------------

export interface SubcontractColumnDeps {
  costCodes: CostCode[];
  enterprise: Enterprise;
  project: Project;
  getSubcontractCalculations: (subcontract: Subcontract | undefined) => {
    originalAmount: number;
    approvedChanges: number;
    pendingChanges: number;
    forecastChanges?: number;
    totalAmount: number;
    claimedAmountToDate: number;
    claimedLastInvoice?: number;
    certifiedAmountToDate: number;
    certifiedLastInvoice?: number;
    varianceAmount: number;
  };
  setSelectedSubcontractId: (id: string) => void;
  setBottomPanelTab: (tab: 'lineItems' | 'invoices') => void;
  setIsMainTableCollapsed: (v: boolean) => void;
  setIsBottomPanelCollapsed: (v: boolean) => void;
}

export interface InvoiceColumnDeps {
  setSelectedInvoiceId: (id: string | null) => void;
  setIsInvoicesCollapsed: (v: boolean) => void;
  setEditingInvoiceId: (id: string | null) => void;
  setIsAddingInvoice: (v: boolean) => void;
  setInvoiceFormData: (data: any) => void;
  setInvoiceDeleteConfirm: (id: string | null) => void;
}

export interface InvoiceLineItemColumnDeps {
  entryMethod: 'Cumulative' | 'Periodic';
}

export interface LineItemColumnDeps {
  selectedSubcontractId: string | null;
  selectedSubcontract: Subcontract | null | undefined;
  costCodes: CostCode[];
  enterprise: Enterprise;
  project: Project;
  lineItemInvoiceAggregates: Record<string, { claimed: number; certified: number }>;
  subcontractRepo: { updateSubcontract: (id: string, data: Partial<Subcontract>) => Promise<void> };
  toast: { success: (msg: string) => void; error: (msg: string) => void };
  confirmDialog: (message: string) => Promise<boolean>;
}

// ---------------------------------------------------------------------------
// buildSubcontractColumnDefs
// ---------------------------------------------------------------------------

export function buildSubcontractColumnDefs(deps: SubcontractColumnDeps): any[] {
  const {
    costCodes,
    enterprise,
    project,
    getSubcontractCalculations,
    setSelectedSubcontractId,
    setBottomPanelTab,
    setIsMainTableCollapsed,
    setIsBottomPanelCollapsed,
  } = deps;

  const sortedCostCodes = [...costCodes].sort((a, b) => a.code.localeCompare(b.code));
  const defs: any[] = [
    {
      field: 'orderId',
      headerName: 'Order ID',
      pinned: 'left',
      width: 120,
      sort: 'asc',
      checkboxSelection: (params: any) => params.node.rowPinned !== 'top',
      headerCheckboxSelection: true,
      editable: false,
      filter: 'agTextColumnFilter',
      sortable: true,
      enableRowGroup: true,
      enablePivot: true,
      cellRenderer: (params: ICellRendererParams) => {
        if (params.node.rowPinned === 'top') {
          return <span className="font-bold text-blue-600">SubTotal</span>;
        }
        return (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSelectedSubcontractId(params.data.id);
              setBottomPanelTab('lineItems');
              setIsMainTableCollapsed(false);
              setIsBottomPanelCollapsed(false);
            }}
            className="font-mono font-bold text-blue-600 dark:text-blue-400 hover:underline hover:text-blue-800 transition-colors"
          >
            {params.value}
          </button>
        );
      }
    },
    { field: 'orderName', headerName: 'Order Name', width: 200, editable: true, filter: 'agTextColumnFilter', sortable: true, enableRowGroup: true, enablePivot: true },
    { field: 'orderScope', headerName: 'Description', width: 250, editable: true, filter: 'agTextColumnFilter', sortable: true, enableRowGroup: true, enablePivot: true },
    {
      field: 'vendorName',
      headerName: 'Vendor',
      width: 180,
      editable: true,
      filter: 'agSetColumnFilter',
      sortable: true,
      enableRowGroup: true,
      enablePivot: true,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: {
        values: enterprise.vendors?.map(v => v.name) || []
      }
    },
    {
      field: 'paymentType',
      headerName: 'Payment Type',
      width: 150,
      editable: true,
      filter: 'agSetColumnFilter',
      sortable: true,
      enableRowGroup: true,
      enablePivot: true,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: {
        values: ['LumpSum', 'Schedule of Rates', 'Re-measurable']
      }
    },
    {
      field: 'awardDate',
      headerName: 'Award Date',
      width: 130,
      editable: true,
      filter: 'agDateColumnFilter',
      sortable: true,
      enableRowGroup: true,
      enablePivot: true,
      cellEditor: 'agDateCellEditor',
      valueFormatter: (params: any) => formatDate(params.value)
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 120,
      editable: true,
      filter: 'agSetColumnFilter',
      sortable: true,
      enableRowGroup: true,
      enablePivot: true,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: {
        values: ['Active', 'Complete', 'On Hold']
      },
      cellRenderer: (params: ICellRendererParams) => (
        <span className={cn(
          "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest",
          params.value === 'Active' ? "bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400" :
          params.value === 'Complete' ? "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400" :
          "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-400"
        )}>
          {params.value}
        </span>
      )
    },
    {
      headerName: 'Default Values',
      children: [
        {
          field: 'defaultCostCodeId',
          headerName: 'Default Cost Code',
          width: 180,
          editable: true,
          sortable: true,
          filter: 'agSetColumnFilter',
          enableRowGroup: true,
          cellEditor: 'agRichSelectCellEditor',
          cellEditorParams: {
            values: sortedCostCodes.map(c => c.code),
            formatValue: (val: string) => {
              const code = sortedCostCodes.find(c => c.code === val);
              return code ? `${code.code} - ${code.name}` : val;
            },
            searchType: 'match',
            allowTyping: true,
            filterList: true,
            highlightMatch: true
          },
          valueFormatter: (params: any) => {
            const code = sortedCostCodes.find(c => c.code === params.value);
            return code ? `${code.code} - ${code.name}` : params.value;
          }
        },
        {
          field: 'defaultStartDate',
          headerName: 'Default Start Date',
          width: 150,
          editable: true,
          sortable: true,
          filter: 'agDateColumnFilter',
          enableRowGroup: true,
          cellEditor: 'agDateCellEditor',
          valueFormatter: (params: any) => formatDate(params.value)
        },
        {
          field: 'defaultEndDate',
          headerName: 'Default End Date',
          width: 150,
          editable: true,
          sortable: true,
          filter: 'agDateColumnFilter',
          enableRowGroup: true,
          cellEditor: 'agDateCellEditor',
          valueFormatter: (params: any) => formatDate(params.value)
        },
        {
          field: 'defaultPhasingSource',
          headerName: 'Default Phasing Source',
          width: 160,
          editable: true,
          sortable: true,
          filter: 'agSetColumnFilter',
          enableRowGroup: true,
          cellEditor: 'agSelectCellEditor',
          cellEditorParams: {
            values: ['Manual', 'Auto']
          }
        },
        {
          field: 'defaultDistribution',
          headerName: 'Default Distribution',
          width: 160,
          editable: true,
          sortable: true,
          filter: 'agSetColumnFilter',
          enableRowGroup: true,
          cellEditor: 'agSelectCellEditor',
          cellEditorParams: {
            values: ['Even', 'Bell Curve', 'Front load', 'Back load', 'S-Curve', 'Profile']
          }
        }
      ]
    },
    {
      headerName: 'Original Amount',
      width: 150,
      type: 'numericColumn',
      filter: 'agNumberColumnFilter',
      sortable: true,
      enableValue: true,
      valueGetter: (params: any) => {
        if (!params.data) return 0;
        if (params.node?.rowPinned === 'top') return params.data.originalAmount;
        return getSubcontractCalculations(params.data).originalAmount;
      },
      valueFormatter: (params: any) => formatCurrency(params.value)
    },
    {
      headerName: 'Approved Changes',
      width: 150,
      type: 'numericColumn',
      filter: 'agNumberColumnFilter',
      sortable: true,
      enableValue: true,
      valueGetter: (params: any) => {
        if (!params.data) return 0;
        if (params.node?.rowPinned === 'top') return params.data.approvedChanges;
        return getSubcontractCalculations(params.data).approvedChanges;
      },
      valueFormatter: (params: any) => formatCurrency(params.value)
    },
    {
      headerName: 'Pending Changes',
      width: 150,
      type: 'numericColumn',
      filter: 'agNumberColumnFilter',
      sortable: true,
      enableValue: true,
      valueGetter: (params: any) => {
        if (!params.data) return 0;
        if (params.node?.rowPinned === 'top') return params.data.pendingChanges;
        return getSubcontractCalculations(params.data).pendingChanges;
      },
      valueFormatter: (params: any) => formatCurrency(params.value)
    },
    {
      headerName: 'Forecast Changes',
      width: 150,
      type: 'numericColumn',
      filter: 'agNumberColumnFilter',
      sortable: true,
      enableValue: true,
      valueGetter: (params: any) => {
        if (!params.data) return 0;
        if (params.node?.rowPinned === 'top') return params.data.forecastChanges;
        return getSubcontractCalculations(params.data).forecastChanges;
      },
      valueFormatter: (params: any) => formatCurrency(params.value)
    },
    {
      headerName: 'Total Amount',
      width: 150,
      type: 'numericColumn',
      filter: 'agNumberColumnFilter',
      sortable: true,
      enableValue: true,
      valueGetter: (params: any) => {
        if (!params.data) return 0;
        if (params.node?.rowPinned === 'top') return params.data.totalAmount;
        return getSubcontractCalculations(params.data).totalAmount;
      },
      valueFormatter: (params: any) => formatCurrency(params.value),
      cellClass: 'font-bold'
    },
    {
      headerName: 'Claimed To Date',
      width: 150,
      type: 'numericColumn',
      filter: 'agNumberColumnFilter',
      sortable: true,
      enableValue: true,
      valueGetter: (params: any) => {
        if (!params.data) return 0;
        if (params.node?.rowPinned === 'top') return params.data.claimedAmountToDate;
        return getSubcontractCalculations(params.data).claimedAmountToDate;
      },
      valueFormatter: (params: any) => formatCurrency(params.value)
    },
    {
      headerName: 'Certified To Date',
      width: 150,
      type: 'numericColumn',
      filter: 'agNumberColumnFilter',
      sortable: true,
      enableValue: true,
      valueGetter: (params: any) => {
        if (!params.data) return 0;
        if (params.node?.rowPinned === 'top') return params.data.certifiedAmountToDate;
        return getSubcontractCalculations(params.data).certifiedAmountToDate;
      },
      valueFormatter: (params: any) => formatCurrency(params.value),
    },
    {
      headerName: 'Variance',
      width: 150,
      type: 'numericColumn',
      filter: 'agNumberColumnFilter',
      sortable: true,
      enableValue: true,
      valueGetter: (params: any) => {
        if (!params.data) return 0;
        if (params.node?.rowPinned === 'top') return params.data.varianceAmount;
        return getSubcontractCalculations(params.data).varianceAmount;
      },
      valueFormatter: (params: any) => formatCurrency(params.value)
    },
  ];

  const validEnterpriseSubcontractAttrs = (enterprise.subcontractAttributes || [])
    .filter(attr => attr.title && attr.title.trim() !== '' && attr.values && attr.values.length > 0);

  if (validEnterpriseSubcontractAttrs.length > 0) {
    const entGroup = {
      headerName: 'Enterprise Subcontract Attributes',
      openByDefault: true,
      children: validEnterpriseSubcontractAttrs.map(attr => ({
        field: `enterpriseAttributes.${attr.id}`,
        headerName: attr.title || `Attribute ${attr.id}`,
        width: 200,
        editable: true,
        enableRowGroup: true,
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
    };
    defs.push(entGroup);
  }

  const validProjectSubcontractAttrs = (project.subcontractAttributes || [])
    .filter(attr => attr.title && attr.title.trim() !== '' && attr.values && attr.values.length > 0);

  if (validProjectSubcontractAttrs.length > 0) {
    const projGroup = {
      headerName: 'Project Subcontract Attributes',
      openByDefault: true,
      children: validProjectSubcontractAttrs.map(attr => ({
        field: `projectAttributes.${attr.id}`,
        headerName: attr.title || `Attribute ${attr.id}`,
        width: 200,
        editable: true,
        enableRowGroup: true,
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
    };
    defs.push(projGroup);
  }

  defs.push({
    headerName: 'Actions',
    width: 120,
    pinned: 'right',
    cellRenderer: 'actionsRenderer',
    cellClass: 'overflow-visible'
  });

  return defs;
}

// ---------------------------------------------------------------------------
// buildInvoiceColumnDefs
// ---------------------------------------------------------------------------

export function buildInvoiceColumnDefs(deps: InvoiceColumnDeps): ColDef[] {
  const {
    setSelectedInvoiceId,
    setIsInvoicesCollapsed,
    setEditingInvoiceId,
    setIsAddingInvoice,
    setInvoiceFormData,
    setInvoiceDeleteConfirm,
  } = deps;

  return [
    {
      field: 'invoiceId',
      headerName: 'Invoice ID',
      width: 120,
      pinned: 'left',
      sort: 'asc',
      cellRenderer: (params: any) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setSelectedInvoiceId(params.data.id);
            setIsInvoicesCollapsed(false);
          }}
          className="font-mono font-bold text-green-600 dark:text-green-500 hover:underline hover:text-green-800 transition-colors text-left"
        >
          {params.value}
        </button>
      )
    },
    { field: 'description', headerName: 'Invoice Name', width: 250, editable: true },
    {
      field: 'submittedDate',
      headerName: 'Invoice Submit Date',
      width: 150,
      editable: true,
      cellEditor: 'agDateCellEditor',
      valueGetter: (params: any) => params.data.submittedDate ? new Date(params.data.submittedDate) : null,
      valueSetter: (params: any) => {
        if (params.newValue instanceof Date) {
          params.data.submittedDate = dateToISO(params.newValue);
        } else {
          params.data.submittedDate = params.newValue;
        }
        return true;
      },
      valueFormatter: (params: any) => formatDate(params.value)
    },
    {
      field: 'certifiedDate',
      headerName: 'Invoice Approved Date',
      width: 150,
      editable: true,
      cellEditor: 'agDateCellEditor',
      valueGetter: (params: any) => params.data.certifiedDate ? new Date(params.data.certifiedDate) : null,
      valueSetter: (params: any) => {
        if (params.newValue instanceof Date) {
          params.data.certifiedDate = dateToISO(params.newValue);
        } else {
          params.data.certifiedDate = params.newValue;
        }
        return true;
      },
      valueFormatter: (params: any) => formatDate(params.value)
    },
    {
      field: 'paymentDate',
      headerName: 'Invoice Payment Date',
      width: 150,
      editable: true,
      cellEditor: 'agDateCellEditor',
      valueGetter: (params: any) => params.data.paymentDate ? new Date(params.data.paymentDate) : null,
      valueSetter: (params: any) => {
        if (params.newValue instanceof Date) {
          params.data.paymentDate = dateToISO(params.newValue);
        } else {
          params.data.paymentDate = params.newValue;
        }
        return true;
      },
      valueFormatter: (params: any) => formatDate(params.value)
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 120,
      editable: true,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: {
        values: ['Draft', 'Submitted', 'Certified', 'Rejected', 'Paid']
      },
      cellRenderer: (params: any) => (
        <span className={cn(
          "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest",
          params.value === 'Paid' ? "bg-green-100 text-green-700 font-bold" :
          params.value === 'Certified' ? "bg-blue-100 text-blue-700 font-bold" :
          params.value === 'Submitted' ? "bg-yellow-100 text-yellow-700 font-bold" :
          "bg-gray-100 text-gray-700 font-bold"
        )}>
          {params.value}
        </span>
      )
    },
    {
      field: 'totalAmount',
      headerName: 'Claimed Amount',
      width: 150,
      type: 'numericColumn',
      valueFormatter: (params: any) => formatCurrency(params.value)
    },
    {
      field: 'certifiedAmount',
      headerName: 'Certified Amount',
      width: 150,
      type: 'numericColumn',
      valueFormatter: (params: any) => formatCurrency(params.value)
    },
    {
      headerName: 'Variance',
      width: 150,
      type: 'numericColumn',
      valueGetter: (params: any) => (params.data?.certifiedAmount || 0) - (params.data?.totalAmount || 0),
      valueFormatter: (params: any) => formatCurrency(params.value),
      cellStyle: (params: any) => {
        if (params.value < -0.01) return { color: '#ef4444', fontWeight: 'bold' };
        if (params.value > 0.01) return { color: '#10b981', fontWeight: 'bold' };
        return null;
      }
    },
    {
      headerName: 'Actions',
      width: 100,
      pinned: 'right',
      cellRenderer: InvoiceActionsCellRenderer,
      cellRendererParams: {
        setSelectedInvoiceId,
        setEditingInvoiceId,
        setIsAddingInvoice,
        setInvoiceFormData,
        setInvoiceDeleteConfirm
      }
    }
  ];
}

// ---------------------------------------------------------------------------
// buildInvoiceLineItemColumnDefs
// ---------------------------------------------------------------------------

export function buildInvoiceLineItemColumnDefs(deps: InvoiceLineItemColumnDeps): any[] {
  const { entryMethod } = deps;

  return [
    { field: 'itemNo', headerName: 'No.', width: 80, pinned: 'left', sort: 'asc' },
    {
      field: 'description',
      headerName: 'Description',
      width: 250,
      pinned: 'left',
      cellRenderer: (params: any) => {
        if (params.node.rowPinned === 'top') {
          return <span className="font-bold text-blue-600 dark:text-blue-400">{params.value}</span>;
        }
        return params.value;
      }
    },
    {
      headerName: 'Contract Reference',
      openByDefault: true,
      children: [
        {
          field: 'qty',
          headerName: 'Qty',
          width: 100,
          type: 'numericColumn',
          editable: false,
          cellRenderer: (params: any) => params.node.rowPinned === 'top' ? null : params.value
        },
        {
          field: 'unit',
          headerName: 'Unit',
          width: 80,
          editable: false,
          cellRenderer: (params: any) => params.node.rowPinned === 'top' ? null : params.value
        },
        {
          field: 'rate',
          headerName: 'Rate',
          width: 100,
          type: 'numericColumn',
          editable: false,
          cellRenderer: (params: any) => params.node.rowPinned === 'top' ? null : formatCurrency(params.value)
        },
        {
          field: 'total',
          headerName: 'Total',
          width: 130,
          type: 'numericColumn',
          editable: false,
          valueGetter: (params: any) => {
            if (!params.data) return 0;
            if (params.node?.rowPinned === 'top') return params.data.total;
            return (params.data.qty || 0) * (params.data.rate || 0);
          },
          valueFormatter: (params: any) => formatCurrency(params.value),
          cellStyle: (params: any) => {
            if (params.node.rowPinned === 'top') {
              return { color: '#2563eb', fontWeight: 'bold' };
            }
            return null;
          }
        }
      ]
    },
    {
      headerName: 'Claimed Amount',
      openByDefault: true,
      children: [
        {
          headerName: 'This Period',
          children: [
            {
              field: 'periodicClaimQty',
              headerName: 'Qty',
              width: 100,
              type: 'numericColumn',
              editable: entryMethod === 'Periodic',
              cellClass: entryMethod === 'Periodic' ? 'bg-green-50/30' : 'bg-gray-100 dark:bg-white/5 opacity-60',
              valueFormatter: (params: any) => params.value?.toFixed(2),
              cellRenderer: (params: any) => params.node.rowPinned === 'top' ? null : params.value
            },
            {
              field: 'periodicClaimPercent',
              headerName: '%',
              width: 80,
              type: 'numericColumn',
              editable: entryMethod === 'Periodic',
              cellClass: entryMethod === 'Periodic' ? 'bg-green-50/30' : 'bg-gray-100 dark:bg-white/5 opacity-60',
              valueFormatter: (params: any) => params.value ? `${params.value.toFixed(2)}%` : '0.00%',
              cellRenderer: (params: any) => params.node.rowPinned === 'top' ? null : params.value
            },
            {
              field: 'periodicClaimValue',
              headerName: 'Value',
              width: 120,
              type: 'numericColumn',
              editable: entryMethod === 'Periodic',
              cellClass: (params: any) => {
                const baseClass = entryMethod === 'Periodic' ? 'bg-green-50/30' : 'bg-gray-100 dark:bg-white/5 opacity-60';
                return baseClass;
              },
              valueFormatter: (params: any) => formatCurrency(params.value),
              cellStyle: (params: any) => {
                if (params.node.rowPinned === 'top') return { color: '#2563eb', fontWeight: 'bold' };
                return null;
              }
            }
          ]
        },
        {
          headerName: 'Cumulative to Date',
          children: [
            {
              field: 'claimQty',
              headerName: 'Qty',
              width: 100,
              type: 'numericColumn',
              editable: entryMethod === 'Cumulative',
              cellClass: entryMethod === 'Cumulative' ? 'bg-blue-50/30' : 'bg-gray-100 dark:bg-white/5 opacity-60',
              valueFormatter: (params: any) => params.value?.toFixed(2),
              cellRenderer: (params: any) => params.node.rowPinned === 'top' ? null : params.value
            },
            {
              field: 'claimPercent',
              headerName: '%',
              width: 80,
              type: 'numericColumn',
              editable: entryMethod === 'Cumulative',
              cellClass: entryMethod === 'Cumulative' ? 'bg-blue-50/30' : 'bg-gray-100 dark:bg-white/5 opacity-60',
              valueFormatter: (params: any) => params.value ? `${params.value.toFixed(2)}%` : '0.00%',
              cellRenderer: (params: any) => params.node.rowPinned === 'top' ? null : params.value
            },
            {
              field: 'claimValue',
              headerName: 'Value',
              width: 130,
              type: 'numericColumn',
              editable: entryMethod === 'Cumulative',
              cellClass: (params: any) => {
                const baseClass = entryMethod === 'Cumulative' ? 'bg-blue-50/30' : 'bg-gray-100 dark:bg-white/5 opacity-60';
                return `${baseClass} font-bold`;
              },
              valueFormatter: (params: any) => formatCurrency(params.value),
              cellStyle: (params: any) => {
                if (params.node.rowPinned === 'top') {
                  return { color: '#2563eb', fontWeight: 'bold' };
                }
                const contractTotal = (params.data.qty || 0) * (params.data.rate || 0);
                if (contractTotal > 0 && (params.value || 0) > contractTotal + 0.01) {
                  return { color: '#ef4444', fontWeight: 'bold' }; // Red-500
                }
                return null;
              }
            }
          ]
        }
      ]
    },
    {
      headerName: 'Certified Amount',
      openByDefault: true,
      children: [
        {
          headerName: 'This Period',
          children: [
            {
              field: 'periodicCertifiedQty',
              headerName: 'Qty',
              width: 100,
              type: 'numericColumn',
              editable: entryMethod === 'Periodic',
              cellClass: entryMethod === 'Periodic' ? 'bg-green-50/30' : 'bg-gray-100 dark:bg-white/5 opacity-60',
              valueFormatter: (params: any) => params.value?.toFixed(2),
              cellRenderer: (params: any) => params.node.rowPinned === 'top' ? null : params.value
            },
            {
              field: 'periodicCertifiedPercent',
              headerName: '%',
              width: 80,
              type: 'numericColumn',
              editable: entryMethod === 'Periodic',
              cellClass: entryMethod === 'Periodic' ? 'bg-green-50/30' : 'bg-gray-100 dark:bg-white/5 opacity-60',
              valueFormatter: (params: any) => params.value ? `${params.value.toFixed(2)}%` : '0.00%',
              cellRenderer: (params: any) => params.node.rowPinned === 'top' ? null : params.value
            },
            {
              field: 'periodicCertifiedValue',
              headerName: 'Value',
              width: 120,
              type: 'numericColumn',
              editable: entryMethod === 'Periodic',
              cellClass: (params: any) => {
                const baseClass = entryMethod === 'Periodic' ? 'bg-green-50/30' : 'bg-gray-100 dark:bg-white/5 opacity-60';
                return baseClass;
              },
              valueFormatter: (params: any) => formatCurrency(params.value),
              cellStyle: (params: any) => {
                if (params.node.rowPinned === 'top') return { color: '#2563eb', fontWeight: 'bold' };
                return null;
              }
            }
          ]
        },
        {
          headerName: 'Cumulative to Date',
          children: [
            {
              field: 'certifiedQty',
              headerName: 'Qty',
              width: 100,
              type: 'numericColumn',
              editable: entryMethod === 'Cumulative',
              cellClass: entryMethod === 'Cumulative' ? 'bg-blue-50/30' : 'bg-gray-100 dark:bg-white/5 opacity-60',
              valueFormatter: (params: any) => params.value?.toFixed(2),
              cellRenderer: (params: any) => params.node.rowPinned === 'top' ? null : params.value
            },
            {
              field: 'certifiedPercent',
              headerName: '%',
              width: 80,
              type: 'numericColumn',
              editable: entryMethod === 'Cumulative',
              cellClass: entryMethod === 'Cumulative' ? 'bg-blue-50/30' : 'bg-gray-100 dark:bg-white/5 opacity-60',
              valueFormatter: (params: any) => params.value ? `${params.value.toFixed(2)}%` : '0.00%',
              cellRenderer: (params: any) => params.node.rowPinned === 'top' ? null : params.value
            },
            {
              field: 'certifiedValue',
              headerName: 'Value',
              width: 130,
              type: 'numericColumn',
              editable: entryMethod === 'Cumulative',
              cellClass: (params: any) => {
                const baseClass = entryMethod === 'Cumulative' ? 'bg-blue-50/30' : 'bg-gray-100 dark:bg-white/5 opacity-60';
                return `${baseClass} font-bold`;
              },
              valueFormatter: (params: any) => formatCurrency(params.value),
              cellStyle: (params: any) => {
                if (params.node.rowPinned === 'top') return { color: '#2563eb', fontWeight: 'bold' };
                // Red if certified > contract total
                const contractTotal = (params.data.qty || 0) * (params.data.rate || 0);
                if (contractTotal > 0 && (params.value || 0) > contractTotal + 0.01) {
                  return { color: '#ef4444', fontWeight: 'bold' };
                }
                return null;
              }
            }
          ]
        }
      ]
    },
    {
      headerName: 'Variance',
      field: 'variance',
      width: 130,
      type: 'numericColumn',
      valueGetter: (params: any) => {
        if (!params.data) return 0;
        return (params.data.certifiedValue || 0) - (params.data.claimValue || 0);
      },
      valueFormatter: (params: any) => formatCurrency(params.value),
      cellStyle: (params: any) => {
        if (params.node.rowPinned === 'top') return { color: '#2563eb', fontWeight: 'bold' };
        if ((params.value || 0) < -0.01) { // Certified < Claimed
          return { color: '#f97316' }; // Orange-500
        }
        return null;
      }
    },
    {
      headerName: 'Commentary',
      field: 'commentary',
      width: 250,
      editable: (params: any) => params.node.rowPinned !== 'top',
      cellEditor: 'agLargeTextCellEditor',
      cellEditorParams: {
        maxLength: 500
      }
    }
  ];
}

// ---------------------------------------------------------------------------
// buildLineItemColumnDefs
// ---------------------------------------------------------------------------

export function buildLineItemColumnDefs(deps: LineItemColumnDeps): any[] {
  const {
    selectedSubcontractId,
    selectedSubcontract,
    costCodes,
    enterprise,
    project,
    lineItemInvoiceAggregates,
    subcontractRepo,
    toast,
    confirmDialog,
  } = deps;

  const sortedCostCodes = [...costCodes].sort((a, b) => a.code.localeCompare(b.code));
  const periods = project.reportingPeriods?.periods || [];
  const currentPeriodId = project.reportingPeriods?.currentPeriodId;
  const currentPeriodIndex = periods.findIndex(p => p.id === currentPeriodId);

  const defs: any[] = [
    {
      headerName: 'Item Details',
      pinned: 'left',
      openByDefault: true,
      children: [
        {
          field: 'itemNo',
          headerName: 'No.',
          width: 80,
          pinned: 'left',
          editable: false,
          sort: 'asc',
          checkboxSelection: true,
          headerCheckboxSelection: true,
          cellRenderer: (params: any) => {
            if (params.node.rowPinned === 'top') return null;
            return params.value;
          }
        },
        {
          field: 'description',
          headerName: 'Description',
          width: 250,
          pinned: 'left',
          editable: (params: any) => params.node.rowPinned !== 'top',
          cellRenderer: (params: any) => {
            if (params.node.rowPinned === 'top') {
              return <span className="font-bold text-blue-600 dark:text-blue-400">SubTotal</span>;
            }
            return params.value;
          }
        },
        {
          field: 'costCodeId',
          headerName: 'Cost Code ID',
          width: 180,
          columnGroupShow: 'open',
          editable: (params: any) => params.node.rowPinned !== 'top',
          valueGetter: (params: any) => {
            if (params.node.rowPinned === 'top') return null;
            return params.data.costCodeId || selectedSubcontract?.defaultCostCodeId;
          },
          valueFormatter: (params: any) => {
            const val = params.value;
            const code = sortedCostCodes.find(c => c.code === val);
            return code ? `${code.code} - ${code.name}` : val;
          },
          cellStyle: (params: any) => {
            if (params.node.rowPinned === 'top') return null;
            if (!params.data.costCodeId && selectedSubcontract?.defaultCostCodeId) {
              return { fontStyle: 'italic', color: '#6b7280' }; // Gray-500 italic
            }
            return null;
          },
          cellEditor: 'agRichSelectCellEditor',
          cellEditorParams: {
            values: sortedCostCodes.map(c => c.code),
            formatValue: (val: string) => {
              const code = sortedCostCodes.find(c => c.code === val);
              return code ? `${code.code} - ${code.name}` : val;
            },
            searchType: 'match',
            allowTyping: true,
            filterList: true,
            highlightMatch: true
          }
        },
        {
          field: 'date',
          headerName: 'Date',
          width: 120,
          columnGroupShow: 'open',
          editable: (params: any) => params.node.rowPinned !== 'top',
          cellEditor: 'agDateCellEditor',
          valueGetter: (params: any) => params.data.date ? new Date(params.data.date) : null,
          valueSetter: (params: any) => {
            if (params.newValue instanceof Date) {
              params.data.date = dateToISO(params.newValue);
            } else {
              params.data.date = params.newValue;
            }
            return true;
          },
          valueFormatter: (params: any) => params.node.rowPinned === 'top' ? '' : formatDate(params.value)
        }
      ]
    },
    // Pricing
    {
      headerName: 'Pricing',
      pinned: 'left',
      openByDefault: true,
      children: [
        {
          field: 'qty',
          headerName: 'Qty',
          width: 100,
          type: 'numericColumn',
          editable: (params: any) => params.node.rowPinned !== 'top',
          cellRenderer: (params: any) => {
            if (params.node.rowPinned === 'top') return null;
            return params.value;
          }
        },
        {
          field: 'unit',
          headerName: 'Unit',
          width: 80,
          editable: (params: any) => params.node.rowPinned !== 'top',
          cellRenderer: (params: any) => {
            if (params.node.rowPinned === 'top') return null;
            return params.value;
          }
        },
        {
          field: 'rate',
          headerName: 'Rate',
          width: 120,
          type: 'numericColumn',
          editable: (params: any) => params.node.rowPinned !== 'top',
          valueFormatter: (params: any) => params.node?.rowPinned === 'top' ? '' : formatCurrency(params.value)
        },
        {
          field: 'total',
          headerName: 'Total',
          width: 130,
          type: 'numericColumn',
          valueGetter: (params: any) => {
            if (!params.data) return 0;
            if (params.node?.rowPinned === 'top') return params.data.total;
            return (params.data.qty || 0) * (params.data.rate || 0);
          },
          valueFormatter: (params: any) => formatCurrency(params.value),
          cellClass: 'font-bold',
          cellStyle: (params: any) => {
            if (params.node?.rowPinned === 'top') {
              return { color: '#2563eb', fontWeight: 'bold' };
            }
            const totalContract = params.data.total || 0;
            const claimed = lineItemInvoiceAggregates[params.data.id]?.claimed || 0;
            const certified = lineItemInvoiceAggregates[params.data.id]?.certified || 0;
            if (totalContract > 0 && (claimed > totalContract + 0.01 || certified > totalContract + 0.01)) {
              return { color: '#ef4444', fontWeight: 'bold' };
            }
            return null;
          }
        },
        {
          headerName: 'Claimed Total',
          field: 'claimedTotal',
          width: 130,
          type: 'numericColumn',
          valueGetter: (params: any) => {
            if (params.node?.rowPinned === 'top') return params.data.claimedTotal;
            if (!params.data) return 0;
            return lineItemInvoiceAggregates[params.data.id]?.claimed || 0;
          },
          valueFormatter: (params: any) => formatCurrency(params.value),
          cellClass: 'text-blue-600 dark:text-blue-400 font-medium'
        },
        {
          headerName: 'Certified Total',
          field: 'certifiedTotal',
          width: 130,
          type: 'numericColumn',
          valueGetter: (params: any) => {
            if (params.node?.rowPinned === 'top') return params.data.certifiedTotal;
            if (!params.data) return 0;
            return lineItemInvoiceAggregates[params.data.id]?.certified || 0;
          },
          valueFormatter: (params: any) => formatCurrency(params.value),
          cellClass: 'font-medium'
        },
        {
          headerName: 'Variance',
          width: 130,
          type: 'numericColumn',
          valueGetter: (params: any) => {
            if (params.node?.rowPinned === 'top') return (params.data?.certifiedTotal || 0) - (params.data?.claimedTotal || 0);
            const claimed = lineItemInvoiceAggregates[params.data?.id]?.claimed || 0;
            const certified = lineItemInvoiceAggregates[params.data?.id]?.certified || 0;
            return certified - claimed;
          },
          valueFormatter: (params: any) => formatCurrency(params.value),
          cellStyle: (params: any) => {
            if (params.value < -0.01) return { color: '#ef4444', fontWeight: 'bold' };
            if (params.value > 0.01) return { color: '#10b981', fontWeight: 'bold' };
            return null;
          }
        }
      ]
    },
    // Note
    {
      headerName: 'Commentary',
      openByDefault: true,
      children: [
        {
          field: 'note',
          headerName: 'Note',
          width: 300,
          editable: (params: any) => params.node.rowPinned !== 'top',
          cellEditor: 'agLargeTextCellEditor',
          cellEditorParams: {
            maxLength: 1000
          }
        }
      ]
    },
    {
      headerName: 'Status',
      openByDefault: true,
      children: [
        {
          field: 'type',
          headerName: 'Type',
          width: 140,
          editable: (params: any) => params.node.rowPinned !== 'top',
          cellEditor: 'agSelectCellEditor',
          cellEditorParams: {
            values: ['Original', 'ChangeOrder']
          },
          cellRenderer: (params: any) => {
            if (params.node.rowPinned === 'top') return null;
            return (
              <span className={cn(
                "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest",
                params.value === 'Original' ? "bg-gray-100 text-gray-700 dark:bg-white/5 dark:text-gray-400" :
                "bg-orange-100 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400"
              )}>
                {params.value}
              </span>
            );
          }
        },
        {
          field: 'status',
          headerName: 'Status',
          width: 140,
          editable: (params: any) => params.node.rowPinned !== 'top',
          cellEditor: 'agSelectCellEditor',
          cellEditorParams: {
            values: ['Approved', 'Pending', 'Forecast', 'Rejected']
          },
          cellRenderer: (params: any) => {
            if (params.node.rowPinned === 'top') return null;
            return (
              <span className={cn(
                "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest",
                params.value === 'Approved' ? "bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400" :
                params.value === 'Pending' ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-400" :
                params.value === 'Forecast' ? "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400" :
                "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400"
              )}>
                {params.value}
              </span>
            );
          }
        }
      ]
    }
  ];

  // Helper for nested value setting
  const nestedValueSetter = (params: any) => {
    const field = params.colDef.field;
    if (!field) return false;
    const parts = field.split('.');
    let current = params.data;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!current[part]) current[part] = {};
      current = current[part];
    }
    current[parts[parts.length - 1]] = params.newValue;
    return true;
  };

  // Enterprise Attributes
  const enterpriseLineItemAttrs = (enterprise.lineItemAttributes || []).filter(attr => attr.title && attr.title.trim() !== '');
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
        cellEditor: 'agRichSelectCellEditor',
        cellEditorParams: {
          values: attr.values.map(v => v.id),
          formatValue: (id: string) => {
            if (!id) return '';
            const match = attr.values?.find(v => v.id === id);
            return match ? `${match.id} - ${match.description}` : id;
          },
          searchType: 'match',
          allowTyping: true,
          filterList: true
        },
        valueSetter: nestedValueSetter,
        valueFormatter: (params: any) => {
          const v = attr.values.find(v => v.id === params.value);
          return v ? `${v.id} - ${v.description}` : params.value;
        }
      }))
    });
  }

  // Project Attributes
  const projectLineItemAttrs = (project.lineItemAttributes || []).filter(attr => attr.title && attr.title.trim() !== '');
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
        cellEditor: 'agRichSelectCellEditor',
        cellEditorParams: {
          values: attr.values.map(v => v.id),
          formatValue: (id: string) => {
            if (!id) return '';
            const match = attr.values?.find(v => v.id === id);
            return match ? `${match.id} - ${match.description}` : id;
          },
          searchType: 'match',
          allowTyping: true,
          filterList: true
        },
        valueSetter: nestedValueSetter,
        valueFormatter: (params: any) => {
          const v = attr.values.find(v => v.id === params.value);
          return v ? `${v.id} - ${v.description}` : params.value;
        }
      }))
    });
  }

  // User Defined
  defs.push({
    headerName: 'User Defined',
    openByDefault: true,
    children: [
      ...Array.from({ length: 5 }).map((_, i) => ({
        headerName: `Numeric ${i + 1}`,
        field: `userDefined.num${i + 1}`,
        width: 120,
        type: 'numericColumn',
        columnGroupShow: i === 0 ? undefined : 'open',
        editable: (params: any) => params.node.rowPinned !== 'top',
        valueParser: (params: any) => {
          const val = Number(params.newValue);
          return isNaN(val) ? 0 : val;
        },
        valueSetter: nestedValueSetter
      })),
      ...Array.from({ length: 5 }).map((_, i) => ({
        headerName: `Text ${i + 1}`,
        field: `userDefined.text${i + 1}`,
        width: 150,
        columnGroupShow: 'open',
        editable: (params: any) => params.node.rowPinned !== 'top',
        valueSetter: nestedValueSetter
      }))
    ]
  });

  // Timephasing Consolidated Group
  defs.push({
    headerName: 'Timephasing',
    openByDefault: true,
    children: [
      {
        headerName: 'Phasing Source',
        field: 'phasingSource',
        width: 130,
        editable: (params: any) => params.node.rowPinned !== 'top',
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: { values: ['Manual', 'Auto'] },
        cellStyle: (params: any) => params.node.rowPinned === 'top' ? null : { backgroundColor: 'rgba(255, 237, 213, 0.3)' } // subtle orange
      },
      {
        headerName: 'Start Date',
        field: 'startDate',
        width: 120,
        editable: (params: any) => params.node.rowPinned !== 'top',
        cellEditor: 'agDateCellEditor',
        valueGetter: (params: any) => params.data.startDate ? new Date(params.data.startDate) : null,
        valueSetter: (params: any) => {
          if (params.newValue instanceof Date) {
            params.data.startDate = dateToISO(params.newValue);
          } else {
            params.data.startDate = params.newValue;
          }
          return true;
        },
        valueFormatter: (params: any) => params.node.rowPinned === 'top' ? '' : formatDate(params.value)
      },
      {
        headerName: 'End Date',
        field: 'endDate',
        width: 120,
        editable: (params: any) => params.node.rowPinned !== 'top',
        cellEditor: 'agDateCellEditor',
        valueGetter: (params: any) => params.data.endDate ? new Date(params.data.endDate) : null,
        valueSetter: (params: any) => {
          if (params.newValue instanceof Date) {
            params.data.endDate = dateToISO(params.newValue);
          } else {
            params.data.endDate = params.newValue;
          }
          return true;
        },
        valueFormatter: (params: any) => params.node.rowPinned === 'top' ? '' : formatDate(params.value)
      },
      {
        headerName: 'Distribution',
        field: 'distribution',
        width: 130,
        editable: (params: any) => params.data.phasingSource === 'Auto' && params.node.rowPinned !== 'top',
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: ['Even', 'Bell Curve', 'Front load', 'Back load', 'S-Curve', 'Profile']
        },
      },
      {
        headerName: 'Remaining to Claim',
        width: 150,
        type: 'numericColumn',
        valueGetter: (params: any) => {
          if (params.node?.rowPinned === 'top') return (params.data?.total || 0) - (params.data?.claimedTotal || 0);
          const total = (params.data.qty || 0) * (params.data.rate || 0);
          const claimed = lineItemInvoiceAggregates[params.data.id]?.claimed || 0;
          return Math.max(0, total - claimed);
        },
        valueFormatter: (params: any) => formatCurrency(params.value),
        cellClass: 'font-bold bg-slate-50 dark:bg-slate-900',
      },
      {
        headerName: 'Total Phased',
        width: 130,
        type: 'numericColumn',
        valueFormatter: (params: any) => formatCurrency(params.value),
        valueGetter: (params: any) => {
          if (params.node?.rowPinned === 'top') return params.data.totalPhased;
          if (!params.data?.periodValues) return 0;
          // Only sum up values for future periods
          return periods.filter((_, idx) => idx > currentPeriodIndex).reduce((acc, p) => acc + (Number(params.data.periodValues?.[p.id]) || 0), 0);
        },
        cellClass: 'font-bold bg-slate-100 dark:bg-slate-800',
      },
      {
        headerName: 'Variance',
        width: 130,
        type: 'numericColumn',
        valueFormatter: (params: any) => formatCurrency(params.value),
        valueGetter: (params: any) => {
          const totalPhased = params.node?.rowPinned === 'top' ? (params.data.totalPhased || 0) : (periods.filter((_, idx) => idx > currentPeriodIndex).reduce((acc, p) => acc + (Number(params.data.periodValues?.[p.id]) || 0), 0));
          const totalRemaining = params.node?.rowPinned === 'top' ? ((params.data?.total || 0) - (params.data?.claimedTotal || 0)) : (Math.max(0, (params.data.qty || 0) * (params.data.rate || 0) - (lineItemInvoiceAggregates[params.data.id]?.claimed || 0)));
          return totalPhased - totalRemaining;
        },
        cellStyle: (params: any) => {
          if (Math.abs(params.value) > 0.01) return { color: '#ef4444', fontWeight: 'bold' };
          return { color: '#10b981', fontWeight: 'bold' };
        }
      },
      // Month columns inside the same group
      ...periods.map(p => {
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
          columnGroupShow: 'open',
          minWidth: 110,
          type: 'numericColumn',
          hide: periodIndex <= currentPeriodIndex,
          valueGetter: (params: any) => {
            if (periodIndex <= currentPeriodIndex && params.node?.rowPinned !== 'top') return 0;
            if (params.node?.rowPinned === 'top') {
              return (selectedSubcontract?.lineItems || []).reduce((sum, li) => sum + (li.periodValues?.[p.id] || 0), 0);
            }
            return params.data.periodValues?.[p.id] || 0;
          },
          valueFormatter: (params: any) => formatCurrency(params.value),
          editable: (params: any) => {
            if (params.node.rowPinned === 'top') return false;
            return params.data.phasingSource === 'Manual' && periodIndex > currentPeriodIndex;
          },
          cellClass: (params: any) => {
            if (params.node.rowPinned === 'top') return 'bg-blue-50 dark:bg-blue-900/20 font-bold';
            const isEditable = params.data.phasingSource === 'Manual' && periodIndex > currentPeriodIndex;
            return isEditable ? 'bg-white dark:bg-slate-900' : 'bg-slate-50 dark:bg-slate-900/50 text-gray-500';
          },
          valueSetter: (params: any) => {
            const val = Number(params.newValue);
            if (isNaN(val)) return false;
            params.data.periodValues = { ...params.data.periodValues, [p.id]: val };
            return true;
          }
        };
      })
    ]
  });

  // Actions
  defs.push({
    headerName: '',
    width: 60,
    pinned: 'right',
    cellRenderer: (params: ICellRendererParams) => {
      if (params.node.rowPinned) return null;
      return (
        <button
          onClick={async () => {
            if (!(await confirmDialog('Delete this line item?'))) return;
            const updatedItems = (selectedSubcontract?.lineItems || []).filter(i => i.id !== params.data.id);
            const newTotal = updatedItems.reduce((sum, i) => sum + (i.total || 0), 0);
            await subcontractRepo.updateSubcontract(selectedSubcontractId!, { lineItems: updatedItems, totalAmount: newTotal });
            toast.success('Line item deleted.');
          }}
          className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      );
    }
  });

  return defs;
}
