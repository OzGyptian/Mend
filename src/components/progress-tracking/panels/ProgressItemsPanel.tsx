import React, { useState, useMemo, useRef } from 'react';
import { Project, Enterprise, ProgressPackage, ProgressItem, CostCode } from '../../../types';
import {
  Activity,
  Download,
  Upload,
  PlusCircle,
  Settings,
  X,
} from 'lucide-react';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, ColGroupDef } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';
import 'ag-grid-enterprise';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { cn } from '../../../lib/utils';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../../ui/dialog';
import { useProgressRepo } from '../../../platform/firestore/hooks';

interface ProgressItemsPanelProps {
  project: Project;
  enterprise: Enterprise;
  theme: 'light' | 'dark';
  selectedPackageId: string | null;
  selectedPackage: ProgressPackage | undefined;
  isMainTableCollapsed: boolean;
  items: ProgressItem[];
  processedItems: any[];
  pinnedTopRowData: any[];
  itemColumnDefs: (ColDef | ColGroupDef)[];
  costCodes: CostCode[];
  onCloseDetails: () => void;
}

export default function ProgressItemsPanel({
  project,
  enterprise,
  theme,
  selectedPackageId,
  selectedPackage,
  isMainTableCollapsed,
  items,
  processedItems,
  pinnedTopRowData,
  itemColumnDefs,
  costCodes,
  onCloseDetails,
}: ProgressItemsPanelProps) {
  const progressRepo = useProgressRepo();

  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [isItemBulkUpdateOpen, setIsItemBulkUpdateOpen] = useState(false);
  const [isPackageSettingsOpen, setIsPackageSettingsOpen] = useState(false);
  const [itemBulkUpdateData, setItemBulkUpdateData] = useState({ field: '', value: '' });
  const [itemsToAddCount, setItemsToAddCount] = useState(1);

  const itemsGridRef = useRef<AgGridReact>(null);

  const parseGridDate = (val: any) => {
    if (!val) return null;
    const date = val instanceof Date ? val : new Date(val);
    if (isNaN(date.getTime())) return null;
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const handleAddItem = async () => {
    if (!selectedPackageId || !selectedPackage) return;

    try {
      const selectedNodes = itemsGridRef.current?.api.getSelectedNodes();
      let insertAfterOrder = 0;

      if (selectedNodes && selectedNodes.length > 0) {
        const lastSelected = selectedNodes[selectedNodes.length - 1].data as ProgressItem;
        insertAfterOrder = lastSelected.sortOrder || 0;

        const itemsToShift = items.filter(i => (i.sortOrder || 0) > insertAfterOrder);
        if (itemsToShift.length > 0) {
          await progressRepo.updateManyProgressItems(
            itemsToShift.map(item => ({
              id: item.id,
              data: { sortOrder: (item.sortOrder || 0) + itemsToAddCount },
            }))
          );
        }
      } else {
        const maxOrder = items.length > 0 ? Math.max(...items.map(i => i.sortOrder || 0)) : 0;
        insertAfterOrder = maxOrder;
      }

      const newItems = Array.from({ length: itemsToAddCount }, (_, i) => ({
        projectId: project.id,
        packageId: selectedPackage.packageId,
        packageDocId: selectedPackageId,
        itemId: `Item-${items.length + i + 1}`,
        description: 'New Item',
        costCodeId: '',
        totalQty: 0,
        plannedStartDate: selectedPackage.defaultStartDate || new Date().toISOString().split('T')[0],
        plannedEndDate: selectedPackage.defaultEndDate || new Date().toISOString().split('T')[0],
        phasingMethod: selectedPackage.defaultPhasingMethod || 'Auto',
        phasingCurve: selectedPackage.defaultPhasingCurve || 'even',
        currentStartDate: selectedPackage.defaultStartDate || new Date().toISOString().split('T')[0],
        currentEndDate: selectedPackage.defaultEndDate || new Date().toISOString().split('T')[0],
        currentPhasingMethod: selectedPackage.defaultPhasingMethod || 'Auto',
        currentPhasingCurve: selectedPackage.defaultPhasingCurve || 'even',
        sortOrder: insertAfterOrder + i + 1,
      }));

      await Promise.all(newItems.map(item => progressRepo.createProgressItem(item as any)));
      setItemsToAddCount(1);
      toast.success(`Added ${itemsToAddCount} item(s)`);
    } catch (error) {
      console.error('Error adding items:', error);
      toast.error('Failed to add items');
    }
  };

  const handleItemBulkDelete = async () => {
    if (selectedItemIds.length === 0) return;
    if (!window.confirm(`Delete ${selectedItemIds.length} commodity items?`)) return;
    try {
      await Promise.all(selectedItemIds.map(id => progressRepo.deleteProgressItem(id)));
      toast.success(`Deleted ${selectedItemIds.length} commodity items`);
      setSelectedItemIds([]);
    } catch (error) {
      console.error('Item bulk delete failed', error);
      toast.error('Failed to perform bulk delete for commodity items');
    }
  };

  const handleItemBulkUpdate = async () => {
    if (!itemBulkUpdateData.field || selectedItemIds.length === 0) return;

    try {
      const bulkItemUpdates: Array<{ id: string; data: any }> = [];
      selectedItemIds.forEach(id => {
        let value: any = itemBulkUpdateData.value;
        if (itemBulkUpdateData.field.toLowerCase().includes('date')) {
          value = parseGridDate(value);
        } else if (itemBulkUpdateData.field === 'totalQty') {
          value = parseFloat(value) || 0;
        }

        if (value !== undefined) bulkItemUpdates.push({ id, data: { [itemBulkUpdateData.field]: value } });
      });
      await progressRepo.updateManyProgressItems(bulkItemUpdates);
      toast.success(`Updated ${selectedItemIds.length} commodity items`);
      setIsItemBulkUpdateOpen(false);
      setSelectedItemIds([]);
    } catch (error) {
      console.error('Item bulk update failed', error);
      toast.error('Failed to perform bulk update for commodity items');
    }
  };

  const exportItemsToExcel = () => {
    if (!selectedPackageId || !selectedPackage) return;
    const data = items.map(i => ({
      'Commodity Item ID': i.itemId,
      'Description': i.description,
      'Cost Code': i.costCodeId,
      'Total Qty': i.totalQty,
      'Unit': selectedPackage.unit || 'EA',
      'Pl Start': i.plannedStartDate,
      'Pl End': i.plannedEndDate,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Commodity Items');
    XLSX.writeFile(wb, `Commodity_Items_${selectedPackageId}.xlsx`);
    toast.success('Exported Commodity Items to Excel');
  };

  const handleItemImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedPackageId || !selectedPackage) return;
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        const importItemUpdates: Array<{ id: string; data: any }> = [];
        const importItemCreates: any[] = [];
        let count = 0;

        for (const row of data) {
          const itemId = (row['Commodity Item ID'] || row['Item ID'] || row['itemId'])?.toString();
          if (!itemId) continue;
          const existing = items.find(i => i.itemId === itemId);
          const payload = {
            itemId,
            description: row['Description']?.toString() || '',
            costCodeId: row['Cost Code']?.toString() || '',
            totalQty: parseFloat(row['Total Qty']) || 0,
            plannedStartDate: row['Pl Start']?.toString() || '',
            plannedEndDate: row['Pl End']?.toString() || '',
            projectId: project.id,
            packageId: selectedPackage.packageId,
            packageDocId: selectedPackageId,
          };
          if (existing) importItemUpdates.push({ id: existing.id, data: payload });
          else importItemCreates.push(payload);
          count++;
        }

        await Promise.all([
          ...importItemUpdates.map(u => progressRepo.updateProgressItem(u.id, u.data)),
          ...importItemCreates.map(c => progressRepo.createProgressItem(c as any)),
        ]);
        toast.success(`Imported ${count} commodity items`);
      } catch (error) {
        console.error('Import error:', error);
        toast.error('Failed to import commodity items');
      } finally {
        if (e.target) e.target.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  const updatePackage = async (pkgId: string, updates: any) => {
    try {
      await progressRepo.updateProgressPackage(pkgId, updates);
    } catch (error) {
      console.error('Update package failed', error);
      toast.error('Failed to update commodity');
    }
  };

  return (
    <>
      <AnimatePresence>
        {selectedPackageId && selectedPackage && (
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
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-blue-600" />
                  <h3 className="font-bold dark:text-white flex items-center gap-2">
                    Commodity Items for: <span className="text-blue-600 font-mono">{selectedPackage.packageId}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-gray-400 hover:text-blue-600 ml-1"
                      onClick={() => setIsPackageSettingsOpen(true)}
                      title="Package Settings & Defaults"
                    >
                      <Settings className="w-3.5 h-3.5" />
                    </Button>
                  </h3>
                </div>
                {selectedItemIds.length > 0 && (
                  <div className="flex items-center gap-2 ml-4 pr-4 border-r border-gray-200 dark:border-white/10">
                    <span className="text-xs font-bold text-blue-600 dark:text-blue-400">{selectedItemIds.length} Selected</span>
                    <Button
                      onClick={() => setIsItemBulkUpdateOpen(true)}
                      className="h-8 rounded-lg font-bold bg-black hover:bg-slate-800 text-white dark:bg-white dark:text-black"
                    >
                      Update
                    </Button>
                    <Button
                      onClick={handleItemBulkDelete}
                      className="h-8 rounded-lg font-bold bg-black hover:bg-slate-800 text-white dark:bg-white dark:text-black"
                    >
                      Delete
                    </Button>
                  </div>
                )}

                <Button variant="ghost" size="sm" onClick={exportItemsToExcel} className="h-8 text-xs font-bold text-emerald-600">
                  <Download className="w-3 h-3 mr-1.5" />
                  Export
                </Button>

                <div className="relative">
                  <input
                    type="file"
                    accept=".xlsx, .xls, .csv"
                    onChange={handleItemImport}
                    className="hidden"
                    id="item-import"
                  />
                  <label
                    htmlFor="item-import"
                    className="cursor-pointer flex items-center h-8 px-2 text-xs font-bold text-blue-600 hover:bg-blue-50 border border-blue-100 rounded-lg"
                  >
                    <Upload className="w-3 h-3 mr-1.5" />
                    Import
                  </label>
                </div>

                <div className="flex items-center gap-2 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg px-2 h-8">
                  <Input
                    type="number"
                    value={itemsToAddCount}
                    onChange={e => setItemsToAddCount(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-12 h-6 border-none bg-transparent p-0 text-center text-xs font-bold focus-visible:ring-0"
                  />
                  <Button
                    size="sm"
                    onClick={handleAddItem}
                    className="h-6 px-2 bg-black dark:bg-white text-white dark:text-black rounded-md text-[10px] font-bold flex items-center gap-1 transition-all shadow-sm"
                  >
                    <PlusCircle className="w-3 h-3" />
                    Add Item(s)
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total Items</p>
                  <p className="text-sm font-bold dark:text-white">{items.length}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onCloseDetails}
                  className="h-8 text-xs"
                >
                  Close Details
                </Button>
              </div>
            </div>
            <div className="flex-1 min-h-0 relative">
              <div className={cn(
                'absolute inset-0 ag-theme-quartz',
                theme === 'dark' ? 'ag-theme-quartz-dark' : ''
              )}>
                <AgGridReact
                  theme="legacy"
                  ref={itemsGridRef}
                  rowData={processedItems}
                  columnDefs={itemColumnDefs}
                  animateRows={true}
                  getRowId={params => params.data.rowId}
                  suppressRowTransform={true}
                  rowSelection="multiple"
                  suppressRowClickSelection={true}
                  onSelectionChanged={p => {
                    const rows = p.api.getSelectedRows();
                    const ids = Array.from(new Set(rows.map((r: any) => r.id)));
                    setSelectedItemIds(ids as string[]);
                  }}
                  rowClassRules={{
                    'bg-gray-50/20 dark:bg-gray-800/10': (params: any) => {
                      const itemIndex = Math.floor(params.node.rowIndex / 2);
                      return itemIndex % 2 === 1;
                    },
                    'border-b border-gray-200 dark:border-gray-700': (params: any) => params.data.rowType === 'Current',
                  }}
                  singleClickEdit={true}
                  stopEditingWhenCellsLoseFocus={true}
                  enableFillHandle={true}
                  cellSelection={true}
                  pinnedTopRowData={pinnedTopRowData}
                  getRowStyle={params => {
                    if (params.node.rowPinned === 'top') {
                      return { fontWeight: 'bold', backgroundColor: theme === 'dark' ? '#1e293b' : '#f8fafc' };
                    }
                  }}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Item Bulk Update Modal */}
      <Dialog open={isItemBulkUpdateOpen} onOpenChange={setIsItemBulkUpdateOpen}>
        <DialogContent className="max-w-md bg-white dark:bg-[#1a1a1a] border dark:border-white/10 rounded-2xl shadow-2xl p-0 overflow-hidden">
          <div className="bg-blue-600 p-6 text-white flex items-center gap-3">
            <Activity className="w-6 h-6" />
            <div>
              <DialogTitle className="text-xl font-bold">Bulk Update Items</DialogTitle>
              <p className="text-xs text-blue-100 mt-1 opacity-80">Updating {selectedItemIds.length} selected items</p>
            </div>
          </div>
          <div className="p-6 space-y-5">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Select Field</label>
              <Select onValueChange={(val: string) => setItemBulkUpdateData(prev => ({ ...prev, field: val, value: '' }))}>
                <SelectTrigger className="w-full h-12 bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all">
                  <SelectValue placeholder="-- Select Field --" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-gray-200 dark:border-white/10 bg-white dark:bg-[#1a1a1a]">
                  <SelectItem value="totalQty">Total Quantity</SelectItem>
                  <SelectItem value="plannedStartDate">Planned Start Date</SelectItem>
                  <SelectItem value="plannedEndDate">Planned End Date</SelectItem>
                  <SelectItem value="currentStartDate">Current Start Date</SelectItem>
                  <SelectItem value="currentEndDate">Current End Date</SelectItem>
                  <SelectItem value="phasingMethod">Planned Phasing Method</SelectItem>
                  <SelectItem value="currentPhasingMethod">Current Phasing Method</SelectItem>
                  <SelectItem value="phasingCurve">Planned Phasing Curve</SelectItem>
                  <SelectItem value="currentPhasingCurve">Current Phasing Curve</SelectItem>
                  <SelectItem value="status">Status</SelectItem>
                  <SelectItem value="costCodeId">Cost Code</SelectItem>
                  <SelectItem value="description">Description</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">New Value</label>
              {itemBulkUpdateData.field.includes('Method') ? (
                <Select value={itemBulkUpdateData.value} onValueChange={(val) => setItemBulkUpdateData(prev => ({ ...prev, value: val }))}>
                  <SelectTrigger className="w-full h-12 bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 rounded-xl">
                    <SelectValue placeholder="Select Method" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="Auto">Auto</SelectItem>
                    <SelectItem value="Manual">Manual</SelectItem>
                  </SelectContent>
                </Select>
              ) : itemBulkUpdateData.field.includes('Curve') ? (
                <Select value={itemBulkUpdateData.value} onValueChange={(val) => setItemBulkUpdateData(prev => ({ ...prev, value: val }))}>
                  <SelectTrigger className="w-full h-12 bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 rounded-xl">
                    <SelectValue placeholder="Select Curve" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="Scurve">Scurve</SelectItem>
                    <SelectItem value="Bell">Bell</SelectItem>
                    <SelectItem value="front load">Front Load</SelectItem>
                    <SelectItem value="back load">Back Load</SelectItem>
                    <SelectItem value="even">Even</SelectItem>
                  </SelectContent>
                </Select>
              ) : itemBulkUpdateData.field === 'status' ? (
                <Select value={itemBulkUpdateData.value} onValueChange={(val: string) => setItemBulkUpdateData(prev => ({ ...prev, value: val }))}>
                  <SelectTrigger className="w-full h-12 bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 rounded-xl">
                    <SelectValue placeholder="Select Status" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="Not Started">Not Started</SelectItem>
                    <SelectItem value="In Progress">In Progress</SelectItem>
                    <SelectItem value="Completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              ) : itemBulkUpdateData.field.includes('Date') ? (
                <Input
                  type="date"
                  value={itemBulkUpdateData.value}
                  onChange={e => setItemBulkUpdateData(prev => ({ ...prev, value: e.target.value }))}
                  className="h-12 rounded-xl bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 px-4"
                />
              ) : (
                <Input
                  value={itemBulkUpdateData.value}
                  onChange={e => setItemBulkUpdateData(prev => ({ ...prev, value: e.target.value }))}
                  placeholder="Enter value"
                  className="h-12 rounded-xl bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 px-4"
                />
              )}
            </div>
          </div>
          <DialogFooter className="p-6 bg-gray-50 dark:bg-white/5 border-t border-gray-100 dark:border-white/10">
            <Button variant="ghost" onClick={() => setIsItemBulkUpdateOpen(false)} className="rounded-xl font-bold px-6 h-11">Cancel</Button>
            <Button onClick={handleItemBulkUpdate} className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold px-8 h-11 shadow-lg shadow-blue-500/20">
              Apply Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Package Settings Dialog */}
      <Dialog open={isPackageSettingsOpen} onOpenChange={setIsPackageSettingsOpen}>
        <DialogContent className="max-w-lg bg-white dark:bg-[#1a1a1a] border dark:border-white/10 rounded-2xl shadow-2xl p-0 overflow-hidden">
          <div className="bg-gray-900 p-6 text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Settings className="w-6 h-6 text-blue-400" />
              <div>
                <DialogTitle className="text-xl font-bold">Package Defaults</DialogTitle>
                <p className="text-xs text-gray-400 mt-1">Default values for new items in {selectedPackage?.packageId}</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setIsPackageSettingsOpen(false)} className="text-gray-400 hover:text-white">
              <X className="w-5 h-5" />
            </Button>
          </div>

          <div className="p-6 grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Default Phasing Method</label>
              <Select
                value={selectedPackage?.defaultPhasingMethod || 'Auto'}
                onValueChange={(val) => selectedPackageId && updatePackage(selectedPackageId, { defaultPhasingMethod: val })}
              >
                <SelectTrigger className="w-full h-11 bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="Auto">Auto</SelectItem>
                  <SelectItem value="Manual">Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Default Phasing Curve</label>
              <Select
                value={selectedPackage?.defaultPhasingCurve || 'even'}
                onValueChange={(val) => selectedPackageId && updatePackage(selectedPackageId, { defaultPhasingCurve: val })}
              >
                <SelectTrigger className="w-full h-11 bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="Scurve">Scurve</SelectItem>
                  <SelectItem value="Bell">Bell</SelectItem>
                  <SelectItem value="front load">Front Load</SelectItem>
                  <SelectItem value="back load">Back Load</SelectItem>
                  <SelectItem value="even">Even</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Default Start Date</label>
              <Input
                type="date"
                value={selectedPackage?.defaultStartDate || ''}
                onChange={(e) => selectedPackageId && updatePackage(selectedPackageId, { defaultStartDate: e.target.value })}
                className="h-11 rounded-xl bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Default End Date</label>
              <Input
                type="date"
                value={selectedPackage?.defaultEndDate || ''}
                onChange={(e) => selectedPackageId && updatePackage(selectedPackageId, { defaultEndDate: e.target.value })}
                className="h-11 rounded-xl bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10"
              />
            </div>

            <div className="col-span-2 p-4 bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/30 rounded-xl">
              <p className="text-xs text-blue-700 dark:text-blue-300 italic">
                Note: These values will be used automatically when adding new items to this commodity package.
              </p>
            </div>
          </div>

          <div className="p-6 bg-gray-50 dark:bg-white/5 border-t border-gray-100 dark:border-white/10 text-right">
            <Button onClick={() => setIsPackageSettingsOpen(false)} className="bg-gray-900 dark:bg-white text-white dark:text-black rounded-xl font-bold px-8 h-11">
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
