import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Project, Enterprise, CostCode } from '../types';
import { 
  DollarSign, 
  Plus, 
  Filter, 
  Search, 
  Download, 
  Trash2, 
  Save,
  ChevronDown,
  FileSpreadsheet,
  History,
  Upload,
  Maximize2,
  Minimize2,
  X,
  Edit2,
  AlertCircle,
  BarChart3,
  Target
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AgGridReact } from 'ag-grid-react';
import { 
  ColDef, 
  ColGroupDef, 
  CellValueChangedEvent, 
  GridReadyEvent,
  ValueFormatterParams,
  GridApi
} from 'ag-grid-community';
import { format, parseISO } from 'date-fns';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Line, 
  ComposedChart,
  Cell,
  Legend,
  LabelList
} from 'recharts';
import { db, auth } from '../firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp,
  getDocs,
  getDoc,
  writeBatch,
  orderBy
} from 'firebase/firestore';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { formatCurrency, formatNumber } from '../lib/utils';
import { OperationType, handleFirestoreError } from '../lib/errorHandlers';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'motion/react';
import { useTheme } from 'next-themes';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface BaselineBudgetProps {
  project: Project;
  enterprise: Enterprise;
}

interface BaselineBudgetRecord {
  id: string;
  projectId: string;
  costCodeId: string;
  item: string;
  description: string;
  source: 'EST' | 'CON' | 'BID';
  amount: number;
  reportingPeriodId: string;
  enterpriseAttributes?: Record<string, any>;
  projectAttributes?: Record<string, any>;
  createdAt: string;
  updatedAt?: string;
}

