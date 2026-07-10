import React from 'react';
import { Plus } from 'lucide-react';
import { motion } from 'motion/react';
import { Enterprise, Project, Subcontract, CostCode } from '../../../types';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { cn } from '@/lib/utils';

export interface SubcontractFormDialogProps {
  open: boolean;
  editingSubcontractId: string | null;
  subcontractFormData: Partial<Subcontract>;
  setSubcontractFormData: (data: Partial<Subcontract>) => void;
  onSubmit: (e: React.FormEvent) => Promise<void>;
  onClose: () => void;
  enterprise: Enterprise;
  project: Project;
  costCodes: CostCode[];
}

export function SubcontractFormDialog({
  open,
  editingSubcontractId,
  subcontractFormData,
  setSubcontractFormData,
  onSubmit,
  onClose,
  enterprise,
  project,
  costCodes,
}: SubcontractFormDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold dark:text-white">
            {editingSubcontractId ? 'Edit Subcontract' : 'Add Subcontract'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full"
          >
            <Plus className="w-5 h-5 rotate-45 text-gray-400" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                Order ID
              </label>
              <Input
                maxLength={50}
                value={subcontractFormData.orderId}
                onChange={(e) =>
                  setSubcontractFormData({ ...subcontractFormData, orderId: e.target.value })
                }
                placeholder="e.g. SC-001"
                required
                disabled={!!editingSubcontractId}
                className={cn(
                  !!editingSubcontractId && 'bg-gray-50 dark:bg-white/5 cursor-not-allowed'
                )}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                Order Name
              </label>
              <Input
                value={subcontractFormData.orderName}
                onChange={(e) =>
                  setSubcontractFormData({ ...subcontractFormData, orderName: e.target.value })
                }
                placeholder="e.g. Concrete Works"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">
              Order Scope
            </label>
            <textarea
              value={subcontractFormData.orderScope}
              onChange={(e) =>
                setSubcontractFormData({ ...subcontractFormData, orderScope: e.target.value })
              }
              className="w-full p-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:text-white min-h-[100px]"
              placeholder="Describe the scope of work..."
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Status</label>
              <select
                value={subcontractFormData.status}
                onChange={(e) =>
                  setSubcontractFormData({ ...subcontractFormData, status: e.target.value as any })
                }
                className="w-full p-2 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
              >
                <option value="Active">Active</option>
                <option value="Complete">Complete</option>
                <option value="On Hold">On Hold</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                Default Cost Code
              </label>
              <select
                value={subcontractFormData.defaultCostCodeId || ''}
                onChange={(e) =>
                  setSubcontractFormData({
                    ...subcontractFormData,
                    defaultCostCodeId: e.target.value,
                  })
                }
                className="w-full p-2 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
              >
                <option value="">None</option>
                {[...costCodes]
                  .sort((a, b) => a.code.localeCompare(b.code))
                  .map((c) => (
                    <option key={c.id} value={c.code}>
                      {c.code} - {c.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                Payment Type
              </label>
              <select
                value={subcontractFormData.paymentType}
                onChange={(e) =>
                  setSubcontractFormData({
                    ...subcontractFormData,
                    paymentType: e.target.value as any,
                  })
                }
                className="w-full p-2 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
              >
                <option value="LumpSum">LumpSum</option>
                <option value="Schedule of Rates">Schedule of Rates</option>
                <option value="Re-measurable">Re-measurable</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                Award Date
              </label>
              <Input
                type="date"
                value={subcontractFormData.awardDate}
                onChange={(e) =>
                  setSubcontractFormData({ ...subcontractFormData, awardDate: e.target.value })
                }
              />
            </div>
          </div>

          {/* Default Timephasing */}
          <div className="p-4 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/5 space-y-4">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              Default Timephasing
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 tracking-wider">Phasing Source</label>
                <select
                  value={subcontractFormData.defaultPhasingSource}
                  onChange={(e) =>
                    setSubcontractFormData({
                      ...subcontractFormData,
                      defaultPhasingSource: e.target.value as any,
                    })
                  }
                  className="w-full p-2 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
                >
                  <option value="Manual">Manual</option>
                  <option value="Auto">Auto</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 tracking-wider">Distribution</label>
                <select
                  value={subcontractFormData.defaultDistribution}
                  onChange={(e) =>
                    setSubcontractFormData({
                      ...subcontractFormData,
                      defaultDistribution: e.target.value as any,
                    })
                  }
                  className="w-full p-2 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
                >
                  <option value="Even">Even</option>
                  <option value="Bell Curve">Bell Curve</option>
                  <option value="Front load">Front load</option>
                  <option value="Back load">Back load</option>
                  <option value="S-Curve">S-Curve</option>
                  <option value="Profile">Profile</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 tracking-wider">Start Date</label>
                <Input
                  type="date"
                  value={subcontractFormData.defaultStartDate || ''}
                  onChange={(e) =>
                    setSubcontractFormData({
                      ...subcontractFormData,
                      defaultStartDate: e.target.value,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 tracking-wider">End Date</label>
                <Input
                  type="date"
                  value={subcontractFormData.defaultEndDate || ''}
                  onChange={(e) =>
                    setSubcontractFormData({
                      ...subcontractFormData,
                      defaultEndDate: e.target.value,
                    })
                  }
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Vendor</label>
            <select
              value={subcontractFormData.vendorId}
              onChange={(e) => {
                const vendor = (enterprise.vendors || []).find((v) => v.id === e.target.value);
                setSubcontractFormData({
                  ...subcontractFormData,
                  vendorId: e.target.value,
                  vendorName: vendor?.name || '',
                });
              }}
              className="w-full p-2 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
            >
              <option value="">Select Vendor</option>
              {(enterprise.vendors || []).map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white">
              {editingSubcontractId ? 'Update Subcontract' : 'Create Subcontract'}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
