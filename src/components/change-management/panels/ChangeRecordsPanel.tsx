import React, { useState, useRef, useMemo } from 'react';
import { Project, Enterprise, Change, ChangeRecord, CostCode } from '../../../types';
import {
  Search,
  Plus,
  Trash2,
  Download,
  Upload,
  Maximize2,
  Minimize2,
  X,
  RotateCcw,
  ClipboardList,
} from 'lucide-react';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, ColGroupDef, SideBarDef, StatusPanelDef } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';
import 'ag-grid-enterprise';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { cn } from '../../../lib/utils';
import { useChangeRepo } from '../../../platform/firestore/hooks';
import { useConfirm } from '../../ConfirmDialogProvider';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../../ui/dialog';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select';

interface ChangeRecordsPanelProps {
  project: Project;
  enterprise: Enterprise;
  theme: 'light' | 'dark';
  selectedChangeId: string | null;
  onClose: () => void;
  changes: Change[];
  changeRecords: ChangeRecord[];
  costCodes: CostCode[];
  isMainTableCollapsed: boolean;
  recordColumnDefs: (ColDef | ColGroupDef)[];
  onCellValueChanged: (params: any) => void;
}

export default function ChangeRecordsPanel({
  project,
  enterprise,
  theme,
  selectedChangeId,
  onClose,
  changes,
  changeRecords,
  costCodes,
  isMainTableCollapsed,
  recordColumnDefs,
  onCellValueChanged,
}: ChangeRecordsPanelProps) {
  const changeRepo = useChangeRepo();
  const confirmDialog = useConfirm();

  const [recordsQuickFilterText, setRecordsQuickFilterText] = useState('');
  const [selectedRecordIds, setSelectedRecordIds] = useState<Set<string>>(new Set());
  const [isBulkRecordUpdateOpen, setIsBulkRecordUpdateOpen] = useState(false);
  const [bulkRecordUpdateData, setBulkRecordUpdateData] = useState<{
    costCodeId: string;
    scope: string;
    budgetAmount: string;
    eacAmount: string;
    enterpriseAttributes: Record<string, any>;
    projectAttributes: Record<string, any>;
  }>({
    costCodeId: '',
    scope: '',
    budgetAmount: '',
    eacAmount: '',
    enterpriseAttributes: {},
    projectAttributes: {},
  });

  const recordsGridRef = useRef<AgGridReact>(null);
  const recordFileInputRef = useRef<HTMLInputElement>(null);

  const sideBar: SideBarDef = {
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
    defaultToolPanel: '',
  };

  const statusBar: { statusPanels: StatusPanelDef[] } = {
    statusPanels: [
      { statusPanel: 'agTotalAndFilteredRowCountComponent', align: 'left' },
      { statusPanel: 'agSelectedRowCountComponent', align: 'left' },
      { statusPanel: 'agAggregationComponent', align: 'right' },
    ],
  };

  const recordPinnedBottomRowData = useMemo(() => {
    if (changeRecords.length === 0) return [];
    const totalBudget = changeRecords.reduce((sum, r) => sum + (Number(r.budgetAmount) || 0), 0);
    const totalEac = changeRecords.reduce((sum, r) => sum + (Number(r.eacAmount) || 0), 0);
    return [{
      costCodeId: 'Total',
      budgetAmount: totalBudget,
      eacAmount: totalEac,
      isTotalRow: true,
    }];
  }, [changeRecords]);

  const toggleAllRecordColumnGroups = (opened: boolean) => {
    if (!recordsGridRef.current) return;
    const api = recordsGridRef.current.api;
    const groups = api.getColumnGroupState();
    const newState = groups.map(g => ({ groupId: g.groupId, open: opened }));
    api.setColumnGroupState(newState);
  };

  const handleAddRecord = async () => {
    if (!selectedChangeId) {
      toast.error('Please select a change first');
      return;
    }
    const toastId = toast.loading('Adding new record...');
    try {
      const newRecord: Omit<ChangeRecord, 'id'> = {
        changeId: selectedChangeId,
        projectId: project.id,
        costCodeId: '',
        scope: '',
        enterpriseAttributes: {},
        projectAttributes: {},
        budgetAmount: 0,
        eacAmount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await changeRepo.createChangeRecord(newRecord as any);
      toast.success('Record added', { id: toastId });
    } catch (error) {
      toast.dismiss(toastId);
      console.error(error);
      toast.error('Failed to add record');
    }
  };

  const handleExportRecords = () => {
    if (changeRecords.length === 0) {
      toast.error('No records to export');
      return;
    }
    const exportData = changeRecords.map(r => {
      const row: any = {
        'Change ID': changes.find(c => c.id === r.changeId)?.changeId || 'Unknown',
        'Cost Code': r.costCodeId,
        'Scope': r.scope,
        'Budget Amount': r.budgetAmount,
        'EAC Amount': r.eacAmount,
      };
      enterprise.lineItemAttributes?.forEach(a => {
        row[a.title] = r.enterpriseAttributes?.[a.id] || '';
      });
      project.lineItemAttributes?.forEach(a => {
        row[a.title] = r.projectAttributes?.[a.id] || '';
      });
      return row;
    });
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Change Records');
    XLSX.writeFile(wb, `${project.projectName}_Change_Records_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleImportRecords = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedChangeId) return;
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        const importCreatesR: any[] = [];
        let addedCount = 0;

        for (const row of data) {
          const costCode = String(row['Cost Code'] || '').trim();
          if (!costCode) continue;

          const entAttrs: Record<string, string> = {};
          enterprise.lineItemAttributes?.forEach(a => {
            if (row[a.title]) entAttrs[a.id] = String(row[a.title]);
          });

          const prjAttrs: Record<string, string> = {};
          project.lineItemAttributes?.forEach(a => {
            if (row[a.title]) prjAttrs[a.id] = String(row[a.title]);
          });

          importCreatesR.push({
            changeId: selectedChangeId,
            projectId: project.id,
            costCodeId: costCode,
            scope: String(row['Scope'] || '').slice(0, 100),
            enterpriseAttributes: entAttrs,
            projectAttributes: prjAttrs,
            budgetAmount: Number(row['Budget Amount']) || 0,
            eacAmount: Number(row['EAC Amount']) || 0,
          });
          addedCount++;
        }

        if (addedCount > 0) {
          await Promise.all(importCreatesR.map(r => changeRepo.createChangeRecord(r)));
          toast.success(`Imported ${addedCount} records`);
        }
      } catch (error) {
        toast.error('Failed to import Excel file');
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const handleBulkUpdateRecords = async () => {
    if (selectedRecordIds.size === 0) return;

    try {
      const updates: any = {};
      if (bulkRecordUpdateData.costCodeId) updates.costCodeId = bulkRecordUpdateData.costCodeId;
      if (bulkRecordUpdateData.scope) updates.scope = bulkRecordUpdateData.scope.slice(0, 100);
      if (bulkRecordUpdateData.budgetAmount !== '') updates.budgetAmount = Number(bulkRecordUpdateData.budgetAmount);
      if (bulkRecordUpdateData.eacAmount !== '') updates.eacAmount = Number(bulkRecordUpdateData.eacAmount);
      Object.entries(bulkRecordUpdateData.enterpriseAttributes).forEach(([id, val]) => {
        if (val !== undefined && val !== '') updates[`enterpriseAttributes.${id}`] = val;
      });
      Object.entries(bulkRecordUpdateData.projectAttributes).forEach(([id, val]) => {
        if (val !== undefined && val !== '') updates[`projectAttributes.${id}`] = val;
      });

      await changeRepo.updateManyChangeRecords([...selectedRecordIds].map(id => ({ id, data: updates })));

      toast.success(`Updated ${selectedRecordIds.size} records`);
      setIsBulkRecordUpdateOpen(false);
      setBulkRecordUpdateData({ costCodeId: '', scope: '', budgetAmount: '', eacAmount: '', enterpriseAttributes: {}, projectAttributes: {} });
      setSelectedRecordIds(new Set());
    } catch (error) {
      console.error(error);
      toast.error('Failed to update records');
    }
  };

  return (
    <>
      <AnimatePresence>
        {selectedChangeId && (
          <motion.div
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
                  <ClipboardList className="w-5 h-5 text-emerald-600" />
                  <h3 className="font-bold dark:text-white">
                    Change Records: <span className="text-emerald-600">{changes.find(c => c.id === selectedChangeId)?.changeId}</span>
                  </h3>
                </div>
                <div className="h-4 w-px bg-gray-200 dark:bg-white/10" />
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search records..."
                    value={recordsQuickFilterText}
                    onChange={(e) => setRecordsQuickFilterText(e.target.value)}
                    className="pl-9 pr-4 py-1.5 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 outline-none w-48 dark:text-white"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  ref={recordFileInputRef}
                  className="hidden"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleImportRecords}
                />
                <button
                  onClick={() => recordFileInputRef.current?.click()}
                  className="p-2 text-gray-400 hover:text-black dark:hover:text-white transition-colors"
                  title="Import Records"
                >
                  <Upload className="w-4 h-4" />
                </button>
                <button
                  onClick={handleExportRecords}
                  className="p-2 text-gray-400 hover:text-black dark:hover:text-white transition-colors"
                  title="Export Records"
                >
                  <Download className="w-4 h-4" />
                </button>

                <div className="w-px h-6 bg-gray-200 dark:bg-white/10 mx-1" />

                <button
                  onClick={() => toggleAllRecordColumnGroups(true)}
                  className="p-2 text-gray-400 hover:text-black dark:hover:text-white transition-colors"
                  title="Expand All Groups"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => toggleAllRecordColumnGroups(false)}
                  className="p-2 text-gray-400 hover:text-black dark:hover:text-white transition-colors"
                  title="Collapse All Groups"
                >
                  <Minimize2 className="w-4 h-4" />
                </button>

                <div className="w-px h-6 bg-gray-200 dark:bg-white/10 mx-1" />

                {selectedRecordIds.size > 0 && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsBulkRecordUpdateOpen(true)}
                      className="flex items-center gap-2 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-700 transition-all shadow-sm"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Update ({selectedRecordIds.size})
                    </button>
                    <button
                      onClick={async () => {
                        if (await confirmDialog(`Delete ${selectedRecordIds.size} records?`)) {
                          await Promise.all([...selectedRecordIds].map(id => changeRepo.deleteChangeRecord(id)));
                          setSelectedRecordIds(new Set());
                          toast.success(`Deleted ${selectedRecordIds.size} records`);
                        }
                      }}
                      className="flex items-center gap-2 bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-red-700 transition-all shadow-sm"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete ({selectedRecordIds.size})
                    </button>
                  </div>
                )}

                <button
                  onClick={handleAddRecord}
                  className="flex items-center gap-2 px-4 py-2 bg-black dark:bg-white text-white dark:text-black rounded-xl text-sm font-bold hover:bg-black/90 dark:hover:bg-white/90 transition-all shadow-lg shadow-black/10"
                >
                  <Plus className="w-4 h-4" />
                  Add
                </button>
                <button
                  onClick={onClose}
                  className="p-2 text-gray-400 hover:text-black dark:hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 relative">
              <div className={cn(
                'absolute inset-0 ag-theme-quartz',
                theme === 'dark' ? 'ag-theme-quartz-dark' : ''
              )}>
                <AgGridReact
                  theme="legacy"
                  ref={recordsGridRef}
                  rowData={changeRecords}
                  columnDefs={recordColumnDefs}
                  pinnedTopRowData={recordPinnedBottomRowData}
                  getRowClass={(params) => {
                    if (params.node.rowPinned) return 'pinned-row-highlight';
                    return '';
                  }}
                  quickFilterText={recordsQuickFilterText}
                  onCellValueChanged={onCellValueChanged}
                  onSelectionChanged={(p) => {
                    const selectedRows = p.api.getSelectedRows();
                    const displayedSelected = selectedRows.filter(row => {
                      const node = p.api.getRowNode(row.id);
                      return node && node.displayed;
                    });
                    setSelectedRecordIds(new Set(displayedSelected.map(r => r.id)));
                  }}
                  onFilterChanged={(p) => {
                    const selectedRows = p.api.getSelectedRows();
                    const displayedSelected = selectedRows.filter(row => {
                      const node = p.api.getRowNode(row.id);
                      return node && node.displayed;
                    });
                    setSelectedRecordIds(new Set(displayedSelected.map(r => r.id)));
                  }}
                  getRowId={(params) => params.data.id}
                  rowSelection="multiple"
                  suppressRowClickSelection={true}
                  sideBar={sideBar}
                  statusBar={statusBar}
                  rowGroupPanelShow="always"
                  pivotPanelShow="always"
                  groupDisplayType="multipleColumns"
                  enableRangeSelection={true}
                  enableFillHandle={true}
                  undoRedoCellEditing={true}
                  animateRows={true}
                  defaultColDef={{
                    sortable: true,
                    filter: true,
                    resizable: true,
                    enableRowGroup: true,
                    enablePivot: true,
                    enableValue: true,
                  }}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bulk Update Records Modal */}
      <Dialog open={isBulkRecordUpdateOpen} onOpenChange={setIsBulkRecordUpdateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Bulk Update Records</DialogTitle>
            <DialogDescription>
              Update selected fields for {selectedRecordIds.size} records.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Cost Code</label>
              <Select
                value={bulkRecordUpdateData.costCodeId}
                onValueChange={(v) => setBulkRecordUpdateData({ ...bulkRecordUpdateData, costCodeId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Cost Code" />
                </SelectTrigger>
                <SelectContent>
                  {costCodes.map(c => (
                    <SelectItem key={c.id} value={c.code}>{c.code} - {c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Scope</label>
              <Input
                value={bulkRecordUpdateData.scope}
                onChange={(e) => setBulkRecordUpdateData({ ...bulkRecordUpdateData, scope: e.target.value })}
                placeholder="Enter scope..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Budget Amount</label>
                <Input
                  type="number"
                  value={bulkRecordUpdateData.budgetAmount}
                  onChange={(e) => setBulkRecordUpdateData({ ...bulkRecordUpdateData, budgetAmount: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">EAC Amount</label>
                <Input
                  type="number"
                  value={bulkRecordUpdateData.eacAmount}
                  onChange={(e) => setBulkRecordUpdateData({ ...bulkRecordUpdateData, eacAmount: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            </div>

            {/* Enterprise Attributes */}
            {enterprise.lineItemAttributes && enterprise.lineItemAttributes.length > 0 && (
              <div className="space-y-4 pt-2 border-t border-gray-100 dark:border-white/10">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Enterprise Attributes</h4>
                <div className="grid grid-cols-2 gap-4">
                  {enterprise.lineItemAttributes.map(attr => (
                    <div key={attr.id} className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{attr.title}</label>
                      <Select
                        value={bulkRecordUpdateData.enterpriseAttributes[attr.id] || ''}
                        onValueChange={val => setBulkRecordUpdateData(prev => ({
                          ...prev,
                          enterpriseAttributes: { ...prev.enterpriseAttributes, [attr.id]: val },
                        }))}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent>
                          {attr.values.map(v => (
                            <SelectItem key={v.id} value={v.id}>{v.id} - {v.description}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Project Attributes */}
            {project.lineItemAttributes && project.lineItemAttributes.length > 0 && (
              <div className="space-y-4 pt-2 border-t border-gray-100 dark:border-white/10">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Project Attributes</h4>
                <div className="grid grid-cols-2 gap-4">
                  {project.lineItemAttributes.map(attr => (
                    <div key={attr.id} className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{attr.title}</label>
                      <Select
                        value={bulkRecordUpdateData.projectAttributes[attr.id] || ''}
                        onValueChange={val => setBulkRecordUpdateData(prev => ({
                          ...prev,
                          projectAttributes: { ...prev.projectAttributes, [attr.id]: val },
                        }))}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent>
                          {attr.values.map(v => (
                            <SelectItem key={v.id} value={v.id}>{v.id} - {v.description}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBulkRecordUpdateOpen(false)}>Cancel</Button>
            <Button onClick={handleBulkUpdateRecords}>Update Records</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
