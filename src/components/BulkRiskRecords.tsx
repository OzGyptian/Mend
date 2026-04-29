import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Project, Enterprise, Risk, RiskRecord, CostCode } from '../types';
import { db, auth } from '../firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  getDocs,
  writeBatch,
  doc,
  updateDoc,
  addDoc,
  deleteDoc
} from 'firebase/firestore';
import { 
  Search, 
  Trash2, 
  Download, 
  Upload,
  Filter, 
  RefreshCw,
  X,
  PlusCircle,
  Database,
  Save,
  Columns,
  RotateCcw,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { AgGridReact } from 'ag-grid-react';
import { 
  ColDef, 
  ColGroupDef,
  GridApi, 
  GridReadyEvent, 
  CellValueChangedEvent,
  ValueFormatterParams,
  SideBarDef,
  StatusPanelDef
} from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';
import 'ag-grid-enterprise';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { cn, formatCurrency } from '../lib/utils';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  toast.error(`Database Error: ${errInfo.error}`);
  throw new Error(JSON.stringify(errInfo));
}

interface BulkRiskRecordsProps {
  project: Project;
  enterprise: Enterprise;
}

export default function BulkRiskRecords({ project, enterprise }: BulkRiskRecordsProps) {
  const [risks, setRisks] = useState<Risk[]>([]);
  const [allRiskRecords, setAllRiskRecords] = useState<RiskRecord[]>([]);
  const [costCodes, setCostCodes] = useState<CostCode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [bulkRecordsQuickFilterText, setBulkRecordsQuickFilterText] = useState('');
  const [selectedBulkRecordIds, setSelectedBulkRecordIds] = useState<Set<string>>(new Set());
  const [isBulkRecordUpdateOpen, setIsBulkRecordUpdateOpen] = useState(false);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [bulkRecordUpdateData, setBulkRecordUpdateData] = useState<{
    costCodeId: string;
    scope: string;
    probability: string;
    impactAmount: string;
    mitigationCost: string;
    residualProbability: string;
    residualImpactAmount: string;
    enterpriseAttributes: Record<string, any>;
    projectAttributes: Record<string, any>;
  }>({
    costCodeId: '',
    scope: '',
    probability: '',
    impactAmount: '',
    mitigationCost: '',
    residualProbability: '',
    residualImpactAmount: '',
    enterpriseAttributes: {},
    projectAttributes: {}
  });

  const bulkRecordsGridRef = useRef<AgGridReact>(null);
  const recordFileInputRef = useRef<HTMLInputElement>(null);

  const pinnedBottomRowData = useMemo(() => {
    if (allRiskRecords.length === 0) return [];
    return [{
      riskId: 'TOTALS',
      impactAmount: allRiskRecords.reduce((sum, r) => sum + (r.impactAmount || 0), 0),
      mitigationCost: allRiskRecords.reduce((sum, r) => sum + (r.mitigationCost || 0), 0),
      residualImpactAmount: allRiskRecords.reduce((sum, r) => sum + (r.residualImpactAmount || 0), 0),
      initialEMV: allRiskRecords.reduce((sum, r) => sum + ((r.probability || 0) * (r.impactAmount || 0)), 0),
      residualEMV: allRiskRecords.reduce((sum, r) => sum + ((r.residualProbability || 0) * (r.residualImpactAmount || 0)), 0)
    }];
  }, [allRiskRecords]);

  const sideBar: SideBarDef = {
    toolPanels: [
      { id: 'columns', labelDefault: 'Columns', labelKey: 'columns', iconKey: 'columns', toolPanel: 'agColumnsToolPanel' },
      { id: 'filters', labelDefault: 'Filters', labelKey: 'filters', iconKey: 'filter', toolPanel: 'agFiltersToolPanel' }
    ],
    defaultToolPanel: ''
  };

  const statusBar: { statusPanels: StatusPanelDef[] } = {
    statusPanels: [
      { statusPanel: 'agTotalAndFilteredRowCountComponent', align: 'left' },
      { statusPanel: 'agAggregationComponent', align: 'right' }
    ]
  };

  const enterpriseLineItemAttrs = useMemo(() => 
    (enterprise.lineItemAttributes || []).filter(attr => attr.title && attr.title.trim() !== '' && attr.values && attr.values.length > 0),
    [enterprise.lineItemAttributes]
  );

  const projectLineItemAttrs = useMemo(() => 
    (project.lineItemAttributes || []).filter(attr => attr.title && attr.title.trim() !== '' && attr.values && attr.values.length > 0),
    [project.lineItemAttributes]
  );

  useEffect(() => {
    const qr = query(collection(db, 'risks'), where('projectId', '==', project.id));
    const unsubR = onSnapshot(qr, (snapshot) => {
      setRisks(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Risk)));
    });
    const qrr = query(collection(db, 'riskRecords'), where('projectId', '==', project.id));
    const unsubRr = onSnapshot(qrr, (snapshot) => {
      setAllRiskRecords(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as RiskRecord)));
      setIsLoading(false);
    });
    const qcc = query(collection(db, 'costCodes'), where('projectId', '==', project.id));
    const unsubCc = onSnapshot(qcc, (snapshot) => {
      setCostCodes(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as CostCode)).sort((a,b) => a.sortOrder - b.sortOrder));
    });
    return () => { unsubR(); unsubRr(); unsubCc(); };
  }, [project.id]);

  const updateParentTotals = async (riskId: string) => {
    try {
      const recordsSnap = await getDocs(query(collection(db, 'riskRecords'), where('riskId', '==', riskId)));
      const records = recordsSnap.docs.map(d => d.data() as RiskRecord);
      const totalInitialExposure = records.reduce((sum, r) => sum + ((Number(r.probability) || 0) * (Number(r.impactAmount) || 0)), 0);
      const totalMitigation = records.reduce((sum, r) => sum + (Number(r.mitigationCost) || 0), 0);
      const totalResidualExposure = records.reduce((sum, r) => sum + ((Number(r.residualProbability) || 0) * (Number(r.residualImpactAmount) || 0)), 0);
      
      await updateDoc(doc(db, 'risks', riskId), {
        exposure: totalInitialExposure,
        mitigation: totalMitigation,
        residualExposure: totalResidualExposure,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error(error);
    }
  };

  const onRecordCellValueChanged = async (params: CellValueChangedEvent) => {
    const { data, colDef } = params;
    if (!data.id) return;
    try {
      let updates: any = { [colDef.field!]: params.newValue, updatedAt: new Date().toISOString() };
      await updateDoc(doc(db, 'riskRecords', data.id), updates);
      if (['probability', 'impactAmount', 'mitigationCost', 'residualProbability', 'residualImpactAmount'].includes(colDef.field!)) {
        updateParentTotals(data.riskId);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `riskRecords/${data.id}`);
    }
  };

  const handleExportRecords = () => {
    const exportData = allRiskRecords.map(r => {
      const parentRisk = risks.find(c => c.id === r.riskId);
      return {
        'Risk ID': parentRisk?.riskId || 'Unknown',
        'Cost Code': r.costCodeId,
        'Scope': r.scope,
        'Prob %': (Number(r.probability) || 0) * 100,
        'Impact $': r.impactAmount,
        'Initial EMV': (Number(r.probability) || 0) * (Number(r.impactAmount) || 0),
        'Parent Strategy': parentRisk?.strategy || '-',
        'Mitigation Cost $': r.mitigationCost,
        'Res. Prob %': (Number(r.residualProbability) || 0) * 100,
        'Res. Impact $': r.residualImpactAmount,
        'Res. EMV': (Number(r.residualProbability) || 0) * (Number(r.residualImpactAmount) || 0)
      };
    });
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Risk Records");
    XLSX.writeFile(wb, `${project.projectName}_Bulk_Risk_Records.xlsx`);
  };

  const toggleAllRecordColumnGroups = (opened: boolean) => {
    if (!bulkRecordsGridRef.current) return;
    const api = bulkRecordsGridRef.current.api;
    const groups = api.getColumnGroupState();
    const newState = groups.map(g => ({
      groupId: g.groupId,
      open: opened
    }));
    api.setColumnGroupState(newState);
  };

  const handleImportRecords = (e: React.ChangeEvent<HTMLInputElement>) => {
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
        const batch = writeBatch(db);
        let addedCount = 0;
        const riskMap = new Map(risks.map(r => [r.riskId.toLowerCase(), r.id]));
        for (const row of data) {
          const riskIdStr = String(row['Risk ID'] || '').trim().toLowerCase();
          const riskId = riskMap.get(riskIdStr);
          if (!riskId) continue;
          const newRecordRef = doc(collection(db, 'riskRecords'));
          batch.set(newRecordRef, {
            riskId: riskId,
            projectId: project.id,
            costCodeId: String(row['Cost Code'] || '').trim(),
            scope: String(row['Scope'] || ''),
            probability: (Number(row['Prob %']) || 100) / 100,
            impactAmount: Number(row['Impact $']) || 0,
            mitigationCost: Number(row['Mitigation Cost $']) || 0,
            residualProbability: (Number(row['Res. Prob %']) || 100) / 100,
            residualImpactAmount: Number(row['Res. Impact $']) || 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
          addedCount++;
        }
        if (addedCount > 0) {
          await batch.commit();
          toast.success(`Imported ${addedCount} records`);
        }
      } catch (error) { toast.error("Import failed"); }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const bulkRecordColumnDefs = useMemo<(ColDef | ColGroupDef)[]>(() => [
    { headerName: '', width: 50, pinned: 'left', checkboxSelection: true, headerCheckboxSelection: true, headerCheckboxSelectionFilteredOnly: true },
    {
      headerName: 'Risk ID', field: 'riskId', pinned: 'left', width: 130, sort: 'asc',
      valueFormatter: (p) => {
        if (p.node?.rowPinned) return p.value;
        const r = risks.find(r => r.id === p.value);
        return r ? r.riskId : p.value;
      },
      cellRenderer: (p: any) => p.node?.rowPinned 
        ? <span className="font-bold text-gray-500">{p.value}</span> 
        : <span className="font-bold text-blue-600 dark:text-blue-400">{p.valueFormatted}</span>
    },
    {
      headerName: 'Parent Strategy', width: 130,
      valueGetter: (p) => risks.find(r => r.id === p.data.riskId)?.strategy || '-'
    },
    {
      headerName: 'Cost Code', field: 'costCodeId', width: 150, editable: true,
      cellEditor: 'agRichSelectCellEditor', cellEditorParams: { values: costCodes.map(c => c.code) }
    },
    { headerName: 'Scope', field: 'scope', width: 200, editable: true },
    {
      headerName: 'Initial Risk Analysis',
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
          headerName: 'Impact $', field: 'impactAmount', editable: true, width: 130, type: 'numericColumn',
          valueFormatter: (p) => formatCurrency(p.value), cellEditor: 'agNumberCellEditor'
        },
        {
          headerName: 'EMV', width: 120, type: 'numericColumn',
          valueGetter: (p) => {
            if (p.node?.rowPinned) return p.data.initialEMV;
            return (Number(p.data.probability) || 0) * (Number(p.data.impactAmount) || 0);
          },
          valueFormatter: (p) => formatCurrency(p.value),
          cellStyle: { backgroundColor: 'rgba(220, 38, 38, 0.05)', fontWeight: 'bold' }
        }
      ]
    },
    {
      headerName: 'Mitigation Cost $', field: 'mitigationCost', editable: true, width: 160, type: 'numericColumn',
      valueFormatter: (p) => formatCurrency(p.value), cellEditor: 'agNumberCellEditor'
    },
    {
      headerName: 'Residual Risk Analysis',
      openByDefault: true,
      children: [
        {
          headerName: 'Res. Prob %', field: 'residualProbability', editable: true, width: 110,
          valueFormatter: (p) => p.value === null ? '' : `${((p.value || 0) * 100).toFixed(0)}%`,
          cellEditor: 'agNumberCellEditor',
          cellEditorParams: { min: 0, max: 1 },
          valueParser: (p) => Number(p.newValue) > 1 ? Number(p.newValue) / 100 : Number(p.newValue)
        },
        {
          headerName: 'Res. Impact $', field: 'residualImpactAmount', editable: true, width: 130, type: 'numericColumn',
          valueFormatter: (p) => formatCurrency(p.value), cellEditor: 'agNumberCellEditor'
        },
        {
          headerName: 'Res. EMV', width: 120, type: 'numericColumn',
          valueGetter: (p) => {
            if (p.node?.rowPinned) return p.data.residualEMV;
            return (Number(p.data.residualProbability) || 0) * (Number(p.data.residualImpactAmount) || 0);
          },
          valueFormatter: (p) => formatCurrency(p.value),
          cellStyle: { backgroundColor: 'rgba(37, 99, 235, 0.05)', fontWeight: 'bold' }
        }
      ]
    }
  ], [risks, costCodes]);

  const handleBulkUpdateRecords = async () => {
    if (selectedBulkRecordIds.size === 0) return;
    try {
      const batch = writeBatch(db);
      const updates: any = { updatedAt: new Date().toISOString() };
      if (bulkRecordUpdateData.costCodeId) updates.costCodeId = bulkRecordUpdateData.costCodeId;
      if (bulkRecordUpdateData.scope) updates.scope = bulkRecordUpdateData.scope;
      if (bulkRecordUpdateData.probability) updates.probability = Number(bulkRecordUpdateData.probability) > 1 ? Number(bulkRecordUpdateData.probability) / 100 : Number(bulkRecordUpdateData.probability);
      if (bulkRecordUpdateData.impactAmount) updates.impactAmount = Number(bulkRecordUpdateData.impactAmount);
      if (bulkRecordUpdateData.mitigationCost) updates.mitigationCost = Number(bulkRecordUpdateData.mitigationCost);
      if (bulkRecordUpdateData.residualProbability) updates.residualProbability = Number(bulkRecordUpdateData.residualProbability) > 1 ? Number(bulkRecordUpdateData.residualProbability) / 100 : Number(bulkRecordUpdateData.residualProbability);
      if (bulkRecordUpdateData.residualImpactAmount) updates.residualImpactAmount = Number(bulkRecordUpdateData.residualImpactAmount);

      selectedBulkRecordIds.forEach(id => batch.update(doc(db, 'riskRecords', id), updates));
      await batch.commit();

      const affected = new Set<string>();
      selectedBulkRecordIds.forEach(id => {
        const r = allRiskRecords.find(x => x.id === id);
        if (r) affected.add(r.riskId);
      });
      for (const rid of affected) await updateParentTotals(rid);

      toast.success("Updated Successfully");
      setIsBulkRecordUpdateOpen(false);
      setSelectedBulkRecordIds(new Set());
    } catch (e) { toast.error("Update failed"); }
  };

  const handleBulkDeleteRecords = async () => {
    try {
      const batch = writeBatch(db);
      const affected = new Set<string>();
      selectedBulkRecordIds.forEach(id => {
        const r = allRiskRecords.find(x => x.id === id);
        if (r) { affected.add(r.riskId); batch.delete(doc(db, 'riskRecords', id)); }
      });
      await batch.commit();
      for (const rid of affected) await updateParentTotals(rid);
      toast.success("Deleted Successfully");
      setSelectedBulkRecordIds(new Set());
      setIsBulkDeleteOpen(false);
    } catch (e) { toast.error("Delete failed"); }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-[#141414] border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden">
      <div className="p-6 border-b border-gray-100 dark:border-white/10 flex justify-between items-center bg-gray-50/50 dark:bg-white/5 shrink-0">
        <div className="flex items-center gap-8">
          <div>
            <h3 className="text-xl font-bold dark:text-white">Bulk Risk Records</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Manage all risk cost impacts across the project.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text" placeholder="Search records..." value={bulkRecordsQuickFilterText} onChange={(e) => setBulkRecordsQuickFilterText(e.target.value)}
              className="pl-10 pr-4 py-2 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-xl text-sm w-64 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <input type="file" ref={recordFileInputRef} className="hidden" accept=".xlsx,.xls" onChange={handleImportRecords} />
          <button onClick={() => recordFileInputRef.current?.click()} className="p-2 text-gray-400 hover:text-black dark:hover:text-white transition-colors" title="Import Records"><Upload className="w-5 h-5" /></button>
          <button onClick={handleExportRecords} className="p-2 text-gray-400 hover:text-black dark:hover:text-white transition-colors" title="Export Records"><Download className="w-5 h-5" /></button>
          
          <div className="w-px h-6 bg-gray-200 dark:bg-white/10 mx-1" />
          
          <button onClick={() => toggleAllRecordColumnGroups(true)} className="p-2 text-gray-400 hover:text-black dark:hover:text-white transition-colors" title="Expand All Groups"><Maximize2 className="w-4 h-4" /></button>
          <button onClick={() => toggleAllRecordColumnGroups(false)} className="p-2 text-gray-400 hover:text-black dark:hover:text-white transition-colors" title="Collapse All Groups"><Minimize2 className="w-4 h-4" /></button>
          
          <div className="w-px h-6 bg-gray-200 dark:bg-white/10 mx-1" />

          {selectedBulkRecordIds.size > 0 && (
            <div className="flex gap-2">
              <button onClick={() => setIsBulkRecordUpdateOpen(true)} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-colors">Bulk Update ({selectedBulkRecordIds.size})</button>
              <button 
                onClick={() => setIsBulkDeleteOpen(true)} 
                className="px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-bold shadow-lg shadow-red-600/20 hover:bg-red-700 transition-colors flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" /> Delete ({selectedBulkRecordIds.size})
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 bg-white dark:bg-[#141414] border-t border-gray-200 dark:border-white/10 overflow-hidden">
        <div className="ag-theme-quartz-dark h-full w-full">
          <AgGridReact
            ref={bulkRecordsGridRef} rowData={allRiskRecords} columnDefs={bulkRecordColumnDefs}
            rowSelection="multiple" animateRows={true} quickFilterText={bulkRecordsQuickFilterText}
            pinnedBottomRowData={pinnedBottomRowData} statusBar={statusBar}
            onSelectionChanged={(p) => setSelectedBulkRecordIds(new Set(p.api.getSelectedRows().map(r => r.id)))}
            onCellValueChanged={onRecordCellValueChanged}
            defaultColDef={{ sortable: true, filter: true, resizable: true }}
          />
        </div>
      </div>

      <Dialog open={isBulkRecordUpdateOpen} onOpenChange={setIsBulkRecordUpdateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Bulk Update Risks</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto pr-2">
            <Input placeholder="Scope" value={bulkRecordUpdateData.scope} onChange={e => setBulkRecordUpdateData({...bulkRecordUpdateData, scope: e.target.value})} />
            <div className="grid grid-cols-2 gap-4">
              <Input type="number" placeholder="Prob % (0-100)" value={bulkRecordUpdateData.probability} onChange={e => setBulkRecordUpdateData({...bulkRecordUpdateData, probability: e.target.value})} />
              <Input type="number" placeholder="Impact $" value={bulkRecordUpdateData.impactAmount} onChange={e => setBulkRecordUpdateData({...bulkRecordUpdateData, impactAmount: e.target.value})} />
            </div>
            <Input type="number" placeholder="Mitigation Cost $" value={bulkRecordUpdateData.mitigationCost} onChange={e => setBulkRecordUpdateData({...bulkRecordUpdateData, mitigationCost: e.target.value})} />
            <div className="grid grid-cols-2 gap-4">
              <Input type="number" placeholder="Res. Prob % (0-100)" value={bulkRecordUpdateData.residualProbability} onChange={e => setBulkRecordUpdateData({...bulkRecordUpdateData, residualProbability: e.target.value})} />
              <Input type="number" placeholder="Res. Impact $" value={bulkRecordUpdateData.residualImpactAmount} onChange={e => setBulkRecordUpdateData({...bulkRecordUpdateData, residualImpactAmount: e.target.value})} />
            </div>
          </div>
          <DialogFooter><Button onClick={handleBulkUpdateRecords}>Update</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isBulkDeleteOpen} onOpenChange={setIsBulkDeleteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="text-red-600">Bulk Delete Risk Records</DialogTitle></DialogHeader>
          <div className="py-4">
            <p>Are you sure you want to delete {selectedBulkRecordIds.size} risk records? This action cannot be undone.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBulkDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleBulkDeleteRecords}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