const BaselineBudget: React.FC<BaselineBudgetProps> = ({ project, enterprise }) => {
  const [records, setRecords] = useState<BaselineBudgetRecord[]>([]);
  const [costCodes, setCostCodes] = useState<CostCode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [quickFilterText, setQuickFilterText] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isChartVisible, setIsChartVisible] = useState(false);
  const gridRef = useRef<AgGridReact>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { theme: currentTheme } = useTheme();
  const theme = currentTheme === 'dark' ? 'dark' : 'light';

  const userId = auth.currentUser?.uid;
  const isEnterpriseAdmin = userId && enterprise?.users?.[userId]?.role === 'Enterprise System Admin';
  const isProjectAdmin = userId && (isEnterpriseAdmin || project?.users?.[userId] === 'Project Admin');

  // Fetch Baseline Budgets
  useEffect(() => {
    const q = query(
      collection(db, 'baselineBudgets'), 
      where('projectId', '==', project.id),
      orderBy('createdAt', 'asc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as BaselineBudgetRecord[];
      setRecords(data);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching baseline budgets:", error);
      toast.error("Failed to load baseline budgets");
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [project.id]);

  // Fetch Cost Codes for dropdown
  useEffect(() => {
    const q = query(collection(db, 'costCodes'), where('projectId', '==', project.id));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as CostCode[];
      setCostCodes(data.sort((a, b) => a.sortOrder - b.sortOrder));
    });
    return () => unsubscribe();
  }, [project.id]);

  const syncBaselineBudgetToCostCode = useCallback(async (costCodeId: string) => {
    if (!costCodeId) return;
    try {
      const ccDoc = await getDoc(doc(db, 'costCodes', costCodeId));
      if (!ccDoc.exists()) return;
      const ccData = ccDoc.data() as CostCode;

      const q = query(
        collection(db, 'baselineBudgets'), 
        where('projectId', '==', project.id)
      );
      const snapshot = await getDocs(q);
      const allRecords = snapshot.docs.map(doc => doc.data() as BaselineBudgetRecord);
      
      const codeBudgets = allRecords.filter(a => a.costCodeId === costCodeId || a.costCodeId === ccData.code);
      const totalBaseline = codeBudgets.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
      
      await updateDoc(doc(db, 'costCodes', costCodeId), {
        baselineBudget: totalBaseline,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error syncing baseline budget:", error);
    }
  }, [project.id]);

  const handleAddRecord = async () => {
    if (!isProjectAdmin) {
      toast.error("Only Project Admins can add baseline budget details.");
      return;
    }

    try {
      const newRecord = {
        projectId: project.id,
        costCodeId: '',
        item: 'New Budget Item',
        description: '',
        source: 'EST',
        amount: 0,
        reportingPeriodId: project.reportingPeriods?.currentPeriodId || '',
        createdAt: new Date().toISOString(),
        enterpriseAttributes: {},
        projectAttributes: {}
      };
      await addDoc(collection(db, 'baselineBudgets'), newRecord);
      toast.success("Record added");

      setTimeout(() => {
        if (gridRef.current?.api) {
          const rowCount = gridRef.current.api.getDisplayedRowCount();
          if (rowCount > 0) {
            gridRef.current.api.ensureIndexVisible(rowCount - 1, 'bottom');
          }
        }
      }, 500);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'baselineBudgets');
      toast.error("Failed to add record");
    }
  };

  const handleDeleteRecord = async (id: string, costCodeId: string) => {
    if (!isProjectAdmin) {
      toast.error("Only Project Admins can delete baseline budget details.");
      return;
    }

    try {
      await deleteDoc(doc(db, 'baselineBudgets', id));
      toast.success("Record deleted");
      if (costCodeId) await syncBaselineBudgetToCostCode(costCodeId);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `baselineBudgets/${id}`);
      toast.error("Failed to delete record");
    }
  };

  const handleDeleteSelected = async () => {
    if (!isProjectAdmin) return;
    const idsToDelete = Array.from(selectedIds);
    if (idsToDelete.length === 0) return;

    setIsLoading(true);
    try {
      const batch = writeBatch(db);
      const affectedCostCodeIds = new Set<string>();
      
      idsToDelete.forEach(id => {
        const record = records.find(r => r.id === id);
        if (record?.costCodeId) affectedCostCodeIds.add(record.costCodeId);
        batch.delete(doc(db, 'baselineBudgets', id));
      });

      await batch.commit();
      
      for (const ccId of affectedCostCodeIds) {
        await syncBaselineBudgetToCostCode(ccId);
      }

      toast.success(`Deleted ${idsToDelete.length} records`);
      setSelectedIds(new Set());
      setIsDeleteConfirmOpen(false);
    } catch (error) {
      console.error("Error deleting records:", error);
      toast.error("Failed to delete records");
    } finally {
      setIsLoading(false);
    }
  };

  const chartData = useMemo(() => {
    const periods = project.reportingPeriods?.periods || [];
    let cumulative = 0;
    
    return periods.map((p, index) => {
      const periodicAmount = records
        .filter(r => r.reportingPeriodId === p.id)
        .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
      
      cumulative += periodicAmount;
      
      let formattedDate = (index + 1).toString();
      if (p.endDate) {
        try {
          formattedDate = format(parseISO(p.endDate), "MMM''yy");
        } catch (e) {
          console.error("Error formatting date:", e);
        }
      }
      
      return {
        name: formattedDate,
        periodNo: (index + 1).toString(),
        periodName: p.name,
        amount: periodicAmount,
        cumulative: cumulative
      };
    });
  }, [records, project.reportingPeriods?.periods]);

  const handleExportExcel = () => {
    const enterpriseAttrs = (enterprise.lineItemAttributes || []).filter(a => a.title);
    const projectAttrs = (project.lineItemAttributes || []).filter(a => a.title);

    const data = records.map(r => {
      const exportRow: any = {
        'Cost Code ID': costCodes.find(cc => cc.id === r.costCodeId)?.code || '',
        'Item': r.item,
        'Description': r.description,
        'Amount': r.amount,
      };

      enterpriseAttrs.forEach(attr => {
        exportRow[`E_${attr.title}`] = r.enterpriseAttributes?.[attr.id] || '';
      });

      projectAttrs.forEach(attr => {
        exportRow[`P_${attr.title}`] = r.projectAttributes?.[attr.id] || '';
      });

      return exportRow;
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Baseline Budget');
    XLSX.writeFile(wb, `Baseline_Budget_${project.projectName}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
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

        const enterpriseAttrs = (enterprise.lineItemAttributes || []).filter(a => a.title);
        const projectAttrs = (project.lineItemAttributes || []).filter(a => a.title);
        
        const batch = writeBatch(db);
        const affectedCostCodeIds = new Set<string>();

        data.forEach(row => {
          const costCode = costCodes.find(cc => cc.code === String(row['Cost Code ID']));
          
          if (costCode) affectedCostCodeIds.add(costCode.id);

          const enterpriseAttributes: Record<string, any> = {};
          enterpriseAttrs.forEach(attr => {
            if (row[`E_${attr.title}`] !== undefined) {
              enterpriseAttributes[attr.id] = String(row[`E_${attr.title}`]);
            }
          });

          const projectAttributes: Record<string, any> = {};
          projectAttrs.forEach(attr => {
            if (row[`P_${attr.title}`] !== undefined) {
              projectAttributes[attr.id] = String(row[`P_${attr.title}`]);
            }
          });

          const newDocRef = doc(collection(db, 'baselineBudgets'));
          batch.set(newDocRef, {
            projectId: project.id,
            costCodeId: costCode?.id || '',
            item: row['Item'] || '',
            description: row['Description'] || '',
            source: 'EST',
            amount: Number(row['Amount']) || 0,
            reportingPeriodId: project.reportingPeriods?.currentPeriodId || '',
            enterpriseAttributes,
            projectAttributes,
            createdAt: new Date().toISOString()
          });
        });

        await batch.commit();
        
        for (const ccId of affectedCostCodeIds) {
          await syncBaselineBudgetToCostCode(ccId);
        }

        toast.success(`Imported ${data.length} records successfully`);
      } catch (error) {
        console.error("Error importing Excel:", error);
        toast.error("Failed to import records");
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const onCellValueChanged = async (event: CellValueChangedEvent) => {
    const { data, colDef, newValue, oldValue } = event;
    if (newValue === oldValue) return;

    try {
      const updates: any = {
        ...data,
        updatedAt: new Date().toISOString()
      };
      delete updates.id;

      await updateDoc(doc(db, 'baselineBudgets', data.id), updates);
      
      if (colDef.field === 'costCodeId' || colDef.field === 'amount') {
        if (data.costCodeId) await syncBaselineBudgetToCostCode(data.costCodeId);
        if (colDef.field === 'costCodeId' && oldValue) {
          await syncBaselineBudgetToCostCode(oldValue);
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `baselineBudgets/${data.id}`);
      toast.error("Failed to update record");
      event.node.setDataValue(colDef.field!, oldValue);
    }
  };

  const columnDefs = useMemo<(ColDef | ColGroupDef)[]>(() => {
    const periods = project.reportingPeriods?.periods || [];
    const enterpriseAttrs = (enterprise.lineItemAttributes || []).filter(a => a.title);
    const projectAttrs = (project.lineItemAttributes || []).filter(a => a.title);

    const defs: (ColDef | ColGroupDef)[] = [
      {
        headerName: 'Core Information',
        children: [
          {
            headerName: 'Cost Code ID',
            field: 'costCodeId',
            width: 180,
            checkboxSelection: true,
            headerCheckboxSelection: true,
            editable: isProjectAdmin,
            cellEditor: 'agSelectCellEditor',
            cellEditorParams: {
              values: ['', ...costCodes.map(c => c.id)],
            },
            valueFormatter: (params) => {
              if (!params.value) return '';
              return costCodes.find(c => c.id === params.value)?.code || params.value;
            },
            filter: 'agSetColumnFilter',
          },
          {
            headerName: 'Item',
            field: 'item',
            width: 150,
            editable: isProjectAdmin,
            filter: 'agTextColumnFilter',
          },
          {
            headerName: 'Description',
            field: 'description',
            width: 250,
            editable: isProjectAdmin,
            filter: 'agTextColumnFilter',
          },
          {
            headerName: 'Amount',
            field: 'amount',
            width: 120,
            type: 'numericColumn',
            editable: isProjectAdmin,
            valueFormatter: (params) => formatCurrency(params.value),
            aggFunc: 'sum',
          },
        ]
      }
    ];

    if (enterpriseAttrs.length > 0) {
      defs.push({
        headerName: 'Enterprise Attributes',
        children: enterpriseAttrs.map(attr => ({
          headerName: attr.title,
          field: `enterpriseAttributes.${attr.id}`,
          width: 150,
          editable: isProjectAdmin,
          cellEditor: 'agSelectCellEditor',
          cellEditorParams: {
            values: attr.values.map(v => v.id),
          },
          valueFormatter: (params: any) => {
            const v = attr.values.find(v => v.id === params.value);
            return v ? `${v.id} - ${v.description}` : params.value;
          },
          valueSetter: (params: any) => {
            if (!params.data.enterpriseAttributes) params.data.enterpriseAttributes = {};
            params.data.enterpriseAttributes[attr.id] = params.newValue;
            return true;
          }
        }))
      });
    }

    if (projectAttrs.length > 0) {
      defs.push({
        headerName: 'Project Attributes',
        children: projectAttrs.map(attr => ({
          headerName: attr.title,
          field: `projectAttributes.${attr.id}`,
          width: 150,
          editable: isProjectAdmin,
          cellEditor: 'agSelectCellEditor',
          cellEditorParams: {
            values: attr.values.map(v => v.id),
          },
          valueFormatter: (params: any) => {
            const v = attr.values.find(v => v.id === params.value);
            return v ? `${v.id} - ${v.description}` : params.value;
          },
          valueSetter: (params: any) => {
            if (!params.data.projectAttributes) params.data.projectAttributes = {};
            params.data.projectAttributes[attr.id] = params.newValue;
            return true;
          }
        }))
      });
    }

    defs.push({
      headerName: 'Actions',
      width: 80,
      pinned: 'right',
      cellRenderer: (params: any) => (
        <div className="flex items-center justify-center h-full">
          <button 
            onClick={() => handleDeleteRecord(params.data.id, params.data.costCodeId)}
            className="p-1 hover:bg-red-50 text-gray-400 hover:text-red-600 rounded transition-colors"
            disabled={!isProjectAdmin}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )
    });

    return defs;
  }, [costCodes, project.reportingPeriods?.periods, enterprise.lineItemAttributes, project.lineItemAttributes, isProjectAdmin]);

  const sideBar = useMemo(() => ({
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
  }), []);

  const statusBar = useMemo(() => ({
    statusPanels: [
      { statusPanel: 'agTotalAndFilteredRowCountComponent', align: 'left' },
      { statusPanel: 'agAggregationComponent', align: 'right' },
    ],
  }), []);

  const totalBaselineBudget = useMemo(() => records.reduce((sum, r) => sum + (Number(r.amount) || 0), 0), [records]);

  return (
    <div className="flex-1 flex flex-col p-8 overflow-hidden bg-gray-50/50 dark:bg-transparent">
      <div className="flex justify-between items-end mb-8">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-black dark:bg-white rounded-lg flex items-center justify-center">
              <Target className="w-5 h-5 text-white dark:text-black" />
            </div>
            <h1 className="text-2xl font-bold dark:text-white">Baseline Budget Management</h1>
          </div>
          <p className="text-sm text-gray-500">Track and manage project baseline budget details and breakdowns.</p>
        </div>
        <div className="flex gap-3">
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept=".xlsx,.xls,.csv"
            onChange={handleImportExcel}
          />
          <Button 
            variant="outline" 
            size="sm" 
            className="rounded-xl border-gray-200 dark:border-white/10"
            onClick={() => fileInputRef.current?.click()}
            disabled={!isProjectAdmin}
          >
            <Upload className="w-4 h-4 mr-2" />
            Import
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="rounded-xl border-gray-200 dark:border-white/10"
            onClick={handleExportExcel}
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button 
            variant="outline"
            size="sm"
            className={cn(
              "rounded-xl border-gray-200 dark:border-white/10 transition-all",
              isChartVisible && "bg-black text-white dark:bg-white dark:text-black shadow-lg"
            )}
            onClick={() => setIsChartVisible(!isChartVisible)}
          >
            <BarChart3 className="w-4 h-4 mr-2" />
            Histogram
          </Button>
          <Button 
            size="sm" 
            onClick={handleAddRecord}
            className="rounded-xl bg-black dark:bg-white text-white dark:text-black hover:opacity-90 transition-opacity"
            disabled={!isProjectAdmin}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Item
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="rounded-2xl border-gray-200 dark:border-white/10 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Total Baseline Budget</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold dark:text-white">{formatCurrency(totalBaselineBudget)}</p>
          </CardContent>
        </Card>
      </div>

      {isChartVisible && (
        <motion.div 
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="mb-8"
        >
          <Card className="rounded-2xl border-gray-200 dark:border-white/10 shadow-sm overflow-hidden">
            <CardHeader className="bg-gray-50/50 dark:bg-white/5 border-b border-gray-100 dark:border-white/10">
              <CardTitle className="text-sm font-bold">Budget Distribution by Period</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#333' : '#eee'} />
                    <XAxis dataKey="name" fontSize={10} tick={{ fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis fontSize={10} tick={{ fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: theme === 'dark' ? '#1a1a1a' : '#fff', border: 'none', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                      formatter={(v: number) => formatCurrency(v)}
                    />
                    <Bar dataKey="amount" fill="#3B82F6" radius={[4, 4, 0, 0]} barSize={40} />
                    <Line type="monotone" dataKey="amount" stroke="#10B981" strokeWidth={2} dot={{ fill: '#10B981', r: 4 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <div className="flex-1 min-h-0 bg-white dark:bg-[#141414] border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm relative">
        <div className="absolute inset-0 ag-theme-quartz dark:ag-theme-quartz-dark">
          <AgGridReact
            ref={gridRef}
            rowData={records}
            columnDefs={columnDefs}
            defaultColDef={{
              sortable: true,
              filter: true,
              resizable: true,
              enableRowGroup: true,
              enablePivot: true,
              enableValue: true,
            }}
            onCellValueChanged={onCellValueChanged}
            onSelectionChanged={(event) => {
              const selectedNodes = event.api.getSelectedNodes();
              setSelectedIds(new Set(selectedNodes.map(node => node.data.id)));
            }}
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
            quickFilterText={quickFilterText}
          />
        </div>
      </div>

      <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedIds.size} selected records? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteConfirmOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteSelected}>Delete Selected</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BaselineBudget;
