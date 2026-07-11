import React, { useState, useRef } from 'react';
import { Risk, RiskRecord } from '../../../types';
import {
  Search,
  Plus,
  Trash2,
  Download,
  Upload,
  Maximize2,
  Minimize2,
  X,
  Database,
} from 'lucide-react';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, ColGroupDef } from 'ag-grid-community';
import { motion } from 'motion/react';

interface RiskRecordsPanelProps {
  selectedRiskId: string;
  risks: Risk[];
  riskRecords: RiskRecord[];
  recordColumnDefs: (ColDef | ColGroupDef)[];
  recordPinnedBottomRowData: object[];
  isMainTableCollapsed: boolean;
  onClose: () => void;
  onAddRecord: () => void;
  onCellValueChanged: (params: any) => void;
  onImportRecords: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBulkUpdateOpen: () => void;
  onBulkDeleteOpen: () => void;
  onSelectionChanged: (selectedIds: Set<string>) => void;
  selectedRecordCount: number;
  theme: 'light' | 'dark';
  projectCode: string;
}

export default function RiskRecordsPanel({
  selectedRiskId,
  risks,
  riskRecords,
  recordColumnDefs,
  recordPinnedBottomRowData,
  isMainTableCollapsed,
  onClose,
  onAddRecord,
  onCellValueChanged,
  onImportRecords,
  onBulkUpdateOpen,
  onBulkDeleteOpen,
  onSelectionChanged,
  selectedRecordCount,
  theme,
  projectCode,
}: RiskRecordsPanelProps) {
  const [recordsQuickFilterText, setRecordsQuickFilterText] = useState('');
  const recordsGridRef = useRef<AgGridReact>(null);
  const recordFileInputRef = useRef<HTMLInputElement>(null);

  const handleExportRecords = () => {
    if (recordsGridRef.current?.api) {
      recordsGridRef.current.api.exportDataAsExcel({
        fileName: `${projectCode}_Risk_Records_${selectedRiskId}_${new Date().toISOString().split('T')[0]}.xlsx`,
      });
    }
  };

  const toggleAllRecordColumnGroups = (opened: boolean) => {
    if (!recordsGridRef.current) return;
    const api = recordsGridRef.current.api;
    const groups = api.getColumnGroupState();
    const newState = groups.map(g => ({ groupId: g.groupId, open: opened }));
    api.setColumnGroupState(newState);
  };

  return (
    <motion.div
      initial={{ height: 0 }}
      animate={{ height: isMainTableCollapsed ? 'calc(100% - 60px)' : '60%' }}
      exit={{ height: 0 }}
      className="border-t border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#0a0a0a] flex flex-col overflow-hidden"
    >
      <div className="flex items-center justify-between px-4 py-2 bg-gray-100 dark:bg-white/5 border-b border-gray-200 dark:border-white/10 shrink-0">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-blue-600" />
            <span className="text-xs font-bold uppercase tracking-wider dark:text-white">
              Risk Impacts: <span className="text-blue-600 ml-1">{risks.find(r => r.id === selectedRiskId)?.riskId}</span>
            </span>
          </div>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search records..."
              value={recordsQuickFilterText}
              onChange={(e) => setRecordsQuickFilterText(e.target.value)}
              className="pl-8 pr-3 py-1 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-lg text-[10px] w-48 dark:text-white outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={recordFileInputRef}
            className="hidden"
            accept=".xlsx,.xls"
            onChange={onImportRecords}
          />
          <button
            onClick={() => recordFileInputRef.current?.click()}
            className="p-1.5 text-gray-400 hover:text-black dark:hover:text-white transition-colors"
            title="Import Records"
          >
            <Upload className="w-4 h-4" />
          </button>
          <button
            onClick={handleExportRecords}
            className="p-1.5 text-gray-400 hover:text-black dark:hover:text-white transition-colors"
            title="Export Records"
          >
            <Download className="w-4 h-4" />
          </button>

          <div className="w-px h-4 bg-gray-200 dark:bg-white/10 mx-1" />

          <button
            onClick={() => toggleAllRecordColumnGroups(true)}
            className="p-1.5 text-gray-400 hover:text-black dark:hover:text-white transition-colors"
            title="Expand All"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => toggleAllRecordColumnGroups(false)}
            className="p-1.5 text-gray-400 hover:text-black dark:hover:text-white transition-colors"
            title="Collapse All"
          >
            <Minimize2 className="w-3.5 h-3.5" />
          </button>

          <div className="w-px h-4 bg-gray-200 dark:border-white/10 mx-1" />

          {selectedRecordCount > 0 && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={onBulkUpdateOpen}
                className="px-2 py-1 bg-blue-600 text-white rounded text-[10px] font-bold shadow-lg shadow-blue-600/20 hover:bg-blue-700"
              >
                Update ({selectedRecordCount})
              </button>
              <button
                onClick={onBulkDeleteOpen}
                className="px-2 py-1 bg-red-600 text-white rounded text-[10px] font-bold shadow-lg shadow-red-600/20 hover:bg-red-700"
              >
                Delete ({selectedRecordCount})
              </button>
            </div>
          )}
          <button
            onClick={onAddRecord}
            className="flex items-center gap-1.5 px-3 py-1 bg-blue-600 text-white rounded-lg text-[10px] font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20"
          >
            <Plus className="w-3 h-3" /> Add Impact
          </button>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-200 dark:hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-4 h-4 dark:text-white" />
          </button>
        </div>
      </div>
      <div className={`flex-1 relative ${theme === 'dark' ? 'ag-theme-quartz-dark' : 'ag-theme-quartz'}`}>
        <AgGridReact
          theme="legacy"
          ref={recordsGridRef}
          rowData={riskRecords}
          columnDefs={recordColumnDefs}
          onCellValueChanged={onCellValueChanged}
          quickFilterText={recordsQuickFilterText}
          pinnedBottomRowData={recordPinnedBottomRowData}
          rowSelection="multiple"
          onSelectionChanged={(p) => onSelectionChanged(new Set(p.api.getSelectedRows().map((r: any) => r.id)))}
          defaultColDef={{ sortable: true, filter: true, resizable: true }}
        />
      </div>
    </motion.div>
  );
}
