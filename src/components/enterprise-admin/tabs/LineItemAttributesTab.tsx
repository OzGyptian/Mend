import React, { useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, ChevronRight, X } from 'lucide-react';
import { AgGridReact } from 'ag-grid-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useEnterpriseRepo } from '../../../platform/firestore/hooks';
import DataGridModule from '../../DataGridModule';
import { buildAttributeValueColumnDefs } from '../columns';
import type { Enterprise, ProjectAttribute, ProjectAttributeValue } from '../../../types';

type AttributeType =
  | 'project'
  | 'lineItem'
  | 'costCode'
  | 'subcontract'
  | 'procurement'
  | 'change'
  | 'risk'
  | 'progress';

interface AttributeTitleInputProps {
  attr: ProjectAttribute;
  type: AttributeType;
  onSave: (type: AttributeType, id: string, title: string) => Promise<void>;
}

function AttributeTitleInput({ attr, type, onSave }: AttributeTitleInputProps) {
  const [value, setValue] = useState(attr.title);

  return (
    <input
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => onSave(type, attr.id, value)}
      placeholder="Attribute title..."
      className="w-full bg-transparent text-xs dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 rounded px-1 py-0.5"
    />
  );
}

interface LineItemAttributesTabProps {
  activeTab: string;
  enterprise: Enterprise;
  projectAttributes: ProjectAttribute[];
  lineItemAttributes: ProjectAttribute[];
  costCodeAttributes: ProjectAttribute[];
  subcontractAttributes: ProjectAttribute[];
  procurementAttributes: ProjectAttribute[];
  changeAttributes: ProjectAttribute[];
  riskAttributes: ProjectAttribute[];
  progressAttributes: ProjectAttribute[];
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
  onImportRequest: (
    type:
      | 'lineItemAttributes'
      | 'costCodeAttributes'
      | 'projectAttributes'
      | 'subcontractAttributes'
      | 'procurementAttributes'
      | 'changeAttributes'
      | 'riskAttributes'
      | 'progressAttributes',
    file: File,
    attrId: string
  ) => void;
}

function getAttrTypeFromTab(tab: string): AttributeType {
  switch (tab) {
    case 'projectAttributes':
      return 'project';
    case 'costCodeAttributes':
      return 'costCode';
    case 'subcontractAttributes':
      return 'subcontract';
    case 'procurementAttributes':
      return 'procurement';
    case 'changeAttributes':
      return 'change';
    case 'riskAttributes':
      return 'risk';
    case 'progressAttributes':
      return 'progress';
    default:
      return 'lineItem';
  }
}

function getFieldFromType(type: AttributeType): string {
  switch (type) {
    case 'project':
      return 'projectAttributes';
    case 'costCode':
      return 'costCodeAttributes';
    case 'subcontract':
      return 'subcontractAttributes';
    case 'procurement':
      return 'procurementAttributes';
    case 'change':
      return 'changeAttributes';
    case 'risk':
      return 'riskAttributes';
    case 'progress':
      return 'progressAttributes';
    default:
      return 'lineItemAttributes';
  }
}

