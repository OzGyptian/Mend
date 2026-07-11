import React, { useState, useRef, useMemo } from 'react';
import { Plus, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import {
  Enterprise,
  Project,
  Subcontract,
  Invoice,
  CostCode,
} from '../../../types';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { cn, formatCurrency, dateToISO } from '@/lib/utils';
import { motion } from 'motion/react';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, CellValueChangedEvent } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';
import 'ag-grid-enterprise';
import { buildInvoiceColumnDefs, buildInvoiceLineItemColumnDefs } from '../columns';

export interface InvoicesPanelProps {
  selectedSubcontractId: string | null;
  selectedSubcontract: Subcontract | null | undefined;
  selectedInvoiceId: string | null;
  setSelectedInvoiceId: (id: string | null) => void;
  isInvoicesCollapsed: boolean;
  setIsInvoicesCollapsed: (v: boolean) => void;
  invoices: Invoice[];
  costCodes: CostCode[];
  enterprise: Enterprise;
  project: Project;
  theme: 'light' | 'dark';
  quickFilterText: string;
  subcontractRepo: {
    createInvoice: (data: any) => Promise<any>;
    updateInvoice: (id: string, data: Partial<Invoice>) => Promise<void>;
    deleteInvoice: (id: string) => Promise<void>;
  };
  user: any;
  /** Called when user clicks "Close" in the bottom-panel toolbar */
  onClose: () => void;
}

