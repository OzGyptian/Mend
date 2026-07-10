import React, { useState } from 'react';
import { Search, X, BarChart3, History } from 'lucide-react';
import {
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Line,
  ResponsiveContainer,
  LabelList,
} from 'recharts';
import { cn, formatCurrency } from '../../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { AgGridReact } from 'ag-grid-react';
import { ColDef } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';
import 'ag-grid-enterprise';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ActualsPanelProps {
  theme: string;
  selectedActualsCode: string;
  actualsRows: any[];
  isActualsLoading: boolean;
  actualsColumnDefs: ColDef[];
  actualsChartData: any[];
  isMainTableCollapsed: boolean;
  onClose: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function ActualsPanel({
  theme,
  selectedActualsCode,
  actualsRows,
  isActualsLoading,
  actualsColumnDefs,
  actualsChartData,
  isMainTableCollapsed,
  onClose,
}: ActualsPanelProps) {
  // ── Local UI state ──────────────────────────────────────────────────────────
  const [actualsQuickFilterText, setActualsQuickFilterText] = useState('');
  const [isActualsChartVisible, setIsActualsChartVisible] = useState(false);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <AnimatePresence>
      {selectedActualsCode && (
        <motion.div
          key={selectedActualsCode}
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
                <History className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold dark:text-white">Actual Cost Transactions: <span className="text-blue-600">{selectedActualsCode}</span></h3>
              </div>
              <div className="h-4 w-px bg-gray-200 dark:border-white/10" />
              <p className="text-xs text-gray-500">Read-Only View</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search transactions..."
                  value={actualsQuickFilterText}
                  onChange={(e) => setActualsQuickFilterText(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none w-48 dark:text-white"
                />
              </div>
              <div className="h-4 w-px bg-gray-200 dark:border-white/10 mx-1" />
              <button
                onClick={() => setIsActualsChartVisible(!isActualsChartVisible)}
                className={cn(
                  "p-2 rounded-lg transition-all",
                  isActualsChartVisible
                    ? "bg-black text-white dark:bg-white dark:text-black shadow-lg"
                    : "text-gray-400 hover:text-black dark:hover:text-white"
                )}
                title={isActualsChartVisible ? "Hide Chart" : "Show Chart"}
              >
                <BarChart3 className="w-5 h-5" />
              </button>
              <div className="h-4 w-px bg-gray-200 dark:border-white/10 mx-1" />
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-black dark:hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Chart */}
          <AnimatePresence>
            {isActualsChartVisible && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="bg-white dark:bg-[#141414] border-b border-gray-200 dark:border-white/10 px-4 py-4 overflow-hidden"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Actual Cost Distribution (Cost Flow)</span>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                        <span className="text-[10px] font-bold text-gray-500 uppercase">Periodic Cost</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-0.5 bg-emerald-500" />
                        <span className="text-[10px] font-bold text-gray-500 uppercase">Cumulative</span>
                      </div>
                    </div>
                  </div>
                  <div className="h-64 bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-200 dark:border-white/10 p-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={actualsChartData}>
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
                          tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`}
                        />
                        <YAxis
                          yAxisId="right"
                          orientation="right"
                          fontSize={9}
                          tick={{ fill: theme === 'dark' ? '#999' : '#666' }}
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: theme === 'dark' ? '#141414' : '#fff',
                            borderColor: theme === 'dark' ? '#333' : '#eee',
                            borderRadius: '8px',
                            fontSize: '11px',
                            padding: '8px'
                          }}
                          formatter={(val: number) => formatCurrency(val)}
                        />
                        <Bar dataKey="cost" name="Periodic Cost" fill="#3b82f6" radius={[2, 2, 0, 0]} barSize={20}>
                          <LabelList
                            dataKey="cost"
                            position="top"
                            formatter={(val: number) => `$${Math.round(val / 1000)}k`}
                            style={{ fill: theme === 'dark' ? '#fff' : '#000', fontWeight: 'bold', fontSize: '9px' }}
                          />
                        </Bar>
                        <Line yAxisId="right" type="monotone" dataKey="cumulative" name="Cumulative" stroke="#10b981" strokeWidth={2} dot={false} />
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
                rowData={actualsRows}
                columnDefs={actualsColumnDefs}
                quickFilterText={actualsQuickFilterText}
                loading={isActualsLoading}
                defaultColDef={{
                  sortable: true,
                  filter: true,
                  resizable: true,
                  minWidth: 100,
                }}
                animateRows={true}
                enableRangeSelection={true}
                enableCellTextSelection={true}
                grandTotalRow="top"
                pagination={true}
                paginationPageSize={100}
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
