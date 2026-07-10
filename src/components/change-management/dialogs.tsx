import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Change, CostCode } from '../../types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// ---------------------------------------------------------------------------
// Attribute types
// ---------------------------------------------------------------------------

interface AttributeValue {
  id: string;
  description: string;
}

interface Attribute {
  id: string;
  title: string;
  values: AttributeValue[];
}

// ---------------------------------------------------------------------------
// CreateChangeDialog
// ---------------------------------------------------------------------------

interface NewChangeData {
  changeId: string;
  description: string;
  status: string;
  initiator: string;
  reference: string;
  periodId: string;
}

interface ReportingPeriod {
  id: string;
  name: string;
}

interface CreateChangeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  newChange: NewChangeData;
  setNewChange: (data: NewChangeData) => void;
  reportingPeriods: ReportingPeriod[];
  onSubmit: (e: React.FormEvent) => void;
}

export function CreateChangeDialog({
  open,
  onOpenChange,
  newChange,
  setNewChange,
  reportingPeriods,
  onSubmit,
}: CreateChangeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Change</DialogTitle>
          <DialogDescription>Enter the details for the new project change.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-500">Change ID</label>
              <Input
                required
                maxLength={20}
                value={newChange.changeId}
                onChange={e => setNewChange({ ...newChange, changeId: e.target.value })}
                placeholder="e.g. CHG-001"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-500">Period</label>
              <Select
                value={newChange.periodId}
                onValueChange={v => setNewChange({ ...newChange, periodId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Period" />
                </SelectTrigger>
                <SelectContent>
                  {reportingPeriods.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-gray-500">Description</label>
            <Input
              value={newChange.description}
              onChange={e => setNewChange({ ...newChange, description: e.target.value })}
              placeholder="Brief description of the change"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-500">Initiator</label>
              <Input
                maxLength={50}
                value={newChange.initiator}
                onChange={e => setNewChange({ ...newChange, initiator: e.target.value })}
                placeholder="Person who initiated"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-500">Reference</label>
              <Input
                maxLength={50}
                value={newChange.reference}
                onChange={e => setNewChange({ ...newChange, reference: e.target.value })}
                placeholder="External reference #"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" className="bg-black text-white dark:bg-white dark:text-black">Create Change</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// DeleteChangeDialog
// ---------------------------------------------------------------------------

interface DeleteChangeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  changeToDelete: Change | null;
  onConfirm: () => void;
}

export function DeleteChangeDialog({
  open,
  onOpenChange,
  changeToDelete,
  onConfirm,
}: DeleteChangeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="w-5 h-5" />
            Confirm Deletion
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to delete change{' '}
            <span className="font-bold">"{changeToDelete?.changeId}"</span>? This will also delete
            all associated change records. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" onClick={onConfirm}>Delete Change</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// BulkDeleteDialog
// ---------------------------------------------------------------------------

interface BulkDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  onConfirm: () => void;
}

export function BulkDeleteDialog({
  open,
  onOpenChange,
  selectedCount,
  onConfirm,
}: BulkDeleteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="w-5 h-5" />
            Confirm Bulk Deletion
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to delete{' '}
            <span className="font-bold">{selectedCount}</span> selected changes? This will also
            delete all associated change records. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" onClick={onConfirm}>Delete Selected</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// BulkUpdateRecordsDialog
// ---------------------------------------------------------------------------

interface BulkUpdateData {
  costCodeId: string;
  scope: string;
  budgetAmount: string;
  eacAmount: string;
  enterpriseAttributes: Record<string, string>;
  projectAttributes: Record<string, string>;
}

interface BulkUpdateRecordsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedRecordCount: number;
  costCodes: CostCode[];
  enterpriseLineItemAttributes: Attribute[];
  projectLineItemAttributes: Attribute[];
  bulkRecordUpdateData: BulkUpdateData;
  setBulkRecordUpdateData: React.Dispatch<React.SetStateAction<BulkUpdateData>>;
  onConfirm: () => void;
}

export function BulkUpdateRecordsDialog({
  open,
  onOpenChange,
  selectedRecordCount,
  costCodes,
  enterpriseLineItemAttributes,
  projectLineItemAttributes,
  bulkRecordUpdateData,
  setBulkRecordUpdateData,
  onConfirm,
}: BulkUpdateRecordsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Bulk Update Records</DialogTitle>
          <DialogDescription>
            Update selected fields for {selectedRecordCount} records.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Cost Code</label>
            <Select
              value={bulkRecordUpdateData.costCodeId}
              onValueChange={(v) => setBulkRecordUpdateData({ ...bulkRecordUpdateData, costCodeId: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select Cost Code" />
              </SelectTrigger>
              <SelectContent>
                {costCodes.map(c => (
                  <SelectItem key={c.id} value={c.code}>{c.code} - {c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Scope</label>
            <Input
              value={bulkRecordUpdateData.scope}
              onChange={(e) => setBulkRecordUpdateData({ ...bulkRecordUpdateData, scope: e.target.value })}
              placeholder="Enter scope..."
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Budget Amount</label>
              <Input
                type="number"
                value={bulkRecordUpdateData.budgetAmount}
                onChange={(e) => setBulkRecordUpdateData({ ...bulkRecordUpdateData, budgetAmount: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">EAC Amount</label>
              <Input
                type="number"
                value={bulkRecordUpdateData.eacAmount}
                onChange={(e) => setBulkRecordUpdateData({ ...bulkRecordUpdateData, eacAmount: e.target.value })}
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Enterprise Attributes */}
          {enterpriseLineItemAttributes && enterpriseLineItemAttributes.length > 0 && (
            <div className="space-y-4 pt-2 border-t border-gray-100 dark:border-white/10">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Enterprise Attributes</h4>
              <div className="grid grid-cols-2 gap-4">
                {enterpriseLineItemAttributes.map(attr => (
                  <div key={attr.id} className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{attr.title}</label>
                    <Select
                      value={bulkRecordUpdateData.enterpriseAttributes[attr.id] || ''}
                      onValueChange={val => setBulkRecordUpdateData(prev => ({
                        ...prev,
                        enterpriseAttributes: { ...prev.enterpriseAttributes, [attr.id]: val }
                      }))}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        {attr.values.map(v => (
                          <SelectItem key={v.id} value={v.id}>{v.id} - {v.description}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Project Attributes */}
          {projectLineItemAttributes && projectLineItemAttributes.length > 0 && (
            <div className="space-y-4 pt-2 border-t border-gray-100 dark:border-white/10">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Project Attributes</h4>
              <div className="grid grid-cols-2 gap-4">
                {projectLineItemAttributes.map(attr => (
                  <div key={attr.id} className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{attr.title}</label>
                    <Select
                      value={bulkRecordUpdateData.projectAttributes[attr.id] || ''}
                      onValueChange={val => setBulkRecordUpdateData(prev => ({
                        ...prev,
                        projectAttributes: { ...prev.projectAttributes, [attr.id]: val }
                      }))}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        {attr.values.map(v => (
                          <SelectItem key={v.id} value={v.id}>{v.id} - {v.description}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={onConfirm}>Update Records</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