export function InvoicesPanel({
  selectedSubcontractId,
  selectedSubcontract,
  selectedInvoiceId,
  setSelectedInvoiceId,
  isInvoicesCollapsed,
  setIsInvoicesCollapsed,
  invoices,
  costCodes,
  enterprise,
  project,
  theme,
  quickFilterText,
  subcontractRepo,
  user,
  onClose,
}: InvoicesPanelProps) {
  // --- Local state owned by this panel ---
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [isAddingInvoice, setIsAddingInvoice] = useState(false);
  const [invoiceFormData, setInvoiceFormData] = useState({
    description: '',
    submittedDate: '',
    certifiedDate: '',
    paymentDate: '',
    status: 'Draft' as any,
  });
  const [invoiceDeleteConfirm, setInvoiceDeleteConfirm] = useState<string | null>(null);
  const [entryMethod, setEntryMethod] = useState<'Cumulative' | 'Periodic'>('Cumulative');

  const invoicesGridRef = useRef<AgGridReact>(null);

  // --- Derived data ---
  const selectedSubcontractInvoices = useMemo(() => {
    if (!selectedSubcontractId) return [];
    return invoices
      .filter((i) => i.subcontractId === selectedSubcontractId)
      .sort((a, b) => {
        if (a.subcontractId !== b.subcontractId) {
          return a.subcontractId.localeCompare(b.subcontractId);
        }
        const aNo = parseInt(a.invoiceId.replace(/\D/g, '') || '0');
        const bNo = parseInt(b.invoiceId.replace(/\D/g, '') || '0');
        return aNo - bNo;
      });
  }, [invoices, selectedSubcontractId]);

  const selectedInvoice = useMemo(
    () => invoices.find((i) => i.id === selectedInvoiceId),
    [invoices, selectedInvoiceId]
  );

  const selectedInvoiceItems = useMemo(() => {
    if (!selectedInvoiceId || !selectedInvoice || selectedInvoice.subcontractId !== selectedSubcontractId)
      return [];

    const subInvoices = [...invoices]
      .filter((i) => i.subcontractId === selectedInvoice.subcontractId)
      .sort((a, b) => a.invoiceId.localeCompare(b.invoiceId));

    const currentIndex = subInvoices.findIndex((i) => i.id === selectedInvoiceId);
    const previousInvoices = subInvoices.slice(0, currentIndex);

    const lastInvoice = previousInvoices[previousInvoices.length - 1];
    const prevItems: Record<string, any> = {};
    if (lastInvoice) {
      (lastInvoice.items || []).forEach((item) => {
        prevItems[item.subcontractLineItemId] = item;
      });
    }

    const lineItemsArray = selectedSubcontract?.lineItems || [];
    const lineItemsMap: Record<string, any> = {};
    lineItemsArray.forEach((li) => {
      lineItemsMap[li.id] = li;
    });

    return (selectedInvoice?.items || [])
      .map((item) => {
        const parentLI = lineItemsMap[item.subcontractLineItemId] || {};
        const prev = prevItems[item.subcontractLineItemId] || {
          claimQty: 0,
          claimValue: 0,
          claimPercent: 0,
          certifiedQty: 0,
          certifiedValue: 0,
          certifiedPercent: 0,
        };

        return {
          ...item,
          qty: parentLI.qty ?? item.qty,
          rate: parentLI.rate ?? item.rate,
          description: parentLI.description ?? item.description,
          itemNo: parentLI.itemNo ?? item.itemNo,
          unit: parentLI.unit ?? item.unit,
          type: parentLI.type ?? item.type,
          previousClaimQty: prev.claimQty || 0,
          previousClaimValue: prev.claimValue || 0,
          previousClaimPercent: prev.claimPercent || 0,
          previousCertifiedQty: prev.certifiedQty || 0,
          previousCertifiedValue: prev.certifiedValue || 0,
          previousCertifiedPercent: prev.certifiedPercent || 0,
          periodicClaimQty:
            item.periodicClaimQty ?? (item.claimQty || 0) - (prev.certifiedQty || 0),
          periodicClaimPercent:
            item.periodicClaimPercent ?? (item.claimPercent || 0) - (prev.certifiedPercent || 0),
          periodicClaimValue:
            item.periodicClaimValue ?? (item.claimValue || 0) - (prev.certifiedValue || 0),
          periodicCertifiedQty:
            item.periodicCertifiedQty ?? (item.certifiedQty || 0) - (prev.certifiedQty || 0),
          periodicCertifiedPercent:
            item.periodicCertifiedPercent ??
            (item.certifiedPercent || 0) - (prev.certifiedPercent || 0),
          periodicCertifiedValue:
            item.periodicCertifiedValue ??
            (item.certifiedValue || 0) - (prev.certifiedValue || 0),
        };
      })
      .sort((a, b) => {
        const aNo = parseInt(a.itemNo?.replace(/\D/g, '') || '0');
        const bNo = parseInt(b.itemNo?.replace(/\D/g, '') || '0');
        return aNo - bNo;
      });
  }, [selectedInvoiceId, selectedInvoice, invoices, selectedSubcontract]);

  const invoiceItemsPinnedTopRowData = useMemo(() => {
    if (selectedInvoiceItems.length === 0) return [];

    const totals = selectedInvoiceItems.reduce(
      (acc, item) => {
        acc.total += (item.qty || 0) * (item.rate || 0);
        acc.claimValue += item.claimValue || 0;
        acc.periodicClaimValue += item.periodicClaimValue || 0;
        acc.certifiedValue += item.certifiedValue || 0;
        acc.periodicCertifiedValue += item.periodicCertifiedValue || 0;
        return acc;
      },
      { total: 0, claimValue: 0, periodicClaimValue: 0, certifiedValue: 0, periodicCertifiedValue: 0 }
    );

    return [
      {
        isPinned: true,
        description: 'SUB-TOTAL',
        total: totals.total,
        claimValue: totals.claimValue,
        periodicClaimValue: totals.periodicClaimValue,
        certifiedValue: totals.certifiedValue,
        periodicCertifiedValue: totals.periodicCertifiedValue,
      },
    ];
  }, [selectedInvoiceItems]);

  const invoiceColumnDefs = useMemo<ColDef[]>(
    () =>
      buildInvoiceColumnDefs({
        setSelectedInvoiceId,
        setIsInvoicesCollapsed,
        setEditingInvoiceId,
        setIsAddingInvoice,
        setInvoiceFormData,
        setInvoiceDeleteConfirm,
      }),
    [setSelectedInvoiceId, setIsInvoicesCollapsed]
  );

  const invoiceLineItemColumnDefs = useMemo<ColDef[]>(
    () => buildInvoiceLineItemColumnDefs({ entryMethod }),
    [entryMethod]
  );

  // --- Handlers ---
  const handleAddInvoice = async () => {
    if (!selectedSubcontractId || !selectedSubcontract) return;

    try {
      const subInvoices = invoices.filter((i) => i.subcontractId === selectedSubcontractId);
      let nextNum = 1;
      if (subInvoices.length > 0) {
        const ids = subInvoices
          .map((i) => parseInt(i.invoiceId))
          .filter((n) => !isNaN(n));
        if (ids.length > 0) {
          nextNum = Math.max(...ids) + 1;
        }
      }
      const invoiceId = String(nextNum).padStart(3, '0');

      const aggregates: Record<string, { certifiedQty: number; certifiedValue: number; certifiedPercent: number }> =
        {};
      subInvoices.forEach((inv) => {
        (inv.items || []).forEach((item) => {
          if (!aggregates[item.subcontractLineItemId]) {
            aggregates[item.subcontractLineItemId] = {
              certifiedQty: 0,
              certifiedValue: 0,
              certifiedPercent: 0,
            };
          }
          aggregates[item.subcontractLineItemId].certifiedQty += item.certifiedQty || 0;
          aggregates[item.subcontractLineItemId].certifiedValue += item.certifiedValue || 0;
          aggregates[item.subcontractLineItemId].certifiedPercent += item.certifiedPercent || 0;
        });
      });

      const newInvoice: any = {
        projectId: project.id,
        enterpriseId: enterprise.id,
        subcontractId: selectedSubcontractId,
        invoiceId,
        description: `Invoice ${invoiceId}`,
        status: 'Draft',
        initiator: user.displayName || user.email,
        vendorId: selectedSubcontract.vendorId,
        vendorName: selectedSubcontract.vendorName,
        totalAmount: 0,
        certifiedAmount: 0,
        items: (selectedSubcontract?.lineItems || []).map((li: any) => {
          const prev = aggregates[li.id] || {
            certifiedQty: 0,
            certifiedValue: 0,
            certifiedPercent: 0,
          };
          return {
            id: Math.random().toString(36).substring(2, 9),
            subcontractLineItemId: li.id,
            itemNo: li.itemNo,
            description: li.description,
            qty: li.qty,
            unit: li.unit,
            rate: li.rate,
            total: li.total,
            claimQty: prev.certifiedQty,
            claimValue: prev.certifiedValue,
            claimPercent: prev.certifiedPercent,
            certifiedQty: prev.certifiedQty,
            certifiedValue: prev.certifiedValue,
            certifiedPercent: prev.certifiedPercent,
            periodicClaimQty: 0,
            periodicClaimValue: 0,
            periodicClaimPercent: 0,
            periodicCertifiedQty: 0,
            periodicCertifiedValue: 0,
            periodicCertifiedPercent: 0,
          };
        }),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: user.uid,
      };

      await subcontractRepo.createInvoice(newInvoice as any);
      toast.success('Invoice created.');
    } catch (error) {
      console.error('Error adding invoice:', error);
      toast.error('Failed to add invoice.');
    }
  };

  const handleUpdateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingInvoiceId) return;
    try {
      await subcontractRepo.updateInvoice(editingInvoiceId, {
        ...invoiceFormData,
        updatedAt: new Date().toISOString(),
      });
      toast.success('Invoice updated.');
      setIsAddingInvoice(false);
      setEditingInvoiceId(null);
    } catch (error) {
      console.error('Error updating invoice:', error);
      toast.error('Failed to update invoice.');
    }
  };

  const handleDeleteInvoice = async () => {
    if (!invoiceDeleteConfirm) return;
    try {
      await subcontractRepo.deleteInvoice(invoiceDeleteConfirm);
      toast.success('Invoice deleted.');
      setInvoiceDeleteConfirm(null);
      if (selectedInvoiceId === invoiceDeleteConfirm) {
        setSelectedInvoiceId(null);
      }
    } catch (error) {
      console.error('Error deleting invoice:', error);
      toast.error('Failed to delete invoice.');
    }
  };

  const onInvoiceCellValueChanged = async (event: CellValueChangedEvent) => {
    const { data, colDef, newValue, oldValue } = event;
    if (newValue === oldValue) return;
    if (!colDef.field) return;

    try {
      let valueToSave = newValue;
      if (newValue instanceof Date) {
        valueToSave = dateToISO(newValue);
      }
      await subcontractRepo.updateInvoice(data.id, { [colDef.field]: valueToSave });
    } catch (error) {
      console.error('Error updating invoice:', error);
      toast.error('Failed to update invoice.');
    }
  };

  const onInvoiceLineItemCellValueChanged = async (event: CellValueChangedEvent) => {
    const { data, colDef, newValue, oldValue } = event;
    if (newValue === oldValue) return;
    if (!selectedInvoiceId) return;

    const invoice = invoices.find((i) => i.id === selectedInvoiceId);
    if (!invoice) return;

    const round2 = (val: number) => Math.round((val + Number.EPSILON) * 100) / 100;

    const prevClaimQty = data.previousClaimQty || 0;
    const prevClaimPercent = data.previousClaimPercent || 0;
    const prevClaimValue = data.previousClaimValue || 0;
    const prevCertQty = data.previousCertifiedQty || 0;
    const prevCertPercent = data.previousCertifiedPercent || 0;
    const prevCertValue = data.previousCertifiedValue || 0;

    const qty = data.qty || 0;
    const rate = data.rate || 0;

    const updatedItems = (invoice.items || []).map((item) => {
      if (item.id === data.id) {
        let updated = { ...item, [colDef.field!]: newValue };
        const field = colDef.field;

        if (field === 'commentary') {
          return updated;
        }

        let isClaimEdit = false;

        if (field === 'claimQty') {
          isClaimEdit = true;
          updated.claimQty = round2(newValue);
          updated.periodicClaimQty = round2(updated.claimQty - prevCertQty);
          updated.claimValue = round2(updated.claimQty * rate);
          updated.claimPercent = round2(qty > 0 ? (updated.claimQty / qty) * 100 : 0);
          updated.periodicClaimValue = round2(updated.claimValue - prevCertValue);
          updated.periodicClaimPercent = round2(updated.claimPercent - prevCertPercent);
        } else if (field === 'periodicClaimQty') {
          isClaimEdit = true;
          updated.periodicClaimQty = round2(newValue);
          updated.claimQty = round2(prevCertQty + updated.periodicClaimQty);
          updated.claimValue = round2(updated.claimQty * rate);
          updated.claimPercent = round2(qty > 0 ? (updated.claimQty / qty) * 100 : 0);
          updated.periodicClaimValue = round2(updated.periodicClaimQty * rate);
          updated.periodicClaimPercent = round2(qty > 0 ? (updated.periodicClaimQty / qty) * 100 : 0);
        } else if (field === 'claimPercent') {
          isClaimEdit = true;
          const p = round2(newValue);
          updated.claimPercent = p;
          updated.claimQty = round2((p / 100) * qty);
          updated.periodicClaimQty = round2(updated.claimQty - prevCertQty);
          updated.claimValue = round2(updated.claimQty * rate);
          updated.periodicClaimValue = round2(updated.claimValue - prevCertValue);
          updated.periodicClaimPercent = round2(p - prevCertPercent);
        } else if (field === 'periodicClaimPercent') {
          isClaimEdit = true;
          const p = round2(newValue);
          updated.periodicClaimPercent = p;
          updated.periodicClaimQty = round2((p / 100) * qty);
          updated.claimQty = round2(prevCertQty + updated.periodicClaimQty);
          updated.claimPercent = round2(prevCertPercent + p);
          updated.periodicClaimValue = round2(updated.periodicClaimQty * rate);
          updated.claimValue = round2(updated.claimQty * rate);
        } else if (field === 'claimValue') {
          isClaimEdit = true;
          const v = round2(newValue);
          updated.claimValue = v;
          updated.periodicClaimValue = round2(v - prevCertValue);
          updated.claimQty = rate > 0 ? round2(v / rate) : 0;
          updated.periodicClaimQty = round2(updated.claimQty - prevCertQty);
          updated.claimPercent = round2(qty > 0 ? (updated.claimQty / qty) * 100 : 0);
          updated.periodicClaimPercent = round2(updated.claimPercent - prevCertPercent);
        } else if (field === 'periodicClaimValue') {
          isClaimEdit = true;
          const v = round2(newValue);
          updated.periodicClaimValue = v;
          updated.claimValue = round2(prevCertValue + v);
          updated.periodicClaimQty = rate > 0 ? round2(v / rate) : 0;
          updated.claimQty = round2(prevCertQty + updated.periodicClaimQty);
          updated.periodicClaimPercent = round2(qty > 0 ? (updated.periodicClaimQty / qty) * 100 : 0);
          updated.claimPercent = round2(prevCertPercent + updated.periodicClaimPercent);
        }

        // --- CERTIFIED LOGIC ---
        if (!isClaimEdit) {
          if (field === 'certifiedQty') {
            updated.certifiedQty = round2(newValue);
            updated.periodicCertifiedQty = round2(updated.certifiedQty - prevCertQty);
            updated.certifiedValue = round2(updated.certifiedQty * rate);
            updated.periodicCertifiedValue = round2(updated.certifiedValue - prevCertValue);
            updated.certifiedPercent = round2(qty > 0 ? (updated.certifiedQty / qty) * 100 : 0);
            updated.periodicCertifiedPercent = round2(updated.certifiedPercent - prevCertPercent);
          } else if (field === 'periodicCertifiedQty') {
            updated.periodicCertifiedQty = round2(newValue);
            updated.certifiedQty = round2(prevCertQty + updated.periodicCertifiedQty);
            updated.certifiedValue = round2(updated.certifiedQty * rate);
            updated.periodicCertifiedValue = round2(updated.periodicCertifiedQty * rate);
            updated.certifiedPercent = round2(qty > 0 ? (updated.certifiedQty / qty) * 100 : 0);
            updated.periodicCertifiedPercent = round2(qty > 0 ? (updated.periodicCertifiedQty / qty) * 100 : 0);
          } else if (field === 'certifiedPercent') {
            const p = round2(newValue);
            updated.certifiedPercent = p;
            updated.certifiedQty = round2((p / 100) * qty);
            updated.periodicCertifiedQty = round2(updated.certifiedQty - prevCertQty);
            updated.certifiedValue = round2(updated.certifiedQty * rate);
            updated.periodicCertifiedValue = round2(updated.certifiedValue - prevCertValue);
            updated.periodicCertifiedPercent = round2(p - prevCertPercent);
          } else if (field === 'periodicCertifiedPercent') {
            const p = round2(newValue);
            updated.periodicCertifiedPercent = p;
            updated.periodicCertifiedQty = round2((p / 100) * qty);
            updated.certifiedQty = round2(prevCertQty + updated.periodicCertifiedQty);
            updated.certifiedPercent = round2(prevCertPercent + p);
            updated.periodicCertifiedValue = round2(updated.periodicCertifiedQty * rate);
            updated.certifiedValue = round2(updated.certifiedQty * rate);
          } else if (field === 'certifiedValue') {
            const v = round2(newValue);
            updated.certifiedValue = v;
            updated.periodicCertifiedValue = round2(v - prevCertValue);
            updated.certifiedQty = rate > 0 ? round2(v / rate) : 0;
            updated.periodicCertifiedQty = round2(updated.certifiedQty - prevCertQty);
            updated.certifiedPercent = round2(qty > 0 ? (updated.certifiedQty / qty) * 100 : 0);
            updated.periodicCertifiedPercent = round2(updated.certifiedPercent - prevCertPercent);
          } else if (field === 'periodicCertifiedValue') {
            const v = round2(newValue);
            updated.periodicCertifiedValue = v;
            updated.certifiedValue = round2(prevCertValue + v);
            updated.periodicCertifiedQty = rate > 0 ? round2(v / rate) : 0;
            updated.certifiedQty = round2(prevCertQty + updated.periodicCertifiedQty);
            updated.periodicCertifiedPercent = round2(qty > 0 ? (updated.periodicCertifiedQty / qty) * 100 : 0);
            updated.certifiedPercent = round2(prevCertPercent + updated.periodicCertifiedPercent);
          }
        }

        return updated;
      }
      return item;
    });

    const newTotal = updatedItems.reduce((sum, item) => sum + (item.claimValue || 0), 0);
    const newCertifiedTotal = updatedItems.reduce(
      (sum, item) => sum + (item.certifiedValue || 0),
      0
    );

    try {
      await subcontractRepo.updateInvoice(selectedInvoiceId, {
        items: updatedItems,
        totalAmount: newTotal,
        certifiedAmount: newCertifiedTotal,
        updatedAt: new Date().toISOString(),
      });
      event.api.refreshCells({ rowNodes: [event.node] });
    } catch (error) {
      console.error('Error updating invoice item:', error);
      toast.error('Failed to update invoice item.');
    }
  };

  // --- Render ---
  return (
    <>
      {/* Toolbar: Add Invoice + Close */}
      <div className="flex items-center justify-end gap-2 px-4 py-2 border-b border-gray-100 dark:border-white/10 bg-white dark:bg-[#141414] shrink-0">
        <Button
          size="sm"
          onClick={handleAddInvoice}
          className="h-8 text-xs bg-green-600 hover:bg-green-700 text-white"
        >
          <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Invoice
        </Button>
        <Button variant="ghost" size="sm" onClick={onClose} className="h-8 text-xs">
          Close
        </Button>
      </div>

      {/* Content area: invoice grid + invoice items grid */}
      <div className="flex flex-col h-full">
        {/* Invoices grid */}
        <div
          className={cn(
            'transition-all duration-300 ease-in-out overflow-hidden flex flex-col',
            selectedInvoiceId
              ? isInvoicesCollapsed
                ? 'h-[40px]'
                : 'h-[40%]'
              : 'flex-1 min-h-0'
          )}
        >
          <div className="flex items-center justify-between px-2 py-1 bg-gray-50 dark:bg-white/5 border-b border-gray-100 dark:border-white/5">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              Invoices
            </span>
            {selectedInvoiceId && (
              <button
                onClick={() => setIsInvoicesCollapsed(!isInvoicesCollapsed)}
                className="p-1 hover:bg-gray-200 dark:hover:bg-white/10 rounded-md transition-colors text-gray-500"
              >
                {isInvoicesCollapsed ? (
                  <ChevronDown className="w-3 h-3" />
                ) : (
                  <ChevronUp className="w-3 h-3" />
                )}
              </button>
            )}
          </div>
          <div className="flex-1 min-h-0">
            <AgGridReact
              theme="legacy"
              key="invoicesGrid"
              ref={invoicesGridRef}
              rowData={selectedSubcontractInvoices}
              columnDefs={invoiceColumnDefs}
              quickFilterText={quickFilterText}
              context={{
                setSelectedInvoiceId,
                setEditingInvoiceId,
                setIsAddingInvoice,
                setInvoiceFormData,
                setInvoiceDeleteConfirm,
              }}
              defaultColDef={{
                sortable: true,
                filter: true,
                resizable: true,
                wrapHeaderText: true,
                autoHeaderHeight: true,
                enableRowGroup: true,
                enablePivot: true,
                enableValue: true,
                minWidth: 100,
              }}
              onCellValueChanged={onInvoiceCellValueChanged}
              animateRows={true}
              enableFillHandle={true}
              enableRangeSelection={true}
              getRowId={(params) => params.data.id}
              sideBar={{
                toolPanels: [
                  {
                    id: 'columns',
                    labelDefault: 'Columns',
                    labelKey: 'columns',
                    iconKey: 'columns',
                    toolPanel: 'agColumnsToolPanel',
                  },
                  {
                    id: 'filters',
                    labelDefault: 'Filters',
                    labelKey: 'filters',
                    iconKey: 'filter',
                    toolPanel: 'agFiltersToolPanel',
                  },
                ],
              }}
            />
          </div>
        </div>

        {/* Invoice items grid */}
        {selectedInvoiceId && (
          <div
            className={cn(
              'flex flex-col bg-white dark:bg-[#141414] transition-all duration-300 ease-in-out',
              isInvoicesCollapsed ? 'flex-1' : 'h-[60%]'
            )}
          >
            <div className="p-2 border-b border-gray-100 dark:border-white/5 flex items-center justify-between bg-gray-50 dark:bg-white/5">
              <div className="flex items-center gap-4">
                <h4 className="text-xs font-bold uppercase tracking-widest text-gray-500">
                  Invoice Items:{' '}
                  <span className="text-green-600">{selectedInvoice?.invoiceId}</span>
                </h4>
                {/* Entry method toggle */}
                <div className="flex items-center gap-1 bg-gray-200 dark:bg-white/5 p-0.5 rounded-lg">
                  <Button
                    variant={entryMethod === 'Cumulative' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setEntryMethod('Cumulative')}
                    className={cn(
                      'h-6 px-3 text-[10px]',
                      entryMethod === 'Cumulative' ? 'shadow-sm' : 'text-gray-500'
                    )}
                  >
                    Cumulative
                  </Button>
                  <Button
                    variant={entryMethod === 'Periodic' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setEntryMethod('Periodic')}
                    className={cn(
                      'h-6 px-3 text-[10px]',
                      entryMethod === 'Periodic' ? 'shadow-sm' : 'text-gray-500'
                    )}
                  >
                    Periodic
                  </Button>
                </div>
              </div>

              {/* Claimed / Certified summary */}
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1">
                  <span className="text-gray-400">Claimed:</span>
                  <span className="font-bold text-blue-600">
                    {formatCurrency(selectedInvoice?.totalAmount || 0)}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-gray-400">Certified:</span>
                  <span className="font-bold text-green-600">
                    {formatCurrency(selectedInvoice?.certifiedAmount || 0)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex-1 min-h-0">
              <div
                className={cn(
                  'absolute inset-0 ag-theme-quartz',
                  theme === 'dark' ? 'ag-theme-quartz-dark' : ''
                )}
                style={{ position: 'relative', height: '100%' }}
              >
                <AgGridReact
                  theme="legacy"
                  key="invoiceItemsGrid"
                  rowData={selectedInvoiceItems}
                  columnDefs={invoiceLineItemColumnDefs}
                  pinnedTopRowData={invoiceItemsPinnedTopRowData}
                  getRowClass={(params) => {
                    if (params.node.rowPinned) return 'pinned-row-highlight';
                    return '';
                  }}
                  defaultColDef={{
                    sortable: true,
                    filter: true,
                    resizable: true,
                    wrapHeaderText: true,
                    autoHeaderHeight: true,
                    minWidth: 100,
                  }}
                  onCellValueChanged={onInvoiceLineItemCellValueChanged}
                  animateRows={true}
                  enableFillHandle={true}
                  enableRangeSelection={true}
                  getRowId={(params) => params.data.id}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Invoice Modal */}
      {isAddingInvoice && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl w-full max-w-2xl p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold dark:text-white">
                {editingInvoiceId ? 'Edit Invoice' : 'Add Invoice'}
              </h2>
              <button
                onClick={() => {
                  setIsAddingInvoice(false);
                  setEditingInvoiceId(null);
                }}
                className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full"
              >
                <Plus className="w-5 h-5 rotate-45 text-gray-400" />
              </button>
            </div>
            <form
              onSubmit={editingInvoiceId ? handleUpdateInvoice : handleAddInvoice}
              className="space-y-4"
            >
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                  Invoice Name
                </label>
                <Input
                  value={invoiceFormData.description}
                  onChange={(e) =>
                    setInvoiceFormData({ ...invoiceFormData, description: e.target.value })
                  }
                  placeholder="Invoice description..."
                  required
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                    Submit Date
                  </label>
                  <Input
                    type="date"
                    value={invoiceFormData.submittedDate}
                    onChange={(e) =>
                      setInvoiceFormData({ ...invoiceFormData, submittedDate: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                    Approved Date
                  </label>
                  <Input
                    type="date"
                    value={invoiceFormData.certifiedDate}
                    onChange={(e) =>
                      setInvoiceFormData({ ...invoiceFormData, certifiedDate: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                    Payment Date
                  </label>
                  <Input
                    type="date"
                    value={invoiceFormData.paymentDate}
                    onChange={(e) =>
                      setInvoiceFormData({ ...invoiceFormData, paymentDate: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Status</label>
                <select
                  value={invoiceFormData.status}
                  onChange={(e) =>
                    setInvoiceFormData({ ...invoiceFormData, status: e.target.value as any })
                  }
                  className="w-full p-2 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
                >
                  <option value="Draft">Draft</option>
                  <option value="Submitted">Submitted</option>
                  <option value="Certified">Certified</option>
                  <option value="Rejected">Rejected</option>
                  <option value="Paid">Paid</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setIsAddingInvoice(false);
                    setEditingInvoiceId(null);
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" className="bg-green-600 hover:bg-green-700 text-white">
                  {editingInvoiceId ? 'Update Invoice' : 'Create Invoice'}
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Delete Invoice Confirm */}
      {invoiceDeleteConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl p-6 max-w-sm w-full"
          >
            <h2 className="text-xl font-bold dark:text-white mb-4">Delete Invoice?</h2>
            <p className="text-sm text-gray-500 mb-6">
              This will permanently delete the invoice and all its line items. This action cannot be
              undone.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setInvoiceDeleteConfirm(null)}>
                Cancel
              </Button>
              <Button
                onClick={handleDeleteInvoice}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Delete Invoice
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </>
  );
}
