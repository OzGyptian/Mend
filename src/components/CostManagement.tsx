import React, { useState } from 'react';
import { Project, Sheet } from '../types';
import { Settings, Hash, Database, Calendar, PieChart, CheckSquare, FileText, Filter, Lock, Unlock, Trash2, ChevronRight, ChevronLeft, Menu, Plus, Save } from 'lucide-react';
import ProjectCostElements from './ProjectCostElements';
import ProjectCostCodeAttributes from './ProjectCostCodeAttributes';
import CostReportingPeriod from './CostReportingPeriod';
import CostDashboard from './CostDashboard';
import CostTasks from './CostTasks';
import CostForecasting from './CostForecasting';

interface CostManagementProps {
  project: Project;
  sheets?: Sheet[];
  sheetStats?: Record<string, { eac: number, etc: number }>;
  onSelectSheet?: (sheet: Sheet) => void;
  onDeleteSheet?: (sheet: Sheet) => void;
  onCreateSheet?: () => void;
}

type CostTab = 'dashboard' | 'tasks' | 'forecasting' | 'costElements' | 'costCodeAttributes' | 'reportingPeriod';

const CostManagement: React.FC<CostManagementProps> = ({ 
  project, 
  sheets = [], 
  sheetStats = {}, 
  onSelectSheet, 
  onDeleteSheet,
  onCreateSheet
}) => {
  const [activeTab, setActiveTab] = useState<CostTab>('dashboard');
  const [expandedSections, setExpandedSections] = useState<string[]>(['overview', 'settings']);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => 
      prev.includes(sectionId) 
        ? prev.filter(id => id !== sectionId) 
        : [...prev, sectionId]
    );
  };

  const sections = [
    {
      id: 'overview',
      label: 'Overview',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: <PieChart className="w-4 h-4" /> },
        { id: 'tasks', label: 'Tasks', icon: <CheckSquare className="w-4 h-4" /> },
        { id: 'forecasting', label: 'Forecasting Sheets', icon: <FileText className="w-4 h-4" /> },
      ]
    },
    {
      id: 'settings',
      label: 'Cost Module Settings',
      items: [
        { id: 'costElements', label: 'Project Cost Elements', icon: <Hash className="w-4 h-4" /> },
        { id: 'costCodeAttributes', label: 'Cost Code Attributes', icon: <Database className="w-4 h-4" /> },
        { id: 'reportingPeriod', label: 'Cost Reporting Period', icon: <Calendar className="w-4 h-4" /> },
      ]
    }
  ];

  const isSettingsTab = ['costElements', 'costCodeAttributes', 'reportingPeriod'].includes(activeTab);

  return (
    <div className="flex h-full bg-gray-50 dark:bg-[#0a0a0a] transition-colors duration-300 overflow-hidden">
      {/* Sidebar Navigation */}
      <div className={`${isSidebarOpen ? 'w-72' : 'w-16'} bg-white dark:bg-[#141414] border-r border-gray-200 dark:border-white/10 flex flex-col shrink-0 transition-all duration-300`}>
        <div className="p-6 border-b border-gray-200 dark:border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-black dark:bg-white rounded-xl flex items-center justify-center shadow-lg shadow-black/10 dark:shadow-white/10">
              <Settings className="w-6 h-6 text-white dark:text-black" />
            </div>
            {isSidebarOpen && (
              <div className="min-w-0">
                <h2 className="text-sm font-bold dark:text-white truncate">Cost Management</h2>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Project Controls</p>
              </div>
            )}
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 space-y-2 custom-scrollbar">
          <div className="px-4 mb-4">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className={`w-full flex items-center ${isSidebarOpen ? 'justify-between' : 'justify-center'} p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors text-gray-500 dark:text-gray-400`}
            >
              {isSidebarOpen && <span className="text-xs font-medium">Collapse Menu</span>}
              {isSidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>

          {sections.map(section => (
            <div key={section.id} className="space-y-1">
              {isSidebarOpen && (
                <h3 className="px-5 text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-2">
                  {section.label}
                </h3>
              )}
              
              <div className="space-y-1 px-2">
                {section.items.map(item => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id as CostTab);
                      if (!isSidebarOpen) setIsSidebarOpen(true);
                    }}
                    title={!isSidebarOpen ? item.label : undefined}
                    className={`w-full flex items-center ${isSidebarOpen ? 'gap-3 px-4 mx-2 w-[calc(100%-16px)]' : 'justify-center px-0'} py-2.5 rounded-xl text-sm font-medium transition-all ${
                      activeTab === item.id 
                        ? 'bg-black dark:bg-white text-white dark:text-black shadow-lg shadow-black/10 dark:shadow-white/10' 
                        : 'text-gray-900 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-black dark:hover:text-white'
                    }`}
                  >
                    {item.icon}
                    {isSidebarOpen && item.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>

      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full flex flex-col">
          {activeTab === 'dashboard' && (
            <div className="flex-1 overflow-y-auto">
              <CostDashboard 
                project={project} 
                sheets={sheets} 
                sheetStats={sheetStats} 
              />
            </div>
          )}
          {activeTab === 'tasks' && (
            <div className="flex-1 overflow-y-auto p-8">
              <CostTasks 
                project={project} 
                sheets={sheets} 
              />
            </div>
          )}
          {activeTab === 'forecasting' && (
            <div className="flex-1 overflow-y-auto p-8">
              <CostForecasting 
                project={project} 
                sheets={sheets} 
                onAddSheet={() => onCreateSheet?.()} 
                onDeleteSheet={(id) => {
                  const sheet = sheets.find(s => s.id === id);
                  if (sheet) onDeleteSheet?.(sheet);
                }}
                onOpenSheet={(sheet) => onSelectSheet?.(sheet)}
                sheetStats={sheetStats}
              />
            </div>
          )}
          {activeTab === 'costElements' && <div className="flex-1 overflow-hidden"><ProjectCostElements project={project} /></div>}
          {activeTab === 'costCodeAttributes' && <div className="flex-1 overflow-hidden"><ProjectCostCodeAttributes project={project} /></div>}
          {activeTab === 'reportingPeriod' && <div className="flex-1 overflow-hidden"><CostReportingPeriod project={project} /></div>}
        </div>
      </div>
    </div>
  );
};

export default CostManagement;
