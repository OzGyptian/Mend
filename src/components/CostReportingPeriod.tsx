import React, { useState, useEffect } from 'react';
import { Project } from '../types';
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { Calendar, Save, Calculator, Trash2, Lock, Unlock, Plus } from 'lucide-react';
import { addMonths, addWeeks, subDays, format, parseISO } from 'date-fns';
import { toast } from 'sonner';

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
      let currentEndDate;
      if (duration === 'month') {
        currentEndDate = subDays(addMonths(currentStartDate, 1), 1);
      } else {
        currentEndDate = subDays(addWeeks(currentStartDate, 1), 1);
      }

      newPeriods.push({
        id: i.toString(),
        name: `Period ${i}`,
        startDate: format(currentStartDate, 'yyyy-MM-dd'),
        endDate: format(currentEndDate, 'yyyy-MM-dd'),
        status: 'open'
      });

      // Next period starts the day after current period ends
      if (duration === 'month') {
        currentStartDate = addMonths(currentStartDate, 1);
      } else {
        currentStartDate = addWeeks(currentStartDate, 1);
      }
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
    let currentStartDate = parseISO(lastPeriod.startDate);
    if (duration === 'month') {
      currentStartDate = addMonths(currentStartDate, 1);
    } else {
      currentStartDate = addWeeks(currentStartDate, 1);
    }

    let currentEndDate;
    if (duration === 'month') {
      currentEndDate = subDays(addMonths(currentStartDate, 1), 1);
    } else {
      currentEndDate = subDays(addWeeks(currentStartDate, 1), 1);
    }

    const nextId = (periods.length + 1).toString();
    const newPeriod: Period = {
      id: nextId,
      name: `Period ${nextId}`,
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
    const openPeriods = periods.filter(p => p.status === 'open');
    if (openPeriods.length === 0) {
      toast.error('No open periods to roll over.');
      return;
    }

    const firstOpenPeriod = openPeriods[0];
    const nextOpenPeriod = openPeriods[1];

    const newPeriods = periods.map(p => 
      p.id === firstOpenPeriod.id ? { ...p, status: 'closed' as const } : p
    );
    
    let newCurrentId = currentPeriodId;
    if (nextOpenPeriod) {
      newCurrentId = nextOpenPeriod.id;
    }

    setPeriods(newPeriods);
    setCurrentPeriodId(newCurrentId);
    await handleSave(newPeriods, baseDate, duration, numberOfPeriods, newCurrentId);

    if (nextOpenPeriod) {
      toast.success(`${firstOpenPeriod.name} closed. Current period is now ${nextOpenPeriod.name}.`);
    } else {
      toast.success(`${firstOpenPeriod.name} closed. No more open periods.`);
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

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-[#141414] overflow-hidden">
      <div className="p-6 border-b border-gray-100 dark:border-white/10 flex justify-between items-center bg-gray-50/50 dark:bg-white/5 shrink-0">
        <div>
          <h3 className="text-xl font-bold dark:text-white">Cost Reporting Period</h3>
          <p className="text-sm text-gray-900 dark:text-gray-400">Define the periodic reporting intervals for this project.</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={handleRollOver}
            disabled={periods.length === 0 || !periods.some(p => p.status === 'open')}
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20 disabled:opacity-50"
          >
            <Lock className="w-4 h-4" />
            Roll Over / Close Period
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Configuration Form */}
          <div className="bg-white dark:bg-[#1a1a1a] p-6 rounded-2xl border border-gray-200 dark:border-white/10 shadow-sm">
            <h4 className="text-sm font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-6">Period Configuration</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-900 dark:text-gray-400 mb-2">Base Date</label>
                <input 
                  type="date" 
                  value={baseDate}
                  onChange={e => {
                    setBaseDate(e.target.value);
                    handleSave(periods, e.target.value, duration, numberOfPeriods, currentPeriodId);
                  }}
                  className="w-full p-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-900 dark:text-gray-400 mb-2">Duration</label>
                <select 
                  value={duration}
                  onChange={e => {
                    const val = e.target.value as 'week' | 'month';
                    setDuration(val);
                    handleSave(periods, baseDate, val, numberOfPeriods, currentPeriodId);
                  }}
                  className="w-full p-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="month">Monthly</option>
                  <option value="week">Weekly</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-900 dark:text-gray-400 mb-2">Number of Periods</label>
                <input 
                  type="number" 
                  min="1"
                  max="120"
                  value={numberOfPeriods}
                  onChange={e => {
                    const val = Number(e.target.value);
                    setNumberOfPeriods(val);
                    handleSave(periods, baseDate, duration, val, currentPeriodId);
                  }}
                  className="w-full p-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
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
                className="flex items-center gap-2 bg-black dark:bg-white text-white dark:text-black px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-black/90 dark:hover:bg-white/90 transition-all shadow-lg shadow-black/10"
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
                  className="text-red-600 hover:text-red-700 text-sm font-medium flex items-center gap-1"
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
    </div>
  );
};

export default CostReportingPeriod;
