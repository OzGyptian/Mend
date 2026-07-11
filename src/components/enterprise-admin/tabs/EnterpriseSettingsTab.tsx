import React, { useRef } from 'react';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import { Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useEnterpriseRepo } from '../../../platform/firestore/hooks';
import type { Enterprise, Project } from '../../../types';

interface EnterpriseSettingsTabProps {
  enterprise: Enterprise;
  projects: Project[];
}

export default function EnterpriseSettingsTab({ enterprise, projects }: EnterpriseSettingsTabProps) {
  const enterpriseRepo = useEnterpriseRepo();
  const enterpriseLogoInputRef = useRef<HTMLInputElement>(null);

  const handleUpdateEnterprise = async (updates: Partial<Enterprise>) => {
    try {
      await enterpriseRepo.update(enterprise.id, updates);
    } catch (error) {
      console.error('Enterprise update failed', error);
      toast.error('Failed to update enterprise settings.');
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Logo upload logic — convert to data URL for now
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string;
      await handleUpdateEnterprise({ logoURL: dataUrl } as any);
    };
    reader.readAsDataURL(file);
  };

  return (
    <motion.div
      key="enterpriseSettings"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex-1 overflow-auto space-y-8 pr-2"
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
                  <img
                    src={enterprise.logoURL}
                    className="w-16 h-16 object-contain bg-white rounded-lg border border-gray-100"
                    alt="Logo"
                    referrerPolicy="no-referrer"
                  />
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
                </div>
              </div>
              <input
                ref={enterpriseLogoInputRef}
                type="file"
                className="hidden"
                accept="image/*"
                onChange={handleLogoUpload}
              />
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
  );
}
