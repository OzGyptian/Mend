import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, onSnapshot, doc, updateDoc, setDoc, addDoc } from 'firebase/firestore';
import { Sheet, Project, ForecastRow, Enterprise } from '../types';
import { RefreshCw, Settings, Save, Plus } from 'lucide-react';
import SheetSettings from './SheetSettings';
import AgGridSheet from './AgGridSheet';

interface ForecastGridProps {
  sheet: Sheet;
  project: Project;
  enterprise: Enterprise;
  theme: 'light' | 'dark';
}

export default function ForecastGrid({ sheet, project, enterprise, theme }: ForecastGridProps) {
  const [rows, setRows] = useState<ForecastRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<ForecastRow[] | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!sheet?.id) return;
    
    console.log('Subscribing to rows for sheet:', sheet.id);
    const q = query(collection(db, `sheets/${sheet.id}/rows`));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      console.log(`Received ${snapshot.size} rows for sheet: ${sheet.id}`);
      const r = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as ForecastRow));
      setRows(r);
      setLoading(false);
    }, (error) => {
      console.error("Rows fetch error:", error);
      setLoading(false);
      alert(`Error fetching rows: ${error.message}`);
    });
    return () => unsubscribe();
  }, [sheet.id]);

  const handleAddRow = async () => {
    if (!sheet?.id) {
      alert('Cannot add row: Sheet ID is missing.');
      return;
    }

    const newRow: Partial<ForecastRow> = {
      sheetId: sheet.id,
      costCode: 'NEW-ITEM',
      description: 'New Item Description',
      vendor: '',
      qty: 0,
      rate: 0,
      budget: 0,
      committedCost: 0,
      actualCostToDate: 0,
      costToGo: 0,
      eac: 0,
      timePhasing: {},
      distributionMethod: 'even'
    };
    
    try {
      console.log('Adding row to sheet:', sheet.id, newRow);
      const rowsCollection = collection(db, `sheets/${sheet.id}/rows`);
      await addDoc(rowsCollection, newRow);
      console.log('Row added successfully');
    } catch (error: any) {
      console.error('Failed to add row', error);
      alert(`Failed to add row: ${error.message}`);
    }
  };

  const handleSaveChanges = async () => {
    if (!pendingChanges) return;
    
    setSaving(true);
    try {
      for (const row of pendingChanges) {
        const rowRef = doc(db, `sheets/${sheet.id}/rows`, row.id);
        const { id, ...dataToUpdate } = row;
        await setDoc(rowRef, dataToUpdate, { merge: true });
      }
      setPendingChanges(null);
      alert('Changes saved successfully!');
    } catch (error) {
      console.error('Save failed', error);
      alert('Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col w-full h-full bg-white dark:bg-[#0A0A0A] transition-colors duration-300 overflow-hidden">
      <div className="p-4 bg-white dark:bg-[#141414] border-b border-gray-200 dark:border-white/10 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-6">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">Project Cutoff</span>
            <span className="text-xs font-mono font-bold text-red-600 dark:text-red-400">{project.cutoffDate || 'NOT SET'}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">Sheet Type</span>
            <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400 uppercase">{sheet.forecastMethod}</span>
          </div>
        </div>

        <div className="flex gap-3">
          <button 
            onClick={handleAddRow}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all text-sm font-bold shadow-lg shadow-blue-600/20"
          >
            <Plus className="w-4 h-4" />
            ADD ROW
          </button>

          <button 
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 px-4 py-2 hover:bg-gray-100 dark:hover:bg-white/5 text-gray-600 dark:text-gray-400 rounded-xl transition-all text-sm font-bold border border-gray-200 dark:border-white/10"
            title="Refresh Data"
          >
            <RefreshCw className="w-4 h-4" />
            REFRESH
          </button>
          
          <button 
            onClick={handleSaveChanges}
            disabled={saving || !pendingChanges}
            className={`flex items-center gap-2 px-6 py-2 rounded-xl transition-all text-sm font-bold shadow-lg ${
              pendingChanges 
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20 hover:scale-[1.02] active:scale-[0.98]' 
                : 'bg-gray-200 dark:bg-white/5 text-gray-400 cursor-not-allowed'
            }`}
          >
            <Save className={`w-4 h-4 ${saving ? 'animate-pulse' : ''}`} />
            {saving ? 'SAVING...' : 'SAVE CHANGES'}
          </button>
          
          <button 
            onClick={() => setShowSettings(true)}
            className="p-2.5 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-colors text-gray-500 border border-transparent hover:border-gray-200 dark:hover:border-white/10"
            title="Sheet Settings"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 w-full overflow-hidden">
        <AgGridSheet 
          sheetId={sheet.id}
          sheetType={sheet.forecastMethod}
          project={project}
          enterprise={enterprise}
          data={rows} 
          onDataChange={(newData) => setPendingChanges(newData)} 
          theme={theme}
        />
      </div>

      <div className="p-3 bg-white dark:bg-[#141414] border-t border-gray-200 dark:border-white/10 flex justify-between items-center shrink-0">
        <div className="flex gap-8">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">Total EAC</span>
            <span className="text-sm font-mono font-bold dark:text-white">${rows.reduce((acc, r) => {
              const eac = sheet.forecastMethod === 'commitment' ? (r.qty || 0) * (r.rate || 0) : (r.actualCostToDate || 0) + (r.costToGo || 0);
              return acc + eac;
            }, 0).toLocaleString()}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">Total ETC</span>
            <span className="text-sm font-mono font-bold text-blue-600 dark:text-blue-400">${rows.reduce((acc, r) => {
              const eac = sheet.forecastMethod === 'commitment' ? (r.qty || 0) * (r.rate || 0) : (r.actualCostToDate || 0) + (r.costToGo || 0);
              const etc = Math.max(0, eac - (r.actualCostToDate || 0));
              return acc + etc;
            }, 0).toLocaleString()}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-mono text-gray-400 uppercase tracking-widest">
          <RefreshCw className="w-3 h-3 animate-spin-slow" />
          Live Sync Active
        </div>
      </div>

      {showSettings && (
        <SheetSettings 
          sheet={sheet} 
          project={project} 
          onClose={() => setShowSettings(false)} 
        />
      )}
    </div>
  );
}
