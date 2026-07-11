import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSubcontractRepo, useCostRepo } from '../platform/firestore/hooks';
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
  AlertTriangle,
  X,
  PlusCircle,
  Database,
  Calculator,
  Maximize2,
  Minimize2,
  BarChart3
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { Enterprise, Project, Subcontract, SubcontractLineItem, Vendor, Invoice, CostCode } from '../types';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { cn, formatCurrency, formatDate, dateToISO, calculatePhasing } from '@/lib/utils';
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
import { AgGridReact } from 'ag-grid-react';
import { createPortal } from 'react-dom';
import { 
  ColDef, 
  GridReadyEvent, 
  GridApi,
  ICellRendererParams,
  ValueFormatterParams,
  CellValueChangedEvent
} from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';
import 'ag-grid-enterprise';
import {
  buildSubcontractColumnDefs,
} from './subcontracts/columns';
import { ActionsCellRenderer } from './subcontracts/SubcontractsCellRenderers';
import { LineItemsPanel } from './subcontracts/panels/LineItemsPanel';
import { InvoicesPanel } from './subcontracts/panels/InvoicesPanel';
import { SubcontractFormDialog } from './subcontracts/panels/SubcontractFormDialog';

interface SubcontractManagementProps {
  enterprise: Enterprise;
  project: Project;
  user: any;
  theme?: 'light' | 'dark';
}

