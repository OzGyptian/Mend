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
  BarChart3
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

interface ActualCostProps {
  project: Project;
  enterprise: Enterprise;
}

interface ActualCostRecord {
  id: string;
  projectId: string;
  costCodeId: string;
  item: string;
  description: string;
  source: 'MAN' | 'ACC' | 'FIN';
  cost: number;
  reportingPeriodId: string;
  enterpriseAttributes?: Record<string, any>;
  projectAttributes?: Record<string, any>;
  createdAt: string;
  updatedAt?: string;
}

const ActualCost: React.FC<ActualCostProps> = ({ project, enterprise }) => {
  const [records, setRecords] = useState<ActualCostRecord[]>([]);
  const [costCodes, setCostCodes] = useState<CostCode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [quickFilterText, setQuickFilterText] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isBulkUpdateOpen, setIsBulkUpdateOpen] = useState(false);
  const [isChartVisible, setIsChartVisible] = useState(false);
  const gridRef = useRef<AgGridReact>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { theme: currentTheme } = useTheme();
  const theme = currentTheme === 'dark' ? 'dark' : 'light';

  const userId = auth.currentUser?.uid;
  const isEnterpriseAdmin = userId && enterprise?.users?.[userId]?.role === 'Enterprise System Admin';
  const isProjectAdmin = userId && (isEnterpriseAdmin || project?.users?.[userId] === 'Project Admin');

  // Fetch Actual Costs
  useEffect(() => {
    const q = query(
      collection(db, 'actualCosts'), 
      where('projectId', '==', project.id),
      orderBy('createdAt', 'asc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ActualCostRecord[];
      setRecords(data);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching actual costs:", error);
      toast.error("Failed to load actual costs");
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

  const syncActualCostsToCostCode = useCallback(async (costCodeId: string) => {
    if (!costCodeId) return;
    try {
      // Fetch the cost code to get its string code for robust matching
      const ccDoc = await getDoc(doc(db, 'costCodes', costCodeId));
      if (!ccDoc.exists()) return;
      const ccData = ccDoc.data() as CostCode;

      const q = query(
        collection(db, 'actualCosts'), 
        where('projectId', '==', project.id)
      );
      const snapshot = await getDocs(q);
      const allRecords = snapshot.docs.map(doc => doc.data() as ActualCostRecord);
      
      // Robust matching on ID or Code string
      const codeActuals = allRecords.filter(a => a.costCodeId === costCodeId || a.costCodeId === ccData.code);
      
      const totalToDate = codeActuals.reduce((sum, r) => sum + (Number(r.cost) || 0), 0);
      
      const currentPeriodId = project.reportingPeriods?.currentPeriodId;
      const currentPeriod = project.reportingPeriods?.periods.find(p => p.id === currentPeriodId);
      const currentPeriodNum = currentPeriod ? project.reportingPeriods?.periods.indexOf(currentPeriod) + 1 : -1;

      const totalThisPeriod = codeActuals
        .filter(a => {
          return a.reportingPeriodId === currentPeriodId || 
                 (currentPeriodNum !== -1 && String(a.reportingPeriodId) === String(currentPeriodNum));
        })
        .reduce((sum, r) => sum + (Number(r.cost) || 0), 0);

      await updateDoc(doc(db, 'costCodes', costCodeId), {
        actualCostToDate: totalToDate,
        actualCostThisPeriod: totalThisPeriod,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error syncing actual costs:", error);
    }
  }, [project.id, project.reportingPeriods]);

  const handleAddRecord = async () => {
    if (!isProjectAdmin) {
      toast.error("Only Project Admins can add actual costs.");
      return;
    }

    try {
      const newRecord = {
        projectId: project.id,
        costCodeId: '', // Leave blank as requested
        item: 'New Item',
        description: '',
        source: 'MAN',
        cost: 0,
        reportingPeriodId: project.reportingPeriods?.currentPeriodId || '',
        createdAt: new Date().toISOString(),
        enterpriseAttributes: {},
        projectAttributes: {}
      };
      await addDoc(collection(db, 'actualCosts'), newRecord);
      toast.success("Record added");

      // Scroll to the new record at the bottom
      setTimeout(() => {
        if (gridRef.current?.api) {
          const rowCount = gridRef.current.api.getDisplayedRowCount();
          if (rowCount > 0) {
            gridRef.current.api.ensureIndexVisible(rowCount - 1, 'bottom');
          }
        }
      }, 500);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'actualCosts');
      toast.error("Failed to add record");
    }
  };

  const handleDeleteRecord = async (id: string, costCodeId: string) => {
    if (!isProjectAdmin) {
      toast.error("Only Project Admins can delete actual costs.");
      return;
    }

    try {
      await deleteDoc(doc(db, 'actualCosts', id));
      toast.success("Record deleted");
      if (costCodeId) await syncActualCostsToCostCode(costCodeId);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `actualCosts/${id}`);
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
        batch.delete(doc(db, 'actualCosts', id));
      });

      await batch.commit();
      
      // Sync all affected cost codes
      for (const ccId of affectedCostCodeIds) {
        await syncActualCostsToCostCode(ccId);
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
      const periodicCost = records
        .filter(r => r.reportingPeriodId === p.id)
        .reduce((sum, r) => sum + (Number(r.cost) || 0), 0);
      
      cumulative += periodicCost;
      
      // Format date as Aug'26
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
        cost: periodicCost,
        cumulative: cumulative
      };
    });
  }, [records, project.reportingPeriods?.periods]);

  const handleExportExcel = () => {
    const periods = project.reportingPeriods?.periods || [];
    const enterpriseAttrs = (enterprise.lineItemAttributes || []).filter(a => a.title);
    const projectAttrs = (project.lineItemAttributes || []).filter(a => a.title);

    const data = records.map(r => {
      const exportRow: any = {
        'Cost Code ID': costCodes.find(cc => cc.id === r.costCodeId)?.code || '',
        'Item': r.item,
        'Description': r.description,
        'Source': r.source,
        'Cost': r.cost,
        'Reporting Period': periods.find(p => p.id === r.reportingPeriodId)?.name || '',
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
    XLSX.utils.book_append_sheet(wb, ws, 'Actual Costs');
    XLSX.writeFile(wb, `Actual_Costs_${project.projectName}_${new Date().toISOString().split('T')[0]}.xlsx`);
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

        const periods = project.reportingPeriods?.periods || [];
        const currentPeriodId = project.reportingPeriods?.currentPeriodId;
        const currentPeriodIndex = periods.findIndex(p => p.id === currentPeriodId);
        
        const enterpriseAttrs = (enterprise.lineItemAttributes || []).filter(a => a.title);
        const projectAttrs = (project.lineItemAttributes || []).filter(a => a.title);
        
        const batch = writeBatch(db);
        const affectedCostCodeIds = new Set<string>();

        const findPeriod = (val: any) => {
          const strVal = String(val).trim();
          // Try matching by number (1-based index)
          const numVal = parseInt(strVal);
          if (!isNaN(numVal) && numVal > 0 && numVal <= periods.length) {
            return periods[numVal - 1];
          }
          // Try matching by name
          return periods.find(p => p.name === strVal);
        };

        // First pass: Validate all rows for valid and non-future periods, and valid cost codes
        const futurePeriodRows: string[] = [];
        const invalidPeriodRows: string[] = [];
        const invalidCostCodeRows: string[] = [];

        data.forEach((row, index) => {
          // Validate Period
          const periodValue = row['Reporting Period'];
          const period = findPeriod(periodValue);
          
          if (!period) {
            invalidPeriodRows.push(`Row ${index + 1} (Value: "${periodValue}")`);
          } else {
            const periodIndex = periods.findIndex(p => p.id === period.id);
            if (periodIndex > currentPeriodIndex) {
              futurePeriodRows.push(`Row ${index + 1} (Period ${periodIndex + 1})`);
            }
          }

          // Validate Cost Code
          const costCodeValue = String(row['Cost Code ID']).trim();
          const costCode = costCodes.find(cc => cc.code === costCodeValue);
          if (!costCode) {
            invalidCostCodeRows.push(`Row ${index + 1} (Value: "${costCodeValue}")`);
          }
        });

        if (invalidPeriodRows.length > 0 || futurePeriodRows.length > 0 || invalidCostCodeRows.length > 0) {
          toast.error(
            <div className="space-y-2">
              <p className="font-bold">Import Failed</p>
              {invalidCostCodeRows.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-red-500">Invalid Cost Codes (Not found):</p>
                  <ul className="text-[10px] list-disc pl-4 max-h-20 overflow-y-auto">
                    {invalidCostCodeRows.slice(0, 5).map((err, i) => <li key={i}>{err}</li>)}
                    {invalidCostCodeRows.length > 5 && <li>...and {invalidCostCodeRows.length - 5} more</li>}
                  </ul>
                </div>
              )}
              {invalidPeriodRows.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-red-500">Invalid Periods (Not found):</p>
                  <ul className="text-[10px] list-disc pl-4 max-h-20 overflow-y-auto">
                    {invalidPeriodRows.slice(0, 5).map((err, i) => <li key={i}>{err}</li>)}
                    {invalidPeriodRows.length > 5 && <li>...and {invalidPeriodRows.length - 5} more</li>}
                  </ul>
                </div>
              )}
              {futurePeriodRows.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-orange-500">Future Periods (Actuals not allowed):</p>
                  <ul className="text-[10px] list-disc pl-4 max-h-20 overflow-y-auto">
                    {futurePeriodRows.slice(0, 5).map((err, i) => <li key={i}>{err}</li>)}
                    {futurePeriodRows.length > 5 && <li>...and {futurePeriodRows.length - 5} more</li>}
                  </ul>
                </div>
              )}
            </div>,
            { duration: 8000 }
          );
          e.target.value = '';
          return;
        }

        data.forEach(row => {
          const costCode = costCodes.find(cc => cc.code === String(row['Cost Code ID']));
          const period = findPeriod(row['Reporting Period']);
          
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

          const newDocRef = doc(collection(db, 'actualCosts'));
          batch.set(newDocRef, {
            projectId: project.id,
            costCodeId: costCode?.id || '',
            item: row['Item'] || '',
            description: row['Description'] || '',
            source: row['Source'] || 'MAN',
            cost: Number(row['Cost']) || 0,
            reportingPeriodId: period?.id || '',
            enterpriseAttributes,
            projectAttributes,
            createdAt: new Date().toISOString()
          });
        });

        await batch.commit();
        
        // Sync affected cost codes
        for (const ccId of affectedCostCodeIds) {
          await syncActualCostsToCostCode(ccId);
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

    // Validate future period
    if (colDef.field === 'reportingPeriodId') {
      const periods = project.reportingPeriods?.periods || [];
      const currentPeriodId = project.reportingPeriods?.currentPeriodId;
      const currentPeriodIndex = periods.findIndex(p => p.id === currentPeriodId);
      const newPeriodIndex = periods.findIndex(p => p.id === newValue);

      if (newPeriodIndex > currentPeriodIndex) {
        toast.error("Actual costs cannot be recorded for future periods.");
        event.node.setDataValue(colDef.field, oldValue);
        return;
      }
    }

    try {
      const updates: any = {
        ...data,
        updatedAt: new Date().toISOString()
      };
      delete updates.id;

      await updateDoc(doc(db, 'actualCosts', data.id), updates);
      
      // If costCodeId or cost changed, sync both old and new cost codes
      if (colDef.field === 'costCodeId' || colDef.field === 'cost' || colDef.field === 'reportingPeriodId') {
        if (data.costCodeId) await syncActualCostsToCostCode(data.costCodeId);
        if (colDef.field === 'costCodeId' && oldValue) {
          await syncActualCostsToCostCode(oldValue);
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `actualCosts/${data.id}`);
      toast.error("Failed to update record");
      event.node.setDataValue(colDef.field!, oldValue);
    }
  };

  const columnDefs = useMemo<(ColDef | ColGroupDef)[]>(() => {
    const periods = project.reportingPeriods?.periods || [];
    const currentPeriodId = project.reportingPeriods?.currentPeriodId;
    const currentPeriodIndex = periods.findIndex(p => p.id === currentPeriodId);
    const allowedPeriods = periods.slice(0, currentPeriodIndex + 1);

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
            headerName: 'Source',
            field: 'source',
            width: 100,
            editable: isProjectAdmin,
            cellEditor: 'agSelectCellEditor',
            cellEditorParams: {
              values: ['MAN', 'ACC', 'FIN'],
            },
            filter: 'agSetColumnFilter',
          },
          {
            headerName: 'Cost',
            field: 'cost',
            width: 120,
            type: 'numericColumn',
            editable: isProjectAdmin,
            valueFormatter: (params) => formatCurrency(params.value),
            aggFunc: 'sum',
          },
          {
            headerName: 'Reporting Period',
            field: 'reportingPeriodId',
            width: 180,
            editable: isProjectAdmin,
            cellEditor: 'agSelectCellEditor',
            cellEditorParams: {
              values: allowedPeriods.map(p => p.id),
            },
            valueFormatter: (params) => {
              const index = periods.findIndex(p => p.id === params.value);
              return index !== -1 ? (index + 1).toString() : '';
            },
            filter: 'agSetColumnFilter',
            filterParams: {
              valueFormatter: (params: any) => {
                const index = periods.findIndex(p => p.id === params.value);
                return index !== -1 ? (index + 1).toString() : params.value;
              }
            }
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

  const totalActualCost = useMemo(() => records.reduce((sum, r) => sum + (Number(r.cost) || 0), 0), [records]);
  const currentPeriodId = project.reportingPeriods?.currentPeriodId;
  const currentPeriodCost = useMemo(() => 
    records.filter(r => r.reportingPeriodId === currentPeriodId).reduce((sum, r) => sum + (Number(r.cost) || 0), 0),
    [records, currentPeriodId]
  );

  return (
    <div className="flex-1 flex flex-col p-8 overflow-hidden bg-gray-50/50 dark:bg-transparent">
      <div className="flex justify-between items-end mb-8">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-black dark:bg-white rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-white dark:text-black" />
            </div>
            <h1 className="text-2xl font-bold dark:text-white">Actual Cost Management</h1>
          </div>
          <p className="text-sm text-gray-500">Track and manage project expenditures and actual costs.</p>
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
            Add Transaction
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="rounded-2xl border-gray-200 dark:border-white/10 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Total Actual Cost (To Date)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold dark:text-white">{formatCurrency(totalActualCost)}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-gray-200 dark:border-white/10 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Actual Cost (This Period)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold dark:text-white">{formatCurrency(currentPeriodCost)}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-gray-200 dark:border-white/10 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Total Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold dark:text-white">{records.length}</p>
          </CardContent>
        </Card>
      </div>

      <AnimatePresence>
        {isChartVisible && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mb-8 bg-white dark:bg-[#141414] rounded-2xl border border-gray-200 dark:border-white/10 p-6 overflow-hidden shadow-sm"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-blue-500" />
                  <h3 className="text-sm font-bold dark:text-white uppercase tracking-widest">Cost Distribution & Cumulative Flow</h3>
                </div>
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm bg-blue-500" />
                    <span className="text-[10px] font-bold text-gray-500 uppercase">Periodic Cost</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-0.5 bg-emerald-500" />
                    <span className="text-[10px] font-bold text-gray-500 uppercase">Cumulative Cost</span>
                  </div>
                </div>
              </div>
              
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#333' : '#eee'} />
                    <XAxis 
                      dataKey="name" 
                      fontSize={10} 
                      tick={{ fill: theme === 'dark' ? '#999' : '#666' }} 
                      axisLine={false}
                      tickLine={false}
                      label={{ value: 'Reporting Period', position: 'insideBottom', offset: -10, fontSize: 10, fill: '#999' }}
                    />
                    <YAxis 
                      yAxisId="left"
                      fontSize={10} 
                      tick={{ fill: theme === 'dark' ? '#999' : '#666' }} 
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`}
                      domain={[0, 'auto']}
                    />
                    <YAxis 
                      yAxisId="right"
                      orientation="right"
                      fontSize={10} 
                      tick={{ fill: theme === 'dark' ? '#999' : '#666' }} 
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`}
                      domain={[0, 'auto']}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: theme === 'dark' ? '#141414' : '#fff',
                        borderColor: theme === 'dark' ? '#333' : '#eee',
                        borderRadius: '12px',
                        fontSize: '11px',
                        padding: '12px',
                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                      }}
                      formatter={(val: number) => [`$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, '']}
                      labelFormatter={(label) => `Period ${label}`}
                    />
                    <Bar 
                      yAxisId="left" 
                      dataKey="cost" 
                      name="Periodic Cost" 
                      fill="#3b82f6" 
                      radius={[4, 4, 0, 0]} 
                      barSize={30}
                    >
                      <LabelList 
                        dataKey="cost" 
                        position="top" 
                        formatter={(val: number) => val > 0 ? `${Math.round(val / 1000)}k` : ''} 
                        style={{ fill: theme === 'dark' ? '#fff' : '#000', fontWeight: 'bold', fontSize: '10px' }}
                      />
                    </Bar>
                    <Line 
                      yAxisId="right" 
                      type="monotone" 
                      dataKey="cumulative" 
                      name="Cumulative Cost" 
                      stroke="#10b981" 
                      strokeWidth={3} 
                      dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: theme === 'dark' ? '#141414' : '#fff' }} 
                      activeDot={{ r: 6, strokeWidth: 0 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 bg-white dark:bg-[#141414] rounded-2xl border border-gray-200 dark:border-white/10 flex flex-col overflow-hidden shadow-sm">
        <div className="p-4 border-b border-gray-200 dark:border-white/10 flex items-center justify-between gap-4 bg-gray-50/50 dark:bg-white/5">
          <div className="flex items-center gap-4 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                placeholder="Search transactions..." 
                value={quickFilterText}
                onChange={(e) => setQuickFilterText(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/5 dark:text-white"
              />
            </div>
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-2 animate-in slide-in-from-left-2 duration-200">
                <Button 
                  variant="destructive" 
                  size="sm" 
                  className="rounded-xl"
                  onClick={() => setIsDeleteConfirmOpen(true)}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Selected ({selectedIds.size})
                </Button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="rounded-xl border-gray-200 dark:border-white/10">
              <Filter className="w-4 h-4 mr-2" />
              Filter
            </Button>
          </div>
        </div>
        
        <div className="flex-1 min-h-0 relative ag-theme-quartz dark:ag-theme-quartz-dark">
          <AgGridReact
            ref={gridRef}
            rowData={records}
            columnDefs={columnDefs}
            quickFilterText={quickFilterText}
            onCellValueChanged={onCellValueChanged}
            defaultColDef={{
              sortable: true,
              filter: true,
              resizable: true,
              minWidth: 100,
              enableRowGroup: true,
              enablePivot: true,
              enableValue: true,
            }}
            sideBar={sideBar}
            statusBar={statusBar}
            animateRows={true}
            loading={isLoading}
            rowSelection="multiple"
            suppressRowClickSelection={true}
            enableRangeSelection={true}
            enableFillHandle={true}
            undoRedoCellEditing={true}
            enableCellTextSelection={true}
            pagination={true}
            paginationPageSize={100}
            onSelectionChanged={(event) => {
              const selectedNodes = event.api.getSelectedNodes();
              setSelectedIds(new Set(selectedNodes.map(node => node.data.id)));
            }}
          />
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="w-5 h-5" />
              Confirm Deletion
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedIds.size} selected transaction{selectedIds.size > 1 ? 's' : ''}? This action cannot be undone and will update the associated Cost Codes.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsDeleteConfirmOpen(false)} className="rounded-xl">
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteSelected} className="rounded-xl">
              Delete Transactions
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ActualCost;
