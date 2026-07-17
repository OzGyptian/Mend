import React, { useState, useRef } from 'react';
import { Trash2, Edit2, FileText, Settings } from 'lucide-react';
import { createPortal } from 'react-dom';
import { ICellRendererParams } from 'ag-grid-community';
import { cn } from '@/lib/utils';

export const ActionsCellRenderer = (params: any) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  if (params.node.rowPinned) return null;

  const {
    setSelectedSubcontractId,
    setDeleteConfirm,
    setSubcontractFormData,
    setIsAddingSubcontract,
    setEditingSubcontractId,
    setBottomPanelTab
  } = params.context;

  const getMenuPosition = () => {
    if (!buttonRef.current) return { top: 0, right: 0 };
    const rect = buttonRef.current.getBoundingClientRect();
    return {
      top: rect.bottom + 8,
      right: window.innerWidth - rect.right
    };
  };

  return (
    <div className="flex items-center justify-center h-full gap-2 overflow-visible">
      <div className="flex items-center gap-1 border-r border-gray-200 dark:border-white/10 pr-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setDeleteConfirm({ type: 'single', id: params.data.id, name: params.data.orderId });
          }}
          className="p-1.5 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-lg transition-colors"
          title="Delete"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="relative">
        <button
          ref={buttonRef}
          onClick={(e) => {
            e.stopPropagation();
            setIsMenuOpen(!isMenuOpen);
          }}
          className={cn(
            "p-1.5 rounded-lg transition-all duration-200",
            isMenuOpen
              ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
              : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10"
          )}
          title="Settings"
        >
          <Settings className={cn("w-4 h-4", isMenuOpen && "animate-spin")} />
        </button>

        {isMenuOpen && createPortal(
          <>
            <div className="fixed inset-0 z-[9998]" onClick={(e) => { e.stopPropagation(); setIsMenuOpen(false); }} />
            <div
              style={{
                position: 'fixed',
                top: getMenuPosition().top,
                right: getMenuPosition().right,
              }}
              className="w-56 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-xl shadow-2xl z-[9999] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-1.5 space-y-0.5">
                <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-gray-100 dark:border-white/5 mb-1">Options</div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedSubcontractId(params.data.id);
                    setBottomPanelTab('lineItems');
                    setIsMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 rounded-lg transition-colors"
                >
                  <FileText className="w-4 h-4 text-blue-500" />
                  Details
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSubcontractFormData({
                      orderId: params.data.orderId,
                      orderName: params.data.orderName,
                      orderScope: params.data.orderScope,
                      status: params.data.status,
                      paymentType: params.data.paymentType,
                      awardDate: params.data.awardDate,
                      vendorId: params.data.vendorId,
                      vendorName: params.data.vendorName,
                      vendorUsers: params.data.vendorUsers || [],
                      defaultCostCodeId: params.data.defaultCostCodeId || '',
                      defaultPhasingSource: params.data.defaultPhasingSource || 'Manual',
                      defaultStartDate: params.data.defaultStartDate || '',
                      defaultEndDate: params.data.defaultEndDate || '',
                      defaultDistribution: params.data.defaultDistribution || 'Even'
                    });
                    setEditingSubcontractId(params.data.id);
                    setIsAddingSubcontract(true);
                    setIsMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 rounded-lg transition-colors"
                >
                  <Edit2 className="w-4 h-4 text-emerald-500" />
                  Edit Details
                </button>
              </div>
            </div>
          </>,
          document.body
        )}
      </div>
    </div>
  );
};

export const InvoiceActionsCellRenderer = (params: ICellRendererParams) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { setSelectedInvoiceId, setEditingInvoiceId, setIsAddingInvoice, setInvoiceFormData, setInvoiceDeleteConfirm } = params.context;

  if (params.node.rowPinned) return null;

  const getMenuPosition = () => {
    if (!menuRef.current) return { top: 0, right: 0 };
    const rect = menuRef.current.getBoundingClientRect();
    return {
      top: rect.bottom + 5,
      right: window.innerWidth - rect.right
    };
  };

  return (
    <div className="flex items-center justify-center gap-1 h-full" ref={menuRef}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setInvoiceDeleteConfirm(params.data.id);
        }}
        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
        title="Delete Invoice"
      >
        <Trash2 className="w-4 h-4" />
      </button>

      <div className="relative">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsMenuOpen(!isMenuOpen);
          }}
          className={cn(
            "p-1.5 rounded-lg transition-all",
            isMenuOpen
              ? "bg-green-600 text-white shadow-lg shadow-green-600/20"
              : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10"
          )}
          title="Settings"
        >
          <Settings className={cn("w-4 h-4", isMenuOpen && "animate-spin")} />
        </button>

        {isMenuOpen && createPortal(
          <>
            <div className="fixed inset-0 z-[9998]" onClick={(e) => { e.stopPropagation(); setIsMenuOpen(false); }} />
            <div
              style={{
                position: 'fixed',
                top: getMenuPosition().top,
                right: getMenuPosition().right,
              }}
              className="w-56 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-xl shadow-2xl z-[9999] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-1.5 space-y-0.5">
                <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-gray-100 dark:border-white/5 mb-1">Invoice Options</div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedInvoiceId(params.data.id);
                    setIsMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 rounded-lg transition-colors"
                >
                  <FileText className="w-4 h-4 text-blue-500" />
                  Details
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setInvoiceFormData({
                      description: params.data.description,
                      submittedDate: params.data.submittedDate || '',
                      certifiedDate: params.data.certifiedDate || '',
                      paymentDate: params.data.paymentDate || '',
                      status: params.data.status
                    });
                    setEditingInvoiceId(params.data.id);
                    setIsAddingInvoice(true);
                    setIsMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 rounded-lg transition-colors"
                >
                  <Edit2 className="w-4 h-4 text-emerald-500" />
                  Edit Details
                </button>
              </div>
            </div>
          </>,
          document.body
        )}
      </div>
    </div>
  );
};
