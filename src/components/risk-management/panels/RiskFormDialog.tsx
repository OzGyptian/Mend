import React, { useState } from 'react';
import { Risk, Enterprise } from '../../../types';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
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

interface RiskFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (riskData: Omit<Risk, 'id'>) => Promise<void>;
  enterprise: Enterprise;
  existingRisks: Risk[];
  projectId: string;
}

const EMPTY_FORM = {
  riskId: '',
  description: '',
  type: '',
  status: 'Open' as Risk['status'],
  strategy: 'Mitigate' as Risk['strategy'],
  initiator: '',
  reference: '',
  periodId: '',
};

export default function RiskFormDialog({
  isOpen,
  onClose,
  onSubmit,
  enterprise,
  existingRisks,
  projectId,
}: RiskFormDialogProps) {
  const [form, setForm] = useState(EMPTY_FORM);

  const handleClose = () => {
    setForm(EMPTY_FORM);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.riskId.trim()) { toast.error("Risk ID is required"); return; }
    if (form.riskId.length > 20) { toast.error("Risk ID must be max 20 characters"); return; }
    if (existingRisks.some(r => r.riskId.toLowerCase() === form.riskId.toLowerCase())) {
      toast.error("Risk ID must be unique");
      return;
    }

    const riskData: Omit<Risk, 'id'> = {
      projectId,
      riskId: form.riskId.trim(),
      description: form.description,
      type: form.type || (enterprise.riskTypes?.[0] || ''),
      status: form.status,
      strategy: form.strategy,
      initiator: form.initiator.slice(0, 50),
      reference: form.reference.slice(0, 50),
      exposure: 0,
      minImpactTotal: 0,
      mostLikelyImpactTotal: 0,
      maxImpactTotal: 0,
      mitigation: 0,
      residualExposure: 0,
      periodId: form.periodId,
      enterpriseAttributes: {},
      projectAttributes: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await onSubmit(riskData);
    setForm(EMPTY_FORM);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add New Risk</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <Input
            placeholder="Risk ID (e.g. RSK-001)"
            value={form.riskId}
            onChange={e => setForm({ ...form, riskId: e.target.value })}
          />
          <Input
            placeholder="Description"
            value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-4">
            <Select onValueChange={v => setForm({ ...form, status: v as Risk['status'] })} defaultValue="Open">
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Open">Open</SelectItem>
                <SelectItem value="Mitigated">Mitigated</SelectItem>
                <SelectItem value="Closed">Closed</SelectItem>
                <SelectItem value="Realized">Realized</SelectItem>
              </SelectContent>
            </Select>
            <Select onValueChange={v => setForm({ ...form, strategy: v as Risk['strategy'] })} defaultValue="Mitigate">
              <SelectTrigger><SelectValue placeholder="Strategy" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Avoid">Avoid</SelectItem>
                <SelectItem value="Mitigate">Mitigate</SelectItem>
                <SelectItem value="Transfer">Transfer</SelectItem>
                <SelectItem value="Accept">Accept</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button className="w-full" onClick={handleSubmit}>Create</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
