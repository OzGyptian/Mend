import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { CostCode } from '../../types';
import { cn } from '../../lib/utils';
import {
  Edit2,
  Trash2,
  Settings,
  ClipboardList,
  History,
  Activity,
  Target,
  RefreshCw,
  Briefcase,
} from 'lucide-react';

export const ActionsCellRenderer = (params: any) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  if (params.node.footer || params.node.rowPinned === 'top') return null;

  const code = params.data as CostCode;
  const {
    setFormData,
    setIsEditing,
    setSelectedEtcCode,
    selectedEtcCode,
    setSelectedActualsCode,
    selectedActualsCode,
    setSelectedTimephasingCode,
    selectedTimephasingCode,
    setSelectedChangesCode,
    selectedChangesCode,
    setSelectedBaselineCode,
    selectedBaselineCode,
    setSelectedSubcontractBreakdownCode,
    selectedSubcontractBreakdownCode,
    setDeleteConfirm
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
            setFormData({
              code: code.code,
              name: code.name,
              enterpriseAttributes: code.enterpriseAttributes || {},
              projectAttributes: code.projectAttributes || {},
              eacMethod: code.eacMethod || 'Manual',
              assignedUsers: code.assignedUsers || []
            });
            setIsEditing({ id: code.id });
          }}
          className="p-1.5 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-lg transition-colors"
          title="Edit"
        >
          <Edit2 className="w-4 h-4" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setDeleteConfirm({ type: 'single', id: code.id, name: code.code });
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
          title="Modules"
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
                <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-gray-100 dark:border-white/5 mb-1">Modules</div>
                {code.eacMethod === 'ETC Details' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedEtcCode(selectedEtcCode === code.code ? null : code.code);
                      setIsMenuOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 text-xs font-semibold rounded-lg transition-colors",
                      selectedEtcCode === code.code
                        ? "bg-orange-100 text-orange-700 dark:bg-orange-900/40"
                        : "text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5"
                    )}
                  >
                    <ClipboardList className="w-4 h-4 text-orange-500" />
                    ETC Details
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedActualsCode(selectedActualsCode === code.code ? null : code.code);
                    if (selectedActualsCode !== code.code) setSelectedEtcCode(null);
                    setIsMenuOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 text-xs font-semibold rounded-lg transition-colors",
                    selectedActualsCode === code.code
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40"
                      : "text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5"
                  )}
                >
                  <History className="w-4 h-4 text-blue-500" />
                  Actual Cost
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedTimephasingCode(selectedTimephasingCode === code.code ? null : code.code);
                    if (selectedTimephasingCode !== code.code) {
                      setSelectedEtcCode(null);
                      setSelectedActualsCode(null);
                    }
                    setIsMenuOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 text-xs font-semibold rounded-lg transition-colors",
                    selectedTimephasingCode === code.code
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40"
                      : "text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5"
                  )}
                >
                  <Activity className="w-4 h-4 text-emerald-500" />
                  Timephasing
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedBaselineCode(selectedBaselineCode === code.code ? null : code.code);
                    if (selectedBaselineCode !== code.code) {
                      setSelectedEtcCode(null);
                      setSelectedActualsCode(null);
                      setSelectedTimephasingCode(null);
                      setSelectedChangesCode(null);
                    }
                    setIsMenuOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 text-xs font-semibold rounded-lg transition-colors",
                    selectedBaselineCode === code.code
                      ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40"
                      : "text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5"
                  )}
                >
                  <Target className="w-4 h-4 text-amber-500" />
                  Baseline Budget
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedChangesCode(selectedChangesCode === code.code ? null : code.code);
                    if (selectedChangesCode !== code.code) {
                      setSelectedEtcCode(null);
                      setSelectedActualsCode(null);
                      setSelectedTimephasingCode(null);
                    }
                    setIsMenuOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 text-xs font-semibold rounded-lg transition-colors",
                    selectedChangesCode === code.code
                      ? "bg-purple-100 text-purple-700 dark:bg-purple-900/40"
                      : "text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5"
                  )}
                >
                  <RefreshCw className="w-4 h-4 text-purple-500" />
                  Changes
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedSubcontractBreakdownCode(selectedSubcontractBreakdownCode === code.code ? null : code.code);
                    if (selectedSubcontractBreakdownCode !== code.code) {
                      setSelectedEtcCode(null);
                      setSelectedActualsCode(null);
                      setSelectedTimephasingCode(null);
                      setSelectedChangesCode(null);
                      setSelectedBaselineCode(null);
                    }
                    setIsMenuOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 text-xs font-semibold rounded-lg transition-colors",
                    selectedSubcontractBreakdownCode === code.code
                      ? "bg-green-100 text-green-700 dark:bg-green-900/40"
                      : "text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5"
                  )}
                >
                  <Briefcase className="w-4 h-4 text-green-500" />
                  Sub-Contract
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
