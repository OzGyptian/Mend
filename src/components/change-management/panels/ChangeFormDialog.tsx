import React from 'react';
import { Project, Change } from '../../../types';
import { AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../../ui/dialog';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select';

interface ChangeFormDialogProps {
  project: Project;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  newChange: {
    changeId: string;
    description: string;
    status: Change['status'];
    initiator: string;
    reference: string;
    periodId: string;
  };
  setNewChange: React.Dispatch<React.SetStateAction<{
    changeId: string;
    description: string;
    status: Change['status'];
    initiator: string;
    reference: string;
    periodId: string;
  }>>;
  onSubmit: (e: React.FormEvent) => void;
}

export default function ChangeFormDialog({
  project,
  isOpen,
  onOpenChange,
  newChange,
  setNewChange,
  onSubmit,
}: ChangeFormDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
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
                  {(project.reportingPeriods?.periods || []).map(p => (
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
