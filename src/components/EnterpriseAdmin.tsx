import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db, auth } from '../firebase';
import { doc, updateDoc, collection, query, where, onSnapshot, deleteDoc, getDocs, addDoc } from 'firebase/firestore';
import { Enterprise, Project, Sheet, ProjectAttribute, ProjectAttributeValue, SavedView } from '../types';
import { Users, Briefcase, Settings, Plus, Trash2, Tag, Search, X, ChevronRight, UserPlus, ExternalLink, AlertTriangle, Edit2, Download, Upload, Eye, Lock, Unlock, MoreVertical, Bookmark } from 'lucide-react';
import * as XLSX from 'xlsx';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const RESOURCE_CATEGORIES = ['Labour', 'Plant', 'Material', 'Subcontractor'];
const RESOURCE_UNITS = [
  // International
  'm', 'm2', 'm3', 'ton', 'kg', 'no', 'item', 'hour', 'week', 'month',
  // American
  'ft', 'ft2', 'ft3', 'lb', 'gal', 'yd', 'yd2', 'yd3', 'in', 'in2', 'in3'
];

interface EnterpriseAdminProps {
  enterprise: Enterprise;
}

export default function EnterpriseAdmin({ enterprise }: EnterpriseAdminProps) {
  const [activeTab, setActiveTab] = useState<'users' | 'projects' | 'projectAttributes' | 'lineItemAttributes' | 'resourceRates'>('users');
  const [projects, setProjects] = useState<Project[]>([]);
  const [sheets, setSheets] = useState<Sheet[]>([]);
  
  // Search and Selection States
  const [userSearch, setUserSearch] = useState('');
  const [projectSearch, setProjectSearch] = useState('');
  const [attrSearch, setAttrSearch] = useState('');
  const [resourceSearch, setResourceSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(new Set());
  const [selectedAttrId, setSelectedAttrId] = useState<string>('01');
  const [selectedAttrValueIds, setSelectedAttrValueIds] = useState<Set<string>>(new Set());
  const [selectedRateIds, setSelectedRateIds] = useState<Set<string>>(new Set());
  const [projectSort, setProjectSort] = useState<{ field: 'dateCreated' | 'dateLastModified' | 'projectName' | 'projectCode', direction: 'asc' | 'desc' }>({ field: 'dateCreated', direction: 'desc' });
  
  // Modal States
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'user' | 'project' | 'bulk-project' | 'bulk-attr-value' | 'rate' | 'bulk-rate', id?: string, name?: string, count?: number } | null>(null);
  const [inviteModal, setInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);

  const [isEditingValue, setIsEditingValue] = useState<{ type: 'project' | 'lineItem', attrId: string, valueId: string | null } | null>(null);
  const [isEditingResource, setIsEditingResource] = useState<{ id: string | null, insertIndex?: number } | null>(null);
  const [valueFormData, setValueFormData] = useState({ id: '', description: '', sortOrder: 0 });
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

  // Table Control States
  const [visibleColumns, setVisibleColumns] = useState<Record<string, string[]>>({
    users: ['photo', 'name', 'email', 'joined', 'access'],
    projects: ['photo', 'name', 'code', 'created', 'users', 'sheets'],
    attrValues: ['id', 'description', 'sortOrder'],
    resourceRates: ['id', 'name', 'category', 'unit', 'rate', 'udf1', 'udf2', 'udf3']
  });
  const [isColumnMenuOpen, setIsColumnMenuOpen] = useState<string | null>(null);
  const [isFrozen, setIsFrozen] = useState<Record<string, boolean>>({
    users: true,
    projects: true,
    attrValues: true,
    resourceRates: true
  });
  const [importPreview, setImportPreview] = useState<{ type: 'users' | 'projects' | 'attrValues' | 'resourceRates', data: any[], attrId?: string } | null>(null);
  const [userSort, setUserSort] = useState<{ field: string, direction: 'asc' | 'desc' }>({ field: 'name', direction: 'asc' });
  const [attrSort, setAttrSort] = useState<{ field: string, direction: 'asc' | 'desc' }>({ field: 'sortOrder', direction: 'asc' });
  const [resourceSort, setResourceSort] = useState<{ field: string, direction: 'asc' | 'desc' }>({ field: 'id', direction: 'asc' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newViewName, setNewViewName] = useState('');
  const [isSavedViewMenuOpen, setIsSavedViewMenuOpen] = useState<string | null>(null);
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);

  const getAttributes = (type: 'project' | 'lineItem') => {
    const field = type === 'project' ? 'projectAttributes' : 'lineItemAttributes';
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
  const valueIdExists = !isSubmitting && !isEditingValue?.valueId && isEditingValue && (getAttributes(isEditingValue.type).find(a => a.id === isEditingValue.attrId)?.values || []).some(v => v.id === valueFormData.id);

  useEffect(() => {
    const q = query(collection(db, 'projects'), where('enterpriseId', '==', enterprise.id));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setProjects(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Project)));
    });
    return () => unsubscribe();
  }, [enterprise.id]);

  useEffect(() => {
    const q = query(collection(db, 'sheets'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setSheets(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Sheet)));
    });
    return () => unsubscribe();
  }, []);

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
    return Object.entries(enterprise.users || {})
      .map(([uid, data]) => ({ uid, ...data }))
      .filter(user => 
        (user.displayName || user.name || '').toLowerCase().includes(userSearch.toLowerCase()) ||
        user.email.toLowerCase().includes(userSearch.toLowerCase())
      )
      .sort((a, b) => {
        const aVal = (a as any)[userSort.field] || '';
        const bVal = (b as any)[userSort.field] || '';
        if (userSort.direction === 'asc') return aVal > bVal ? 1 : -1;
        return aVal < bVal ? 1 : -1;
      });
  }, [enterprise.users, userSearch, userSort]);

  const sortedProjects = useMemo(() => {
    return [...projects]
      .filter(p => 
        p.projectName.toLowerCase().includes(projectSearch.toLowerCase()) ||
        p.projectCode.toLowerCase().includes(projectSearch.toLowerCase())
      )
      .sort((a, b) => {
        const aVal = (a as any)[projectSort.field] || '';
        const bVal = (b as any)[projectSort.field] || '';
        if (projectSort.direction === 'asc') return aVal > bVal ? 1 : -1;
        return aVal < bVal ? 1 : -1;
      });
  }, [projects, projectSearch, projectSort]);

  const filteredResources = useMemo(() => {
    return (enterprise.resourceRates || [])
      .filter(r => 
        r.name.toLowerCase().includes(resourceSearch.toLowerCase()) ||
        r.id.toLowerCase().includes(resourceSearch.toLowerCase()) ||
        (r.category || '').toLowerCase().includes(resourceSearch.toLowerCase())
      )
      .sort((a: any, b: any) => {
        const aVal = a[resourceSort.field];
        const bVal = b[resourceSort.field];
        if (resourceSort.direction === 'asc') return aVal > bVal ? 1 : -1;
        return aVal < bVal ? 1 : -1;
      });
  }, [enterprise.resourceRates, resourceSearch, resourceSort]);

  const bulkDeleteProjects = async () => {
    const promises = Array.from(selectedProjectIds).map((id: string) => deleteDoc(doc(db, 'projects', id)));
    await Promise.all(promises);
    setSelectedProjectIds(new Set());
    setDeleteConfirm(null);
    setSelectedProjectId(null);
  };

  const bulkDeleteAttributeValues = async (type: 'project' | 'lineItem', attrId: string) => {
    const field = type === 'project' ? 'projectAttributes' : 'lineItemAttributes';
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

  const filteredProjects = sortedProjects.filter(p => 
    p.projectName.toLowerCase().includes(projectSearch.toLowerCase()) ||
    p.projectCode.toLowerCase().includes(projectSearch.toLowerCase())
  );

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

  const sortedAttrValues = useMemo(() => {
    const values = (activeTab === 'projectAttributes' ? projectAttributes : lineItemAttributes).find((a: any) => a.id === selectedAttrId)?.values || [];
    return [...values].sort((a: any, b: any) => {
      const aVal = a[attrSort.field];
      const bVal = b[attrSort.field];
      if (attrSort.direction === 'asc') return aVal > bVal ? 1 : -1;
      return aVal < bVal ? 1 : -1;
    });
  }, [selectedAttrId, projectAttributes, lineItemAttributes, attrSort, activeTab]);


  const updateAttributeTitle = async (type: 'project' | 'lineItem', id: string, title: string) => {
    const field = type === 'project' ? 'projectAttributes' : 'lineItemAttributes';
    const currentAttrs = getAttributes(type);
    const newAttrs = currentAttrs.map(a => a.id === id ? { ...a, title } : a);
    await updateDoc(doc(db, 'enterprises', enterprise.id), {
      [field]: newAttrs
    });
  };

  const addAttributeValue = async (type: 'project' | 'lineItem', attrId: string, value: ProjectAttributeValue) => {
    try {
      setIsSubmitting(true);
      const field = type === 'project' ? 'projectAttributes' : 'lineItemAttributes';
      const currentAttrs = getAttributes(type);
      const finalValue = {
        ...value,
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

  const removeAttributeValue = async (type: 'project' | 'lineItem', attrId: string, valueId: string) => {
    const field = type === 'project' ? 'projectAttributes' : 'lineItemAttributes';
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

  const updateAttributeValue = async (type: 'project' | 'lineItem', attrId: string, valueId: string, updates: Partial<ProjectAttributeValue>) => {
    const field = type === 'project' ? 'projectAttributes' : 'lineItemAttributes';
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

  const handleExport = (type: 'project' | 'lineItem' | 'resourceRates', attrId?: string) => {
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

    const attrs = type === 'project' ? projectAttributes : lineItemAttributes;
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
    XLSX.writeFile(wb, `${type === 'project' ? 'Project' : 'LineItem'}_Attr_${attrId}_${attr.title || 'Untitled'}.xlsx`);
  };

  const handleImport = async (type: 'users' | 'projects' | 'attrValues' | 'resourceRates', file: File, attrId?: string) => {
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

    if (type === 'attrValues' && attrId) {
      const attrType = activeTab === 'projectAttributes' ? 'project' : 'lineItem';
      const field = attrType === 'project' ? 'projectAttributes' : 'lineItemAttributes';
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
    }

    setImportPreview(null);
    alert('Import completed successfully.');
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

  return (
    <div className="flex-1 flex flex-col min-h-0 p-8 w-full transition-colors duration-300">
      {/* Header */}
      <div className="mb-8 shrink-0">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold dark:text-white">{enterprise.name} Administration</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Manage enterprise-wide settings, users, and projects.</p>
          </div>
          {activeTab === 'users' && (
            <button 
              onClick={() => setInviteModal(true)}
              className="bg-black dark:bg-white text-white dark:text-black px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              Invite User
            </button>
          )}
        </div>
        
        <div className="flex gap-6 border-b border-gray-200 dark:border-white/10">
          {[
            { id: 'users', label: 'Users', icon: Users },
            { id: 'projects', label: 'Projects & Assignments', icon: Briefcase },
            { id: 'projectAttributes', label: 'Enterprise Project Attributes', icon: Tag },
            { id: 'lineItemAttributes', label: 'Enterprise Line-Item Attributes', icon: Tag },
            { id: 'resourceRates', label: 'Enterprise Resources Rates', icon: Settings },
          ].map(tab => (
            <button 
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as any);
                setSelectedUserId(null);
                setSelectedProjectId(null);
                setSelectedProjectIds(new Set());
                setSelectedAttrValueIds(new Set());
                setSelectedAttrId('01');
                setAttrSearch('');
              }}
              className={`pb-4 text-sm font-medium transition-colors relative flex items-center gap-2 ${activeTab === tab.id ? 'text-black dark:text-white' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {activeTab === tab.id && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-black dark:bg-white" />}
            </button>
          ))}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 flex gap-8 min-h-0">
        {/* Main List Column */}
        <div className={`flex-1 flex flex-col min-h-0 min-w-0 ${ (selectedUserId || selectedProjectId) ? 'hidden lg:flex' : 'flex'}`}>
          {activeTab === 'users' && (
            <div className="flex-1 flex flex-col min-h-0">
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
                  <button onClick={exportUsers} className="p-2 text-gray-400 hover:text-black dark:hover:text-white" title="Export"><Download className="w-4 h-4" /></button>
                  <div className="relative">
                    <button onClick={() => setIsColumnMenuOpen(isColumnMenuOpen === 'users' ? null : 'users')} className="p-2 text-gray-400 hover:text-black dark:hover:text-white flex items-center gap-1 text-xs font-medium">
                      <Eye className="w-4 h-4" /> Columns
                    </button>
                    {isColumnMenuOpen === 'users' && (
                      <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-xl shadow-xl z-50 p-2">
                        {['photo', 'name', 'email', 'joined', 'access'].map(col => (
                          <label key={col} className="flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-white/5 rounded-lg cursor-pointer">
                            <input 
                              type="checkbox"
                              checked={visibleColumns.users.includes(col)}
                              onChange={() => setVisibleColumns(prev => ({
                                ...prev,
                                users: prev.users.includes(col) ? prev.users.filter(c => c !== col) : [...prev.users, col]
                              }))}
                              className="rounded border-gray-300 dark:border-white/10 text-black focus:ring-black"
                            />
                            <span className="text-xs dark:text-white capitalize">{col}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                  <button onClick={() => setIsFrozen(prev => ({ ...prev, users: !prev.users }))} className={`p-2 flex items-center gap-1 text-xs font-medium ${isFrozen.users ? 'text-blue-600' : 'text-gray-400'}`}>
                    {isFrozen.users ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />} {isFrozen.users ? 'Frozen' : 'Freeze'}
                  </button>
                </div>
              </div>
              
              <div className="flex-1 overflow-auto border border-gray-200 dark:border-white/10 rounded-xl">
                <table className="w-full text-left border-collapse min-w-[800px]">
                  <thead className="bg-gray-50 dark:bg-white/5 sticky top-0 z-20">
                    <tr>
                      {visibleColumns.users.includes('photo') && <th className={`p-2 w-12 text-[10px] font-bold uppercase tracking-widest text-gray-400 ${isFrozen.users ? 'sticky left-0 z-30 bg-gray-50 dark:bg-[#1a1a1a] border-r border-gray-200 dark:border-white/10' : ''}`}>Photo</th>}
                      {visibleColumns.users.includes('name') && <th onClick={() => handleUserSort('name')} className={`p-2 text-[10px] font-bold uppercase tracking-widest text-gray-400 cursor-pointer hover:text-black dark:hover:text-white ${isFrozen.users ? 'sticky left-12 z-30 bg-gray-50 dark:bg-[#1a1a1a] border-r border-gray-200 dark:border-white/10' : ''}`}>Name {userSort.field === 'name' && (userSort.direction === 'asc' ? '↑' : '↓')}</th>}
                      {visibleColumns.users.includes('email') && <th onClick={() => handleUserSort('email')} className="p-2 text-[10px] font-bold uppercase tracking-widest text-gray-400 cursor-pointer hover:text-black dark:hover:text-white">Email {userSort.field === 'email' && (userSort.direction === 'asc' ? '↑' : '↓')}</th>}
                      {visibleColumns.users.includes('joined') && <th onClick={() => handleUserSort('joinedAt')} className="p-2 text-[10px] font-bold uppercase tracking-widest text-gray-400 cursor-pointer hover:text-black dark:hover:text-white">Joined {userSort.field === 'joinedAt' && (userSort.direction === 'asc' ? '↑' : '↓')}</th>}
                      {visibleColumns.users.includes('access') && <th onClick={() => handleUserSort('role')} className="p-2 text-[10px] font-bold uppercase tracking-widest text-gray-400 cursor-pointer hover:text-black dark:hover:text-white">Access {userSort.field === 'role' && (userSort.direction === 'asc' ? '↑' : '↓')}</th>}
                      <th className="p-2 text-[10px] font-bold uppercase tracking-widest text-gray-400 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                    {filteredUsers.map((user) => (
                      <tr key={user.uid} onClick={() => setSelectedUserId(user.uid)} className={`hover:bg-gray-50 dark:hover:bg-white/5 transition-colors cursor-pointer group ${selectedUserId === user.uid ? 'bg-blue-50/50 dark:bg-blue-500/5' : ''}`}>
                        {visibleColumns.users.includes('photo') && (
                          <td className={`p-2 ${isFrozen.users ? 'sticky left-0 z-10 bg-inherit border-r border-gray-200 dark:border-white/10' : ''}`}>
                            <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-100 dark:bg-white/5 flex items-center justify-center border border-gray-200 dark:border-white/10">
                              {user.photoURL ? <img src={user.photoURL} alt="" className="w-full h-full object-cover" /> : <Users className="w-4 h-4 text-gray-400" />}
                            </div>
                          </td>
                        )}
                        {visibleColumns.users.includes('name') && (
                          <td className={`p-2 text-xs font-bold ${selectedUserId === user.uid ? 'text-blue-600 dark:text-blue-400' : 'dark:text-white'} ${isFrozen.users ? 'sticky left-12 z-10 bg-inherit border-r border-gray-200 dark:border-white/10' : ''}`}>
                            {user.name || user.displayName || user.email?.split('@')[0] || 'Unknown User'}
                          </td>
                        )}
                        {visibleColumns.users.includes('email') && <td className="p-2 text-[10px] text-gray-500 dark:text-gray-400">{user.email || 'No email'}</td>}
                        {visibleColumns.users.includes('joined') && <td className="p-2 text-[10px] text-gray-500 dark:text-gray-400">{user.joinedAt ? new Date(user.joinedAt).toLocaleDateString() : 'N/A'}</td>}
                        {visibleColumns.users.includes('access') && <td className="p-2 text-[10px] font-medium dark:text-white">{user.role}</td>}
                        <td className="p-2 text-right">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={(e) => { e.stopPropagation(); toggleUserRole(user.uid); }} className="p-1.5 text-gray-400 hover:text-blue-600"><Settings className="w-3.5 h-3.5" /></button>
                            <button onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ type: 'user', id: user.uid, name: user.email || user.name }); }} className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'projects' && (
            <div className="flex-1 flex flex-col min-h-0">
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
                  <button onClick={exportProjects} className="p-2 text-gray-400 hover:text-black dark:hover:text-white" title="Export"><Download className="w-4 h-4" /></button>
                  <div className="relative">
                    <button onClick={() => setIsColumnMenuOpen(isColumnMenuOpen === 'projects' ? null : 'projects')} className="p-2 text-gray-400 hover:text-black dark:hover:text-white flex items-center gap-1 text-xs font-medium">
                      <Eye className="w-4 h-4" /> Columns
                    </button>
                    {isColumnMenuOpen === 'projects' && (
                      <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-xl shadow-xl z-50 p-2">
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
                      </div>
                    )}
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
                  <thead className="bg-gray-50 dark:bg-white/5 sticky top-0 z-20">
                    <tr>
                      <th className={`p-2 w-10 ${isFrozen.projects ? 'sticky left-0 z-30 bg-gray-50 dark:bg-[#1a1a1a] border-r border-gray-200 dark:border-white/10' : ''}`}>
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
                      {visibleColumns.projects.includes('photo') && <th className="p-2 w-12 text-[10px] font-bold uppercase tracking-widest text-gray-400">Photo</th>}
                      {visibleColumns.projects.includes('name') && <th onClick={() => handleProjectSort('projectName')} className={`p-2 text-[10px] font-bold uppercase tracking-widest text-gray-400 cursor-pointer hover:text-black dark:hover:text-white ${isFrozen.projects ? 'sticky left-10 z-30 bg-gray-50 dark:bg-[#1a1a1a] border-r border-gray-200 dark:border-white/10' : ''}`}>Name {projectSort.field === 'projectName' && (projectSort.direction === 'asc' ? '↑' : '↓')}</th>}
                      {visibleColumns.projects.includes('code') && <th onClick={() => handleProjectSort('projectCode')} className="p-2 text-[10px] font-bold uppercase tracking-widest text-gray-400 cursor-pointer hover:text-black dark:hover:text-white">Code {projectSort.field === 'projectCode' && (projectSort.direction === 'asc' ? '↑' : '↓')}</th>}
                      {visibleColumns.projects.includes('created') && <th onClick={() => handleProjectSort('dateCreated')} className="p-2 text-[10px] font-bold uppercase tracking-widest text-gray-400 cursor-pointer hover:text-black dark:hover:text-white">Created {projectSort.field === 'dateCreated' && (projectSort.direction === 'asc' ? '↑' : '↓')}</th>}
                      {visibleColumns.projects.includes('users') && <th className="p-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">Users</th>}
                      {visibleColumns.projects.includes('sheets') && <th className="p-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">Sheets</th>}
                      <th className="p-2 text-[10px] font-bold uppercase tracking-widest text-gray-400 text-right">Actions</th>
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
                        {visibleColumns.projects.includes('created') && <td className="p-2 text-[10px] text-gray-500 dark:text-gray-400">{project.dateCreated ? new Date(project.dateCreated).toLocaleDateString() : 'N/A'}</td>}
                        {visibleColumns.projects.includes('users') && <td className="p-2 text-[10px] text-gray-500 dark:text-gray-400">{Object.keys(project.users || {}).length}</td>}
                        {visibleColumns.projects.includes('sheets') && <td className="p-2 text-[10px] text-gray-500 dark:text-gray-400">{sheets.filter(s => s.projectId === project.id).length}</td>}
                        <td className="p-2 text-right">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button className="p-1.5 text-gray-400 hover:text-blue-600"><ExternalLink className="w-3.5 h-3.5" /></button>
                            <button onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ type: 'project', id: project.id, name: project.projectName }); }} className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {(activeTab === 'projectAttributes' || activeTab === 'lineItemAttributes') && (
            <div className="flex-1 flex gap-8 min-h-0">
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
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-white/10">
                        <th className="p-2 text-[10px] font-bold uppercase tracking-widest text-gray-400 w-12 text-center">#</th>
                        <th className="p-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">Title</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-white/5">
                      {(activeTab === 'projectAttributes' ? projectAttributes : lineItemAttributes).filter(a => a.title.toLowerCase().includes(attrSearch.toLowerCase()) || a.id.includes(attrSearch)).map((attr: any) => (
                        <tr 
                          key={attr.id}
                          onClick={() => setSelectedAttrId(attr.id)}
                          className={`cursor-pointer transition-colors ${selectedAttrId === attr.id ? 'bg-blue-50 dark:bg-blue-500/10' : 'hover:bg-gray-50 dark:hover:bg-white/5'}`}
                        >
                          <td className="p-2 text-xs font-bold text-gray-400 text-center">{attr.id}</td>
                          <td className="p-2">
                            <input 
                              type="text"
                              value={attr.title}
                              onChange={(e) => updateAttributeTitle(activeTab === 'projectAttributes' ? 'project' : 'lineItem', attr.id, e.target.value)}
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
                {selectedAttrId ? (
                  <>
                    <div className="p-4 border-b border-gray-100 dark:border-white/10 flex justify-between items-center bg-gray-50/50 dark:bg-white/5 shrink-0">
                      <div>
                        <h3 className="text-lg font-bold dark:text-white">
                          Attribute {selectedAttrId}: {(activeTab === 'projectAttributes' ? projectAttributes : lineItemAttributes).find((a: any) => a.id === selectedAttrId)?.title || 'Untitled'}
                        </h3>
                        <p className="text-xs text-gray-500">Manage the list of allowed values for this attribute.</p>
                      </div>
                      <div className="flex gap-2">
                        <input 
                          type="file" 
                          ref={fileInputRef} 
                          className="hidden" 
                          accept=".xlsx,.xls,.csv"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleImport('attrValues', file, selectedAttrId);
                          }}
                        />
                        <button 
                          onClick={() => fileInputRef.current?.click()}
                          className="p-2 text-gray-400 hover:text-black dark:hover:text-white"
                          title="Import"
                        >
                          <Upload className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleExport(activeTab === 'projectAttributes' ? 'project' : 'lineItem', selectedAttrId)}
                          className="p-2 text-gray-400 hover:text-black dark:hover:text-white"
                          title="Export"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <div className="relative">
                          <button onClick={() => setIsColumnMenuOpen(isColumnMenuOpen === 'attrValues' ? null : 'attrValues')} className="p-2 text-gray-400 hover:text-black dark:hover:text-white flex items-center gap-1 text-xs font-medium">
                            <Eye className="w-4 h-4" /> Columns
                          </button>
                          {isColumnMenuOpen === 'attrValues' && (
                            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-xl shadow-xl z-50 p-2">
                              {['id', 'description', 'sortOrder'].map(col => (
                                <label key={col} className="flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-white/5 rounded-lg cursor-pointer">
                                  <input 
                                    type="checkbox"
                                    checked={visibleColumns.attrValues.includes(col)}
                                    onChange={() => setVisibleColumns(prev => ({
                                      ...prev,
                                      attrValues: prev.attrValues.includes(col) ? prev.attrValues.filter(c => c !== col) : [...prev.attrValues, col]
                                    }))}
                                    className="rounded border-gray-300 dark:border-white/10 text-black focus:ring-black"
                                  />
                                  <span className="text-xs dark:text-white capitalize">{col}</span>
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                        <button onClick={() => setIsFrozen(prev => ({ ...prev, attrValues: !prev.attrValues }))} className={`p-2 flex items-center gap-1 text-xs font-medium ${isFrozen.attrValues ? 'text-blue-600' : 'text-gray-400'}`}>
                          {isFrozen.attrValues ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />} {isFrozen.attrValues ? 'Frozen' : 'Freeze'}
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
                            const currentAttr = (activeTab === 'projectAttributes' ? projectAttributes : lineItemAttributes).find((a: any) => a.id === selectedAttrId);
                            setValueFormData({ id: '', description: '', sortOrder: (currentAttr?.values?.length || 0) + 1 });
                            setIsEditingValue({ type: activeTab === 'projectAttributes' ? 'project' : 'lineItem', attrId: selectedAttrId, valueId: null });
                          }}
                          className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20"
                        >
                          <Plus className="w-4 h-4" />
                          Add
                        </button>
                      </div>
                    </div>
                    
                    <div className="flex-1 overflow-auto">
                      <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-50/30 dark:bg-white/2 sticky top-0 z-20">
                          <tr className="border-b border-gray-100 dark:border-white/10">
                            <th className={`p-2 w-12 ${isFrozen.attrValues ? 'sticky left-0 z-30 bg-gray-50 dark:bg-[#1a1a1a] border-r border-gray-200 dark:border-white/10' : ''}`}>
                              <input 
                                type="checkbox" 
                                className="rounded border-gray-300 dark:border-white/20 bg-transparent"
                                checked={
                                  ((activeTab === 'projectAttributes' ? projectAttributes : lineItemAttributes).find((a: any) => a.id === selectedAttrId)?.values || []).length > 0 &&
                                  ((activeTab === 'projectAttributes' ? projectAttributes : lineItemAttributes).find((a: any) => a.id === selectedAttrId)?.values || []).every((v: any) => selectedAttrValueIds.has(v.id))
                                }
                                onChange={(e) => {
                                  const values = (activeTab === 'projectAttributes' ? projectAttributes : lineItemAttributes).find((a: any) => a.id === selectedAttrId)?.values || [];
                                  if (e.target.checked) {
                                    setSelectedAttrValueIds(new Set(values.map((v: any) => v.id)));
                                  } else {
                                    setSelectedAttrValueIds(new Set());
                                  }
                                }}
                              />
                            </th>
                            {visibleColumns.attrValues.includes('id') && <th onClick={() => handleAttrSort('id')} className={`p-2 text-[10px] font-bold uppercase tracking-widest text-gray-400 cursor-pointer hover:text-black dark:hover:text-white ${isFrozen.attrValues ? 'sticky left-12 z-30 bg-gray-50 dark:bg-[#1a1a1a] border-r border-gray-200 dark:border-white/10' : ''}`}>ID {attrSort.field === 'id' && (attrSort.direction === 'asc' ? '↑' : '↓')}</th>}
                            {visibleColumns.attrValues.includes('description') && <th onClick={() => handleAttrSort('description')} className="p-2 text-[10px] font-bold uppercase tracking-widest text-gray-400 cursor-pointer hover:text-black dark:hover:text-white">Description {attrSort.field === 'description' && (attrSort.direction === 'asc' ? '↑' : '↓')}</th>}
                            {visibleColumns.attrValues.includes('sortOrder') && <th onClick={() => handleAttrSort('sortOrder')} className="p-2 text-[10px] font-bold uppercase tracking-widest text-gray-400 cursor-pointer hover:text-black dark:hover:text-white">Sort Order {attrSort.field === 'sortOrder' && (attrSort.direction === 'asc' ? '↑' : '↓')}</th>}
                            <th className="p-2 text-[10px] font-bold uppercase tracking-widest text-gray-400 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-white/5">
                          {sortedAttrValues.map((val: any) => (
                            <tr key={val.id} className={`hover:bg-gray-50 dark:hover:bg-white/5 transition-colors group ${selectedAttrValueIds.has(val.id) ? 'bg-blue-50/50 dark:bg-blue-500/5' : ''}`}>
                              <td className={`p-2 ${isFrozen.attrValues ? 'sticky left-0 z-10 bg-inherit border-r border-gray-200 dark:border-white/10' : ''}`}>
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
                              {visibleColumns.attrValues.includes('id') && <td className={`p-2 text-xs font-mono dark:text-white ${isFrozen.attrValues ? 'sticky left-12 z-10 bg-inherit border-r border-gray-200 dark:border-white/10' : ''}`}>{val.id}</td>}
                              {visibleColumns.attrValues.includes('description') && <td className="p-2 text-xs dark:text-white">{val.description}</td>}
                              {visibleColumns.attrValues.includes('sortOrder') && <td className="p-2 text-xs dark:text-white">{val.sortOrder}</td>}
                              <td className="p-2 text-right">
                                <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button 
                                    onClick={() => {
                                      setValueFormData(val);
                                      setIsEditingValue({ type: activeTab === 'projectAttributes' ? 'project' : 'lineItem', attrId: selectedAttrId, valueId: val.id });
                                    }}
                                    className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                  </button>
                                  <button 
                                    onClick={() => removeAttributeValue(activeTab === 'projectAttributes' ? 'project' : 'lineItem', selectedAttrId, val.id)}
                                    className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        {((activeTab === 'projectAttributes' ? projectAttributes : lineItemAttributes).find((a: any) => a.id === selectedAttrId)?.values || []).length === 0 && (
                            <tr>
                              <td colSpan={5} className="p-12 text-center">
                                <Tag className="w-12 h-12 text-gray-200 dark:text-white/10 mx-auto mb-4" />
                                <p className="text-gray-500 dark:text-gray-400 text-sm">No values defined for this attribute.</p>
                                <button 
                                  onClick={() => {
                                    setValueFormData({ id: '', description: '', sortOrder: 1 });
                                    setIsEditingValue({ type: activeTab === 'projectAttributes' ? 'project' : 'lineItem', attrId: selectedAttrId, valueId: null });
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
                  </>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                    <div className="w-16 h-16 bg-gray-50 dark:bg-white/5 rounded-full flex items-center justify-center mb-6">
                      <ChevronRight className="w-8 h-8 text-gray-300" />
                    </div>
                    <h3 className="text-lg font-bold dark:text-white mb-2">Select an Attribute</h3>
                    <p className="text-sm text-gray-500 max-w-xs">Choose one of the 10 static attributes from the left sidebar to manage its values.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'resourceRates' && (
            <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-[#141414] border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden">
              <div className="p-6 border-b border-gray-100 dark:border-white/10 flex justify-between items-center bg-gray-50/50 dark:bg-white/5 shrink-0">
                <div>
                  <h3 className="text-xl font-bold dark:text-white">Enterprise Resources Rates</h3>
                  <p className="text-sm text-gray-500">Define standard rates for resources to be used in forecasting sheets.</p>
                </div>
                <div className="flex gap-2">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input 
                      type="text" 
                      placeholder="Search resources..."
                      value={resourceSearch}
                      onChange={(e) => setResourceSearch(e.target.value)}
                      className="pl-10 pr-4 py-2 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none w-64 dark:text-white"
                    />
                  </div>
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
                    className="p-2 text-gray-400 hover:text-black dark:hover:text-white"
                    title="Import"
                  >
                    <Upload className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={() => handleExport('resourceRates')}
                    className="p-2 text-gray-400 hover:text-black dark:hover:text-white"
                    title="Export"
                  >
                    <Download className="w-5 h-5" />
                  </button>
                  <div className="relative">
                    <button onClick={() => setIsSavedViewMenuOpen(isSavedViewMenuOpen === 'resourceRates' ? null : 'resourceRates')} className="p-2 text-gray-400 hover:text-black dark:hover:text-white flex items-center gap-1 text-sm font-medium">
                      <Bookmark className="w-5 h-5" /> Views
                    </button>
                    {isSavedViewMenuOpen === 'resourceRates' && (
                      <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-xl shadow-xl z-50 p-3">
                        <div className="mb-3">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1 block">Save Current View</label>
                          <div className="flex gap-2">
                            <input 
                              type="text"
                              value={newViewName}
                              onChange={(e) => setNewViewName(e.target.value)}
                              placeholder="View name (e.g. Summary)"
                              className="flex-1 px-2 py-1 text-xs bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg dark:text-white"
                            />
                            <button 
                              onClick={() => {
                                if (!newViewName.trim()) return;
                                const newView: SavedView = {
                                  id: Math.random().toString(36).substr(2, 9),
                                  name: newViewName,
                                  tableId: 'resourceRates',
                                  columns: visibleColumns.resourceRates,
                                  userId: auth.currentUser?.uid || '',
                                  createdAt: new Date().toISOString()
                                };
                                setSavedViews(prev => [...prev, newView]);
                                setNewViewName('');
                              }}
                              className="p-1 bg-black dark:bg-white text-white dark:text-black rounded-lg"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <div className="space-y-1 max-h-48 overflow-auto">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1 block">Saved Views</label>
                          {savedViews.filter(v => v.tableId === 'resourceRates').map(view => (
                            <div key={view.id} className="flex items-center justify-between group/view">
                              <button 
                                onClick={() => setVisibleColumns(prev => ({ ...prev, resourceRates: view.columns }))}
                                className="flex-1 text-left p-2 text-xs dark:text-white hover:bg-gray-50 dark:hover:bg-white/5 rounded-lg"
                              >
                                {view.name}
                              </button>
                              <button 
                                onClick={() => setSavedViews(prev => prev.filter(v => v.id !== view.id))}
                                className="p-1 text-gray-400 hover:text-red-600 opacity-0 group-hover/view:opacity-100 transition-opacity"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                          {savedViews.filter(v => v.tableId === 'resourceRates').length === 0 && (
                            <p className="text-[10px] text-gray-500 italic p-2">No saved views yet.</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="relative">
                    <button onClick={() => setIsColumnMenuOpen(isColumnMenuOpen === 'resourceRates' ? null : 'resourceRates')} className="p-2 text-gray-400 hover:text-black dark:hover:text-white flex items-center gap-1 text-sm font-medium">
                      <Eye className="w-5 h-5" /> Columns
                    </button>
                    {isColumnMenuOpen === 'resourceRates' && (
                      <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-xl shadow-xl z-50 p-2">
                        {['id', 'name', 'category', 'unit', 'rate', 'udf1', 'udf2', 'udf3'].map(col => (
                          <label key={col} className="flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-white/5 rounded-lg cursor-pointer">
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
                      </div>
                    )}
                  </div>
                  <button onClick={() => setIsFrozen(prev => ({ ...prev, resourceRates: !prev.resourceRates }))} className={`p-2 flex items-center gap-1 text-sm font-medium ${isFrozen.resourceRates ? 'text-blue-600' : 'text-gray-400'}`}>
                    {isFrozen.resourceRates ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />} {isFrozen.resourceRates ? 'Frozen' : 'Freeze'}
                  </button>
                  {selectedRateIds.size > 0 && (
                    <button 
                      onClick={() => setDeleteConfirm({ type: 'bulk-rate', count: selectedRateIds.size })}
                      className="px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-red-700 transition-colors shadow-lg shadow-red-600/20"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete ({selectedRateIds.size})
                    </button>
                  )}
                  <button 
                    onClick={() => {
                      setResourceFormData({ id: '', name: '', unit: '', rate: 0, category: '', udf1: '', udf2: '', udf3: '' });
                      setIsEditingResource({ id: null });
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20"
                  >
                    <Plus className="w-5 h-5" />
                    Add Resource
                  </button>
                </div>
              </div>
              
              <div className="flex-1 overflow-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-gray-50/30 dark:bg-white/2 sticky top-0 z-20">
                    <tr className="border-b border-gray-100 dark:border-white/10">
                      <th className={`p-2 w-12 ${isFrozen.resourceRates ? 'sticky left-0 z-30 bg-gray-50 dark:bg-[#1a1a1a] border-r border-gray-200 dark:border-white/10' : ''}`}>
                        <input 
                          type="checkbox" 
                          className="rounded border-gray-300 dark:border-white/20 bg-transparent"
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
                      {visibleColumns.resourceRates.includes('id') && <th onClick={() => handleResourceSort('id')} className={`p-2 text-[10px] font-bold uppercase tracking-widest text-gray-400 cursor-pointer hover:text-black dark:hover:text-white ${isFrozen.resourceRates ? 'sticky left-12 z-30 bg-gray-50 dark:bg-[#1a1a1a] border-r border-gray-200 dark:border-white/10' : ''}`}>ID {resourceSort.field === 'id' && (resourceSort.direction === 'asc' ? '↑' : '↓')}</th>}
                      {visibleColumns.resourceRates.includes('name') && <th onClick={() => handleResourceSort('name')} className="p-2 text-[10px] font-bold uppercase tracking-widest text-gray-400 cursor-pointer hover:text-black dark:hover:text-white">Resource Name {resourceSort.field === 'name' && (resourceSort.direction === 'asc' ? '↑' : '↓')}</th>}
                      {visibleColumns.resourceRates.includes('category') && <th onClick={() => handleResourceSort('category')} className="p-2 text-[10px] font-bold uppercase tracking-widest text-gray-400 cursor-pointer hover:text-black dark:hover:text-white">Category {resourceSort.field === 'category' && (resourceSort.direction === 'asc' ? '↑' : '↓')}</th>}
                      {visibleColumns.resourceRates.includes('unit') && <th onClick={() => handleResourceSort('unit')} className="p-2 text-[10px] font-bold uppercase tracking-widest text-gray-400 cursor-pointer hover:text-black dark:hover:text-white">Unit {resourceSort.field === 'unit' && (resourceSort.direction === 'asc' ? '↑' : '↓')}</th>}
                      {visibleColumns.resourceRates.includes('rate') && <th onClick={() => handleResourceSort('rate')} className="p-2 text-[10px] font-bold uppercase tracking-widest text-gray-400 cursor-pointer hover:text-black dark:hover:text-white text-right pr-4">Rate {resourceSort.field === 'rate' && (resourceSort.direction === 'asc' ? '↑' : '↓')}</th>}
                      {visibleColumns.resourceRates.includes('udf1') && <th className="p-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">UDF 1</th>}
                      {visibleColumns.resourceRates.includes('udf2') && <th className="p-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">UDF 2</th>}
                      {visibleColumns.resourceRates.includes('udf3') && <th className="p-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">UDF 3</th>}
                      <th className="p-2 w-12 sticky right-0 z-30 bg-gray-50/30 dark:bg-[#1a1a1a] border-l border-gray-100 dark:border-white/10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-white/5">
                    {filteredResources.map(resource => (
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
                          <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="relative group/menu">
                              <button className="p-1.5 text-gray-400 hover:text-black dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-white/5">
                                <MoreVertical className="w-4 h-4" />
                              </button>
                              <div className="absolute right-0 bottom-full mb-2 w-48 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-xl shadow-xl z-50 p-2 hidden group-hover/menu:block">
                                <button 
                                  onClick={() => {
                                    const index = (enterprise.resourceRates || []).findIndex(r => r.id === resource.id);
                                    setResourceFormData({ id: '', name: '', unit: '', rate: 0, category: '', udf1: '', udf2: '', udf3: '' });
                                    setIsEditingResource({ id: null, insertIndex: index });
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
                                  }}
                                  className="w-full text-left p-2 text-xs dark:text-white hover:bg-gray-50 dark:hover:bg-white/5 rounded-lg flex items-center gap-2"
                                >
                                  <Edit2 className="w-3 h-3" /> Edit
                                </button>
                                <button 
                                  onClick={() => setDeleteConfirm({ type: 'rate', id: resource.id, name: resource.name })}
                                  className="w-full text-left p-2 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg flex items-center gap-2"
                                >
                                  <Trash2 className="w-3 h-3" /> Delete
                                </button>
                              </div>
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
                          <p className="text-gray-500 dark:text-gray-400 text-sm">No resources found matching your search.</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Side Detail Panel */}
        {(selectedUserId || selectedProjectId) && (
          <div className="w-full lg:w-96 bg-white dark:bg-[#141414] border border-gray-200 dark:border-white/10 rounded-2xl flex flex-col overflow-hidden shadow-xl animate-in slide-in-from-right duration-300">
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
          </div>
        )}
      </div>

      {/* Modals */}
      {importPreview && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[110] p-4">
          <div className="bg-white dark:bg-[#141414] rounded-3xl p-8 w-full max-w-2xl shadow-2xl border border-gray-200 dark:border-white/10 animate-in zoom-in-95 duration-200 flex flex-col max-h-[80vh]">
            <h2 className="text-2xl font-bold mb-4 dark:text-white">Review Import</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6 text-sm">
              The following records will be imported. Existing IDs will be updated.
            </p>
            <div className="flex-1 overflow-auto border border-gray-200 dark:border-white/10 rounded-xl mb-6">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 dark:bg-white/5 sticky top-0">
                  <tr>
                    {Object.keys(importPreview.data[0] || {}).map(key => (
                      <th key={key} className="px-4 py-2 font-semibold">{key}</th>
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
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[100] p-4">
          <div className="bg-white dark:bg-[#141414] rounded-3xl p-8 w-full max-w-md shadow-2xl border border-gray-200 dark:border-white/10 animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-red-50 dark:bg-red-500/10 rounded-full flex items-center justify-center mb-6 mx-auto">
              <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
            <h2 className="text-2xl font-bold mb-2 text-center dark:text-white">
              {deleteConfirm.type === 'bulk-project' ? 'Delete Projects?' : 
               deleteConfirm.type === 'bulk-attr-value' ? 'Delete Attribute Values?' :
               'Delete User?'}
            </h2>
            <p className="text-gray-500 dark:text-gray-400 text-center mb-8">
              {deleteConfirm.type === 'bulk-project' ? (
                <>You are about to delete <span className="font-bold text-black dark:text-white">{deleteConfirm.count}</span> projects. This action cannot be undone.</>
              ) : deleteConfirm.type === 'bulk-attr-value' ? (
                <>You are about to delete <span className="font-bold text-black dark:text-white">{deleteConfirm.count}</span> attribute values. This action cannot be undone.</>
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
                  else if (deleteConfirm.type === 'bulk-attr-value') bulkDeleteAttributeValues(activeTab === 'projectAttributes' ? 'project' : 'lineItem', selectedAttrId);
                }}
                className="flex-1 py-4 bg-red-600 text-white rounded-2xl text-sm font-bold uppercase tracking-widest hover:bg-red-700 transition-colors shadow-lg shadow-red-600/20"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {isEditingResource && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[100] p-4">
          <div className="bg-white dark:bg-[#141414] rounded-3xl p-8 w-full max-w-lg shadow-2xl border border-gray-200 dark:border-white/10 animate-in zoom-in-95 duration-200">
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
                    maxLength={15}
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
                  <select 
                    required
                    value={resourceFormData.unit}
                    onChange={e => setResourceFormData({ ...resourceFormData, unit: e.target.value })}
                    className="w-full p-4 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-black/5 dark:text-white"
                  >
                    <option value="">Select Unit</option>
                    {RESOURCE_UNITS.map(unit => (
                      <option key={unit} value={unit}>{unit}</option>
                    ))}
                  </select>
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
          </div>
        </div>
      )}
      {inviteModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[100] p-4">
          <div className="bg-white dark:bg-[#141414] rounded-3xl p-8 w-full max-w-md shadow-2xl border border-gray-200 dark:border-white/10 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold dark:text-white">Invite New User</h2>
              <button onClick={() => setInviteModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleInvite} className="space-y-4">
              {!generatedLink ? (
                <>
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
                  <p className="text-xs text-gray-500 dark:text-gray-400">
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
                </>
              ) : (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
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
                </div>
              )}
            </form>
          </div>
        </div>
      )}
      {/* Project Attribute Value Modal */}
      {isEditingValue && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#1C1C1C] rounded-2xl w-full max-w-md shadow-2xl border border-gray-200 dark:border-white/10 overflow-hidden">
            <div className="p-6 border-b border-gray-100 dark:border-white/10 flex justify-between items-center">
              <h3 className="text-xl font-bold dark:text-white">
                {isEditingValue.valueId ? 'Edit Value' : 'Add New Value'}
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
                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Sort Order <span className="text-red-500">*</span></label>
                <input 
                  required
                  type="number"
                  value={valueFormData.sortOrder}
                  onChange={e => setValueFormData({ ...valueFormData, sortOrder: parseInt(e.target.value) || 0 })}
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
                className="px-8 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {isEditingValue.valueId ? 'Save Changes' : 'Add Value'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
