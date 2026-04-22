import React, { ReactNode } from 'react';
import { Search, Plus, Trash2, Edit2, Upload, Download, Calculator, ChevronDown, ChevronUp, Hash, Calendar, RefreshCw } from 'lucide-react';
import { AgGridReact } from 'ag-grid-react';
import { cn } from '../lib/utils';
import { Project } from '../types';

interface DataGridModuleProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  
  // Toolbar
  searchPlaceholder?: string;
  quickFilterText?: string;
  onQuickFilterChange?: (text: string) => void;
  onImport?: () => void;
  onExport?: () => void;
  onAdd?: () => void;
  onCalculate?: () => void;
  isCalculating?: boolean;
  
  // Bulk Actions
  selectedCount?: number;
  onBulkUpdate?: () => void;
  onBulkDelete?: () => void;
  
  // Extra Actions
  extraToolbarActions?: ReactNode;
  
  // Grid
  gridRef?: React.RefObject<AgGridReact>;
  rowData: any[];
  columnDefs: any[];
  pinnedTopRowData?: any[];
  pinnedBottomRowData?: any[];
  gridProps?: any;
  theme?: 'light' | 'dark';
  onCellValueChanged?: (event: any) => void;
  sideBar?: any;
  statusBar?: any;
  autoGroupColumnDef?: any;
  
  // Collapse logic (for split view)
  isMainTableCollapsed?: boolean;
  onToggleMainTableCollapse?: () => void;
  hasSubContent?: boolean;
  
  // Project context (for current period)
  project?: Project;
  showCurrentPeriod?: boolean;

  // Top content (summary cards, charts, etc)
  topContent?: ReactNode;
}

