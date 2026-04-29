import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, updateDoc, collection, query, where, onSnapshot } from 'firebase/firestore';
import { Project, Enterprise, Calendar as ProjectCalendar, ProcurementStepDefinition } from '../types';
import { Settings, Save, Calendar as CalendarIcon, Clock, Tag } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'motion/react';

interface ProcurementDefaultsProps {
  project: Project;
  enterprise: Enterprise;
}

export default function ProcurementDefaults({ project, enterprise }: ProcurementDefaultsProps) {
  const [calendars, setCalendars] = useState<ProjectCalendar[]>([]);
  const [steps, setSteps] = useState<ProcurementStepDefinition[]>([]);
  const [defaults, setDefaults] = useState(project.procurementDefaults || {
    calendarId: '',
    stepDurations: {},
    attributeValues: {}
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!project.id) return;
    
    const calQuery = query(collection(db, 'calendars'), where('projectId', '==', project.id));
    const unsubCal = onSnapshot(calQuery, (snapshot) => {
      setCalendars(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as ProjectCalendar)));
    });

    const stepQuery = query(collection(db, 'procurementStepDefinitions'), where('projectId', '==', project.id));
    const unsubSteps = onSnapshot(stepQuery, (snapshot) => {
      const sortedSteps = snapshot.docs
        .map(doc => ({ ...doc.data(), id: doc.id } as ProcurementStepDefinition))
        .sort((a, b) => a.order - b.order);
      setSteps(sortedSteps);
    });

    return () => {
      unsubCal();
      unsubSteps();
    };
  }, [project.id]);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await updateDoc(doc(db, 'projects', project.id), {
        procurementDefaults: defaults
      });
      toast.success('Procurement defaults updated');
    } catch (e) {
      console.error(e);
      toast.error('Failed to update defaults');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-8 max-w-4xl mx-auto space-y-8"
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight dark:text-white">Procurement Defaults</h2>
          <p className="text-sm text-gray-500 mt-1">Configure default values for new procurement packages.</p>
        </div>
        <button 
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 px-6 py-2.5 bg-black dark:bg-white text-white dark:text-black rounded-xl text-xs font-bold hover:bg-black/90 dark:hover:bg-white/90 transition-all shadow-lg disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {isSaving ? 'Saving...' : 'Save Defaults'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Core Defaults */}
        <section className="p-6 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl space-y-6">
          <div className="flex items-center gap-2 mb-2">
            <Settings className="w-4 h-4 text-blue-600" />
            <h3 className="font-bold dark:text-white">Core Defaults</h3>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 flex items-center gap-2">
                <CalendarIcon className="w-3 h-3" />
                Default Calendar
              </label>
              <select 
                value={defaults.calendarId || ''}
                onChange={e => setDefaults({ ...defaults, calendarId: e.target.value })}
                className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 dark:text-white"
              >
                <option value="">Select Calendar...</option>
                {calendars.map(cal => (
                  <option key={cal.id} value={cal.id}>{cal.name}</option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* Step Durations */}
        <section className="p-6 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl space-y-6">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-amber-600" />
            <h3 className="font-bold dark:text-white">Default Step Durations</h3>
          </div>

          <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {steps.length === 0 ? (
              <p className="text-xs text-gray-500 italic">No steps defined yet.</p>
            ) : (
              steps.map(step => (
                <div key={step.id} className="flex items-center justify-between gap-4 p-3 bg-gray-50 dark:bg-black/20 rounded-xl">
                  <span className="text-xs font-medium dark:text-gray-300 truncate">{step.name}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <input 
                      type="number"
                      min="0"
                      value={defaults.stepDurations?.[step.id] ?? 5}
                      onChange={e => setDefaults({
                        ...defaults,
                        stepDurations: {
                          ...defaults.stepDurations,
                          [step.id]: parseInt(e.target.value) || 0
                        }
                      })}
                      className="w-20 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg px-2 py-1.5 text-xs text-right outline-none focus:ring-1 focus:ring-blue-500 dark:text-white"
                    />
                    <span className="text-[10px] text-gray-500 font-bold uppercase">Days</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Default Attributes */}
        <section className="col-span-full p-6 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl space-y-6">
          <div className="flex items-center gap-2 mb-2">
            <Tag className="w-4 h-4 text-emerald-600" />
            <h3 className="font-bold dark:text-white">Default Attribute Assignments</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(project.procurementAttributes || []).filter(a => a.title).map(attr => (
              <div key={attr.id} className="space-y-1.5 p-4 bg-gray-50 dark:bg-black/20 rounded-xl">
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{attr.title}</label>
                <select 
                  value={defaults.attributeValues?.[attr.id] || ''}
                  onChange={e => setDefaults({
                    ...defaults,
                    attributeValues: {
                      ...defaults.attributeValues,
                      [attr.id]: e.target.value
                    }
                  })}
                  className="w-full bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-blue-500 dark:text-white"
                >
                  <option value="">Not Assigned</option>
                  {attr.values?.map(val => (
                    <option key={val.id} value={val.id}>{val.description}</option>
                  ))}
                </select>
              </div>
            ))}
            {(project.procurementAttributes || []).filter(a => a.title).length === 0 && (
              <p className="col-span-full text-xs text-gray-500 italic text-center p-8">No project attributes with titles defined yet.</p>
            )}
          </div>
        </section>
      </div>
    </motion.div>
  );
}
