import React, { useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Tag } from 'lucide-react';
import { AgGridReact } from 'ag-grid-react';
import { toast } from 'sonner';
import { useEnterpriseRepo, useUtilityRepo, useAuthRepo } from '../../../platform/firestore/hooks';
import DataGridModule from '../../DataGridModule';
import { buildUserColumnDefs } from '../columns';
import type { Enterprise, Project } from '../../../types';
import type { ColDef, ColGroupDef } from 'ag-grid-community';

interface UsersTabProps {
  enterprise: Enterprise;
  projects: Project[];
  userColumnDefs: (ColDef | ColGroupDef)[];
  setDeleteConfirm: (confirm: {
    type: 'user' | 'bulk-user' | 'project' | 'bulk-project' | 'bulk-attr-value' | 'rate' | 'bulk-rate' | 'costElement' | 'bulk-costElement' | 'vendor' | 'bulk-vendor';
    id?: string;
    name?: string;
    count?: number;
    onConfirm?: () => void;
  } | null) => void;
}

export default function UsersTab({ enterprise, projects, userColumnDefs, setDeleteConfirm }: UsersTabProps) {
  const enterpriseRepo = useEnterpriseRepo();
  const utilityRepo = useUtilityRepo();
  const authRepo = useAuthRepo();
  const usersGridRef = useRef<AgGridReact>(null);

  // Local UI state
  const [userSearch, setUserSearch] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [inviteModal, setInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [userSort] = useState<{ field: string; direction: 'asc' | 'desc' }>({ field: 'name', direction: 'asc' });

  const filteredUsers = useMemo(() => {
    let result = Object.entries(enterprise.users || {})
      .map(([uid, data]) => ({ uid, ...data }))
      .filter(
        (user) =>
          (user.displayName || user.name || '').toLowerCase().includes(userSearch.toLowerCase()) ||
          user.email.toLowerCase().includes(userSearch.toLowerCase())
      );

    return result.sort((a, b) => {
      const aVal = (a as any)[userSort.field] || '';
      const bVal = (b as any)[userSort.field] || '';
      if (userSort.direction === 'asc') return aVal > bVal ? 1 : -1;
      return aVal < bVal ? 1 : -1;
    });
  }, [enterprise.users, userSearch, userSort]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail || isInviting) return;

    setIsInviting(true);
    try {
      const token =
        Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

      await utilityRepo.createInvitation({
        token,
        enterpriseId: enterprise.id,
        email: inviteEmail.toLowerCase().trim(),
        enterpriseName: enterprise.name,
        invitedBy: authRepo.getCurrentUser()?.id || '',
        status: 'pending',
        createdAt: new Date().toISOString(),
      });

      const inviteLink = `${window.location.origin}?token=${token}`;
      setGeneratedLink(inviteLink);

      try {
        const emailRes = await fetch('/api/invite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: inviteEmail,
            enterpriseName: enterprise.name,
            inviterName:
              authRepo.getCurrentUser()?.displayName ||
              authRepo.getCurrentUser()?.email ||
              'A colleague',
            appUrl: inviteLink,
          }),
        });
        if (!emailRes.ok) {
          const body = await emailRes.json().catch(() => ({}));
          console.error('Email delivery failed:', body);
          toast.error('Email could not be delivered — share the link below directly.');
        }
      } catch (emailErr) {
        console.warn('Email request failed (network):', emailErr);
        toast.error('Email could not be delivered — share the link below directly.');
      }

      const pendingInvites = (enterprise as any).pendingInvites || [];
      if (!pendingInvites.includes(inviteEmail)) {
        await enterpriseRepo.update(enterprise.id, {
          pendingInvites: [...pendingInvites, inviteEmail],
        } as any);
      }
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

  return (
    <>
      <motion.div
        key="users"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="flex-1 flex flex-col min-h-0"
      >
        <DataGridModule
          title="Enterprise Users"
          description="Manage users and their access levels within the enterprise."
          onAdd={() => setInviteModal(true)}
          gridRef={usersGridRef}
          searchPlaceholder="Search users..."
          quickFilterText={userSearch}
          onQuickFilterChange={setUserSearch}
          rowData={filteredUsers}
          columnDefs={userColumnDefs}
          theme={document.documentElement.classList.contains('dark') ? 'dark' : 'light'}
          onCellValueChanged={async (event) => {
            const { data, colDef, newValue } = event;
            if (!data.uid) return;
            await enterpriseRepo.update(enterprise.id, {
              [`users.${data.uid}.${colDef.field}`]: newValue,
            });
          }}
          gridProps={{
            rowSelection: 'multiple',
            onSelectionChanged: (params: any) => {
              const selectedNodes = params.api.getSelectedNodes();
              setSelectedUserIds(new Set(selectedNodes.map((node: any) => node.data.uid)));
            },
          }}
          selectedCount={selectedUserIds.size}
          onBulkDelete={() => setDeleteConfirm({ type: 'bulk-user', count: selectedUserIds.size })}
        />
      </motion.div>

      {/* Invite Modal */}
      <AnimatePresence>
        {inviteModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-[#141414] rounded-3xl p-8 w-full max-w-md shadow-2xl border border-gray-200 dark:border-white/10"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold dark:text-white">Invite New User</h2>
                <button
                  onClick={() => setInviteModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
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
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
                          Email Address
                        </label>
                        <input
                          required
                          type="email"
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
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
                        <p className="text-sm text-emerald-800 dark:text-emerald-400 font-medium mb-1">
                          Invitation Sent!
                        </p>
                        <p className="text-xs text-emerald-700/70 dark:text-emerald-400/60">
                          An email has been sent to your colleague. If it doesn't arrive, you can also share this
                          link directly.
                        </p>
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
    </>
  );
}