const DataGridModule: React.FC<DataGridModuleProps> = ({
  title,
  description,
  icon,
  searchPlaceholder = "Search...",
  quickFilterText,
  onQuickFilterChange,
  onImport,
  onExport,
  onAdd,
  onCalculate,
  isCalculating,
  selectedCount = 0,
  onBulkUpdate,
  onBulkDelete,
  extraToolbarActions,
  gridRef,
  rowData,
  columnDefs,
  pinnedTopRowData,
  pinnedBottomRowData,
  gridProps = {},
  theme = 'light',
  onCellValueChanged,
  sideBar,
  statusBar,
  autoGroupColumnDef,
  isMainTableCollapsed = false,
  onToggleMainTableCollapse,
  hasSubContent = false,
  project,
  showCurrentPeriod = false,
  topContent
}) => {
  const finalColumnDefs = React.useMemo(() => {
    if (!columnDefs || columnDefs.length === 0) return [];
    
    // Helper to check for checkbox selection in nested groups
    const hasCheckboxInDefs = (defs: any[]): boolean => {
      return defs.some(col => {
        if (col.children) return hasCheckboxInDefs(col.children);
        return col.checkboxSelection;
      });
    };

    const hasCheckbox = hasCheckboxInDefs(columnDefs);

    // Helper to map and inject checkbox settings recursively
    const injectCheckboxSettings = (defs: any[]): any[] => {
      return defs.map(col => {
        if (col.children) {
          return { ...col, children: injectCheckboxSettings(col.children) };
        }
        if (col.checkboxSelection) {
          return {
            ...col,
            checkboxSelection: (typeof col.checkboxSelection === 'function' && !col.checkboxSelection.toString().includes('rowPinned')) 
              ? col.checkboxSelection 
              : (params: any) => !params.node?.rowPinned,
            headerCheckboxSelectionFilteredOnly: true
          };
        }
        return col;
      });
    };

    if (hasCheckbox) {
      return injectCheckboxSettings(columnDefs);
    }
    return [
      {
        headerName: '',
        width: 50,
        checkboxSelection: (params: any) => !params.node?.rowPinned,
        headerCheckboxSelection: true,
        headerCheckboxSelectionFilteredOnly: true,
        pinned: 'left',
        lockPosition: 'left',
        suppressMenu: true,
        suppressMovable: true,
        suppressColumnsToolPanel: true,
        headerClass: 'bg-gray-50 dark:bg-[#1a1a1a]',
        cellClass: 'bg-white dark:bg-[#141414]'
      },
      ...columnDefs
    ];
  }, [columnDefs]);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-[#141414] border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden">
      {/* Header / Toolbar */}
      <div className="p-6 border-b border-gray-100 dark:border-white/10 flex justify-between items-center bg-gray-50/50 dark:bg-white/5 shrink-0">
        <div>
          <h3 className="text-xl font-bold dark:text-white">{title}</h3>
          {description && <p className="text-sm text-gray-900 dark:text-gray-400">{description}</p>}
        </div>
        <div className="flex gap-2">
          {onQuickFilterChange && (
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input 
                type="text" 
                placeholder={searchPlaceholder}
                value={quickFilterText}
                onChange={(e) => onQuickFilterChange(e.target.value)}
                className="pl-10 pr-4 py-2 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none w-64 dark:text-white"
              />
            </div>
          )}
          
          {onImport && (
            <button onClick={onImport} className="p-2 text-gray-400 hover:text-black dark:hover:text-white transition-colors" title="Import">
              <Upload className="w-5 h-5" />
            </button>
          )}
          {onExport && (
            <button onClick={onExport} className="p-2 text-gray-400 hover:text-black dark:hover:text-white transition-colors" title="Export">
              <Download className="w-5 h-5" />
            </button>
          )}
          
          {(onImport || onExport) && <div className="w-px h-6 bg-gray-200 dark:bg-white/10 mx-1" />}
          
          {extraToolbarActions}
          
          {onCalculate && (
            <button 
              onClick={onCalculate} 
              disabled={isCalculating}
              className="px-4 py-2 bg-black dark:bg-white text-white dark:text-black rounded-xl text-sm font-bold flex items-center gap-2 hover:opacity-90 transition-all shadow-lg shadow-black/10 disabled:opacity-50"
            >
              {isCalculating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />}
              Calculate
            </button>
          )}

          {selectedCount > 1 && (
            <div className="flex gap-2">
              {onBulkUpdate && (
                <button onClick={onBulkUpdate} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20">
                  <Edit2 className="w-4 h-4" /> Bulk Update ({selectedCount})
                </button>
              )}
              {onBulkDelete && (
                <button onClick={onBulkDelete} className="px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-red-700 transition-colors shadow-lg shadow-red-600/20">
                  <Trash2 className="w-4 h-4" /> Delete ({selectedCount})
                </button>
              )}
            </div>
          )}

          {onAdd && (
            <button onClick={onAdd} className="flex items-center gap-2 bg-black dark:bg-white text-white dark:text-black px-4 py-2 rounded-lg text-sm font-medium hover:bg-black/90 dark:hover:bg-white/90 transition-all shadow-lg shadow-black/10">
              <Plus className="w-4 h-4" /> Add
            </button>
          )}
        </div>
      </div>

      {/* Top Content (Summary Cards, Charts) */}
      {topContent && (
        <div className="p-6 border-b border-gray-100 dark:border-white/10 bg-gray-50/30 dark:bg-white/5 shrink-0 overflow-y-auto max-h-[40%]">
          {topContent}
        </div>
      )}

      {/* Table Area */}
      <div className={cn(
        "flex flex-col transition-all duration-500 ease-in-out overflow-hidden",
        hasSubContent 
          ? (isMainTableCollapsed ? "h-[60px]" : "h-[40%]") 
          : "flex-1"
      )}>
        <div className="flex items-center justify-between px-4 py-1.5 bg-gray-50 dark:bg-white/5 border-b border-gray-200 dark:border-white/10 shrink-0">
          <div className="flex items-center gap-6">
            {showCurrentPeriod && project?.reportingPeriods?.currentPeriodId && (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-blue-600" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-blue-600">Current Period:</span>
                </div>
                {(() => {
                  const currentPeriod = project.reportingPeriods?.periods.find(p => p.id === project.reportingPeriods?.currentPeriodId);
                  if (!currentPeriod) return null;
                  
                  const date = new Date(currentPeriod.endDate);
                  const month = date.toLocaleString('default', { month: 'short' });
                  const year = date.getFullYear().toString().slice(-2);
                  const periodNumber = project.reportingPeriods.periods.indexOf(currentPeriod) + 1;
                  const dateStr = `P${periodNumber} (${month}'${year})`;
                  
                  return (
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-blue-600">{dateStr}</span>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
          {hasSubContent && onToggleMainTableCollapse && (
            <button 
              onClick={onToggleMainTableCollapse}
              className="p-1 hover:bg-gray-200 dark:hover:bg-white/10 rounded-md transition-colors text-gray-500"
              title={isMainTableCollapsed ? "Expand Table" : "Collapse Table"}
            >
              {isMainTableCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
          )}
        </div>
        <div className="flex-1 min-h-0 relative">
          <div className={cn(
            "absolute inset-0 ag-theme-quartz",
            theme === 'dark' ? "ag-theme-quartz-dark" : ""
          )}>
            <AgGridReact
              ref={gridRef}
              rowData={rowData}
              columnDefs={finalColumnDefs}
              pinnedTopRowData={pinnedTopRowData}
              pinnedBottomRowData={pinnedBottomRowData}
              quickFilterText={quickFilterText}
              animateRows={true}
              enableRangeSelection={true}
              enableFillHandle={true}
              undoRedoCellEditing={true}
              pagination={true}
              paginationPageSize={50}
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
                ...gridProps.defaultColDef
              }}
              sideBar={sideBar || {
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
                  }
                ],
                defaultToolPanel: ''
              }}
              statusBar={statusBar || {
                statusPanels: [
                  { statusPanel: 'agTotalAndFilteredRowCountComponent', align: 'left' },
                  { statusPanel: 'agTotalRowCountComponent', align: 'center' },
                  { statusPanel: 'agFilteredRowCountComponent', align: 'center' },
                  { statusPanel: 'agSelectedRowCountComponent', align: 'center' },
                  { statusPanel: 'agAggregationComponent', align: 'right' },
                ],
              }}
              autoGroupColumnDef={autoGroupColumnDef}
              onCellValueChanged={onCellValueChanged}
              suppressRowClickSelection={true}
              getRowClass={(params) => {
                if (params.node.rowPinned) {
                  return 'pinned-row-highlight';
                }
                return undefined;
              }}
              rowSelection="multiple"
              {...gridProps}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default DataGridModule;
