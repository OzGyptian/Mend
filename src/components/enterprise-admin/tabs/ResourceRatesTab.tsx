import React, { useState, useMemo, useRef } from 'react';
import { motion } from 'motion/react';
import { AgGridReact } from 'ag-grid-react';
import { cn } from '@/lib/utils';
import { useEnterpriseRepo } from '../../../platform/firestore/hooks';
import DataGridModule from '../../DataGridModule';
import { buildResourceRateColumnDefs } from '../columns';
import { RESOURCE_CATEGORIES } from '../constants';
import type { Enterprise } from '../../../types';

interface ResourceRatesTabProps {
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
}

export default function ResourceRatesTab({
  enterprise,
  setDeleteConfirm,
  setIsBulkUpdateModalOpen,
}: ResourceRatesTabProps) {
  const enterpriseRepo = useEnterpriseRepo();
  const resourceRatesGridRef = useRef<AgGridReact>(null);

  // Local UI state
  const [resourceSearch, setResourceSearch] = useState('');
  const [selectedRateIds, setSelectedRateIds] = useState<Set<string>>(new Set());
  const [isEditingResource, setIsEditingResource] = useState<{
    id: string | null;
    insertIndex?: number;
  } | null>(null);
  const [resourceFormData, setResourceFormData] = useState({
    id: '',
    name: '',
    unit: '',
    rate: 0,
    category: '',
    udf1: '',
    udf2: '',
    udf3: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resourceIdExists = useMemo(
    () =>
      !isSubmitting &&
      !isEditingResource?.id &&
      (enterprise.resourceRates || []).some((r) => r.id === resourceFormData.id),
    [resourceFormData.id, enterprise.resourceRates, isEditingResource?.id, isSubmitting]
  );

  const resourceRateColumnDefs = useMemo(
    () =>
      buildResourceRateColumnDefs({
        setResourceFormData,
        setIsEditingResource,
        setDeleteConfirm: (confirm) => {
          if (!confirm) { setDeleteConfirm(null); return; }
          setDeleteConfirm({
            ...confirm,
            onConfirm: confirm.type === 'rate' && confirm.id
              ? () => deleteResourceRate(confirm.id!)
              : undefined,
          });
        },
      }),
    [enterprise.resourceRates]
  );

  const addResourceRate = async (resource: any, index?: number) => {
    try {
      setIsSubmitting(true);
      const currentResources = [...(enterprise.resourceRates || [])];
      if (currentResources.some((r) => r.id === resource.id)) {
        alert(`Resource ID "${resource.id}" already exists.`);
        setIsSubmitting(false);
        return;
      }
      const finalResource = { ...resource, name: resource.name.trim() || 'Resource Name' };
      if (typeof index === 'number') {
        currentResources.splice(index, 0, finalResource);
      } else {
        currentResources.push(finalResource);
      }
      await enterpriseRepo.update(enterprise.id, { resourceRates: currentResources });
    } catch (error) {
      console.error('Failed to add resource rate', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateResourceRate = async (id: string, updates: any) => {
    const currentResources = enterprise.resourceRates || [];
    const newResources = currentResources.map((r) => (r.id === id ? { ...r, ...updates } : r));
    await enterpriseRepo.update(enterprise.id, { resourceRates: newResources });
  };

  const deleteResourceRate = async (id: string) => {
    const newRates = (enterprise.resourceRates || []).filter((r) => r.id !== id);
    await enterpriseRepo.update(enterprise.id, { resourceRates: newRates });
  };

  const bulkDeleteResourceRates = async () => {
    const newRates = (enterprise.resourceRates || []).filter((r) => !selectedRateIds.has(r.id));
    await enterpriseRepo.update(enterprise.id, { resourceRates: newRates });
    setSelectedRateIds(new Set());
  };

  return (
    <>
      <motion.div
        key="resourceRates"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="flex-1 flex flex-col min-h-0"
      >
        <DataGridModule
          title="Resource Rates"
          description="Manage global resource rates and unit costs."
          onAdd={() => {
            setResourceFormData({
              id: '',
              name: '',
              unit: '',
              rate: 0,
              category: '',
              udf1: '',
              udf2: '',
              udf3: '',
            });
            setIsEditingResource({ id: null });
          }}
          gridRef={resourceRatesGridRef}
          searchPlaceholder="Search resources..."
          quickFilterText={resourceSearch}
          onQuickFilterChange={setResourceSearch}
          rowData={enterprise.resourceRates || []}
          columnDefs={resourceRateColumnDefs}
          theme={document.documentElement.classList.contains('dark') ? 'dark' : 'light'}
          onCellValueChanged={(event) => {
            const { data, colDef, newValue } = event;
            if (!data.id) return;
            updateResourceRate(data.id, { [colDef.field!]: newValue });
          }}
          gridProps={{
            rowSelection: 'multiple',
            onSelectionChanged: (params: any) => {
              const selectedNodes = params.api.getSelectedNodes();
              setSelectedRateIds(new Set(selectedNodes.map((node: any) => node.data.id)));
            },
          }}
          selectedCount={selectedRateIds.size}
          onBulkUpdate={() => {
            setIsBulkUpdateModalOpen({ type: 'rate', count: selectedRateIds.size, selectedIds: Array.from(selectedRateIds) });
          }}
          onBulkDelete={() =>
            setDeleteConfirm({ type: 'bulk-rate', count: selectedRateIds.size, onConfirm: bulkDeleteResourceRates })
          }
        />
      </motion.div>

      {/* Add/Edit Resource Modal */}
      {isEditingResource && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[100] p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-white dark:bg-[#141414] rounded-3xl p-8 w-full max-w-lg shadow-2xl border border-gray-200 dark:border-white/10"
          >
            <h2 className="text-xl font-bold mb-6 dark:text-white">
              {isEditingResource.id ? 'Edit' : 'Add'} Resource
            </h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (isEditingResource.id) {
                  updateResourceRate(isEditingResource.id, resourceFormData);
                } else {
                  addResourceRate(resourceFormData, isEditingResource.insertIndex);
                }
                setIsEditingResource(null);
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
                    Resource ID <span className="text-red-500">*</span>
                  </label>
                  <input
                    required
                    disabled={!!isEditingResource.id}
                    type="text"
                    maxLength={20}
                    value={resourceFormData.id}
                    onChange={(e) =>
                      setResourceFormData({ ...resourceFormData, id: e.target.value })
                    }
                    className={cn(
                      'w-full p-4 bg-gray-50 dark:bg-white/5 border rounded-2xl text-sm focus:outline-none focus:ring-2 dark:text-white disabled:opacity-50 transition-all',
                      resourceIdExists
                        ? 'border-red-500 focus:ring-red-500/20'
                        : 'border-gray-200 dark:border-white/10 focus:ring-black/5'
                    )}
                  />
                  {resourceIdExists && (
                    <p className="text-[10px] text-red-500 mt-1 font-bold uppercase tracking-widest">
                      This ID already Exists!
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
                    Resource Category
                  </label>
                  <select
                    value={resourceFormData.category}
                    onChange={(e) =>
                      setResourceFormData({ ...resourceFormData, category: e.target.value })
                    }
                    className="w-full p-4 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-black/5 dark:text-white"
                  >
                    <option value="">Select Category</option>
                    {RESOURCE_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
                  Resource Name
                </label>
                <input
                  type="text"
                  value={resourceFormData.name}
                  onChange={(e) =>
                    setResourceFormData({ ...resourceFormData, name: e.target.value })
                  }
                  placeholder="e.g. Senior Engineer"
                  className="w-full p-4 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-black/5 dark:text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
                    Unit <span className="text-red-500">*</span>
                  </label>
                  <input
                    required
                    type="text"
                    value={resourceFormData.unit}
                    onChange={(e) =>
                      setResourceFormData({ ...resourceFormData, unit: e.target.value })
                    }
                    placeholder="e.g. HR, DAY, M2"
                    className="w-full p-4 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-black/5 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
                    Rate ($)
                  </label>
                  <input
                    type="number"
                    value={resourceFormData.rate}
                    onChange={(e) =>
                      setResourceFormData({
                        ...resourceFormData,
                        rate: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full p-4 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-black/5 dark:text-white"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                {(['udf1', 'udf2', 'udf3'] as const).map((udf, i) => (
                  <div key={udf}>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
                      UDF {i + 1}
                    </label>
                    <input
                      type="text"
                      value={resourceFormData[udf]}
                      onChange={(e) =>
                        setResourceFormData({ ...resourceFormData, [udf]: e.target.value })
                      }
                      className="w-full p-4 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-black/5 dark:text-white"
                    />
                  </div>
                ))}
              </div>
              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setIsEditingResource(null)}
                  className="flex-1 py-4 border border-gray-200 dark:border-white/10 rounded-2xl text-sm font-bold uppercase tracking-widest hover:bg-gray-50 dark:hover:bg-white/5 transition-colors dark:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!resourceFormData.id || resourceIdExists}
                  className="flex-1 py-4 bg-black dark:bg-white text-white dark:text-black rounded-2xl text-sm font-bold uppercase tracking-widest hover:bg-black/90 dark:hover:bg-white/90 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {isEditingResource.id ? 'Update' : 'Add'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </>
  );
}
