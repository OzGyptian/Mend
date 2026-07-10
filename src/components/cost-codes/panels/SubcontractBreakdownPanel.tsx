import { Briefcase, Search, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AgGridReact } from 'ag-grid-react';
import { ColDef } from 'ag-grid-community';
import { cn } from '../../../lib/utils';

interface SubcontractBreakdownPanelProps {
  selectedSubcontractBreakdownCode: string | null;
  subcontractBreakdownRows: any[];
  subcontractBreakdownPinnedBottomRowData: any[];
  subcontractBreakdownColumnDefs: ColDef[];
  subcontractQuickFilterText: string;
  isMainTableCollapsed: boolean;
  theme?: 'light' | 'dark';
  onClose: () => void;
  onQuickFilterChange: (text: string) => void;
}

export default function SubcontractBreakdownPanel({
  selectedSubcontractBreakdownCode,
  subcontractBreakdownRows,
  subcontractBreakdownPinnedBottomRowData,
  subcontractBreakdownColumnDefs,
  subcontractQuickFilterText,
  isMainTableCollapsed,
  theme,
  onClose,
  onQuickFilterChange,
}: SubcontractBreakdownPanelProps) {
  return (
    <AnimatePresence>
      {selectedSubcontractBreakdownCode && (
        <motion.div
          key={selectedSubcontractBreakdownCode}
          initial={{ height: 0, opacity: 0 }}
          animate={{
            height: isMainTableCollapsed ? 'calc(100% - 60px)' : '60%',
            opacity: 1,
          }}
          exit={{ height: 0, opacity: 0 }}
          className="border-t border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#0a0a0a] flex flex-col overflow-hidden"
        >
          <div className="p-4 flex items-center justify-between bg-white dark:bg-[#141414] border-b border-gray-200 dark:border-white/10">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-green-600" />
                <h3 className="font-bold dark:text-white">
                  Related Subcontracts:{' '}
                  <span className="text-green-600">{selectedSubcontractBreakdownCode}</span>
                </h3>
              </div>
              <div className="h-4 w-px bg-gray-200 dark:border-white/10" />
              <p className="text-xs text-gray-500 font-medium">Read-Only View</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search subcontracts..."
                  value={subcontractQuickFilterText}
                  onChange={(e) => onQuickFilterChange(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg text-xs focus:ring-2 focus:ring-green-500 outline-none w-48 dark:text-white"
                />
              </div>
              <div className="h-4 w-px bg-gray-200 dark:border-white/10 mx-1" />
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-black dark:hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="flex-1 min-h-0 relative">
            <div
              className={cn(
                'absolute inset-0 ag-theme-quartz',
                theme === 'dark' ? 'ag-theme-quartz-dark' : ''
              )}
            >
              <AgGridReact
                theme="legacy"
                rowData={subcontractBreakdownRows}
                pinnedBottomRowData={subcontractBreakdownPinnedBottomRowData}
                getRowClass={(params) => {
                  if (params.node.rowPinned === 'bottom')
                    return 'font-bold bg-gray-50 dark:bg-white/5';
                  return '';
                }}
                columnDefs={subcontractBreakdownColumnDefs}
                quickFilterText={subcontractQuickFilterText}
                defaultColDef={{
                  sortable: true,
                  filter: true,
                  resizable: true,
                  minWidth: 100,
                }}
                animateRows={true}
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