export default function SubcontractManagement({ enterprise, project, user, theme = 'light' }: SubcontractManagementProps) {
  const subcontractRepo = useSubcontractRepo();
  const costRepo = useCostRepo();
  const [subcontracts, setSubcontracts] = useState<Subcontract[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [costCodes, setCostCodes] = useState<CostCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubcontractId, setSelectedSubcontractId] = useState<string | null>(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [isMainTableCollapsed, setIsMainTableCollapsed] = useState(false);
  const [isBottomPanelCollapsed, setIsBottomPanelCollapsed] = useState(false);
  const [isInvoicesCollapsed, setIsInvoicesCollapsed] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [quickFilterText, setQuickFilterText] = useState('');
  const [bottomPanelTab, setBottomPanelTab] = useState<'lineItems' | 'invoices'>('lineItems');
  
  const projectPeriodDates = useMemo(() => {
    const periods = project.reportingPeriods?.periods || [];
    if (periods.length === 0) return { start: '', end: '' };
    return {
      start: periods[0].startDate || '',
      end: periods[periods.length - 1].endDate || ''
    };
  }, [project.reportingPeriods]);

  const [isAddingSubcontract, setIsAddingSubcontract] = useState(false);
  const [editingSubcontractId, setEditingSubcontractId] = useState<string | null>(null);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [bulkUpdateData, setBulkUpdateData] = useState<Partial<Subcontract>>({});
  const [subcontractFormData, setSubcontractFormData] = useState<Partial<Subcontract>>({
    orderId: '',
    orderName: '',
    orderScope: '',
    status: 'Active',
    defaultCostCodeId: '',
    defaultPhasingSource: 'Auto',
    defaultStartDate: projectPeriodDates.start,
    defaultEndDate: projectPeriodDates.end,
    defaultDistribution: 'Even',
    paymentType: 'LumpSum',
    awardDate: new Date().toISOString().split('T')[0],
    vendorId: '',
    vendorName: ''
  });
  const [isAddingLineItem, setIsAddingLineItem] = useState(false);
  const [lineItemFormData, setLineItemFormData] = useState<Partial<SubcontractLineItem>>({
    itemNo: '',
    description: '',
    costCodeId: '',
    date: new Date().toISOString().split('T')[0],
    qty: 0,
    unit: '',
    rate: 0,
    type: 'Original',
    status: 'Approved',
    enterpriseAttributes: {},
    projectAttributes: {},
    userDefined: {}
  });

  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'single' | 'bulk'; id?: string; name?: string; count?: number } | null>(null);
  const [importPreview, setImportPreview] = useState<{ type: 'subcontracts' | 'lineItems', data: any[] } | null>(null);

  const gridRef = useRef<AgGridReact>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (projectPeriodDates.start || projectPeriodDates.end) {
      setSubcontractFormData(prev => ({
        ...prev,
        defaultStartDate: prev.defaultStartDate || projectPeriodDates.start,
        defaultEndDate: prev.defaultEndDate || projectPeriodDates.end
      }));
    }
  }, [projectPeriodDates]);

  useEffect(() => {
    if (!project.id) return;
    const unsubSub = subcontractRepo.subscribeSubcontracts(project.id, (data) => { setSubcontracts(data); setLoading(false); });
    const unsubInv = subcontractRepo.subscribeInvoices(project.id, setInvoices);
    const unsubCost = costRepo.subscribeCostCodes(project.id, setCostCodes);
    return () => { unsubSub(); unsubInv(); unsubCost(); };
  }, [project.id]);

  // Clear selected invoice when subcontract changes
  useEffect(() => {
    setSelectedInvoiceId(null);
  }, [selectedSubcontractId]);

  const selectedSubcontract = useMemo(() => 
    subcontracts.find(s => s.id === selectedSubcontractId), 
    [subcontracts, selectedSubcontractId]
  );

  const getSubcontractCalculations = (subcontract: Subcontract | undefined) => {
    if (!subcontract) return {
      originalAmount: 0,
      approvedChanges: 0,
      pendingChanges: 0,
      totalAmount: 0,
      claimedAmountToDate: 0,
      certifiedAmountToDate: 0,
      varianceAmount: 0
    };
    const lineItems = subcontract.lineItems || [];
    const subInvoices = invoices.filter(i => i.subcontractId === subcontract.id);
    
    const originalAmount = lineItems
      .filter(li => li.type === 'Original')
      .reduce((sum, li) => sum + (li.total || 0), 0);
      
    const approvedChanges = lineItems
      .filter(li => li.type === 'ChangeOrder' && li.status === 'Approved')
      .reduce((sum, li) => sum + (li.total || 0), 0);
      
    const pendingChanges = lineItems
      .filter(li => li.type === 'ChangeOrder' && li.status === 'Pending')
      .reduce((sum, li) => sum + (li.total || 0), 0);

    const forecastChanges = lineItems
      .filter(li => li.type === 'ChangeOrder' && li.status === 'Forecast')
      .reduce((sum, li) => sum + (li.total || 0), 0);
      
    const totalAmount = lineItems
      .filter(li => li.status !== 'Rejected')
      .reduce((sum, li) => sum + (li.total || 0), 0);
    
    // Sort invoices by ID numerically descending to find the latest
    // Cumulative values should be taken from the latest invoice
    const sortedInvoices = [...subInvoices].sort((a, b) => {
      const aNo = parseInt(a.invoiceId?.replace(/\D/g, '') || '0');
      const bNo = parseInt(b.invoiceId?.replace(/\D/g, '') || '0');
      return bNo - aNo;
    });

    const lastInvoice = sortedInvoices[0];
    const claimedAmountToDate = lastInvoice?.totalAmount || 0;
    const certifiedAmountToDate = lastInvoice?.certifiedAmount || 0;
    const claimedLastInvoice = claimedAmountToDate;
    const certifiedLastInvoice = certifiedAmountToDate;

    const varianceAmount = certifiedAmountToDate - claimedAmountToDate;
      
    return {
      originalAmount,
      approvedChanges,
      pendingChanges,
      forecastChanges,
      totalAmount,
      claimedAmountToDate,
      claimedLastInvoice,
      certifiedAmountToDate,
      certifiedLastInvoice,
      varianceAmount
    };
  };

  const onCellValueChanged = async (event: CellValueChangedEvent) => {
    const { data, colDef, newValue, oldValue } = event;
    if (newValue === oldValue) return;
    if (!colDef.field) return;

    // Uniqueness check for orderId
    if (colDef.field === 'orderId') {
      const isDuplicate = subcontracts.some(s => s.id !== data.id && s.orderId.toLowerCase() === String(newValue).toLowerCase());
      if (isDuplicate) {
        toast.error(`Order ID "${newValue}" already exists.`);
        event.node.setDataValue(colDef.field, oldValue);
        return;
      }
    }

    const updateData: any = {
      [colDef.field]: (newValue instanceof Date) ? dateToISO(newValue) : newValue,
      updatedAt: new Date().toISOString()
    };

    if (colDef.field === 'vendorName') {
      const vendor = enterprise.vendors?.find(v => v.name === newValue);
      if (vendor) {
        updateData.vendorId = vendor.id;
      }
    }

    try {
      await subcontractRepo.updateSubcontract(data.id, updateData);
      toast.success('Updated successfully.');
    } catch (error) {
      console.error('Error updating subcontract:', error);
      toast.error('Failed to update.');
    }
  };

  const sideBar = useMemo(() => {
    return {
      toolPanels: [
        {
          id: 'columns',
          labelDefault: 'Columns',
          labelKey: 'columns',
          iconKey: 'columns',
          toolPanel: 'agColumnsToolPanel',
          toolPanelParams: {
            suppressRowGroups: false,
            suppressValues: false,
            suppressPivots: false,
            suppressPivotMode: false,
            suppressColumnFilter: false,
            suppressColumnSelectAll: false,
            suppressColumnExpandAll: false,
          },
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
  }, []);

  const defaultColDef = useMemo(() => ({
    resizable: true,
    sortable: true,
    filter: true,
    minWidth: 100,
    floatingFilter: false,
  }), []);

  const subcontractColumnDefs = useMemo<any[]>(() => buildSubcontractColumnDefs({
    costCodes,
    enterprise,
    project,
    getSubcontractCalculations,
    setSelectedSubcontractId,
    setBottomPanelTab,
    setIsMainTableCollapsed,
    setIsBottomPanelCollapsed,
  }), [invoices, selectedSubcontractId, enterprise.subcontractAttributes, project.subcontractAttributes, enterprise.vendors, costCodes, enterprise]);

  const subcontractPinnedTopRowData = useMemo(() => {
    if (subcontracts.length === 0) return [];
    
    const dataToSum = selectedSubcontractId 
      ? subcontracts.filter(s => s.id === selectedSubcontractId)
      : subcontracts;

    const totals = dataToSum.reduce((acc, s) => {
      const calcs = getSubcontractCalculations(s);
      acc.originalAmount += calcs.originalAmount;
      acc.approvedChanges += calcs.approvedChanges;
      acc.pendingChanges += calcs.pendingChanges;
      acc.forecastChanges += calcs.forecastChanges;
      acc.totalAmount += calcs.totalAmount;
      acc.claimedAmountToDate += calcs.claimedAmountToDate;
      acc.certifiedAmountToDate += calcs.certifiedAmountToDate;
      acc.varianceAmount += calcs.varianceAmount;
      return acc;
    }, {
      originalAmount: 0,
      approvedChanges: 0,
      pendingChanges: 0,
      forecastChanges: 0,
      totalAmount: 0,
      claimedAmountToDate: 0,
      certifiedAmountToDate: 0,
      varianceAmount: 0
    });

    return [{
      orderId: 'SubTotal',
      ...totals,
      isPinned: true
    }];
  }, [subcontracts, invoices, selectedSubcontractId]);

  const handleAddSubcontract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project.id || !enterprise.id) return;

    if (editingSubcontractId) {
      // Update existing
      try {
        await subcontractRepo.updateSubcontract(editingSubcontractId, { ...subcontractFormData });
        setIsAddingSubcontract(false);
        setEditingSubcontractId(null);
        setSubcontractFormData({
          orderId: '',
          orderName: '',
          orderScope: '',
          status: 'Active',
          defaultCostCodeId: '',
          defaultPhasingSource: 'Auto',
          defaultStartDate: projectPeriodDates.start,
          defaultEndDate: projectPeriodDates.end,
          defaultDistribution: 'Even',
          paymentType: 'LumpSum',
          awardDate: new Date().toISOString().split('T')[0],
          vendorId: '',
          vendorName: ''
        });
        toast.success('Subcontract updated successfully.');
      } catch (error) {
        console.error('Error updating subcontract:', error);
        toast.error('Failed to update subcontract.');
      }
      return;
    }

    const isDuplicate = subcontracts.some(s => s.orderId.toLowerCase() === subcontractFormData.orderId?.toLowerCase());
    if (isDuplicate) {
      toast.error('Order ID must be unique within the project.');
      return;
    }

    try {
      const newSubcontract = {
        ...subcontractFormData,
        enterpriseId: enterprise.id,
        projectId: project.id,
        totalAmount: 0,
        lineItems: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: user.uid
      };

      await subcontractRepo.createSubcontract(newSubcontract as any);
      setIsAddingSubcontract(false);
      setSubcontractFormData({
        orderId: '',
        orderName: '',
        orderScope: '',
        status: 'Active',
        defaultCostCodeId: '',
        defaultPhasingSource: 'Auto',
        defaultStartDate: projectPeriodDates.start,
        defaultEndDate: projectPeriodDates.end,
        defaultDistribution: 'Even',
        paymentType: 'LumpSum',
        awardDate: new Date().toISOString().split('T')[0],
        vendorId: '',
        vendorName: ''
      });
      toast.success('Subcontract added successfully.');
    } catch (error) {
      console.error('Error adding subcontract:', error);
      toast.error('Failed to add subcontract.');
    }
  };

  const handleBulkUpdate = async () => {
    if (selectedIds.size === 0) return;
    try {
      const bulkUpdates: Array<{ id: string; data: any }> = [];
      selectedIds.forEach(id => {
        const updateObj: any = {};
        if (bulkUpdateData.status) updateObj.status = bulkUpdateData.status;
        if (bulkUpdateData.paymentType) updateObj.paymentType = bulkUpdateData.paymentType;
        if (bulkUpdateData.awardDate) updateObj.awardDate = bulkUpdateData.awardDate;
        if (bulkUpdateData.vendorId) { updateObj.vendorId = bulkUpdateData.vendorId; updateObj.vendorName = bulkUpdateData.vendorName; }
        bulkUpdates.push({ id, data: updateObj });
      });
      await subcontractRepo.updateManySubcontracts(bulkUpdates);
      toast.success(`Updated ${selectedIds.size} subcontracts successfully.`);
      setIsBulkUpdating(false);
      setSelectedIds(new Set());
      setBulkUpdateData({});
    } catch (error) {
      console.error('Error bulk updating:', error);
      toast.error('Failed to bulk update subcontracts.');
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];
        
        if (data.length === 0) {
          toast.error("The file is empty.");
          return;
        }

        setImportPreview({ type: 'subcontracts', data });
      } catch (error) {
        console.error('Error reading import file:', error);
        toast.error('Failed to read the import file.');
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsBinaryString(file);
  };

  const completeImport = async () => {
    if (!importPreview) return;
    const { type, data } = importPreview;
    
    if (type === 'subcontracts') {
      try {
        const importUpdates: Array<{ id: string; data: any }> = [];
        const importCreates: any[] = [];
        data.forEach(row => {
          const orderId = row['Order ID'] || row.orderId || row.ID || row.id;
          const orderName = row['Order Name'] || row.orderName || row.Name || row.name || '';
          const vendorName = row['Vendor'] || row.vendorName || '';
          const status = row['Status'] || row.status || 'Active';
          const paymentType = row['Payment Type'] || row.paymentType || 'LumpSum';
          const awardDate = row['Award Date'] || row.awardDate || new Date().toISOString().split('T')[0];

          if (orderId) {
            const existing = subcontracts.find(s => s.orderId.toLowerCase() === String(orderId).toLowerCase());
            const subcontractData = {
              orderId: String(orderId),
              orderName: String(orderName),
              vendorName: String(vendorName),
              status: String(status) as any,
              paymentType: String(paymentType) as any,
              awardDate: String(awardDate),
              projectId: project.id,
              enterpriseId: enterprise.id,
              updatedAt: new Date().toISOString()
            };
            
            if (existing) {
              importUpdates.push({ id: existing.id, data: subcontractData });
            } else {
              importCreates.push({ ...subcontractData, vendorId: '', totalAmount: 0, lineItems: [], createdBy: (user as any).uid });
            }
          }
        });
        await Promise.all([
          ...importUpdates.map(u => subcontractRepo.updateSubcontract(u.id, u.data)),
          ...importCreates.map(c => subcontractRepo.createSubcontract(c as any)),
        ]);
        toast.success('Import successful.');
      } catch (error) {
        console.error('Error committing import:', error);
        toast.error('Failed to commit import.');
      }
    }
    setImportPreview(null);
  };

  const handleExport = () => {
    if (gridRef.current?.api) {
      gridRef.current.api.exportDataAsExcel({
        fileName: `${project.projectCode}_Subcontracts_${new Date().toISOString().split('T')[0]}.xlsx`
      });
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    try {
      await Promise.all([...selectedIds].map(id => subcontractRepo.deleteSubcontract(id)));
      setSelectedIds(new Set());
      setDeleteConfirm(null);
      toast.success(`Deleted ${selectedIds.size} subcontracts.`);
    } catch (error) {
      console.error('Error bulk deleting:', error);
      toast.error('Failed to delete subcontracts.');
    }
  };

  const handleDeleteSubcontract = async (id: string) => {
    try {
      await subcontractRepo.deleteSubcontract(id);
      if (selectedSubcontractId === id) setSelectedSubcontractId(null);
      setDeleteConfirm(null);
      toast.success('Subcontract deleted.');
    } catch (error) {
      console.error('Error deleting subcontract:', error);
      toast.error('Failed to delete subcontract.');
    }
  };

  const { duplicateIds, hasImportDuplicates } = useMemo(() => {
    if (!importPreview) return { duplicateIds: [], hasImportDuplicates: false };
    
    const idsInFile = new Set<string>();
    const fileDuplicates = new Set<string>();
    
    importPreview.data.forEach(row => {
      const id = row['Order ID'] || row.orderId || row.ID || row.id;
      if (id) {
        const normalizedId = id.toString().trim().toLowerCase();
        if (idsInFile.has(normalizedId)) {
          fileDuplicates.add(id.toString().trim());
        }
        idsInFile.add(normalizedId);
      }
    });

    const duplicateList = Array.from(fileDuplicates);
    return { 
      duplicateIds: duplicateList, 
      hasImportDuplicates: duplicateList.length > 0 
    };
  }, [importPreview]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-[#141414] border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden">
      {/* Toolbar */}
      <div className="p-6 border-b border-gray-100 dark:border-white/10 flex justify-between items-center bg-gray-50/50 dark:bg-white/5 shrink-0">
        <div className="flex items-center gap-6">
          <div>
            <h3 className="text-xl font-bold dark:text-white">Sub-Contract Management</h3>
            <p className="text-sm text-gray-900 dark:text-gray-400">Manage project subcontracts, vendors, and line items.</p>
          </div>
          
          {project.reportingPeriods?.currentPeriodId && (
            <div className="flex flex-col border-l border-gray-200 dark:border-white/10 pl-6">
              <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-1">Current Period</span>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-semibold dark:text-white">
                  {project.reportingPeriods.periods.find(p => p.id === project.reportingPeriods?.currentPeriodId)?.name || 'Period'}
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  ({project.reportingPeriods.periods.find(p => p.id === project.reportingPeriods?.currentPeriodId) ? 
                    `${formatDate(project.reportingPeriods.periods.find(p => p.id === project.reportingPeriods?.currentPeriodId)!.startDate)} - ${formatDate(project.reportingPeriods.periods.find(p => p.id === project.reportingPeriods?.currentPeriodId)!.endDate)}` 
                  : ''})
                </span>
              </div>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text"
              placeholder="Search subcontracts..."
              value={quickFilterText}
              onChange={(e) => {
                setQuickFilterText(e.target.value);
                gridRef.current?.api.setGridOption('quickFilterText', e.target.value);
              }}
              className="pl-10 pr-4 py-2 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none w-64 dark:text-white"
            />
          </div>
          
          <div className="w-px h-6 bg-gray-200 dark:bg-white/10 mx-1" />

          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleImport} 
            className="hidden" 
            accept=".xlsx,.xls" 
          />
          <button 
            onClick={() => fileInputRef.current?.click()} 
            className="p-2 text-gray-400 hover:text-black dark:hover:text-white transition-colors" 
            title="Import"
          >
            <Upload className="w-5 h-5" />
          </button>
          <button 
            onClick={handleExport} 
            className="p-2 text-gray-400 hover:text-black dark:hover:text-white transition-colors" 
            title="Export"
          >
            <Download className="w-5 h-5" />
          </button>

          {selectedIds.size > 0 && (
            <div className="flex gap-2">
              <Button 
                variant="outline"
                onClick={() => setIsBulkUpdating(true)}
                className="px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border-blue-200 text-blue-600 hover:bg-blue-50"
              >
                <Edit2 className="w-3.5 h-3.5" />
                Bulk Update ({selectedIds.size})
              </Button>
              <Button 
                variant="destructive" 
                onClick={() => setDeleteConfirm({ type: 'bulk', count: selectedIds.size })}
                className="px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete ({selectedIds.size})
              </Button>
            </div>
          )}

          <Button 
            onClick={() => setIsAddingSubcontract(true)}
            className="px-4 py-2 bg-black dark:bg-white text-white dark:text-black rounded-xl text-sm font-bold flex items-center gap-2 hover:opacity-90 transition-all shadow-lg shadow-black/10"
          >
            <Plus className="w-4 h-4" />
            + Add
          </Button>
        </div>
      </div>

      {/* Main Content - Top/Bottom Split */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Table: Subcontracts */}
        <div className={cn(
          "flex flex-col transition-all duration-500 ease-in-out overflow-hidden",
          selectedSubcontractId 
            ? (isMainTableCollapsed ? "h-[60px]" : "h-[40%]") 
            : "flex-1"
        )}>
          <div className="flex items-center justify-between px-4 py-2 bg-gray-100 dark:bg-white/5 border-b border-gray-200 dark:border-white/10">
            <div className="flex items-center gap-2">
              <Hash className="w-4 h-4 text-gray-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Subcontracts</span>
            </div>
            {selectedSubcontractId && (
              <button 
                onClick={() => setIsMainTableCollapsed(!isMainTableCollapsed)}
                className="p-1 hover:bg-gray-200 dark:hover:bg-white/10 rounded-md transition-colors text-gray-500"
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
                theme="legacy"
                ref={gridRef}
                rowData={selectedSubcontractId ? subcontracts.filter(s => s.id === selectedSubcontractId) : subcontracts}
                columnDefs={subcontractColumnDefs}
                pinnedTopRowData={subcontractPinnedTopRowData}
                getRowClass={(params) => {
                  if (params.node.rowPinned) return 'pinned-row-highlight';
                  return '';
                }}
                onSelectionChanged={(params) => {
                  const selectedNodes = params.api.getSelectedNodes();
                  setSelectedIds(new Set(selectedNodes.map(node => node.data?.id).filter(id => !!id)));
                }}
                onCellValueChanged={onCellValueChanged}
                components={{
                  actionsRenderer: ActionsCellRenderer
                }}
                context={{
                  setSelectedSubcontractId,
                  setDeleteConfirm,
                  setSubcontractFormData,
                  setIsAddingSubcontract,
                  setEditingSubcontractId,
                  setBottomPanelTab
                }}
                rowSelection="multiple"
                animateRows={true}
                pagination={true}
                paginationPageSize={20}
                suppressRowClickSelection={true}
                sideBar={sideBar}
                rowGroupPanelShow="always"
                pivotPanelShow="always"
                defaultColDef={defaultColDef}
                headerHeight={56}
                enableFillHandle={true}
                enableRangeSelection={true}
              />
            </div>
          </div>
        </div>

        {/* Bottom Table: Line Items / Invoices */}
        <AnimatePresence>
          {selectedSubcontractId && selectedSubcontract && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ 
                height: isBottomPanelCollapsed 
                  ? '60px' 
                  : (isMainTableCollapsed ? 'calc(100% - 60px)' : '60%'), 
                opacity: 1 
              }}
              exit={{ height: 0, opacity: 0 }}
              className="border-t border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#0a0a0a] flex flex-col overflow-hidden"
            >
              <div className="p-4 flex items-center justify-between bg-white dark:bg-[#141414] border-b border-gray-200 dark:border-white/10">
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <div className="flex bg-gray-100 dark:bg-white/5 p-1 rounded-xl">
                      <button
                        onClick={() => setBottomPanelTab('lineItems')}
                        className={cn(
                          "px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2",
                          bottomPanelTab === 'lineItems' 
                            ? "bg-white dark:bg-white/10 text-blue-600 shadow-sm" 
                            : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                        )}
                      >
                        <Briefcase className="w-3.5 h-3.5" />
                        Line Items
                      </button>
                      <button
                        onClick={() => setBottomPanelTab('invoices')}
                        className={cn(
                          "px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2",
                          bottomPanelTab === 'invoices' 
                            ? "bg-white dark:bg-white/10 text-green-600 shadow-sm" 
                            : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                        )}
                      >
                        <Receipt className="w-3.5 h-3.5" />
                        Invoices
                      </button>
                    </div>
                  </div>
                  
                  <div className="h-4 w-px bg-gray-200 dark:bg-white/10" />
                  
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold dark:text-white">
                      {bottomPanelTab === 'lineItems' ? 'Line Items' : 'Invoices'}: 
                      <span className={bottomPanelTab === 'lineItems' ? "text-blue-600" : "text-green-600"}>
                        {selectedSubcontract.orderId}
                      </span>
                    </h3>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setIsBottomPanelCollapsed(!isBottomPanelCollapsed)}
                    className="p-2 text-gray-400 hover:text-black dark:hover:text-white transition-colors"
                    title={isBottomPanelCollapsed ? "Expand Panel" : "Collapse Panel"}
                  >
                    {isBottomPanelCollapsed ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              {bottomPanelTab === 'lineItems' && (
                <LineItemsPanel
                  selectedSubcontractId={selectedSubcontractId}
                  selectedSubcontract={selectedSubcontract}
                  invoices={invoices}
                  costCodes={costCodes}
                  enterprise={enterprise}
                  project={project}
                  theme={theme}
                  subcontractRepo={subcontractRepo}
                  isBottomPanelCollapsed={isBottomPanelCollapsed}
                  onClose={() => setSelectedSubcontractId(null)}
                />
              )}
              {bottomPanelTab === 'invoices' && (
                <InvoicesPanel
                  selectedSubcontractId={selectedSubcontractId}
                  selectedSubcontract={selectedSubcontract}
                  selectedInvoiceId={selectedInvoiceId}
                  setSelectedInvoiceId={setSelectedInvoiceId}
                  isInvoicesCollapsed={isInvoicesCollapsed}
                  setIsInvoicesCollapsed={setIsInvoicesCollapsed}
                  invoices={invoices}
                  costCodes={costCodes}
                  enterprise={enterprise}
                  project={project}
                  theme={theme}
                  quickFilterText={quickFilterText}
                  subcontractRepo={subcontractRepo}
                  user={user}
                  onClose={() => setSelectedSubcontractId(null)}
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {importPreview && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[110] p-4">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-white dark:bg-[#141414] rounded-3xl p-8 w-full max-w-4xl shadow-2xl border border-gray-200 dark:border-white/10 flex flex-col max-h-[90vh]"
              >
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h2 className="text-2xl font-bold dark:text-white">Review Import</h2>
                    <p className="text-gray-900 dark:text-gray-400 text-sm mt-1">
                      Review the records found in your file. Existing Order IDs will be updated.
                    </p>
                  </div>
                  <button onClick={() => setImportPreview(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition-colors">
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>

                {hasImportDuplicates && (
                  <div className="mb-4 p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-2xl flex flex-col gap-2">
                    <div className="flex items-center gap-3 text-red-600 dark:text-red-400 text-[10px] font-black uppercase tracking-[0.15em]">
                      <AlertTriangle className="w-4 h-4" />
                      Duplicate ID found in file
                    </div>
                    <div className="text-sm text-red-600 dark:text-red-400 font-medium leading-relaxed">
                      The following IDs appear multiple times in your excel: <span className="font-bold underline">{duplicateIds.join(', ')}</span>. Please resolve duplicates before importing.
                    </div>
                  </div>
                )}

                <div className="flex-1 overflow-auto border border-gray-100 dark:border-white/10 rounded-2xl mb-6 shadow-inner bg-gray-50/50 dark:bg-black/20">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-white dark:bg-[#1a1a1a] sticky top-0 border-b border-gray-200 dark:border-white/10 shadow-sm z-10">
                      <tr>
                        {Object.keys(importPreview.data[0] || {}).map(key => (
                          <th key={key} className="px-4 py-3 font-bold text-gray-900 dark:text-white uppercase tracking-widest text-[10px] bg-white dark:bg-[#1a1a1a]">{key}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                      {importPreview.data.map((row, i) => (
                        <tr key={i} className="hover:bg-gray-100/50 dark:hover:bg-white/5 transition-colors">
                          {Object.values(row).map((val: any, j) => (
                            <td key={j} className="px-4 py-3 text-gray-900 dark:text-gray-300 font-medium whitespace-nowrap">{val?.toString()}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex gap-4">
                  <button 
                    onClick={() => setImportPreview(null)}
                    className="flex-1 py-4 border border-gray-200 dark:border-white/10 rounded-2xl text-sm font-bold uppercase tracking-widest hover:bg-gray-50 dark:hover:bg-white/5 transition-colors dark:text-white"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={completeImport}
                    disabled={hasImportDuplicates}
                    className="flex-1 py-4 bg-black dark:bg-white text-white dark:text-black rounded-2xl text-sm font-bold uppercase tracking-widest hover:bg-black/90 dark:hover:bg-white/90 transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    Complete Import ({importPreview.data.length} records)
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
      {/* Add Subcontract Modal */}
      {isAddingSubcontract && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl w-full max-w-2xl p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold dark:text-white">{editingSubcontractId ? 'Edit Subcontract' : 'New Subcontract'}</h2>
              <button onClick={() => { setIsAddingSubcontract(false); setEditingSubcontractId(null); }} className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full">
                <Plus className="w-5 h-5 rotate-45 text-gray-400" />
              </button>
            </div>
            <form onSubmit={handleAddSubcontract} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Order ID</label>
                  <Input 
                    maxLength={50}
                    value={subcontractFormData.orderId}
                    onChange={e => setSubcontractFormData({ ...subcontractFormData, orderId: e.target.value })}
                    placeholder="e.g. SC-001"
                    required
                    disabled={!!editingSubcontractId}
                    className={cn(!!editingSubcontractId && "bg-gray-50 dark:bg-white/5 cursor-not-allowed")}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Order Name</label>
                  <Input 
                    value={subcontractFormData.orderName}
                    onChange={e => setSubcontractFormData({ ...subcontractFormData, orderName: e.target.value })}
                    placeholder="e.g. Concrete Works"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Order Scope</label>
                <textarea 
                  value={subcontractFormData.orderScope}
                  onChange={e => setSubcontractFormData({ ...subcontractFormData, orderScope: e.target.value })}
                  className="w-full p-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:text-white min-h-[100px]"
                  placeholder="Describe the scope of work..."
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Status</label>
                  <select 
                    value={subcontractFormData.status}
                    onChange={e => setSubcontractFormData({ ...subcontractFormData, status: e.target.value as any })}
                    className="w-full p-2 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
                  >
                    <option value="Active">Active</option>
                    <option value="Complete">Complete</option>
                    <option value="On Hold">On Hold</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Default Cost Code</label>
                  <select 
                    value={subcontractFormData.defaultCostCodeId || ''}
                    onChange={e => setSubcontractFormData({ ...subcontractFormData, defaultCostCodeId: e.target.value })}
                    className="w-full p-2 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
                  >
                    <option value="">None</option>
                    {[...costCodes].sort((a, b) => a.code.localeCompare(b.code)).map(c => (
                      <option key={c.id} value={c.id}>{c.code} - {c.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Payment Type</label>
                  <select 
                    value={subcontractFormData.paymentType}
                    onChange={e => setSubcontractFormData({ ...subcontractFormData, paymentType: e.target.value as any })}
                    className="w-full p-2 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
                  >
                    <option value="LumpSum">LumpSum</option>
                    <option value="Schedule of Rates">Schedule of Rates</option>
                    <option value="Re-measurable">Re-measurable</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Award Date</label>
                  <Input 
                    type="date"
                    value={subcontractFormData.awardDate}
                    onChange={e => setSubcontractFormData({ ...subcontractFormData, awardDate: e.target.value })}
                  />
                </div>
              </div>

              {/* Default Timephasing Section */}
              <div className="p-4 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/5 space-y-4">
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Default Timephasing</div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 tracking-wider">Phasing Source</label>
                    <select 
                      value={subcontractFormData.defaultPhasingSource}
                      onChange={e => setSubcontractFormData({ ...subcontractFormData, defaultPhasingSource: e.target.value as any })}
                      className="w-full p-2 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
                    >
                      <option value="Manual">Manual</option>
                      <option value="Auto">Auto</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 tracking-wider">Distribution</label>
                    <select 
                      value={subcontractFormData.defaultDistribution}
                      onChange={e => setSubcontractFormData({ ...subcontractFormData, defaultDistribution: e.target.value as any })}
                      className="w-full p-2 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
                    >
                      <option value="Even">Even</option>
                      <option value="Bell Curve">Bell Curve</option>
                      <option value="Front load">Front load</option>
                      <option value="Back load">Back load</option>
                      <option value="S-Curve">S-Curve</option>
                      <option value="Profile">Profile</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 tracking-wider">Start Date</label>
                    <Input 
                      type="date"
                      value={subcontractFormData.defaultStartDate || ''}
                      onChange={e => setSubcontractFormData({ ...subcontractFormData, defaultStartDate: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 tracking-wider">End Date</label>
                    <Input 
                      type="date"
                      value={subcontractFormData.defaultEndDate || ''}
                      onChange={e => setSubcontractFormData({ ...subcontractFormData, defaultEndDate: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Vendor</label>
                <select 
                  value={subcontractFormData.vendorId}
                  onChange={e => {
                    const vendor = (enterprise.vendors || []).find(v => v.id === e.target.value);
                    setSubcontractFormData({ 
                      ...subcontractFormData, 
                      vendorId: e.target.value,
                      vendorName: vendor?.name || ''
                    });
                  }}
                  className="w-full p-2 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
                >
                  <option value="">Select Vendor</option>
                  {(enterprise.vendors || []).map(v => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="ghost" onClick={() => { setIsAddingSubcontract(false); setEditingSubcontractId(null); }}>Cancel</Button>
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white">{editingSubcontractId ? 'Update Subcontract' : 'Create Subcontract'}</Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Add Line Item Modal */}
      {isBulkUpdating && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl w-full max-w-lg p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold dark:text-white">Bulk Update ({selectedIds.size} rows)</h2>
              <button onClick={() => setIsBulkUpdating(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full">
                <Plus className="w-5 h-5 rotate-45 text-gray-400" />
              </button>
            </div>
            
            <div className="space-y-4">
              <p className="text-sm text-gray-500 mb-4">Select the fields you want to update for all selected subcontracts. Fields left blank will not be changed.</p>
              
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Status</label>
                <select 
                  value={bulkUpdateData.status || ''}
                  onChange={e => setBulkUpdateData({ ...bulkUpdateData, status: e.target.value as any })}
                  className="w-full px-4 py-2 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:text-white"
                >
                  <option value="">No Change</option>
                  <option value="Active">Active</option>
                  <option value="Complete">Complete</option>
                  <option value="On Hold">On Hold</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Payment Type</label>
                <select 
                  value={bulkUpdateData.paymentType || ''}
                  onChange={e => setBulkUpdateData({ ...bulkUpdateData, paymentType: e.target.value as any })}
                  className="w-full px-4 py-2 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:text-white"
                >
                  <option value="">No Change</option>
                  <option value="LumpSum">LumpSum</option>
                  <option value="Schedule of Rates">Schedule of Rates</option>
                  <option value="Re-measurable">Re-measurable</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Award Date</label>
                <Input 
                  type="date"
                  value={bulkUpdateData.awardDate || ''}
                  onChange={e => setBulkUpdateData({ ...bulkUpdateData, awardDate: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Vendor</label>
                <select 
                  value={bulkUpdateData.vendorId || ''}
                  onChange={e => {
                    const vendor = enterprise.vendors?.find(v => v.id === e.target.value);
                    setBulkUpdateData({ 
                      ...bulkUpdateData, 
                      vendorId: e.target.value,
                      vendorName: vendor?.name || ''
                    });
                  }}
                  className="w-full px-4 py-2 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:text-white"
                >
                  <option value="">No Change</option>
                  {enterprise.vendors?.map(vendor => (
                    <option key={vendor.id} value={vendor.id}>{vendor.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-6">
                <Button variant="ghost" onClick={() => setIsBulkUpdating(false)}>Cancel</Button>
                <Button 
                  onClick={handleBulkUpdate}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  disabled={Object.keys(bulkUpdateData).length === 0}
                >
                  Update {selectedIds.size} Rows
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl w-full max-w-md p-6"
          >
            <div className="flex items-center gap-3 mb-4 text-red-600">
              <AlertCircle className="w-6 h-6" />
              <h2 className="text-xl font-bold">Confirm Delete</h2>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {deleteConfirm.type === 'single' 
                ? `Are you sure you want to delete subcontract "${deleteConfirm.name}"? This action cannot be undone.`
                : `Are you sure you want to delete ${deleteConfirm.count} selected subcontracts? This action cannot be undone.`
              }
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
              <Button 
                variant="destructive" 
                onClick={() => deleteConfirm.type === 'single' ? handleDeleteSubcontract(deleteConfirm.id!) : handleBulkDelete()}
              >
                Delete
              </Button>
            </div>
          </motion.div>
        </div>
      )}

    </div>
  );
}