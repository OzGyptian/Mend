import React, { useState } from 'react';
import { Enterprise, Calendar as ProjectCalendar } from '../../types';
import { DEFAULT_ETC_CATEGORIES } from './columns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export interface EtcBulkUpdatePayload {
  category?: string;
  calendarId?: string;
  phasingMethod?: 'Manual' | 'Auto-Phase';
  phasingUnit?: 'Daily' | 'Weekly' | 'Monthly' | 'Total' | 'Profile';
  enterpriseAttributes: Record<string, string>;
  projectAttributes: Record<string, string>;
  userDefined: Record<string, any>;
}

interface EtcBulkUpdateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: EtcBulkUpdatePayload) => Promise<void>;
  enterprise: Enterprise;
  calendars: ProjectCalendar[];
  selectedCount: number;
  isSaving: boolean;
}

const EMPTY_PAYLOAD: EtcBulkUpdatePayload = {
  enterpriseAttributes: {},
  projectAttributes: {},
  userDefined: {},
};

export default function EtcBulkUpdateDialog({
  isOpen,
  onClose,
  onSubmit,
  enterprise,
  calendars,
  selectedCount,
  isSaving,
}: EtcBulkUpdateDialogProps) {
  const [data, setData] = useState<EtcBulkUpdatePayload>(EMPTY_PAYLOAD);

  const handleClose = () => {
    setData(EMPTY_PAYLOAD);
    onClose();
  };

  const handleSubmit = async () => {
    await onSubmit(data);
    setData(EMPTY_PAYLOAD);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Bulk Update ETC Details</DialogTitle>
          <DialogDescription>
            Update {selectedCount} selected rows simultaneously.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-6 py-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Resource Category</label>
              <select
                className="w-full h-10 px-3 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950"
                value={data.category || ''}
                onChange={(e) => setData(prev => ({ ...prev, category: e.target.value }))}
              >
                <option value="">No Change</option>
                {((enterprise.categories && enterprise.categories.length > 0) ? enterprise.categories : DEFAULT_ETC_CATEGORIES).map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Calendar</label>
              <select
                className="w-full h-10 px-3 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950"
                value={data.calendarId || ''}
                onChange={(e) => setData(prev => ({ ...prev, calendarId: e.target.value }))}
              >
                <option value="">No Change</option>
                {calendars.map(cal => (
                  <option key={cal.id} value={cal.id}>{cal.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Phasing Method</label>
              <select
                className="w-full h-10 px-3 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950"
                value={data.phasingMethod || ''}
                onChange={(e) => setData(prev => ({ ...prev, phasingMethod: e.target.value as EtcBulkUpdatePayload['phasingMethod'] }))}
              >
                <option value="">No Change</option>
                <option value="Manual">Manual</option>
                <option value="Auto-Phase">Auto-Phase</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Phasing Unit</label>
              <select
                className="w-full h-10 px-3 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950"
                value={data.phasingUnit || ''}
                onChange={(e) => setData(prev => ({ ...prev, phasingUnit: e.target.value as EtcBulkUpdatePayload['phasingUnit'] }))}
              >
                <option value="">No Change</option>
                <option value="Daily">Daily</option>
                <option value="Weekly">Weekly</option>
                <option value="Monthly">Monthly</option>
                <option value="Total">Total</option>
              </select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isSaving}>
            {isSaving ? 'Updating...' : 'Apply Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
