import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { Project, Enterprise } from '../types';
import { Calendar, Users, Settings, Save, List, Layout, Database, ShieldCheck, Table } from 'lucide-react';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import AgGridMasterListEditor from './AgGridMasterListEditor';

interface ProjectAdminProps {
  project: Project;
  enterprise: Enterprise;
}

type AdminTab = 'general' | 'calendar' | 'masterLists' | 'access';

export default function ProjectAdmin({ project, enterprise }: ProjectAdminProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>('general');
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    projectName: project.projectName,
    projectCode: project.projectCode,
    projectBudget: project.projectBudget,
    startDate: project.startDate,
    endDate: project.endDate,
    cutoffDate: project.cutoffDate,
    categories: project.categories || [],
    controlAccounts: project.controlAccounts || [],
    orderNumbers: project.orderNumbers || []
  });

  // Sync formData if project prop changes (e.g. from another user's update)
  useEffect(() => {
    setFormData({
      projectName: project.projectName,
      projectCode: project.projectCode,
      projectBudget: project.projectBudget,
      startDate: project.startDate,
      endDate: project.endDate,
      cutoffDate: project.cutoffDate,
      categories: project.categories || [],
      controlAccounts: project.controlAccounts || [],
      orderNumbers: project.orderNumbers || []
    });
  }, [project]);

  const handleDateChange = (field: 'startDate' | 'endDate' | 'cutoffDate', value: string) => {
    if (!value) return;
    const date = parseISO(value);
    let adjustedValue = value;

    if (field === 'startDate') {
      adjustedValue = format(startOfMonth(date), 'yyyy-MM-dd');
    } else if (field === 'endDate' || field === 'cutoffDate') {
      adjustedValue = format(endOfMonth(date), 'yyyy-MM-dd');
    }

    setFormData(prev => ({ ...prev, [field]: adjustedValue }));
  };

  const handleSave = async () => {
    console.log('Attempting to save project settings...', formData);
    setSaving(true);
    try {
      if (!project.id) throw new Error('Project ID is missing');
      const projectRef = doc(db, 'projects', project.id);
      await updateDoc(projectRef, {
        ...formData,
        dateLastModified: new Date().toISOString()
      });
      console.log('Project settings updated successfully');
      alert('Project settings updated successfully');
    } catch (error) {
      console.error('Update failed', error);
      alert('Failed to update project settings. Check console for details.');
    } finally {
      setSaving(false);
    }
  };

  const toggleUser = async (uid: string) => {
    const newUsers = { ...project.users };
    if (newUsers[uid]) {
      delete newUsers[uid];
    } else {
      newUsers[uid] = 'Project User';
    }
    await updateDoc(doc(db, 'projects', project.id), { users: newUsers });
  };

  const tabs: { id: AdminTab; label: string; icon: any }[] = [
    { id: 'general', label: 'General Info', icon: Settings },
    { id: 'calendar', label: 'Calendar', icon: Calendar },
    { id: 'masterLists', label: 'Master Lists', icon: Table },
    { id: 'access', label: 'Access Control', icon: Users },
  ];

  return (
    <div className="flex h-full bg-gray-50 dark:bg-[#0a0a0a] transition-colors duration-300">
      {/* Sidebar Navigation */}
      <div className="w-64 bg-white dark:bg-[#141414] border-r border-gray-200 dark:border-white/10 flex flex-col shrink-0">
        <div className="p-6 border-b border-gray-200 dark:border-white/10">
          <h1 className="text-xl font-bold dark:text-white">Project Admin</h1>
          <p className="text-xs text-gray-500 mt-1">{project.projectName}</p>
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id 
                  ? 'bg-black dark:bg-white text-white dark:text-black shadow-lg' 
                  : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-gray-200 dark:border-white/10">
          <button 
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            <Save className={`w-4 h-4 ${saving ? 'animate-pulse' : ''}`} />
            {saving ? 'SAVING...' : 'SAVE CHANGES'}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-8 max-w-4xl mx-auto">
          {activeTab === 'general' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="bg-white dark:bg-[#141414] p-8 rounded-2xl border border-gray-200 dark:border-white/10 shadow-sm">
                <h2 className="text-lg font-bold mb-6 dark:text-white">General Information</h2>
                <div className="grid grid-cols-1 gap-6">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Project Name</label>
                    <input 
                      type="text" 
                      value={formData.projectName}
                      onChange={e => setFormData({...formData, projectName: e.target.value})}
                      className="w-full p-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Project Code</label>
                    <input 
                      type="text" 
                      value={formData.projectCode}
                      onChange={e => setFormData({...formData, projectCode: e.target.value})}
                      className="w-full p-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Total Budget ($)</label>
                    <input 
                      type="number" 
                      value={formData.projectBudget}
                      onChange={e => setFormData({...formData, projectBudget: Number(e.target.value)})}
                      className="w-full p-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'calendar' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="bg-white dark:bg-[#141414] p-8 rounded-2xl border border-gray-200 dark:border-white/10 shadow-sm">
                <h2 className="text-lg font-bold mb-6 dark:text-white">Project Calendar</h2>
                <div className="space-y-6">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Start Date (First of Month)</label>
                    <input 
                      type="date" 
                      value={formData.startDate}
                      onChange={e => handleDateChange('startDate', e.target.value)}
                      className="w-full p-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">End Date (End of Month)</label>
                    <input 
                      type="date" 
                      value={formData.endDate}
                      onChange={e => handleDateChange('endDate', e.target.value)}
                      className="w-full p-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div className="p-6 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-900/30">
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400 mb-2">Current Cutoff Date (Last Day of Month)</label>
                    <input 
                      required
                      type="date" 
                      value={formData.cutoffDate}
                      onChange={e => handleDateChange('cutoffDate', e.target.value)}
                      className="w-full p-3 bg-white dark:bg-white/5 border border-blue-200 dark:border-blue-900/30 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 dark:text-white outline-none"
                    />
                    <p className="text-xs text-blue-500 dark:text-blue-400 mt-3 italic">Phasing logic will start from the month following this date.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'masterLists' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="bg-white dark:bg-[#141414] p-8 rounded-2xl border border-gray-200 dark:border-white/10 shadow-sm flex flex-col">
                <div className="flex justify-between items-center mb-6 shrink-0">
                  <h2 className="text-lg font-bold dark:text-white">Master Lists</h2>
                  <p className="text-sm text-gray-400">Manage your project master lists separately.</p>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="h-[400px]">
                    <AgGridMasterListEditor 
                      items={formData.categories}
                      label="Categories"
                      onSave={(items) => setFormData(prev => ({ ...prev, categories: items }))}
                      theme={enterprise.theme || 'light'}
                    />
                  </div>
                  <div className="h-[400px]">
                    <AgGridMasterListEditor 
                      items={formData.controlAccounts}
                      label="Control Accounts"
                      onSave={(items) => setFormData(prev => ({ ...prev, controlAccounts: items }))}
                      theme={enterprise.theme || 'light'}
                    />
                  </div>
                  <div className="h-[400px]">
                    <AgGridMasterListEditor 
                      items={formData.orderNumbers}
                      label="Order Numbers"
                      onSave={(items) => setFormData(prev => ({ ...prev, orderNumbers: items }))}
                      theme={enterprise.theme || 'light'}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'access' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="bg-white dark:bg-[#141414] p-8 rounded-2xl border border-gray-200 dark:border-white/10 shadow-sm">
                <h2 className="text-lg font-bold mb-2 dark:text-white">Project Access</h2>
                <p className="text-sm text-gray-400 mb-6">Select users from the enterprise to grant project access.</p>
                <div className="space-y-2">
                  {Object.entries(enterprise.users || {}).map(([uid, data]) => (
                    <div key={uid} className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-white/5 rounded-xl transition-colors border border-transparent hover:border-gray-200 dark:hover:border-white/10">
                      <div className="flex items-center gap-4">
                        <input 
                          type="checkbox" 
                          checked={!!project.users[uid]}
                          onChange={() => toggleUser(uid)}
                          className="w-5 h-5 rounded border-gray-300 dark:border-white/10 text-blue-600 focus:ring-blue-500 bg-transparent"
                        />
                        <div>
                          <p className="text-sm font-bold dark:text-white">{data.email}</p>
                          <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">{data.role}</p>
                        </div>
                      </div>
                      {project.users[uid] && (
                        <select 
                          value={project.users[uid]}
                          onChange={async (e) => {
                            const newUsers = { ...project.users, [uid]: e.target.value as any };
                            await updateDoc(doc(db, 'projects', project.id), { users: newUsers });
                          }}
                          className="text-xs bg-gray-100 dark:bg-white/5 border-none rounded-lg px-3 py-1.5 font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="Project User">User</option>
                          <option value="Project Admin">Admin</option>
                        </select>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
