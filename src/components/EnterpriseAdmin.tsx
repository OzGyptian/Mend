import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useEnterpriseRepo, useProjectRepo, useAuthRepo, useUtilityRepo } from '../platform/firestore/hooks';
import { Enterprise, Project, ProjectAttribute, SavedView } from '../types';
import {
  Users, Briefcase, Settings, X, ChevronRight, UserPlus, AlertTriangle,
  DollarSign, RefreshCw, Tag, Calendar, Menu, ChevronLeft, Building2,
  ShieldAlert, ShoppingCart, Activity, CheckCircle2,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { buildUserColumnDefs, buildProjectColumnDefs } from './enterprise-admin/columns';
import EnterpriseSettingsTab from './enterprise-admin/tabs/EnterpriseSettingsTab';
import UsersTab from './enterprise-admin/tabs/UsersTab';
import ProjectsTab from './enterprise-admin/tabs/ProjectsTab';
import LineItemAttributesTab from './enterprise-admin/tabs/LineItemAttributesTab';
import ResourceRatesTab from './enterprise-admin/tabs/ResourceRatesTab';
import VendorsTab from './enterprise-admin/tabs/VendorsTab';
import CostElementsTab from './enterprise-admin/tabs/CostElementsTab';
import CalendarManager from './CalendarManager';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DeleteConfirmType =
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

interface DeleteConfirmState {
  type: DeleteConfirmType;
  id?: string;
  name?: string;
  count?: number;
  onConfirm?: () => void;
}

interface BulkUpdateState {
  type: 'rate' | 'project' | 'vendor';
  count: number;
  selectedIds?: string[];
}

interface ImportPreviewState {
  type:
    | 'users'
    | 'projects'
    | 'lineItemAttributes'
    | 'costCodeAttributes'
    | 'projectAttributes'
    | 'resourceRates'
    | 'subcontractAttributes'
    | 'procurementAttributes'
    | 'changeAttributes'
    | 'riskAttributes'
    | 'progressAttributes'
    | 'vendors';
  data: any[];
  attrId?: string;
}

interface EnterpriseAdminProps {
  enterprise: Enterprise;
  setIsSidebarCollapsed?: (c: boolean) => void;
}

// ---------------------------------------------------------------------------
// Sidebar nav config
// ---------------------------------------------------------------------------

function buildAdminSections(enterprise: Enterprise) {
  return [
    {
      title: 'General',
      icon: <Settings className="w-4 h-4" />,
      items: [
        { id: 'enterpriseSettings', label: 'Enterprise Settings', icon: <Settings className="w-4 h-4" /> },
        { id: 'users', label: 'Enterprise Users', icon: <Users className="w-4 h-4" /> },
        { id: 'projects', label: 'Enterprise Projects', icon: <Briefcase className="w-4 h-4" /> },
        { id: 'projectAttributes', label: 'Enterprise Project Attributes', icon: <Settings className="w-4 h-4" /> },
        { id: 'lineItemAttributes', label: 'Enterprise Line-Item Attributes', icon: <Tag className="w-4 h-4" /> },
        { id: 'enterpriseCalendars', label: 'Enterprise Calendars', icon: <Calendar className="w-4 h-4" /> },
      ],
    },
    {
      title: 'Cost',
      icon: <DollarSign className="w-4 h-4" />,
      items: [
        { id: 'costCodeAttributes', label: 'Enterprise Cost Code Attributes', icon: <Tag className="w-4 h-4" /> },
        { id: 'resourceRates', label: 'Enterprise Resources Rates', icon: <DollarSign className="w-4 h-4" /> },
      ],
    },
    {
      title: 'Change',
      icon: <RefreshCw className="w-4 h-4" />,
      items: [
        { id: 'changeAttributes', label: 'Enterprise Change Attributes', icon: <Tag className="w-4 h-4" /> },
      ],
    },
    {
      title: 'Risk',
      icon: <ShieldAlert className="w-4 h-4" />,
      items: [
        { id: 'riskAttributes', label: 'Enterprise Risk Attributes', icon: <Tag className="w-4 h-4" /> },
      ],
    },
    {
      title: 'Sub-Contract',
      icon: <Briefcase className="w-4 h-4" />,
      items: [
        { id: 'subcontractAttributes', label: 'Enterprise Subcontract Attributes', icon: <Tag className="w-4 h-4" /> },
        { id: 'vendors', label: 'Enterprise Vendors', icon: <Building2 className="w-4 h-4" /> },
      ],
    },
    {
      title: 'Procurement',
      icon: <ShoppingCart className="w-4 h-4" />,
      items: [
        { id: 'procurementAttributes', label: 'Enterprise Procurement Attributes', icon: <Tag className="w-4 h-4" /> },
        { id: 'procurementSteps', label: 'Standard Procurement Steps', icon: <ShoppingCart className="w-4 h-4" /> },
      ],
    },
    {
      title: 'Progress',
      icon: <Activity className="w-4 h-4" />,
      items: [
        { id: 'progressAttributes', label: 'Enterprise Progress Attributes', icon: <Tag className="w-4 h-4" /> },
      ],
    },
  ];
}

function getAttributes(enterprise: Enterprise, type: 'project' | 'lineItem' | 'costCode' | 'subcontract' | 'procurement' | 'change' | 'risk' | 'progress'): ProjectAttribute[] {
  const field =
    type === 'project' ? 'projectAttributes'
    : type === 'costCode' ? 'costCodeAttributes'
    : type === 'subcontract' ? 'subcontractAttributes'
    : type === 'procurement' ? 'procurementAttributes'
    : type === 'change' ? 'changeAttributes'
    : type === 'risk' ? 'riskAttributes'
    : type === 'progress' ? 'progressAttributes'
    : 'lineItemAttributes';
  const attrs = (enterprise as any)[field] || [];
  if (attrs.length > 0 && typeof attrs[0] === 'string') {
    return Array.from({ length: 10 }, (_, i) => ({
      id: (i + 1).toString().padStart(2, '0'),
      title: attrs[i] || '',
      values: [],
    }));
  }
  const result = [...attrs];
  while (result.length < 10) {
    result.push({ id: (result.length + 1).toString().padStart(2, '0'), title: '', values: [] });
  }
  return result as ProjectAttribute[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function EnterpriseAdmin({ enterprise, setIsSidebarCollapsed }: EnterpriseAdminProps) {
  const enterpriseRepo = useEnterpriseRepo();
  const projectRepo = useProjectRepo();
  const authRepo = useAuthRepo();
  const utilityRepo = useUtilityRepo();

  // ------- Nav state (parent owns) -------
  const [activeTab, setActiveTab] = useState<string>('users');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['General', 'Cost', 'Change', 'Risk', 'Sub-Contract', 'Procurement', 'Progress', 'Schedule'])
  );

  const adminSections = useMemo(() => buildAdminSections(enterprise), [enterprise]);

  const toggleSection = (title: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(title)) {
      newExpanded.delete(title);
    } else {
      newExpanded.add(title);
    }
    setExpandedSections(newExpanded);
  };

  // ------- Subscriptions (parent owns — never move to tabs) -------
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    return projectRepo.subscribeByEnterprise(enterprise.id, '', setProjects);
  }, [enterprise.id]);

  // ------- Derived attribute arrays (read-only, passed as props) -------
  const projectAttributes = useMemo(() => getAttributes(enterprise, 'project'), [enterprise]);
  const lineItemAttributes = useMemo(() => getAttributes(enterprise, 'lineItem'), [enterprise]);
  const costCodeAttributes = useMemo(() => getAttributes(enterprise, 'costCode'), [enterprise]);
  const subcontractAttributes = useMemo(() => getAttributes(enterprise, 'subcontract'), [enterprise]);
  const procurementAttributes = useMemo(() => getAttributes(enterprise, 'procurement'), [enterprise]);
  const changeAttributes = useMemo(() => getAttributes(enterprise, 'change'), [enterprise]);
  const riskAttributes = useMemo(() => getAttributes(enterprise, 'risk'), [enterprise]);
  const progressAttributes = useMemo(() => getAttributes(enterprise, 'progress'), [enterprise]);

  // ------- Column defs (built once, passed to tabs that use AG Grid) -------
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const handleUpdateProjectStatus = useCallback(async (projectId: string, status: string) => {
    await projectRepo.update(projectId, { status: status as any });
  }, [projectRepo]);

  const userColumnDefs = useMemo(
    () =>
      buildUserColumnDefs({
        setContextMenu: () => {},
      }),
    []
  );

  const projectColumnDefs = useMemo(
    () =>
      buildProjectColumnDefs({
        selectedProjectId,
        activeMenuId,
        setActiveMenuId,
        projectAttributes,
        handleUpdateProjectStatus,
      }),
    [selectedProjectId, activeMenuId, projectAttributes, handleUpdateProjectStatus]
  );

  // ------- Orchestration-level modal state (lifted) -------
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmState | null>(null);
  const [isBulkUpdateModalOpen, setIsBulkUpdateModalOpen] = useState<BulkUpdateState | null>(null);
  const [bulkUpdateFormData, setBulkUpdateFormData] = useState<Record<string, any>>({});
  const [importPreview, setImportPreview] = useState<ImportPreviewState | null>(null);
  const [showImportSuccessModal, setShowImportSuccessModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ------- Side detail panel state (parent owns — spans Users + Projects tabs) -------
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const selectedUser = selectedUserId ? (enterprise.users || {})[selectedUserId] : null;
  const selectedProject = selectedProjectId ? projects.find((p) => p.id === selectedProjectId) : null;

  // Replace Project ID modal (triggered from side panel)
  const [isReplaceIdModalOpen, setIsReplaceIdModalOpen] = useState(false);
  const [projectToReplace, setProjectToReplace] = useState<Project | null>(null);
  const [newProjectCode, setNewProjectCode] = useState('');
  const [isReplacing, setIsReplacing] = useState(false);
  const [replaceError, setReplaceError] = useState('');

  const isNewProjectCodeDuplicate = useMemo(() => {
    if (!newProjectCode.trim()) return false;
    return projects.some(
      (p) => p.projectCode === newProjectCode.trim() && p.id !== projectToReplace?.id
    );
  }, [newProjectCode, projects, projectToReplace]);

  // ------- Handlers that stay in parent (used by side panel or import modal) -------

  const deleteUser = async (uid: string) => {
    const newUsers = { ...enterprise.users };
    delete newUsers[uid];
    await enterpriseRepo.update(enterprise.id, { users: newUsers });
    setDeleteConfirm(null);
    if (selectedUserId === uid) setSelectedUserId(null);
  };

  const deleteProject = async (projectId: string) => {
    await projectRepo.delete(projectId);
    setDeleteConfirm(null);
    if (selectedProjectId === projectId) setSelectedProjectId(null);
  };

  const toggleProjectAccess = async (projectId: string, uid: string, currentRole?: string) => {
    const project = projects.find((p) => p.id === projectId);
    if (!project) return;
    const newUsers = { ...project.users };
    if (currentRole) {
      delete newUsers[uid];
    } else {
      newUsers[uid] = 'Project User';
    }
    await projectRepo.update(projectId, { users: newUsers, dateLastModified: new Date().toISOString() });
  };

  const updateProjectRole = async (
    projectId: string,
    uid: string,
    role: 'Project Admin' | 'Project User'
  ) => {
    await projectRepo.update(projectId, {
      [`users.${uid}`]: role,
      dateLastModified: new Date().toISOString(),
    });
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
      if (projects.some((p) => p.projectCode === newProjectCode.trim() && p.id !== projectToReplace?.id)) {
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

  // ------- Bulk update handler (reads selectedIds from modal state) -------

  const handleBulkUpdate = async () => {
    if (!isBulkUpdateModalOpen) return;
    try {
      setIsSubmitting(true);
      const { type, selectedIds = [] } = isBulkUpdateModalOpen;

      if (type === 'rate') {
        const currentResources = enterprise.resourceRates || [];
        const idSet = new Set(selectedIds);
        const newResources = currentResources.map((r) =>
          idSet.has(r.id) ? { ...r, ...bulkUpdateFormData } : r
        );
        await enterpriseRepo.update(enterprise.id, { resourceRates: newResources });
      } else if (type === 'project') {
        await Promise.all(selectedIds.map((id) => projectRepo.update(id, { ...bulkUpdateFormData })));
      } else if (type === 'vendor') {
        const currentVendors = enterprise.vendors || [];
        const idSet = new Set(selectedIds);
        const newVendors = currentVendors.map((v) =>
          idSet.has(v.id) ? { ...v, ...bulkUpdateFormData } : v
        );
        await enterpriseRepo.update(enterprise.id, { vendors: newVendors });
      }

      toast.success(`Bulk update successful for ${isBulkUpdateModalOpen.count} items.`);
      setIsBulkUpdateModalOpen(null);
      setBulkUpdateFormData({});
    } catch (error) {
      console.error('Bulk update error:', error);
      toast.error('Failed to perform bulk update.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ------- Import preview handler (tabs call onImportPreview to set state here) -------

  const handleImportPreview = useCallback(
    (preview: { type: ImportPreviewState['type']; data: any[]; attrId?: string }) => {
      setImportPreview(preview);
    },
    []
  );

  // Import attribute values from LineItemAttributesTab
  const handleAttrImportRequest = useCallback(
    (
      type:
        | 'lineItemAttributes'
        | 'costCodeAttributes'
        | 'projectAttributes'
        | 'subcontractAttributes'
        | 'procurementAttributes'
        | 'changeAttributes'
        | 'riskAttributes'
        | 'progressAttributes',
      file: File,
      attrId: string
    ) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        setImportPreview({ type, data: jsonData, attrId });
      };
      reader.readAsArrayBuffer(file);
    },
    []
  );

  const completeImport = async () => {
    if (!importPreview) return;
    const { type, data, attrId } = importPreview;

    const attrImportTypes = [
      'lineItemAttributes',
      'costCodeAttributes',
      'projectAttributes',
      'subcontractAttributes',
      'procurementAttributes',
      'changeAttributes',
      'riskAttributes',
      'progressAttributes',
    ] as const;

    if ((attrImportTypes as readonly string[]).includes(type) && attrId) {
      const attrType =
        type === 'projectAttributes' ? 'project'
        : type === 'costCodeAttributes' ? 'costCode'
        : type === 'subcontractAttributes' ? 'subcontract'
        : type === 'procurementAttributes' ? 'procurement'
        : type === 'changeAttributes' ? 'change'
        : type === 'riskAttributes' ? 'risk'
        : type === 'progressAttributes' ? 'progress'
        : 'lineItem';

      const currentAttrs = getAttributes(enterprise, attrType as any);
      const newAttrs = currentAttrs.map((a) => {
        if (a.id === attrId) {
          const values = [...(a.values || [])];
          data.forEach((row) => {
            const id = row.ID?.toString() || row.id?.toString();
            const description = row.Description?.toString() || row.description?.toString() || '';
            const sortOrder = parseInt(row['Sort Order'] || row.sortOrder) || values.length + 1;
            if (!id) return;
            const existingIndex = values.findIndex((v) => v.id === id);
            if (existingIndex > -1) {
              values[existingIndex] = { ...values[existingIndex], description, sortOrder };
            } else {
              values.push({ id, description, sortOrder });
            }
          });
          return { ...a, values };
        }
        return a;
      });
      await enterpriseRepo.update(enterprise.id, { [type]: newAttrs });
    } else if (type === 'resourceRates') {
      const currentResources = [...(enterprise.resourceRates || [])];
      data.forEach((row) => {
        const id = row.ID?.toString() || row.id?.toString();
        const name = row.Name?.toString() || row.name?.toString() || '';
        const category = row.Category?.toString() || row.category?.toString() || '';
        const unit = row.Unit?.toString() || row.unit?.toString() || '';
        const rate = parseFloat(row.Rate || row.rate) || 0;
        if (!id) return;
        const existingIndex = currentResources.findIndex((r) => r.id === id);
        if (existingIndex > -1) {
          currentResources[existingIndex] = { ...currentResources[existingIndex], name, category, unit, rate };
        } else {
          currentResources.push({ id, name, category, unit, rate });
        }
      });
      await enterpriseRepo.update(enterprise.id, { resourceRates: currentResources });
    } else if (type === 'projects') {
      const activeAttrs = (enterprise.projectAttributes || []).filter((attr) => attr.title);
      const importProjUpdates: Array<{ id: string; data: any }> = [];
      const importProjCreates: any[] = [];
      for (const row of data) {
        const code =
          row.Code?.toString() ||
          row.code?.toString() ||
          row.ProjectCode?.toString() ||
          row.projectCode?.toString() ||
          row['Project ID']?.toString();
        const name =
          row.Name?.toString() ||
          row.name?.toString() ||
          row.ProjectName?.toString() ||
          row.projectName?.toString() ||
          row['Project Name']?.toString() ||
          '';
        if (!code) continue;
        const existingProject = projects.find((p) => p.projectCode === code);
        const newAttributes: any = existingProject?.attributes ? { ...existingProject.attributes } : {};
        activeAttrs.forEach((attr) => {
          if (row[attr.title] !== undefined) newAttributes[attr.id] = row[attr.title].toString();
        });
        if (existingProject) {
          importProjUpdates.push({
            id: existingProject.id,
            data: { ...(name ? { projectName: name } : {}), attributes: newAttributes },
          });
        } else {
          importProjCreates.push({
            enterpriseId: enterprise.id,
            projectCode: code,
            projectName: name,
            attributes: newAttributes,
            users: { [authRepo.getCurrentUser()?.id || '']: 'Project Admin' },
            sheets: [],
          });
        }
      }
      await Promise.all([
        ...importProjUpdates.map((u) => projectRepo.update(u.id, u.data)),
        ...importProjCreates.map((c) => projectRepo.create(c as any)),
      ]);
    } else if (type === 'vendors') {
      const currentVendors = [...(enterprise.vendors || [])];
      data.forEach((row) => {
        const id = (row['Vendor ID'] || row.id || row.ID || row.Code || row.code)?.toString();
        const name = (row['Vendor Name'] || row.name || row.Name)?.toString() || '';
        const contactName = (row['Contact Name'] || row.contactName || '')?.toString();
        const contactEmail = (row['Contact Email'] || row.contactEmail || '')?.toString();
        if (!id) return;
        const existingIndex = currentVendors.findIndex((v) => v.id === id);
        if (existingIndex > -1) {
          currentVendors[existingIndex] = { ...currentVendors[existingIndex], id, name, contactName, contactEmail };
        } else {
          currentVendors.push({ id, name, contactName, contactEmail });
        }
      });
      await enterpriseRepo.update(enterprise.id, { vendors: currentVendors });
    }

    setImportPreview(null);
    setShowImportSuccessModal(true);
  };

  // ------- Duplicate detection for import preview -------

  const { duplicateIds, hasImportDuplicates, systemDuplicateIds } = useMemo(() => {
    if (!importPreview) return { duplicateIds: [], hasImportDuplicates: false, systemDuplicateIds: [] };
    const idsInFile = new Set<string>();
    const fileDuplicates = new Set<string>();
    const sysDuplicates = new Set<string>();
    const currentVendors = enterprise.vendors || [];
    importPreview.data.forEach((row) => {
      let id: string | undefined;
      if (importPreview.type === 'projects') {
        id =
          row.Code?.toString() ||
          row.code?.toString() ||
          row.ProjectCode?.toString() ||
          row.projectCode?.toString() ||
          row['Project ID']?.toString();
      } else if (importPreview.type === 'vendors') {
        id = (row['Vendor ID'] || row.id || row.ID || row.Code || row.code)?.toString();
        if (id && currentVendors.some((v) => v.id === id)) {
          sysDuplicates.add(id.toString().trim());
        }
      } else {
        id = row.ID?.toString() || row.id?.toString();
      }
      if (id) {
        const normalizedId = id.toString().trim().toLowerCase();
        if (idsInFile.has(normalizedId)) fileDuplicates.add(id.toString().trim());
        idsInFile.add(normalizedId);
      }
    });
    const duplicateList = Array.from(fileDuplicates);
    const systemDuplicateList = Array.from(sysDuplicates);
    return {
      duplicateIds: duplicateList,
      systemDuplicateIds: systemDuplicateList,
      hasImportDuplicates:
        duplicateList.length > 0 ||
        (importPreview.type === 'vendors' && systemDuplicateList.length > 0),
    };
  }, [importPreview, enterprise.vendors]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const isAttributeTab =
    activeTab === 'projectAttributes' ||
    activeTab === 'lineItemAttributes' ||
    activeTab === 'costCodeAttributes' ||
    activeTab === 'subcontractAttributes' ||
    activeTab === 'procurementAttributes' ||
    activeTab === 'changeAttributes' ||
    activeTab === 'riskAttributes' ||
    activeTab === 'progressAttributes';

  return (
    <div className="flex h-full bg-gray-50 dark:bg-[#0a0a0a] overflow-hidden transition-colors duration-300">
      {/* Sidebar */}
      <div
        className={`${isSidebarOpen ? 'w-72' : 'w-16'} bg-white dark:bg-[#141414] border-r border-gray-200 dark:border-white/10 flex flex-col h-full shrink-0 transition-all duration-300`}
      >
        <div className="p-6 border-b border-gray-200 dark:border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-black dark:bg-white rounded-xl flex items-center justify-center shadow-lg shadow-black/10 dark:shadow-white/10">
              <Settings className="w-6 h-6 text-white dark:text-black" />
            </div>
            {isSidebarOpen && (
              <div className="min-w-0">
                <h2 className="text-sm font-bold dark:text-white truncate">Enterprise Admin</h2>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">
                  Organization Console
                </p>
              </div>
            )}
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 space-y-4 custom-scrollbar">
          <div className="px-4 space-y-2">
            <button
              onClick={() => {
                const newState = !isSidebarOpen;
                setIsSidebarOpen(newState);
                if (!newState && setIsSidebarCollapsed) setIsSidebarCollapsed(true);
              }}
              className={`w-full flex items-center ${isSidebarOpen ? 'justify-between' : 'justify-center'} p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors text-gray-500 dark:text-gray-400`}
            >
              {isSidebarOpen && <span className="text-xs font-medium">Collapse Menu</span>}
              <div
                className={cn(
                  'w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300',
                  isSidebarOpen
                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                    : 'bg-transparent text-emerald-500'
                )}
              >
                {isSidebarOpen ? <ChevronLeft className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </div>
            </button>

            {isSidebarOpen && (
              <div className="flex items-center gap-1 px-1">
                <button
                  onClick={() =>
                    setExpandedSections(new Set(adminSections.map((s) => s.title)))
                  }
                  className="flex-1 py-1.5 text-[9px] font-black uppercase tracking-widest text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-white/5 rounded-md transition-all border border-transparent hover:border-gray-200 dark:hover:border-white/10"
                >
                  Expand All
                </button>
                <button
                  onClick={() => setExpandedSections(new Set())}
                  className="flex-1 py-1.5 text-[9px] font-black uppercase tracking-widest text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-white/5 rounded-md transition-all border border-transparent hover:border-gray-200 dark:hover:border-white/10"
                >
                  Collapse All
                </button>
              </div>
            )}
          </div>

          <div className="space-y-4">
            {adminSections.map((section) => (
              <div key={section.title} className="space-y-1">
                {isSidebarOpen && (
                  <button
                    onClick={() => toggleSection(section.title)}
                    className={cn(
                      'w-full flex items-center justify-between px-5 py-3 text-[10px] font-black uppercase tracking-[0.15em] transition-all',
                      expandedSections.has(section.title)
                        ? 'bg-slate-900 text-white dark:bg-white dark:text-black sticky top-0 z-10 shadow-lg shadow-black/10 dark:shadow-white/5'
                        : 'bg-slate-800 text-slate-100 dark:bg-zinc-900 dark:text-slate-400 hover:bg-slate-700 dark:hover:bg-zinc-800 border-y border-white/5'
                    )}
                  >
                    <span className="flex items-center gap-2">
                      {section.icon}
                      {section.title}
                    </span>
                    <ChevronRight
                      className={cn(
                        'w-3 h-3 transition-transform',
                        expandedSections.has(section.title) && 'rotate-90'
                      )}
                    />
                  </button>
                )}

                <AnimatePresence initial={false}>
                  {(expandedSections.has(section.title) || !isSidebarOpen) && (
                    <motion.div
                      initial={isSidebarOpen ? { height: 0, opacity: 0 } : undefined}
                      animate={isSidebarOpen ? { height: 'auto', opacity: 1 } : undefined}
                      exit={isSidebarOpen ? { height: 0, opacity: 0 } : undefined}
                      className={cn(
                        'space-y-1 px-4',
                        isSidebarOpen &&
                          expandedSections.has(section.title) &&
                          'py-2 bg-gray-50/50 dark:bg-white/[0.02]'
                      )}
                    >
                      {section.items.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => setActiveTab(item.id)}
                          title={!isSidebarOpen ? item.label : undefined}
                          className={`w-full flex items-center ${isSidebarOpen ? 'gap-3 px-4' : 'justify-center px-0'} py-2.5 rounded-xl text-sm font-medium transition-all ${
                            activeTab === item.id
                              ? 'bg-black dark:bg-white text-white dark:text-black shadow-lg shadow-black/10 dark:shadow-white/10'
                              : 'text-gray-900 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-black dark:hover:text-white'
                          }`}
                        >
                          {item.icon}
                          {isSidebarOpen && item.label}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {!isSidebarOpen && (
          <div className="p-4 border-b border-gray-200 dark:border-white/10 bg-white dark:bg-[#141414] flex items-center gap-4 shrink-0 lg:hidden">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors text-gray-500 dark:text-gray-400"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-bold dark:text-white">
              {adminSections.flatMap((s) => s.items).find((i) => i.id === activeTab)?.label ||
                'Administration'}
            </h2>
          </div>
        )}

        <div className="flex-1 flex flex-col min-h-0 p-8 overflow-hidden">
          <AnimatePresence mode="wait">
            {activeTab === 'enterpriseSettings' && (
              <EnterpriseSettingsTab
                key="enterpriseSettings"
                enterprise={enterprise}
                projects={projects}
              />
            )}

            {activeTab === 'users' && (
              <UsersTab
                key="users"
                enterprise={enterprise}
                projects={projects}
                userColumnDefs={userColumnDefs}
                setDeleteConfirm={setDeleteConfirm}
              />
            )}

            {(activeTab === 'projects' || activeTab === 'procurementSteps') && (
              <ProjectsTab
                key="projects-group"
                activeTab={activeTab}
                enterprise={enterprise}
                projects={projects}
                projectColumnDefs={projectColumnDefs}
                setDeleteConfirm={setDeleteConfirm}
                setIsBulkUpdateModalOpen={setIsBulkUpdateModalOpen}
                onImportPreview={(preview) => handleImportPreview(preview as any)}
              />
            )}

            {isAttributeTab && (
              <LineItemAttributesTab
                key="attributes"
                activeTab={activeTab}
                enterprise={enterprise}
                projectAttributes={projectAttributes}
                lineItemAttributes={lineItemAttributes}
                costCodeAttributes={costCodeAttributes}
                subcontractAttributes={subcontractAttributes}
                procurementAttributes={procurementAttributes}
                changeAttributes={changeAttributes}
                riskAttributes={riskAttributes}
                progressAttributes={progressAttributes}
                setDeleteConfirm={setDeleteConfirm}
                onImportRequest={handleAttrImportRequest}
              />
            )}

            {activeTab === 'resourceRates' && (
              <ResourceRatesTab
                key="resourceRates"
                enterprise={enterprise}
                setDeleteConfirm={setDeleteConfirm}
                setIsBulkUpdateModalOpen={setIsBulkUpdateModalOpen}
              />
            )}

            {activeTab === 'enterpriseCalendars' && (
              <motion.div
                key="enterpriseCalendars"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="flex-1 flex flex-col min-h-0 bg-white dark:bg-[#141414] border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden"
              >
                <CalendarManager
                  enterpriseId={enterprise.id}
                  title="Enterprise Calendars"
                  description="Manage standard calendars that can be inherited by projects."
                />
              </motion.div>
            )}

            {activeTab === 'vendors' && (
              <VendorsTab
                key="vendors"
                enterprise={enterprise}
                setDeleteConfirm={setDeleteConfirm}
                setIsBulkUpdateModalOpen={setIsBulkUpdateModalOpen}
                onImportPreview={(preview) => handleImportPreview(preview as any)}
              />
            )}

            {activeTab === 'costElements' && (
              <CostElementsTab key="costElements" enterpriseId={enterprise.id} />
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Side Detail Panel — User or Project quick-view */}
      <AnimatePresence>
        {(selectedUserId || selectedProjectId) && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="w-full lg:w-96 bg-white dark:bg-[#141414] border border-gray-200 dark:border-white/10 rounded-2xl flex flex-col overflow-hidden shadow-xl"
          >
            <div className="p-6 border-b border-gray-100 dark:border-white/10 flex justify-between items-start">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center border border-gray-200 dark:border-white/10 overflow-hidden">
                  {selectedUser ? (
                    (selectedUser as any).photoURL ? (
                      <img src={(selectedUser as any).photoURL} alt="" />
                    ) : (
                      <Users className="w-6 h-6 text-gray-400" />
                    )
                  ) : (selectedProject as any)?.photoURL ? (
                    <img src={(selectedProject as any).photoURL} alt="" />
                  ) : (
                    <Briefcase className="w-6 h-6 text-gray-400" />
                  )}
                </div>
                <div>
                  <h3 className="font-bold dark:text-white">
                    {selectedUser
                      ? (selectedUser as any).displayName ||
                        (selectedUser as any).email?.split('@')[0]
                      : selectedProject?.projectName}
                  </h3>
                  <p className="text-xs text-gray-400">
                    {selectedUser
                      ? (selectedUser as any).email
                      : selectedProject?.projectCode}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedUserId(null);
                  setSelectedProjectId(null);
                }}
                className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors text-gray-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {selectedUserId && selectedUser && (
                <div className="space-y-6">
                  <div>
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-4">
                      Project Assignments
                    </h4>
                    <div className="space-y-2">
                      {projects.map((project) => {
                        const userRole = project.users[selectedUserId];
                        return (
                          <div
                            key={project.id}
                            className="flex items-center justify-between p-3 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/5"
                          >
                            <div className="flex-1 min-w-0 mr-4">
                              <p className="text-sm font-bold dark:text-white truncate">
                                {project.projectName}
                              </p>
                              <p className="text-[10px] text-gray-400 font-mono">
                                {project.projectCode}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              {userRole ? (
                                <>
                                  <select
                                    value={userRole}
                                    onChange={(e) =>
                                      updateProjectRole(
                                        project.id,
                                        selectedUserId,
                                        e.target.value as any
                                      )
                                    }
                                    className="text-[10px] font-bold uppercase tracking-widest bg-transparent border-none focus:ring-0 text-blue-600 dark:text-blue-400"
                                  >
                                    <option value="Project User">User</option>
                                    <option value="Project Admin">Admin</option>
                                  </select>
                                  <button
                                    onClick={() =>
                                      toggleProjectAccess(project.id, selectedUserId, userRole)
                                    }
                                    className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={() => toggleProjectAccess(project.id, selectedUserId)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-black dark:bg-white text-white dark:text-black rounded-lg text-[10px] font-bold uppercase tracking-widest hover:scale-105 transition-transform"
                                >
                                  <UserPlus className="w-3 h-3" />
                                  Add
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {selectedProjectId && selectedProject && (
                <div className="space-y-6">
                  <div>
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-4">
                      Project Settings
                    </h4>
                    <div className="space-y-4 bg-gray-50 dark:bg-white/5 p-4 rounded-xl border border-gray-100 dark:border-white/5">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                            Project ID
                          </label>
                          <button
                            onClick={() => {
                              setProjectToReplace(selectedProject);
                              setNewProjectCode('');
                              setReplaceError('');
                              setIsReplaceIdModalOpen(true);
                            }}
                            className="text-[10px] font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-1"
                          >
                            <RefreshCw className="w-3 h-3" />
                            Replace
                          </button>
                        </div>
                        <p className="text-xs font-mono dark:text-white">
                          {selectedProject.projectCode}
                        </p>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 block mb-1">
                          Status
                        </label>
                        <select
                          value={selectedProject.status || 'Active'}
                          onChange={(e) =>
                            handleUpdateProjectStatus(selectedProject.id, e.target.value)
                          }
                          className="w-full text-xs bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-lg px-2 py-1.5 dark:text-white outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="Active">Active</option>
                          <option value="On Hold">On Hold</option>
                          <option value="Closed">Closed</option>
                          <option value="Archived">Archived</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-4">
                      Assigned Users
                    </h4>
                    <div className="space-y-2">
                      {Object.entries(enterprise.users || {}).map(([uid, data]) => {
                        const userRole = selectedProject.users[uid];
                        return (
                          <div
                            key={uid}
                            className="flex items-center justify-between p-3 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/5"
                          >
                            <div className="flex-1 min-w-0 mr-4">
                              <p className="text-sm font-bold dark:text-white truncate">
                                {(data as any).displayName || (data as any).email?.split('@')[0]}
                              </p>
                              <p className="text-[10px] text-gray-400">{(data as any).email}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              {userRole ? (
                                <>
                                  <select
                                    value={userRole}
                                    onChange={(e) =>
                                      updateProjectRole(selectedProjectId, uid, e.target.value as any)
                                    }
                                    className="text-[10px] font-bold uppercase tracking-widest bg-transparent border-none focus:ring-0 text-blue-600 dark:text-blue-400"
                                  >
                                    <option value="Project User">User</option>
                                    <option value="Project Admin">Admin</option>
                                  </select>
                                  <button
                                    onClick={() =>
                                      toggleProjectAccess(selectedProjectId, uid, userRole)
                                    }
                                    className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={() => toggleProjectAccess(selectedProjectId, uid)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-black dark:bg-white text-white dark:text-black rounded-lg text-[10px] font-bold uppercase tracking-widest hover:scale-105 transition-transform"
                                >
                                  <UserPlus className="w-3 h-3" />
                                  Add
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Replace Project ID Modal (triggered from side panel) */}
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

      {/* Delete Confirm Modal */}
      <AnimatePresence>
        {deleteConfirm && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[100] p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-[#141414] rounded-3xl p-8 w-full max-w-md shadow-2xl border border-gray-200 dark:border-white/10"
            >
              <div className="w-16 h-16 bg-red-50 dark:bg-red-500/10 rounded-full flex items-center justify-center mb-6 mx-auto">
                <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
              </div>
              <h2 className="text-2xl font-bold mb-2 text-center dark:text-white">
                {deleteConfirm.type === 'bulk-project'
                  ? 'Delete Projects?'
                  : deleteConfirm.type === 'bulk-attr-value'
                  ? 'Delete Attribute Values?'
                  : deleteConfirm.type === 'bulk-rate'
                  ? 'Delete Resource Rates?'
                  : deleteConfirm.type === 'bulk-costElement'
                  ? 'Delete Cost Elements?'
                  : deleteConfirm.type === 'bulk-vendor'
                  ? 'Delete Vendors?'
                  : deleteConfirm.type === 'bulk-user'
                  ? 'Delete Users?'
                  : deleteConfirm.type === 'rate'
                  ? 'Delete Resource Rate?'
                  : deleteConfirm.type === 'costElement'
                  ? 'Delete Cost Element?'
                  : deleteConfirm.type === 'vendor'
                  ? 'Delete Vendor?'
                  : 'Delete User?'}
              </h2>
              <p className="text-gray-900 dark:text-gray-400 text-center mb-8">
                {deleteConfirm.type === 'bulk-project' ? (
                  <>
                    You are about to delete{' '}
                    <span className="font-bold text-black dark:text-white">
                      {deleteConfirm.count}
                    </span>{' '}
                    projects. This action cannot be undone.
                  </>
                ) : deleteConfirm.type === 'bulk-attr-value' ? (
                  <>
                    You are about to delete{' '}
                    <span className="font-bold text-black dark:text-white">
                      {deleteConfirm.count}
                    </span>{' '}
                    attribute values. This action cannot be undone.
                  </>
                ) : deleteConfirm.type === 'bulk-rate' ? (
                  <>
                    You are about to delete{' '}
                    <span className="font-bold text-black dark:text-white">
                      {deleteConfirm.count}
                    </span>{' '}
                    resource rates. This action cannot be undone.
                  </>
                ) : deleteConfirm.type === 'bulk-costElement' ? (
                  <>
                    You are about to delete{' '}
                    <span className="font-bold text-black dark:text-white">
                      {deleteConfirm.count}
                    </span>{' '}
                    cost elements. This action cannot be undone.
                  </>
                ) : deleteConfirm.type === 'bulk-vendor' ? (
                  <>
                    You are about to delete{' '}
                    <span className="font-bold text-black dark:text-white">
                      {deleteConfirm.count}
                    </span>{' '}
                    vendors. This action cannot be undone.
                  </>
                ) : deleteConfirm.type === 'bulk-user' ? (
                  <>
                    You are about to delete{' '}
                    <span className="font-bold text-black dark:text-white">
                      {deleteConfirm.count}
                    </span>{' '}
                    users. This action cannot be undone.
                  </>
                ) : (
                  <>
                    You are about to remove{' '}
                    <span className="font-bold text-black dark:text-white">
                      {deleteConfirm.name}
                    </span>{' '}
                    from the enterprise.
                  </>
                )}
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 py-4 border border-gray-200 dark:border-white/10 rounded-2xl text-sm font-bold uppercase tracking-widest hover:bg-gray-50 dark:hover:bg-white/5 transition-colors dark:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (deleteConfirm.onConfirm) {
                      deleteConfirm.onConfirm();
                    } else if (deleteConfirm.type === 'user' && deleteConfirm.id) {
                      deleteUser(deleteConfirm.id);
                    } else if (deleteConfirm.type === 'project' && deleteConfirm.id) {
                      deleteProject(deleteConfirm.id);
                    }
                    setDeleteConfirm(null);
                  }}
                  className="flex-1 py-4 bg-red-600 text-white rounded-2xl text-sm font-bold uppercase tracking-widest hover:bg-red-700 transition-colors shadow-lg shadow-red-600/20"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Import Preview Modal */}
      <AnimatePresence>
        {importPreview && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[110] p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-[#141414] rounded-3xl p-8 w-full max-w-2xl shadow-2xl border border-gray-200 dark:border-white/10 flex flex-col max-h-[80vh]"
            >
              <h2 className="text-2xl font-bold mb-4 dark:text-white">Review Import</h2>
              <p className="text-gray-900 dark:text-gray-400 mb-2 text-sm">
                The following records will be imported. Existing IDs will be updated.
              </p>
              {hasImportDuplicates && (
                <div className="mb-4 p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-2xl flex flex-col gap-2">
                  <div className="flex items-center gap-3 text-red-600 dark:text-red-400 text-[10px] font-black uppercase tracking-[0.15em]">
                    <AlertTriangle className="w-4 h-4" />
                    Duplicate ID found
                  </div>
                  <div className="text-[10px] text-red-500/70 dark:text-red-400/70 font-medium break-all leading-relaxed">
                    {duplicateIds.length > 0 && (
                      <p>
                        The following IDs appear multiple times in your file:{' '}
                        <span className="font-bold text-red-600 dark:text-red-400">
                          {duplicateIds.join(', ')}
                        </span>
                        .
                      </p>
                    )}
                    {systemDuplicateIds.length > 0 && (
                      <p>
                        The following IDs already exist in the system and cannot be imported:{' '}
                        <span className="font-bold text-red-600 dark:text-red-400">
                          {systemDuplicateIds.join(', ')}
                        </span>
                        .
                      </p>
                    )}
                    <p className="mt-2">Please resolve duplicates before importing.</p>
                  </div>
                </div>
              )}
              <div className="flex-1 overflow-auto border border-gray-200 dark:border-white/10 rounded-xl mb-6">
                <table className="w-full text-left text-xs">
                  <thead className="bg-black dark:bg-gray-100 sticky top-0">
                    <tr>
                      {Object.keys(importPreview.data[0] || {}).map((key) => (
                        <th
                          key={key}
                          className="px-4 py-2 font-bold text-white dark:text-black uppercase tracking-widest text-[10px]"
                        >
                          {key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                    {importPreview.data.map((row, i) => (
                      <tr key={i}>
                        {Object.values(row).map((val: any, j) => (
                          <td key={j} className="px-4 py-2 dark:text-white">
                            {val?.toString()}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex gap-4">
                <button
                  onClick={() => setImportPreview(null)}
                  className="flex-1 py-4 border border-gray-200 dark:border-white/10 rounded-2xl text-sm font-bold uppercase tracking-widest hover:bg-gray-50 dark:hover:bg-white/5 transition-colors dark:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={completeImport}
                  disabled={hasImportDuplicates}
                  className="flex-1 py-4 bg-black dark:bg-white text-white dark:text-black rounded-2xl text-sm font-bold uppercase tracking-widest hover:bg-black/90 dark:hover:bg-white/90 transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Complete Import
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Import Success Modal */}
      <AnimatePresence>
        {showImportSuccessModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-[#1a1a1a] rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden border border-gray-100 dark:border-white/10"
            >
              <div className="p-8 text-center">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                  Import Successful
                </h3>
                <p className="text-sm text-gray-900 dark:text-gray-400 mb-6">
                  Your data has been imported successfully into the system.
                </p>
                <button
                  onClick={() => setShowImportSuccessModal(false)}
                  className="w-full py-3 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20"
                >
                  Got it
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Bulk Update Modal */}
      <Dialog open={!!isBulkUpdateModalOpen} onOpenChange={() => setIsBulkUpdateModalOpen(null)}>
        <DialogContent className="sm:max-w-[500px] dark:bg-[#141414] dark:border-white/10 max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="dark:text-white">
              Bulk Update{' '}
              {isBulkUpdateModalOpen?.type === 'rate'
                ? 'Resource Rates'
                : isBulkUpdateModalOpen?.type === 'project'
                ? 'Projects'
                : 'Vendors'}
            </DialogTitle>
            <DialogDescription className="dark:text-gray-400">
              Update {isBulkUpdateModalOpen?.count} selected items at once. Only fields you fill
              will be updated.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto py-4 space-y-4">
            {isBulkUpdateModalOpen?.type === 'rate' && (
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <label className="text-sm font-medium dark:text-gray-300">Category</label>
                  <Input
                    value={bulkUpdateFormData.category || ''}
                    onChange={(e) =>
                      setBulkUpdateFormData({ ...bulkUpdateFormData, category: e.target.value })
                    }
                    placeholder="No change"
                    className="dark:bg-[#141414] dark:border-white/10 dark:text-white"
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium dark:text-gray-300">Unit</label>
                  <Input
                    value={bulkUpdateFormData.unit || ''}
                    onChange={(e) =>
                      setBulkUpdateFormData({ ...bulkUpdateFormData, unit: e.target.value })
                    }
                    placeholder="No change"
                    className="dark:bg-[#141414] dark:border-white/10 dark:text-white"
                  />
                </div>
              </div>
            )}
            {isBulkUpdateModalOpen?.type === 'project' && (
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <label className="text-sm font-medium dark:text-gray-300">Status</label>
                  <select
                    value={bulkUpdateFormData.status || ''}
                    onChange={(e) =>
                      setBulkUpdateFormData({ ...bulkUpdateFormData, status: e.target.value })
                    }
                    className="w-full bg-gray-100 dark:bg-white/5 border-none rounded-lg px-3 py-2 text-gray-700 dark:text-gray-300 focus:ring-1 focus:ring-blue-500 outline-none"
                  >
                    <option value="">No Change</option>
                    <option value="Active">Active</option>
                    <option value="On Hold">On Hold</option>
                    <option value="Closed">Closed</option>
                    <option value="Archived">Archived</option>
                  </select>
                </div>
                {projectAttributes
                  .filter((attr) => attr.title)
                  .map((attr) => (
                    <div key={attr.id} className="grid gap-2">
                      <label className="text-sm font-medium dark:text-gray-300">{attr.title}</label>
                      <select
                        value={bulkUpdateFormData[`attributes.${attr.id}`] || ''}
                        onChange={(e) =>
                          setBulkUpdateFormData({
                            ...bulkUpdateFormData,
                            [`attributes.${attr.id}`]: e.target.value,
                          })
                        }
                        className="w-full bg-gray-100 dark:bg-white/5 border-none rounded-lg px-3 py-2 text-gray-700 dark:text-gray-300 focus:ring-1 focus:ring-blue-500 outline-none"
                      >
                        <option value="">No Change</option>
                        {attr.values?.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.id} | {v.description}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
              </div>
            )}
            {isBulkUpdateModalOpen?.type === 'vendor' && (
              <div className="grid gap-2">
                <label className="text-sm font-medium dark:text-gray-300">Contact Name</label>
                <Input
                  value={bulkUpdateFormData.contactName || ''}
                  onChange={(e) =>
                    setBulkUpdateFormData({ ...bulkUpdateFormData, contactName: e.target.value })
                  }
                  className="dark:bg-[#141414] dark:border-white/10 dark:text-white"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsBulkUpdateModalOpen(null)}
              className="dark:border-white/10 dark:text-white"
            >
              Cancel
            </Button>
            <Button
              onClick={handleBulkUpdate}
              disabled={isSubmitting}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isSubmitting ? 'Updating...' : 'Update All'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
