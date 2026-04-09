import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Project, ProjectAttribute, ProjectAttributeValue, SavedView } from '../types';
import { db, auth } from '../firebase';
import { doc, updateDoc, collection, query, where, onSnapshot, addDoc, deleteDoc } from 'firebase/firestore';
import { 
  Search, 
  Plus, 
  Trash2, 
  Edit2, 
  Save, 
  X, 
  Upload, 
  Download, 
  Filter, 
  Tag, 
  ChevronRight, 
  Menu, 
  ChevronLeft,
  Layout,
  Eye,
  Lock,
  Unlock,
  MoreVertical,
  PieChart,
  CheckCircle2
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { toast } from 'sonner';

interface ProjectLineItemAttributesProps {
  project: Project;
}

const ProjectLineItemAttributes: React.FC<ProjectLineItemAttributesProps> = ({ project }) => {
  const [attributes, setAttributes] = useState<ProjectAttribute[]>([]);
  const [selectedAttrId, setSelectedAttrId] = useState<string | null>('01');
  const [attrSearch, setAttrSearch] = useState('');
  const [search, setSearch] = useState('');
  const [isEditingValue, setIsEditingValue] = useState<{ attrId: string; valueId: string | null } | null>(null);
  const [valueFormData, setValueFormData] = useState<ProjectAttributeValue>({ id: '', description: '', sortOrder: 1 });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Table State
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [sort, setSort] = useState<{ field: keyof ProjectAttributeValue; direction: 'asc' | 'desc' }>({ field: 'sortOrder', direction: 'asc' });
  const [visibleColumns, setVisibleColumns] = useState<string[]>(['id', 'description', 'sortOrder']);
  const [isFrozen, setIsFrozen] = useState(false);
  const [isColumnMenuOpen, setIsColumnMenuOpen] = useState(false);
  const [isSavedViewMenuOpen, setIsSavedViewMenuOpen] = useState(false);
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [newViewName, setNewViewName] = useState('');
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'single' | 'bulk' | 'bulk-attr-value'; id?: string; name?: string; count?: number } | null>(null);
  const [showImportSuccessModal, setShowImportSuccessModal] = useState(false);
  const [editingValueId, setEditingValueId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<'description' | 'sortOrder' | null>(null);

  useEffect(() => {
    // Initialize with 10 default attributes if empty
    const currentAttrs = project.lineItemAttributes || [];
    const initializedAttrs = Array.from({ length: 10 }, (_, i) => {
      const id = (i + 1).toString().padStart(2, '0');
      const existing = currentAttrs.find(a => a.id === id);
      return existing || { id, title: '', values: [] };
    });
    setAttributes(initializedAttrs);
  }, [project.lineItemAttributes]);

  // Load Saved Views
  useEffect(() => {
    if (!auth.currentUser || !selectedAttrId) return;
    const q = query(
      collection(db, 'savedViews'), 
      where('userId', '==', auth.currentUser.uid),
      where('tableId', '==', `projectLineItemAttr_${selectedAttrId}`)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setSavedViews(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as SavedView)));
    });
    return () => unsubscribe();
  }, [auth.currentUser?.uid, selectedAttrId]);

  const saveView = async (name: string) => {
    if (!name.trim() || !auth.currentUser || !selectedAttrId) return;
    try {
      await addDoc(collection(db, 'savedViews'), {
        name,
        tableId: `projectLineItemAttr_${selectedAttrId}`,
        columns: visibleColumns,
        userId: auth.currentUser.uid,
        createdAt: new Date().toISOString(),
        config: {
          isFrozen,
          sort,
          columnFilters
        }
      });
      setNewViewName('');
      setIsSavedViewMenuOpen(false);
      toast.success('View saved successfully');
    } catch (error) {
      console.error('Error saving view:', error);
      toast.error('Failed to save view');
    }
  };

  const applyView = (view: SavedView) => {
    setVisibleColumns(view.columns);
    if ((view as any).config) {
      setIsFrozen((view as any).config.isFrozen);
      setSort((view as any).config.sort);
      setColumnFilters((view as any).config.columnFilters);
    }
    setIsSavedViewMenuOpen(false);
    toast.success(`Applied view: ${view.name}`);
  };

  const deleteView = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'savedViews', id));
      toast.success('View deleted');
    } catch (error) {
      console.error('Error deleting view:', error);
      toast.error('Failed to delete view');
    }
  };

  const clearAllFilters = () => {
    setSearch('');
    setColumnFilters({});
    setSort({ field: 'sortOrder', direction: 'asc' });
    toast.success('Filters cleared');
  };

  const handleGlobalSave = async (updatedAttrs: ProjectAttribute[]) => {
    try {
      await updateDoc(doc(db, 'projects', project.id), { lineItemAttributes: updatedAttrs });
      toast.success('Changes saved successfully.');
    } catch (error) {
      console.error('Error saving line item attributes:', error);
      toast.error('Failed to save changes.');
    }
  };

  const updateAttributeTitle = (id: string, newTitle: string) => {
    const newAttrs = attributes.map(attr => attr.id === id ? { ...attr, title: newTitle } : attr);
    setAttributes(newAttrs);
    handleGlobalSave(newAttrs);
  };

  const handleSaveValue = async () => {
    if (!isEditingValue || !valueFormData.id) return;

    const newAttrs = attributes.map(attr => {
      if (attr.id === isEditingValue.attrId) {
        let newValues = [...attr.values];
        if (isEditingValue.valueId === null) {
          // Add new
          if (newValues.some(v => v.id === valueFormData.id)) {
            toast.error('A value with this ID already exists.');
            return attr;
          }
          newValues.push(valueFormData);
        } else {
          // Update existing
          newValues = newValues.map(v => v.id === isEditingValue.valueId ? valueFormData : v);
        }
        return { ...attr, values: newValues };
      }
      return attr;
    });

    setAttributes(newAttrs);
    await handleGlobalSave(newAttrs);
    setIsEditingValue(null);
    setValueFormData({ id: '', description: '', sortOrder: 1 });
  };

  const removeAttributeValue = async (attrId: string, valueId: string) => {
    const newAttrs = attributes.map(attr => {
      if (attr.id === attrId) {
        return { ...attr, values: attr.values.filter(v => v.id !== valueId) };
      }
      return attr;
    });
    setAttributes(newAttrs);
    await handleGlobalSave(newAttrs);
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(valueId);
      return next;
    });
  };

  const updateAttributeValue = async (attrId: string, valueId: string, updates: Partial<ProjectAttributeValue>) => {
    const newAttrs = attributes.map(attr => {
      if (attr.id === attrId) {
        return {
          ...attr,
          values: attr.values.map(v => v.id === valueId ? { ...v, ...updates } : v)
        };
      }
      return attr;
    });
    setAttributes(newAttrs);
    await handleGlobalSave(newAttrs);
  };

  const handleInlineUpdate = (valueId: string, field: 'description' | 'sortOrder', newValue: string) => {
    const updates: Partial<ProjectAttributeValue> = {};
    if (field === 'sortOrder') {
      updates.sortOrder = Number(newValue);
    } else {
      updates.description = newValue;
    }
    updateAttributeValue(selectedAttrId!, valueId, updates);
    setEditingValueId(null);
    setEditingField(null);
  };

  const bulkDeleteAttributeValues = async (attrId: string) => {
    const newAttrs = attributes.map(attr => {
      if (attr.id === attrId) {
        return { ...attr, values: attr.values.filter(v => !selectedIds.has(v.id)) };
      }
      return attr;
    });
    setAttributes(newAttrs);
    await handleGlobalSave(newAttrs);
    setSelectedIds(new Set());
    setDeleteConfirm(null);
  };

  const handleImport = async (file: File, attrId: string) => {
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        const newAttrs = attributes.map(attr => {
          if (attr.id === attrId) {
            const newValues = [...attr.values];
            data.forEach(row => {
              if (row.id && row.description) {
                const existingIndex = newValues.findIndex(v => v.id === String(row.id));
                const newValue: ProjectAttributeValue = {
                  id: String(row.id),
                  description: String(row.description),
                  sortOrder: row.sortOrder ? Number(row.sortOrder) : newValues.length + 1
                };
                
                if (existingIndex >= 0) {
                  newValues[existingIndex] = newValue;
                } else {
                  newValues.push(newValue);
                }
              }
            });
            return { ...attr, values: newValues };
          }
          return attr;
        });

        setAttributes(newAttrs);
        await handleGlobalSave(newAttrs);
        setShowImportSuccessModal(true);
      } catch (error) {
        console.error('Error importing attribute values:', error);
        toast.error('Failed to import attribute values. Please check the file format.');
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsBinaryString(file);
  };

  const handleExport = (attrId: string) => {
    const attr = attributes.find(a => a.id === attrId);
    if (!attr) return;

    const ws = XLSX.utils.json_to_sheet(attr.values);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Attribute ${attr.id}`);
    XLSX.writeFile(wb, `${project.projectCode}_LineItemAttr_${attr.id}.xlsx`);
  };

  const selectedAttr = attributes.find(a => a.id === selectedAttrId);
  
  const filteredValues = useMemo(() => {
    if (!selectedAttr) return [];
    return selectedAttr.values
      .filter(v => {
        // Global Search
        const searchMatch = !search || 
          v.id.toLowerCase().includes(search.toLowerCase()) ||
          v.description.toLowerCase().includes(search.toLowerCase());
        
        if (!searchMatch) return false;

        // Column Filters
        return Object.entries(columnFilters).every(([field, value]) => {
          if (!value) return true;
          const fieldValue = String((v as any)[field] || '').toLowerCase();
          return fieldValue.includes(value.toLowerCase());
        });
      })
      .sort((a, b) => {
        const aVal = (a as any)[sort.field];
        const bVal = (b as any)[sort.field];
        
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sort.direction === 'asc' ? aVal - bVal : bVal - aVal;
        }
        
        const strA = String(aVal || '').toLowerCase();
        const strB = String(bVal || '').toLowerCase();
        return sort.direction === 'asc' 
          ? strA.localeCompare(strB, undefined, { numeric: true }) 
          : strB.localeCompare(strA, undefined, { numeric: true });
      });
  }, [selectedAttr, search, columnFilters, sort]);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-[#141414]">
      <div className="flex-1 flex gap-8 p-8 min-h-0">
        {/* Left Sidebar: 10 Static Rows */}
        <div className="w-80 bg-white dark:bg-[#141414] border border-gray-200 dark:border-white/10 rounded-2xl flex flex-col overflow-hidden shadow-sm">
          <div className="p-4 border-b border-gray-100 dark:border-white/10">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input 
                type="text"
                placeholder="Search attributes..."
                value={attrSearch}
                onChange={e => setAttrSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg text-xs focus:outline-none dark:text-white"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-black">
                <tr className="border-b border-white/10">
                  <th className="p-2 text-[10px] font-bold uppercase tracking-widest text-white w-12 text-center">#</th>
                  <th className="p-2 text-[10px] font-bold uppercase tracking-widest text-white">Title</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-white/5">
                {attributes.filter(a => a.title.toLowerCase().includes(attrSearch.toLowerCase()) || a.id.includes(attrSearch)).map((attr) => (
                  <tr 
                    key={attr.id}
                    onClick={() => setSelectedAttrId(attr.id)}
                    className={`cursor-pointer transition-colors ${selectedAttrId === attr.id ? 'bg-blue-50 dark:bg-blue-500/10' : 'hover:bg-gray-50 dark:hover:bg-white/5'}`}
                  >
                    <td className="p-2 text-xs font-bold text-black dark:text-white text-center">{attr.id}</td>
                    <td className="p-2">
                      <input 
                        type="text"
                        value={attr.title}
                        onChange={(e) => updateAttributeTitle(attr.id, e.target.value)}
                        placeholder="Assign Title..."
                        className="w-full bg-transparent border-none p-0 text-sm font-medium focus:ring-0 dark:text-white placeholder:text-gray-300 dark:placeholder:text-gray-600"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Side: Value List Editor */}
        <div className="flex-1 bg-white dark:bg-[#141414] border border-gray-200 dark:border-white/10 rounded-2xl flex flex-col overflow-hidden shadow-sm">
          <AnimatePresence mode="wait">
            {selectedAttrId ? (
              <motion.div
                key={selectedAttrId}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex-1 flex flex-col min-h-0"
              >
                <div className="p-6 border-b border-gray-100 dark:border-white/10 flex justify-between items-center bg-gray-50/50 dark:bg-white/5 shrink-0">
                  <div>
                    <h3 className="text-xl font-bold dark:text-white">
                      Attribute {selectedAttrId}{selectedAttr?.title ? `: ${selectedAttr.title}` : ''}
                    </h3>
                    <p className="text-sm text-gray-900 dark:text-gray-400">Manage the list of allowed values for this attribute.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input 
                        type="text" 
                        placeholder="Search values..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-10 pr-4 py-2 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none w-64 dark:text-white"
                      />
                    </div>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      className="hidden" 
                      accept=".xlsx,.xls,.csv"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImport(file, selectedAttrId);
                      }}
                    />
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="p-2 text-gray-400 hover:text-black dark:hover:text-white transition-colors"
                      title="Import"
                    >
                      <Upload className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={() => handleExport(selectedAttrId)}
                      className="p-2 text-gray-400 hover:text-black dark:hover:text-white transition-colors"
                      title="Export"
                    >
                      <Download className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={clearAllFilters}
                      className="p-2 text-gray-400 hover:text-red-600 transition-colors flex items-center gap-1 text-xs font-medium"
                      title="Clear All Filters"
                    >
                      <Filter className="w-4 h-4" /> Clear Filters
                    </button>
                    <div className="relative">
                      <button 
                        onClick={() => setIsSavedViewMenuOpen(!isSavedViewMenuOpen)}
                        className="p-2 text-gray-400 hover:text-black dark:hover:text-white flex items-center gap-1 text-sm font-medium transition-colors"
                      >
                        <Layout className="w-5 h-5" /> Views
                      </button>
                      <AnimatePresence>
                        {isSavedViewMenuOpen && (
                          <motion.div 
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            className="absolute right-0 mt-2 w-64 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-xl shadow-xl z-50 p-3"
                          >
                            <div className="mb-3">
                              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Save Current View</p>
                              <div className="flex gap-2">
                                <input 
                                  type="text"
                                  placeholder="View name..."
                                  value={newViewName}
                                  onChange={e => setNewViewName(e.target.value)}
                                  className="flex-1 px-2 py-1 text-xs bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded outline-none dark:text-white"
                                />
                                <button 
                                  onClick={() => saveView(newViewName)}
                                  className="px-2 py-1 bg-black dark:bg-white text-white dark:text-black text-[10px] font-bold rounded"
                                >
                                  Save
                                </button>
                              </div>
                            </div>
                            <div className="space-y-1 max-h-48 overflow-y-auto custom-scrollbar">
                              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Saved Views</p>
                              {savedViews.map(view => (
                                <div key={view.id} className="flex items-center justify-between group p-1.5 hover:bg-gray-50 dark:hover:bg-white/5 rounded-lg cursor-pointer">
                                  <span onClick={() => applyView(view)} className="text-xs dark:text-white flex-1">{view.name}</span>
                                  <button onClick={(e) => { e.stopPropagation(); deleteView(view.id); }} className="opacity-40 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-600 transition-opacity">
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              ))}
                              {savedViews.length === 0 && (
                                <p className="text-[10px] text-gray-400 italic p-2 text-center">No saved views</p>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                    <div className="relative">
                      <button onClick={() => setIsColumnMenuOpen(!isColumnMenuOpen)} className="p-2 text-gray-400 hover:text-black dark:hover:text-white flex items-center gap-1 text-sm font-medium transition-colors">
                        <Eye className="w-5 h-5" /> Columns
                      </button>
                      <AnimatePresence>
                        {isColumnMenuOpen && (
                          <motion.div 
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            className="absolute right-0 mt-2 w-48 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-xl shadow-xl z-50 p-2 max-h-[70vh] overflow-y-auto custom-scrollbar"
                          >
                            {['id', 'description', 'sortOrder'].map(col => (
                              <label key={col} className="flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-white/5 rounded-lg cursor-pointer">
                                <input 
                                  type="checkbox"
                                  checked={visibleColumns.includes(col)}
                                  onChange={() => setVisibleColumns(prev => 
                                    prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]
                                  )}
                                  className="rounded border-gray-300 dark:border-white/10 text-black focus:ring-black"
                                />
                                <span className="text-xs dark:text-white uppercase tracking-widest font-bold">
                                  {col === 'id' ? 'ID' : col === 'sortOrder' ? 'Sort Order' : 'Description'}
                                </span>
                              </label>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                    <button onClick={() => setIsFrozen(!isFrozen)} className={cn("p-2 flex items-center gap-1 text-sm font-medium transition-colors", isFrozen ? "text-blue-600" : "text-gray-400 hover:text-black dark:hover:text-white")}>
                      {isFrozen ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />} {isFrozen ? 'Frozen' : 'Freeze'}
                    </button>
                    {selectedIds.size > 0 && (
                      <button 
                        onClick={() => setDeleteConfirm({ type: 'bulk-attr-value', count: selectedIds.size })}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-red-700 transition-colors shadow-lg shadow-red-600/20"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete ({selectedIds.size})
                      </button>
                    )}
                    <button 
                      onClick={() => {
                        setValueFormData({ id: '', description: '', sortOrder: (selectedAttr?.values?.length || 0) + 1 });
                        setIsEditingValue({ attrId: selectedAttrId, valueId: null });
                      }}
                      className="flex items-center gap-2 bg-black dark:bg-white text-white dark:text-black px-4 py-2 rounded-lg text-sm font-medium hover:bg-black/90 dark:hover:bg-white/90 transition-all shadow-lg shadow-black/10"
                    >
                      <Plus className="w-4 h-4" />
                      Add
                    </button>
                  </div>
                </div>
                
                <div className="flex-1 overflow-auto custom-scrollbar min-h-0 pb-48">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-black dark:bg-gray-100 sticky top-0 z-20">
                      <tr className="border-b border-white/10 dark:border-black/10">
                        <th className={cn("p-3 w-12", isFrozen && "sticky left-0 z-30 bg-black dark:bg-gray-100 border-r border-white/10 dark:border-black/10")}>
                          <input 
                            type="checkbox" 
                            className="rounded border-gray-300 dark:border-black/20 bg-transparent"
                            checked={filteredValues.length > 0 && filteredValues.every(v => selectedIds.has(v.id))}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedIds(new Set(filteredValues.map(v => v.id)));
                              } else {
                                setSelectedIds(new Set());
                              }
                            }}
                          />
                        </th>
                        {visibleColumns.includes('id') && (
                          <th 
                            onClick={() => setSort(prev => ({ field: 'id', direction: prev.field === 'id' && prev.direction === 'asc' ? 'desc' : 'asc' }))}
                            className={cn("p-3 w-32 text-[10px] font-bold uppercase tracking-widest text-white dark:text-black cursor-pointer hover:text-gray-300 dark:hover:text-gray-600", isFrozen && "sticky left-12 z-30 bg-black dark:bg-gray-100 border-r border-white/10 dark:border-black/10")}
                          >
                            ID {sort.field === 'id' && (sort.direction === 'asc' ? '↑' : '↓')}
                          </th>
                        )}
                        {visibleColumns.includes('description') && (
                          <th 
                            onClick={() => setSort(prev => ({ field: 'description', direction: prev.field === 'description' && prev.direction === 'asc' ? 'desc' : 'asc' }))}
                            className="p-3 text-[10px] font-bold uppercase tracking-widest text-white dark:text-black cursor-pointer hover:text-gray-300 dark:hover:text-gray-600"
                          >
                            Description {sort.field === 'description' && (sort.direction === 'asc' ? '↑' : '↓')}
                          </th>
                        )}
                        {visibleColumns.includes('sortOrder') && (
                          <th 
                            onClick={() => setSort(prev => ({ field: 'sortOrder', direction: prev.field === 'sortOrder' && prev.direction === 'asc' ? 'desc' : 'asc' }))}
                            className="p-3 w-32 text-[10px] font-bold uppercase tracking-widest text-white dark:text-black cursor-pointer hover:text-gray-300 dark:hover:text-gray-600"
                          >
                            Sort Order {sort.field === 'sortOrder' && (sort.direction === 'asc' ? '↑' : '↓')}
                          </th>
                        )}
                        <th className="p-3 w-12 text-[10px] font-bold uppercase tracking-widest text-white dark:text-black text-center sticky right-0 z-30 bg-black dark:bg-gray-100 border-l border-white/10 dark:border-black/10">...</th>
                      </tr>
                      <tr className="bg-gray-100/50 dark:bg-white/2 border-b border-gray-200 dark:border-white/10">
                        <th className={cn("p-2", isFrozen && "sticky left-0 z-30 bg-gray-100/50 dark:bg-[#1a1a1a] border-r border-gray-200 dark:border-white/10")}></th>
                        {visibleColumns.includes('id') && (
                          <th className={cn("p-2 w-32", isFrozen && "sticky left-12 z-30 bg-gray-100/50 dark:bg-[#1a1a1a] border-r border-gray-200 dark:border-white/10")}>
                            <input 
                              type="text"
                              placeholder="Filter ID..."
                              value={columnFilters.id || ''}
                              onChange={(e) => setColumnFilters(prev => ({ ...prev, id: e.target.value }))}
                              className="w-full px-2 py-1 text-[10px] bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded focus:ring-1 focus:ring-blue-500 outline-none dark:text-white"
                            />
                          </th>
                        )}
                        {visibleColumns.includes('description') && (
                          <th className="p-2">
                            <input 
                              type="text"
                              placeholder="Filter Description..."
                              value={columnFilters.description || ''}
                              onChange={(e) => setColumnFilters(prev => ({ ...prev, description: e.target.value }))}
                              className="w-full px-2 py-1 text-[10px] bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded focus:ring-1 focus:ring-blue-500 outline-none dark:text-white"
                            />
                          </th>
                        )}
                        {visibleColumns.includes('sortOrder') && (
                          <th className="p-2 w-32">
                            <input 
                              type="text"
                              placeholder="Filter Sort..."
                              value={columnFilters.sortOrder || ''}
                              onChange={(e) => setColumnFilters(prev => ({ ...prev, sortOrder: e.target.value }))}
                              className="w-full px-2 py-1 text-[10px] bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded focus:ring-1 focus:ring-blue-500 outline-none dark:text-white"
                            />
                          </th>
                        )}
                        <th className="p-2 sticky right-0 z-30 bg-gray-100/50 dark:bg-[#1a1a1a] border-l border-gray-200 dark:border-white/10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-white/5">
                      {filteredValues.map((val, index) => (
                        <tr key={val.id} className={cn("hover:bg-gray-50 dark:hover:bg-white/5 transition-colors group", selectedIds.has(val.id) && "bg-blue-50/50 dark:bg-blue-500/5")}>
                          <td className={cn("p-3", isFrozen && "sticky left-0 z-10 bg-inherit border-r border-gray-200 dark:border-white/10")}>
                            <input 
                              type="checkbox" 
                              className="rounded border-gray-300 dark:border-white/20 bg-transparent"
                              checked={selectedIds.has(val.id)}
                              onChange={() => {
                                const newSelected = new Set(selectedIds);
                                if (newSelected.has(val.id)) {
                                  newSelected.delete(val.id);
                                } else {
                                  newSelected.add(val.id);
                                }
                                setSelectedIds(newSelected);
                              }}
                            />
                          </td>
                          {visibleColumns.includes('id') && <td className={cn("p-3 text-xs font-mono dark:text-white", isFrozen && "sticky left-12 z-10 bg-inherit border-r border-gray-200 dark:border-white/10")}>{val.id}</td>}
                          {visibleColumns.includes('description') && (
                            <td 
                              className="p-3 text-xs dark:text-white cursor-pointer hover:bg-gray-100/50 dark:hover:bg-white/5 transition-colors"
                              onClick={() => {
                                setEditingValueId(val.id);
                                setEditingField('description');
                              }}
                            >
                              {editingValueId === val.id && editingField === 'description' ? (
                                <input 
                                  autoFocus
                                  type="text"
                                  defaultValue={val.description}
                                  onBlur={(e) => handleInlineUpdate(val.id, 'description', e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleInlineUpdate(val.id, 'description', e.currentTarget.value);
                                    if (e.key === 'Escape') { setEditingValueId(null); setEditingField(null); }
                                  }}
                                  className="w-full px-2 py-1 text-xs bg-white dark:bg-[#1a1a1a] border border-blue-500 rounded outline-none dark:text-white"
                                />
                              ) : (
                                val.description
                              )}
                            </td>
                          )}
                          {visibleColumns.includes('sortOrder') && (
                            <td 
                              className="p-3 text-xs dark:text-white cursor-pointer hover:bg-gray-100/50 dark:hover:bg-white/5 transition-colors"
                              onClick={() => {
                                setEditingValueId(val.id);
                                setEditingField('sortOrder');
                              }}
                            >
                              {editingValueId === val.id && editingField === 'sortOrder' ? (
                                <input 
                                  autoFocus
                                  type="number"
                                  defaultValue={val.sortOrder}
                                  onBlur={(e) => handleInlineUpdate(val.id, 'sortOrder', e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleInlineUpdate(val.id, 'sortOrder', e.currentTarget.value);
                                    if (e.key === 'Escape') { setEditingValueId(null); setEditingField(null); }
                                  }}
                                  className="w-20 px-2 py-1 text-xs bg-white dark:bg-[#1a1a1a] border border-blue-500 rounded outline-none dark:text-white"
                                />
                              ) : (
                                val.sortOrder?.toString().padStart(2, '0')
                              )}
                            </td>
                          )}
                          <td className={cn(
                            "p-3 text-right sticky right-0 bg-inherit border-l border-gray-200 dark:border-white/10",
                            activeMenuId === `attr-val-${val.id}` ? "z-40" : "z-10"
                          )}>
                            <div className="flex items-center justify-end gap-1 opacity-40 group-hover:opacity-100 transition-opacity">
                              <div className="relative">
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveMenuId(activeMenuId === `attr-val-${val.id}` ? null : `attr-val-${val.id}`);
                                  }}
                                  className="p-1.5 text-gray-400 hover:text-black dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-white/5"
                                >
                                  <MoreVertical className="w-4 h-4" />
                                </button>
                                
                                <AnimatePresence>
                                  {activeMenuId === `attr-val-${val.id}` && (
                                    <>
                                      <div 
                                        className="fixed inset-0 z-40" 
                                        onClick={() => setActiveMenuId(null)}
                                      />
                                      <motion.div 
                                        initial={{ opacity: 0, scale: 0.95, x: 10 }}
                                        animate={{ opacity: 1, scale: 1, x: 0 }}
                                        exit={{ opacity: 0, scale: 0.95, x: 10 }}
                                        className={cn(
                                          "absolute right-full mr-2 w-48 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-xl shadow-xl z-50 p-2",
                                          index > filteredValues.length - 4 && index >= 3 ? "bottom-0 mb-0" : "top-0 mt-0"
                                        )}
                                      >
                                        <button 
                                          onClick={() => {
                                            setValueFormData(val);
                                            setIsEditingValue({ attrId: selectedAttrId!, valueId: val.id });
                                            setActiveMenuId(null);
                                          }}
                                          className="w-full text-left p-2 text-xs dark:text-white hover:bg-gray-50 dark:hover:bg-white/5 rounded-lg flex items-center gap-2"
                                        >
                                          <Edit2 className="w-3 h-3" /> Edit
                                        </button>
                                        <button 
                                          onClick={() => {
                                            removeAttributeValue(selectedAttrId!, val.id);
                                            setActiveMenuId(null);
                                          }}
                                          className="w-full text-left p-2 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg flex items-center gap-2"
                                        >
                                          <Trash2 className="w-3 h-3" /> Delete
                                        </button>
                                      </motion.div>
                                    </>
                                  )}
                                </AnimatePresence>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    {filteredValues.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-12 text-center">
                          <PieChart className="w-12 h-12 text-gray-200 dark:text-white/10 mx-auto mb-4" />
                          <p className="text-gray-900 dark:text-gray-400 text-sm">No results found.</p>
                          <button 
                            onClick={() => {
                              setValueFormData({ id: '', description: '', sortOrder: (selectedAttr?.values?.length || 0) + 1 });
                              setIsEditingValue({ attrId: selectedAttrId!, valueId: null });
                            }}
                            className="mt-4 text-blue-600 dark:text-blue-400 text-xs font-bold hover:underline"
                          >
                            Add your first value
                          </button>
                        </td>
                      </tr>
                    )}
                  </table>
                </div>
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
                <p className="text-sm text-gray-900 dark:text-gray-400 max-w-xs">Choose one of the 10 static attributes from the left sidebar to manage its values.</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {isEditingValue && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100 dark:border-white/10 flex justify-between items-center">
                <h3 className="text-lg font-bold dark:text-white">
                  {isEditingValue.valueId ? 'Edit Value' : 'Add New Value'}
                </h3>
                <button onClick={() => setIsEditingValue(null)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1.5">Value ID</label>
                  <input 
                    type="text"
                    value={valueFormData.id}
                    onChange={e => setValueFormData(prev => ({ ...prev, id: e.target.value }))}
                    disabled={isEditingValue.valueId !== null}
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:text-white disabled:opacity-50"
                    placeholder="e.g. 01, CAT-A..."
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1.5">Description</label>
                  <input 
                    type="text"
                    value={valueFormData.description}
                    onChange={e => setValueFormData(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:text-white"
                    placeholder="Enter description..."
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1.5">Sort Order</label>
                  <input 
                    type="number"
                    value={valueFormData.sortOrder}
                    onChange={e => setValueFormData(prev => ({ ...prev, sortOrder: Number(e.target.value) }))}
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:text-white"
                  />
                </div>
              </div>
              <div className="p-6 bg-gray-50 dark:bg-white/5 flex justify-end gap-3">
                <button onClick={() => setIsEditingValue(null)} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white">Cancel</button>
                <button onClick={handleSaveValue} className="px-6 py-2 bg-black dark:bg-white text-white dark:text-black rounded-xl text-sm font-bold shadow-lg shadow-black/10">Save Value</button>
              </div>
            </motion.div>
          </div>
        )}

        {deleteConfirm && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl w-full max-w-md p-6"
            >
              <div className="w-12 h-12 bg-red-100 dark:bg-red-500/10 rounded-full flex items-center justify-center mb-4">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-bold dark:text-white mb-2">Confirm Delete</h3>
              <p className="text-sm text-gray-900 dark:text-gray-400 mb-6">
                Are you sure you want to delete {deleteConfirm.type === 'bulk-attr-value' ? `${deleteConfirm.count} selected values` : `this value`}? This action cannot be undone.
              </p>
              <div className="flex justify-end gap-3">
                <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white">Cancel</button>
                <button 
                  onClick={() => {
                    if (deleteConfirm.type === 'bulk-attr-value') bulkDeleteAttributeValues(selectedAttrId!);
                  }}
                  className="px-6 py-2 bg-red-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-red-600/20"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {showImportSuccessModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl w-full max-w-md p-6 text-center"
            >
              <div className="w-16 h-16 bg-green-100 dark:bg-green-500/10 rounded-full flex items-center justify-center mb-6 mx-auto">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-xl font-bold dark:text-white mb-2">Import Successful</h3>
              <p className="text-sm text-gray-900 dark:text-gray-400 mb-8">
                The attribute values have been imported and saved successfully.
              </p>
              <button 
                onClick={() => setShowImportSuccessModal(false)}
                className="w-full py-3 bg-black dark:bg-white text-white dark:text-black rounded-xl text-sm font-bold shadow-lg shadow-black/10"
              >
                Got it
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ProjectLineItemAttributes;
