import { RefreshCw, Upload, Plus, AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CostCode } from '../../types';
import { cn } from '../../lib/utils';

interface ImportPreviewDialogProps {
  importPreview: { data: any[] } | null;
  costCodes: CostCode[];
  hasImportDuplicates: boolean;
  duplicateIds: string[];
  onClose: () => void;
  onConfirmImport: () => void;
}

export default function ImportPreviewDialog({
  importPreview,
  costCodes,
  hasImportDuplicates,
  duplicateIds,
  onClose,
  onConfirmImport,
}: ImportPreviewDialogProps) {
  return (
    <Dialog open={!!importPreview} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 border-b border-gray-100 dark:border-white/10 shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl font-bold dark:text-white flex items-center gap-2">
                <Upload className="w-5 h-5 text-blue-600" />
                Review Cost Codes Import
              </DialogTitle>
              <DialogDescription className="mt-1">
                Previewing {importPreview?.data.length || 0} cost codes from your file.
              </DialogDescription>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={onClose}
                className="font-bold h-10 rounded-xl"
              >
                Cancel
              </Button>
              <Button
                onClick={onConfirmImport}
                disabled={hasImportDuplicates}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-10 rounded-xl px-6 shadow-lg shadow-blue-600/20"
              >
                Import Selected
              </Button>
            </div>
          </div>

          {hasImportDuplicates && (
            <div className="mt-4 p-3 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded-xl flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
              <div className="text-xs text-red-800 dark:text-red-400">
                <span className="font-bold">Duplicate IDs detected! </span>
                The following codes appear multiple times in your file: {duplicateIds.join(', ')}.
                Please fix your Excel file and try again.
              </div>
            </div>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-auto bg-gray-50/30 dark:bg-black/20 p-6">
          <div className="bg-white dark:bg-[#141414] border border-gray-200 dark:border-white/10 rounded-2xl shadow-sm overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50 dark:bg-white/5 border-b border-gray-200 dark:border-white/10">
                  <th className="p-4 font-bold uppercase tracking-widest text-gray-500">Code</th>
                  <th className="p-4 font-bold uppercase tracking-widest text-gray-500">Name</th>
                  <th className="p-4 font-bold uppercase tracking-widest text-gray-500">EAC Method</th>
                  <th className="p-4 font-bold uppercase tracking-widest text-gray-500">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {importPreview?.data.slice(0, 100).map((row, idx) => {
                  const code = row.code || row.Code || row['Cost Code ID'] || row['Code'];
                  const existing = costCodes.find(
                    (c) => c.code.toLowerCase() === String(code || '').toLowerCase()
                  );
                  const isDuplicate = code && duplicateIds.includes(String(code));

                  return (
                    <tr
                      key={idx}
                      className={cn(
                        'hover:bg-gray-50 dark:hover:bg-white/5 transition-colors',
                        isDuplicate && 'bg-red-50/30 dark:bg-red-500/5'
                      )}
                    >
                      <td className="p-4">
                        <span
                          className={cn(
                            'font-mono font-bold',
                            isDuplicate ? 'text-red-600' : 'text-blue-600'
                          )}
                        >
                          {code || 'MISSING'}
                        </span>
                      </td>
                      <td className="p-4 text-gray-700 dark:text-gray-300">
                        {row.name ||
                          row.Name ||
                          row['Cost Code Name'] ||
                          row['Description'] ||
                          '-'}
                      </td>
                      <td className="p-4">
                        <span className="px-2 py-1 bg-gray-100 dark:bg-white/10 rounded text-[10px] font-bold">
                          {row.eacMethod || row.EACMethod || row['EAC Method'] || 'Manual'}
                        </span>
                      </td>
                      <td className="p-4">
                        {existing ? (
                          <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-bold">
                            <RefreshCw className="w-3 h-3" /> Update Existing
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold">
                            <Plus className="w-3 h-3" /> New Code
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {(importPreview?.data.length || 0) > 100 && (
                  <tr>
                    <td colSpan={4} className="p-4 text-center text-gray-400 italic">
                      ... and {(importPreview?.data.length || 0) - 100} more rows
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
