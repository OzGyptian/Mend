import React, { useState } from 'react';
import { db } from '../firebase';
import { collection, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { Project, Enterprise, ProcurementStepDefinition } from '../types';
import { Plus, Trash2, CheckCircle2, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'motion/react';

interface ProcurementStepConfigProps {
  project: Project;
  enterprise: Enterprise;
  currentSteps: ProcurementStepDefinition[];
  enterpriseSteps: ProcurementStepDefinition[];
}

export default function ProcurementStepConfig({ project, enterprise, currentSteps, enterpriseSteps }: ProcurementStepConfigProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newStepName, setNewStepName] = useState('');

  const handleAddStep = async () => {
    if (!newStepName) return;
    try {
      await addDoc(collection(db, 'procurementStepDefinitions'), {
        projectId: project.id,
        name: newStepName,
        order: currentSteps.length + 1,
        isEnterpriseStandard: false,
        createdAt: serverTimestamp()
      });
      setNewStepName('');
      setIsAdding(false);
      toast.success('Procurement step added');
    } catch (e) {
      console.error(e);
      toast.error('Failed to add step');
    }
  };

  const handleImportEnterpriseStep = async (entStep: ProcurementStepDefinition) => {
    try {
      await addDoc(collection(db, 'procurementStepDefinitions'), {
        projectId: project.id,
        name: entStep.name,
        order: currentSteps.length + 1,
        isEnterpriseStandard: true,
        createdAt: serverTimestamp()
      });
      toast.success(`Imported standard step: ${entStep.name}`);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-8 max-w-5xl mx-auto space-y-12"
    >
      <section>
        <div className="flex justify-between items-end mb-6">
          <div>
            <h2 className="text-2xl font-bold tracking-tight dark:text-white">Defined Tracking Steps</h2>
            <p className="text-sm text-gray-500 mt-1">Configure the sequence of milestones to track for every package.</p>
          </div>
          <button 
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-2 px-6 py-2.5 bg-black dark:bg-white text-white dark:text-black rounded-xl text-xs font-bold hover:bg-black/90 dark:hover:bg-white/90 transition-all shadow-lg"
          >
            <Plus className="w-4 h-4" />
            Add Project Step
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {currentSteps.map((step, idx) => (
            <div key={step.id} className="p-6 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl shadow-sm hover:border-blue-500/50 transition-all group overflow-hidden relative">
              <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={async () => {
                   if(confirm('Delete step? Packages data for this step will be preserved but hidden.')) {
                     try {
                       await deleteDoc(doc(db, 'procurementStepDefinitions', step.id));
                       toast.success('Step deleted');
                     } catch (e) {
                       toast.error('Failed to delete step');
                     }
                   }
                }} className="p-2 text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-gray-50 dark:bg-white/5 rounded-xl flex items-center justify-center font-black text-xs text-gray-400">
                  {idx + 1}
                </div>
                <div>
                  <h4 className="font-bold dark:text-white text-sm">{step.name}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    {step.isEnterpriseStandard ? (
                      <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 bg-blue-50 dark:bg-blue-500/10 text-blue-600 rounded-full">Standard</span>
                    ) : (
                      <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 bg-gray-100 dark:bg-white/5 text-gray-500 rounded-full">Project Specific</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {isAdding && (
            <div className="p-6 border-2 border-dashed border-gray-200 dark:border-white/10 rounded-2xl flex flex-col gap-4">
              <input 
                autoFocus
                type="text" 
                placeholder="Step name (e.g., Tender Issued)" 
                className="w-full bg-transparent border-b border-gray-200 dark:border-white/10 pb-2 text-sm focus:outline-none focus:border-blue-500 dark:text-white"
                value={newStepName}
                onChange={e => setNewStepName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddStep()}
              />
              <div className="flex gap-2">
                <button onClick={handleAddStep} className="flex-1 bg-black dark:bg-white text-white dark:text-black py-2 rounded-lg text-xs font-bold">Add</button>
                <button onClick={() => setIsAdding(false)} className="px-4 py-2 bg-gray-100 dark:bg-white/5 text-gray-500 rounded-lg text-xs font-bold">Cancel</button>
              </div>
            </div>
          )}
        </div>
      </section>

      <section>
        <div className="mb-6">
          <h2 className="text-xl font-bold tracking-tight dark:text-white">Enterprise Standards</h2>
          <p className="text-xs text-gray-500 mt-1">Milestones recommended for all projects for unified reporting.</p>
        </div>

        <div className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden divide-y divide-gray-100 dark:divide-white/5">
          {enterpriseSteps.length === 0 ? (
            <div className="p-12 text-center text-gray-500 text-sm italic">
              No enterprise standards defined by admins.
            </div>
          ) : (
            enterpriseSteps.map(entStep => {
              const alreadyHas = currentSteps.some(s => s.name === entStep.name);
              return (
                <div key={entStep.id} className="p-4 flex items-center justify-between hover:bg-white dark:hover:bg-white/5 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
                      <CheckCircle2 className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold dark:text-white">{entStep.name}</h4>
                    </div>
                  </div>
                  {alreadyHas ? (
                    <div className="flex items-center gap-2 text-emerald-600 text-[10px] font-bold uppercase tracking-widest">
                      <Check className="w-3 h-3" />
                      Tracked
                    </div>
                  ) : (
                    <button 
                      onClick={() => handleImportEnterpriseStep(entStep)}
                      className="px-4 py-1.5 bg-white dark:bg-white/10 border border-gray-200 dark:border-white/10 rounded-lg text-[10px] font-bold hover:border-black transition-all"
                    >
                      Import Step
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </section>
    </motion.div>
  );
}
