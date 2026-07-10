import React from 'react';
import { RefreshCw, Save } from 'lucide-react';
import { Project, Enterprise, CostCode, ProjectAttribute } from '../../types';
import { cn } from '../../lib/utils';

interface CostCodeFormDialogProps {
  isEditing: { id: string | null; insertIndex?: number };
  formData: Partial<CostCode>;
  isSaving: boolean;
  isDuplicateId: boolean;
  enterpriseAttrs: ProjectAttribute[];
  projectAttrs: ProjectAttribute[];
  project: Project;
  enterprise: Enterprise;
  onFormDataChange: (data: Partial<CostCode>) => void;
  onCancel: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export default function CostCodeFormDialog({
  isEditing,
  formData,
  isSaving,
  isDuplicateId,
  enterpriseAttrs,
  projectAttrs,
  project,
  enterprise,
  onFormDataChange,
  onCancel,
  onSubmit,
}: CostCodeFormDialogProps) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[100] p-4">
      <div className="bg-white dark:bg-[#141414] rounded-3xl p-8 w-full max-w-2xl shadow-2xl border border-gray-200 dark:border-white/10 animate-in zoom-in-95 duration-200 overflow-y-auto max-h-[90vh] custom-scrollbar">
        <h2 className="text-xl font-bold mb-6 dark:text-white">
          {isEditing.id ? 'Edit' : 'Add'} Cost Code
        </h2>
        <form onSubmit={onSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-1">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
                Cost Code ID <span className="text-red-500">*</span>
              </label>
              <input
                required
                disabled={!!isEditing.id}
                type="text"
                maxLength={20}
                value={formData.code}
                onChange={(e) =>
                  onFormDataChange({ ...formData, code: e.target.value.toUpperCase() })
                }
                className={cn(
                  'w-full p-4 bg-gray-50 dark:bg-white/5 border rounded-2xl text-sm focus:outline-none focus:ring-2 transition-all dark:text-white disabled:opacity-50',
                  isDuplicateId
                    ? 'border-red-500 focus:ring-red-500/20'
                    : 'border-gray-200 dark:border-white/10 focus:ring-black/5'
                )}
              />
              {isDuplicateId && (
                <p className="text-[10px] text-red-500 mt-1 font-bold uppercase tracking-wider">
                  Duplicate Cost Code ID
                </p>
              )}
            </div>
            <div className="col-span-1">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
                Name (Optional)
              </label>
              <input
                type="text"
                maxLength={200}
                value={formData.name}
                onChange={(e) => onFormDataChange({ ...formData, name: e.target.value })}
                className="w-full p-4 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-black/5 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-1">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
                EAC Method
              </label>
              <select
                value={formData.eacMethod}
                onChange={(e) =>
                  onFormDataChange({ ...formData, eacMethod: e.target.value as any })
                }
                className="w-full p-4 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-black/5 dark:text-white"
              >
                {['Manual', 'Change Management', 'ETC Details', 'Sub-Contract Management'].map(
                  (m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  )
                )}
              </select>
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-4 border-b border-gray-100 dark:border-white/10 pb-2">
              Assigned Users (Visibility Control)
            </p>
            <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-200 dark:border-white/10 custom-scrollbar">
              {Object.entries(project.users || {}).map(([uid, role]) => (
                <label
                  key={uid}
                  className="flex items-center gap-2 p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-xl cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={formData.assignedUsers?.includes(uid)}
                    onChange={(e) => {
                      const current = formData.assignedUsers || [];
                      if (e.target.checked) {
                        onFormDataChange({ ...formData, assignedUsers: [...current, uid] });
                      } else {
                        onFormDataChange({
                          ...formData,
                          assignedUsers: current.filter((id) => id !== uid),
                        });
                      }
                    }}
                    className="w-4 h-4 rounded border-gray-300 dark:border-white/10 text-blue-600 focus:ring-blue-500 bg-transparent"
                  />
                  <div className="flex flex-col">
                    <span className="text-xs font-bold dark:text-white truncate max-w-[150px]">
                      {enterprise.users?.[uid]?.email || uid}
                    </span>
                    <span className="text-[9px] text-gray-400 uppercase tracking-widest font-bold">
                      {role}
                    </span>
                  </div>
                </label>
              ))}
            </div>
            <p className="mt-2 text-[9px] text-gray-400 italic">
              If users are assigned, only those users and Project Admins can see this cost code. If
              empty, all project members can see it.
            </p>
          </div>

          {enterpriseAttrs.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-4 border-b border-gray-100 dark:border-white/10 pb-2">
                Enterprise Attributes
              </p>
              <div className="grid grid-cols-2 gap-4">
                {enterpriseAttrs.map((attr) => (
                  <div key={attr.id}>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
                      {attr.title}
                    </label>
                    <select
                      value={formData.enterpriseAttributes?.[attr.id] || ''}
                      onChange={(e) =>
                        onFormDataChange({
                          ...formData,
                          enterpriseAttributes: {
                            ...formData.enterpriseAttributes,
                            [attr.id]: e.target.value,
                          },
                        })
                      }
                      className="w-full p-4 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-black/5 dark:text-white"
                    >
                      <option value="">Select...</option>
                      {attr.values.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.description}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {projectAttrs.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-4 border-b border-gray-100 dark:border-white/10 pb-2">
                Project Attributes
              </p>
              <div className="grid grid-cols-2 gap-4">
                {projectAttrs.map((attr) => (
                  <div key={attr.id}>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
                      {attr.title}
                    </label>
                    <select
                      value={formData.projectAttributes?.[attr.id] || ''}
                      onChange={(e) =>
                        onFormDataChange({
                          ...formData,
                          projectAttributes: {
                            ...formData.projectAttributes,
                            [attr.id]: e.target.value,
                          },
                        })
                      }
                      className="w-full p-4 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-black/5 dark:text-white"
                    >
                      <option value="">Select...</option>
                      {attr.values.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.description}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-6 border-t border-gray-100 dark:border-white/10">
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-3 text-sm font-bold text-gray-500 hover:text-black dark:hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || isDuplicateId}
              className={cn(
                'px-8 py-3 rounded-2xl text-sm font-bold transition-all flex items-center gap-2 shadow-xl',
                isSaving || isDuplicateId
                  ? 'bg-gray-200 dark:bg-white/5 text-gray-400 cursor-not-allowed shadow-none'
                  : 'bg-black dark:bg-white text-white dark:text-black hover:bg-black/90 dark:hover:bg-white/90 shadow-black/10'
              )}
            >
              {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}{' '}
              {isEditing.id ? 'Update' : 'Create'} Cost Code
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
