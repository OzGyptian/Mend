import React, { useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Download, Upload, RefreshCw, Edit2, Trash2 } from 'lucide-react';
import { AgGridReact } from 'ag-grid-react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { useProjectRepo, useAuthRepo } from '../../../platform/firestore/hooks';
import DataGridModule from '../../DataGridModule';
import EnterpriseProcurementSteps from '../../EnterpriseProcurementSteps';
import type { Enterprise, Project } from '../../../types';
import type { ColDef, ColGroupDef } from 'ag-grid-community';

interface ProjectsTabProps {
  activeTab: string;
  enterprise: Enterprise;
  projects: Project[];
  projectColumnDefs: (ColDef | ColGroupDef)[];
  setDeleteConfirm: (confirm: {
    type:
      | 'user'
      | 'bulk-user'
      | 'project'
      | 'bulk-project'
      | 'bulk-attr-value'
      | 'rate'
      | 'bulk-rate'
      | 'costElement'
      | 'bulk-costElement'
      | 'vendor'
      | 'bulk-vendor';
    id?: string;
    name?: string;
    count?: number;
    onConfirm?: () => void;
  } | null) => void;
  setIsBulkUpdateModalOpen: (val: { type: 'rate' | 'project' | 'vendor'; count: number; selectedIds?: string[] } | null) => void;
  onImportPreview: (preview: { type: 'projects'; data: any[] }) => void;
}

