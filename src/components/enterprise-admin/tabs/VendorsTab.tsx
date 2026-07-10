import React, { useState, useMemo, useRef } from 'react';
import { motion } from 'motion/react';
import { AgGridReact } from 'ag-grid-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useEnterpriseRepo } from '../../../platform/firestore/hooks';
import DataGridModule from '../../DataGridModule';
import { buildVendorColumnDefs } from '../columns';
import type { Enterprise } from '../../../types';

interface VendorsTabProps {
  enterprise: Enterprise;
  setDeleteConfirm: (confirm: {
    type:
      | 'user'
      | 'bulk-user'
      | 'project'
      | 'bulk-project'
      | 'bulk-attr-value'
      | 'rate'
      | 'bulk-rate'
      | 'costElement'
      | 'bulk-costElement'
      | 'vendor'
      | 'bulk-vendor';
    id?: string;
    name?: string;
    count?: number;
    onConfirm?: () => void;
  } | null) => void;
  setIsBulkUpdateModalOpen: (val: { type: 'rate' | 'project' | 'vendor'; count: number; selectedIds?: string[] } | null) => void;
  onImportPreview: (preview: { type: 'vendors'; data: any[] }) => void;
}

export default function VendorsTab({
  enterprise,
  setDeleteConfirm,
  setIsBulkUpdateModalOpen,
  onImportPreview,
}: VendorsTabProps) {
  const enterpriseRepo = useEnterpriseRepo();
  const vendorsGridRef = useRef<AgGridReact>(null);

  // Local UI state
  const [vendorSearch, setVendorSearch] = useState('');
  const [selectedVendorIds, setSelectedVendorIds] = useState<Set<string>>(new Set());
  const [isEditingVendor, setIsEditingVendor] = useState<{
    id: string | null;
    insertIndex?: number;
  } | null>(null);
  const [vendorFormData, setVendorFormData] = useState({
    id: '',
    name: '',
    code: '',
    contactEmail: '',
    contactName: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isDuplicateVendorCode = useMemo(() => {
    if (!vendorFormData.id) return false;
    const currentVendors = enterprise.vendors || [];
    const updatedVendorId = isEditingVendor?.id;
    return currentVendors.some(
      (v) =>
        v.id !== updatedVendorId && v.id.toLowerCase() === vendorFormData.id.toLowerCase()
    );
  }, [vendorFormData.id, enterprise.vendors, isEditingVendor?.id]);

  const vendorColumnDefs = useMemo(
    () =>
      buildVendorColumnDefs({
        setVendorFormData,
        setIsEditingVendor,
        setDeleteConfirm: (confirm) => {
          if (!confirm) { setDeleteConfirm(null); return; }
          setDeleteConfirm({
            ...confirm,
            onConfirm: confirm.type === 'vendor' && confirm.id
              ? () => deleteVendor(confirm.id!)
              : undefined,
          });
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enterprise.vendors]
  );

  const saveVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enterprise.id || !vendorFormData.name || !vendorFormData.id) return;

    if (vendorFormData.id.length > 50) {
      alert('Vendor ID cannot be more than 50 characters.');
      return;
    }

    if (isDuplicateVendorCode) {
      alert(`Vendor ID "${vendorFormData.id}" is already in use.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const currentVendors = enterprise.vendors || [];
      const updatedVendorId = isEditingVendor?.id;

      let newVendors;
      if (updatedVendorId) {
        newVendors = currentVendors.map((v) =>
          v.id === updatedVendorId ? { ...vendorFormData } : v
        );
      } else {
        newVendors = [...currentVendors, { ...vendorFormData }];
      }
      await enterpriseRepo.update(enterprise.id, { vendors: newVendors });
      setIsEditingVendor(null);
      setVendorFormData({ id: '', name: '', code: '', contactEmail: '', contactName: '' });
    } catch (error) {
      console.error('Save vendor failed', error);
      alert('Failed to save vendor.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteVendor = async (id: string) => {
    const newVendors = (enterprise.vendors || []).filter((v) => v.id !== id);
    await enterpriseRepo.update(enterprise.id, { vendors: newVendors });
  };

  const bulkDeleteVendors = async () => {
    const newVendors = (enterprise.vendors || []).filter((v) => !selectedVendorIds.has(v.id));
    await enterpriseRepo.update(enterprise.id, { vendors: newVendors });
    setSelectedVendorIds(new Set());
  };

  const handleImportVendors = (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const { read, utils } = await import('xlsx');
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const rows = utils.sheet_to_json(workbook.Sheets[sheetName]);
        if (rows.length === 0) {
          toast.error('The file is empty.');
          return;
        }
        onImportPreview({ type: 'vendors', data: rows });
      } catch (error) {
        console.error('Vendor import error:', error);
        toast.error('Failed to process the import file.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <>
      <motion.div
        key="vendors"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="flex-1 flex flex-col min-h-0"
      >
        <DataGridModule
          title="Vendors"
          description="Manage enterprise vendors and contact information."
          onAdd={() => {
            setVendorFormData({ id: '', name: '', code: '', contactEmail: '', contactName: '' });
            setIsEditingVendor({ id: null });
          }}
          gridRef={vendorsGridRef}
          onImportData={(data) => {
            const currentVendors = [...(enterprise.vendors || [])];
            data.forEach((row) => {
              const id = (
                row['Vendor ID'] ||
                row.id ||
                row.ID ||
                row.Code ||
                row.code
              )?.toString();
              const name =
                (row['Vendor Name'] || row.name || row.Name)?.toString() || '';
              if (!id || !name) return;

              const existingIndex = currentVendors.findIndex(
                (v) => v.id.toLowerCase() === id.toLowerCase()
              );
              const vendorData = {
                id,
                name,
                contactName:
                  (row['Contact Name'] || row.contactName || '')?.toString(),
                contactEmail:
                  (row['Contact Email'] || row.contactEmail || '')?.toString(),
              };

              if (existingIndex > -1) {
                currentVendors[existingIndex] = { ...currentVendors[existingIndex], ...vendorData };
              } else {
                currentVendors.push(vendorData);
              }
            });
            enterpriseRepo.update(enterprise.id, { vendors: currentVendors });
            toast.success(`Imported ${data.length} vendors`);
          }}
          onQuickFilterChange={setVendorSearch}
          quickFilterText={vendorSearch}
          rowData={enterprise.vendors || []}
          selectedCount={selectedVendorIds.size}
          onCellValueChanged={(event) => {
            const { data, colDef, newValue } = event;
            if (!data.id) return;
            const newVendors = (enterprise.vendors || []).map((v) =>
              v.id === data.id ? { ...v, [colDef.field!]: newValue } : v
            );
            enterpriseRepo.update(enterprise.id, { vendors: newVendors });
          }}
          onBulkUpdate={() => {
            setIsBulkUpdateModalOpen({ type: 'vendor', count: selectedVendorIds.size, selectedIds: Array.from(selectedVendorIds) });
          }}
          onBulkDelete={() =>
            setDeleteConfirm({ type: 'bulk-vendor', count: selectedVendorIds.size, onConfirm: bulkDeleteVendors })
          }
          columnDefs={vendorColumnDefs}
          gridProps={{
            rowSelection: 'multiple',
            onSelectionChanged: (params: any) => {
              const selectedNodes = params.api.getSelectedNodes();
              setSelectedVendorIds(new Set(selectedNodes.map((node: any) => node.data.id)));
            },
          }}
        />
      </motion.div>

      {/* Add/Edit Vendor Modal */}
      {isEditingVendor && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl w-full max-w-md p-6"
          >
            <h2 className="text-xl font-bold mb-6 dark:text-white">
              {isEditingVendor.id ? 'Edit' : 'Add'} Vendor
            </h2>
            <form onSubmit={saveVendor} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                    Vendor ID
                  </label>
                  <Input
                    value={vendorFormData.id}
                    onChange={(e) =>
                      setVendorFormData({ ...vendorFormData, id: e.target.value })
                    }
                    placeholder="e.g. V-001"
                    maxLength={50}
                    disabled={!!isEditingVendor.id}
                    className={cn(
                      isDuplicateVendorCode ? 'border-red-500 focus:ring-red-500' : '',
                      !!isEditingVendor.id && 'bg-gray-50 dark:bg-white/5 cursor-not-allowed'
                    )}
                  />
                  {isDuplicateVendorCode && (
                    <p className="text-[10px] text-red-500 font-bold uppercase tracking-tighter">
                      This ID already exists and must be unique
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                    Vendor Name
                  </label>
                  <Input
                    value={vendorFormData.name}
                    onChange={(e) =>
                      setVendorFormData({ ...vendorFormData, name: e.target.value })
                    }
                    placeholder="e.g. Acme Corp"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                    Contact Name
                  </label>
                  <Input
                    value={vendorFormData.contactName}
                    onChange={(e) =>
                      setVendorFormData({ ...vendorFormData, contactName: e.target.value })
                    }
                    placeholder="John Doe"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                    Contact Email
                  </label>
                  <Input
                    type="email"
                    value={vendorFormData.contactEmail}
                    onChange={(e) =>
                      setVendorFormData({ ...vendorFormData, contactEmail: e.target.value })
                    }
                    placeholder="john@acme.com"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="ghost" onClick={() => setIsEditingVendor(null)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting || isDuplicateVendorCode}
                  className="bg-black dark:bg-white text-white dark:text-black"
                >
                  {isEditingVendor.id ? 'Update' : 'Add'} Vendor
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </>
  );
}
