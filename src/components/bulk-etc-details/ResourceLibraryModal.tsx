import React, { useState, useMemo } from 'react';
import { Project, Enterprise } from '../../types';
import { Search, Database, Briefcase, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ResourceLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (resources: any[], source: 'enterprise' | 'project') => void;
  enterprise: Enterprise;
  project: Project;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

export default function ResourceLibraryModal({
  isOpen,
  onClose,
  onAdd,
  enterprise,
  project,
}: ResourceLibraryModalProps) {
  const [resourceSearch, setResourceSearch] = useState('');
  const [selectedResourceIds, setSelectedResourceIds] = useState<Set<string>>(new Set());
  const [resourceLibrarySource, setResourceLibrarySource] = useState<'enterprise' | 'project'>('enterprise');
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  const groupedLibraryResources = useMemo(() => {
    const library = resourceLibrarySource === 'enterprise' ? enterprise.resourceRates : project.resourceRates;
    const filtered = library?.filter(r =>
      r.name.toLowerCase().includes(resourceSearch.toLowerCase()) ||
      r.id.toLowerCase().includes(resourceSearch.toLowerCase()) ||
      r.category?.toLowerCase().includes(resourceSearch.toLowerCase())
    ) || [];

    const grouped = filtered.reduce((acc, resource) => {
      const category = resource.category || 'Uncategorized';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(resource);
      return acc;
    }, {} as Record<string, typeof filtered>);

    return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));
  }, [resourceLibrarySource, enterprise.resourceRates, project.resourceRates, resourceSearch]);

  const handleClose = () => {
    setResourceSearch('');
    setSelectedResourceIds(new Set());
    setResourceLibrarySource('enterprise');
    setCollapsedCategories(new Set());
    onClose();
  };

  const handleAdd = () => {
    const library = resourceLibrarySource === 'enterprise' ? enterprise.resourceRates : project.resourceRates;
    const selected = library?.filter(r => selectedResourceIds.has(r.id)) || [];
    onAdd(selected, resourceLibrarySource);
    setSelectedResourceIds(new Set());
  };

  const toggleCategory = (category: string) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  };

  const toggleResource = (resourceId: string) => {
    setSelectedResourceIds(prev => {
      const next = new Set(prev);
      if (next.has(resourceId)) next.delete(resourceId);
      else next.add(resourceId);
      return next;
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="w-5 h-5 text-blue-600" />
            Resource Library
          </DialogTitle>
          <DialogDescription>
            Select resources to add to your ETC details.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-4 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search resources..."
              value={resourceSearch}
              onChange={(e) => setResourceSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
            <button
              onClick={() => setResourceLibrarySource('enterprise')}
              className={cn(
                "px-3 py-1.5 text-xs font-semibold rounded-md transition-all",
                resourceLibrarySource === 'enterprise' ? "bg-white dark:bg-slate-700 shadow-sm text-blue-600" : "text-slate-500"
              )}
            >
              Enterprise
            </button>
            <button
              onClick={() => setResourceLibrarySource('project')}
              className={cn(
                "px-3 py-1.5 text-xs font-semibold rounded-md transition-all",
                resourceLibrarySource === 'project' ? "bg-white dark:bg-slate-700 shadow-sm text-blue-600" : "text-slate-500"
              )}
            >
              Project
            </button>
          </div>
        </div>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6 py-4">
            {groupedLibraryResources.length === 0 ? (
              <div className="text-center py-12">
                <Database className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                <p className="text-slate-500">No resources found matching your search.</p>
              </div>
            ) : (
              groupedLibraryResources.map(([category, resources]) => (
                <div key={category} className="space-y-2">
                  <button
                    onClick={() => toggleCategory(category)}
                    className="w-full flex items-center justify-between p-2 hover:bg-slate-50 dark:hover:bg-white/5 rounded-lg transition-colors group"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-blue-50 dark:bg-blue-900/20 rounded flex items-center justify-center">
                        <Briefcase className="w-4 h-4 text-blue-600" />
                      </div>
                      <span className="font-bold text-slate-900 dark:text-white">{category}</span>
                      <Badge variant="secondary" className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                        {resources.length}
                      </Badge>
                    </div>
                    {collapsedCategories.has(category) ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronUp className="w-4 h-4 text-slate-400" />}
                  </button>

                  {!collapsedCategories.has(category) && (
                    <div className="grid grid-cols-1 gap-2 pl-10">
                      {resources.map(resource => (
                        <div
                          key={resource.id}
                          onClick={() => toggleResource(resource.id)}
                          className={cn(
                            "flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer group",
                            selectedResourceIds.has(resource.id)
                              ? "bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800"
                              : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-blue-200 dark:hover:border-blue-800"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-5 h-5 rounded border flex items-center justify-center transition-colors",
                              selectedResourceIds.has(resource.id) ? "bg-blue-600 border-blue-600" : "border-slate-300 dark:border-slate-700"
                            )}>
                              {selectedResourceIds.has(resource.id) && <RefreshCw className="w-3 h-3 text-white animate-spin" />}
                            </div>
                            <div>
                              <div className="text-sm font-bold text-slate-900 dark:text-white">{resource.name}</div>
                              <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">{resource.id}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-bold text-blue-600 dark:text-blue-400">{formatCurrency(resource.rate || 0)}</div>
                            <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">{resource.unit || 'HR'}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="border-t border-slate-100 dark:border-slate-800 pt-4">
          <div className="flex-1 flex items-center gap-2 text-sm text-slate-500">
            {selectedResourceIds.size} resources selected
          </div>
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button
            disabled={selectedResourceIds.size === 0}
            onClick={handleAdd}
          >
            Add Selected Resources
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
