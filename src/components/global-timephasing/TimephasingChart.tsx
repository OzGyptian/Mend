import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatCurrency } from '../../lib/utils';

export interface ChartDataPoint {
  name: string;
  baseline: number;
  approved: number;
  eac: number;
  eacPrevious: number;
  cumulativeBaseline: number;
  cumulativeApproved: number;
  cumulativeEac: number;
  cumulativeEacPrevious: number;
}

interface TimephasingChartProps {
  chartData: ChartDataPoint[];
  chartMode: 'value' | 'percent';
  setChartMode: (mode: 'value' | 'percent') => void;
  theme: 'light' | 'dark';
}

export function TimephasingChart({ chartData, chartMode, setChartMode, theme }: TimephasingChartProps) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="global-phasing-chart"
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: 'auto', opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        className="overflow-hidden"
      >
        <div className="bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <h3 className="text-sm font-bold dark:text-white">Project Cashflow Profile</h3>
                <div className="flex bg-white dark:bg-white/5 p-1 rounded-lg border border-gray-200 dark:border-white/10">
                  <button
                    onClick={() => setChartMode('value')}
                    className={cn(
                      "px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded-md transition-all",
                      chartMode === 'value' ? "bg-black dark:bg-white text-white dark:text-black" : "text-gray-400 hover:text-gray-600"
                    )}
                  >
                    Value
                  </button>
                  <button
                    onClick={() => setChartMode('percent')}
                    className={cn(
                      "px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded-md transition-all",
                      chartMode === 'percent' ? "bg-black dark:bg-white text-white dark:text-black" : "text-gray-400 hover:text-gray-600"
                    )}
                  >
                    Percent
                  </button>
                </div>
              </div>
            </div>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#333' : '#eee'} />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: theme === 'dark' ? '#666' : '#999' }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: theme === 'dark' ? '#666' : '#999' }}
                    tickFormatter={(val) => chartMode === 'percent' ? `${val}%` : formatCurrency(val)}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: theme === 'dark' ? '#1a1a1a' : '#fff',
                      border: 'none',
                      borderRadius: '12px',
                      boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'
                    }}
                    formatter={(val: any) => chartMode === 'percent' ? `${val.toFixed(1)}%` : formatCurrency(val)}
                  />
                  <Legend verticalAlign="top" align="right" iconType="circle" />
                  <Bar dataKey="baseline" name="Baseline (Periodic)" fill="#3b82f6" radius={[4, 4, 0, 0]} opacity={0.3} />
                  <Bar dataKey="approved" name="Approved (Periodic)" fill="#10b981" radius={[4, 4, 0, 0]} opacity={0.3} />
                  <Bar dataKey="eac" name="EAC (Periodic)" fill="#f59e0b" radius={[4, 4, 0, 0]} opacity={0.3} />
                  <Area type="monotone" dataKey="cumulativeBaseline" name="Baseline (Cumulative)" stroke="#3b82f6" fill="url(#colorBaseline)" strokeWidth={3} dot={false} />
                  <Area type="monotone" dataKey="cumulativeApproved" name="Approved (Cumulative)" stroke="#10b981" fill="url(#colorApproved)" strokeWidth={3} dot={false} />
                  <Area type="monotone" dataKey="cumulativeEac" name="EAC (Cumulative)" stroke="#f59e0b" fill="url(#colorEac)" strokeWidth={3} dot={false} />
                  <Area type="monotone" dataKey="cumulativeEacPrevious" name="EAC Previous (Cumulative)" stroke="#94a3b8" fill="url(#colorEacPrev)" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                  <defs>
                    <linearGradient id="colorBaseline" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorApproved" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorEac" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorEacPrev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.05}/>
                      <stop offset="95%" stopColor="#94a3b8" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
