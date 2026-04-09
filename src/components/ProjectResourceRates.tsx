import React, { useState, useMemo, useRef } from 'react';
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { Project, ResourceRate, SavedView } from '../types';
import { Plus, Trash2, Search, X, Edit2, Download, Upload, Eye, Lock, Unlock, MoreVertical, Layout, Filter, DollarSign } from 'lucide-react';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';

const RESOURCE_CATEGORIES = ['Labour', 'Plant', 'Material', 'Subcontractor'];
const RESOURCE_UNITS = [
  'm', 'm2', 'm3', 'ton', 'kg', 'no', 'item', 'hour', 'week', 'month',
  'ft', 'ft2', 'ft3', 'lb', 'gal', 'yd', 'yd2', 'yd3', 'in', 'in2', 'in3'
];

interface ProjectResourceRatesProps {
  project: Project;
}

export default function ProjectResourceRates({ project }: ProjectResourceRatesProps) {
  const [resourceSearch, setResourceSearch] = useState('');
  const [selectedRateIds, setSelectedRateIds] = useState<Set<string>>(new Set());
  const [resourceSort, setResourceSort] = useState<{ field: string, direction: 'asc' | 'desc' }>({ field: 'id', direction: 'asc' });
  const [isEditingResource, setIsEditingResource] = useState<{ id: string | null } | null>(null);
  const [resourceFormData, setResourceFormData] = useState<ResourceRate>({ 
    id: '', 
    name: '', 
    unit: '', 
    rate: 0, 
    category: 'Labour',
    udf1: '',
    udf2: '',
    udf3: ''
  });
  const [visibleColumns, setVisibleColumns] = useState<string[]>(['id', 'name', 'category', 'unit', 'rate', 'udf1', 'udf2', 'udf3']);
  const [isColumnMenuOpen, setIsColumnMenuOpen] = useState(false);
  const [isFrozen, setIsFrozen] = useState(true);
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredResources = useMemo(() => {
    let result = (project.resourceRates || [])
      .filter(r => 
        r.name.toLowerCase().includes(resourceSearch.toLowerCase()) ||
        r.id.toLowerCase().includes(resourceSearch.toLowerCase()) ||
        (r.category || '').toLowerCase().includes(resourceSearch.toLowerCase())
      );

    Object.entries(columnFilters).forEach(([field, value]) => {
      if (value) {
        result = result.filter(r => String((r as any)[field] || '').toLowerCase().includes(value.toLowerCase()));
      }
    });

    return result.sort((a: any, b: any) => {
      const aVal = a[resourceSort.field];
      const bVal = b[resourceSort.field];
      if (resourceSort.direction === 'asc') return aVal > bVal ? 1 : -1;
      return aVal < bVal ? 1 : -1;
    });
  }, [project.resourceRates, resourceSearch, resourceSort, columnFilters]);

  const handleSaveResource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const currentRates = project.resourceRates || [];
      let newRates;
      if (isEditingResource?.id) {
        newRates = currentRates.map(r => r.id === isEditingResource.id ? resourceFormData : r);
      } else {
        if (currentRates.some(r => r.id === resourceFormData.id)) {
          alert('Resource ID already exists');
          setIsSubmitting(false);
          return;
        }
        newRates = [...currentRates, resourceFormData];
      }

      await updateDoc(doc(db, 'projects', project.id), { resourceRates: newRates });
      setIsEditingResource(null);
    } catch (error) {
      console.error('Failed to save resource', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteResources = async () => {
    if (selectedRateIds.size === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedRateIds.size} resource(s)?`)) return;

    try {
      const newRates = (project.resourceRates || []).filter(r => !selectedRateIds.has(r.id));
      await updateDoc(doc(db, 'projects', project.id), { resourceRates: newRates });
      setSelectedRateIds(new Set());
    } catch (error) {
      console.error('Failed to delete resources', error);
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
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

        const newRates = data.map(row => ({
          id: String(row.ID || row.id || ''),
          name: String(row.Name || row.name || ''),
          category: String(row.Category || row.category || 'Labour'),
          unit: String(row.Unit || row.unit || ''),
          rate: Number(row.Rate || row.rate || 0),
          udf1: String(row.UDF1 || row.udf1 || ''),
          udf2: String(row.UDF2 || row.udf2 || ''),
          udf3: String(row.UDF3 || row.udf3 || '')
        })).filter(r => r.id && r.name);

        await updateDoc(doc(db, 'projects', project.id), { resourceRates: [...(project.resourceRates || []), ...newRates] });
      } catch (error) {
        console.error('Import failed', error);
      }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-[#141414] rounded-2xl border border-gray-200 dark:border-white/10 overflow-hidden m-8">
      <div className="p-4 border-b border-gray-100 dark:border-white/10 flex justify-between items-center bg-gray-50/50 dark:bg-white/5">
        <div>
          <h3 className="text-lg font-bold dark:text-white">Project Resource Rates</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">Manage project-specific resources and their base rates.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text"
              placeholder="Search resources..."
              value={resourceSearch}
              onChange={e => setResourceSearch(e.target.value)}
              className="pl-10 pr-4 py-2 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-xl text-xs focus:outline-none dark:text-white w-64"
            />
          </div>
          <div className="flex gap-1 border-l border-gray-200 dark:border-white/10 pl-4">
            <input type="file" ref={fileInputRef} className="hidden" onChange={handleImport} />
            <button onClick={() => fileInputRef.current?.click()} className="p-2 text-gray-400 hover:text-black dark:hover:text-white transition-colors">
              <Upload className="w-4 h-4" />
            </button>
            <button onClick={() => {
              const ws = XLSX.utils.json_to_sheet(project.resourceRates || []);
              const wb = XLSX.utils.book_new();
              XLSX.utils.book_append_sheet(wb, ws, 'Resources');
              XLSX.writeFile(wb, 'Project_Resources.xlsx');
            }} className="p-2 text-gray-400 hover:text-black dark:hover:text-white transition-colors">
              <Download className="w-4 h-4" />
            </button>
            <button onClick={() => setColumnFilters({})} className="p-2 text-gray-400 hover:text-red-600 transition-colors">
              <Filter className="w-4 h-4" />
            </button>
            <button onClick={() => setIsFrozen(!isFrozen)} className={cn("p-2 transition-colors", isFrozen ? "text-blue-600" : "text-gray-400")}>
              {isFrozen ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
            </button>
            {selectedRateIds.size > 0 && (
              <button onClick={handleDeleteResources} className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold flex items-center gap-2">
                <Trash2 className="w-3.5 h-3.5" /> Delete ({selectedRateIds.size})
              </button>
            )}
            <button 
              onClick={() => {
                setResourceFormData({ id: '', name: '', unit: '', rate: 0, category: 'Labour', udf1: '', udf2: '', udf3: '' });
                setIsEditingResource({ id: null });
              }}
              className="flex items-center gap-2 bg-black dark:bg-white text-white dark:text-black px-4 py-2 rounded-lg text-sm font-medium"
            >
              <Plus className="w-4 h-4" /> Add Resource
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-black dark:bg-gray-100 sticky top-0 z-20">
            <tr className="border-b border-white/10 dark:border-black/10">
              <th className={cn("p-2 w-10", isFrozen && "sticky left-0 z-30 bg-black dark:bg-gray-100 border-r border-white/10 dark:border-black/10")}>
                <input 
                  type="checkbox" 
                  checked={filteredResources.length > 0 && filteredResources.every(r => selectedRateIds.has(r.id))}
                  onChange={e => {
                    if (e.target.checked) setSelectedRateIds(new Set(filteredResources.map(r => r.id)));
                    else setSelectedRateIds(new Set());
                  }}
                />
              </th>
              {visibleColumns.map(col => (
                <th 
                  key={col}
                  onClick={() => setResourceSort(prev => ({ field: col, direction: prev.field === col && prev.direction === 'asc' ? 'desc' : 'asc' }))}
                  className={cn(
                    "p-2 text-[10px] font-bold uppercase tracking-widest text-white dark:text-black cursor-pointer hover:text-gray-300 dark:hover:text-gray-600",
                    col === 'id' && isFrozen && "sticky left-10 z-30 bg-black dark:bg-gray-100 border-r border-white/10 dark:border-black/10"
                  )}
                >
                  {col.toUpperCase()} {resourceSort.field === col && (resourceSort.direction === 'asc' ? '↑' : '↓')}
                </th>
              ))}
              <th className="p-2 w-12 text-center sticky right-0 z-30 bg-black dark:bg-gray-100 border-l border-white/10 dark:border-black/10 text-white dark:text-black">...</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-white/5">
            {filteredResources.map(resource => (
              <tr key={resource.id} className={cn("hover:bg-gray-50 dark:hover:bg-white/5 transition-colors group", selectedRateIds.has(resource.id) && "bg-blue-50/50 dark:bg-blue-500/5")}>
                <td className={cn("p-2", isFrozen && "sticky left-0 z-10 bg-inherit border-r border-gray-200 dark:border-white/10")}>
                  <input 
                    type="checkbox"
                    checked={selectedRateIds.has(resource.id)}
                    onChange={() => {
                      const next = new Set(selectedRateIds);
                      if (next.has(resource.id)) next.delete(resource.id);
                      else next.add(resource.id);
                      setSelectedRateIds(next);
                    }}
                  />
                </td>
                {visibleColumns.map(col => (
                  <td 
                    key={col}
                    className={cn(
                      "p-2 text-xs dark:text-white",
                      col === 'id' && isFrozen && "sticky left-10 z-10 bg-inherit border-r border-gray-200 dark:border-white/10 font-mono",
                      col === 'rate' && "text-right font-medium"
                    )}
                  >
                    {col === 'rate' ? `$${resource.rate.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : (resource as any)[col]}
                  </td>
                ))}
                <td className="p-2 text-right sticky right-0 z-10 bg-inherit border-l border-gray-200 dark:border-white/10">
                  <button 
                    onClick={() => {
                      setResourceFormData(resource);
                      setIsEditingResource({ id: resource.id });
                    }}
                    className="p-1.5 text-gray-400 hover:text-black dark:hover:text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AnimatePresence>
        {isEditingResource && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-[#1a1a1a] rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-200 dark:border-white/10"
            >
              <div className="p-6 border-b border-gray-100 dark:border-white/10 flex justify-between items-center">
                <h3 className="text-xl font-bold dark:text-white">{isEditingResource.id ? 'Edit Resource' : 'Add New Resource'}</h3>
                <button onClick={() => setIsEditingResource(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full transition-colors">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
              <form onSubmit={handleSaveResource} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Resource ID</label>
                    <input 
                      required
                      disabled={!!isEditingResource.id}
                      value={resourceFormData.id}
                      onChange={e => setResourceFormData({ ...resourceFormData, id: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm outline-none focus:ring-2 focus:ring-black dark:focus:ring-white dark:text-white disabled:opacity-50"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Category</label>
                    <select 
                      value={resourceFormData.category}
                      onChange={e => setResourceFormData({ ...resourceFormData, category: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm outline-none focus:ring-2 focus:ring-black dark:focus:ring-white dark:text-white"
                    >
                      {RESOURCE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Resource Name</label>
                  <input 
                    required
                    value={resourceFormData.name}
                    onChange={e => setResourceFormData({ ...resourceFormData, name: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm outline-none focus:ring-2 focus:ring-black dark:focus:ring-white dark:text-white"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Unit</label>
                    <input 
                      type="text"
                      value={resourceFormData.unit}
                      onChange={e => setResourceFormData({ ...resourceFormData, unit: e.target.value })}
                      placeholder="e.g. HR, DAY, M2"
                      className="w-full px-4 py-2 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm outline-none focus:ring-2 focus:ring-black dark:focus:ring-white dark:text-white"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Base Rate ($)</label>
                    <input 
                      type="number"
                      step="0.01"
                      required
                      value={resourceFormData.rate}
                      onChange={e => setResourceFormData({ ...resourceFormData, rate: parseFloat(e.target.value) || 0 })}
                      className="w-full px-4 py-2 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm outline-none focus:ring-2 focus:ring-black dark:focus:ring-white dark:text-white"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  {['udf1', 'udf2', 'udf3'].map((field, i) => (
                    <div key={field} className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">UDF {i + 1}</label>
                      <input 
                        value={(resourceFormData as any)[field]}
                        onChange={e => setResourceFormData({ ...resourceFormData, [field]: e.target.value })}
                        className="w-full px-4 py-2 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm outline-none focus:ring-2 focus:ring-black dark:focus:ring-white dark:text-white"
                      />
                    </div>
                  ))}
                </div>
                <div className="pt-4 flex gap-3">
                  <button type="button" onClick={() => setIsEditingResource(null)} className="flex-1 px-6 py-2.5 border border-gray-200 dark:border-white/10 rounded-xl text-sm font-bold dark:text-white hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">Cancel</button>
                  <button type="submit" disabled={isSubmitting} className="flex-1 px-6 py-2.5 bg-black dark:bg-white text-white dark:text-black rounded-xl text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50">
                    {isSubmitting ? 'Saving...' : 'Save Resource'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
