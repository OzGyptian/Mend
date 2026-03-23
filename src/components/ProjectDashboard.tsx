import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, getDocs, writeBatch, collectionGroup } from 'firebase/firestore';
import { Project, Sheet, Enterprise, ForecastRow } from '../types';
import { Plus, FileText, Calendar, Lock, Unlock, ChevronRight, Filter, Download, Trash2, AlertTriangle, X } from 'lucide-react';

interface ProjectDashboardProps {
  project: Project;
  enterprise: Enterprise;
  onSelectSheet: (sheet: Sheet) => void;
}

export default function ProjectDashboard({ project, enterprise, onSelectSheet }: ProjectDashboardProps) {
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [sheetStats, setSheetStats] = useState<Record<string, { eac: number, etc: number }>>({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newSheet, setNewSheet] = useState({ name: '', method: 'commitment' as const });
  const [sheetToDelete, setSheetToDelete] = useState<Sheet | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'sheets'), where('projectId', '==', project.id));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const s = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Sheet));
      setSheets(s);
      
      // Fetch stats for each sheet
      s.forEach(async (sheet) => {
        const rowsQuery = query(collection(db, `sheets/${sheet.id}/rows`));
        const rowsSnapshot = await getDocs(rowsQuery);
        const rows = rowsSnapshot.docs.map(doc => doc.data() as ForecastRow);
        
        let totalEac = 0;
        let totalEtc = 0;
        
        rows.forEach(r => {
          const eac = sheet.forecastMethod === 'commitment' 
            ? (r.qty || 0) * (r.rate || 0) 
            : (r.actualCostToDate || 0) + (r.costToGo || 0);
          const etc = Math.max(0, eac - (r.actualCostToDate || 0));
          
          totalEac += eac;
          totalEtc += etc;
        });
        
        setSheetStats(prev => ({
          ...prev,
          [sheet.id]: { eac: totalEac, etc: totalEtc }
        }));
      });
    });
    return () => unsubscribe();
  }, [project]);

  const handleCreateSheet = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'sheets'), {
        projectId: project.id,
        sheetName: newSheet.name,
        forecastMethod: newSheet.method,
        version: 'v1.0',
        lockedStatus: false,
        createdBy: 'System',
        createdAt: new Date().toISOString()
      });
      setIsModalOpen(false);
      setNewSheet({ name: '', method: 'commitment' });
    } catch (error) {
      console.error('Failed to create sheet', error);
    }
  };

  const handleDeleteSheet = async () => {
    if (!sheetToDelete) return;
    setIsDeleting(true);
    try {
      const batch = writeBatch(db);
      
      // 1. Find all rows for this sheet
      const rowsQuery = query(collection(db, `sheets/${sheetToDelete.id}/rows`));
      const rowsSnapshot = await getDocs(rowsQuery);
      rowsSnapshot.docs.forEach(rowDoc => {
        batch.delete(rowDoc.ref);
      });
      
      // 2. Delete the sheet
      batch.delete(doc(db, 'sheets', sheetToDelete.id));
      
      await batch.commit();
      setSheetToDelete(null);
    } catch (error) {
      console.error('Failed to delete sheet', error);
      alert('Failed to delete sheet. Check console for details.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col w-full h-full p-4 md:p-8 overflow-y-auto transition-colors duration-300">
      <div className="w-full max-w-[1600px] mx-auto flex-1 flex flex-col">
        <div className="flex justify-between items-start mb-10">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-gray-400 uppercase tracking-widest mb-2">
              <span>Project Dashboard</span>
              <ChevronRight className="w-3 h-3" />
              <span>{project.projectCode}</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight dark:text-white">{project.projectName}</h1>
          </div>
          <div className="flex gap-3">
            <button className="flex items-center gap-2 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-white/10 transition-all dark:text-white">
              <Download className="w-4 h-4" />
              Export Report
            </button>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 bg-black dark:bg-white text-white dark:text-black px-4 py-2 rounded-lg text-sm font-medium hover:bg-black/90 dark:hover:bg-white/90 transition-all shadow-lg shadow-black/10"
            >
              <Plus className="w-4 h-4" />
              New Sheet
            </button>
          </div>
        </div>

        <div className="flex-1 bg-white dark:bg-[#141414] rounded-2xl border border-gray-200 dark:border-white/10 shadow-sm overflow-hidden transition-colors flex flex-col">
          <div className="p-4 border-b border-gray-100 dark:border-white/5 flex justify-between items-center bg-gray-50/50 dark:bg-white/5">
            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400">Forecasting Sheets</h2>
            <div className="flex gap-2">
              <button className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-white dark:hover:bg-white/5 rounded transition-all">
                <Filter className="w-4 h-4" />
              </button>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-white/5">
            {sheets.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="w-12 h-12 text-gray-200 dark:text-white/10 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400 text-sm">No forecasting sheets found for this project.</p>
              <button 
                onClick={() => setIsModalOpen(true)}
                className="mt-4 text-blue-600 dark:text-blue-400 text-sm font-medium hover:underline"
              >
                Create your first sheet
              </button>
            </div>
          ) : (
            sheets.map((sheet) => (
              <div 
                key={sheet.id}
                onClick={() => onSelectSheet(sheet)}
                className="group flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-white/5 transition-all cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${sheet.forecastMethod === 'commitment' ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400' : 'bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400'}`}>
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{sheet.sheetName}</h3>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[10px] font-mono text-gray-400 uppercase tracking-widest bg-gray-100 dark:bg-white/5 px-1.5 py-0.5 rounded">
                        {sheet.forecastMethod}
                      </span>
                      <span className="text-[10px] font-mono text-gray-400 uppercase tracking-widest">
                        Version {sheet.version}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-8">
                  <div className="text-right hidden md:block">
                    <p className="text-[10px] font-mono text-gray-400 uppercase tracking-widest mb-1">
                      {sheet.forecastMethod === 'commitment' ? 'Total EAC' : 'Total ETC'}
                    </p>
                    <div className="text-xs font-bold dark:text-white">
                      ${(sheetStats[sheet.id]?.[sheet.forecastMethod === 'commitment' ? 'eac' : 'etc'] || 0).toLocaleString()}
                    </div>
                  </div>

                  <div className="text-right hidden sm:block">
                    <p className="text-[10px] font-mono text-gray-400 uppercase tracking-widest mb-1">Last Updated</p>
                    <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                      <Calendar className="w-3 h-3" />
                      {new Date(sheet.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    {sheet.lockedStatus ? (
                      <Lock className="w-4 h-4 text-gray-300 dark:text-white/20" />
                    ) : (
                      <Unlock className="w-4 h-4 text-emerald-400" />
                    )}
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setSheetToDelete(sheet);
                      }}
                      className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                      title="Delete Sheet"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <ChevronRight className="w-4 h-4 text-gray-300 dark:text-white/20 group-hover:text-gray-600 dark:group-hover:text-white transition-all" />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>

      {/* Delete Confirmation Modal */}
      {sheetToDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60]">
          <div className="bg-white dark:bg-[#141414] rounded-2xl p-8 w-full max-w-md shadow-2xl border dark:border-white/10">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <AlertTriangle className="w-6 h-6" />
              <h2 className="text-xl font-bold">Delete Sheet?</h2>
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
              Are you sure you want to delete <span className="font-bold text-gray-900 dark:text-white">"{sheetToDelete.sheetName}"</span>? 
              This action is permanent and will delete all associated forecast data.
            </p>
            <div className="flex gap-3">
              <button 
                disabled={isDeleting}
                onClick={() => setSheetToDelete(null)}
                className="flex-1 py-3 border border-gray-200 dark:border-white/10 rounded-xl text-sm font-medium hover:bg-gray-50 dark:hover:bg-white/5 transition-colors dark:text-white disabled:opacity-50"
              >
                Cancel
              </button>
              <button 
                disabled={isDeleting}
                onClick={handleDeleteSheet}
                className="flex-1 py-3 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-600/20 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Deleting...
                  </>
                ) : 'Delete Sheet'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white dark:bg-[#141414] rounded-2xl p-8 w-full max-w-md shadow-2xl border dark:border-white/10">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold dark:text-white">Create New Sheet</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateSheet} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">Sheet Name</label>
                <input 
                  required
                  type="text" 
                  value={newSheet.name}
                  onChange={e => setNewSheet({...newSheet, name: e.target.value})}
                  className="w-full p-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/5 dark:focus:ring-white/5 dark:text-white"
                  placeholder="e.g. Structural Steel Forecast"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">Forecast Method</label>
                <select 
                  value={newSheet.method}
                  onChange={e => setNewSheet({...newSheet, method: e.target.value as any})}
                  className="w-full p-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/5 dark:focus:ring-white/5 dark:text-white"
                >
                  <option value="commitment">Commitment Based (Subcontractors)</option>
                  <option value="time-based">Time-Based (Labour/Self-Perform)</option>
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 border border-gray-200 dark:border-white/10 rounded-xl text-sm font-medium hover:bg-gray-50 dark:hover:bg-white/5 transition-colors dark:text-white"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-3 bg-black dark:bg-white text-white dark:text-black rounded-xl text-sm font-medium hover:bg-black/90 dark:hover:bg-white/90 transition-colors"
                >
                  Create Sheet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