export default function LineItemAttributesTab({
  activeTab,
  enterprise,
  projectAttributes,
  lineItemAttributes,
  costCodeAttributes,
  subcontractAttributes,
  procurementAttributes,
  changeAttributes,
  riskAttributes,
  progressAttributes,
  setDeleteConfirm,
  onImportRequest,
}: LineItemAttributesTabProps) {
  const enterpriseRepo = useEnterpriseRepo();
  const attrValueGridRef = useRef<AgGridReact>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Local UI state
  const [selectedAttrId, setSelectedAttrId] = useState<string>('01');
  const [attrSearch, setAttrSearch] = useState('');
  const [valueSearch, setValueSearch] = useState('');
  const [selectedAttrValueIds, setSelectedAttrValueIds] = useState<Set<string>>(new Set());
  const [isEditingValue, setIsEditingValue] = useState<{
    type: AttributeType;
    attrId: string;
    valueId: string | null;
  } | null>(null);
  const [valueFormData, setValueFormData] = useState({
    id: '',
    description: '',
    sortOrder: '' as any,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attrSort] = useState<{ field: string; direction: 'asc' | 'desc' }>({
    field: 'sortOrder',
    direction: 'asc',
  });

  const activeAttrs = useMemo((): ProjectAttribute[] => {
    switch (activeTab) {
      case 'projectAttributes':
        return projectAttributes;
      case 'costCodeAttributes':
        return costCodeAttributes;
      case 'subcontractAttributes':
        return subcontractAttributes;
      case 'procurementAttributes':
        return procurementAttributes;
      case 'changeAttributes':
        return changeAttributes;
      case 'riskAttributes':
        return riskAttributes;
      case 'progressAttributes':
        return progressAttributes;
      default:
        return lineItemAttributes;
    }
  }, [
    activeTab,
    projectAttributes,
    lineItemAttributes,
    costCodeAttributes,
    subcontractAttributes,
    procurementAttributes,
    changeAttributes,
    riskAttributes,
    progressAttributes,
  ]);

  const valueIdExists = useMemo(() => {
    if (isSubmitting || isEditingValue?.valueId) return false;
    if (!isEditingValue) return false;
    return (
      activeAttrs.find((a) => a.id === isEditingValue.attrId)?.values || []
    ).some((v) => v.id === valueFormData.id);
  }, [valueFormData.id, activeAttrs, isEditingValue, isSubmitting]);

  const sortedAttrValues = useMemo(() => {
    const values =
      activeAttrs.find((a: any) => a.id === selectedAttrId)?.values || [];
    let result = [...values].filter(
      (v) =>
        v.description.toLowerCase().includes(valueSearch.toLowerCase()) ||
        v.id.toLowerCase().includes(valueSearch.toLowerCase())
    );
    return result.sort((a: any, b: any) => {
      const aVal = a[attrSort.field];
      const bVal = b[attrSort.field];
      if (attrSort.direction === 'asc') return aVal > bVal ? 1 : -1;
      return aVal < bVal ? 1 : -1;
    });
  }, [selectedAttrId, activeAttrs, attrSort, valueSearch]);

  const attributeValueColumnDefs = useMemo(
    () =>
      buildAttributeValueColumnDefs({
        activeTab,
        selectedAttrId,
        deleteAttributeValue,
      }),
    [activeTab, selectedAttrId]
  );

  async function updateAttributeTitle(type: AttributeType, id: string, title: string) {
    const field = getFieldFromType(type);
    const currentAttrs = activeAttrs;
    const currentAttr = currentAttrs.find((a) => a.id === id);
    if (currentAttr && currentAttr.title === title) return;

    const newAttrs = currentAttrs.map((a) => (a.id === id ? { ...a, title } : a));
    try {
      await enterpriseRepo.update(enterprise.id, { [field]: newAttrs });
    } catch (e) {
      console.error(e);
      toast.error('Failed to update attribute title');
    }
  }

  async function deleteAttributeValue(type: AttributeType, attrId: string, valueId: string) {
    try {
      const field = getFieldFromType(type);
      const newAttrs = activeAttrs.map((a) => {
        if (a.id === attrId) {
          return { ...a, values: (a.values || []).filter((v) => v.id !== valueId) };
        }
        return a;
      });
      await enterpriseRepo.update(enterprise.id, { [field]: newAttrs });
      toast.success('Value deleted successfully');
    } catch (error) {
      console.error('Failed to delete attribute value', error);
      toast.error('Failed to delete value');
    }
  }

  async function bulkDeleteAttributeValues(type: AttributeType, attrId: string) {
    try {
      const field = getFieldFromType(type);
      const newAttrs = activeAttrs.map((a) => {
        if (a.id === attrId) {
          return { ...a, values: (a.values || []).filter((v) => !selectedAttrValueIds.has(v.id)) };
        }
        return a;
      });
      await enterpriseRepo.update(enterprise.id, { [field]: newAttrs });
      setSelectedAttrValueIds(new Set());
      toast.success('Values deleted successfully');
    } catch (error) {
      console.error('Failed to bulk delete attribute values', error);
      toast.error('Failed to delete values');
    }
  }

  async function addAttributeValue(
    type: AttributeType,
    attrId: string,
    value: ProjectAttributeValue
  ) {
    try {
      setIsSubmitting(true);
      const field = getFieldFromType(type);
      const finalValue = {
        ...value,
        sortOrder: parseInt(value.sortOrder as any) || 0,
        description: value.description.trim() || 'Value Description',
      };
      const newAttrs = activeAttrs.map((a) => {
        if (a.id === attrId) {
          const values = a.values || [];
          if (values.some((v) => v.id === value.id)) {
            alert(`Value ID "${value.id}" already exists for this attribute.`);
            return a;
          }
          return { ...a, values: [...values, finalValue] };
        }
        return a;
      });
      await enterpriseRepo.update(enterprise.id, { [field]: newAttrs });
    } catch (error) {
      console.error('Failed to add attribute value', error);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function updateAttributeValue(
    type: AttributeType,
    attrId: string,
    valueId: string,
    updates: Partial<ProjectAttributeValue>
  ) {
    const field = getFieldFromType(type);
    const newAttrs = activeAttrs.map((a) => {
      if (a.id === attrId) {
        return {
          ...a,
          values: (a.values || []).map((v) => (v.id === valueId ? { ...v, ...updates } : v)),
        };
      }
      return a;
    });
    await enterpriseRepo.update(enterprise.id, { [field]: newAttrs });
  }

  const handleInlineUpdate = (
    valueId: string,
    field: 'description' | 'sortOrder',
    newValue: string
  ) => {
    const type = getAttrTypeFromTab(activeTab);
    const updates: Partial<ProjectAttributeValue> = {};
    if (field === 'sortOrder') {
      updates.sortOrder = Number(newValue);
    } else {
      updates.description = newValue;
    }
    updateAttributeValue(type, selectedAttrId, valueId, updates);
  };

  const currentAttrType = getAttrTypeFromTab(activeTab);

  return (
    <>
      <motion.div
        key="attributes"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="flex-1 flex gap-8 min-h-0"
      >
        {/* Left Sidebar: 10 Static Rows */}
        <div className="w-80 bg-white dark:bg-[#141414] border border-gray-200 dark:border-white/10 rounded-2xl flex flex-col overflow-hidden">
          <div className="p-4 border-b border-gray-100 dark:border-white/10">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search attributes..."
                value={attrSearch}
                onChange={(e) => setAttrSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg text-xs focus:outline-none dark:text-white"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-black">
                <tr className="border-b border-white/10">
                  <th className="p-2 text-[10px] font-bold uppercase tracking-widest text-white w-12 text-center">
                    #
                  </th>
                  <th className="p-2 text-[10px] font-bold uppercase tracking-widest text-white">
                    Title
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-white/5">
                {activeAttrs
                  .filter(
                    (a: any) =>
                      a.title.toLowerCase().includes(attrSearch.toLowerCase()) ||
                      a.id.includes(attrSearch)
                  )
                  .map((attr: any) => (
                    <tr
                      key={attr.id}
                      onClick={() => setSelectedAttrId(attr.id)}
                      className={`cursor-pointer transition-colors ${
                        selectedAttrId === attr.id
                          ? 'bg-blue-50 dark:bg-blue-500/10'
                          : 'hover:bg-gray-50 dark:hover:bg-white/5'
                      }`}
                    >
                      <td className="p-2 text-xs font-bold text-black dark:text-white text-center">
                        {attr.id}
                      </td>
                      <td className="p-2">
                        <AttributeTitleInput
                          attr={attr}
                          type={currentAttrType}
                          onSave={updateAttributeTitle}
                        />
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Side: Value List Editor */}
        <div className="flex-1 bg-white dark:bg-[#141414] border border-gray-200 dark:border-white/10 rounded-2xl flex flex-col overflow-hidden">
          <AnimatePresence mode="wait">
            {selectedAttrId ? (
              <motion.div
                key={selectedAttrId}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex-1 flex flex-col min-h-0"
              >
                <DataGridModule
                  title={`Attribute ${selectedAttrId}: ${
                    activeAttrs.find((a: any) => a.id === selectedAttrId)?.title || 'Untitled'
                  }`}
                  description="Manage the list of allowed values for this attribute."
                  gridRef={attrValueGridRef}
                  onAdd={() => {
                    const currentAttr = activeAttrs.find((a: any) => a.id === selectedAttrId);
                    setValueFormData({
                      id: '',
                      description: '',
                      sortOrder: (currentAttr?.values?.length || 0) + 1,
                    });
                    setIsEditingValue({
                      type: currentAttrType,
                      attrId: selectedAttrId,
                      valueId: null,
                    });
                  }}
                  onImport={() => {
                    if (fileInputRef.current) {
                      fileInputRef.current.onchange = (e: any) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const tabType = activeTab as any;
                          onImportRequest(tabType, file, selectedAttrId);
                        }
                        e.target.value = '';
                      };
                      fileInputRef.current.click();
                    }
                  }}
                  searchPlaceholder="Search values..."
                  quickFilterText={valueSearch}
                  onQuickFilterChange={setValueSearch}
                  rowData={sortedAttrValues}
                  columnDefs={attributeValueColumnDefs}
                  theme={document.documentElement.classList.contains('dark') ? 'dark' : 'light'}
                  onCellValueChanged={(event) => {
                    const { data, colDef, newValue } = event;
                    if (!data.id) return;
                    handleInlineUpdate(data.id, colDef.field as any, newValue);
                  }}
                  gridProps={{
                    rowSelection: 'multiple',
                    onSelectionChanged: (params: any) => {
                      const selectedNodes = params.api.getSelectedNodes();
                      setSelectedAttrValueIds(
                        new Set(selectedNodes.map((node: any) => node.data.id))
                      );
                    },
                  }}
                  selectedCount={selectedAttrValueIds.size}
                  onBulkDelete={() => {
                    const attrType = getAttrTypeFromTab(activeTab);
                    setDeleteConfirm({
                      type: 'bulk-attr-value',
                      count: selectedAttrValueIds.size,
                      onConfirm: () => bulkDeleteAttributeValues(attrType, selectedAttrId),
                    });
                  }}
                />
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 flex flex-col items-center justify-center p-12 text-center"
              >
                <div className="w-16 h-16 bg-gray-50 dark:bg-white/5 rounded-full flex items-center justify-center mb-6">
                  <ChevronRight className="w-8 h-8 text-gray-300" />
                </div>
                <h3 className="text-lg font-bold dark:text-white mb-2">Select an Attribute</h3>
                <p className="text-sm text-gray-900 dark:text-gray-400 max-w-xs">
                  Choose one of the 10 static attributes from the left sidebar to manage its
                  values.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Hidden file input for import */}
      <input ref={fileInputRef} type="file" className="hidden" accept=".xlsx,.xls,.csv" />

      {/* Add/Edit Value Modal */}
      <AnimatePresence>
        {isEditingValue && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-[#1C1C1C] rounded-2xl w-full max-w-md shadow-2xl border border-gray-200 dark:border-white/10 overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100 dark:border-white/10 flex justify-between items-center">
                <h3 className="text-xl font-bold dark:text-white">
                  {isEditingValue.valueId ? 'Edit Value' : 'Add'}
                </h3>
                <button
                  onClick={() => setIsEditingValue(null)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 dark:text-white" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
                    Value ID <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    maxLength={20}
                    value={valueFormData.id}
                    onChange={(e) => setValueFormData({ ...valueFormData, id: e.target.value })}
                    placeholder="e.g. V01"
                    className={cn(
                      'w-full p-3 bg-gray-50 dark:bg-white/5 border rounded-xl focus:outline-none focus:ring-2 dark:text-white transition-all',
                      valueIdExists
                        ? 'border-red-500 focus:ring-red-500/20'
                        : 'border-gray-200 dark:border-white/10 focus:ring-blue-500/20'
                    )}
                    disabled={!!isEditingValue.valueId}
                  />
                  {valueIdExists && (
                    <p className="text-[10px] text-red-500 mt-1 font-bold uppercase tracking-widest">
                      This ID already Exists!
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
                    Description
                  </label>
                  <input
                    type="text"
                    value={valueFormData.description}
                    onChange={(e) =>
                      setValueFormData({ ...valueFormData, description: e.target.value })
                    }
                    placeholder="e.g. High Priority"
                    className="w-full p-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
                    Sort Order
                  </label>
                  <input
                    type="text"
                    maxLength={5}
                    value={valueFormData.sortOrder}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '' || /^-?\d*\.?\d*$/.test(val)) {
                        setValueFormData({ ...valueFormData, sortOrder: val });
                      }
                    }}
                    placeholder="e.g. 1.0"
                    className="w-full p-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:text-white"
                  />
                </div>
              </div>
              <div className="p-6 bg-gray-50 dark:bg-white/2 border-t border-gray-100 dark:border-white/10 flex justify-end gap-3">
                <button
                  onClick={() => setIsEditingValue(null)}
                  className="px-6 py-2.5 text-sm font-bold text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  disabled={!valueFormData.id || valueIdExists}
                  onClick={async () => {
                    if (!valueFormData.id) return;
                    if (isEditingValue.valueId) {
                      await updateAttributeValue(
                        isEditingValue.type,
                        isEditingValue.attrId,
                        isEditingValue.valueId,
                        valueFormData
                      );
                    } else {
                      await addAttributeValue(
                        isEditingValue.type,
                        isEditingValue.attrId,
                        valueFormData
                      );
                    }
                    setIsEditingValue(null);
                  }}
                  className="px-8 py-2.5 bg-black dark:bg-white text-white dark:text-black rounded-xl text-sm font-bold hover:bg-black/90 dark:hover:bg-white/90 transition-colors shadow-lg shadow-black/10 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {isEditingValue.valueId ? 'Save Changes' : 'Add'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