export default function ProjectsTab({
  activeTab,
  enterprise,
  projects,
  projectColumnDefs,
  setDeleteConfirm,
  setIsBulkUpdateModalOpen,
  onImportPreview,
}: ProjectsTabProps) {
  const projectRepo = useProjectRepo();
  const authRepo = useAuthRepo();
  const projectsGridRef = useRef<AgGridReact>(null);

  // Local UI state
  const [projectSearch, setProjectSearch] = useState('');
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(new Set());
  const [isCreateProjectModalOpen, setIsCreateProjectModalOpen] = useState(false);
  const [newProjectData, setNewProjectData] = useState({ name: '', code: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditProjectDetailsOpen, setIsEditProjectDetailsOpen] = useState(false);
  const [projectToEdit, setProjectToEdit] = useState<Project | null>(null);
  const [editingProjectDetails, setEditingProjectDetails] = useState<Record<string, any>>({});
  const [isReplaceIdModalOpen, setIsReplaceIdModalOpen] = useState(false);
  const [projectToReplace, setProjectToReplace] = useState<Project | null>(null);
  const [newProjectCode, setNewProjectCode] = useState('');
  const [isReplacing, setIsReplacing] = useState(false);
  const [replaceError, setReplaceError] = useState('');
  const [projectSort] = useState<{
    field: 'dateCreated' | 'dateLastModified' | 'projectName' | 'projectCode';
    direction: 'asc' | 'desc';
  }>({ field: 'dateCreated', direction: 'desc' });

  const isNewProjectCodeDuplicate = useMemo(() => {
    if (!newProjectCode.trim()) return false;
    return projects.some(
      (p) => p.projectCode === newProjectCode.trim() && p.id !== projectToReplace?.id
    );
  }, [newProjectCode, projects, projectToReplace]);

  const sortedProjects = useMemo(() => {
    let result = [...projects].filter(
      (p) =>
        p.projectName.toLowerCase().includes(projectSearch.toLowerCase()) ||
        p.projectCode.toLowerCase().includes(projectSearch.toLowerCase())
    );
    return result.sort((a, b) => {
      const aVal = (a as any)[projectSort.field] || '';
      const bVal = (b as any)[projectSort.field] || '';
      if (projectSort.direction === 'asc') return aVal > bVal ? 1 : -1;
      return aVal < bVal ? 1 : -1;
    });
  }, [projects, projectSearch, projectSort]);

  const bulkDeleteProjects = async () => {
    const promises = Array.from(selectedProjectIds).map((id: string) => projectRepo.delete(id));
    await Promise.all(promises);
    setSelectedProjectIds(new Set());
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enterprise || !newProjectData.code.trim()) return;

    const codeExists = projects.some((p) => p.projectCode === newProjectData.code);
    if (codeExists) {
      toast.error('This Project Code already exists!');
      return;
    }

    try {
      setIsSubmitting(true);
      const now = new Date().toISOString();
      const finalName = newProjectData.name.trim() || 'Project Name';
      const user = authRepo.getCurrentUser();
      await projectRepo.create({
        enterpriseId: enterprise.id,
        projectName: finalName,
        projectCode: newProjectData.code,
        projectBudget: 0,
        startDate: now.split('T')[0],
        endDate: now.split('T')[0],
        cutoffDate: now.split('T')[0],
        users: { [user?.id || '']: 'Project Admin' },
        createdBy: user?.id || '',
        createdByEmail: user?.email || '',
        sheets: [],
        status: 'Active',
      } as any);
      setIsCreateProjectModalOpen(false);
      setNewProjectData({ name: '', code: '' });
    } catch (error) {
      console.error('Failed to create project', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReplaceProjectId = async () => {
    if (!projectToReplace || !newProjectCode.trim()) {
      setReplaceError('Please enter a new Project ID.');
      return;
    }
    if (newProjectCode.trim() === projectToReplace.projectCode) {
      setReplaceError('New ID must be different from current ID.');
      return;
    }

    setIsReplacing(true);
    setReplaceError('');

    try {
      if (
        projects.some(
          (p) => p.projectCode === newProjectCode.trim() && p.id !== projectToReplace?.id
        )
      ) {
        setReplaceError('This Project ID already exists in the enterprise.');
        setIsReplacing(false);
        return;
      }

      await projectRepo.update(projectToReplace.id, {
        projectCode: newProjectCode.trim(),
        dateLastModified: new Date().toISOString(),
      });

      setIsReplaceIdModalOpen(false);
      setNewProjectCode('');
      setProjectToReplace(null);
    } catch (error) {
      console.error('Replace ID failed', error);
      setReplaceError('Failed to replace Project ID.');
    } finally {
      setIsReplacing(false);
    }
  };

  const exportProjectImportTemplate = () => {
    const activeAttrs = (enterprise.projectAttributes || []).filter((attr) => attr.title);
    const data = projects.map((p) => {
      const row: any = {
        'Project ID': p.projectCode,
        'Project Name': p.projectName,
      };
      activeAttrs.forEach((attr) => {
        row[attr.title] = p.attributes?.[attr.id] || '';
      });
      return row;
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Import_Template');
    XLSX.writeFile(wb, 'Enterprise_Projects_Import_Template.xlsx');
    toast.success('Import template exported successfully.');
  };

  const handleBulkUpdateProjectsImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
        if (rows.length === 0) {
          toast.error('The file is empty.');
          return;
        }
        onImportPreview({ type: 'projects', data: rows });
      } catch (error) {
        console.error('Bulk update import error:', error);
        toast.error('Failed to process the import file.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  if (activeTab === 'procurementSteps') {
    return (
      <motion.div
        key="procurementSteps"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="flex-1 flex flex-col min-h-0"
      >
        <EnterpriseProcurementSteps enterpriseId={enterprise.id} />
      </motion.div>
    );
  }

  return (
    <>
      <motion.div
        key="projects"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="flex-1 flex flex-col min-h-0"
      >
        <DataGridModule
          title="Enterprise Projects"
          description="Manage projects and their settings within the enterprise."
          onAdd={() => setIsCreateProjectModalOpen(true)}
          gridRef={projectsGridRef}
          extraToolbarActions={
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={exportProjectImportTemplate}
                className="text-xs font-bold gap-2 px-3 h-9 dark:border-white/10 dark:text-white"
              >
                <Download className="w-4 h-4" /> Import Template
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = '.xlsx,.xls';
                  input.onchange = (e: any) => {
                    const file = e.target.files?.[0];
                    if (file) handleBulkUpdateProjectsImport(file);
                  };
                  input.click();
                }}
                className="text-xs font-bold gap-2 px-3 h-9 dark:border-white/10 dark:text-white"
              >
                <Upload className="w-4 h-4" /> Bulk Update (Import)
              </Button>
            </div>
          }
          searchPlaceholder="Search projects..."
          quickFilterText={projectSearch}
          onQuickFilterChange={setProjectSearch}
          rowData={sortedProjects}
          columnDefs={projectColumnDefs}
          theme={document.documentElement.classList.contains('dark') ? 'dark' : 'light'}
          onCellValueChanged={async (event) => {
            const { data, colDef, newValue } = event;
            if (!data.id) return;
            await projectRepo.update(data.id, {
              [colDef.field!]: newValue,
              dateLastModified: new Date().toISOString(),
            });
          }}
          gridProps={{
            rowSelection: 'multiple',
            onSelectionChanged: (params: any) => {
              const selectedNodes = params.api.getSelectedNodes();
              setSelectedProjectIds(new Set(selectedNodes.map((node: any) => node.data.id)));
            },
          }}
          selectedCount={selectedProjectIds.size}
          onBulkUpdate={() => {
            setIsBulkUpdateModalOpen({ type: 'project', count: selectedProjectIds.size, selectedIds: Array.from(selectedProjectIds) });
          }}
          onBulkDelete={() =>
            setDeleteConfirm({ type: 'bulk-project', count: selectedProjectIds.size, onConfirm: bulkDeleteProjects })
          }
        />
      </motion.div>

      {/* Create Project Modal */}
      <Dialog open={isCreateProjectModalOpen} onOpenChange={setIsCreateProjectModalOpen}>
        <DialogContent className="sm:max-w-[425px] dark:bg-[#141414] dark:border-white/10">
          <DialogHeader>
            <DialogTitle className="dark:text-white">Create New Project</DialogTitle>
            <DialogDescription className="dark:text-gray-400">
              Enter the details for the new enterprise project.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateProject}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <label htmlFor="code" className="text-sm font-medium dark:text-gray-300">
                  Project Code <span className="text-red-500">*</span>
                </label>
                <Input
                  id="code"
                  value={newProjectData.code}
                  onChange={(e) => setNewProjectData({ ...newProjectData, code: e.target.value })}
                  placeholder="e.g. PRJ-001"
                  className={cn(
                    'dark:bg-[#1a1a1a] dark:border-white/10 dark:text-white',
                    !isSubmitting &&
                      projects.some((p) => p.projectCode === newProjectData.code.trim()) &&
                      newProjectData.code.trim() !== '' &&
                      'border-red-500 focus-visible:ring-red-500'
                  )}
                  required
                />
                {!isSubmitting &&
                  projects.some((p) => p.projectCode === newProjectData.code.trim()) &&
                  newProjectData.code.trim() !== '' && (
                    <p className="text-[10px] text-red-500 font-bold uppercase tracking-widest">
                      This Project Code already exists and must be unique!
                    </p>
                  )}
              </div>
              <div className="grid gap-2">
                <label htmlFor="name" className="text-sm font-medium dark:text-gray-300">
                  Project Name <span className="text-red-500">*</span>
                </label>
                <Input
                  id="name"
                  value={newProjectData.name}
                  onChange={(e) => setNewProjectData({ ...newProjectData, name: e.target.value })}
                  placeholder="e.g. Hospital Expansion"
                  className="dark:bg-[#1a1a1a] dark:border-white/10 dark:text-white"
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateProjectModalOpen(false)}
                className="dark:border-white/10 dark:text-white"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  isSubmitting ||
                  (projects.some((p) => p.projectCode === newProjectData.code.trim()) &&
                    newProjectData.code.trim() !== '')
                }
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isSubmitting ? 'Creating...' : 'Create Project'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Project Details Dialog */}
      <Dialog open={isEditProjectDetailsOpen} onOpenChange={setIsEditProjectDetailsOpen}>
        <DialogContent className="sm:max-w-[500px] dark:bg-[#141414] dark:border-white/10 max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="dark:text-white flex items-center gap-2">
              <Edit2 className="w-4 h-4" />
              Edit Project Details
            </DialogTitle>
            <DialogDescription className="dark:text-gray-400">
              Update name and enterprise attributes for {projectToEdit?.projectCode}.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-1 py-4 space-y-6">
            <div className="grid gap-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                Project Name
              </label>
              <Input
                value={editingProjectDetails.projectName || ''}
                onChange={(e) =>
                  setEditingProjectDetails({ ...editingProjectDetails, projectName: e.target.value })
                }
                className="dark:bg-[#1a1a1a] dark:border-white/10 dark:text-white"
              />
            </div>

            <Separator className="dark:bg-white/10" />

            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-widest text-gray-900 dark:text-white">
                Enterprise Project Attributes
              </h4>
              <div className="grid grid-cols-1 gap-4">
                {(enterprise.projectAttributes || [])
                  .filter((attr) => attr.title)
                  .map((attr) => (
                    <div key={attr.id} className="grid gap-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                        {attr.title}
                      </label>
                      <select
                        value={editingProjectDetails.attributes?.[attr.id] || ''}
                        onChange={(e) =>
                          setEditingProjectDetails({
                            ...editingProjectDetails,
                            attributes: {
                              ...(editingProjectDetails.attributes || {}),
                              [attr.id]: e.target.value,
                            },
                          })
                        }
                        className="w-full p-2.5 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      >
                        <option value="">Select Value...</option>
                        {(attr.values || []).map((v) => (
                          <option key={v.id} value={v.description}>
                            {v.description}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
              </div>
            </div>
          </div>
          <DialogFooter className="pt-4 border-t border-gray-100 dark:border-white/10">
            <Button
              variant="outline"
              onClick={() => setIsEditProjectDetailsOpen(false)}
              className="dark:border-white/10 dark:text-white"
            >
              Cancel
            </Button>
            <Button
              disabled={isSubmitting}
              onClick={async () => {
                if (!projectToEdit) return;
                try {
                  setIsSubmitting(true);
                  const user = authRepo.getCurrentUser();
                  await projectRepo.update(projectToEdit.id, {
                    projectName: editingProjectDetails.projectName,
                    attributes: editingProjectDetails.attributes,
                    dateLastModified: new Date().toISOString(),
                    modifiedBy: user?.id || '',
                    modifiedByEmail: user?.email || '',
                  });
                  toast.success('Project details updated successfully');
                  setIsEditProjectDetailsOpen(false);
                } catch (error) {
                  console.error('Update failed', error);
                  toast.error('Failed to update project details');
                } finally {
                  setIsSubmitting(false);
                }
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Replace Project ID Modal */}
      <AnimatePresence>
        {isReplaceIdModalOpen && projectToReplace && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-[#1a1a1a] w-full max-w-md rounded-2xl shadow-2xl border border-gray-200 dark:border-white/10 overflow-hidden"
            >
              <div className="p-6 border-b border-gray-200 dark:border-white/10">
                <h3 className="text-xl font-bold dark:text-white flex items-center gap-2">
                  <RefreshCw className="w-5 h-5 text-blue-600" />
                  Replace Project ID
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  Updating identifier for{' '}
                  <span className="font-bold text-gray-900 dark:text-white">
                    {projectToReplace.projectName}
                  </span>
                  .
                </p>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">
                    Current ID
                  </label>
                  <div className="p-3 bg-gray-100 dark:bg-white/5 rounded-xl text-sm font-mono text-gray-500">
                    {projectToReplace.projectCode}
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">
                    New Project ID
                  </label>
                  <input
                    type="text"
                    value={newProjectCode}
                    onChange={(e) => setNewProjectCode(e.target.value.toUpperCase())}
                    placeholder="E.G. PRJ-2024-001"
                    className={cn(
                      'w-full p-3 bg-gray-50 dark:bg-white/5 border rounded-xl text-sm font-mono dark:text-white focus:ring-2 outline-none',
                      isNewProjectCodeDuplicate
                        ? 'border-red-500 focus:ring-red-500/20'
                        : 'border-gray-200 dark:border-white/10 focus:ring-blue-500'
                    )}
                    autoFocus
                  />
                  {isNewProjectCodeDuplicate && (
                    <p className="text-[10px] text-red-500 mt-1 font-bold uppercase tracking-widest">
                      This Project ID already exists!
                    </p>
                  )}
                </div>

                {replaceError && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/30 rounded-xl text-xs text-red-600 dark:text-red-400 font-medium">
                    {replaceError}
                  </div>
                )}
              </div>

              <div className="p-6 bg-gray-50 dark:bg-white/5 flex gap-3">
                <button
                  onClick={() => {
                    setIsReplaceIdModalOpen(false);
                    setNewProjectCode('');
                    setReplaceError('');
                    setProjectToReplace(null);
                  }}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
                >
                  CANCEL
                </button>
                <button
                  onClick={handleReplaceProjectId}
                  disabled={isReplacing || !newProjectCode.trim() || isNewProjectCodeDuplicate}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all"
                >
                  {isReplacing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      REPLACING...
                    </>
                  ) : (
                    'CONFIRM REPLACE'
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
