import React, { useState, useRef, useCallback } from 'react';
import {
  Search,
  Upload,
  Download,
  X,
  Calculator,
  BarChart3,
  Activity,
} from 'lucide-react';
import {
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Line,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import * as XLSX from 'xlsx';
import { cn, formatCurrency } from '../../../lib/utils';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, CellValueChangedEvent } from 'ag-grid-community';
import { Project } from '../../../types';
import { useCostRepo } from '../../../platform/firestore/hooks';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';
import 'ag-grid-enterprise';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface TimephasingPanelProps {
  project: Project;
  theme: string;
  selectedTimephasingCode: string;
  timephasingRows: any[];
  isTimephasingLoading: boolean;
  timephasingColumnDefs: ColDef[];
  timephasingChartData: any[];
  costPhasing: any[];
  isMainTableCollapsed: boolean;
  onClose: () => void;
  timephasingGridRef: React.RefObject<AgGridReact>;
}

type ChartMode = 'value' | 'percent';

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function TimephasingPanel({
  project,
  theme,
  selectedTimephasingCode,
  timephasingRows,
  isTimephasingLoading,
  timephasingColumnDefs,
  timephasingChartData,
  costPhasing,
  isMainTableCollapsed,
  onClose,
  timephasingGridRef,
}: TimephasingPanelProps) {
  const costRepo = useCostRepo();

  // ── Local UI state ──────────────────────────────────────────────────────────
  const [timephasingQuickFilterText, setTimephasingQuickFilterText] = useState('');
  const [isTimephasingChartVisible, setIsTimephasingChartVisible] = useState(false);
  const [timephasingChartMode, setTimephasingChartMode] = useState<ChartMode>('value');

  const timephasingFileInputRef = useRef<HTMLInputElement>(null);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleCalculateAutoPhasing = useCallback(async () => {
    if (!selectedTimephasingCode) return;
    try {
      const codePhasingRows = timephasingRows.filter(r => !r.hidden);
      await Promise.all(
        codePhasingRows.map(async (row: any) => {
          if (!row.activityId || !row.startDate || !row.endDate) return;
          const startDate = new Date(row.startDate);
          const endDate = new Date(row.endDate);
          if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return;
          const allPeriods = project.reportingPeriods?.periods || [];
          const distribution = row.distribution || 'Even';
          const totalValue = row.totalValue || 0;
          const newPeriodValues: Record<string, number> = {};
          allPeriods.forEach((period: any) => {
            const periodStart = new Date(period.startDate);
            const periodEnd = new Date(period.endDate);
            if (periodStart > endDate || periodEnd < startDate) {
              newPeriodValues[period.id] = 0;
              return;
            }
            const overlapStart = periodStart < startDate ? startDate : periodStart;
            const overlapEnd = periodEnd > endDate ? endDate : periodEnd;
            const overlapDays = Math.max(0, (overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24) + 1);
            const totalDays = Math.max(1, (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24) + 1);
            newPeriodValues[period.id] = (overlapDays / totalDays) * totalValue;
          });
          const updatePayload = {
            projectId: project.id,
            costCodeId: selectedTimephasingCode,
            type: row.id,
            phasingSource: 'Auto',
            activityId: row.activityId || null,
            startDate: row.startDate,
            endDate: row.endDate,
            distribution,
            periodValues: newPeriodValues,
            updatedAt: new Date().toISOString()
          };
          if (row.docId) {
            await costRepo.updateCostPhasing(row.docId, updatePayload);
          } else {
            const existing = costPhasing.find((p: any) => p.costCodeId === selectedTimephasingCode && p.type === row.id);
            if (existing) {
              await costRepo.updateCostPhasing(existing.id, updatePayload);
            } else {
              await costRepo.saveCostPhasing([updatePayload]);
            }
          }
        })
      );
      toast.success('Auto-phasing calculated');
    } catch (error) {
      console.error('Error calculating auto phasing:', error);
      toast.error('Failed to calculate auto phasing');
    }
  }, [project, selectedTimephasingCode, timephasingRows, costPhasing, costRepo]);

  const handleExportTimephasing = () => {
    const allPeriods = project.reportingPeriods?.periods || [];
    const data = timephasingRows
      .filter(r => !r.hidden)
      .map(row => {
        const exportRow: any = {
          'Type': row.type,
          'Activity ID': row.activityId || '',
          'Start Date': row.startDate ? new Date(row.startDate).toLocaleDateString() : '',
          'End Date': row.endDate ? new Date(row.endDate).toLocaleDateString() : '',
          'Distribution': row.distribution || 'Even',
          'Phasing Source': row.phasingSource || 'Manual',
        };
        allPeriods.forEach((p: any) => {
          exportRow[p.name] = row.periodValues?.[p.id] || 0;
        });
        return exportRow;
      });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Timephasing');
    XLSX.writeFile(wb, `Timephasing_${selectedTimephasingCode}_${project.projectName}.xlsx`);
  };

  const handleImportTimephasing = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedTimephasingCode) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        const allPeriods = project.reportingPeriods?.periods || [];

        await Promise.all(data.map(async (row) => {
          const type = row['Type'];
          if (!type) return;

          const periodValues: Record<string, number> = {};
          allPeriods.forEach((p: any) => {
            if (row[p.name] !== undefined) {
              periodValues[p.id] = Number(row[p.name]) || 0;
            }
          });

          const updatePayload = {
            projectId: project.id,
            costCodeId: selectedTimephasingCode,
            type,
            phasingSource: row['Phasing Source'] || 'Manual',
            activityId: row['Activity ID'] || null,
            startDate: row['Start Date'] || '',
            endDate: row['End Date'] || '',
            distribution: row['Distribution'] || 'Even',
            periodValues,
            updatedAt: new Date().toISOString()
          };

          const existing = costPhasing.find((p: any) => p.costCodeId === selectedTimephasingCode && p.type === type);
          if (existing) {
            await costRepo.updateCostPhasing(existing.id, updatePayload);
          } else {
            await costRepo.saveCostPhasing([updatePayload]);
          }
        }));

        toast.success(`Imported ${data.length} rows`);
      } catch (error) {
        console.error('Error importing timephasing:', error);
        toast.error('Failed to import timephasing data');
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const onTimephasingCellValueChanged = useCallback(async (event: CellValueChangedEvent) => {
    const data = event.data;
    try {
      let startDateStr = data.startDate;
      if (startDateStr instanceof Date) {
        startDateStr = startDateStr.toISOString();
      } else if (startDateStr && !isNaN(new Date(startDateStr).getTime())) {
        startDateStr = new Date(startDateStr).toISOString();
      } else {
        startDateStr = '';
      }

      let endDateStr = data.endDate;
      if (endDateStr instanceof Date) {
        endDateStr = endDateStr.toISOString();
      } else if (endDateStr && !isNaN(new Date(endDateStr).getTime())) {
        endDateStr = new Date(endDateStr).toISOString();
      } else {
        endDateStr = '';
      }

      const updatePayload = {
        projectId: project.id,
        costCodeId: selectedTimephasingCode,
        type: data.id,
        phasingSource: data.phasingSource || 'Manual',
        activityId: data.activityId || null,
        startDate: startDateStr,
        endDate: endDateStr,
        distribution: data.distribution || 'Even',
        periodValues: data.periodValues || {},
        updatedAt: new Date().toISOString()
      };

      if (data.docId) {
        await costRepo.updateCostPhasing(data.docId, updatePayload);
      } else {
        const existing = costPhasing.find((p: any) => p.costCodeId === selectedTimephasingCode && p.type === data.id);
        if (existing) {
          await costRepo.updateCostPhasing(existing.id, updatePayload);
        } else {
          await costRepo.saveCostPhasing([updatePayload]);
        }
      }

      toast.success(`${data.type} updated`);
    } catch (error) {
      console.error('Error updating cost phasing:', error);
      toast.error('Failed to update cost phasing');
    }
  }, [project.id, selectedTimephasingCode, costPhasing, costRepo]);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <AnimatePresence>
      {selectedTimephasingCode && (
        <motion.div
          key={selectedTimephasingCode}
          initial={{ height: 0, opacity: 0 }}
          animate={{
            height: isMainTableCollapsed ? 'calc(100% - 60px)' : '60%',
            opacity: 1
          }}
          exit={{ height: 0, opacity: 0 }}
          className="border-t border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#0a0a0a] flex flex-col overflow-hidden"
        >
          {/* Toolbar */}
          <div className="p-4 flex items-center justify-between bg-white dark:bg-[#141414] border-b border-gray-200 dark:border-white/10">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold dark:text-white">Timephasing: <span className="text-emerald-600">{selectedTimephasingCode}</span></h3>
              </div>
              <div className="h-4 w-px bg-gray-200 dark:border-white/10" />
              <p className="text-xs text-gray-500">Baseline, Approved, and EAC Cost Flow</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search timephasing..."
                  value={timephasingQuickFilterText}
                  onChange={(e) => setTimephasingQuickFilterText(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 outline-none w-48 dark:text-white"
                />
              </div>
              <div className="h-4 w-px bg-gray-200 dark:border-white/10 mx-1" />
              <input
                type="file"
                ref={timephasingFileInputRef}
                className="hidden"
                accept=".xlsx,.xls,.csv"
                onChange={handleImportTimephasing}
              />
              <button
                onClick={() => timephasingFileInputRef.current?.click()}
                className="p-2 text-gray-400 hover:text-black dark:hover:text-white transition-colors"
                title="Import Excel"
              >
                <Upload className="w-5 h-5" />
              </button>
              <button
                onClick={handleExportTimephasing}
                className="p-2 text-gray-400 hover:text-black dark:hover:text-white transition-colors"
                title="Export Excel"
              >
                <Download className="w-5 h-5" />
              </button>
              <div className="h-4 w-px bg-gray-200 dark:border-white/10 mx-1" />
              <button
                onClick={() => setIsTimephasingChartVisible(!isTimephasingChartVisible)}
                className={cn(
                  "p-2 rounded-lg transition-all",
                  isTimephasingChartVisible
                    ? "bg-black text-white dark:bg-white dark:text-black shadow-lg"
                    : "text-gray-400 hover:text-black dark:hover:text-white"
                )}
                title={isTimephasingChartVisible ? "Hide Chart" : "Show Chart"}
              >
                <BarChart3 className="w-5 h-5" />
              </button>
              <div className="h-4 w-px bg-gray-200 dark:border-white/10 mx-1" />
              <button
                onClick={handleCalculateAutoPhasing}
                className="flex items-center gap-2 bg-black dark:bg-white text-white dark:text-black px-4 py-2 rounded-lg text-sm font-bold hover:opacity-90 transition-all shadow-lg shadow-black/10"
              >
                <Calculator className="w-4 h-4" /> Calculate Auto
              </button>
              <div className="h-4 w-px bg-gray-200 dark:border-white/10 mx-1" />
              <button
                onClick={onClose}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors text-gray-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Chart */}
          <AnimatePresence>
            {isTimephasingChartVisible && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="bg-white dark:bg-[#141414] border-b border-gray-200 dark:border-white/10 overflow-hidden"
              >
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2 bg-gray-100 dark:bg-white/5 p-1 rounded-lg">
                        <button
                          onClick={() => setTimephasingChartMode('value')}
                          className={cn(
                            "px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all",
                            timephasingChartMode === 'value'
                              ? "bg-white dark:bg-[#141414] text-black dark:text-white shadow-sm"
                              : "text-gray-500 hover:text-black dark:hover:text-white"
                          )}
                        >
                          Value ($)
                        </button>
                        <button
                          onClick={() => setTimephasingChartMode('percent')}
                          className={cn(
                            "px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all",
                            timephasingChartMode === 'percent'
                              ? "bg-white dark:bg-[#141414] text-black dark:text-white shadow-sm"
                              : "text-gray-500 hover:text-black dark:hover:text-white"
                          )}
                        >
                          Percent (%)
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-slate-400" />
                        <span className="text-[10px] font-bold text-gray-500 uppercase">Baseline</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span className="text-[10px] font-bold text-gray-500 uppercase">Approved</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                        <span className="text-[10px] font-bold text-gray-500 uppercase">EAC</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-slate-300" />
                        <span className="text-[10px] font-bold text-gray-500 uppercase">EAC Prev</span>
                      </div>
                      <div className="h-3 w-px bg-gray-200 dark:bg-white/10 mx-1" />
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-0.5 bg-slate-400" />
                        <span className="text-[10px] font-bold text-gray-500 uppercase">Cum. Baseline</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-0.5 bg-emerald-500" />
                        <span className="text-[10px] font-bold text-gray-500 uppercase">Cum. Approved</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-0.5 bg-blue-500" />
                        <span className="text-[10px] font-bold text-gray-500 uppercase">Cum. EAC</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-0.5 bg-slate-300 border-t border-dashed border-slate-500" />
                        <span className="text-[10px] font-bold text-gray-500 uppercase">Cum. EAC Prev</span>
                      </div>
                    </div>
                  </div>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={timephasingChartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#333' : '#eee'} />
                        <XAxis
                          dataKey="name"
                          fontSize={9}
                          tick={{ fill: theme === 'dark' ? '#999' : '#666' }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          fontSize={9}
                          tick={{ fill: theme === 'dark' ? '#999' : '#666' }}
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={(val) => timephasingChartMode === 'percent' ? `${val}%` : `$${(val / 1000).toFixed(0)}k`}
                        />
                        <YAxis
                          yAxisId="right"
                          orientation="right"
                          fontSize={9}
                          tick={{ fill: theme === 'dark' ? '#999' : '#666' }}
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={(val) => timephasingChartMode === 'percent' ? `${val}%` : `$${(val / 1000).toFixed(0)}k`}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: theme === 'dark' ? '#141414' : '#fff',
                            borderColor: theme === 'dark' ? '#333' : '#eee',
                            borderRadius: '8px',
                            fontSize: '11px',
                            padding: '8px'
                          }}
                          formatter={(val: number) => timephasingChartMode === 'percent' ? `${val.toFixed(1)}%` : formatCurrency(val)}
                        />
                        <Legend
                          verticalAlign="top"
                          height={36}
                          iconType="circle"
                          wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }}
                        />
                        <Bar dataKey="baseline" name="Baseline" fill="#94a3b8" radius={[2, 2, 0, 0]} barSize={15} />
                        <Bar dataKey="approved" name="Approved" fill="#10b981" radius={[2, 2, 0, 0]} barSize={15} />
                        <Bar dataKey="eac" name="EAC" fill="#3b82f6" radius={[2, 2, 0, 0]} barSize={15} />
                        <Line yAxisId="right" type="monotone" dataKey="cumulativeBaseline" name="Cum. Baseline" stroke="#94a3b8" strokeWidth={2} dot={false} />
                        <Line yAxisId="right" type="monotone" dataKey="cumulativeApproved" name="Cum. Approved" stroke="#10b981" strokeWidth={2} dot={false} />
                        <Line yAxisId="right" type="monotone" dataKey="cumulativeEac" name="Cum. EAC" stroke="#3b82f6" strokeWidth={2} dot={false} />
                        <Line yAxisId="right" type="monotone" dataKey="cumulativeEacPrevious" name="Cum. EAC Prev" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Grid */}
          <div className="flex-1 min-h-0 relative">
            <div className={cn(
              "absolute inset-0 ag-theme-quartz",
              theme === 'dark' ? "ag-theme-quartz-dark" : ""
            )}>
              <AgGridReact
                theme="legacy"
                ref={timephasingGridRef}
                rowData={timephasingRows}
                isExternalFilterPresent={() => true}
                doesExternalFilterPass={(node) => !node.data.hidden}
                columnDefs={timephasingColumnDefs}
                quickFilterText={timephasingQuickFilterText}
                loading={isTimephasingLoading}
                onCellValueChanged={onTimephasingCellValueChanged}
                getRowId={(params) => params.data.id}
                rowSelection="multiple"
                suppressRowClickSelection={true}
                enableFillHandle={true}
                undoRedoCellEditing={true}
                defaultColDef={{
                  sortable: true,
                  filter: true,
                  resizable: true,
                  minWidth: 100,
                  wrapHeaderText: true,
                  autoHeaderHeight: true,
                }}
                animateRows={true}
                enableRangeSelection={true}
                enableCellTextSelection={true}
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
