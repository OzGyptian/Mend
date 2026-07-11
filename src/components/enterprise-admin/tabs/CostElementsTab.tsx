import React from 'react';
import { motion } from 'motion/react';
import { DollarSign } from 'lucide-react';

interface CostElementsTabProps {
  enterpriseId: string;
}

/**
 * CostElementsTab — placeholder for the cost elements admin surface.
 * State (selectedCostElementIds, costElementSearch, etc.) was previously
 * declared in EnterpriseAdmin but never rendered; it lives here when needed.
 */
export default function CostElementsTab({ enterpriseId: _enterpriseId }: CostElementsTabProps) {
  return (
    <motion.div
      key="costElements"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex-1 flex flex-col items-center justify-center p-12 text-center"
    >
      <div className="w-16 h-16 bg-gray-50 dark:bg-white/5 rounded-full flex items-center justify-center mb-6">
        <DollarSign className="w-8 h-8 text-gray-300" />
      </div>
      <h3 className="text-lg font-bold dark:text-white mb-2">Cost Elements</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs">
        Cost element management is coming soon.
      </p>
    </motion.div>
  );
}
