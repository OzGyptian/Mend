import React from 'react';
import { Project, ProgressPackage, RuleOfCredit } from '../../../types';
import { X } from 'lucide-react';
import { motion } from 'motion/react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select';

interface PackageFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  packageFormData: Partial<ProgressPackage>;
  setPackageFormData: React.Dispatch<React.SetStateAction<Partial<ProgressPackage>>>;
  onSubmit: (e: React.FormEvent) => void;
  rulesOfCredit: RuleOfCredit[];
  projectAttributes: Array<{ id: string; title: string; values?: Array<{ id: string; description: string }> }>;
}

export default function PackageFormDialog({
  isOpen,
  onClose,
  packageFormData,
  setPackageFormData,
  onSubmit,
  rulesOfCredit,
  projectAttributes,
}: PackageFormDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl w-full max-w-md p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold dark:text-white">Add New Commodity</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Commodity ID</label>
            <Input
              value={packageFormData.packageId}
              onChange={e => setPackageFormData({ ...packageFormData, packageId: e.target.value.substring(0, 20) })}
              placeholder="e.g. COMM-CIV-001"
              required
              maxLength={20}
            />
            <p className="text-[10px] text-gray-500">Max 20 characters. Must be unique.</p>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Description</label>
            <Input
              value={packageFormData.description}
              onChange={e => setPackageFormData({ ...packageFormData, description: e.target.value })}
              placeholder="e.g. Civil Works - Building A"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Rule of Credit</label>
            <Select
              onValueChange={(val: string) => setPackageFormData(prev => ({ ...prev, ruleOfCreditId: val }))}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="-- Select Rule of Credit --" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">-- None --</SelectItem>
                {rulesOfCredit.map(rule => (
                  <SelectItem key={rule.id} value={rule.id}>{rule.ruleId} - {rule.description}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {projectAttributes.map(attr => (
            <div key={attr.id} className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">{attr.title}</label>
              <Select
                onValueChange={(val: string) => setPackageFormData(prev => ({
                  ...prev,
                  attributes: { ...(prev.attributes || {}), [attr.id]: val }
                }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={`-- Select ${attr.title} --`} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">-- None --</SelectItem>
                  {(attr.values || []).map(v => (
                    <SelectItem key={v.id} value={v.id}>{v.id} - {v.description}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}

          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Default Unit</label>
            <Input
              value={packageFormData.unit}
              onChange={e => setPackageFormData({ ...packageFormData, unit: e.target.value })}
              placeholder="e.g. EA, m, m3"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white">Add Commodity</Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
