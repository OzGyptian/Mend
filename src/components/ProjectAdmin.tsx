import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { Project, Enterprise } from '../types';
import { 
  Calendar, 
  Users, 
  Settings, 
  Save, 
  Layout, 
  Database, 
  ShieldCheck, 
  Table, 
  ChevronDown, 
  ChevronRight,
  DollarSign,
  Clock,
  RefreshCw,
  PenTool,
  HardHat,
  ShoppingCart,
  Briefcase,
  FileText
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';

interface ProjectAdminProps {
  project: Project;
  enterprise: Enterprise;
}

type AdminTab = 
  | 'general' 
  | 'calendar' 
  | 'costMgmt' 
  | 'scheduleMgmt' 
  | 'changeMgmt' 
  | 'designMgmt' 
  | 'fieldMgmt' 
  | 'procurement' 
  | 'subContractMgmt' 
  | 'invoicing' 
  | 'access';

export default function ProjectAdmin({ project, enterprise }: ProjectAdminProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>('general');
  const [saving, setSaving] = useState(false);
  const [expandedSections, setExpandedSections] = useState<string[]>([]);
  
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

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => 
      prev.includes(sectionId) 
        ? prev.filter(id => id !== sectionId) 
        : [...prev, sectionId]
    );
  };

  const adminSections = [
    {
      id: 'general',
      label: 'General Admin',
      icon: <Settings className="w-4 h-4" />,
      items: [
        { id: 'general', label: 'General Info', icon: <Layout className="w-4 h-4" /> },
        { id: 'calendar', label: 'Project Calendar', icon: <Calendar className="w-4 h-4" /> },
        { id: 'access', label: 'Access Control', icon: <Users className="w-4 h-4" /> },
      ]
    },
    {
      id: 'cost',
      label: 'Cost Management',
      icon: <DollarSign className="w-4 h-4" />,
      items: [
        { id: 'costMgmt', label: 'Cost Settings', icon: <Database className="w-4 h-4" /> },
      ]
    },
    {
      id: 'schedule',
      label: 'Schedule Management',
      icon: <Clock className="w-4 h-4" />,
      items: [
        { id: 'scheduleMgmt', label: 'Schedule Settings', icon: <Calendar className="w-4 h-4" /> },
      ]
    },
    {
      id: 'change',
      label: 'Change Management',
      icon: <RefreshCw className="w-4 h-4" />,
      items: [
        { id: 'changeMgmt', label: 'Change Settings', icon: <RefreshCw className="w-4 h-4" /> },
      ]
    },
    {
      id: 'design',
      label: 'Design Management',
      icon: <PenTool className="w-4 h-4" />,
      items: [
        { id: 'designMgmt', label: 'Design Settings', icon: <PenTool className="w-4 h-4" /> },
      ]
    },
    {
      id: 'field',
      label: 'Field Management',
      icon: <HardHat className="w-4 h-4" />,
      items: [
        { id: 'fieldMgmt', label: 'Field Settings', icon: <HardHat className="w-4 h-4" /> },
      ]
    },
    {
      id: 'procurement',
      label: 'Procurement',
      icon: <ShoppingCart className="w-4 h-4" />,
      items: [
        { id: 'procurement', label: 'Procurement Settings', icon: <ShoppingCart className="w-4 h-4" /> },
      ]
    },
    {
      id: 'subcontract',
      label: 'Sub-Contract Management',
      icon: <Briefcase className="w-4 h-4" />,
      items: [
        { id: 'subContractMgmt', label: 'Sub-Contract Settings', icon: <Briefcase className="w-4 h-4" /> },
      ]
    },
    {
      id: 'invoicing',
      label: 'Invoicing',
      icon: <FileText className="w-4 h-4" />,
      items: [
        { id: 'invoicing', label: 'Invoicing Settings', icon: <FileText className="w-4 h-4" /> },
      ]
    }
  ];

  return (
    <div className="flex h-full bg-gray-50 dark:bg-[#0a0a0a] transition-colors duration-300">
      {/* Sidebar Navigation */}
      <div className="w-72 bg-white dark:bg-[#141414] border-r border-gray-200 dark:border-white/10 flex flex-col shrink-0">
        <div className="p-6 border-b border-gray-200 dark:border-white/10">
          <h1 className="text-xl font-bold dark:text-white">Project Admin</h1>
          <p className="text-xs text-gray-500 mt-1">{project.projectName}</p>
        </div>
        <div className="px-4 py-2 border-b border-gray-200 dark:border-white/10 flex gap-2">
          <button
            onClick={() => setExpandedSections(adminSections.map(s => s.id))}
            className="flex-1 px-2 py-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white bg-gray-100 dark:bg-white/5 rounded-lg transition-all"
          >
            Expand All
          </button>
          <button
            onClick={() => setExpandedSections([])}
            className="flex-1 px-2 py-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white bg-gray-100 dark:bg-white/5 rounded-lg transition-all"
          >
            Collapse All
          </button>
        </div>
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto custom-scrollbar">
          {adminSections.map(section => (
            <div key={section.id} className="space-y-1">
              <button
                onClick={() => toggleSection(section.id)}
                className="w-full flex items-center justify-between px-3 py-2 text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
              >
                <div className="flex items-center gap-2">
                  {section.icon}
                  {section.label}
                </div>
                {expandedSections.includes(section.id) ? (
                  <ChevronDown className="w-3 h-3" />
                ) : (
                  <ChevronRight className="w-3 h-3" />
                )}
              </button>
              
              {expandedSections.includes(section.id) && (
                <div className="space-y-1 ml-2 border-l border-gray-100 dark:border-white/5 pl-2">
                  {section.items.map(item => (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id as AdminTab)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                        activeTab === item.id 
                          ? 'bg-black dark:bg-white text-white dark:text-black shadow-lg shadow-black/10 dark:shadow-white/10' 
                          : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5'
                      }`}
                    >
                      {item.icon}
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
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

          {['costMgmt', 'scheduleMgmt', 'changeMgmt', 'designMgmt', 'fieldMgmt', 'procurement', 'subContractMgmt', 'invoicing'].includes(activeTab) && (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-white dark:bg-[#141414] border border-gray-200 dark:border-white/10 rounded-2xl">
              <div className="w-16 h-16 bg-gray-50 dark:bg-white/5 rounded-full flex items-center justify-center mb-6">
                <Settings className="w-8 h-8 text-gray-300" />
              </div>
              <h3 className="text-lg font-bold dark:text-white mb-2">Module Settings Under Development</h3>
              <p className="text-sm text-gray-500 max-w-xs">Project-specific settings for this module are currently being implemented.</p>
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
