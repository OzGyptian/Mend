import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Project, Enterprise, Subcontract, SubcontractLineItem, CostCode, Invoice } from '../types';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, writeBatch } from 'firebase/firestore';
import DataGridModule from './DataGridModule';
import { ColDef, ColGroupDef, CellValueChangedEvent, ValueFormatterParams } from 'ag-grid-community';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { formatCurrency, formatNumber, formatDate, dateToISO } from '../lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Plus, 
  Search, 
  Trash2, 
  Edit2, 
  ChevronRight, 
  ChevronDown,
  Building2,
  Calendar,
  DollarSign,
  FileText,
  Briefcase,
  Receipt,
  Hash,
  ChevronUp,
  Filter,
  Download,
  MoreVertical,
  Settings,
  Layout,
  Upload,
  RefreshCw,
  AlertCircle,
  X,
  BarChart3
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  ComposedChart,
  Line
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';
import 'ag-grid-enterprise';

interface BulkSubcontractLineItemsProps {
  project: Project;
  enterprise: Enterprise;
}

const BulkSubcontractLineItems: React.FC<BulkSubcontractLineItemsProps> = ({ project, enterprise }) => {
  const [subcontracts, setSubcontracts] = useState<Subcontract[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [costCodes, setCostCodes] = useState<CostCode[]>([]);
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<AgGridReact>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkUpdateOpen, setIsBulkUpdateOpen] = useState(false);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [isHistogramVisible, setIsHistogramVisible] = useState(false);
  
  // Import Wizard State
  const [importWizard, setImportWizard] = useState<{
    isOpen: boolean;
    phase: 'preview' | 'processing';
    data: any[];
    errors: { row: number; msg: string; type: 'error' | 'warning' }[];
    progress: number;
    total: number;
    processed: number;
  }>({
    isOpen: false,
    phase: 'preview',
    data: [],
    errors: [],
    progress: 0,
    total: 0,
    processed: 0
  });

  const [bulkUpdateData, setBulkUpdateData] = useState<Partial<SubcontractLineItem>>({
    enterpriseAttributes: {},
    projectAttributes: {},
    userDefined: {}
  });

  useEffect(() => {
    if (!project.id) return;
    const qSub = query(collection(db, 'subcontracts'), where('projectId', '==', project.id));
    const unsubSub = onSnapshot(qSub, (snapshot) => {
      setSubcontracts(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Subcontract)));
      setLoading(false);
    });

    const qInv = query(collection(db, 'invoices'), where('projectId', '==', project.id));
    const unsubInv = onSnapshot(qInv, (snapshot) => {
      setInvoices(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Invoice)));
    });

    const qCc = query(collection(db, 'costCodes'), where('projectId', '==', project.id));
    const unsubCc = onSnapshot(qCc, (snapshot) => {
      setCostCodes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CostCode)));
    });

    return () => {
      unsubSub();
      unsubInv();
      unsubCc();
    };
  }, [project.id]);

  const lineItemInvoiceAggregates = useMemo(() => {
    const aggregates: Record<string, { claimed: number, certified: number }> = {};
    
    const sortedInvoices = [...invoices].sort((a, b) => {
      const aNo = parseInt(a.invoiceId?.replace(/\D/g, '') || '0');
      const bNo = parseInt(b.invoiceId?.replace(/\D/g, '') || '0');
      return bNo - aNo;
    });

    const processedLineItems = new Set<string>();

    sortedInvoices.forEach(inv => {
      (inv.items || []).forEach(item => {
        const lineId = item.subcontractLineItemId;
        if (processedLineItems.has(lineId)) return;
        
        aggregates[lineId] = { 
          claimed: item.claimValue || 0, 
          certified: item.certifiedValue || 0 
        };
        processedLineItems.add(lineId);
      });
    });
    return aggregates;
  }, [invoices]);

  const phasingHistogramData = useMemo(() => {
    if (!project.reportingPeriods?.periods || subcontracts.length === 0) return [];
    
    const periods = project.reportingPeriods.periods;
    const currentPeriodId = project.reportingPeriods.currentPeriodId;
    const currentPeriodIndex = periods.findIndex(p => p.id === currentPeriodId);
    
    const allLineItems = subcontracts.flatMap(s => s.lineItems || []);
    
    const initialClaimed = allLineItems.reduce((sum, li) => {
      return sum + (lineItemInvoiceAggregates[li.id]?.claimed || 0);
    }, 0);
    
    let cumulative = initialClaimed;
    const startIndex = Math.max(0, currentPeriodIndex);
    const relevantPeriods = periods.slice(startIndex);
    
    return relevantPeriods.map((p) => {
      const isPastOrCurrent = periods.indexOf(p) <= currentPeriodIndex;
      const periodValue = isPastOrCurrent ? 0 : allLineItems.reduce((sum, li) => {
        return sum + (Number(li.periodValues?.[p.id]) || 0);
      }, 0);
      
      cumulative += periodValue;
      
      const date = new Date(p.endDate);
      const month = date.toLocaleString('default', { month: 'short' });
      const year = date.getFullYear().toString().slice(-2);
      const pIdx = periods.findIndex(per => per.id === p.id);
      const periodNumber = pIdx + 1;
      
      return {
        name: `P${periodNumber} (${month}'${year})`,
        periodic: Math.round(periodValue * 100) / 100,
        cumulative: Math.round(cumulative * 100) / 100
      };
    });
  }, [subcontracts, project.reportingPeriods, lineItemInvoiceAggregates]);

  const rowData = useMemo(() => {
    const items: any[] = [];
    subcontracts.forEach(sub => {
      if (sub.lineItems) {
        sub.lineItems.forEach(li => {
          items.push({
            ...li,
            orderId: sub.orderId,
            orderName: sub.orderName,
            vendorName: sub.vendorName,
            subcontractStatus: sub.status,
            claimedTotal: lineItemInvoiceAggregates[li.id]?.claimed || 0,
            certifiedTotal: lineItemInvoiceAggregates[li.id]?.certified || 0
          });
        });
      }
    });
    return items.sort((a, b) => {
      const orderCmp = (a.orderId || '').localeCompare(b.orderId || '');
      if (orderCmp !== 0) return orderCmp;
      return (a.itemNo || '').localeCompare(b.itemNo || '', undefined, { numeric: true });
    });
  }, [subcontracts, lineItemInvoiceAggregates]);

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;

    try {
      const batch = writeBatch(db);
      const subcontractsToUpdate = new Map<string, Subcontract>();

      selectedIds.forEach(id => {
        const itemRow = rowData.find(r => r.id === id);
        if (!itemRow) return;

        const subId = itemRow.subcontractId;
        let sub = subcontractsToUpdate.get(subId) || subcontracts.find(s => s.id === subId);
        if (!sub) return;

        // Clone sub if it's the first time we see it from the original state
        if (!subcontractsToUpdate.has(subId)) {
          sub = { ...sub };
        }

        sub.lineItems = (sub.lineItems || []).filter(li => li.id !== id);
        sub.totalAmount = sub.lineItems.reduce((sum, li) => sum + (li.total || 0), 0);
        sub.updatedAt = new Date().toISOString();
        subcontractsToUpdate.set(subId, sub);
      });

      subcontractsToUpdate.forEach((updatedSub, id) => {
        batch.update(doc(db, 'subcontracts', id), {
          lineItems: updatedSub.lineItems,
          totalAmount: updatedSub.totalAmount,
          updatedAt: updatedSub.updatedAt
        });
      });

      await batch.commit();
      toast.success(`Deleted ${selectedIds.length} line items.`);
      setSelectedIds([]);
      setIsBulkDeleteOpen(false);
    } catch (error) {
      console.error('Bulk delete error:', error);
      toast.error('Failed to delete items.');
    }
  };

  const handleBulkUpdate = async () => {
    if (selectedIds.length === 0) return;

    try {
      const batch = writeBatch(db);
      const subcontractsToUpdate = new Map<string, Subcontract>();

      selectedIds.forEach(id => {
        const itemRow = rowData.find(r => r.id === id);
        if (!itemRow) return;

        const subId = itemRow.subcontractId;
        let sub = subcontractsToUpdate.get(subId) || subcontracts.find(s => s.id === subId);
        if (!sub) return;

        if (!subcontractsToUpdate.has(subId)) {
          sub = { ...sub };
        }

        sub.lineItems = (sub.lineItems || []).map(li => {
          if (li.id === id) {
            const updatedLi = { ...li, updatedAt: new Date().toISOString() };
            if (bulkUpdateData.costCodeId) updatedLi.costCodeId = bulkUpdateData.costCodeId;
            if (bulkUpdateData.type) updatedLi.type = bulkUpdateData.type as any;
            if (bulkUpdateData.status) updatedLi.status = bulkUpdateData.status as any;
            if (bulkUpdateData.unit) updatedLi.unit = bulkUpdateData.unit;
            if (bulkUpdateData.rate) {
              updatedLi.rate = Number(bulkUpdateData.rate);
              updatedLi.total = (updatedLi.qty || 0) * updatedLi.rate;
            }
            if (bulkUpdateData.phasingSource) updatedLi.phasingSource = bulkUpdateData.phasingSource as any;
            if (bulkUpdateData.startDate) updatedLi.startDate = bulkUpdateData.startDate;
            if (bulkUpdateData.endDate) updatedLi.endDate = bulkUpdateData.endDate;
            if (bulkUpdateData.distribution) updatedLi.distribution = bulkUpdateData.distribution as any;

            // Enterprise Attributes
            if (bulkUpdateData.enterpriseAttributes) {
              updatedLi.enterpriseAttributes = {
                ...(updatedLi.enterpriseAttributes || {}),
                ...bulkUpdateData.enterpriseAttributes
              };
            }
            // Project Attributes
            if (bulkUpdateData.projectAttributes) {
              updatedLi.projectAttributes = {
                ...(updatedLi.projectAttributes || {}),
                ...bulkUpdateData.projectAttributes
              };
            }
            // User Defined
            if (bulkUpdateData.userDefined) {
              updatedLi.userDefined = {
                ...(updatedLi.userDefined || {}),
                ...bulkUpdateData.userDefined
              };
            }

            return updatedLi;
          }
          return li;
        });

        sub.totalAmount = sub.lineItems.reduce((sum, li) => sum + (li.total || 0), 0);
        sub.updatedAt = new Date().toISOString();
        subcontractsToUpdate.set(subId, sub);
      });

      subcontractsToUpdate.forEach((updatedSub, id) => {
        batch.update(doc(db, 'subcontracts', id), {
          lineItems: updatedSub.lineItems,
          totalAmount: updatedSub.totalAmount,
          updatedAt: updatedSub.updatedAt
        });
      });

      await batch.commit();
      toast.success(`Updated ${selectedIds.length} line items.`);
      setSelectedIds([]);
      setIsBulkUpdateOpen(false);
      setBulkUpdateData({
        enterpriseAttributes: {},
        projectAttributes: {},
        userDefined: {}
      });
    } catch (error) {
      console.error('Bulk update error:', error);
      toast.error('Failed to update items.');
    }
  };

  const handleExportExcel = () => {
    const exportData = rowData.map(li => ({
      'Order ID': li.orderId,
      'Order Name': li.orderName,
      'Vendor': li.vendorName,
      'No.': li.itemNo,
      'Description': li.description,
      'Cost Code ID': li.costCodeId || '',
      'Date': li.date || '',
      'Type': li.type,
      'Status': li.status,
      'Qty': li.qty,
      'Unit': li.unit,
      'Rate': li.rate,
      'Total': li.total,
      'Claimed': li.claimedTotal,
      'Certified': li.certifiedTotal
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'BulkLineItems');
    XLSX.writeFile(wb, `Bulk_Subcontract_Line_Items_${project.projectName}.xlsx`);
  };

  const handleCellValueChanged = async (event: CellValueChangedEvent) => {
    const { data, colDef, newValue, oldValue } = event;
    if (newValue === oldValue) return;

    const subcontractId = data.subcontractId;
    const lineItemId = data.id;

    const subcontract = subcontracts.find(s => s.id === subcontractId);
    if (!subcontract) return;

    const field = colDef.field!;
    const updatedLineItems = subcontract.lineItems.map(li => {
      if (li.id === lineItemId) {
        const updatedLi = { ...li, updatedAt: new Date().toISOString() };
        
        // Handle date objects from editor
        let finalValue = newValue;
        if (field === 'date' && newValue instanceof Date) {
          finalValue = dateToISO(newValue);
        }

        if (field.includes('.')) {
          const parts = field.split('.');
          let current: any = updatedLi;
          for (let i = 0; i < parts.length - 1; i++) {
            current[parts[i]] = current[parts[i]] ? { ...current[parts[i]] } : {};
            current = current[parts[i]];
          }
          current[parts[parts.length - 1]] = finalValue;
        } else {
          (updatedLi as any)[field] = finalValue;
        }
        
        // Recalculate total if qty or rate changes
        if (field === 'qty' || field === 'rate') {
          updatedLi.total = (Number(updatedLi.qty) || 0) * (Number(updatedLi.rate) || 0);
        }
        return updatedLi;
      }
      return li;
    });

    const newTotal = updatedLineItems.reduce((sum, li) => sum + (li.total || 0), 0);

    try {
      await updateDoc(doc(db, 'subcontracts', subcontractId), {
        lineItems: updatedLineItems,
        totalAmount: newTotal,
        updatedAt: new Date().toISOString()
      });
      toast.success('Line item updated successfully');
    } catch (error) {
      console.error('Error updating line item:', error);
      toast.error('Failed to update line item.');
    }
  };

  const handleImportExcel = () => {
    fileInputRef.current?.click();
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        if (data.length === 0) {
          toast.error('The Excel file is empty.');
          return;
        }

        const errors: { row: number; msg: string; type: 'error' | 'warning' }[] = [];

        // Validation pass
        data.forEach((row, index) => {
          const rowNum = index + 1;
          const orderId = String(row['Order ID'] || '').trim();
          const costCodeValue = String(row['Cost Code ID'] || '').trim();

          if (!orderId) {
            errors.push({ row: rowNum, msg: "Missing Order ID", type: 'error' });
          } else {
            const sub = subcontracts.find(s => s.orderId === orderId);
            if (!sub) errors.push({ row: rowNum, msg: `Subcontract "${orderId}" not found`, type: 'error' });
          }

          if (costCodeValue) {
            const cc = costCodes.find(c => c.code === costCodeValue);
            if (!cc) errors.push({ row: rowNum, msg: `Cost Code "${costCodeValue}" not found`, type: 'error' });
          }
        });

        setImportWizard({
          isOpen: true,
          phase: 'preview',
          data,
          errors,
          progress: 0,
          total: data.length,
          processed: 0
        });

      } catch (error) {
        console.error("Error reading Excel:", error);
        toast.error("Failed to read Excel file.");
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const executeImport = async () => {
    const { data } = importWizard;
    setImportWizard(prev => ({ ...prev, phase: 'processing', progress: 0 }));

    const subcontractsToUpdate = new Map<string, Subcontract>();
    const nextItemNumbers = new Map<string, number>();
    
    subcontracts.forEach(sub => {
      const maxNum = (sub.lineItems || []).reduce((max, li) => {
        const num = parseInt(li.itemNo);
        return isNaN(num) ? max : Math.max(max, num);
      }, 0);
      nextItemNumbers.set(sub.id, maxNum + 1);
    });

    const chunkSize = 450;
    const totalChunks = Math.ceil(data.length / chunkSize);
    
    try {
      for (let i = 0; i < totalChunks; i++) {
        const chunk = data.slice(i * chunkSize, (i + 1) * chunkSize);
        
        for (const row of chunk) {
          const orderId = String(row['Order ID'] || '').trim();
          const targetSub = subcontracts.find(s => s.orderId === orderId);
          if (!targetSub) continue;

          let subToUpdate = subcontractsToUpdate.get(targetSub.id) || { ...targetSub };
          if (!subToUpdate.lineItems) subToUpdate.lineItems = [];

          const currentItemNo = nextItemNumbers.get(targetSub.id) || 1;
          
          const newLineItem: SubcontractLineItem = {
            id: doc(collection(db, 'temp')).id,
            subcontractId: targetSub.id,
            projectId: project.id,
            itemNo: String(currentItemNo).padStart(3, '0'),
            description: String(row['Description'] || ''),
            // We store the readable code here as several parts of the UI expect c.code for matching
            costCodeId: costCodes.find(cc => cc.code === String(row['Cost Code ID']))?.code || String(row['Cost Code ID'] || ''),
            date: row['Date'] || dateToISO(new Date()),
            qty: Number(row['Qty']) || 0,
            unit: String(row['Unit'] || ''),
            rate: Number(row['Rate']) || 0,
            total: (Number(row['Qty']) || 0) * (Number(row['Rate']) || 0),
            type: (row['Type'] === 'ChangeOrder' ? 'ChangeOrder' : 'Original') as any,
            status: (['Approved', 'Pending', 'Rejected'].includes(row['Status']) ? row['Status'] : 'Pending') as any,
            enterpriseAttributes: {},
            projectAttributes: {},
            userDefined: {
              num1: Number(row['Numeric 1']) || 0,
              num2: Number(row['Numeric 2']) || 0,
              num3: Number(row['Numeric 3']) || 0,
              num4: Number(row['Numeric 4']) || 0,
              num5: Number(row['Numeric 5']) || 0,
              text1: String(row['Text 1'] || ''),
              text2: String(row['Text 2'] || ''),
              text3: String(row['Text 3'] || ''),
              text4: String(row['Text 4'] || ''),
              text5: String(row['Text 5'] || ''),
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };

          enterprise.lineItemAttributes?.forEach(attr => {
            if (row[attr.title] !== undefined) {
              newLineItem.enterpriseAttributes[attr.id] = String(row[attr.title]);
            }
          });
          project.lineItemAttributes?.forEach(attr => {
            if (row[attr.title] !== undefined) {
              newLineItem.projectAttributes[attr.id] = String(row[attr.title]);
            }
          });

          subToUpdate.lineItems.push(newLineItem);
          subToUpdate.totalAmount = subToUpdate.lineItems.reduce((sum, li) => sum + (li.total || 0), 0);
          subToUpdate.updatedAt = new Date().toISOString();
          subcontractsToUpdate.set(targetSub.id, subToUpdate);
          nextItemNumbers.set(targetSub.id, currentItemNo + 1);
        }

        const processed = Math.min((i + 1) * chunkSize, data.length);
        setImportWizard(prev => ({ 
          ...prev, 
          processed,
          progress: Math.round((processed / data.length) * 100) 
        }));
      }

      const subsToSave = Array.from(subcontractsToUpdate.values());
      const batchSize = 10; 
      
      // Update progress to 95% while starting DB writes
      setImportWizard(prev => ({ ...prev, progress: 95 }));

      for (let i = 0; i < subsToSave.length; i += batchSize) {
        const batch = writeBatch(db);
        const currentBatch = subsToSave.slice(i, i + batchSize);
        currentBatch.forEach(sub => {
          const subRef = doc(db, 'subcontracts', sub.id);
          const { id, ...saveData } = sub;
          batch.update(subRef, saveData);
        });
        await batch.commit();

        // Progressively increase from 95% to 100%
        const batchProgress = Math.round(95 + (5 * (i + currentBatch.length) / subsToSave.length));
        setImportWizard(prev => ({ ...prev, progress: Math.min(99, batchProgress) }));
      }

      setImportWizard(prev => ({ ...prev, progress: 100 }));
      toast.success(`Successfully imported ${data.length} line items.`);
      setTimeout(() => setImportWizard(prev => ({ ...prev, isOpen: false })), 500);
    } catch (error) {
      console.error("Import execution error:", error);
      toast.error("Failed to complete import.");
      setImportWizard(prev => ({ ...prev, isOpen: false }));
    }
  };

  const columnDefs = useMemo<any[]>(() => {
    const sortedCostCodes = [...costCodes].sort((a, b) => a.code.localeCompare(b.code));
    const periods = project.reportingPeriods?.periods || [];
    const currentPeriodId = project.reportingPeriods?.currentPeriodId;
    const currentPeriodIndex = periods.findIndex(p => p.id === currentPeriodId);

    const defs: any[] = [
      {
        headerName: 'Subcontract',
        pinned: 'left',
        children: [
          { field: 'orderId', headerName: 'Order ID', width: 120, enableRowGroup: true, editable: false, pinned: 'left', sort: 'asc', sortIndex: 0 },
          { field: 'orderName', headerName: 'Order Name', width: 150, enableRowGroup: true, editable: false },
          { field: 'vendorName', headerName: 'Vendor Name', width: 150, enableRowGroup: true, editable: false },
          { field: 'subcontractStatus', headerName: 'Status', width: 100, enableRowGroup: true, editable: false },
        ]
      },
      {
        headerName: 'Item Details',
        pinned: 'left',
        children: [
          { 
            field: 'itemNo', 
            headerName: 'No.', 
            width: 80, 
            pinned: 'left', 
            editable: false,
            checkboxSelection: true,
            headerCheckboxSelection: true,
            sort: 'asc',
            sortIndex: 1
          },
          { 
            field: 'description', 
            headerName: 'Description', 
            width: 250, 
            pinned: 'left', 
            editable: true
          },
          {
            field: 'costCodeId',
            headerName: 'Cost Code ID',
            width: 180,
            editable: true,
            valueFormatter: params => {
              const val = params.value;
              const code = sortedCostCodes.find(c => c.code === val);
              return code ? `${code.code} - ${code.name}` : val;
            },
            cellEditor: 'agRichSelectCellEditor',
            cellEditorParams: {
              values: sortedCostCodes.map(c => c.code),
              formatValue: (val: string) => {
                const code = sortedCostCodes.find(c => c.code === val);
                return code ? `${code.code} - ${code.name}` : val;
              },
              searchType: 'match',
              allowTyping: true,
              filterList: true,
              highlightMatch: true
            }
          },
          {
            field: 'date',
            headerName: 'Date',
            width: 120,
            editable: true,
            cellEditor: 'agDateCellEditor',
            valueGetter: params => params.data.date ? new Date(params.data.date) : null,
            valueSetter: params => {
              if (params.newValue instanceof Date) {
                params.data.date = dateToISO(params.newValue);
              } else {
                params.data.date = params.newValue;
              }
              return true;
            },
            valueFormatter: params => formatDate(params.value)
          }
        ]
      },
      // Pricing
      {
        headerName: 'Pricing',
        children: [
          { 
            field: 'qty', 
            headerName: 'Qty', 
            width: 100, 
            type: 'numericColumn', 
            editable: true
          },
          { 
            field: 'unit', 
            headerName: 'Unit', 
            width: 80, 
            editable: true
          },
          { 
            field: 'rate', 
            headerName: 'Rate', 
            width: 120, 
            type: 'numericColumn', 
            editable: true, 
            valueFormatter: params => formatCurrency(params.value) 
          },
          { 
            field: 'total', 
            headerName: 'Total', 
            width: 130, 
            type: 'numericColumn',
            valueGetter: params => {
              if (!params.data) return 0;
              return (params.data.qty || 0) * (params.data.rate || 0);
            },
            valueFormatter: params => formatCurrency(params.value),
            cellClass: 'font-bold',
            cellStyle: (params: any) => {
              const totalContract = params.data.total || 0;
              const claimed = lineItemInvoiceAggregates[params.data.id]?.claimed || 0;
              const certified = lineItemInvoiceAggregates[params.data.id]?.certified || 0;
              if (totalContract > 0 && (claimed > totalContract + 0.01 || certified > totalContract + 0.01)) {
                return { color: '#ef4444', fontWeight: 'bold' }; 
              }
              return null;
            }
          },
          {
            headerName: 'Claimed Total',
            field: 'claimedTotal',
            width: 130,
            type: 'numericColumn',
            valueFormatter: params => formatCurrency(params.value),
            cellClass: 'text-blue-600 dark:text-blue-400 font-medium'
          },
          {
            headerName: 'Certified Total',
            field: 'certifiedTotal',
            width: 130,
            type: 'numericColumn',
            valueFormatter: params => formatCurrency(params.value),
            cellClass: 'font-medium'
          },
          {
            headerName: 'Variance',
            width: 130,
            type: 'numericColumn',
            valueGetter: params => {
              const claimed = lineItemInvoiceAggregates[params.data?.id]?.claimed || 0;
              const certified = lineItemInvoiceAggregates[params.data?.id]?.certified || 0;
              return certified - claimed;
            },
            valueFormatter: params => formatCurrency(params.value),
            cellStyle: params => {
              if (params.value < -0.01) return { color: '#ef4444', fontWeight: 'bold' };
              if (params.value > 0.01) return { color: '#10b981', fontWeight: 'bold' };
              return null;
            }
          }
        ]
      },
      // Status
      {
        headerName: 'Status',
        children: [
          { 
            field: 'type', 
            headerName: 'Type', 
            width: 140, 
            editable: true,
            cellEditor: 'agSelectCellEditor',
            cellEditorParams: {
              values: ['Original', 'ChangeOrder']
            },
            cellRenderer: (params: any) => (
              <span className={cn(
                "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest",
                params.value === 'Original' ? "bg-gray-100 text-gray-700 dark:bg-white/5 dark:text-gray-400" :
                "bg-orange-100 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400"
              )}>
                {params.value}
              </span>
            )
          },
          { 
            field: 'status', 
            headerName: 'Status', 
            width: 140, 
            editable: true,
            cellEditor: 'agSelectCellEditor',
            cellEditorParams: {
              values: ['Approved', 'Pending', 'Forecast', 'Rejected']
            },
            cellRenderer: (params: any) => (
              <span className={cn(
                "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest",
                params.value === 'Approved' ? "bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400" :
                params.value === 'Pending' ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-400" :
                params.value === 'Forecast' ? "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400" :
                "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400"
              )}>
                {params.value}
              </span>
            )
          }
        ]
      }
    ];

    const nestedValueSetter = (params: any) => {
      const field = params.colDef.field;
      if (!field) return false;
      const parts = field.split('.');
      let current = params.data;
      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (!current[part]) current[part] = {};
        current = current[part];
      }
      current[parts[parts.length - 1]] = params.newValue;
      return true;
    };

    // Enterprise Attributes
    const enterpriseLineItemAttrs = (enterprise.lineItemAttributes || []).filter(attr => attr.title && attr.title.trim() !== '');
    if (enterpriseLineItemAttrs.length > 0) {
      defs.push({
        headerName: 'Enterprise Attributes',
        children: enterpriseLineItemAttrs.map((attr, index) => ({
          headerName: attr.title,
          field: `enterpriseAttributes.${attr.id}`,
          width: 150,
          editable: true,
          cellEditor: 'agRichSelectCellEditor',
          cellEditorParams: {
            values: attr.values.map(v => v.id),
            formatValue: (id: string) => {
              if (!id) return '';
              const match = attr.values?.find(v => v.id === id);
              return match ? `${match.id} - ${match.description}` : id;
            },
            searchType: 'match',
            allowTyping: true,
            filterList: true
          },
          valueSetter: nestedValueSetter,
          valueFormatter: (params: any) => {
            const v = attr.values.find(v => v.id === params.value);
            return v ? `${v.id} - ${v.description}` : params.value;
          }
        }))
      });
    }

    // Project Attributes
    const projectLineItemAttrs = (project.lineItemAttributes || []).filter(attr => attr.title && attr.title.trim() !== '');
    if (projectLineItemAttrs.length > 0) {
      defs.push({
        headerName: 'Project Attributes',
        children: projectLineItemAttrs.map((attr, index) => ({
          headerName: attr.title,
          field: `projectAttributes.${attr.id}`,
          width: 150,
          editable: true,
          cellEditor: 'agRichSelectCellEditor',
          cellEditorParams: {
            values: attr.values.map(v => v.id),
            formatValue: (id: string) => {
              if (!id) return '';
              const match = attr.values?.find(v => v.id === id);
              return match ? `${match.id} - ${match.description}` : id;
            },
            searchType: 'match',
            allowTyping: true,
            filterList: true
          },
          valueSetter: nestedValueSetter,
          valueFormatter: (params: any) => {
            const v = attr.values.find(v => v.id === params.value);
            return v ? `${v.id} - ${v.description}` : params.value;
          }
        }))
      });
    }

    // Timephasing
    defs.push({
      headerName: 'Timephasing',
      children: [
        {
          headerName: 'Phasing Source',
          field: 'phasingSource',
          width: 130,
          editable: true,
          cellEditor: 'agSelectCellEditor',
          cellEditorParams: { values: ['Manual', 'Auto'] },
          cellStyle: (params: any) => ({ backgroundColor: 'rgba(255, 237, 213, 0.3)' }) 
        },
        {
          headerName: 'Start Date',
          field: 'startDate',
          width: 120,
          editable: true,
          cellEditor: 'agDateCellEditor',
          valueGetter: params => params.data.startDate ? new Date(params.data.startDate) : null,
          valueSetter: params => {
            if (params.newValue instanceof Date) {
              params.data.startDate = dateToISO(params.newValue);
            } else {
              params.data.startDate = params.newValue;
            }
            return true;
          },
          valueFormatter: params => formatDate(params.value)
        },
        {
          headerName: 'End Date',
          field: 'endDate',
          width: 120,
          editable: true,
          cellEditor: 'agDateCellEditor',
          valueGetter: params => params.data.endDate ? new Date(params.data.endDate) : null,
          valueSetter: params => {
            if (params.newValue instanceof Date) {
              params.data.endDate = dateToISO(params.newValue);
            } else {
              params.data.endDate = params.newValue;
            }
            return true;
          },
          valueFormatter: params => formatDate(params.value)
        },
        {
          headerName: 'Distribution',
          field: 'distribution',
          width: 130,
          editable: (params: any) => params.data.phasingSource === 'Auto',
          cellEditor: 'agSelectCellEditor',
          cellEditorParams: {
            values: ['Even', 'Bell', 'Front load', 'Back load', 'S-Curve', 'Profile']
          },
        },
        {
          headerName: 'Remaining to Claim',
          width: 150,
          type: 'numericColumn',
          valueGetter: params => {
            const total = (params.data.qty || 0) * (params.data.rate || 0);
            const claimed = lineItemInvoiceAggregates[params.data.id]?.claimed || 0;
            return Math.max(0, total - claimed);
          },
          valueFormatter: params => formatCurrency(params.value),
          cellClass: 'font-bold bg-slate-50 dark:bg-slate-900',
        },
        {
          headerName: 'Total Phased',
          width: 140,
          type: 'numericColumn',
          valueFormatter: params => formatCurrency(params.value),
          valueGetter: (params) => {
            if (params.node?.rowPinned === 'top') return params.data?.totalPhased;
            const values = params.data.periodValues || {};
            return Object.values(values).reduce<number>((sum, val) => sum + (Number(val) || 0), 0);
          },
          cellClass: (params: any) => {
            if (params.node?.rowPinned === 'top') return 'font-bold';
            const total = (params.data.qty || 0) * (params.data.rate || 0);
            const claimed = lineItemInvoiceAggregates[params.data.id]?.claimed || 0;
            const remaining = Math.max(0, total - claimed);
            const phased = Object.values(params.data.periodValues || {}).reduce<number>((sum, val) => sum + (Number(val) || 0), 0);
            const diff = Math.abs(phased - remaining);
            if (diff > 0.01) return 'bg-red-50 text-red-700 font-bold dark:bg-red-950/20';
            return 'bg-green-50 text-green-700 font-bold dark:bg-green-950/20';
          }
        },
        {
          headerName: 'Timephasing Variance',
          width: 170,
          type: 'numericColumn',
          valueFormatter: params => formatCurrency(params.value),
          valueGetter: (params) => {
            if (params.node?.rowPinned === 'top') return params.data?.phasingVariance;
            const total = (params.data.qty || 0) * (params.data.rate || 0);
            const claimed = lineItemInvoiceAggregates[params.data.id]?.claimed || 0;
            const remaining = Math.max(0, total - claimed);
            const phased = Object.values(params.data.periodValues || {}).reduce<number>((sum, val) => sum + (Number(val) || 0), 0);
            return remaining - phased;
          },
          cellStyle: (params: any) => {
            if (params.node.rowPinned === 'top') return null;
            if (Math.abs(params.value) > 0.01) return { color: '#ef4444', fontWeight: 'bold' };
            return { color: '#10b981', fontWeight: 'bold' };
          }
        },
        ...periods.map(p => {
          const date = new Date(p.endDate);
          const month = date.toLocaleString('default', { month: 'short' });
          const year = date.getFullYear().toString().slice(-2);
          const pIdx = periods.findIndex(per => per.id === p.id);
          const periodNumber = pIdx + 1;
          
          return {
            headerName: `P${periodNumber}\n(${month}'${year})`,
            field: `periodValues.${p.id}`,
            width: 120,
            type: 'numericColumn',
            hide: pIdx <= currentPeriodIndex,
            valueFormatter: (params: any) => formatCurrency(params.value),
            editable: (params: any) => params.data.phasingSource === 'Manual' && pIdx > currentPeriodIndex,
            cellClass: (params: any) => {
              const isEditable = params.data.phasingSource === 'Manual' && pIdx > currentPeriodIndex;
              return isEditable ? 'bg-white dark:bg-slate-900' : 'bg-slate-50 dark:bg-slate-900/50 text-gray-500';
            },
            valueGetter: (params: any) => {
              if (pIdx <= currentPeriodIndex) return 0;
              return params.data.periodValues?.[p.id] || 0;
            },
            valueSetter: (params: any) => {
              const val = Number(params.newValue);
              if (isNaN(val)) return false;
              params.data.periodValues = { ...params.data.periodValues, [p.id]: val };
              return true;
            }
          };
        })
      ]
    });

    return defs;
  }, [costCodes, enterprise, project, lineItemInvoiceAggregates]);

  const pinnedBottomRowData = useMemo(() => {
    if (rowData.length === 0) return [];
    
    const totalQty = rowData.reduce((sum, row) => sum + (Number(row.qty) || 0), 0);
    const totalAmount = rowData.reduce((sum, row) => sum + (Number(row.total) || 0), 0);
    
    // Phasing totals for grand total row
    let totalPhased = 0;
    let totalRemaining = 0;
    
    rowData.forEach(row => {
      const remainingValue = Math.max(0, (row.qty || 0) * (row.rate || 0) - (lineItemInvoiceAggregates[row.id]?.claimed || 0));
      const phasedValue = Object.values(row.periodValues || {}).reduce<number>((s, v) => s + (Number(v) || 0), 0);
      totalPhased += phasedValue;
      totalRemaining += remainingValue;
    });

    return [{
      description: 'GRAND TOTAL',
      qty: totalQty,
      total: totalAmount,
      totalPhased: totalPhased,
      phasingVariance: totalRemaining - totalPhased,
      isTotalRow: true
    }];
  }, [rowData]);

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading Subcontract Line Items...</div>;
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <DataGridModule
        title="Bulk Subcontract Line-Items"
        description="View and update line items across all subcontracts for the project."
        rowData={rowData}
        columnDefs={columnDefs}
        pinnedBottomRowData={pinnedBottomRowData}
        onImport={handleImportExcel}
        onExport={handleExportExcel}
        selectedCount={selectedIds.length}
        onBulkUpdate={() => setIsBulkUpdateOpen(true)}
        onBulkDelete={() => setIsBulkDeleteOpen(true)}
        extraToolbarActions={
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsHistogramVisible(!isHistogramVisible)}
            className={cn(
              "h-9 w-9 rounded-xl transition-all duration-200",
              isHistogramVisible ? "bg-black text-white shadow-lg" : "text-slate-400 hover:text-black hover:bg-slate-100"
            )}
            title="Toggle Histogram"
          >
            <BarChart3 className="w-5 h-5" />
          </Button>
        }
        topContent={
          <AnimatePresence>
            {isHistogramVisible && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="p-6 bg-slate-50 dark:bg-white/5 border-b border-slate-200 dark:border-white/10">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Phasing Histogram (Remaining to Claim)</h4>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-sm bg-purple-500" />
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Periodic Value</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-1 rounded-full bg-blue-500" />
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cumulative Remaining</span>
                      </div>
                    </div>
                  </div>
                  <div className="h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={phasingHistogramData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                        <XAxis 
                          dataKey="name" 
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }}
                          dy={10}
                        />
                        <YAxis 
                          yAxisId="left"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }}
                          tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                        />
                        <YAxis 
                          yAxisId="right"
                          orientation="right"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }}
                          tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#1a1a1a', 
                            border: 'none', 
                            borderRadius: '12px',
                            boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                            padding: '12px'
                          }}
                          itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                          labelStyle={{ color: '#94a3b8', fontSize: '10px', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                          formatter={(value: any) => [formatCurrency(value), '']}
                        />
                        <Bar 
                          yAxisId="left"
                          dataKey="periodic" 
                          fill="#a855f7" 
                          radius={[4, 4, 0, 0]} 
                          barSize={30}
                        />
                        <Line 
                          yAxisId="right"
                          type="monotone" 
                          dataKey="cumulative" 
                          stroke="#3b82f6" 
                          strokeWidth={3}
                          dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }}
                          activeDot={{ r: 6, strokeWidth: 0 }}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        }
        gridProps={{
          rowSelection: 'multiple',
          suppressRowClickSelection: true,
          onCellValueChanged: handleCellValueChanged,
          onSelectionChanged: (event: any) => {
            const selectedNodes = event.api.getSelectedNodes();
            const ids = selectedNodes.map((node: any) => node.data.id).filter(Boolean);
            setSelectedIds(ids);
          },
          getRowClass: (params: any) => {
            if (params.node.rowPinned) return 'pinned-row-highlight font-bold';
            return '';
          },
          gridRef: gridRef
        }}
      />
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={onFileChange} 
        accept=".xlsx, .xls" 
        className="hidden" 
      />

      {/* Bulk Delete Confirmation */}
      <Dialog open={isBulkDeleteOpen} onOpenChange={setIsBulkDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Bulk Delete</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedIds.length} selected line items? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBulkDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleBulkDelete}>Delete Items</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Update Dialog */}
      <Dialog open={isBulkUpdateOpen} onOpenChange={setIsBulkUpdateOpen}>
        <DialogContent className="max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle>Bulk Update Line Items</DialogTitle>
                <DialogDescription>
                  Update {selectedIds.length} selected line items across all subcontracts. Only modified fields will be applied.
                </DialogDescription>
              </div>
              <button 
                onClick={() => setIsBulkUpdateOpen(false)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
          </DialogHeader>

          <div className="overflow-y-auto flex-1 px-1 py-4 space-y-8 scrollbar-thin">
            {/* Core Details */}
            <section className="space-y-4">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-100 dark:border-white/5 pb-2">Core Details</h3>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Cost Code</label>
                  <select 
                    value={bulkUpdateData.costCodeId || ''}
                    onChange={e => setBulkUpdateData({ ...bulkUpdateData, costCodeId: e.target.value })}
                    className="w-full px-4 py-2.5 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  >
                    <option value="">No Change</option>
                    {costCodes.map(c => (
                      <option key={c.id} value={c.code}>{c.code} - {c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Date</label>
                  <Input 
                    type="date"
                    className="h-11 rounded-xl"
                    value={bulkUpdateData.date || ''}
                    onChange={e => setBulkUpdateData({ ...bulkUpdateData, date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Type</label>
                  <select 
                    value={bulkUpdateData.type || ''}
                    onChange={e => setBulkUpdateData({ ...bulkUpdateData, type: e.target.value as any })}
                    className="w-full px-4 py-2.5 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  >
                    <option value="">No Change</option>
                    <option value="Original">Original</option>
                    <option value="ChangeOrder">ChangeOrder</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Status</label>
                  <select 
                    value={bulkUpdateData.status || ''}
                    onChange={e => setBulkUpdateData({ ...bulkUpdateData, status: e.target.value as any })}
                    className="w-full px-4 py-2.5 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  >
                    <option value="">No Change</option>
                    <option value="Approved">Approved</option>
                    <option value="Pending">Pending</option>
                    <option value="Forecast">Forecast</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Rate</label>
                  <Input 
                    type="number"
                    placeholder="Enter rate..."
                    className="h-11 rounded-xl"
                    value={bulkUpdateData.rate || ''}
                    onChange={e => setBulkUpdateData({ ...bulkUpdateData, rate: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Unit</label>
                  <Input 
                    placeholder="Enter unit..."
                    className="h-11 rounded-xl"
                    value={bulkUpdateData.unit || ''}
                    onChange={e => setBulkUpdateData({ ...bulkUpdateData, unit: e.target.value })}
                  />
                </div>
              </div>
            </section>

            {/* Timephasing Section */}
            <section className="space-y-4">
              <h3 className="text-xs font-bold text-blue-500 uppercase tracking-widest border-b border-blue-50 dark:border-blue-500/10 pb-2">Timephasing</h3>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Phasing Source</label>
                  <select 
                    value={bulkUpdateData.phasingSource || ''}
                    onChange={e => setBulkUpdateData({ ...bulkUpdateData, phasingSource: e.target.value as any })}
                    className="w-full px-4 py-2.5 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  >
                    <option value="">No Change</option>
                    <option value="Auto">Auto</option>
                    <option value="Manual">Manual</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Distribution</label>
                  <select 
                    value={bulkUpdateData.distribution || ''}
                    onChange={e => setBulkUpdateData({ ...bulkUpdateData, distribution: e.target.value as any })}
                    className="w-full px-4 py-2.5 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  >
                    <option value="">No Change</option>
                    <option value="Even">Even</option>
                    <option value="Bell Curve">Bell Curve</option>
                    <option value="Front load">Front load</option>
                    <option value="Back load">Back load</option>
                    <option value="S-Curve">S-Curve</option>
                    <option value="Profile">Profile</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Start Date</label>
                  <Input 
                    type="date"
                    className="h-11 rounded-xl"
                    value={bulkUpdateData.startDate || ''}
                    onChange={e => setBulkUpdateData({ ...bulkUpdateData, startDate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">End Date</label>
                  <Input 
                    type="date"
                    className="h-11 rounded-xl"
                    value={bulkUpdateData.endDate || ''}
                    onChange={e => setBulkUpdateData({ ...bulkUpdateData, endDate: e.target.value })}
                  />
                </div>
              </div>
            </section>

            {/* Enterprise Attributes */}
            {enterprise.lineItemAttributes && enterprise.lineItemAttributes.length > 0 && (
              <section className="space-y-4">
                <h3 className="text-xs font-bold text-emerald-500 uppercase tracking-widest border-b border-emerald-50 dark:border-emerald-500/10 pb-2">Enterprise Attributes</h3>
                <div className="grid grid-cols-2 gap-6">
                  {enterprise.lineItemAttributes.map(attr => (
                    <div key={attr.id} className="space-y-2">
                      <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{attr.title}</label>
                      <select 
                        value={bulkUpdateData.enterpriseAttributes?.[attr.id] || ''}
                        onChange={e => setBulkUpdateData({ 
                          ...bulkUpdateData, 
                          enterpriseAttributes: { 
                            ...(bulkUpdateData.enterpriseAttributes || {}), 
                            [attr.id]: e.target.value 
                          } 
                        })}
                        className="w-full px-4 py-2.5 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      >
                        <option value="">No Change</option>
                        {attr.values.map(val => (
                          <option key={val.id} value={val.id}>{val.id} - {val.description}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Project Attributes */}
            {project.lineItemAttributes && project.lineItemAttributes.length > 0 && (
              <section className="space-y-4">
                <h3 className="text-xs font-bold text-emerald-500 uppercase tracking-widest border-b border-emerald-50 dark:border-emerald-500/10 pb-2">Project Attributes</h3>
                <div className="grid grid-cols-2 gap-6">
                  {project.lineItemAttributes.map(attr => (
                    <div key={attr.id} className="space-y-2">
                      <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{attr.title}</label>
                      <select 
                        value={bulkUpdateData.projectAttributes?.[attr.id] || ''}
                        onChange={e => setBulkUpdateData({ 
                          ...bulkUpdateData, 
                          projectAttributes: { 
                            ...(bulkUpdateData.projectAttributes || {}), 
                            [attr.id]: e.target.value 
                          } 
                        })}
                        className="w-full px-4 py-2.5 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      >
                        <option value="">No Change</option>
                        {attr.values.map(val => (
                          <option key={val.id} value={val.id}>{val.id} - {val.description}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          <DialogFooter className="border-t border-slate-100 dark:border-white/5 p-6 bg-slate-50/50 dark:bg-white/[0.02] mt-0">
            <Button variant="ghost" onClick={() => setIsBulkUpdateOpen(false)} className="rounded-xl font-bold">Cancel</Button>
            <Button 
              onClick={handleBulkUpdate}
              className="bg-black dark:bg-white text-white dark:text-black rounded-xl font-bold shadow-lg shadow-black/10 hover:opacity-90"
            >
              Update {selectedIds.length} Rows
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Import Wizard Modal */}
      <Dialog 
        open={importWizard.isOpen} 
        onOpenChange={(open) => !importWizard.phase.includes('processing') && setImportWizard(prev => ({ ...prev, isOpen: open }))}
      >
        <DialogContent className="max-w-[95vw] w-full max-h-[95vh] flex flex-col p-0 overflow-hidden rounded-[2rem] border-none shadow-2xl ring-1 ring-black/5 dark:ring-white/5 bg-white dark:bg-[#1a1a1a]">
          <DialogHeader className="p-8 pb-4 bg-gray-50 dark:bg-white/5 border-b border-gray-100 dark:border-white/10 shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-2xl font-bold tracking-tight">
                  {importWizard.phase === 'preview' ? 'Subcontract Import Preview' : 'Processing Items'}
                </DialogTitle>
                <DialogDescription className="mt-1">
                  {importWizard.phase === 'preview' 
                    ? `Reviewing ${importWizard.data.length} line items from Excel.` 
                    : `Please wait while we process ${importWizard.total} records.`}
                </DialogDescription>
              </div>
              <Badge variant={importWizard.errors.some(e => e.type === 'error') ? 'destructive' : 'secondary'} className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest text-[10px]">
                {importWizard.errors.filter(e => e.type === 'error').length} Errors
              </Badge>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-hidden flex flex-col">
            {importWizard.phase === 'preview' ? (
              <div className="flex-1 overflow-hidden flex flex-col">
                {importWizard.errors.length > 0 && (
                  <div className="p-4 bg-red-50/50 dark:bg-red-500/5 border-b border-red-100 dark:border-red-500/10 shrink-0">
                    <div className="flex items-center gap-2 mb-2 text-red-600 font-bold text-[10px] uppercase tracking-wider">
                      <AlertCircle className="w-3.5 h-3.5" />
                      Critical Validation Errors
                    </div>
                    <ScrollArea className="h-20">
                      <ul className="space-y-1">
                        {importWizard.errors.map((err, i) => (
                          <li key={i} className="text-[10px] text-red-700 dark:text-red-400 flex gap-2">
                            <span className="font-mono font-bold shrink-0">Row {err.row}:</span>
                            <span>{err.msg}</span>
                          </li>
                        ))}
                      </ul>
                    </ScrollArea>
                  </div>
                )}

                <div className="flex-1 overflow-auto p-4">
                  <table className="w-full text-left text-[11px] border-collapse">
                    <thead className="sticky top-0 bg-white dark:bg-[#1a1a1a] shadow-sm z-10 transition-colors">
                      <tr className="border-b border-gray-100 dark:border-white/10 uppercase tracking-widest text-gray-500">
                        <th className="py-2.5 px-4 font-bold">#</th>
                        <th className="py-2.5 px-4 font-bold">Order ID</th>
                        <th className="py-2.5 px-4 font-bold">Cost Code</th>
                        <th className="py-2.5 px-4 font-bold">Description</th>
                        <th className="py-2.5 px-4 font-bold text-right">Qty</th>
                        <th className="py-2.5 px-4 font-bold text-right">Rate</th>
                        <th className="py-2.5 px-4 font-bold text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                      {importWizard.data.slice(0, 100).map((row, i) => (
                        <tr key={i} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                          <td className="py-2.5 px-4 font-mono text-gray-400">{i + 1}</td>
                          <td className="py-2.5 px-4 font-bold text-blue-600 underline font-mono">{row['Order ID']}</td>
                          <td className="py-2.5 px-4 font-mono">{row['Cost Code ID']}</td>
                          <td className="py-2.5 px-4 max-w-md truncate">{row['Description']}</td>
                          <td className="py-2.5 px-4 text-right">{row['Qty']}</td>
                          <td className="py-2.5 px-4 text-right font-mono">{formatCurrency(row['Rate'])}</td>
                          <td className="py-2.5 px-4 text-right font-bold font-mono text-emerald-600">
                            {formatCurrency((Number(row['Qty']) || 0) * (Number(row['Rate']) || 0))}
                          </td>
                        </tr>
                      ))}
                      {importWizard.data.length > 100 && (
                        <tr>
                          <td colSpan={7} className="py-4 text-center text-gray-400 italic text-[10px]">
                            Showing first 100 of {importWizard.data.length} rows...
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-24 bg-white dark:bg-[#141414] relative">
                <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
                  <div className="absolute -top-24 -left-24 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
                  <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl animate-pulse transition-all duration-1000 delay-500" />
                </div>

                <div className="relative z-10 w-full max-w-lg space-y-12">
                  <div className="text-center space-y-4">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-[2.5rem] bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 mb-2 relative group">
                      <div className="absolute inset-0 rounded-[2.5rem] bg-blue-500/20 animate-ping group-hover:hidden" />
                      <RefreshCw className="w-8 h-8 animate-spin-slow transition-transform" />
                    </div>
                    <h3 className="text-3xl font-black tracking-tighter text-slate-900 dark:text-white">
                      {importWizard.progress === 100 ? 'Finalizing Import' : 'Processing Data'}
                    </h3>
                    <p className="text-slate-500 dark:text-slate-400 font-medium">
                      Bringing {importWizard.total} line items into your project. Please stay on this screen.
                    </p>
                  </div>

                  <div className="space-y-6">
                    <div className="relative pt-1">
                      <div className="flex mb-3 items-center justify-between">
                        <div>
                          <span className="text-[10px] font-black uppercase tracking-[0.2em] px-2.5 py-1 rounded-full bg-blue-600 text-white dark:bg-blue-500">
                            {importWizard.progress}%
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">
                            {importWizard.processed} / {importWizard.total} Items
                          </span>
                        </div>
                      </div>
                      <div className="overflow-hidden h-3 mb-4 text-xs flex rounded-full bg-slate-100 dark:bg-white/5 p-0.5 ring-1 ring-slate-200/50 dark:ring-white/5">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${importWizard.progress}%` }}
                          className="shadow-lg shadow-blue-500/20 flex flex-col text-center whitespace-nowrap text-white justify-center bg-blue-600 dark:bg-blue-500 rounded-full transition-all duration-500 ease-out relative"
                        >
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
                        </motion.div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-100 dark:border-white/5">
                      <div className="text-center">
                        <div className="text-lg font-black text-slate-900 dark:text-white">{(importWizard.processed / (importWizard.total || 1) * 100).toFixed(0)}%</div>
                        <div className="text-[8px] font-black uppercase tracking-[0.15em] text-slate-400">Validated</div>
                      </div>
                      <div className="text-center border-x border-slate-100 dark:border-white/5 px-4 text-emerald-500">
                        <div className="text-lg font-black">{importWizard.processed}</div>
                        <div className="text-[8px] font-black uppercase tracking-[0.15em] text-slate-400">Imported</div>
                      </div>
                      <div className="text-center text-blue-500">
                        <div className="text-lg font-black">{importWizard.total - importWizard.processed}</div>
                        <div className="text-[8px] font-black uppercase tracking-[0.15em] text-slate-400">Remaining</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="p-8 bg-gray-50 dark:bg-white/5 border-t border-gray-100 dark:border-white/10 shrink-0 gap-3">
            <Button 
              variant="ghost" 
              onClick={() => setImportWizard(prev => ({ ...prev, isOpen: false }))}
              disabled={importWizard.phase === 'processing'}
              className="rounded-xl px-6 font-bold text-xs"
            >
              Cancel
            </Button>
            {importWizard.phase === 'preview' && (
              <Button 
                onClick={executeImport}
                disabled={importWizard.errors.some(e => e.type === 'error')}
                className="bg-black dark:bg-white text-white dark:text-black rounded-xl px-10 font-bold flex items-center gap-2 hover:opacity-90 shadow-xl shadow-black/20 text-xs"
              >
                <Upload className="w-4 h-4" />
                Commit Line-Items
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BulkSubcontractLineItems;
