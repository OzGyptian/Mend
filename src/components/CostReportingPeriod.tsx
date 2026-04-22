import React, { useState, useEffect } from 'react';
import { Project, CostCode, EtcDetail } from '../types';
import { db, auth } from '../firebase';
import { 
  doc, 
  updateDoc, 
  collection, 
  query, 
  where, 
  getDocs, 
  writeBatch,
  addDoc
} from 'firebase/firestore';
import { Calendar, Save, Calculator, Trash2, Lock, Unlock, Plus, AlertTriangle, RefreshCw, Eye, FileText, Download } from 'lucide-react';
import { addMonths, addWeeks, subDays, format, parseISO } from 'date-fns';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import * as XLSX from 'xlsx';

interface CostReportingPeriodProps {
  project: Project;
}

interface Period {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: 'open' | 'closed';
}

const CostReportingPeriod: React.FC<CostReportingPeriodProps> = ({ project }) => {
  const [baseDate, setBaseDate] = useState(project.reportingPeriods?.baseDate || '');
  const [duration, setDuration] = useState<'week' | 'month'>(project.reportingPeriods?.duration || 'month');
  const [numberOfPeriods, setNumberOfPeriods] = useState<number>(project.reportingPeriods?.numberOfPeriods || 12);
  const [periods, setPeriods] = useState<Period[]>(project.reportingPeriods?.periods || []);
  const [currentPeriodId, setCurrentPeriodId] = useState<string | undefined>(project.reportingPeriods?.currentPeriodId);
  const [saving, setSaving] = useState(false);
  const [isRollOverConfirmOpen, setIsRollOverConfirmOpen] = useState(false);
  const [isRollingOver, setIsRollingOver] = useState(false);
  const [selectedSnapshot, setSelectedSnapshot] = useState<any>(null);
  const [isSnapshotViewerOpen, setIsSnapshotViewerOpen] = useState(false);
  const [isLoadingSnapshot, setIsLoadingSnapshot] = useState(false);

  const currentUser = auth.currentUser;
  const isAdmin = project.users[currentUser?.uid || ''] === 'Project Admin';
  const hasClosedPeriods = periods.some(p => p.status === 'closed');

  useEffect(() => {
    if (project.reportingPeriods) {
      setBaseDate(project.reportingPeriods.baseDate);
      setDuration(project.reportingPeriods.duration);
      setNumberOfPeriods(project.reportingPeriods.numberOfPeriods);
      setPeriods(project.reportingPeriods.periods.map((p: any) => ({
        ...p,
        status: p.status || 'open'
      })));
      setCurrentPeriodId(project.reportingPeriods.currentPeriodId);
    }
  }, [project.reportingPeriods]);

  const handleCalculate = async () => {
    if (!baseDate || numberOfPeriods <= 0) {
      toast.error('Please select a valid base date and number of periods.');
      return;
    }

    const newPeriods: Period[] = [];
    let currentStartDate = parseISO(baseDate);

    for (let i = 1; i <= numberOfPeriods; i++) {
      let currentEndDate = subDays(addMonths(currentStartDate, 1), 1);

      newPeriods.push({
        id: i.toString(),
        name: format(currentEndDate, "MMM''yy"),
        startDate: format(currentStartDate, 'yyyy-MM-dd'),
        endDate: format(currentEndDate, 'yyyy-MM-dd'),
        status: 'open'
      });

      // Next period starts the day after current period ends
      currentStartDate = addMonths(currentStartDate, 1);
    }

    const newCurrentId = newPeriods.length > 0 ? newPeriods[0].id : undefined;
    setPeriods(newPeriods);
    setCurrentPeriodId(newCurrentId);
    await handleSave(newPeriods, baseDate, duration, numberOfPeriods, newCurrentId);
    toast.success('Periods calculated and saved.');
  };

  const handleExtendPeriod = async () => {
    if (periods.length === 0) {
      handleCalculate();
      return;
    }

    const lastPeriod = periods[periods.length - 1];
    let currentStartDate = addMonths(parseISO(lastPeriod.startDate), 1);
    let currentEndDate = subDays(addMonths(currentStartDate, 1), 1);

    const nextId = (periods.length + 1).toString();
    const newPeriod: Period = {
      id: nextId,
      name: format(currentEndDate, "MMM''yy"),
      startDate: format(currentStartDate, 'yyyy-MM-dd'),
      endDate: format(currentEndDate, 'yyyy-MM-dd'),
      status: 'open'
    };

    const newPeriods = [...periods, newPeriod];
    const newNum = newPeriods.length;
    setPeriods(newPeriods);
    setNumberOfPeriods(newNum);
    await handleSave(newPeriods, baseDate, duration, newNum, currentPeriodId);
    toast.success('Period extended and saved.');
  };

  const handleDeleteLastPeriod = async () => {
    if (periods.length === 0) return;
    const lastPeriod = periods[periods.length - 1];
    if (lastPeriod.status === 'closed') {
      toast.error('Cannot delete a closed period.');
      return;
    }
    const newPeriods = periods.slice(0, -1);
    const newNum = newPeriods.length;
    let newCurrentId = currentPeriodId;
    if (currentPeriodId === lastPeriod.id) {
      newCurrentId = newPeriods.length > 0 ? newPeriods[newPeriods.length - 1].id : undefined;
    }
    
    setPeriods(newPeriods);
    setNumberOfPeriods(newNum);
    setCurrentPeriodId(newCurrentId);
    await handleSave(newPeriods, baseDate, duration, newNum, newCurrentId);
    toast.success('Last period deleted and changes saved.');
  };

  const handleRollOver = async () => {
    if (!isAdmin) {
      toast.error('Only Project Admins can roll over periods.');
      return;
    }

    const openPeriods = periods.filter(p => p.status === 'open');
    if (openPeriods.length === 0) {
      toast.error('No open periods to roll over.');
      return;
    }

    setIsRollingOver(true);
    try {
      const firstOpenPeriod = openPeriods[0];
      const nextOpenPeriod = openPeriods[1];

      // 1. Fetch all necessary data
      const costCodesSnap = await getDocs(query(collection(db, 'costCodes'), where('projectId', '==', project.id)));
      const etcDetailsSnap = await getDocs(query(collection(db, 'etcDetails'), where('projectId', '==', project.id)));
      const costPhasingSnap = await getDocs(query(collection(db, 'costPhasing'), where('projectId', '==', project.id)));
      const actualCostsSnap = await getDocs(query(collection(db, 'actualCosts'), where('projectId', '==', project.id)));

      const costCodes = costCodesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CostCode));
      const etcDetails = etcDetailsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as EtcDetail));
      const allPhasing = costPhasingSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      const allActuals = actualCostsSnap.docs.map(doc => doc.data() as any);

      const batch = writeBatch(db);
      let opCount = 0;

      // Helper to commit and start a new batch if limit reached
      const checkBatch = async () => {
        opCount++;
        if (opCount >= 450) {
          await batch.commit();
          opCount = 0;
        }
      };

      // 2. Update Cost Codes
      for (const code of costCodes) {
        const codeActuals = allActuals.filter(a => a.costCodeId === code.id || a.costCodeId === code.code);
        const codeAccruals = codeActuals.filter(a => a.reportingPeriodId === firstOpenPeriod.id && a.source === 'ACC');
        
        // New Actual Cost To Date = Current Total + Reversals (which are -1 * Accruals)
        const reversalSum = codeAccruals.reduce((sum, a) => sum + (Number(a.cost) || 0) * -1, 0);
        const newActualCostToDate = (code.actualCostToDate || 0) + reversalSum;
        
        // New Actual Cost This Period = Reversals (since next period is now current)
        const newActualCostThisPeriod = nextOpenPeriod ? reversalSum : 0;

        batch.update(doc(db, 'costCodes', code.id), {
          approvedBudgetPrevious: code.approvedBudget || 0,
          approvedBudgetMovement: 0,
          estimateAtCompletionPrevious: code.estimateAtCompletion || 0,
          estimateAtCompletionMovement: 0,
          actualCostToDate: newActualCostToDate,
          actualCostThisPeriod: newActualCostThisPeriod,
          updatedAt: new Date().toISOString()
        });
        await checkBatch();
      }

      // 3. Update ETC Details
      const futurePeriods = periods.slice(periods.findIndex(p => p.id === firstOpenPeriod.id) + 1);
      for (const etc of etcDetails) {
        const periodValues = etc.periodValues || {};
        const qty = futurePeriods.reduce((acc, p) => acc + (Number(periodValues[p.id]) || 0), 0);
        const totalEtc = qty * (etc.rate || 0);

        batch.update(doc(db, 'etcDetails', etc.id), {
          totalEtcPrevious: totalEtc,
          etcMvmt: 0,
          updatedAt: new Date().toISOString()
        });
        await checkBatch();
      }

      // 4. Store Previous EAC Phasing
      const currentPeriodIndex = periods.findIndex(p => p.id === firstOpenPeriod.id);
      for (const code of costCodes) {
        const codePhasing = allPhasing.filter((p: any) => p.costCodeId === code.code);
        const eacDoc = codePhasing.find((p: any) => p.type === 'eac');
        
        const filteredActuals = allActuals.filter((a: any) => a.costCodeId === code.id || a.costCodeId === code.code);
        const actualsByPeriod: Record<string, number> = {};
        filteredActuals.forEach((a: any) => {
          actualsByPeriod[a.reportingPeriodId] = (actualsByPeriod[a.reportingPeriodId] || 0) + (a.cost || 0);
        });

        const codeEtcDetails = etcDetails.filter((etc: any) => etc.costCode === code.code);
        const etcByPeriod: Record<string, number> = {};
        const futurePeriodIds = periods.slice(currentPeriodIndex + 1).map(p => p.id);
        codeEtcDetails.forEach((etc: any) => {
          if (etc.periodValues) {
            Object.entries(etc.periodValues).forEach(([periodId, value]) => {
              if (futurePeriodIds.includes(periodId)) {
                etcByPeriod[periodId] = (etcByPeriod[periodId] || 0) + (Number(value) || 0) * (etc.rate || 0);
              }
            });
          }
        });

        const currentEacPhasing = periods.reduce((acc, p, idx) => {
          const phasingSource = eacDoc?.phasingSource || 'ETC Details';
          if (phasingSource === 'ETC Details') {
            if (idx <= currentPeriodIndex) {
              acc[p.id] = actualsByPeriod[p.id] || 0;
            } else {
              acc[p.id] = etcByPeriod[p.id] || 0;
            }
          } else {
            acc[p.id] = eacDoc?.periodValues?.[p.id] || 0;
          }
          return acc;
        }, {} as Record<string, number>);

        // Store as eacPrevious
        const prevEacDoc = codePhasing.find((p: any) => p.type === 'eacPrevious');
        const payload = {
          projectId: project.id,
          costCodeId: code.code,
          type: 'eacPrevious',
          periodValues: currentEacPhasing,
          updatedAt: new Date().toISOString()
        };

        if (prevEacDoc) {
          batch.update(doc(db, 'costPhasing', prevEacDoc.id), payload);
        } else {
          batch.set(doc(collection(db, 'costPhasing')), payload);
        }
        await checkBatch();
      }

      // 5. Create Period Snapshot
      const snapshotData = {
        projectId: project.id,
        periodId: firstOpenPeriod.id,
        periodName: firstOpenPeriod.name,
        snapshotDate: new Date().toISOString(),
        costCodes: costCodes.map(c => ({ ...c })),
        etcDetails: etcDetails.map(e => ({ ...e })),
        costPhasing: allPhasing.map(p => ({ ...p })),
        actualCosts: allActuals.map(a => ({ ...a }))
      };

      // Check size roughly
      const dataStr = JSON.stringify(snapshotData);
      if (dataStr.length > 900000) {
        console.warn("Snapshot data is large, might exceed Firestore limit.");
      }

      batch.set(doc(collection(db, 'periodSnapshots')), snapshotData);
      await checkBatch();

      // 5.5 Reverse Accruals
      if (nextOpenPeriod) {
        const accruals = allActuals.filter((a: any) => 
          a.reportingPeriodId === firstOpenPeriod.id && 
          a.source === 'ACC'
        );

        for (const acc of accruals) {
          const reversal = {
            ...acc,
            cost: (acc.cost || 0) * -1,
            source: 'REV',
            reportingPeriodId: nextOpenPeriod.id,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          // Ensure we don't carry over the old document ID if it was in the data
          delete (reversal as any).id;
          
          batch.set(doc(collection(db, 'actualCosts')), reversal);
          await checkBatch();
        }
      }

      // 6. Update Reporting Periods
      const newPeriods = periods.map(p => 
        p.id === firstOpenPeriod.id ? { ...p, status: 'closed' as const } : p
      );
      
      let newCurrentId = currentPeriodId;
      if (nextOpenPeriod) {
        newCurrentId = nextOpenPeriod.id;
      }

      batch.update(doc(db, 'projects', project.id), {
        reportingPeriods: {
          baseDate,
          duration,
          numberOfPeriods,
          periods: newPeriods,
          currentPeriodId: newCurrentId
        }
      });
      await checkBatch();

      await batch.commit();

      setPeriods(newPeriods);
      setCurrentPeriodId(newCurrentId);

      if (nextOpenPeriod) {
        toast.success(`${firstOpenPeriod.name} closed. Current period is now ${nextOpenPeriod.name}.`);
      } else {
        toast.success(`${firstOpenPeriod.name} closed. No more open periods.`);
      }
      setIsRollOverConfirmOpen(false);
    } catch (error) {
      console.error('Error during roll over:', error);
      toast.error('Failed to roll over period. Please try again.');
    } finally {
      setIsRollingOver(false);
    }
  };

  const handleSave = async (
    updatedPeriods = periods,
    updatedBaseDate = baseDate,
    updatedDuration = duration,
    updatedNum = numberOfPeriods,
    updatedCurrent = currentPeriodId
  ) => {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'projects', project.id), {
        reportingPeriods: {
          baseDate: updatedBaseDate,
          duration: updatedDuration,
          numberOfPeriods: updatedNum,
          periods: updatedPeriods,
          currentPeriodId: updatedCurrent
        }
      });
    } catch (error) {
      console.error('Error saving reporting periods:', error);
      toast.error('Failed to save changes to database.');
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    if (periods.some(p => p.status === 'closed')) {
      toast.error('Cannot clear periods because some are already closed.');
      return;
    }
    setPeriods([]);
    setCurrentPeriodId(undefined);
    await handleSave([], baseDate, duration, numberOfPeriods, undefined);
    toast.info('All periods cleared and changes saved.');
  };

  const handleViewSnapshot = async (periodId: string) => {
    setIsLoadingSnapshot(true);
    try {
      const q = query(
        collection(db, 'periodSnapshots'), 
        where('projectId', '==', project.id),
        where('periodId', '==', periodId)
      );
      const snap = await getDocs(q);
      if (snap.empty) {
        toast.error('No snapshot found for this period.');
        setIsLoadingSnapshot(false);
        return;
      }
      setSelectedSnapshot(snap.docs[0].data());
      setIsSnapshotViewerOpen(true);
    } catch (error) {
      console.error("Error fetching snapshot:", error);
      toast.error('Failed to load snapshot.');
    } finally {
      setIsLoadingSnapshot(false);
    }
  };

  const exportSnapshotToExcel = () => {
    if (!selectedSnapshot) return;
    
    const wb = XLSX.utils.book_new();
    
    // Cost Codes
    const ccWs = XLSX.utils.json_to_sheet(selectedSnapshot.costCodes);
    XLSX.utils.book_append_sheet(wb, ccWs, "Cost Codes");
    
    // ETC Details
    const etcWs = XLSX.utils.json_to_sheet(selectedSnapshot.etcDetails);
    XLSX.utils.book_append_sheet(wb, etcWs, "ETC Details");
    
    XLSX.writeFile(wb, `Snapshot_${selectedSnapshot.periodName}_${format(new Date(), 'yyyyMMdd')}.xlsx`);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-[#141414] overflow-hidden">
      <div className="p-6 border-b border-gray-100 dark:border-white/10 flex justify-between items-center bg-gray-50/50 dark:bg-white/5 shrink-0">
        <div>
          <h3 className="text-xl font-bold dark:text-white">Cost Reporting Period</h3>
          <p className="text-sm text-gray-900 dark:text-gray-400">Define the periodic reporting intervals for this project.</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setIsRollOverConfirmOpen(true)}
            disabled={periods.length === 0 || !periods.some(p => p.status === 'open') || !isAdmin}
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20 disabled:opacity-50"
          >
            <Lock className="w-4 h-4" />
            Roll Over / Close Period
          </button>
        </div>
      </div>

      {/* Roll Over Confirmation Dialog */}
      <Dialog open={isRollOverConfirmOpen} onOpenChange={setIsRollOverConfirmOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="w-5 h-5" />
              Confirm Period Roll Over
            </DialogTitle>
            <DialogDescription className="py-4">
              Are you sure you want to close the current period? This action will:
              <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                <li>Close the current reporting period and move to the next.</li>
                <li>Archive current Budget and EAC values as "Previous".</li>
                <li>Store current ETC Details totals as "Previous".</li>
                <li>Snapshot the current EAC Phasing for historical comparison.</li>
              </ul>
              <p className="mt-4 font-bold text-red-600">This action cannot be undone.</p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRollOverConfirmOpen(false)} disabled={isRollingOver}>
              Cancel
            </Button>
            <Button 
              className="bg-emerald-600 hover:bg-emerald-700 text-white" 
              onClick={handleRollOver}
              disabled={isRollingOver}
            >
              {isRollingOver ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                'Yes, Roll Over Period'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Configuration Form */}
          <div className="bg-white dark:bg-[#1a1a1a] p-6 rounded-2xl border border-gray-200 dark:border-white/10 shadow-sm">
            <h4 className="text-sm font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-6">Period Configuration</h4>
            
            {hasClosedPeriods && (
              <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/30 rounded-xl flex gap-3">
                <Lock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-amber-700 dark:text-amber-400">Configuration Locked</p>
                  <p className="text-[10px] text-amber-600/80 dark:text-amber-400/60 leading-relaxed">
                    Reporting periods have been locked (closed). You can no longer change the base date, duration, or recalculate all periods. You can still extend the schedule or delete the last open period.
                  </p>
                </div>
              </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-900 dark:text-gray-400 mb-2">Base Date</label>
                <input 
                  type="date" 
                  value={baseDate}
                  disabled={hasClosedPeriods}
                  onChange={e => {
                    setBaseDate(e.target.value);
                    handleSave(periods, e.target.value, duration, numberOfPeriods, currentPeriodId);
                  }}
                  className="w-full p-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm dark:text-white focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-900 dark:text-gray-400 mb-2">Duration</label>
                <div className="w-full p-3 bg-gray-100 dark:bg-white/10 border border-gray-200 dark:border-white/10 rounded-xl text-sm dark:text-white opacity-70">
                  Monthly Only
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-900 dark:text-gray-400 mb-2">Number of Periods</label>
                <input 
                  type="number" 
                  min="1"
                  max="120"
                  value={numberOfPeriods}
                  disabled={hasClosedPeriods}
                  onChange={e => {
                    const val = Number(e.target.value);
                    setNumberOfPeriods(val);
                    handleSave(periods, baseDate, duration, val, currentPeriodId);
                  }}
                  className="w-full p-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm dark:text-white focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            <div className="flex justify-between items-center">
              <div className="flex gap-2">
                <button 
                  onClick={handleExtendPeriod}
                  className="flex items-center gap-2 bg-gray-100 dark:bg-white/5 text-gray-900 dark:text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-gray-200 dark:hover:bg-white/10 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  Extend Period
                </button>
                <button 
                  onClick={handleDeleteLastPeriod}
                  disabled={periods.length === 0}
                  className="flex items-center gap-2 bg-red-50 dark:bg-red-500/10 text-red-600 px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-red-100 dark:hover:bg-red-500/20 transition-all disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Last Period
                </button>
              </div>
              <button 
                onClick={handleCalculate}
                disabled={hasClosedPeriods}
                className="flex items-center gap-2 bg-black dark:bg-white text-white dark:text-black px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-black/90 dark:hover:bg-white/90 transition-all shadow-lg shadow-black/10 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Calculator className="w-4 h-4" />
                Calculate & Populate Periods
              </button>
            </div>
          </div>

          {/* Generated Periods Table */}
          {periods.length > 0 ? (
            <div className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-xl shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 flex justify-between items-center">
                <h4 className="font-bold dark:text-white">Generated Periods ({periods.length})</h4>
                <button 
                  onClick={handleClear}
                  disabled={hasClosedPeriods}
                  className="text-red-600 hover:text-red-700 text-sm font-medium flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Trash2 className="w-4 h-4" />
                  Clear All
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-white/5 border-b border-gray-200 dark:border-white/10">
                      <th className="p-3 text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 w-16">ID</th>
                      <th className="p-3 text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">Period Name</th>
                      <th className="p-3 text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">Start Date</th>
                      <th className="p-3 text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">End Date</th>
                      <th className="p-3 text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">Status</th>
                      <th className="p-3 text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">Snapshot</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                    {periods.map(period => (
                      <tr key={period.id} className="hover:bg-gray-50 dark:hover:bg-white/5">
                        <td className="p-3 text-sm font-mono dark:text-white">{period.id}</td>
                        <td className="p-3">
                          <input 
                            type="text" 
                            disabled={period.status === 'closed'}
                            value={period.name}
                            onChange={async (e) => {
                              const newName = e.target.value;
                              const newPeriods = periods.map(p => p.id === period.id ? { ...p, name: newName } : p);
                              setPeriods(newPeriods);
                              // We might want to debounce this, but for now simple auto-save
                              await handleSave(newPeriods, baseDate, duration, numberOfPeriods, currentPeriodId);
                            }}
                            className="w-full p-1.5 bg-transparent border border-transparent hover:border-gray-200 dark:hover:border-white/10 focus:border-blue-500 rounded text-sm outline-none dark:text-white transition-colors disabled:opacity-50"
                          />
                        </td>
                        <td className="p-3 text-sm dark:text-white">{period.startDate}</td>
                        <td className="p-3 text-sm dark:text-white">{period.endDate}</td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              period.status === 'closed' 
                                ? 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400' 
                                : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                            }`}>
                              {period.status === 'closed' ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                              {period.status}
                            </span>
                            {currentPeriodId === period.id && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 text-[10px] font-bold uppercase tracking-wider">
                                Current
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3">
                          {period.status === 'closed' && (
                            <button 
                              onClick={() => handleViewSnapshot(period.id)}
                              disabled={isLoadingSnapshot}
                              className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-xs font-bold flex items-center gap-1 transition-colors disabled:opacity-50"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              View Data
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-12 text-center bg-gray-50/50 dark:bg-white/5 rounded-2xl border border-dashed border-gray-200 dark:border-white/10">
              <Calendar className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-4" />
              <h3 className="text-lg font-bold dark:text-white mb-2">No Periods Generated</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">
                Configure the base date, duration, and number of periods above, then click "Calculate & Populate Periods" to generate the reporting schedule.
              </p>
            </div>
          )}
        </div>
      </div>
      <Dialog open={isSnapshotViewerOpen} onOpenChange={setIsSnapshotViewerOpen}>
        <DialogContent className="max-w-6xl h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-6 border-b border-gray-200 dark:border-white/10">
            <div className="flex items-center justify-between w-full pr-8">
              <div>
                <DialogTitle className="text-xl font-bold flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-600" />
                  Period Snapshot: {selectedSnapshot?.periodName}
                </DialogTitle>
                <DialogDescription>
                  Archived data from {selectedSnapshot && format(new Date(selectedSnapshot.snapshotDate), 'PPP p')}
                </DialogDescription>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={exportSnapshotToExcel}
                className="flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Export to Excel
              </Button>
            </div>
          </DialogHeader>
          
          <div className="flex-1 overflow-hidden">
            <Tabs defaultValue="costCodes" className="h-full flex flex-col">
              <div className="px-6 border-b border-gray-200 dark:border-white/10">
                <TabsList className="bg-transparent h-12 gap-6">
                  <TabsTrigger 
                    value="costCodes" 
                    className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none px-0 text-sm font-bold"
                  >
                    Cost Codes ({selectedSnapshot?.costCodes?.length || 0})
                  </TabsTrigger>
                  <TabsTrigger 
                    value="etcDetails" 
                    className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none px-0 text-sm font-bold"
                  >
                    ETC Details ({selectedSnapshot?.etcDetails?.length || 0})
                  </TabsTrigger>
                </TabsList>
              </div>

              <div className="flex-1 overflow-hidden">
                <TabsContent value="costCodes" className="h-full m-0">
                  <ScrollArea className="h-full">
                    <div className="p-6">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-gray-50 dark:bg-white/5 border-b border-gray-200 dark:border-white/10">
                            <th className="p-2 font-bold uppercase">Code</th>
                            <th className="p-2 font-bold uppercase">Name</th>
                            <th className="p-2 font-bold uppercase text-right">Baseline</th>
                            <th className="p-2 font-bold uppercase text-right">Approved</th>
                            <th className="p-2 font-bold uppercase text-right">Actuals</th>
                            <th className="p-2 font-bold uppercase text-right">ETC</th>
                            <th className="p-2 font-bold uppercase text-right">EAC</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                          {selectedSnapshot?.costCodes?.map((cc: any) => (
                            <tr key={cc.id} className="hover:bg-gray-50 dark:hover:bg-white/5">
                              <td className="p-2 font-mono">{cc.code}</td>
                              <td className="p-2">{cc.name}</td>
                              <td className="p-2 text-right">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cc.baselineBudget || 0)}</td>
                              <td className="p-2 text-right">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cc.approvedBudget || 0)}</td>
                              <td className="p-2 text-right">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cc.actualCostToDate || 0)}</td>
                              <td className="p-2 text-right">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cc.estimateToComplete || 0)}</td>
                              <td className="p-2 text-right font-bold">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cc.estimateAtCompletion || 0)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </ScrollArea>
                </TabsContent>
                
                <TabsContent value="etcDetails" className="h-full m-0">
                  <ScrollArea className="h-full">
                    <div className="p-6">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-gray-50 dark:bg-white/5 border-b border-gray-200 dark:border-white/10">
                            <th className="p-2 font-bold uppercase">Code</th>
                            <th className="p-2 font-bold uppercase">Item</th>
                            <th className="p-2 font-bold uppercase">Description</th>
                            <th className="p-2 font-bold uppercase text-right">Qty</th>
                            <th className="p-2 font-bold uppercase">Unit</th>
                            <th className="p-2 font-bold uppercase text-right">Rate</th>
                            <th className="p-2 font-bold uppercase text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                          {selectedSnapshot?.etcDetails?.map((etc: any) => (
                            <tr key={etc.id} className="hover:bg-gray-50 dark:hover:bg-white/5">
                              <td className="p-2 font-mono">{etc.costCode}</td>
                              <td className="p-2 font-bold">{etc.item}</td>
                              <td className="p-2">{etc.description}</td>
                              <td className="p-2 text-right">{etc.qty}</td>
                              <td className="p-2">{etc.unit}</td>
                              <td className="p-2 text-right">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(etc.rate || 0)}</td>
                              <td className="p-2 text-right font-bold">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((etc.qty || 0) * (etc.rate || 0))}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </ScrollArea>
                </TabsContent>
              </div>
            </Tabs>
          </div>
          
          <DialogFooter className="p-6 border-t border-gray-200 dark:border-white/10">
            <Button onClick={() => setIsSnapshotViewerOpen(false)}>Close Viewer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CostReportingPeriod;
