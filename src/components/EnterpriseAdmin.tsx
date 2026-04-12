import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db, auth } from '../firebase';
import { doc, updateDoc, collection, query, where, onSnapshot, deleteDoc, getDocs, addDoc } from 'firebase/firestore';
import { Enterprise, Project, Sheet, ProjectAttribute, ProjectAttributeValue, SavedView } from '../types';
import { Users, Briefcase, Settings, Plus, Trash2, Tag, Search, X, ChevronRight, ChevronDown, UserPlus, ExternalLink, AlertTriangle, Edit2, Download, Upload, Eye, Lock, Unlock, MoreVertical, Bookmark, Filter, Layout, CheckCircle2, PieChart, DollarSign, RefreshCw, PenTool, HardHat, ShoppingCart, Receipt, Calendar, Hash, Menu, ChevronLeft, Building2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import CalendarManager from './CalendarManager';

const RESOURCE_CATEGORIES = ['Labour', 'Plant', 'Material', 'Subcontractor'];
const RESOURCE_UNITS = [
  // International
  'm', 'm2', 'm3', 'ton', 'kg', 'no', 'item', 'hour', 'week', 'month',
  // American
  'ft', 'ft2', 'ft3', 'lb', 'gal', 'yd', 'yd2', 'yd3', 'in', 'in2', 'in3'
];

const getAvailableUnits = (category: string) => {
  if (category === 'Labour' || category === 'Plant') {
    return ['hour', 'week', 'month', 'no', 'item'];
  }
  return RESOURCE_UNITS;
};

interface EnterpriseAdminProps {
  enterprise: Enterprise;
}

export default function EnterpriseAdmin({ enterprise }: EnterpriseAdminProps) {
  const [activeTab, setActiveTab] = useState<string>('users');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['General Admin', 'Cost Admin', 'Safety Admin', 'Quality Admin', 'Document Admin']));
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const adminSections = [
    {
      title: 'General Admin',
      icon: <Settings className="w-4 h-4" />,
      items: [
        { id: 'enterpriseSettings', label: 'Enterprise Settings', icon: <Settings className="w-4 h-4" /> },
        { id: 'users', label: 'Enterprise Users', icon: <Users className="w-4 h-4" /> },
        { id: 'projects', label: 'Enterprise Projects', icon: <Briefcase className="w-4 h-4" /> },
        { id: 'projectAttributes', label: 'Enterprise Project Attributes', icon: <Settings className="w-4 h-4" /> },
        { id: 'enterpriseCalendars', label: 'Enterprise Calendars', icon: <Calendar className="w-4 h-4" /> },
      ]
    },
    {
      title: 'Cost Management',
      icon: <DollarSign className="w-4 h-4" />,
      items: [
        { id: 'costElements', label: 'Enterprise Cost Elements', icon: <Hash className="w-4 h-4" /> },
        { id: 'lineItemAttributes', label: 'Enterprise Line-Item Attributes', icon: <Tag className="w-4 h-4" /> },
        { id: 'costCodeAttributes', label: 'Enterprise Cost Code Attributes', icon: <Tag className="w-4 h-4" /> },
        { id: 'resourceRates', label: 'Enterprise Resources Rates', icon: <DollarSign className="w-4 h-4" /> },
      ]
    },
    {
      title: 'Schedule Management',
      icon: <Calendar className="w-4 h-4" />,
      items: [
        { id: 'scheduleMgmt', label: 'Schedule Settings', icon: <Calendar className="w-4 h-4" /> },
      ]
    },
    {
      title: 'Change Management',
      icon: <RefreshCw className="w-4 h-4" />,
      items: [
        { id: 'changeMgmt', label: 'Change Settings', icon: <RefreshCw className="w-4 h-4" /> },
      ]
    },
    {
      title: 'Design Management',
      icon: <PenTool className="w-4 h-4" />,
      items: [
        { id: 'designMgmt', label: 'Design Settings', icon: <PenTool className="w-4 h-4" /> },
      ]
    },
    {
      title: 'Field Management',
      icon: <HardHat className="w-4 h-4" />,
      items: [
        { id: 'fieldMgmt', label: 'Field Settings', icon: <HardHat className="w-4 h-4" /> },
      ]
    },
    {
      title: 'Procurement',
      icon: <ShoppingCart className="w-4 h-4" />,
      items: [
        { id: 'procurement', label: 'Procurement Settings', icon: <ShoppingCart className="w-4 h-4" /> },
      ]
    },
    {
      title: 'Sub-Contract Management',
      icon: <Briefcase className="w-4 h-4" />,
      items: [
        { id: 'subContractMgmt', label: 'Sub-Contract Settings', icon: <Briefcase className="w-4 h-4" /> },
      ]
    },
    {
      title: 'Invoicing',
      icon: <Receipt className="w-4 h-4" />,
      items: [
        { id: 'invoicing', label: 'Invoicing Settings', icon: <Receipt className="w-4 h-4" /> },
      ]
    }
  ];

  const toggleSection = (title: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(title)) {
      newExpanded.delete(title);
    } else {
      newExpanded.add(title);
    }
    setExpandedSections(newExpanded);
  };
  const [projects, setProjects] = useState<Project[]>([]);
  const [sheets, setSheets] = useState<Sheet[]>([]);
  
  // Search and Selection States
  const [userSearch, setUserSearch] = useState('');
  const [projectSearch, setProjectSearch] = useState('');
  const [attrSearch, setAttrSearch] = useState('');
  const [valueSearch, setValueSearch] = useState('');
  const [resourceSearch, setResourceSearch] = useState('');
  const [costElementSearch, setCostElementSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(new Set());
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, type: 'user' | 'project' | 'attr-value' | 'rate' | 'costElement', id: string } | null>(null);
  const [selectedAttrId, setSelectedAttrId] = useState<string>('01');
  const [selectedAttrValueIds, setSelectedAttrValueIds] = useState<Set<string>>(new Set());
  const [selectedRateIds, setSelectedRateIds] = useState<Set<string>>(new Set());
  const [selectedCostElementIds, setSelectedCostElementIds] = useState<Set<string>>(new Set());
  const [projectSort, setProjectSort] = useState<{ field: 'dateCreated' | 'dateLastModified' | 'projectName' | 'projectCode', direction: 'asc' | 'desc' }>({ field: 'dateCreated', direction: 'desc' });
  
  // Modal States
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'user' | 'project' | 'bulk-project' | 'bulk-attr-value' | 'rate' | 'bulk-rate' | 'costElement' | 'bulk-costElement', id?: string, name?: string, count?: number } | null>(null);
  const [inviteModal, setInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);

  const [isReplaceIdModalOpen, setIsReplaceIdModalOpen] = useState(false);
  const [isCreateProjectModalOpen, setIsCreateProjectModalOpen] = useState(false);
  const [newProjectData, setNewProjectData] = useState({ name: '', code: '' });
  const [newProjectCode, setNewProjectCode] = useState('');
  const [isReplacing, setIsReplacing] = useState(false);
  const [replaceError, setReplaceError] = useState('');
  const [projectToReplace, setProjectToReplace] = useState<Project | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [editingValueId, setEditingValueId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<'description' | 'sortOrder' | null>(null);

  const [isEditingValue, setIsEditingValue] = useState<{ type: 'project' | 'lineItem' | 'costCode', attrId: string, valueId: string | null } | null>(null);
  const [isEditingResource, setIsEditingResource] = useState<{ id: string | null, insertIndex?: number } | null>(null);
  const [isEditingCostElement, setIsEditingCostElement] = useState<{ id: string | null, insertIndex?: number } | null>(null);
  const [valueFormData, setValueFormData] = useState({ id: '', description: '', sortOrder: '' as any });
  const [costElementFormData, setCostElementFormData] = useState({ id: '', description: '', sortCode: '' });
  const [resourceFormData, setResourceFormData] = useState({ 
    id: '', 
    name: '', 
    unit: '', 
    rate: 0, 
    category: '',
    udf1: '',
    udf2: '',
    udf3: ''
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const projectPhotoInputRef = useRef<HTMLInputElement>(null);
  const enterpriseLogoInputRef = useRef<HTMLInputElement>(null);

  // Table Control States
  const [visibleColumns, setVisibleColumns] = useState<Record<string, string[]>>({
    users: ['photo', 'name', 'email', 'joined', 'access'],
    projects: ['photo', 'name', 'code', 'created', 'users', 'sheets'],
    lineItemAttributes: ['id', 'description', 'sortOrder'],
    costCodeAttributes: ['id', 'description', 'sortOrder'],
    projectAttributes: ['id', 'description', 'sortOrder'],
    resourceRates: ['id', 'name', 'category', 'unit', 'rate', 'udf1', 'udf2', 'udf3'],
    costElements: ['id', 'description', 'sortCode']
  });
  const [isColumnMenuOpen, setIsColumnMenuOpen] = useState<string | null>(null);
  const [isFrozen, setIsFrozen] = useState<Record<string, boolean>>({
    users: true,
    projects: true,
    lineItemAttributes: true,
    costCodeAttributes: true,
    projectAttributes: true,
    resourceRates: true,
    costElements: true
  });
  const [importPreview, setImportPreview] = useState<{ type: 'users' | 'projects' | 'lineItemAttributes' | 'costCodeAttributes' | 'projectAttributes' | 'resourceRates' | 'costElements', data: any[], attrId?: string } | null>(null);
  const [userSort, setUserSort] = useState<{ field: string, direction: 'asc' | 'desc' }>({ field: 'name', direction: 'asc' });
  const [attrSort, setAttrSort] = useState<{ field: string, direction: 'asc' | 'desc' }>({ field: 'sortOrder', direction: 'asc' });
  const [resourceSort, setResourceSort] = useState<{ field: string, direction: 'asc' | 'desc' }>({ field: 'id', direction: 'asc' });
  const [costElementSort, setCostElementSort] = useState<{ field: string, direction: 'asc' | 'desc' }>({ field: 'id', direction: 'asc' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showImportSuccessModal, setShowImportSuccessModal] = useState(false);
  const [newViewName, setNewViewName] = useState('');
  const [isSavedViewMenuOpen, setIsSavedViewMenuOpen] = useState<string | null>(null);
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [newChangeType, setNewChangeType] = useState('');
  const [columnFilters, setColumnFilters] = useState<Record<string, Record<string, string>>>({
    users: {},
    projects: {},
    lineItemAttributes: {},
    costCodeAttributes: {},
    projectAttributes: {},
    resourceRates: {},
    costElements: {}
  });

  const clearAllFilters = (tableId: string) => {
    setColumnFilters(prev => ({ ...prev, [tableId]: {} }));
    if (tableId === 'resourceRates') setResourceSearch('');
    if (tableId === 'projects') setProjectSearch('');
    if (tableId === 'users') setUserSearch('');
    if (tableId === 'lineItemAttributes' || tableId === 'costCodeAttributes' || tableId === 'projectAttributes') {
      setAttrSearch('');
      setValueSearch('');
    }
    if (tableId === 'costElements') setCostElementSearch('');
  };

  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(collection(db, 'savedViews'), where('userId', '==', auth.currentUser.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const views = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as SavedView));
      setSavedViews(views);
    }, (error) => {
      console.error("Saved views fetch error:", error);
    });
    return () => unsubscribe();
  }, [auth.currentUser?.uid]);

  const saveView = async (tableId: string, name: string) => {
    if (!name.trim() || !auth.currentUser) return;
    try {
      const newView: Omit<SavedView, 'id'> = {
        name,
        tableId,
        columns: visibleColumns[tableId],
        userId: auth.currentUser.uid,
        createdAt: new Date().toISOString(),
        config: {
          isFrozen: isFrozen[tableId],
          sort: tableId === 'users' ? userSort : 
                tableId === 'projects' ? projectSort : 
                tableId === 'costElements' ? costElementSort : 
                tableId === 'resourceRates' ? resourceSort : 
                (tableId === 'lineItemAttributes' || tableId === 'costCodeAttributes' || tableId === 'projectAttributes') ? attrSort : {},
          columnFilters: columnFilters[tableId]
        }
      } as any;
      await addDoc(collection(db, 'savedViews'), newView);
      setNewViewName('');
      setIsSavedViewMenuOpen(null);
    } catch (error) {
      console.error('Failed to save view', error);
      alert('Failed to save view.');
    }
  };

  const applyView = (view: SavedView) => {
    setVisibleColumns(prev => ({
      ...prev,
      [view.tableId]: view.columns
    }));
    
    if ((view as any).config) {
      const config = (view as any).config;
      setIsFrozen(prev => ({ ...prev, [view.tableId]: config.isFrozen }));
      setColumnFilters(prev => ({ ...prev, [view.tableId]: config.columnFilters }));
      
      if (view.tableId === 'users') setUserSort(config.sort);
      else if (view.tableId === 'projects') setProjectSort(config.sort);
      else if (view.tableId === 'costElements') setCostElementSort(config.sort);
      else if (view.tableId === 'resourceRates') setResourceSort(config.sort);
      else if (view.tableId === 'lineItemAttributes' || view.tableId === 'costCodeAttributes' || view.tableId === 'projectAttributes') setAttrSort(config.sort);
    }
    
    setIsSavedViewMenuOpen(null);
  };

  const deleteView = async (viewId: string) => {
    try {
      await deleteDoc(doc(db, 'savedViews', viewId));
    } catch (error) {
      console.error('Failed to delete view', error);
    }
  };

  const getAttributes = (type: 'project' | 'lineItem' | 'costCode') => {
    const field = type === 'project' ? 'projectAttributes' : type === 'costCode' ? 'costCodeAttributes' : 'lineItemAttributes';
    const attrs = (enterprise as any)[field] || [];
    
    // Legacy check: if it's an array of strings, convert to new structure
    if (attrs.length > 0 && typeof attrs[0] === 'string') {
      return Array.from({ length: 10 }, (_, i) => ({
        id: (i + 1).toString().padStart(2, '0'),
        title: attrs[i] || '',
        values: []
      }));
    }

    // New structure or empty
    const result = [...attrs];
    while (result.length < 10) {
      result.push({
        id: (result.length + 1).toString().padStart(2, '0'),
        title: '',
        values: []
      });
    }
    return result as ProjectAttribute[];
  };

  const resourceIdExists = !isSubmitting && !isEditingResource?.id && (enterprise.resourceRates || []).some(r => r.id === resourceFormData.id);
  const costElementIdExists = !isSubmitting && !isEditingCostElement?.id && (enterprise.costElements || []).some(ce => ce.id === costElementFormData.id);
  const valueIdExists = !isSubmitting && !isEditingValue?.valueId && isEditingValue && (getAttributes(isEditingValue.type).find(a => a.id === isEditingValue.attrId)?.values || []).some(v => v.id === valueFormData.id);

  useEffect(() => {
    const q = query(collection(db, 'projects'), where('enterpriseId', '==', enterprise.id));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setProjects(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Project)));
    }, (error) => {
      console.error("Projects fetch error:", error);
    });
    return () => unsubscribe();
  }, [enterprise.id]);

  useEffect(() => {
    const q = query(collection(db, 'sheets'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setSheets(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Sheet)));
    }, (error) => {
      console.error("Sheets fetch error:", error);
    });
    return () => unsubscribe();
  }, []);

  const bulkDeleteResourceRates = async () => {
    if (!enterprise.id || selectedRateIds.size === 0) return;
    try {
      const newRates = (enterprise.resourceRates || []).filter(r => !selectedRateIds.has(r.id));
      await updateDoc(doc(db, 'enterprises', enterprise.id), { resourceRates: newRates });
      setSelectedRateIds(new Set());
      setDeleteConfirm(null);
    } catch (error) {
      console.error('Bulk delete rates failed', error);
      alert('Failed to delete resource rates.');
    }
  };

  const bulkDeleteCostElements = async () => {
    if (!enterprise.id || selectedCostElementIds.size === 0) return;
    try {
      const newElements = (enterprise.costElements || []).filter(ce => !selectedCostElementIds.has(ce.id));
      await updateDoc(doc(db, 'enterprises', enterprise.id), { costElements: newElements });
      setSelectedCostElementIds(new Set());
      setDeleteConfirm(null);
    } catch (error) {
      console.error('Bulk delete cost elements failed', error);
      alert('Failed to delete cost elements.');
    }
  };
  const toggleUserRole = async (uid: string) => {
    const user = enterprise.users?.[uid];
    if (!user) return;
    const newRole = user.role === 'Enterprise System Admin' ? 'Enterprise User' : 'Enterprise System Admin';
    await updateDoc(doc(db, 'enterprises', enterprise.id), {
      [`users.${uid}.role`]: newRole
    });
  };

  const deleteUser = async (uid: string) => {
    const newUsers = { ...enterprise.users };
    delete newUsers[uid];
    await updateDoc(doc(db, 'enterprises', enterprise.id), {
      users: newUsers
    });
    setDeleteConfirm(null);
    if (selectedUserId === uid) setSelectedUserId(null);
  };

  const deleteProject = async (projectId: string) => {
    await deleteDoc(doc(db, 'projects', projectId));
    setDeleteConfirm(null);
    if (selectedProjectId === projectId) setSelectedProjectId(null);
    const newSelected = new Set(selectedProjectIds);
    newSelected.delete(projectId);
    setSelectedProjectIds(newSelected);
  };

  const handleResourceSort = (field: string) => {
    setResourceSort(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const filteredUsers = useMemo(() => {
    let result = Object.entries(enterprise.users || {})
      .map(([uid, data]) => ({ uid, ...data }))
      .filter(user => 
        (user.displayName || user.name || '').toLowerCase().includes(userSearch.toLowerCase()) ||
        user.email.toLowerCase().includes(userSearch.toLowerCase())
      );

    // Apply column filters
    const filters = columnFilters.users;
    Object.entries(filters).forEach(([field, value]) => {
      if (value) {
        result = result.filter(u => {
          const val = field === 'name' ? (u.displayName || u.name) : (u as any)[field];
          return String(val || '').toLowerCase().includes(value.toLowerCase());
        });
      }
    });

    return result.sort((a, b) => {
      const aVal = (a as any)[userSort.field] || '';
      const bVal = (b as any)[userSort.field] || '';
      if (userSort.direction === 'asc') return aVal > bVal ? 1 : -1;
      return aVal < bVal ? 1 : -1;
    });
  }, [enterprise.users, userSearch, userSort, columnFilters.users]);

  const sortedProjects = useMemo(() => {
    let result = [...projects]
      .filter(p => 
        p.projectName.toLowerCase().includes(projectSearch.toLowerCase()) ||
        p.projectCode.toLowerCase().includes(projectSearch.toLowerCase())
      );

    // Apply column filters
    const filters = columnFilters.projects;
    Object.entries(filters).forEach(([field, value]) => {
      if (value) {
        result = result.filter(p => {
          // Map 'name' to 'projectName' and 'code' to 'projectCode' if needed
          const actualField = field === 'name' ? 'projectName' : field === 'code' ? 'projectCode' : field;
          const val = (p as any)[actualField];
          return String(val || '').toLowerCase().includes(value.toLowerCase());
        });
      }
    });

    return result.sort((a, b) => {
      const aVal = (a as any)[projectSort.field] || '';
      const bVal = (b as any)[projectSort.field] || '';
      if (projectSort.direction === 'asc') return aVal > bVal ? 1 : -1;
      return aVal < bVal ? 1 : -1;
    });
  }, [projects, projectSearch, projectSort, columnFilters.projects]);

  const filteredResources = useMemo(() => {
    let result = (enterprise.resourceRates || [])
      .filter(r => 
        r.name.toLowerCase().includes(resourceSearch.toLowerCase()) ||
        r.id.toLowerCase().includes(resourceSearch.toLowerCase()) ||
        (r.category || '').toLowerCase().includes(resourceSearch.toLowerCase())
      );

    // Apply column filters
    const filters = columnFilters.resourceRates;
    Object.entries(filters).forEach(([field, value]) => {
      if (value) {
        result = result.filter(r => {
          const val = (r as any)[field];
          return String(val || '').toLowerCase().includes(value.toLowerCase());
        });
      }
    });

    return result.sort((a: any, b: any) => {
      const aVal = a[resourceSort.field];
      const bVal = b[resourceSort.field];
      if (resourceSort.direction === 'asc') return aVal > bVal ? 1 : -1;
      return aVal < bVal ? 1 : -1;
    });
  }, [enterprise.resourceRates, resourceSearch, resourceSort, columnFilters.resourceRates]);

  const filteredCostElements = useMemo(() => {
    let result = (enterprise.costElements || [])
      .filter(e => 
        e.id.toLowerCase().includes(costElementSearch.toLowerCase()) ||
        e.description.toLowerCase().includes(costElementSearch.toLowerCase()) ||
        e.sortCode.toLowerCase().includes(costElementSearch.toLowerCase())
      );

    // Apply column filters
    const filters = columnFilters.costElements;
    Object.entries(filters).forEach(([field, value]) => {
      if (value) {
        result = result.filter(e => {
          const val = (e as any)[field];
          return String(val || '').toLowerCase().includes(value.toLowerCase());
        });
      }
    });

    return result.sort((a: any, b: any) => {
      const aVal = a[costElementSort.field];
      const bVal = b[costElementSort.field];
      if (costElementSort.direction === 'asc') return aVal > bVal ? 1 : -1;
      return aVal < bVal ? 1 : -1;
    });
  }, [enterprise.costElements, costElementSearch, costElementSort, columnFilters.costElements]);

  const bulkDeleteProjects = async () => {
    const promises = Array.from(selectedProjectIds).map((id: string) => deleteDoc(doc(db, 'projects', id)));
    await Promise.all(promises);
    setSelectedProjectIds(new Set());
    setDeleteConfirm(null);
    setSelectedProjectId(null);
  };

  const bulkDeleteAttributeValues = async (type: 'project' | 'lineItem' | 'costCode', attrId: string) => {
    const field = type === 'project' ? 'projectAttributes' : type === 'costCode' ? 'costCodeAttributes' : 'lineItemAttributes';
    const currentAttrs = getAttributes(type);
    const newAttrs = currentAttrs.map(a => {
      if (a.id === attrId) {
        return { ...a, values: (a.values || []).filter(v => !selectedAttrValueIds.has(v.id)) };
      }
      return a;
    });
    await updateDoc(doc(db, 'enterprises', enterprise.id), {
      [field]: newAttrs
    });
    setSelectedAttrValueIds(new Set());
    setDeleteConfirm(null);
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail || isInviting) return;
    
    setIsInviting(true);
    try {
      // 1. Generate a secure token
      const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      
      // 2. Create invitation document in Firestore
      await addDoc(collection(db, 'invitations'), {
        enterpriseId: enterprise.id,
        email: inviteEmail.toLowerCase().trim(),
        token: token,
        status: 'pending',
        invitedBy: auth.currentUser?.uid,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
      });

      // 3. Generate the secure link
      const inviteLink = `${window.location.origin}?token=${token}`;
      setGeneratedLink(inviteLink);

      // 4. Try to send real email via our backend
      await fetch('/api/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail,
          enterpriseName: enterprise.name,
          inviterName: auth.currentUser?.displayName || auth.currentUser?.email || 'A colleague',
          appUrl: inviteLink
        })
      }).catch(err => console.warn('Email sending failed, but link was generated:', err));

      // 5. Track pending invite in Enterprise doc
      const pendingInvites = (enterprise as any).pendingInvites || [];
      if (!pendingInvites.includes(inviteEmail)) {
        await updateDoc(doc(db, 'enterprises', enterprise.id), {
          pendingInvites: [...pendingInvites, inviteEmail]
        });
      }
      
      // We don't close the modal immediately so they can copy the link
    } catch (error) {
      console.error('Invitation failed:', error);
      alert(error instanceof Error ? error.message : 'Failed to generate invitation. Please try again.');
    } finally {
      setIsInviting(false);
    }
  };

  const copyInviteLink = () => {
    if (generatedLink) {
      navigator.clipboard.writeText(generatedLink);
      alert('Invitation link copied to clipboard!');
    }
  };

  const toggleProjectAccess = async (projectId: string, uid: string, currentRole?: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    const newUsers = { ...project.users };
    if (currentRole) {
      delete newUsers[uid];
    } else {
      newUsers[uid] = 'Project User';
    }
    await updateDoc(doc(db, 'projects', projectId), { 
      users: newUsers,
      dateLastModified: new Date().toISOString()
    });
  };

  const updateProjectRole = async (projectId: string, uid: string, role: 'Project Admin' | 'Project User') => {
    await updateDoc(doc(db, 'projects', projectId), {
      [`users.${uid}`]: role,
      dateLastModified: new Date().toISOString()
    });
  };

  const handleUpdateProjectStatus = async (projectId: string, status: string) => {
    await updateDoc(doc(db, 'projects', projectId), {
      status,
      dateLastModified: new Date().toISOString()
    });
  };

  const handleUpdateProjectPhoto = async (projectId: string, photoURL: string) => {
    await updateDoc(doc(db, 'projects', projectId), {
      photoURL,
      dateLastModified: new Date().toISOString()
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
      // Check for duplicates
      const q = query(
        collection(db, 'projects'),
        where('enterpriseId', '==', enterprise.id),
        where('projectCode', '==', newProjectCode.trim())
      );
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        setReplaceError('This Project ID already exists in the enterprise.');
        setIsReplacing(false);
        return;
      }

      await updateDoc(doc(db, 'projects', projectToReplace.id), {
        projectCode: newProjectCode.trim(),
        dateLastModified: new Date().toISOString()
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

  const isNewProjectCodeDuplicate = useMemo(() => {
    if (!newProjectCode.trim()) return false;
    return projects.some(p => p.projectCode === newProjectCode.trim() && p.id !== projectToReplace?.id);
  }, [newProjectCode, projects, projectToReplace]);

  const handleUpdateEnterprise = async (updates: Partial<Enterprise>) => {
    try {
      await updateDoc(doc(db, 'enterprises', enterprise.id), updates);
    } catch (error) {
      console.error('Enterprise update failed', error);
      alert('Failed to update enterprise settings.');
    }
  };

  const exportUsers = () => {
    const data = filteredUsers.map(user => ({
      Name: user.name || user.displayName || '',
      Email: user.email || '',
      Role: user.role || '',
      'Joined At': user.joinedAt ? new Date(user.joinedAt).toLocaleDateString() : ''
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Users');
    XLSX.writeFile(wb, 'Enterprise_Users.xlsx');
  };


  const handleUserSort = (field: string) => {
    setUserSort(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const exportProjects = () => {
    const data = filteredProjects.map(p => ({
      'Project Name': p.projectName,
      'Project Code': p.projectCode,
      'Date Created': p.dateCreated ? new Date(p.dateCreated).toLocaleDateString() : '',
      'Users Count': Object.keys(p.users || {}).length,
      'Sheets Count': sheets.filter(s => s.projectId === p.id).length
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Projects');
    XLSX.writeFile(wb, 'Enterprise_Projects.xlsx');
  };

  const handleProjectSort = (field: 'projectName' | 'projectCode' | 'dateCreated' | 'dateLastModified') => {
    setProjectSort(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const filteredProjects = sortedProjects;

  const selectedUser = selectedUserId ? enterprise.users?.[selectedUserId] : null;
  const selectedProject = selectedProjectId ? projects.find(p => p.id === selectedProjectId) : null;

  const toggleProjectSelection = (id: string) => {
    const newSelected = new Set(selectedProjectIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedProjectIds(newSelected);
  };

  const handleAttrSort = (field: string) => {
    setAttrSort(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const projectAttributes = useMemo(() => getAttributes('project'), [enterprise.projectAttributes]);
  const lineItemAttributes = useMemo(() => getAttributes('lineItem'), [enterprise.lineItemAttributes]);
  const costCodeAttributes = useMemo(() => getAttributes('costCode'), [enterprise.costCodeAttributes]);

  const sortedAttrValues = useMemo(() => {
    const values = (activeTab === 'projectAttributes' ? projectAttributes : activeTab === 'costCodeAttributes' ? costCodeAttributes : lineItemAttributes).find((a: any) => a.id === selectedAttrId)?.values || [];
    let result = [...values].filter(v => 
      v.description.toLowerCase().includes(valueSearch.toLowerCase()) ||
      v.id.toLowerCase().includes(valueSearch.toLowerCase())
    );

    // Apply column filters
    const filters = columnFilters[activeTab as keyof typeof columnFilters] || {};
    Object.entries(filters).forEach(([field, value]) => {
      if (value) {
        result = result.filter(v => {
          const val = (v as any)[field];
          return String(val || '').toLowerCase().includes(value.toLowerCase());
        });
      }
    });

    return result.sort((a: any, b: any) => {
      const aVal = a[attrSort.field];
      const bVal = b[attrSort.field];
      if (attrSort.direction === 'asc') return aVal > bVal ? 1 : -1;
      return aVal < bVal ? 1 : -1;
    });
  }, [selectedAttrId, projectAttributes, lineItemAttributes, costCodeAttributes, attrSort, activeTab, valueSearch, columnFilters.lineItemAttributes, columnFilters.projectAttributes, columnFilters.costCodeAttributes]);


  const updateAttributeTitle = async (type: 'project' | 'lineItem' | 'costCode', id: string, title: string) => {
    const field = type === 'project' ? 'projectAttributes' : type === 'costCode' ? 'costCodeAttributes' : 'lineItemAttributes';
    const currentAttrs = getAttributes(type);
    const newAttrs = currentAttrs.map(a => a.id === id ? { ...a, title } : a);
    await updateDoc(doc(db, 'enterprises', enterprise.id), {
      [field]: newAttrs
    });
  };

  const addAttributeValue = async (type: 'project' | 'lineItem' | 'costCode', attrId: string, value: ProjectAttributeValue) => {
    try {
      setIsSubmitting(true);
      const field = type === 'project' ? 'projectAttributes' : type === 'costCode' ? 'costCodeAttributes' : 'lineItemAttributes';
      const currentAttrs = getAttributes(type);
      const finalValue = {
        ...value,
        sortOrder: parseInt(value.sortOrder as any) || 0,
        description: value.description.trim() || 'Value Description'
      };
      const newAttrs = currentAttrs.map(a => {
        if (a.id === attrId) {
          const values = a.values || [];
          // Prevent duplicate ID
          if (values.some(v => v.id === value.id)) {
            alert(`Value ID "${value.id}" already exists for this attribute.`);
            return a;
          }
          return { ...a, values: [...values, finalValue] };
        }
        return a;
      });
      await updateDoc(doc(db, 'enterprises', enterprise.id), {
        [field]: newAttrs
      });
    } catch (error) {
      console.error('Failed to add attribute value', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const removeAttributeValue = async (type: 'project' | 'lineItem' | 'costCode', attrId: string, valueId: string) => {
    const field = type === 'project' ? 'projectAttributes' : type === 'costCode' ? 'costCodeAttributes' : 'lineItemAttributes';
    const currentAttrs = getAttributes(type);
    const newAttrs = currentAttrs.map(a => {
      if (a.id === attrId) {
        return { ...a, values: (a.values || []).filter(v => v.id !== valueId) };
      }
      return a;
    });
    await updateDoc(doc(db, 'enterprises', enterprise.id), {
      [field]: newAttrs
    });
  };

  const updateAttributeValue = async (type: 'project' | 'lineItem' | 'costCode', attrId: string, valueId: string, updates: Partial<ProjectAttributeValue>) => {
    const field = type === 'project' ? 'projectAttributes' : type === 'costCode' ? 'costCodeAttributes' : 'lineItemAttributes';
    const currentAttrs = getAttributes(type);
    const newAttrs = currentAttrs.map(a => {
      if (a.id === attrId) {
        return { 
          ...a, 
          values: (a.values || []).map(v => v.id === valueId ? { ...v, ...updates } : v) 
        };
      }
      return a;
    });
    await updateDoc(doc(db, 'enterprises', enterprise.id), {
      [field]: newAttrs
    });
  };

  const handleInlineUpdate = (valueId: string, field: 'description' | 'sortOrder', newValue: string) => {
    const type = activeTab === 'projectAttributes' ? 'project' : activeTab === 'costCodeAttributes' ? 'costCode' : 'lineItem';
    const updates: Partial<ProjectAttributeValue> = {};
    if (field === 'sortOrder') {
      updates.sortOrder = Number(newValue);
    } else {
      updates.description = newValue;
    }
    updateAttributeValue(type, selectedAttrId, valueId, updates);
    setEditingValueId(null);
    setEditingField(null);
  };

  const handleExport = (type: 'project' | 'lineItem' | 'costCode' | 'resourceRates' | 'costElements', attrId?: string) => {
    if (type === 'costElements') {
      const elements = enterprise.costElements || [];
      if (elements.length === 0) {
        alert('No cost elements to export.');
        return;
      }
      const data = elements.map(e => ({
        ID: e.id,
        Description: e.description,
        'Sort Code': e.sortCode
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'CostElements');
      XLSX.writeFile(wb, `CostElements_${new Date().toISOString().split('T')[0]}.xlsx`);
      return;
    }

    if (type === 'resourceRates') {
      const rates = enterprise.resourceRates || [];
      if (rates.length === 0) {
        alert('No resource rates to export.');
        return;
      }
      const data = rates.map(r => ({
        ID: r.id,
        Name: r.name,
        Category: r.category,
        Unit: r.unit,
        Rate: r.rate
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'ResourceRates');
      XLSX.writeFile(wb, `ResourceRates_${new Date().toISOString().split('T')[0]}.xlsx`);
      return;
    }

    const attrs = type === 'project' ? projectAttributes : type === 'costCode' ? costCodeAttributes : lineItemAttributes;
    const attr = attrs.find(a => a.id === attrId);
    if (!attr || !attr.values || attr.values.length === 0) {
      alert('No values to export.');
      return;
    }

    const data = attr.values.map(v => ({
      ID: v.id,
      Description: v.description,
      'Sort Order': v.sortOrder
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Values');
    XLSX.writeFile(wb, `${type === 'project' ? 'Project' : type === 'costCode' ? 'CostCode' : 'LineItem'}_Attr_${attrId}_${attr.title || 'Untitled'}.xlsx`);
  };

  const handleImport = async (type: 'users' | 'projects' | 'lineItemAttributes' | 'costCodeAttributes' | 'projectAttributes' | 'resourceRates' | 'costElements', file: File, attrId?: string) => {
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
  };

  const completeImport = async () => {
    if (!importPreview) return;
    const { type, data, attrId } = importPreview;

    if ((type === 'lineItemAttributes' || type === 'costCodeAttributes' || type === 'projectAttributes') && attrId) {
      const attrType = type === 'projectAttributes' ? 'project' : type === 'costCodeAttributes' ? 'costCode' : 'lineItem';
      const field = attrType === 'project' ? 'projectAttributes' : attrType === 'costCode' ? 'costCodeAttributes' : 'lineItemAttributes';
      const currentAttrs = getAttributes(attrType);
      
      const newAttrs = currentAttrs.map(a => {
        if (a.id === attrId) {
          const values = [...(a.values || [])];
          data.forEach(row => {
            const id = row.ID?.toString() || row.id?.toString();
            const description = row.Description?.toString() || row.description?.toString() || '';
            const sortOrder = parseInt(row['Sort Order'] || row.sortOrder) || (values.length + 1);
            if (!id) return;
            const existingIndex = values.findIndex(v => v.id === id);
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
      await updateDoc(doc(db, 'enterprises', enterprise.id), { [field]: newAttrs });
    } else if (type === 'resourceRates') {
      const currentResources = [...(enterprise.resourceRates || [])];
      data.forEach(row => {
        const id = row.ID?.toString() || row.id?.toString();
        const name = row.Name?.toString() || row.name?.toString() || '';
        const category = row.Category?.toString() || row.category?.toString() || '';
        const unit = row.Unit?.toString() || row.unit?.toString() || '';
        const rate = parseFloat(row.Rate || row.rate) || 0;
        if (!id) return;
        const existingIndex = currentResources.findIndex(r => r.id === id);
        if (existingIndex > -1) {
          currentResources[existingIndex] = { ...currentResources[existingIndex], name, category, unit, rate };
        } else {
          currentResources.push({ id, name, category, unit, rate });
        }
      });
      await updateDoc(doc(db, 'enterprises', enterprise.id), { resourceRates: currentResources });
    } else if (type === 'users') {
      const currentUsers = { ...(enterprise.users || {}) };
      data.forEach(row => {
        const email = row.Email?.toString() || row.email?.toString();
        if (!email) return;
        const name = row.Name?.toString() || row.name?.toString() || row.DisplayName?.toString() || row.displayName?.toString() || '';
        const role = row.Role?.toString() || row.role?.toString() || 'Enterprise User';
        
        // Find existing user by email
        const existingUid = Object.keys(currentUsers).find(uid => currentUsers[uid].email.toLowerCase() === email.toLowerCase());
        if (existingUid) {
          currentUsers[existingUid] = { ...currentUsers[existingUid], displayName: name || currentUsers[existingUid].displayName, role };
        } else {
          // For new users via import, we can't create a real Firebase Auth user here easily, 
          // but we can add them to the enterprise users map. 
          // They'll need to sign up with that email to gain access.
          const tempUid = `imported_${Math.random().toString(36).substring(2, 9)}`;
          currentUsers[tempUid] = { email, displayName: name, role, joinedAt: new Date().toISOString() };
        }
      });
      await updateDoc(doc(db, 'enterprises', enterprise.id), { users: currentUsers });
    } else if (type === 'projects') {
      for (const row of data) {
        const code = row.Code?.toString() || row.code?.toString() || row.ProjectCode?.toString() || row.projectCode?.toString();
        const name = row.Name?.toString() || row.name?.toString() || row.ProjectName?.toString() || row.projectName?.toString() || '';
        if (!code) continue;

        const existingProject = projects.find(p => p.projectCode === code);
        if (existingProject) {
          await updateDoc(doc(db, 'projects', existingProject.id), { projectName: name || existingProject.projectName });
        } else {
          await addDoc(collection(db, 'projects'), {
            enterpriseId: enterprise.id,
            projectCode: code,
            projectName: name,
            dateCreated: new Date().toISOString(),
            dateLastModified: new Date().toISOString(),
            users: { [auth.currentUser?.uid || '']: 'Project Admin' },
            sheets: []
          });
        }
      }
    } else if (type === 'costElements') {
      const currentElements = [...(enterprise.costElements || [])];
      data.forEach(row => {
        const id = row.ID?.toString() || row.id?.toString();
        const description = row.Description?.toString() || row.description?.toString() || '';
        const sortCode = (row['Sort Code'] || row.sortCode || '').toString().padStart(2, '0');
        if (!id) return;
        const existingIndex = currentElements.findIndex(e => e.id === id);
        if (existingIndex > -1) {
          currentElements[existingIndex] = { ...currentElements[existingIndex], description, sortCode };
        } else {
          currentElements.push({ id, description, sortCode });
        }
      });
      await updateDoc(doc(db, 'enterprises', enterprise.id), { costElements: currentElements });
    }

    setImportPreview(null);
    setShowImportSuccessModal(true);
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enterprise || !newProjectData.code.trim()) return;

    const codeExists = projects.some(p => p.projectCode === newProjectData.code);
    if (codeExists) {
      alert('This Project Code already exists!');
      return;
    }

    try {
      setIsSubmitting(true);
      const now = new Date().toISOString();
      const finalName = newProjectData.name.trim() || 'Project Name';
      await addDoc(collection(db, 'projects'), {
        enterpriseId: enterprise.id,
        projectName: finalName,
        projectCode: newProjectData.code,
        projectBudget: 0,
        startDate: now.split('T')[0],
        endDate: now.split('T')[0],
        cutoffDate: now.split('T')[0],
        users: { [auth.currentUser?.uid || '']: 'Project Admin' },
        dateCreated: now,
        dateLastModified: now,
        sheets: [],
        status: 'Active'
      });
      setIsCreateProjectModalOpen(false);
      setNewProjectData({ name: '', code: '' });
    } catch (error) {
      console.error('Failed to create project', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const addResourceRate = async (resource: any, index?: number) => {
    try {
      setIsSubmitting(true);
      const currentResources = [...(enterprise.resourceRates || [])];
      if (currentResources.some(r => r.id === resource.id)) {
        alert(`Resource ID "${resource.id}" already exists.`);
        setIsSubmitting(false);
        return;
      }
      const finalResource = {
        ...resource,
        name: resource.name.trim() || 'Resource Name'
      };
      
      if (typeof index === 'number') {
        currentResources.splice(index, 0, finalResource);
      } else {
        currentResources.push(finalResource);
      }

      await updateDoc(doc(db, 'enterprises', enterprise.id), {
        resourceRates: currentResources
      });
    } catch (error) {
      console.error('Failed to add resource rate', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateResourceRate = async (id: string, updates: any) => {
    const currentResources = enterprise.resourceRates || [];
    const newResources = currentResources.map(r => r.id === id ? { ...r, ...updates } : r);
    await updateDoc(doc(db, 'enterprises', enterprise.id), {
      resourceRates: newResources
    });
  };

  const deleteResourceRate = async (id: string) => {
    const currentResources = enterprise.resourceRates || [];
    const newResources = currentResources.filter(r => r.id !== id);
    await updateDoc(doc(db, 'enterprises', enterprise.id), {
      resourceRates: newResources
    });
  };

  const addCostElement = async (element: any, index?: number) => {
    try {
      setIsSubmitting(true);
      const currentElements = [...(enterprise.costElements || [])];
      if (currentElements.some(e => e.id === element.id)) {
        alert(`Cost Element ID "${element.id}" already exists.`);
        setIsSubmitting(false);
        return;
      }
      
      if (typeof index === 'number') {
        currentElements.splice(index, 0, element);
      } else {
        currentElements.push(element);
      }

      await updateDoc(doc(db, 'enterprises', enterprise.id), {
        costElements: currentElements
      });
    } catch (error) {
      console.error('Failed to add cost element', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateCostElement = async (id: string, updates: any) => {
    const currentElements = enterprise.costElements || [];
    const newElements = currentElements.map(e => e.id === id ? { ...e, ...updates } : e);
    await updateDoc(doc(db, 'enterprises', enterprise.id), {
      costElements: newElements
    });
  };

  const deleteCostElement = async (id: string) => {
    const currentElements = enterprise.costElements || [];
    const newElements = currentElements.filter(e => e.id !== id);
    await updateDoc(doc(db, 'enterprises', enterprise.id), {
      costElements: newElements
    });
  };

  return (
    <div className="flex h-full bg-gray-50 dark:bg-[#0a0a0a] overflow-hidden transition-colors duration-300">
      {/* Admin Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ width: isSidebarOpen ? 280 : 0, opacity: isSidebarOpen ? 1 : 0 }}
        className="bg-white dark:bg-[#141414] border-r border-gray-200 dark:border-white/10 flex flex-col h-full overflow-hidden transition-all duration-300"
      >
        <div className="p-4 border-b border-gray-200 dark:border-white/10 flex items-center justify-between">
          {isSidebarOpen && (
            <div>
              <h1 className="text-xl font-bold dark:text-white">Enterprise Admin</h1>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mt-1">Console</p>
            </div>
          )}
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors text-gray-500 dark:text-gray-400"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        </div>

        <ScrollArea className="flex-1 py-4">
          <div className="px-4 space-y-6">
            {adminSections.map((section) => (
              <div key={section.title} className="space-y-1">
                <button 
                  onClick={() => toggleSection(section.title)}
                  className="w-full flex items-center justify-between p-2 text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    {section.icon}
                    {section.title}
                  </span>
                  <ChevronDown className={cn("w-3 h-3 transition-transform", !expandedSections.has(section.title) && "-rotate-90")} />
                </button>
                
                <AnimatePresence initial={false}>
                  {expandedSections.has(section.title) && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden space-y-1"
                    >
                      {section.items.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => setActiveTab(item.id)}
                          className={cn(
                            "w-full flex items-center gap-3 py-2.5 px-4 rounded-xl text-sm font-medium transition-all",
                            activeTab === item.id 
                              ? "bg-black text-white dark:bg-white dark:text-black shadow-lg shadow-black/10 dark:shadow-white/10" 
                              : "text-gray-900 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-black dark:hover:text-white"
                          )}
                        >
                          {item.icon}
                          {item.label}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </ScrollArea>
      </motion.aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {!isSidebarOpen && (
          <div className="p-4 border-b border-gray-200 dark:border-white/10 bg-white dark:bg-[#141414] flex items-center gap-4 shrink-0">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors text-gray-500 dark:text-gray-400"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-bold dark:text-white">
              {adminSections.flatMap(s => s.items).find(i => i.id === activeTab)?.label || 'Administration'}
            </h2>
          </div>
        )}
        
        <div className="flex-1 overflow-auto p-8">
          <AnimatePresence mode="wait">
            {activeTab === 'enterpriseSettings' && (
              <motion.div 
                key="enterpriseSettings"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <Card className="lg:col-span-2">
                    <CardHeader>
                      <CardTitle>Enterprise Profile</CardTitle>
                      <CardDescription>Manage your organization's core identity and branding.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Enterprise Name</label>
                          <Input 
                            defaultValue={enterprise.name}
                            onBlur={(e) => handleUpdateEnterprise({ name: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Primary Domain</label>
                          <Input 
                            placeholder="company.com"
                            defaultValue={(enterprise as any).domain}
                            onBlur={(e) => handleUpdateEnterprise({ domain: e.target.value } as any)}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Enterprise Logo</label>
                        <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-white/5 border border-dashed border-gray-200 dark:border-white/10 rounded-xl">
                          {enterprise.logoURL ? (
                            <img src={enterprise.logoURL} className="w-16 h-16 object-contain bg-white rounded-lg border border-gray-100" alt="Logo" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="w-16 h-16 bg-white dark:bg-white/5 rounded-lg border border-gray-100 dark:border-white/10 flex items-center justify-center text-gray-300">
                              <Building2 className="w-8 h-8" />
                            </div>
                          )}
                          <div className="flex-1">
                            <p className="text-xs text-gray-500 mb-2">Recommended size: 512x512px. PNG or SVG preferred.</p>
                            <Button variant="outline" size="sm" onClick={() => enterpriseLogoInputRef.current?.click()}>
                              Change Logo
                            </Button>
                            <input 
                              type="file" 
                              ref={enterpriseLogoInputRef}
                              className="hidden" 
                              accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const reader = new FileReader();
                                  reader.onloadend = () => {
                                    handleUpdateEnterprise({ logoURL: reader.result as string });
                                  };
                                  reader.readAsDataURL(file);
                                }
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>System Status</CardTitle>
                      <CardDescription>Current enterprise health and usage metrics.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between p-3 bg-emerald-50 dark:bg-emerald-500/10 rounded-lg">
                        <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">System Status</span>
                        <Badge variant="outline" className="bg-emerald-500 text-white border-none">Operational</Badge>
                      </div>
                      <div className="space-y-3">
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">Total Projects</span>
                          <span className="font-bold">{projects.length}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">Active Users</span>
                          <span className="font-bold">{Object.keys(enterprise.users || {}).length}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">Storage Used</span>
                          <span className="font-bold">12.4 GB</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </motion.div>
            )}

            {activeTab === 'users' && (
              <motion.div 
                key="users"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="flex-1 flex flex-col min-h-0"
              >
                <div className="mb-4 flex justify-between items-center gap-4 shrink-0">
                  <div className="relative flex-1 max-w-md">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input 
                      type="text"
                      placeholder="Search users by name or email..."
                      value={userSearch}
                      onChange={e => setUserSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-white dark:bg-[#141414] border border-gray-200 dark:border-white/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black/5 dark:text-white"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="gap-2" onClick={() => setInviteModal(true)}>
                      <UserPlus className="w-4 h-4" />
                      Invite User
                    </Button>
                    <button 
                      onClick={() => clearAllFilters('users')}
                      className="p-2 text-gray-400 hover:text-red-600 transition-colors flex items-center gap-1 text-xs font-medium"
                      title="Clear All Filters"
                    >
                      <Filter className="w-4 h-4" /> Clear Filters
                    </button>
                    <div className="relative">
                      <button 
                        onClick={() => setIsSavedViewMenuOpen(isSavedViewMenuOpen === 'users' ? null : 'users')}
                        className="p-2 text-gray-400 hover:text-black dark:hover:text-white flex items-center gap-1 text-xs font-medium"
                      >
                        <Layout className="w-4 h-4" /> Views
                      </button>
                      <AnimatePresence>
                        {isSavedViewMenuOpen === 'users' && (
                          <motion.div 
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            className="absolute right-0 mt-2 w-64 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-xl shadow-xl z-50 p-3"
                          >
                            <div className="mb-3">
                              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Save Current View</p>
                              <div className="flex gap-2">
                                <input 
                                  type="text"
                                  placeholder="View name..."
                                  value={newViewName}
                                  onChange={e => setNewViewName(e.target.value)}
                                  className="flex-1 px-2 py-1 text-xs bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded outline-none dark:text-white"
                                />
                                <button 
                                  onClick={() => saveView('users', newViewName)}
                                  className="px-2 py-1 bg-black dark:bg-white text-white dark:text-black text-[10px] font-bold rounded"
                                >
                                  Save
                                </button>
                              </div>
                            </div>
                            <Separator className="my-2 dark:bg-white/10" />
                            <div className="space-y-1">
                              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Saved Views</p>
                              {savedViews.filter(v => v.tableId === 'users').map(view => (
                                <div key={view.id} className="flex items-center justify-between group">
                                  <button 
                                    onClick={() => applyView(view)}
                                    className="flex-1 text-left px-2 py-1.5 text-xs dark:text-white hover:bg-gray-50 dark:hover:bg-white/5 rounded transition-colors"
                                  >
                                    {view.name}
                                  </button>
                                  <button 
                                    onClick={() => deleteView(view.id)}
                                    className="p-1 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              ))}
                              {savedViews.filter(v => v.tableId === 'users').length === 0 && (
                                <p className="text-[10px] text-gray-500 italic p-2">No saved views</p>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                    <div className="relative">
                      <button 
                        onClick={() => setIsColumnMenuOpen(isColumnMenuOpen === 'users' ? null : 'users')}
                        className="p-2 text-gray-400 hover:text-black dark:hover:text-white flex items-center gap-1 text-xs font-medium"
                      >
                        <Layout className="w-4 h-4" /> Columns
                      </button>
                      <AnimatePresence>
                        {isColumnMenuOpen === 'users' && (
                          <motion.div 
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            className="absolute right-0 mt-2 w-48 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-xl shadow-xl z-50 p-2"
                          >
                            <div className="p-2 flex items-center justify-between border-b border-gray-100 dark:border-white/10 mb-2">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Table Controls</span>
                              <button 
                                onClick={() => setIsFrozen(prev => ({ ...prev, users: !prev.users }))}
                                className={cn(
                                  "p-1 rounded transition-colors",
                                  isFrozen.users ? "text-blue-600 bg-blue-50 dark:bg-blue-500/10" : "text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5"
                                )}
                                title={isFrozen.users ? "Unfreeze First Column" : "Freeze First Column"}
                              >
                                <Lock className="w-3 h-3" />
                              </button>
                            </div>
                            {['photo', 'name', 'email', 'joined', 'access'].map(col => (
                              <label key={col} className="flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-white/5 rounded cursor-pointer transition-colors">
                                <input 
                                  type="checkbox"
                                  checked={visibleColumns.users.includes(col)}
                                  onChange={() => {
                                    const newCols = visibleColumns.users.includes(col)
                                      ? visibleColumns.users.filter(c => c !== col)
                                      : [...visibleColumns.users, col];
                                    setVisibleColumns(prev => ({ ...prev, users: newCols }));
                                  }}
                                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-xs capitalize dark:text-white">{col}</span>
                              </label>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>

                <div className="flex-1 bg-white dark:bg-[#141414] border border-gray-200 dark:border-white/10 rounded-xl overflow-hidden flex flex-col">
                  <div className="flex-1 overflow-auto">
                    <table className="w-full text-left border-collapse min-w-[800px]">
                      <thead>
                        <tr className="border-b border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/2">
                          <th className="p-2 w-10">
                            <input 
                              type="checkbox"
                              checked={filteredUsers.length > 0 && filteredUsers.every(u => selectedUserIds.has(u.uid))}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedUserIds(new Set(filteredUsers.map(u => u.uid)));
                                } else {
                                  setSelectedUserIds(new Set());
                                }
                              }}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                          </th>
                          {visibleColumns.users.includes('photo') && (
                            <th className={`p-2 text-[10px] font-bold uppercase tracking-widest text-gray-400 ${isFrozen.users ? 'sticky left-0 z-20 bg-inherit border-r border-gray-200 dark:border-white/10' : ''}`}>Photo</th>
                          )}
                          {visibleColumns.users.includes('name') && (
                            <th className={`p-2 text-[10px] font-bold uppercase tracking-widest text-gray-400 ${isFrozen.users ? 'sticky left-12 z-20 bg-inherit border-r border-gray-200 dark:border-white/10' : ''}`}>
                              <button onClick={() => setUserSort({ field: 'name', direction: userSort.field === 'name' && userSort.direction === 'asc' ? 'desc' : 'asc' })} className="flex items-center gap-1 hover:text-black dark:hover:text-white transition-colors">
                                Name {userSort.field === 'name' && (userSort.direction === 'asc' ? <ChevronDown className="w-3 h-3" /> : <ChevronDown className="w-3 h-3 rotate-180" />)}
                              </button>
                            </th>
                          )}
                          {visibleColumns.users.includes('email') && (
                            <th className="p-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                              <button onClick={() => setUserSort({ field: 'email', direction: userSort.field === 'email' && userSort.direction === 'asc' ? 'desc' : 'asc' })} className="flex items-center gap-1 hover:text-black dark:hover:text-white transition-colors">
                                Email {userSort.field === 'email' && (userSort.direction === 'asc' ? <ChevronDown className="w-3 h-3" /> : <ChevronDown className="w-3 h-3 rotate-180" />)}
                              </button>
                            </th>
                          )}
                          {visibleColumns.users.includes('joined') && (
                            <th className="p-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                              <button onClick={() => setUserSort({ field: 'joinedAt', direction: userSort.field === 'joinedAt' && userSort.direction === 'asc' ? 'desc' : 'asc' })} className="flex items-center gap-1 hover:text-black dark:hover:text-white transition-colors">
                                Joined {userSort.field === 'joinedAt' && (userSort.direction === 'asc' ? <ChevronDown className="w-3 h-3" /> : <ChevronDown className="w-3 h-3 rotate-180" />)}
                              </button>
                            </th>
                          )}
                          {visibleColumns.users.includes('access') && (
                            <th className="p-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                              <button onClick={() => setUserSort({ field: 'role', direction: userSort.field === 'role' && userSort.direction === 'asc' ? 'desc' : 'asc' })} className="flex items-center gap-1 hover:text-black dark:hover:text-white transition-colors">
                                Access {userSort.field === 'role' && (userSort.direction === 'asc' ? <ChevronDown className="w-3 h-3" /> : <ChevronDown className="w-3 h-3 rotate-180" />)}
                              </button>
                            </th>
                          )}
                          <th className="p-2"></th>
                        </tr>
                        <tr className="border-b border-gray-100 dark:border-white/5 bg-gray-50/20 dark:bg-white/1">
                          <th className="p-2"></th>
                          {visibleColumns.users.includes('photo') && (
                            <th className={`p-2 ${isFrozen.users ? 'sticky left-0 z-20 bg-inherit border-r border-gray-200 dark:border-white/10' : ''}`}></th>
                          )}
                          {visibleColumns.users.includes('name') && (
                            <th className={`p-2 ${isFrozen.users ? 'sticky left-12 z-20 bg-inherit border-r border-gray-200 dark:border-white/10' : ''}`}>
                              <input 
                                type="text"
                                placeholder="Filter Name..."
                                value={columnFilters.users.name || ''}
                                onChange={(e) => setColumnFilters(prev => ({ ...prev, users: { ...prev.users, name: e.target.value } }))}
                                className="w-full px-2 py-1 text-[10px] bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded focus:ring-1 focus:ring-blue-500 outline-none dark:text-white"
                              />
                            </th>
                          )}
                          {visibleColumns.users.includes('email') && (
                            <th className="p-2">
                              <input 
                                type="text"
                                placeholder="Filter Email..."
                                value={columnFilters.users.email || ''}
                                onChange={(e) => setColumnFilters(prev => ({ ...prev, users: { ...prev.users, email: e.target.value } }))}
                                className="w-full px-2 py-1 text-[10px] bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded focus:ring-1 focus:ring-blue-500 outline-none dark:text-white"
                              />
                            </th>
                          )}
                          {visibleColumns.users.includes('joined') && (
                            <th className="p-2">
                              <input 
                                type="text"
                                placeholder="Filter Joined..."
                                value={columnFilters.users.joinedAt || ''}
                                onChange={(e) => setColumnFilters(prev => ({ ...prev, users: { ...prev.users, joinedAt: e.target.value } }))}
                                className="w-full px-2 py-1 text-[10px] bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded focus:ring-1 focus:ring-blue-500 outline-none dark:text-white"
                              />
                            </th>
                          )}
                          {visibleColumns.users.includes('access') && (
                            <th className="p-2">
                              <input 
                                type="text"
                                placeholder="Filter Access..."
                                value={columnFilters.users.role || ''}
                                onChange={(e) => setColumnFilters(prev => ({ ...prev, users: { ...prev.users, role: e.target.value } }))}
                                className="w-full px-2 py-1 text-[10px] bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded focus:ring-1 focus:ring-blue-500 outline-none dark:text-white"
                              />
                            </th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                        {filteredUsers.map((user) => (
                          <tr 
                            key={user.uid} 
                            className={cn(
                              "group hover:bg-gray-50/50 dark:hover:bg-white/2 transition-colors cursor-pointer",
                              selectedUserIds.has(user.uid) && "bg-blue-50/50 dark:bg-blue-500/5"
                            )}
                            onClick={(e) => {
                              if (e.shiftKey) {
                                const lastSelected = Array.from(selectedUserIds).pop();
                                const lastIdx = filteredUsers.findIndex(u => u.uid === lastSelected);
                                const currIdx = filteredUsers.findIndex(u => u.uid === user.uid);
                                const start = Math.min(lastIdx, currIdx);
                                const end = Math.max(lastIdx, currIdx);
                                const toSelect = filteredUsers.slice(start, end + 1).map(u => u.uid);
                                setSelectedUserIds(prev => new Set([...Array.from(prev), ...toSelect]));
                              } else if (e.metaKey || e.ctrlKey) {
                                const newSelected = new Set(selectedUserIds);
                                if (newSelected.has(user.uid)) newSelected.delete(user.uid);
                                else newSelected.add(user.uid);
                                setSelectedUserIds(newSelected);
                              } else {
                                setSelectedUserIds(new Set([user.uid]));
                              }
                            }}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              setContextMenu({ x: e.clientX, y: e.clientY, type: 'user', id: user.uid });
                            }}
                          >
                            <td className="p-2">
                              <input 
                                type="checkbox"
                                checked={selectedUserIds.has(user.uid)}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  const newSelected = new Set(selectedUserIds);
                                  if (e.target.checked) newSelected.add(user.uid);
                                  else newSelected.delete(user.uid);
                                  setSelectedUserIds(newSelected);
                                }}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                            </td>
                            {visibleColumns.users.includes('photo') && (
                              <td className={cn(
                                "p-2",
                                isFrozen.users && "sticky left-0 z-10 bg-inherit border-r border-gray-100 dark:border-white/5"
                              )}>
                                <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center overflow-hidden">
                                  {user.photoURL ? (
                                    <img src={user.photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                  ) : (
                                    <Users className="w-4 h-4 text-gray-400" />
                                  )}
                                </div>
                              </td>
                            )}
                            {visibleColumns.users.includes('name') && (
                              <td className={cn(
                                "p-2",
                                isFrozen.users && "sticky left-12 z-10 bg-inherit border-r border-gray-100 dark:border-white/5"
                              )}>
                                <div className="flex flex-col">
                                  <span className="text-xs font-medium dark:text-white">{user.displayName || user.name || 'Anonymous'}</span>
                                  <span className="text-[10px] text-gray-400">ID: {user.uid.slice(0, 8)}...</span>
                                </div>
                              </td>
                            )}
                            {visibleColumns.users.includes('email') && (
                              <td className="p-2 text-xs text-gray-500 dark:text-gray-400">{user.email}</td>
                            )}
                            {visibleColumns.users.includes('joined') && (
                              <td className="p-2 text-xs text-gray-500 dark:text-gray-400">
                                {user.joinedAt ? new Date(user.joinedAt).toLocaleDateString() : 'N/A'}
                              </td>
                            )}
                            {visibleColumns.users.includes('access') && (
                              <td className="p-2">
                                <Badge variant="outline" className={cn(
                                  "text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5",
                                  user.role === 'Enterprise System Admin' ? "border-blue-200 text-blue-600 bg-blue-50 dark:bg-blue-500/10 dark:border-blue-500/20" : "border-gray-200 text-gray-500 dark:border-white/10 dark:text-gray-400"
                                )}>
                                  {user.role}
                                </Badge>
                              </td>
                            )}
                            <td className="p-2 text-right">
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setContextMenu({ x: e.clientX, y: e.clientY, type: 'user', id: user.uid });
                                }}
                                className="p-1 text-gray-400 hover:text-black dark:hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
          )}

          {activeTab === 'projects' && (
            <motion.div 
              key="projects"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex-1 flex flex-col min-h-0"
            >
              <div className="mb-4 flex justify-between items-center gap-4 shrink-0">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input 
                    type="text"
                    placeholder="Search projects by name or code..."
                    value={projectSearch}
                    onChange={e => setProjectSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-white dark:bg-[#141414] border border-gray-200 dark:border-white/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black/5 dark:text-white"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="gap-2" onClick={() => setIsCreateProjectModalOpen(true)}>
                    <Plus className="w-4 h-4" />
                    Create Project
                  </Button>
                  <button onClick={exportProjects} className="p-2 text-gray-400 hover:text-black dark:hover:text-white" title="Export"><Download className="w-4 h-4" /></button>
                  <button 
                    onClick={() => clearAllFilters('projects')}
                    className="p-2 text-gray-400 hover:text-red-600 transition-colors flex items-center gap-1 text-xs font-medium"
                    title="Clear All Filters"
                  >
                    <Filter className="w-4 h-4" /> Clear Filters
                  </button>
                  <div className="relative">
                    <button 
                      onClick={() => setIsSavedViewMenuOpen(isSavedViewMenuOpen === 'projects' ? null : 'projects')}
                      className="p-2 text-gray-400 hover:text-black dark:hover:text-white flex items-center gap-1 text-xs font-medium"
                    >
                      <Layout className="w-4 h-4" /> Views
                    </button>
                    <AnimatePresence>
                      {isSavedViewMenuOpen === 'projects' && (
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.95, y: 10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: 10 }}
                          className="absolute right-0 mt-2 w-64 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-xl shadow-xl z-50 p-3"
                        >
                          <div className="mb-3">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Save Current View</p>
                            <div className="flex gap-2">
                              <input 
                                type="text"
                                placeholder="View name..."
                                value={newViewName}
                                onChange={e => setNewViewName(e.target.value)}
                                className="flex-1 px-2 py-1 text-xs bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded outline-none dark:text-white"
                              />
                              <button 
                                onClick={() => saveView('projects', newViewName)}
                                className="px-2 py-1 bg-black dark:bg-white text-white dark:text-black text-[10px] font-bold rounded"
                              >
                                Save
                              </button>
                            </div>
                          </div>
                          <div className="space-y-1 max-h-48 overflow-y-auto">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Saved Views</p>
                            {savedViews.filter(v => v.tableId === 'projects').map(view => (
                              <div key={view.id} className="flex items-center justify-between group p-1.5 hover:bg-gray-50 dark:hover:bg-white/5 rounded-lg cursor-pointer">
                                <span onClick={() => applyView(view)} className="text-xs dark:text-white flex-1">{view.name}</span>
                                <button onClick={() => deleteView(view.id)} className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-600 transition-opacity">
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                            {savedViews.filter(v => v.tableId === 'projects').length === 0 && (
                              <p className="text-[10px] text-gray-400 italic p-2">No saved views</p>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <div className="relative">
                    <button onClick={() => setIsColumnMenuOpen(isColumnMenuOpen === 'projects' ? null : 'projects')} className="p-2 text-gray-400 hover:text-black dark:hover:text-white flex items-center gap-1 text-xs font-medium">
                      <Eye className="w-4 h-4" /> Columns
                    </button>
                    <AnimatePresence>
                      {isColumnMenuOpen === 'projects' && (
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.95, y: 10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: 10 }}
                          className="absolute right-0 mt-2 w-48 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-xl shadow-xl z-50 p-2"
                        >
                          {['photo', 'name', 'code', 'created', 'users', 'sheets'].map(col => (
                            <label key={col} className="flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-white/5 rounded-lg cursor-pointer">
                              <input 
                                type="checkbox"
                                checked={visibleColumns.projects.includes(col)}
                                onChange={() => setVisibleColumns(prev => ({
                                  ...prev,
                                  projects: prev.projects.includes(col) ? prev.projects.filter(c => c !== col) : [...prev.projects, col]
                                }))}
                                className="rounded border-gray-300 dark:border-white/10 text-black focus:ring-black"
                              />
                              <span className="text-xs dark:text-white capitalize">{col}</span>
                            </label>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <button onClick={() => setIsFrozen(prev => ({ ...prev, projects: !prev.projects }))} className={`p-2 flex items-center gap-1 text-xs font-medium ${isFrozen.projects ? 'text-blue-600' : 'text-gray-400'}`}>
                    {isFrozen.projects ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />} {isFrozen.projects ? 'Frozen' : 'Freeze'}
                  </button>
                  {selectedProjectIds.size > 0 && (
                    <button 
                      onClick={() => setDeleteConfirm({ type: 'bulk-project', count: selectedProjectIds.size })}
                      className="bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-red-700 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete ({selectedProjectIds.size})
                    </button>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-auto border border-gray-200 dark:border-white/10 rounded-xl">
                <table className="w-full text-left border-collapse min-w-[1000px]">
                  <thead className="bg-black dark:bg-gray-100 sticky top-0 z-20">
                    <tr>
                      <th className={`p-2 w-10 ${isFrozen.projects ? 'sticky left-0 z-30 bg-black dark:bg-gray-100 border-r border-white/10 dark:border-black/10' : ''}`}>
                        <input 
                          type="checkbox"
                          className="rounded border-gray-300 dark:border-white/20"
                          checked={filteredProjects.length > 0 && filteredProjects.every(p => selectedProjectIds.has(p.id))}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedProjectIds(new Set(filteredProjects.map(p => p.id)));
                            else setSelectedProjectIds(new Set());
                          }}
                        />
                      </th>
                      {visibleColumns.projects.includes('photo') && <th className="p-2 w-12 text-[10px] font-bold uppercase tracking-widest text-white dark:text-black">Photo</th>}
                      {visibleColumns.projects.includes('name') && <th onClick={() => handleProjectSort('projectName')} className={`p-2 text-[10px] font-bold uppercase tracking-widest text-white dark:text-black cursor-pointer hover:text-gray-300 dark:hover:text-gray-600 ${isFrozen.projects ? 'sticky left-10 z-30 bg-black dark:bg-gray-100 border-r border-white/10 dark:border-black/10' : ''}`}>Name {projectSort.field === 'projectName' && (projectSort.direction === 'asc' ? '↑' : '↓')}</th>}
                      {visibleColumns.projects.includes('code') && <th onClick={() => handleProjectSort('projectCode')} className="p-2 w-32 text-[10px] font-bold uppercase tracking-widest text-white dark:text-black cursor-pointer hover:text-gray-300 dark:hover:text-gray-600">Code {projectSort.field === 'projectCode' && (projectSort.direction === 'asc' ? '↑' : '↓')}</th>}
                      <th onClick={() => handleProjectSort('status' as any)} className="p-2 text-[10px] font-bold uppercase tracking-widest text-white dark:text-black cursor-pointer hover:text-gray-300 dark:hover:text-gray-600">Status {projectSort.field === 'status' as any && (projectSort.direction === 'asc' ? '↑' : '↓')}</th>
                      {visibleColumns.projects.includes('created') && <th onClick={() => handleProjectSort('dateCreated')} className="p-2 text-[10px] font-bold uppercase tracking-widest text-white dark:text-black cursor-pointer hover:text-gray-300 dark:hover:text-gray-600">Created {projectSort.field === 'dateCreated' && (projectSort.direction === 'asc' ? '↑' : '↓')}</th>}
                      {visibleColumns.projects.includes('users') && <th className="p-2 text-[10px] font-bold uppercase tracking-widest text-white dark:text-black">Users</th>}
                      {visibleColumns.projects.includes('sheets') && <th className="p-2 text-[10px] font-bold uppercase tracking-widest text-white dark:text-black">Sheets</th>}
                      <th className="p-2 w-12 text-[10px] font-bold uppercase tracking-widest text-white dark:text-black text-center">...</th>
                    </tr>
                    <tr className="bg-gray-100/50 dark:bg-white/2 border-b border-gray-200 dark:border-white/10">
                      <th className={`p-2 ${isFrozen.projects ? 'sticky left-0 z-30 bg-gray-100/50 dark:bg-[#1a1a1a] border-r border-gray-200 dark:border-white/10' : ''}`}></th>
                      {visibleColumns.projects.includes('photo') && <th className="p-2"></th>}
                      {visibleColumns.projects.includes('name') && (
                        <th className={`p-2 ${isFrozen.projects ? 'sticky left-10 z-30 bg-gray-100/50 dark:bg-[#1a1a1a] border-r border-gray-200 dark:border-white/10' : ''}`}>
                          <input 
                            type="text"
                            placeholder="Filter Name..."
                            value={columnFilters.projects.name || ''}
                            onChange={(e) => setColumnFilters(prev => ({ ...prev, projects: { ...prev.projects, name: e.target.value } }))}
                            className="w-full px-2 py-1 text-[10px] bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded focus:ring-1 focus:ring-blue-500 outline-none dark:text-white"
                          />
                        </th>
                      )}
                      {visibleColumns.projects.includes('code') && (
                        <th className="p-2 w-32">
                          <input 
                            type="text"
                            placeholder="Filter Code..."
                            value={columnFilters.projects.code || ''}
                            onChange={(e) => setColumnFilters(prev => ({ ...prev, projects: { ...prev.projects, code: e.target.value } }))}
                            className="w-full px-2 py-1 text-[10px] bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded focus:ring-1 focus:ring-blue-500 outline-none dark:text-white"
                          />
                        </th>
                      )}
                      <th className="p-2">
                        <input 
                          type="text"
                          placeholder="Filter Status..."
                          value={columnFilters.projects.status || ''}
                          onChange={(e) => setColumnFilters(prev => ({ ...prev, projects: { ...prev.projects, status: e.target.value } }))}
                          className="w-full px-2 py-1 text-[10px] bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded focus:ring-1 focus:ring-blue-500 outline-none dark:text-white"
                        />
                      </th>
                      {visibleColumns.projects.includes('created') && (
                        <th className="p-2">
                          <input 
                            type="text"
                            placeholder="Filter Created..."
                            value={columnFilters.projects.dateCreated || ''}
                            onChange={(e) => setColumnFilters(prev => ({ ...prev, projects: { ...prev.projects, dateCreated: e.target.value } }))}
                            className="w-full px-2 py-1 text-[10px] bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded focus:ring-1 focus:ring-blue-500 outline-none dark:text-white"
                          />
                        </th>
                      )}
                      {visibleColumns.projects.includes('users') && <th className="p-2"></th>}
                      {visibleColumns.projects.includes('sheets') && <th className="p-2"></th>}
                      <th className="p-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                    {filteredProjects.map(project => (
                      <tr key={project.id} onClick={() => setSelectedProjectId(project.id)} className={`hover:bg-gray-50 dark:hover:bg-white/5 transition-colors cursor-pointer group ${selectedProjectId === project.id ? 'bg-blue-50/50 dark:bg-blue-500/5' : ''}`}>
                        <td className={`p-2 ${isFrozen.projects ? 'sticky left-0 z-10 bg-inherit border-r border-gray-200 dark:border-white/10' : ''}`}>
                          <input 
                            type="checkbox"
                            className="rounded border-gray-300 dark:border-white/20"
                            checked={selectedProjectIds.has(project.id)}
                            onChange={(e) => {
                              e.stopPropagation();
                              toggleProjectSelection(project.id);
                            }}
                          />
                        </td>
                        {visibleColumns.projects.includes('photo') && (
                          <td className="p-2">
                            <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-100 dark:bg-white/5 flex items-center justify-center border border-gray-200 dark:border-white/10">
                              {project.photoURL ? <img src={project.photoURL} alt="" className="w-full h-full object-cover" /> : <Briefcase className="w-4 h-4 text-gray-400" />}
                            </div>
                          </td>
                        )}
                        {visibleColumns.projects.includes('name') && (
                          <td className={`p-2 text-xs font-bold ${selectedProjectId === project.id ? 'text-blue-600 dark:text-blue-400' : 'dark:text-white'} ${isFrozen.projects ? 'sticky left-10 z-10 bg-inherit border-r border-gray-200 dark:border-white/10' : ''}`}>
                            {project.projectName}
                          </td>
                        )}
                        {visibleColumns.projects.includes('code') && <td className="p-2 text-[10px] font-mono text-gray-500 dark:text-gray-400">{project.projectCode}</td>}
                        <td className="p-2">
                          <select 
                            value={project.status || 'Active'}
                            onChange={(e) => handleUpdateProjectStatus(project.id, e.target.value)}
                            className="text-[10px] font-bold uppercase tracking-widest bg-gray-100 dark:bg-white/5 border-none rounded-lg px-2 py-1 text-gray-700 dark:text-gray-300 focus:ring-1 focus:ring-blue-500 outline-none"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <option value="Active">Active</option>
                            <option value="On Hold">On Hold</option>
                            <option value="Closed">Closed</option>
                            <option value="Archived">Archived</option>
                          </select>
                        </td>
                        {visibleColumns.projects.includes('created') && <td className="p-2 text-[10px] text-gray-500 dark:text-gray-400">{project.dateCreated ? new Date(project.dateCreated).toLocaleDateString() : 'N/A'}</td>}
                        {visibleColumns.projects.includes('users') && <td className="p-2 text-[10px] text-gray-500 dark:text-gray-400">{Object.keys(project.users || {}).length}</td>}
                        {visibleColumns.projects.includes('sheets') && <td className="p-2 text-[10px] text-gray-500 dark:text-gray-400">{sheets.filter(s => s.projectId === project.id).length}</td>}
                        <td className="p-2 text-right">
                          <div className="flex items-center justify-end gap-1 opacity-40 group-hover:opacity-100 transition-opacity">
                            <div className="relative">
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveMenuId(activeMenuId === `project-${project.id}` ? null : `project-${project.id}`);
                                }}
                                className="p-1.5 text-gray-400 hover:text-black dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-white/5"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </button>
                              
                              <AnimatePresence>
                                {activeMenuId === `project-${project.id}` && (
                                  <>
                                    <div 
                                      className="fixed inset-0 z-40" 
                                      onClick={() => setActiveMenuId(null)}
                                    />
                                    <motion.div 
                                      initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                      animate={{ opacity: 1, scale: 1, y: 0 }}
                                      exit={{ opacity: 0, scale: 0.95, y: 10 }}
                                      className={cn(
                                        "absolute right-0 w-48 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-xl shadow-xl z-50 p-2",
                                        filteredProjects.indexOf(project) < 3 ? "top-full mt-2" : "bottom-full mb-2"
                                      )}
                                    >
                                      <button 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setProjectToReplace(project);
                                          setNewProjectCode('');
                                          setReplaceError('');
                                          setIsReplaceIdModalOpen(true);
                                          setActiveMenuId(null);
                                        }}
                                        className="w-full text-left p-2 text-xs dark:text-white hover:bg-gray-50 dark:hover:bg-white/5 rounded-lg flex items-center gap-2"
                                      >
                                        <RefreshCw className="w-3.5 h-3.5" /> Replace Project ID
                                      </button>
                                      <button 
                                        onClick={(e) => { e.stopPropagation(); setActiveMenuId(null); }}
                                        className="w-full text-left p-2 text-xs dark:text-white hover:bg-gray-50 dark:hover:bg-white/5 rounded-lg flex items-center gap-2"
                                      >
                                        <ExternalLink className="w-3.5 h-3.5" /> View Project
                                      </button>
                                      <button 
                                        onClick={(e) => { 
                                          e.stopPropagation(); 
                                          setDeleteConfirm({ type: 'project', id: project.id, name: project.projectName }); 
                                          setActiveMenuId(null);
                                        }} 
                                        className="w-full text-left p-2 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg flex items-center gap-2"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" /> Delete
                                      </button>
                                    </motion.div>
                                  </>
                                )}
                              </AnimatePresence>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {(activeTab === 'projectAttributes' || activeTab === 'lineItemAttributes' || activeTab === 'costCodeAttributes') && (
            <motion.div 
              key="attributes"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex-1 flex gap-8 min-h-0"
            >
              {/* Left Sidebar: 10 Static Rows */}
              <div className="w-80 bg-white dark:bg-[#141414] border border-gray-200 dark:border-white/10 rounded-2xl flex flex-col overflow-hidden">
                <div className="p-4 border-b border-gray-100 dark:border-white/10">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input 
                      type="text"
                      placeholder="Search attributes..."
                      value={attrSearch}
                      onChange={e => setAttrSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg text-xs focus:outline-none dark:text-white"
                    />
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-black">
                      <tr className="border-b border-white/10">
                        <th className="p-2 text-[10px] font-bold uppercase tracking-widest text-white w-12 text-center">#</th>
                        <th className="p-2 text-[10px] font-bold uppercase tracking-widest text-white">Title</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-white/5">
                      {(activeTab === 'projectAttributes' ? projectAttributes : activeTab === 'costCodeAttributes' ? costCodeAttributes : lineItemAttributes).filter(a => a.title.toLowerCase().includes(attrSearch.toLowerCase()) || a.id.includes(attrSearch)).map((attr: any) => (
                        <tr 
                          key={attr.id}
                          onClick={() => setSelectedAttrId(attr.id)}
                          className={`cursor-pointer transition-colors ${selectedAttrId === attr.id ? 'bg-blue-50 dark:bg-blue-500/10' : 'hover:bg-gray-50 dark:hover:bg-white/5'}`}
                        >
                          <td className="p-2 text-xs font-bold text-black dark:text-white text-center">{attr.id}</td>
                          <td className="p-2">
                            <input 
                              type="text"
                              value={attr.title}
                              onChange={(e) => updateAttributeTitle(activeTab === 'projectAttributes' ? 'project' : activeTab === 'costCodeAttributes' ? 'costCode' : 'lineItem', attr.id, e.target.value)}
                              placeholder="Assign Title..."
                              className="w-full bg-transparent border-none p-0 text-sm font-medium focus:ring-0 dark:text-white placeholder:text-gray-300 dark:placeholder:text-gray-600"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Right Side: Value List Editor */}
              <div className="flex-1 bg-white dark:bg-[#141414] border border-gray-200 dark:border-white/10 rounded-2xl flex flex-col overflow-hidden">
                <AnimatePresence mode="wait">
                  {selectedAttrId ? (
                    <motion.div
                      key={selectedAttrId}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="flex-1 flex flex-col min-h-0"
                    >
                    <div className="p-4 border-b border-gray-100 dark:border-white/10 flex justify-between items-center bg-gray-50/50 dark:bg-white/5 shrink-0">
                      <div>
                        <h3 className="text-lg font-bold dark:text-white">
                          Attribute {selectedAttrId}: {(activeTab === 'projectAttributes' ? projectAttributes : activeTab === 'costCodeAttributes' ? costCodeAttributes : lineItemAttributes).find((a: any) => a.id === selectedAttrId)?.title || 'Untitled'}
                        </h3>
                        <p className="text-xs text-gray-900 dark:text-gray-400">Manage the list of allowed values for this attribute.</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="relative">
                          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                          <input 
                            type="text"
                            placeholder="Search values..."
                            value={valueSearch}
                            onChange={e => setValueSearch(e.target.value)}
                            className="pl-10 pr-4 py-2 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-xl text-xs focus:outline-none dark:text-white w-48"
                          />
                        </div>
                        <div className="flex gap-1">
                          <input 
                            type="file" 
                            ref={fileInputRef} 
                            className="hidden" 
                            accept=".xlsx,.xls,.csv"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleImport(activeTab as any, file, selectedAttrId);
                            }}
                          />
                          <button 
                            onClick={() => fileInputRef.current?.click()}
                            className="p-2 text-gray-400 hover:text-black dark:hover:text-white transition-colors"
                            title="Import"
                          >
                            <Upload className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleExport(activeTab === 'projectAttributes' ? 'project' : activeTab === 'costCodeAttributes' ? 'costCode' : 'lineItem', selectedAttrId)}
                            className="p-2 text-gray-400 hover:text-black dark:hover:text-white transition-colors"
                            title="Export"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => clearAllFilters(activeTab)}
                            className="p-2 text-gray-400 hover:text-red-600 transition-colors flex items-center gap-1 text-xs font-medium"
                            title="Clear All Filters"
                          >
                            <Filter className="w-4 h-4" /> Clear Filters
                          </button>
                        </div>
                        <div className="flex gap-1 border-l border-gray-200 dark:border-white/10 pl-4">
                          <div className="relative">
                            <button 
                              onClick={() => setIsSavedViewMenuOpen(isSavedViewMenuOpen === activeTab ? null : activeTab)}
                              className="p-2 text-gray-400 hover:text-black dark:hover:text-white flex items-center gap-1 text-xs font-medium"
                            >
                              <Layout className="w-4 h-4" /> Views
                            </button>
                            <AnimatePresence>
                              {isSavedViewMenuOpen === activeTab && (
                                <motion.div 
                                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                  animate={{ opacity: 1, y: 0, scale: 1 }}
                                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                  className="absolute right-0 mt-2 w-64 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-xl shadow-xl z-50 p-3"
                                >
                                  <div className="mb-3">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Save Current View</p>
                                    <div className="flex gap-2">
                                      <input 
                                        type="text"
                                        placeholder="View name..."
                                        value={newViewName}
                                        onChange={e => setNewViewName(e.target.value)}
                                        className="flex-1 px-2 py-1 text-xs bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded outline-none dark:text-white"
                                      />
                                      <button 
                                        onClick={() => saveView(activeTab, newViewName)}
                                        className="px-2 py-1 bg-black dark:bg-white text-white dark:text-black text-[10px] font-bold rounded"
                                      >
                                        Save
                                      </button>
                                    </div>
                                  </div>
                                  <div className="space-y-1 max-h-48 overflow-y-auto custom-scrollbar">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Saved Views</p>
                                    {savedViews.filter(v => v.tableId === activeTab).map(view => (
                                      <div key={view.id} className="flex items-center justify-between group p-1.5 hover:bg-gray-50 dark:hover:bg-white/5 rounded-lg cursor-pointer">
                                        <span onClick={() => applyView(view)} className="text-xs dark:text-white flex-1">{view.name}</span>
                                        <button onClick={(e) => { e.stopPropagation(); deleteView(view.id); }} className="opacity-40 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-600 transition-opacity">
                                          <Trash2 className="w-3 h-3" />
                                        </button>
                                      </div>
                                    ))}
                                    {savedViews.filter(v => v.tableId === activeTab).length === 0 && (
                                      <p className="text-[10px] text-gray-400 italic p-2 text-center">No saved views</p>
                                    )}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                          <div className="relative">
                            <button onClick={() => setIsColumnMenuOpen(isColumnMenuOpen === activeTab ? null : activeTab)} className="p-2 text-gray-400 hover:text-black dark:hover:text-white flex items-center gap-1 text-xs font-medium">
                              <Eye className="w-4 h-4" /> Columns
                            </button>
                            <AnimatePresence>
                              {isColumnMenuOpen === activeTab && (
                              <motion.div 
                                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                className="absolute right-0 mt-2 w-48 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-xl shadow-xl z-50 p-2"
                              >
                                {['id', 'description', 'sortOrder'].map(col => (
                                  <label key={col} className="flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-white/5 rounded-lg cursor-pointer">
                                    <input 
                                      type="checkbox"
                                      checked={visibleColumns[activeTab].includes(col)}
                                      onChange={() => setVisibleColumns(prev => ({
                                        ...prev,
                                        [activeTab]: prev[activeTab].includes(col) ? prev[activeTab].filter(c => c !== col) : [...prev[activeTab], col]
                                      }))}
                                      className="rounded border-gray-300 dark:border-white/10 text-black focus:ring-black"
                                    />
                                    <span className="text-xs dark:text-white uppercase tracking-widest font-bold">
                                      {col === 'id' ? 'ID' : col === 'sortOrder' ? 'Sort Order' : 'Description'}
                                    </span>
                                  </label>
                                ))}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                        <button onClick={() => setIsFrozen(prev => ({ ...prev, [activeTab]: !prev[activeTab] }))} className={`p-2 flex items-center gap-1 text-xs font-medium ${isFrozen[activeTab] ? 'text-blue-600' : 'text-gray-400'}`}>
                          {isFrozen[activeTab] ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />} {isFrozen[activeTab] ? 'Frozen' : 'Freeze'}
                        </button>
                        {selectedAttrValueIds.size > 0 && (
                          <button 
                            onClick={() => setDeleteConfirm({ type: 'bulk-attr-value', count: selectedAttrValueIds.size })}
                            className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-red-700 transition-colors shadow-lg shadow-red-600/20"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Delete ({selectedAttrValueIds.size})
                          </button>
                        )}
                        <button 
                          onClick={() => {
                            const currentAttr = (activeTab === 'projectAttributes' ? projectAttributes : activeTab === 'costCodeAttributes' ? costCodeAttributes : lineItemAttributes).find((a: any) => a.id === selectedAttrId);
                            setValueFormData({ id: '', description: '', sortOrder: (currentAttr?.values?.length || 0) + 1 });
                            setIsEditingValue({ type: activeTab === 'projectAttributes' ? 'project' : activeTab === 'costCodeAttributes' ? 'costCode' : 'lineItem', attrId: selectedAttrId, valueId: null });
                          }}
                          className="flex items-center gap-2 bg-black dark:bg-white text-white dark:text-black px-4 py-2 rounded-lg text-sm font-medium hover:bg-black/90 dark:hover:bg-white/90 transition-all shadow-lg shadow-black/10"
                        >
                          <Plus className="w-4 h-4" />
                          Add
                        </button>
                      </div>
                    </div>
                      
                      <div className="flex-1 overflow-auto">
                      <table className="w-full text-left border-collapse">
                        <thead className="bg-black dark:bg-gray-100 sticky top-0 z-20">
                          <tr className="border-b border-white/10 dark:border-black/10">
                            <th className={`p-2 w-12 ${isFrozen[activeTab] ? 'sticky left-0 z-30 bg-black dark:bg-gray-100 border-r border-white/10 dark:border-black/10' : ''}`}>
                              <input 
                                type="checkbox" 
                                className="rounded border-gray-300 dark:border-black/20 bg-transparent"
                                checked={
                                  ((activeTab === 'projectAttributes' ? projectAttributes : activeTab === 'costCodeAttributes' ? costCodeAttributes : lineItemAttributes).find((a: any) => a.id === selectedAttrId)?.values || []).length > 0 &&
                                  ((activeTab === 'projectAttributes' ? projectAttributes : activeTab === 'costCodeAttributes' ? costCodeAttributes : lineItemAttributes).find((a: any) => a.id === selectedAttrId)?.values || []).every((v: any) => selectedAttrValueIds.has(v.id))
                                }
                                onChange={(e) => {
                                  const values = (activeTab === 'projectAttributes' ? projectAttributes : activeTab === 'costCodeAttributes' ? costCodeAttributes : lineItemAttributes).find((a: any) => a.id === selectedAttrId)?.values || [];
                                  if (e.target.checked) {
                                    setSelectedAttrValueIds(new Set(values.map((v: any) => v.id)));
                                  } else {
                                    setSelectedAttrValueIds(new Set());
                                  }
                                }}
                              />
                            </th>
                            {visibleColumns[activeTab].includes('id') && <th onClick={() => handleAttrSort('id')} className={`p-2 w-32 text-[10px] font-bold uppercase tracking-widest text-white dark:text-black cursor-pointer hover:text-gray-300 dark:hover:text-gray-600 ${isFrozen[activeTab] ? 'sticky left-12 z-30 bg-black dark:bg-gray-100 border-r border-white/10 dark:border-black/10' : ''}`}>ID {attrSort.field === 'id' && (attrSort.direction === 'asc' ? '↑' : '↓')}</th>}
                            {visibleColumns[activeTab].includes('description') && <th onClick={() => handleAttrSort('description')} className="p-2 text-[10px] font-bold uppercase tracking-widest text-white dark:text-black cursor-pointer hover:text-gray-300 dark:hover:text-gray-600">Description {attrSort.field === 'description' && (attrSort.direction === 'asc' ? '↑' : '↓')}</th>}
                            {visibleColumns[activeTab].includes('sortOrder') && <th onClick={() => handleAttrSort('sortOrder')} className="p-2 w-24 text-[10px] font-bold uppercase tracking-widest text-white dark:text-black cursor-pointer hover:text-gray-300 dark:hover:text-gray-600">Sort Order {attrSort.field === 'sortOrder' && (attrSort.direction === 'asc' ? '↑' : '↓')}</th>}
                            <th className="p-2 w-12 text-[10px] font-bold uppercase tracking-widest text-white dark:text-black text-center sticky right-0 z-30 bg-black dark:bg-gray-100 border-l border-white/10 dark:border-black/10">...</th>
                          </tr>
                          <tr className="bg-gray-100/50 dark:bg-white/2 border-b border-gray-200 dark:border-white/10">
                            <th className={`p-2 ${isFrozen[activeTab] ? 'sticky left-0 z-30 bg-gray-100/50 dark:bg-[#1a1a1a] border-r border-gray-200 dark:border-white/10' : ''}`}></th>
                            {visibleColumns[activeTab].includes('id') && (
                              <th className={`p-2 w-32 ${isFrozen[activeTab] ? 'sticky left-12 z-30 bg-gray-100/50 dark:bg-[#1a1a1a] border-r border-gray-200 dark:border-white/10' : ''}`}>
                                <input 
                                  type="text"
                                  placeholder="Filter ID..."
                                  value={columnFilters[activeTab]?.id || ''}
                                  onChange={(e) => setColumnFilters(prev => ({ ...prev, [activeTab]: { ...prev[activeTab], id: e.target.value } }))}
                                  className="w-full px-2 py-1 text-[10px] bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded focus:ring-1 focus:ring-blue-500 outline-none dark:text-white"
                                />
                              </th>
                            )}
                            {visibleColumns[activeTab].includes('description') && (
                              <th className="p-2">
                                <input 
                                  type="text"
                                  placeholder="Filter Description..."
                                  value={columnFilters[activeTab]?.description || ''}
                                  onChange={(e) => setColumnFilters(prev => ({ ...prev, [activeTab]: { ...prev[activeTab], description: e.target.value } }))}
                                  className="w-full px-2 py-1 text-[10px] bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded focus:ring-1 focus:ring-blue-500 outline-none dark:text-white"
                                />
                              </th>
                            )}
                            {visibleColumns[activeTab].includes('sortOrder') && (
                              <th className="p-2 w-24">
                                <input 
                                  type="text"
                                  placeholder="Filter Sort..."
                                  value={columnFilters[activeTab]?.sortOrder || ''}
                                  onChange={(e) => setColumnFilters(prev => ({ ...prev, [activeTab]: { ...prev[activeTab], sortOrder: e.target.value } }))}
                                  className="w-full px-2 py-1 text-[10px] bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded focus:ring-1 focus:ring-blue-500 outline-none dark:text-white"
                                />
                              </th>
                            )}
                            <th className="p-2"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-white/5">
                          {sortedAttrValues.map((val: any) => (
                            <tr key={val.id} className={`hover:bg-gray-50 dark:hover:bg-white/5 transition-colors group ${selectedAttrValueIds.has(val.id) ? 'bg-blue-50/50 dark:bg-blue-500/5' : ''}`}>
                              <td className={`p-2 ${isFrozen[activeTab] ? 'sticky left-0 z-10 bg-inherit border-r border-gray-200 dark:border-white/10' : ''}`}>
                                <input 
                                  type="checkbox" 
                                  className="rounded border-gray-300 dark:border-white/20 bg-transparent"
                                  checked={selectedAttrValueIds.has(val.id)}
                                  onChange={() => {
                                    const newSelected = new Set(selectedAttrValueIds);
                                    if (newSelected.has(val.id)) {
                                      newSelected.delete(val.id);
                                    } else {
                                      newSelected.add(val.id);
                                    }
                                    setSelectedAttrValueIds(newSelected);
                                  }}
                                />
                              </td>
                              {visibleColumns[activeTab].includes('id') && <td className={`p-2 text-xs font-mono dark:text-white ${isFrozen[activeTab] ? 'sticky left-12 z-10 bg-inherit border-r border-gray-200 dark:border-white/10' : ''}`}>{val.id}</td>}
                              {visibleColumns[activeTab].includes('description') && (
                                <td 
                                  className="p-2 text-xs dark:text-white cursor-pointer hover:bg-gray-100/50 dark:hover:bg-white/5 transition-colors"
                                  onClick={() => {
                                    setEditingValueId(val.id);
                                    setEditingField('description');
                                  }}
                                >
                                  {editingValueId === val.id && editingField === 'description' ? (
                                    <input 
                                      autoFocus
                                      type="text"
                                      defaultValue={val.description}
                                      onBlur={(e) => handleInlineUpdate(val.id, 'description', e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleInlineUpdate(val.id, 'description', e.currentTarget.value);
                                        if (e.key === 'Escape') { setEditingValueId(null); setEditingField(null); }
                                      }}
                                      className="w-full px-2 py-1 text-xs bg-white dark:bg-[#1a1a1a] border border-blue-500 rounded outline-none dark:text-white"
                                    />
                                  ) : (
                                    val.description
                                  )}
                                </td>
                              )}
                              {visibleColumns[activeTab].includes('sortOrder') && (
                                <td 
                                  className="p-2 text-xs dark:text-white cursor-pointer hover:bg-gray-100/50 dark:hover:bg-white/5 transition-colors"
                                  onClick={() => {
                                    setEditingValueId(val.id);
                                    setEditingField('sortOrder');
                                  }}
                                >
                                  {editingValueId === val.id && editingField === 'sortOrder' ? (
                                    <input 
                                      autoFocus
                                      type="number"
                                      defaultValue={val.sortOrder}
                                      onBlur={(e) => handleInlineUpdate(val.id, 'sortOrder', e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleInlineUpdate(val.id, 'sortOrder', e.currentTarget.value);
                                        if (e.key === 'Escape') { setEditingValueId(null); setEditingField(null); }
                                      }}
                                      className="w-20 px-2 py-1 text-xs bg-white dark:bg-[#1a1a1a] border border-blue-500 rounded outline-none dark:text-white"
                                    />
                                  ) : (
                                    val.sortOrder?.toString().padStart(2, '0')
                                  )}
                                </td>
                              )}
                              <td className="p-2 text-right">
                                <div className="flex items-center justify-end gap-1 opacity-40 group-hover:opacity-100 transition-opacity">
                                  <div className="relative">
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveMenuId(activeMenuId === `attr-val-${val.id}` ? null : `attr-val-${val.id}`);
                                      }}
                                      className="p-1.5 text-gray-400 hover:text-black dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-white/5"
                                    >
                                      <MoreVertical className="w-4 h-4" />
                                    </button>
                                    
                                    <AnimatePresence>
                                      {activeMenuId === `attr-val-${val.id}` && (
                                        <>
                                          <div 
                                            className="fixed inset-0 z-40" 
                                            onClick={() => setActiveMenuId(null)}
                                          />
                                          <motion.div 
                                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                            animate={{ opacity: 1, scale: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                                            className={cn(
                                              "absolute right-0 w-48 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-xl shadow-xl z-50 p-2",
                                              sortedAttrValues.indexOf(val) < 3 ? "top-full mt-2" : "bottom-full mb-2"
                                            )}
                                          >
                                            <button 
                                              onClick={() => {
                                                setValueFormData(val);
                                                setIsEditingValue({ type: activeTab === 'projectAttributes' ? 'project' : activeTab === 'costCodeAttributes' ? 'costCode' : 'lineItem', attrId: selectedAttrId, valueId: val.id });
                                                setActiveMenuId(null);
                                              }}
                                              className="w-full text-left p-2 text-xs dark:text-white hover:bg-gray-50 dark:hover:bg-white/5 rounded-lg flex items-center gap-2"
                                            >
                                              <Edit2 className="w-3 h-3" /> Edit
                                            </button>
                                            <button 
                                              onClick={() => {
                                                removeAttributeValue(activeTab === 'projectAttributes' ? 'project' : activeTab === 'costCodeAttributes' ? 'costCode' : 'lineItem', selectedAttrId, val.id);
                                                setActiveMenuId(null);
                                              }}
                                              className="w-full text-left p-2 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg flex items-center gap-2"
                                            >
                                              <Trash2 className="w-3 h-3" /> Delete
                                            </button>
                                          </motion.div>
                                        </>
                                      )}
                                    </AnimatePresence>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        {((activeTab === 'projectAttributes' ? projectAttributes : activeTab === 'costCodeAttributes' ? costCodeAttributes : lineItemAttributes).find((a: any) => a.id === selectedAttrId)?.values || []).length === 0 && (
                            <tr>
                              <td colSpan={5} className="p-12 text-center">
                                <Tag className="w-12 h-12 text-gray-200 dark:text-white/10 mx-auto mb-4" />
                                <p className="text-gray-900 dark:text-gray-400 text-sm">No values defined for this attribute.</p>
                                <button 
                                  onClick={() => {
                                    setValueFormData({ id: '', description: '', sortOrder: 1 });
                                    setIsEditingValue({ type: activeTab === 'projectAttributes' ? 'project' : activeTab === 'costCodeAttributes' ? 'costCode' : 'lineItem', attrId: selectedAttrId, valueId: null });
                                  }}
                                  className="mt-4 text-blue-600 dark:text-blue-400 text-xs font-bold hover:underline"
                                >
                                  Add your first value
                                </button>
                              </td>
                            </tr>
                          )}
                      </table>
                    </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="empty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex-1 flex flex-col items-center justify-center p-12 text-center"
                    >
                      <div className="w-16 h-16 bg-gray-50 dark:bg-white/5 rounded-full flex items-center justify-center mb-6">
                        <ChevronRight className="w-8 h-8 text-gray-300" />
                      </div>
                      <h3 className="text-lg font-bold dark:text-white mb-2">Select an Attribute</h3>
                      <p className="text-sm text-gray-900 dark:text-gray-400 max-w-xs">Choose one of the 10 static attributes from the left sidebar to manage its values.</p>
                    </motion.div>
                  )}
                </AnimatePresence>
            </div>
          </motion.div>
        )}

        {activeTab === 'costElements' && (
          <motion.div 
            key="costElements"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex-1 flex flex-col min-h-0 bg-white dark:bg-[#141414] border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden"
          >
              <div className="p-6 border-b border-gray-100 dark:border-white/10 flex justify-between items-center bg-gray-50/50 dark:bg-white/5 shrink-0">
                <div>
                  <h3 className="text-xl font-bold dark:text-white">Enterprise Cost Elements</h3>
                  <p className="text-sm text-gray-900 dark:text-gray-400">Define standard cost elements for enterprise-wide financial tracking.</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input 
                      type="text" 
                      placeholder="Search cost elements..."
                      value={costElementSearch}
                      onChange={(e) => setCostElementSearch(e.target.value)}
                      className="pl-10 pr-4 py-2 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-xl text-xs focus:outline-none w-64 dark:text-white"
                    />
                  </div>
                  <div className="flex gap-1">
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      className="hidden" 
                      accept=".xlsx,.xls,.csv"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImport('costElements', file);
                      }}
                    />
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="p-2 text-gray-400 hover:text-black dark:hover:text-white transition-colors"
                      title="Import"
                    >
                      <Upload className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleExport('costElements')}
                      className="p-2 text-gray-400 hover:text-black dark:hover:text-white transition-colors"
                      title="Export"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => clearAllFilters('costElements')}
                      className="p-2 text-gray-400 hover:text-red-600 transition-colors flex items-center gap-1 text-xs font-medium"
                      title="Clear All Filters"
                    >
                      <Filter className="w-4 h-4" /> Clear Filters
                    </button>
                  </div>
                  <div className="flex gap-1 border-l border-gray-200 dark:border-white/10 pl-4">
                    <div className="relative">
                      <button 
                        onClick={() => setIsSavedViewMenuOpen(isSavedViewMenuOpen === 'costElements' ? null : 'costElements')}
                        className="p-2 text-gray-400 hover:text-black dark:hover:text-white flex items-center gap-1 text-xs font-medium"
                      >
                        <Layout className="w-4 h-4" /> Views
                      </button>
                      <AnimatePresence>
                        {isSavedViewMenuOpen === 'costElements' && (
                          <motion.div 
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            className="absolute right-0 mt-2 w-64 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-xl shadow-xl z-50 p-3"
                          >
                            <div className="mb-3">
                              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Save Current View</p>
                              <div className="flex gap-2">
                                <input 
                                  type="text"
                                  placeholder="View name..."
                                  value={newViewName}
                                  onChange={e => setNewViewName(e.target.value)}
                                  className="flex-1 px-2 py-1 text-xs bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded outline-none dark:text-white"
                                />
                                <button 
                                  onClick={() => saveView('costElements', newViewName)}
                                  className="px-2 py-1 bg-black dark:bg-white text-white dark:text-black text-[10px] font-bold rounded"
                                >
                                  Save
                                </button>
                              </div>
                            </div>
                            <div className="space-y-1 max-h-48 overflow-y-auto custom-scrollbar">
                              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Saved Views</p>
                              {savedViews.filter(v => v.tableId === 'costElements').map(view => (
                                <div key={view.id} className="flex items-center justify-between group p-1.5 hover:bg-gray-50 dark:hover:bg-white/5 rounded-lg cursor-pointer">
                                  <span onClick={() => applyView(view)} className="text-xs dark:text-white flex-1">{view.name}</span>
                                  <button onClick={(e) => { e.stopPropagation(); deleteView(view.id); }} className="opacity-40 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-600 transition-opacity">
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              ))}
                              {savedViews.filter(v => v.tableId === 'costElements').length === 0 && (
                                <p className="text-[10px] text-gray-400 italic p-2 text-center">No saved views</p>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                    <div className="relative">
                      <button onClick={() => setIsColumnMenuOpen(isColumnMenuOpen === 'costElements' ? null : 'costElements')} className="p-2 text-gray-400 hover:text-black dark:hover:text-white flex items-center gap-1 text-xs font-medium">
                        <Eye className="w-4 h-4" /> Columns
                      </button>
                      <AnimatePresence>
                        {isColumnMenuOpen === 'costElements' && (
                          <motion.div 
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            className="absolute right-0 mt-2 w-48 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-xl shadow-xl z-50 p-2"
                          >
                            {['id', 'description', 'sortCode'].map(col => (
                              <label key={col} className="flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-white/5 rounded-lg cursor-pointer">
                                <input 
                                  type="checkbox"
                                  checked={visibleColumns.costElements.includes(col)}
                                  onChange={() => setVisibleColumns(prev => ({
                                    ...prev,
                                    costElements: prev.costElements.includes(col) ? prev.costElements.filter(c => c !== col) : [...prev.costElements, col]
                                  }))}
                                  className="rounded border-gray-300 dark:border-white/10 text-black focus:ring-black"
                                />
                                <span className="text-[10px] font-bold uppercase tracking-widest dark:text-white">{col}</span>
                              </label>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                    <button onClick={() => setIsFrozen(prev => ({ ...prev, costElements: !prev.costElements }))} className={cn("p-2 flex items-center gap-1 text-xs font-medium transition-colors", isFrozen.costElements ? "text-blue-600" : "text-gray-400 hover:text-black dark:hover:text-white")}>
                      {isFrozen.costElements ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />} {isFrozen.costElements ? 'Frozen' : 'Freeze'}
                    </button>
                  </div>
                  {selectedCostElementIds.size > 0 && (
                    <button 
                      onClick={() => setDeleteConfirm({ type: 'bulk-costElement', count: selectedCostElementIds.size })}
                      className="px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-red-700 transition-colors shadow-lg shadow-red-600/20"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete ({selectedCostElementIds.size})
                    </button>
                  )}
                  <button 
                    onClick={() => {
                      setCostElementFormData({ id: '', description: '', sortCode: '' });
                      setIsEditingCostElement({ id: null });
                    }}
                    className="flex items-center gap-2 bg-black dark:bg-white text-white dark:text-black px-4 py-2 rounded-lg text-sm font-medium hover:bg-black/90 dark:hover:bg-white/90 transition-all shadow-lg shadow-black/10"
                  >
                    <Plus className="w-4 h-4" />
                    Add
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-black dark:bg-gray-100 sticky top-0 z-20">
                    <tr className="border-b border-white/10 dark:border-black/10">
                      <th className={`p-2 w-12 ${isFrozen.costElements ? 'sticky left-0 z-30 bg-black dark:bg-gray-100 border-r border-white/10 dark:border-black/10' : ''}`}>
                        <input 
                          type="checkbox" 
                          className="rounded border-gray-300 dark:border-black/20 bg-transparent"
                          checked={(enterprise.costElements || []).length > 0 && (enterprise.costElements || []).every(e => selectedCostElementIds.has(e.id))}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedCostElementIds(new Set((enterprise.costElements || []).map(e => e.id)));
                            } else {
                              setSelectedCostElementIds(new Set());
                            }
                          }}
                        />
                      </th>
                      {visibleColumns.costElements.includes('id') && (
                        <th 
                          onClick={() => setCostElementSort(prev => ({ field: 'id', direction: prev.field === 'id' && prev.direction === 'asc' ? 'desc' : 'asc' }))}
                          className={`p-2 w-32 text-[10px] font-bold uppercase tracking-widest text-white dark:text-black cursor-pointer hover:text-gray-300 dark:hover:text-gray-600 ${isFrozen.costElements ? 'sticky left-12 z-30 bg-black dark:bg-gray-100 border-r border-white/10 dark:border-black/10' : ''}`}
                        >
                          ID {costElementSort.field === 'id' && (costElementSort.direction === 'asc' ? '↑' : '↓')}
                        </th>
                      )}
                      {visibleColumns.costElements.includes('description') && (
                        <th 
                          className="p-2 text-[10px] font-bold uppercase tracking-widest text-white dark:text-black cursor-pointer hover:text-gray-300 dark:hover:text-gray-600"
                          onClick={() => setCostElementSort(prev => ({ field: 'description', direction: prev.field === 'description' && prev.direction === 'asc' ? 'desc' : 'asc' }))}
                        >
                          Description {costElementSort.field === 'description' && (costElementSort.direction === 'asc' ? '↑' : '↓')}
                        </th>
                      )}
                      {visibleColumns.costElements.includes('sortCode') && (
                        <th 
                          className="p-2 w-20 text-[10px] font-bold uppercase tracking-widest text-white dark:text-black cursor-pointer hover:text-gray-300 dark:hover:text-gray-600"
                          onClick={() => setCostElementSort(prev => ({ field: 'sortCode', direction: prev.field === 'sortCode' && prev.direction === 'asc' ? 'desc' : 'asc' }))}
                        >
                          Sort {costElementSort.field === 'sortCode' && (costElementSort.direction === 'asc' ? '↑' : '↓')}
                        </th>
                      )}
                      <th className="p-2 w-12 text-[10px] font-bold uppercase tracking-widest text-white dark:text-black sticky right-0 z-30 bg-black dark:bg-gray-100 border-l border-white/10 dark:border-black/10 text-center">...</th>
                    </tr>
                    <tr className="bg-gray-100/50 dark:bg-white/2 border-b border-gray-200 dark:border-white/10">
                      <th className={`p-2 ${isFrozen.costElements ? 'sticky left-0 z-30 bg-gray-100/50 dark:bg-[#1a1a1a] border-r border-gray-200 dark:border-white/10' : ''}`}></th>
                      {visibleColumns.costElements.includes('id') && (
                        <th className={`p-2 w-32 ${isFrozen.costElements ? 'sticky left-12 z-30 bg-gray-100/50 dark:bg-[#1a1a1a] border-r border-gray-200 dark:border-white/10' : ''}`}>
                          <input 
                            type="text"
                            placeholder="Filter ID..."
                            value={columnFilters.costElements?.id || ''}
                            onChange={(e) => setColumnFilters(prev => ({ ...prev, costElements: { ...prev.costElements, id: e.target.value } }))}
                            className="w-full px-2 py-1 text-[10px] bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded focus:ring-1 focus:ring-blue-500 outline-none dark:text-white"
                          />
                        </th>
                      )}
                      {visibleColumns.costElements.includes('description') && (
                        <th className="p-2">
                          <input 
                            type="text"
                            placeholder="Filter Description..."
                            value={columnFilters.costElements?.description || ''}
                            onChange={(e) => setColumnFilters(prev => ({ ...prev, costElements: { ...prev.costElements, description: e.target.value } }))}
                            className="w-full px-2 py-1 text-[10px] bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded focus:ring-1 focus:ring-blue-500 outline-none dark:text-white"
                          />
                        </th>
                      )}
                      {visibleColumns.costElements.includes('sortCode') && (
                        <th className="p-2 w-20">
                          <input 
                            type="text"
                            placeholder="Filter Sort Code..."
                            value={columnFilters.costElements?.sortCode || ''}
                            onChange={(e) => setColumnFilters(prev => ({ ...prev, costElements: { ...prev.costElements, sortCode: e.target.value } }))}
                            className="w-full px-2 py-1 text-[10px] bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded focus:ring-1 focus:ring-blue-500 outline-none dark:text-white"
                          />
                        </th>
                      )}
                      <th className="p-2 sticky right-0 z-30 bg-gray-100/50 dark:bg-[#1a1a1a] border-l border-gray-200 dark:border-white/10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-white/5">
                    {filteredCostElements.map((element, index) => (
                      <tr key={element.id} className={`hover:bg-gray-50 dark:hover:bg-white/5 transition-colors group ${selectedCostElementIds.has(element.id) ? 'bg-blue-50/50 dark:bg-blue-500/5' : ''}`}>
                        <td className={`p-2 ${isFrozen.costElements ? 'sticky left-0 z-10 bg-inherit border-r border-gray-100 dark:border-white/10' : ''}`}>
                          <input 
                            type="checkbox" 
                            className="rounded border-gray-300 dark:border-white/20 bg-transparent"
                            checked={selectedCostElementIds.has(element.id)}
                            onChange={() => {
                              const newSelected = new Set(selectedCostElementIds);
                              if (newSelected.has(element.id)) {
                                newSelected.delete(element.id);
                              } else {
                                newSelected.add(element.id);
                              }
                              setSelectedCostElementIds(newSelected);
                            }}
                          />
                        </td>
                        {visibleColumns.costElements.includes('id') && <td className={`p-2 w-32 text-xs font-mono dark:text-white ${isFrozen.costElements ? 'sticky left-12 z-10 bg-inherit border-r border-gray-100 dark:border-white/10' : ''}`}>{element.id}</td>}
                        {visibleColumns.costElements.includes('description') && <td className="p-2 text-xs font-bold dark:text-white truncate max-w-[400px]" title={element.description}>{element.description}</td>}
                        {visibleColumns.costElements.includes('sortCode') && <td className="p-2 w-20 text-xs text-gray-500 dark:text-gray-400">{element.sortCode}</td>}
                        <td className="p-2 sticky right-0 z-10 bg-inherit border-l border-gray-100 dark:border-white/10">
                          <div className="flex justify-end gap-1 opacity-40 group-hover:opacity-100 transition-opacity">
                            <div className="relative">
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveMenuId(activeMenuId === `ce-${element.id}` ? null : `ce-${element.id}`);
                                }}
                                className="p-1.5 text-gray-400 hover:text-black dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-white/5"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </button>
                              
                              <AnimatePresence>
                                {activeMenuId === `ce-${element.id}` && (
                                  <>
                                    <div 
                                      className="fixed inset-0 z-40" 
                                      onClick={() => setActiveMenuId(null)}
                                    />
                                    <motion.div 
                                      initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                      animate={{ opacity: 1, scale: 1, y: 0 }}
                                      exit={{ opacity: 0, scale: 0.95, y: 10 }}
                                      className={cn(
                                        "absolute right-0 w-48 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-xl shadow-xl z-50 p-2",
                                        filteredCostElements.indexOf(element) < 3 ? "top-full mt-2" : "bottom-full mb-2"
                                      )}
                                    >
                                      <button 
                                        onClick={() => {
                                          const index = (enterprise.costElements || []).findIndex(e => e.id === element.id);
                                          setCostElementFormData({ id: '', description: '', sortCode: '' });
                                          setIsEditingCostElement({ id: null, insertIndex: index });
                                          setActiveMenuId(null);
                                        }}
                                        className="w-full text-left p-2 text-xs dark:text-white hover:bg-gray-50 dark:hover:bg-white/5 rounded-lg flex items-center gap-2"
                                      >
                                        <Plus className="w-3 h-3" /> Insert Above
                                      </button>
                                      <button 
                                        onClick={() => {
                                          const index = (enterprise.costElements || []).findIndex(e => e.id === element.id);
                                          setCostElementFormData({ id: '', description: '', sortCode: '' });
                                          setIsEditingCostElement({ id: null, insertIndex: index + 1 });
                                          setActiveMenuId(null);
                                        }}
                                        className="w-full text-left p-2 text-xs dark:text-white hover:bg-gray-50 dark:hover:bg-white/5 rounded-lg flex items-center gap-2"
                                      >
                                        <Plus className="w-3 h-3" /> Insert Below
                                      </button>
                                      <hr className="my-1 border-gray-100 dark:border-white/10" />
                                      <button 
                                        onClick={() => {
                                          setCostElementFormData({ 
                                            id: element.id, 
                                            description: element.description, 
                                            sortCode: element.sortCode
                                          });
                                          setIsEditingCostElement({ id: element.id });
                                          setActiveMenuId(null);
                                        }}
                                        className="w-full text-left p-2 text-xs dark:text-white hover:bg-gray-50 dark:hover:bg-white/5 rounded-lg flex items-center gap-2"
                                      >
                                        <Edit2 className="w-3 h-3" /> Edit
                                      </button>
                                      <button 
                                        onClick={() => {
                                          setDeleteConfirm({ type: 'costElement', id: element.id, name: element.description });
                                          setActiveMenuId(null);
                                        }}
                                        className="w-full text-left p-2 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg flex items-center gap-2"
                                      >
                                        <Trash2 className="w-3 h-3" /> Delete
                                      </button>
                                    </motion.div>
                                  </>
                                )}
                              </AnimatePresence>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredCostElements.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-12 text-center">
                          <div className="w-16 h-16 bg-gray-50 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                            <PieChart className="w-8 h-8 text-gray-300" />
                          </div>
                          <p className="text-gray-900 dark:text-gray-400 text-sm">No cost elements found matching your search.</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {activeTab === 'resourceRates' && (
            <motion.div 
              key="resourceRates"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex-1 flex flex-col min-h-0 bg-white dark:bg-[#141414] border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden"
            >
              <div className="p-4 border-b border-gray-100 dark:border-white/10 flex flex-wrap gap-4 items-center justify-between bg-white dark:bg-[#141414] shrink-0">
                <div className="flex items-center gap-4 flex-1 min-w-[300px]">
                  <div className="relative flex-1 max-w-md">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input 
                      type="text" 
                      placeholder="Search resources..."
                      value={resourceSearch}
                      onChange={(e) => setResourceSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      className="hidden" 
                      accept=".xlsx,.xls,.csv"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImport('resourceRates', file);
                      }}
                    />
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="p-2 text-gray-400 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors"
                      title="Import"
                    >
                      <Upload className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleExport('resourceRates')}
                      className="p-2 text-gray-400 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors"
                      title="Export"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => clearAllFilters('resourceRates')}
                    className="h-9 px-3 text-gray-400 hover:text-red-600 transition-colors flex items-center gap-2 text-xs font-medium hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg"
                  >
                    <Filter className="w-3.5 h-3.5" /> Clear Filters
                  </button>

                  <div className="h-4 w-[1px] bg-gray-200 dark:bg-white/10 mx-1" />

                  <div className="relative">
                    <button 
                      onClick={() => setIsSavedViewMenuOpen(isSavedViewMenuOpen === 'resourceRates' ? null : 'resourceRates')}
                      className={cn(
                        "h-9 px-3 flex items-center gap-2 text-xs font-medium rounded-lg transition-colors",
                        isSavedViewMenuOpen === 'resourceRates' 
                          ? "bg-gray-100 dark:bg-white/10 text-black dark:text-white" 
                          : "text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5"
                      )}
                    >
                      <Layout className="w-3.5 h-3.5" /> Views
                    </button>
                    <AnimatePresence>
                      {isSavedViewMenuOpen === 'resourceRates' && (
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.95, y: 10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: 10 }}
                          className="absolute right-0 mt-2 w-64 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-xl shadow-xl z-50 p-3"
                        >
                          <div className="mb-3">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Save Current View</p>
                            <div className="flex gap-2">
                              <input 
                                type="text"
                                placeholder="View name..."
                                value={newViewName}
                                onChange={e => setNewViewName(e.target.value)}
                                className="flex-1 px-2 py-1.5 text-xs bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg outline-none dark:text-white focus:ring-1 focus:ring-blue-500"
                              />
                              <button 
                                onClick={() => saveView('resourceRates', newViewName)}
                                className="px-3 py-1.5 bg-black dark:bg-white text-white dark:text-black text-[10px] font-bold rounded-lg hover:opacity-90 transition-opacity"
                              >
                                Save
                              </button>
                            </div>
                          </div>
                          <div className="space-y-1 max-h-48 overflow-y-auto">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Saved Views</p>
                            {savedViews.filter(v => v.tableId === 'resourceRates').map(view => (
                              <div key={view.id} className="flex items-center justify-between group p-2 hover:bg-gray-50 dark:hover:bg-white/5 rounded-lg cursor-pointer transition-colors">
                                <span onClick={() => applyView(view)} className="text-xs dark:text-white flex-1">{view.name}</span>
                                <button onClick={() => deleteView(view.id)} className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-600 transition-all">
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                            {savedViews.filter(v => v.tableId === 'resourceRates').length === 0 && (
                              <p className="text-[10px] text-gray-400 italic p-2 text-center">No saved views</p>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="relative">
                    <button 
                      onClick={() => setIsColumnMenuOpen(isColumnMenuOpen === 'resourceRates' ? null : 'resourceRates')}
                      className={cn(
                        "h-9 px-3 flex items-center gap-2 text-xs font-medium rounded-lg transition-colors",
                        isColumnMenuOpen === 'resourceRates' 
                          ? "bg-gray-100 dark:bg-white/10 text-black dark:text-white" 
                          : "text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5"
                      )}
                    >
                      <Eye className="w-3.5 h-3.5" /> Columns
                    </button>
                    <AnimatePresence>
                      {isColumnMenuOpen === 'resourceRates' && (
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.95, y: 10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: 10 }}
                          className="absolute right-0 mt-2 w-48 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-xl shadow-xl z-50 p-2"
                        >
                          {['id', 'name', 'category', 'unit', 'rate', 'udf1', 'udf2', 'udf3'].map(col => (
                            <label key={col} className="flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-white/5 rounded-lg cursor-pointer transition-colors">
                              <input 
                                type="checkbox"
                                checked={visibleColumns.resourceRates.includes(col)}
                                onChange={() => setVisibleColumns(prev => ({
                                  ...prev,
                                  resourceRates: prev.resourceRates.includes(col) ? prev.resourceRates.filter(c => c !== col) : [...prev.resourceRates, col]
                                }))}
                                className="rounded border-gray-300 dark:border-white/10 text-black focus:ring-black"
                              />
                              <span className="text-xs dark:text-white uppercase tracking-tighter">{col}</span>
                            </label>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <button 
                    onClick={() => setIsFrozen(prev => ({ ...prev, resourceRates: !prev.resourceRates }))} 
                    className={cn(
                      "h-9 px-3 flex items-center gap-2 text-xs font-medium rounded-lg transition-colors",
                      isFrozen.resourceRates 
                        ? "bg-blue-50 dark:bg-blue-500/10 text-blue-600" 
                        : "text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5"
                    )}
                  >
                    {isFrozen.resourceRates ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />} 
                    {isFrozen.resourceRates ? 'Frozen' : 'Freeze'}
                  </button>

                  <div className="h-4 w-[1px] bg-gray-200 dark:bg-white/10 mx-1" />

                  {selectedRateIds.size > 0 && (
                    <button 
                      onClick={() => setDeleteConfirm({ type: 'bulk-rate', count: selectedRateIds.size })}
                      className="h-9 px-4 bg-red-600 text-white rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-red-700 transition-all shadow-sm"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete ({selectedRateIds.size})
                    </button>
                  )}
                  <button 
                    onClick={() => {
                      setResourceFormData({ id: '', name: '', unit: '', rate: 0, category: '', udf1: '', udf2: '', udf3: '' });
                      setIsEditingResource({ id: null });
                    }}
                    className="h-9 px-4 bg-black dark:bg-white text-white dark:text-black rounded-lg text-xs font-bold flex items-center gap-2 hover:opacity-90 transition-all shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Resource
                  </button>
                </div>
              </div>
              
              <div className="flex-1 overflow-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-black dark:bg-gray-100 sticky top-0 z-20">
                    <tr className="border-b border-white/10 dark:border-black/10">
                      <th className={`p-2 w-12 ${isFrozen.resourceRates ? 'sticky left-0 z-30 bg-black dark:bg-gray-100 border-r border-white/10 dark:border-black/10' : ''}`}>
                        <input 
                          type="checkbox" 
                          className="rounded border-gray-300 dark:border-black/20 bg-transparent"
                          checked={(enterprise.resourceRates || []).length > 0 && (enterprise.resourceRates || []).every(r => selectedRateIds.has(r.id))}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedRateIds(new Set((enterprise.resourceRates || []).map(r => r.id)));
                            } else {
                              setSelectedRateIds(new Set());
                            }
                          }}
                        />
                      </th>
                      {visibleColumns.resourceRates.includes('id') && <th onClick={() => handleResourceSort('id')} className={`p-2 w-32 text-[10px] font-bold uppercase tracking-widest text-white dark:text-black cursor-pointer hover:text-gray-300 dark:hover:text-gray-600 ${isFrozen.resourceRates ? 'sticky left-12 z-30 bg-black dark:bg-gray-100 border-r border-white/10 dark:border-black/10' : ''}`}>ID {resourceSort.field === 'id' && (resourceSort.direction === 'asc' ? '↑' : '↓')}</th>}
                      {visibleColumns.resourceRates.includes('name') && <th onClick={() => handleResourceSort('name')} className="p-2 text-[10px] font-bold uppercase tracking-widest text-white dark:text-black cursor-pointer hover:text-gray-300 dark:hover:text-gray-600">Resource Name {resourceSort.field === 'name' && (resourceSort.direction === 'asc' ? '↑' : '↓')}</th>}
                      {visibleColumns.resourceRates.includes('category') && <th onClick={() => handleResourceSort('category')} className="p-2 text-[10px] font-bold uppercase tracking-widest text-white dark:text-black cursor-pointer hover:text-gray-300 dark:hover:text-gray-600">Category {resourceSort.field === 'category' && (resourceSort.direction === 'asc' ? '↑' : '↓')}</th>}
                      {visibleColumns.resourceRates.includes('unit') && <th onClick={() => handleResourceSort('unit')} className="p-2 text-[10px] font-bold uppercase tracking-widest text-white dark:text-black cursor-pointer hover:text-gray-300 dark:hover:text-gray-600">Unit {resourceSort.field === 'unit' && (resourceSort.direction === 'asc' ? '↑' : '↓')}</th>}
                      {visibleColumns.resourceRates.includes('rate') && <th onClick={() => handleResourceSort('rate')} className="p-2 text-[10px] font-bold uppercase tracking-widest text-white dark:text-black cursor-pointer hover:text-gray-300 dark:hover:text-gray-600 text-right pr-4">Rate {resourceSort.field === 'rate' && (resourceSort.direction === 'asc' ? '↑' : '↓')}</th>}
                      {visibleColumns.resourceRates.includes('udf1') && <th className="p-2 text-[10px] font-bold uppercase tracking-widest text-white dark:text-black">UDF 1</th>}
                      {visibleColumns.resourceRates.includes('udf2') && <th className="p-2 text-[10px] font-bold uppercase tracking-widest text-white dark:text-black">UDF 2</th>}
                      {visibleColumns.resourceRates.includes('udf3') && <th className="p-2 text-[10px] font-bold uppercase tracking-widest text-white dark:text-black">UDF 3</th>}
                      <th className="p-2 w-12 text-[10px] font-bold uppercase tracking-widest text-white dark:text-black sticky right-0 z-30 bg-black dark:bg-gray-100 border-l border-white/10 dark:border-black/10 text-center">...</th>
                    </tr>
                    <tr className="bg-gray-100/50 dark:bg-white/2 border-b border-gray-200 dark:border-white/10">
                      <th className={`p-2 ${isFrozen.resourceRates ? 'sticky left-0 z-30 bg-gray-100/50 dark:bg-[#1a1a1a] border-r border-gray-200 dark:border-white/10' : ''}`}></th>
                      {visibleColumns.resourceRates.includes('id') && (
                        <th className={`p-2 w-32 ${isFrozen.resourceRates ? 'sticky left-12 z-30 bg-gray-100/50 dark:bg-[#1a1a1a] border-r border-gray-200 dark:border-white/10' : ''}`}>
                          <input 
                            type="text"
                            placeholder="Filter ID..."
                            value={columnFilters.resourceRates.id || ''}
                            onChange={(e) => setColumnFilters(prev => ({ ...prev, resourceRates: { ...prev.resourceRates, id: e.target.value } }))}
                            className="w-full px-2 py-1 text-[10px] bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded focus:ring-1 focus:ring-blue-500 outline-none dark:text-white"
                          />
                        </th>
                      )}
                      {visibleColumns.resourceRates.includes('name') && (
                        <th className="p-2">
                          <input 
                            type="text"
                            placeholder="Filter Name..."
                            value={columnFilters.resourceRates.name || ''}
                            onChange={(e) => setColumnFilters(prev => ({ ...prev, resourceRates: { ...prev.resourceRates, name: e.target.value } }))}
                            className="w-full px-2 py-1 text-[10px] bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded focus:ring-1 focus:ring-blue-500 outline-none dark:text-white"
                          />
                        </th>
                      )}
                      {visibleColumns.resourceRates.includes('category') && (
                        <th className="p-2">
                          <input 
                            type="text"
                            placeholder="Filter Category..."
                            value={columnFilters.resourceRates.category || ''}
                            onChange={(e) => setColumnFilters(prev => ({ ...prev, resourceRates: { ...prev.resourceRates, category: e.target.value } }))}
                            className="w-full px-2 py-1 text-[10px] bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded focus:ring-1 focus:ring-blue-500 outline-none dark:text-white"
                          />
                        </th>
                      )}
                      {visibleColumns.resourceRates.includes('unit') && (
                        <th className="p-2">
                          <input 
                            type="text"
                            placeholder="Filter Unit..."
                            value={columnFilters.resourceRates.unit || ''}
                            onChange={(e) => setColumnFilters(prev => ({ ...prev, resourceRates: { ...prev.resourceRates, unit: e.target.value } }))}
                            className="w-full px-2 py-1 text-[10px] bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded focus:ring-1 focus:ring-blue-500 outline-none dark:text-white"
                          />
                        </th>
                      )}
                      {visibleColumns.resourceRates.includes('rate') && (
                        <th className="p-2">
                          <input 
                            type="text"
                            placeholder="Filter Rate..."
                            value={columnFilters.resourceRates.rate || ''}
                            onChange={(e) => setColumnFilters(prev => ({ ...prev, resourceRates: { ...prev.resourceRates, rate: e.target.value } }))}
                            className="w-full px-2 py-1 text-[10px] bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded focus:ring-1 focus:ring-blue-500 outline-none dark:text-white"
                          />
                        </th>
                      )}
                      {visibleColumns.resourceRates.includes('udf1') && (
                        <th className="p-2">
                          <input 
                            type="text"
                            placeholder="Filter UDF 1..."
                            value={columnFilters.resourceRates.udf1 || ''}
                            onChange={(e) => setColumnFilters(prev => ({ ...prev, resourceRates: { ...prev.resourceRates, udf1: e.target.value } }))}
                            className="w-full px-2 py-1 text-[10px] bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded focus:ring-1 focus:ring-blue-500 outline-none dark:text-white"
                          />
                        </th>
                      )}
                      {visibleColumns.resourceRates.includes('udf2') && (
                        <th className="p-2">
                          <input 
                            type="text"
                            placeholder="Filter UDF 2..."
                            value={columnFilters.resourceRates.udf2 || ''}
                            onChange={(e) => setColumnFilters(prev => ({ ...prev, resourceRates: { ...prev.resourceRates, udf2: e.target.value } }))}
                            className="w-full px-2 py-1 text-[10px] bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded focus:ring-1 focus:ring-blue-500 outline-none dark:text-white"
                          />
                        </th>
                      )}
                      {visibleColumns.resourceRates.includes('udf3') && (
                        <th className="p-2">
                          <input 
                            type="text"
                            placeholder="Filter UDF 3..."
                            value={columnFilters.resourceRates.udf3 || ''}
                            onChange={(e) => setColumnFilters(prev => ({ ...prev, resourceRates: { ...prev.resourceRates, udf3: e.target.value } }))}
                            className="w-full px-2 py-1 text-[10px] bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded focus:ring-1 focus:ring-blue-500 outline-none dark:text-white"
                          />
                        </th>
                      )}
                      <th className="p-2 sticky right-0 z-30 bg-gray-100/50 dark:bg-[#1a1a1a] border-l border-gray-200 dark:border-white/10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-white/5">
                    {filteredResources.map((resource, index) => (
                      <tr key={resource.id} className={`hover:bg-gray-50 dark:hover:bg-white/5 transition-colors group ${selectedRateIds.has(resource.id) ? 'bg-blue-50/50 dark:bg-blue-500/5' : ''}`}>
                        <td className={`p-2 ${isFrozen.resourceRates ? 'sticky left-0 z-10 bg-inherit border-r border-gray-200 dark:border-white/10' : ''}`}>
                          <input 
                            type="checkbox" 
                            className="rounded border-gray-300 dark:border-white/20 bg-transparent"
                            checked={selectedRateIds.has(resource.id)}
                            onChange={() => {
                              const newSelected = new Set(selectedRateIds);
                              if (newSelected.has(resource.id)) {
                                newSelected.delete(resource.id);
                              } else {
                                newSelected.add(resource.id);
                              }
                              setSelectedRateIds(newSelected);
                            }}
                          />
                        </td>
                        {visibleColumns.resourceRates.includes('id') && <td className={`p-2 text-xs font-mono dark:text-white ${isFrozen.resourceRates ? 'sticky left-12 z-10 bg-inherit border-r border-gray-200 dark:border-white/10' : ''}`}>{resource.id}</td>}
                        {visibleColumns.resourceRates.includes('name') && <td className="p-2 text-xs font-bold dark:text-white">{resource.name}</td>}
                        {visibleColumns.resourceRates.includes('category') && <td className="p-2 text-xs text-gray-500 dark:text-gray-400">{resource.category || 'Uncategorized'}</td>}
                        {visibleColumns.resourceRates.includes('unit') && <td className="p-2 text-xs text-gray-500 dark:text-gray-400">{resource.unit}</td>}
                        {visibleColumns.resourceRates.includes('rate') && <td className="p-2 text-xs text-right pr-4 font-mono dark:text-white">{resource.rate ? `$${resource.rate.toLocaleString()}` : '-'}</td>}
                        {visibleColumns.resourceRates.includes('udf1') && <td className="p-2 text-xs text-gray-500 dark:text-gray-400">{resource.udf1 || '-'}</td>}
                        {visibleColumns.resourceRates.includes('udf2') && <td className="p-2 text-xs text-gray-500 dark:text-gray-400">{resource.udf2 || '-'}</td>}
                        {visibleColumns.resourceRates.includes('udf3') && <td className="p-2 text-xs text-gray-500 dark:text-gray-400">{resource.udf3 || '-'}</td>}
                        <td className="p-2 sticky right-0 z-10 bg-inherit border-l border-gray-100 dark:border-white/10">
                          <div className="flex justify-end gap-1 opacity-40 group-hover:opacity-100 transition-opacity">
                            <div className="relative">
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveMenuId(activeMenuId === `rr-${resource.id}` ? null : `rr-${resource.id}`);
                                }}
                                className="p-1.5 text-gray-400 hover:text-black dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-white/5"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </button>
                              
                              <AnimatePresence>
                                {activeMenuId === `rr-${resource.id}` && (
                                  <>
                                    <div 
                                      className="fixed inset-0 z-40" 
                                      onClick={() => setActiveMenuId(null)}
                                    />
                                    <motion.div 
                                      initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                      animate={{ opacity: 1, scale: 1, y: 0 }}
                                      exit={{ opacity: 0, scale: 0.95, y: 10 }}
                                      className={cn(
                                        "absolute right-0 w-48 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-xl shadow-xl z-50 p-2",
                                        index < 3 ? "top-full mt-2" : "bottom-full mb-2"
                                      )}
                                    >
                                      <button 
                                        onClick={() => {
                                          const index = (enterprise.resourceRates || []).findIndex(r => r.id === resource.id);
                                          setResourceFormData({ id: '', name: '', unit: '', rate: 0, category: '', udf1: '', udf2: '', udf3: '' });
                                          setIsEditingResource({ id: null, insertIndex: index });
                                          setActiveMenuId(null);
                                        }}
                                        className="w-full text-left p-2 text-xs dark:text-white hover:bg-gray-50 dark:hover:bg-white/5 rounded-lg flex items-center gap-2"
                                      >
                                        <Plus className="w-3 h-3" /> Insert Above
                                      </button>
                                      <button 
                                        onClick={() => {
                                          const index = (enterprise.resourceRates || []).findIndex(r => r.id === resource.id);
                                          setResourceFormData({ id: '', name: '', unit: '', rate: 0, category: '', udf1: '', udf2: '', udf3: '' });
                                          setIsEditingResource({ id: null, insertIndex: index + 1 });
                                          setActiveMenuId(null);
                                        }}
                                        className="w-full text-left p-2 text-xs dark:text-white hover:bg-gray-50 dark:hover:bg-white/5 rounded-lg flex items-center gap-2"
                                      >
                                        <Plus className="w-3 h-3" /> Insert Below
                                      </button>
                                      <hr className="my-1 border-gray-100 dark:border-white/10" />
                                      <button 
                                        onClick={() => {
                                          setResourceFormData({ 
                                            id: resource.id, 
                                            name: resource.name, 
                                            unit: resource.unit, 
                                            rate: resource.rate || 0, 
                                            category: resource.category || '', 
                                            udf1: resource.udf1 || '', 
                                            udf2: resource.udf2 || '', 
                                            udf3: resource.udf3 || '' 
                                          });
                                          setIsEditingResource({ id: resource.id });
                                          setActiveMenuId(null);
                                        }}
                                        className="w-full text-left p-2 text-xs dark:text-white hover:bg-gray-50 dark:hover:bg-white/5 rounded-lg flex items-center gap-2"
                                      >
                                        <Edit2 className="w-3 h-3" /> Edit
                                      </button>
                                      <button 
                                        onClick={() => {
                                          setDeleteConfirm({ type: 'rate', id: resource.id, name: resource.name });
                                          setActiveMenuId(null);
                                        }}
                                        className="w-full text-left p-2 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg flex items-center gap-2"
                                      >
                                        <Trash2 className="w-3 h-3" /> Delete
                                      </button>
                                    </motion.div>
                                  </>
                                )}
                              </AnimatePresence>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredResources.length === 0 && (
                      <tr>
                        <td colSpan={10} className="p-12 text-center">
                          <div className="w-16 h-16 bg-gray-50 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Settings className="w-8 h-8 text-gray-300" />
                          </div>
                          <p className="text-gray-900 dark:text-gray-400 text-sm">No resources found matching your search.</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>
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

          {activeTab === 'changeMgmt' && (
            <motion.div 
              key="change-mgmt"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex-1 flex flex-col p-8 bg-white dark:bg-[#141414] border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-lg font-bold dark:text-white">Change Management Settings</h3>
                  <p className="text-sm text-gray-500">Configure global change types for the enterprise.</p>
                </div>
                <RefreshCw className="w-8 h-8 text-gray-300" />
              </div>

              <div className="space-y-6">
                <div className="bg-gray-50 dark:bg-white/5 p-6 rounded-2xl border border-gray-100 dark:border-white/5">
                  <h4 className="text-sm font-bold dark:text-white mb-4">Change Types</h4>
                  <div className="flex gap-2 mb-4">
                    <Input 
                      placeholder="Enter new change type (e.g. Client Change, Internal Error...)"
                      value={newChangeType}
                      onChange={(e) => setNewChangeType(e.target.value)}
                      className="flex-1"
                    />
                    <Button 
                      onClick={async () => {
                        if (!newChangeType.trim()) return;
                        const currentTypes = enterprise.changeTypes || [];
                        if (currentTypes.includes(newChangeType.trim())) {
                          alert('This change type already exists.');
                          return;
                        }
                        await handleUpdateEnterprise({
                          changeTypes: [...currentTypes, newChangeType.trim()]
                        });
                        setNewChangeType('');
                      }}
                      className="bg-black dark:bg-white text-white dark:text-black"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Type
                    </Button>
                  </div>

                  <div className="space-y-2">
                    {(enterprise.changeTypes || []).map((type, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-white dark:bg-[#1a1a1a] rounded-xl border border-gray-100 dark:border-white/5 group">
                        <span className="text-sm dark:text-white">{type}</span>
                        <button 
                          onClick={async () => {
                            const newTypes = (enterprise.changeTypes || []).filter(t => t !== type);
                            await handleUpdateEnterprise({ changeTypes: newTypes });
                          }}
                          className="p-2 text-gray-400 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    {(enterprise.changeTypes || []).length === 0 && (
                      <p className="text-xs text-gray-500 italic text-center py-4">No change types defined yet.</p>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {['scheduleMgmt', 'designMgmt', 'fieldMgmt', 'procurement', 'subContractMgmt', 'invoicing'].includes(activeTab) && (
            <motion.div 
              key="under-development"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-white dark:bg-[#141414] border border-gray-200 dark:border-white/10 rounded-2xl"
            >
              <div className="w-16 h-16 bg-gray-50 dark:bg-white/5 rounded-full flex items-center justify-center mb-6">
                <Settings className="w-8 h-8 text-gray-300" />
              </div>
              <h3 className="text-lg font-bold dark:text-white mb-2">Module Under Development</h3>
              <p className="text-sm text-gray-900 dark:text-gray-400 max-w-xs">Enterprise-wide settings for this module are currently being implemented.</p>
            </motion.div>
          )}
          </AnimatePresence>
        </div>
      </div>

      {/* Side Detail Panel */}
        <AnimatePresence>
          {(selectedUserId || selectedProjectId) && (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="w-full lg:w-96 bg-white dark:bg-[#141414] border border-gray-200 dark:border-white/10 rounded-2xl flex flex-col overflow-hidden shadow-xl"
            >
            {/* Panel Header */}
            <div className="p-6 border-b border-gray-100 dark:border-white/10 flex justify-between items-start">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center border border-gray-200 dark:border-white/10 overflow-hidden">
                  {selectedUser ? (
                    selectedUser.photoURL ? <img src={selectedUser.photoURL} alt="" /> : <Users className="w-6 h-6 text-gray-400" />
                  ) : (
                    selectedProject?.photoURL ? <img src={selectedProject.photoURL} alt="" /> : <Briefcase className="w-6 h-6 text-gray-400" />
                  )}
                </div>
                <div>
                  <h3 className="font-bold dark:text-white">{selectedUser ? (selectedUser.displayName || selectedUser.email.split('@')[0]) : selectedProject?.projectName}</h3>
                  <p className="text-xs text-gray-400">{selectedUser ? selectedUser.email : selectedProject?.projectCode}</p>
                </div>
              </div>
              <button 
                onClick={() => { setSelectedUserId(null); setSelectedProjectId(null); }}
                className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors text-gray-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Panel Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {selectedUserId && selectedUser && (
                <div className="space-y-6">
                  <div>
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-4">Project Assignments</h4>
                    <div className="space-y-2">
                      {projects.map(project => {
                        const userRole = project.users[selectedUserId];
                        return (
                          <div key={project.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/5">
                            <div className="flex-1 min-w-0 mr-4">
                              <p className="text-sm font-bold dark:text-white truncate">{project.projectName}</p>
                              <p className="text-[10px] text-gray-400 font-mono">{project.projectCode}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              {userRole ? (
                                <>
                                  <select 
                                    value={userRole}
                                    onChange={(e) => updateProjectRole(project.id, selectedUserId, e.target.value as any)}
                                    className="text-[10px] font-bold uppercase tracking-widest bg-transparent border-none focus:ring-0 text-blue-600 dark:text-blue-400"
                                  >
                                    <option value="Project User">User</option>
                                    <option value="Project Admin">Admin</option>
                                  </select>
                                  <button 
                                    onClick={() => toggleProjectAccess(project.id, selectedUserId, userRole)}
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
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-4">Project Settings</h4>
                    <div className="space-y-4 bg-gray-50 dark:bg-white/5 p-4 rounded-xl border border-gray-100 dark:border-white/5">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Project ID</label>
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
                        <p className="text-xs font-mono dark:text-white">{selectedProject.projectCode}</p>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 block mb-1">Status</label>
                        <select 
                          value={selectedProject.status || 'Active'}
                          onChange={(e) => handleUpdateProjectStatus(selectedProject.id, e.target.value)}
                          className="w-full text-xs bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-lg px-2 py-1.5 dark:text-white outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="Active">Active</option>
                          <option value="On Hold">On Hold</option>
                          <option value="Closed">Closed</option>
                          <option value="Archived">Archived</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 block mb-2">Project Photo</label>
                        <div className="flex items-center gap-3">
                          <input 
                            type="file"
                            ref={projectPhotoInputRef}
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              if (!file.type.startsWith('image/')) {
                                alert('Please upload a valid image file.');
                                return;
                              }
                              if (file.size > 800 * 1024) {
                                alert('File is too large. Please upload an image smaller than 800KB.');
                                return;
                              }
                              const reader = new FileReader();
                              reader.onloadend = async () => {
                                const base64String = reader.result as string;
                                await handleUpdateProjectPhoto(selectedProject.id, base64String);
                              };
                              reader.readAsDataURL(file);
                            }}
                            accept="image/jpeg,image/png,image/gif,image/webp"
                            className="hidden"
                          />
                          <button 
                            onClick={() => projectPhotoInputRef.current?.click()}
                            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-gray-50 dark:hover:bg-white/5 transition-colors dark:text-white"
                          >
                            <Upload className="w-3 h-3 text-blue-600" />
                            Upload
                          </button>
                          {selectedProject.photoURL && (
                            <button 
                              onClick={() => handleUpdateProjectPhoto(selectedProject.id, '')}
                              className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                              title="Remove Photo"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                        {selectedProject.photoURL && (
                          <div className="mt-3 w-full aspect-video rounded-lg overflow-hidden border border-gray-200 dark:border-white/10">
                            <img src={selectedProject.photoURL} alt="Project" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-4">Assigned Users</h4>
                    <div className="space-y-2">
                      {Object.entries(enterprise.users || {}).map(([uid, data]) => {
                        const userRole = selectedProject.users[uid];
                        return (
                          <div key={uid} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/5">
                            <div className="flex-1 min-w-0 mr-4">
                              <p className="text-sm font-bold dark:text-white truncate">{data.displayName || data.email.split('@')[0]}</p>
                              <p className="text-[10px] text-gray-400">{data.email}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              {userRole ? (
                                <>
                                  <select 
                                    value={userRole}
                                    onChange={(e) => updateProjectRole(selectedProjectId, uid, e.target.value as any)}
                                    className="text-[10px] font-bold uppercase tracking-widest bg-transparent border-none focus:ring-0 text-blue-600 dark:text-blue-400"
                                  >
                                    <option value="Project User">User</option>
                                    <option value="Project Admin">Admin</option>
                                  </select>
                                  <button 
                                    onClick={() => toggleProjectAccess(selectedProjectId, uid, userRole)}
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
                Updating identifier for <span className="font-bold text-gray-900 dark:text-white">{projectToReplace.projectName}</span>.
              </p>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">Current ID</label>
                <div className="p-3 bg-gray-100 dark:bg-white/5 rounded-xl text-sm font-mono text-gray-500">
                  {projectToReplace.projectCode}
                </div>
              </div>
              
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">New Project ID</label>
                <input 
                  type="text"
                  value={newProjectCode}
                  onChange={(e) => setNewProjectCode(e.target.value.toUpperCase())}
                  placeholder="E.G. PRJ-2024-001"
                  className={cn(
                    "w-full p-3 bg-gray-50 dark:bg-white/5 border rounded-xl text-sm font-mono dark:text-white focus:ring-2 outline-none",
                    isNewProjectCodeDuplicate 
                      ? "border-red-500 focus:ring-red-500/20" 
                      : "border-gray-200 dark:border-white/10 focus:ring-blue-500"
                  )}
                  autoFocus
                />
                {isNewProjectCodeDuplicate && (
                  <p className="text-[10px] text-red-500 mt-1 font-bold uppercase tracking-widest">This Project ID already exists!</p>
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
            <p className="text-gray-900 dark:text-gray-400 mb-6 text-sm">
              The following records will be imported. Existing IDs will be updated.
            </p>
            <div className="flex-1 overflow-auto border border-gray-200 dark:border-white/10 rounded-xl mb-6">
              <table className="w-full text-left text-xs">
                <thead className="bg-black dark:bg-gray-100 sticky top-0">
                  <tr>
                    {Object.keys(importPreview.data[0] || {}).map(key => (
                      <th key={key} className={`px-4 py-2 font-bold text-white dark:text-black uppercase tracking-widest text-[10px] ${
                        key.toLowerCase().includes('id') || key.toLowerCase().includes('code') 
                          ? 'w-32' 
                          : key.toLowerCase().includes('sort') 
                            ? 'w-24' 
                            : ''
                      }`}>{key}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                  {importPreview.data.map((row, i) => (
                    <tr key={i}>
                      {Object.values(row).map((val: any, j) => (
                        <td key={j} className="px-4 py-2 dark:text-white">{val?.toString()}</td>
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
                className="flex-1 py-4 bg-black dark:bg-white text-white dark:text-black rounded-2xl text-sm font-bold uppercase tracking-widest hover:bg-black/90 dark:hover:bg-white/90 transition-colors shadow-lg"
              >
                Complete Import
              </button>
            </div>
          </motion.div>
        </div>
      )}
      </AnimatePresence>

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
              {deleteConfirm.type === 'bulk-project' ? 'Delete Projects?' : 
               deleteConfirm.type === 'bulk-attr-value' ? 'Delete Attribute Values?' :
               deleteConfirm.type === 'bulk-rate' ? 'Delete Resource Rates?' :
               deleteConfirm.type === 'bulk-costElement' ? 'Delete Cost Elements?' :
               deleteConfirm.type === 'rate' ? 'Delete Resource Rate?' :
               deleteConfirm.type === 'costElement' ? 'Delete Cost Element?' :
               'Delete User?'}
            </h2>
            <p className="text-gray-900 dark:text-gray-400 text-center mb-8">
              {deleteConfirm.type === 'bulk-project' ? (
                <>You are about to delete <span className="font-bold text-black dark:text-white">{deleteConfirm.count}</span> projects. This action cannot be undone.</>
              ) : deleteConfirm.type === 'bulk-attr-value' ? (
                <>You are about to delete <span className="font-bold text-black dark:text-white">{deleteConfirm.count}</span> attribute values. This action cannot be undone.</>
              ) : deleteConfirm.type === 'bulk-rate' ? (
                <>You are about to delete <span className="font-bold text-black dark:text-white">{deleteConfirm.count}</span> resource rates. This action cannot be undone.</>
              ) : deleteConfirm.type === 'bulk-costElement' ? (
                <>You are about to delete <span className="font-bold text-black dark:text-white">{deleteConfirm.count}</span> cost elements. This action cannot be undone.</>
              ) : (
                <>You are about to remove <span className="font-bold text-black dark:text-white">{deleteConfirm.name}</span> from the enterprise.</>
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
                  if (deleteConfirm.type === 'user') deleteUser(deleteConfirm.id!);
                  else if (deleteConfirm.type === 'project') deleteProject(deleteConfirm.id!);
                  else if (deleteConfirm.type === 'bulk-project') bulkDeleteProjects();
                  else if (deleteConfirm.type === 'bulk-attr-value') bulkDeleteAttributeValues(activeTab === 'projectAttributes' ? 'project' : activeTab === 'costCodeAttributes' ? 'costCode' : 'lineItem', selectedAttrId);
                  else if (deleteConfirm.type === 'rate') deleteResourceRate(deleteConfirm.id!);
                  else if (deleteConfirm.type === 'bulk-rate') bulkDeleteResourceRates();
                  else if (deleteConfirm.type === 'costElement') deleteCostElement(deleteConfirm.id!);
                  else if (deleteConfirm.type === 'bulk-costElement') bulkDeleteCostElements();
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

      <AnimatePresence>
        {isEditingCostElement && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[100] p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-[#141414] rounded-3xl p-8 w-full max-w-lg shadow-2xl border border-gray-200 dark:border-white/10"
            >
            <h2 className="text-xl font-bold mb-6 dark:text-white">{isEditingCostElement.id ? 'Edit' : 'Add'} Cost Element</h2>
            <form onSubmit={(e) => {
              e.preventDefault();
              if (isEditingCostElement.id) {
                updateCostElement(isEditingCostElement.id, costElementFormData);
              } else {
                addCostElement(costElementFormData, isEditingCostElement.insertIndex);
              }
              setIsEditingCostElement(null);
            }} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
                  Element ID <span className="text-red-500">*</span>
                </label>
                <input 
                  required
                  disabled={!!isEditingCostElement.id}
                  type="text"
                  maxLength={10}
                  value={costElementFormData.id}
                  onChange={e => setCostElementFormData({ ...costElementFormData, id: e.target.value })}
                  className={cn(
                    "w-full p-4 bg-gray-50 dark:bg-white/5 border rounded-2xl text-sm focus:outline-none focus:ring-2 dark:text-white disabled:opacity-50 transition-all",
                    costElementIdExists 
                      ? "border-red-500 focus:ring-red-500/20" 
                      : "border-gray-200 dark:border-white/10 focus:ring-black/5"
                  )}
                />
                {costElementIdExists && (
                  <p className="text-[10px] text-red-500 mt-1 font-bold uppercase tracking-widest">This ID already Exists!</p>
                )}
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Description</label>
                <input 
                  type="text"
                  maxLength={40}
                  value={costElementFormData.description}
                  onChange={e => setCostElementFormData({ ...costElementFormData, description: e.target.value })}
                  placeholder="e.g. Labor Costs"
                  className="w-full p-4 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-black/5 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Sort Code</label>
                <input 
                  type="text"
                  value={costElementFormData.sortCode}
                  onChange={e => {
                    let val = e.target.value;
                    // If it's a number, pad it
                    if (/^\d+$/.test(val)) {
                      val = val.padStart(2, '0');
                    }
                    setCostElementFormData({ ...costElementFormData, sortCode: val });
                  }}
                  placeholder="e.g. 01"
                  className="w-full p-4 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-black/5 dark:text-white"
                />
              </div>
              <div className="flex gap-4 pt-4">
                <button 
                  type="button"
                  onClick={() => setIsEditingCostElement(null)}
                  className="flex-1 py-4 border border-gray-200 dark:border-white/10 rounded-2xl text-sm font-bold uppercase tracking-widest hover:bg-gray-50 dark:hover:bg-white/5 transition-colors dark:text-white"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={!costElementFormData.id || costElementIdExists}
                  className="flex-1 py-4 bg-black dark:bg-white text-white dark:text-black rounded-2xl text-sm font-bold uppercase tracking-widest hover:bg-black/90 dark:hover:bg-white/90 transition-colors shadow-lg disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {isEditingCostElement.id ? 'Save Changes' : 'Add'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
      </AnimatePresence>

      <AnimatePresence>
        {isEditingResource && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[100] p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-[#141414] rounded-3xl p-8 w-full max-w-lg shadow-2xl border border-gray-200 dark:border-white/10"
            >
            <h2 className="text-xl font-bold mb-6 dark:text-white">{isEditingResource.id ? 'Edit' : 'Add'} Resource</h2>
            <form onSubmit={(e) => {
              e.preventDefault();
              if (isEditingResource.id) {
                updateResourceRate(isEditingResource.id, resourceFormData);
              } else {
                addResourceRate(resourceFormData, isEditingResource.insertIndex);
              }
              setIsEditingResource(null);
            }} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
                    Resource ID <span className="text-red-500">*</span>
                  </label>
                  <input 
                    required
                    disabled={!!isEditingResource.id}
                    type="text"
                    maxLength={20}
                    value={resourceFormData.id}
                    onChange={e => setResourceFormData({ ...resourceFormData, id: e.target.value })}
                    className={cn(
                      "w-full p-4 bg-gray-50 dark:bg-white/5 border rounded-2xl text-sm focus:outline-none focus:ring-2 dark:text-white disabled:opacity-50 transition-all",
                      resourceIdExists 
                        ? "border-red-500 focus:ring-red-500/20" 
                        : "border-gray-200 dark:border-white/10 focus:ring-black/5"
                    )}
                  />
                  {resourceIdExists && (
                    <p className="text-[10px] text-red-500 mt-1 font-bold uppercase tracking-widest">This ID already Exists!</p>
                  )}
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Category</label>
                  <select 
                    value={resourceFormData.category}
                    onChange={e => setResourceFormData({ ...resourceFormData, category: e.target.value })}
                    className="w-full p-4 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-black/5 dark:text-white"
                  >
                    <option value="">Select Category</option>
                    {RESOURCE_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Resource Name</label>
                <input 
                  type="text"
                  value={resourceFormData.name}
                  onChange={e => setResourceFormData({ ...resourceFormData, name: e.target.value })}
                  placeholder="e.g. Senior Engineer"
                  className="w-full p-4 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-black/5 dark:text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Unit <span className="text-red-500">*</span></label>
                  <input 
                    required
                    type="text"
                    value={resourceFormData.unit}
                    onChange={e => setResourceFormData({ ...resourceFormData, unit: e.target.value })}
                    placeholder="e.g. HR, DAY, M2"
                    className="w-full p-4 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-black/5 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Rate ($)</label>
                  <input 
                    type="number"
                    value={resourceFormData.rate}
                    onChange={e => setResourceFormData({ ...resourceFormData, rate: parseFloat(e.target.value) || 0 })}
                    className="w-full p-4 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-black/5 dark:text-white"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">UDF 1</label>
                  <input 
                    type="text"
                    value={resourceFormData.udf1}
                    onChange={e => setResourceFormData({ ...resourceFormData, udf1: e.target.value })}
                    className="w-full p-4 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-black/5 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">UDF 2</label>
                  <input 
                    type="text"
                    value={resourceFormData.udf2}
                    onChange={e => setResourceFormData({ ...resourceFormData, udf2: e.target.value })}
                    className="w-full p-4 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-black/5 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">UDF 3</label>
                  <input 
                    type="text"
                    value={resourceFormData.udf3}
                    onChange={e => setResourceFormData({ ...resourceFormData, udf3: e.target.value })}
                    className="w-full p-4 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-black/5 dark:text-white"
                  />
                </div>
              </div>
              <div className="flex gap-4 pt-4">
                <button 
                  type="button"
                  onClick={() => setIsEditingResource(null)}
                  className="flex-1 py-4 border border-gray-200 dark:border-white/10 rounded-2xl text-sm font-bold uppercase tracking-widest hover:bg-gray-50 dark:hover:bg-white/5 transition-colors dark:text-white"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={!resourceFormData.id || resourceIdExists}
                  className="flex-1 py-4 bg-black dark:bg-white text-white dark:text-black rounded-2xl text-sm font-bold uppercase tracking-widest hover:bg-black/90 dark:hover:bg-white/90 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {isEditingResource.id ? 'Update' : 'Add'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
      </AnimatePresence>
      <AnimatePresence>
        {inviteModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[100] p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-[#141414] rounded-3xl p-8 w-full max-w-md shadow-2xl border border-gray-200 dark:border-white/10"
            >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold dark:text-white">Invite New User</h2>
              <button onClick={() => setInviteModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleInvite} className="space-y-4">
              <AnimatePresence mode="wait">
                {!generatedLink ? (
                  <motion.div
                    key="form"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-4"
                  >
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Email Address</label>
                      <input 
                        required
                        type="email"
                        value={inviteEmail}
                        onChange={e => setInviteEmail(e.target.value)}
                        placeholder="colleague@company.com"
                        className="w-full p-4 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-black/5 dark:text-white"
                      />
                    </div>
                    <p className="text-xs text-gray-900 dark:text-gray-400">
                      Enter your colleague's email to generate a secure invitation link.
                    </p>
                    <div className="flex gap-4 pt-4">
                      <button 
                        type="button"
                        onClick={() => setInviteModal(false)}
                        className="flex-1 py-4 border border-gray-200 dark:border-white/10 rounded-2xl text-sm font-bold uppercase tracking-widest hover:bg-gray-50 dark:hover:bg-white/5 transition-colors dark:text-white"
                      >
                        Cancel
                      </button>
                      <button 
                        type="submit"
                        disabled={isInviting}
                        className="flex-1 py-4 bg-black dark:bg-white text-white dark:text-black rounded-2xl text-sm font-bold uppercase tracking-widest hover:bg-black/90 dark:hover:bg-white/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isInviting ? 'Generating...' : 'Generate Link'}
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div 
                    key="success"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-6"
                  >
                    <div className="p-4 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 rounded-2xl">
                      <p className="text-sm text-emerald-800 dark:text-emerald-400 font-medium mb-1">Link Generated!</p>
                      <p className="text-xs text-emerald-700/70 dark:text-emerald-400/60">Copy the link below and send it to your colleague.</p>
                    </div>
                    
                    <div className="relative">
                      <input 
                        readOnly
                        value={generatedLink}
                        className="w-full p-4 pr-12 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl text-xs font-mono dark:text-white"
                      />
                      <button 
                        type="button"
                        onClick={copyInviteLink}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-2 hover:bg-gray-200 dark:hover:bg-white/10 rounded-lg transition-colors"
                      >
                        <Tag className="w-4 h-4 text-gray-500" />
                      </button>
                    </div>

                    <div className="flex gap-4">
                      <button 
                        type="button"
                        onClick={() => {
                          setGeneratedLink(null);
                          setInviteEmail('');
                          setInviteModal(false);
                        }}
                        className="flex-1 py-4 bg-black dark:bg-white text-white dark:text-black rounded-2xl text-sm font-bold uppercase tracking-widest hover:bg-black/90 dark:hover:bg-white/90 transition-colors"
                      >
                        Done
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </form>
          </motion.div>
        </div>
      )}
      </AnimatePresence>
      <AnimatePresence>
        {isEditingValue && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-[#1C1C1C] rounded-2xl w-full max-w-md shadow-2xl border border-gray-200 dark:border-white/10 overflow-hidden"
            >
            <div className="p-6 border-b border-gray-100 dark:border-white/10 flex justify-between items-center">
              <h3 className="text-xl font-bold dark:text-white">
                {isEditingValue.valueId ? 'Edit Value' : 'Add'}
              </h3>
              <button onClick={() => setIsEditingValue(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full transition-colors">
                <X className="w-5 h-5 dark:text-white" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
                  Value ID <span className="text-red-500">*</span>
                </label>
                <input 
                  type="text"
                  maxLength={20}
                  value={valueFormData.id}
                  onChange={e => setValueFormData({ ...valueFormData, id: e.target.value })}
                  placeholder="e.g. V01"
                  className={cn(
                    "w-full p-3 bg-gray-50 dark:bg-white/5 border rounded-xl focus:outline-none focus:ring-2 dark:text-white transition-all",
                    valueIdExists 
                      ? "border-red-500 focus:ring-red-500/20" 
                      : "border-gray-200 dark:border-white/10 focus:ring-blue-500/20"
                  )}
                  disabled={!!isEditingValue.valueId}
                />
                {valueIdExists && (
                  <p className="text-[10px] text-red-500 mt-1 font-bold uppercase tracking-widest">This ID already Exists!</p>
                )}
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Description</label>
                <input 
                  type="text"
                  value={valueFormData.description}
                  onChange={e => setValueFormData({ ...valueFormData, description: e.target.value })}
                  placeholder="e.g. High Priority"
                  className="w-full p-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Sort Order</label>
                <input 
                  type="text"
                  maxLength={5}
                  value={valueFormData.sortOrder}
                  onChange={e => {
                    const val = e.target.value;
                    if (val === '' || /^-?\d*\.?\d*$/.test(val)) {
                      setValueFormData({ ...valueFormData, sortOrder: val });
                    }
                  }}
                  placeholder="e.g. 1.0"
                  className="w-full p-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:text-white"
                />
              </div>
            </div>
            <div className="p-6 bg-gray-50 dark:bg-white/2 border-t border-gray-100 dark:border-white/10 flex justify-end gap-3">
              <button 
                onClick={() => setIsEditingValue(null)}
                className="px-6 py-2.5 text-sm font-bold text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button 
                disabled={!valueFormData.id || valueIdExists}
                onClick={async () => {
                  if (!valueFormData.id) return;
                  if (isEditingValue.valueId) {
                    await updateAttributeValue(isEditingValue.type, isEditingValue.attrId, isEditingValue.valueId, valueFormData);
                  } else {
                    await addAttributeValue(isEditingValue.type, isEditingValue.attrId, valueFormData);
                  }
                  setIsEditingValue(null);
                }}
                className="px-8 py-2.5 bg-black dark:bg-white text-white dark:text-black rounded-xl text-sm font-bold hover:bg-black/90 dark:hover:bg-white/90 transition-colors shadow-lg shadow-black/10 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {isEditingValue.valueId ? 'Save Changes' : 'Add'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
      </AnimatePresence>

      {/* Context Menu */}
      <AnimatePresence>
        {contextMenu && (
          <>
            <div 
              className="fixed inset-0 z-50" 
              onClick={() => setContextMenu(null)}
              onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              style={{ left: contextMenu.x, top: contextMenu.y }}
              className="fixed z-[60] w-48 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-xl shadow-2xl p-2"
            >
              {contextMenu.type === 'user' && (
                <>
                  <button 
                    onClick={() => {
                      toggleUserRole(contextMenu.id);
                      setContextMenu(null);
                    }}
                    className="w-full text-left p-2 text-xs dark:text-white hover:bg-gray-50 dark:hover:bg-white/5 rounded-lg flex items-center gap-2"
                  >
                    <Lock className="w-3 h-3" /> Toggle Admin Role
                  </button>
                  <button 
                    onClick={() => {
                      setDeleteConfirm({ type: 'user', id: contextMenu.id, name: enterprise.users?.[contextMenu.id]?.email });
                      setContextMenu(null);
                    }}
                    className="w-full text-left p-2 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg flex items-center gap-2"
                  >
                    <Trash2 className="w-3 h-3" /> Delete User
                  </button>
                </>
              )}
              {contextMenu.type === 'project' && (
                <>
                  <button 
                    onClick={() => {
                      const project = projects.find(p => p.id === contextMenu.id);
                      if (project) {
                        setProjectToReplace(project);
                        setNewProjectCode(project.projectCode);
                        setIsReplaceIdModalOpen(true);
                      }
                      setContextMenu(null);
                    }}
                    className="w-full text-left p-2 text-xs dark:text-white hover:bg-gray-50 dark:hover:bg-white/5 rounded-lg flex items-center gap-2"
                  >
                    <Edit2 className="w-3 h-3" /> Replace Project ID
                  </button>
                  <button 
                    onClick={() => {
                      const project = projects.find(p => p.id === contextMenu.id);
                      setDeleteConfirm({ type: 'project', id: contextMenu.id, name: project?.projectName });
                      setContextMenu(null);
                    }}
                    className="w-full text-left p-2 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg flex items-center gap-2"
                  >
                    <Trash2 className="w-3 h-3" /> Delete Project
                  </button>
                </>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

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
                <label htmlFor="name" className="text-sm font-medium dark:text-gray-300">Project Name</label>
                <Input
                  id="name"
                  value={newProjectData.name}
                  onChange={(e) => setNewProjectData({ ...newProjectData, name: e.target.value })}
                  placeholder="e.g. Hospital Expansion"
                  className="dark:bg-[#1a1a1a] dark:border-white/10 dark:text-white"
                  required
                />
              </div>
              <div className="grid gap-2">
                <label htmlFor="code" className="text-sm font-medium dark:text-gray-300">Project Code</label>
                <Input
                  id="code"
                  value={newProjectData.code}
                  onChange={(e) => setNewProjectData({ ...newProjectData, code: e.target.value })}
                  placeholder="e.g. PRJ-001"
                  className="dark:bg-[#1a1a1a] dark:border-white/10 dark:text-white"
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreateProjectModalOpen(false)} className="dark:border-white/10 dark:text-white">Cancel</Button>
              <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white">
                {isSubmitting ? 'Creating...' : 'Create Project'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Import Successful</h3>
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
    </div>
  );
}
