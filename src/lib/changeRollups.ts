// Phase 13.B1.6 (SYSTEM_REVIEW.md v2 / PLAN.md): compute-on-read selector for
// Change.budget/eac. Same pattern as useCostCodeRollups/useRiskRollups —
// thin hook, all the math lives in domain/rollups.ts (aggregateChangeRollups,
// unit-tested). Replaces the identical updateParentTotals() duplicated in
// ChangeManagement.tsx and BulkChangeRecords.tsx.

import { useEffect, useMemo, useState } from 'react';
import type { Change, ChangeRecord } from '../domain/types';
import { aggregateChangeRollups } from '../domain/rollups';
import { useChangeRepo } from '../platform/firestore/hooks';

export function useChangeRollups(projectId: string | undefined, changes: Change[]): Map<string, { budget: number; eac: number }> {
  const changeRepo = useChangeRepo();
  const [changeRecords, setChangeRecords] = useState<ChangeRecord[]>([]);

  useEffect(() => {
    if (!projectId) { setChangeRecords([]); return; }
    return changeRepo.subscribeChangeRecords(projectId, setChangeRecords);
  }, [projectId, changeRepo]);

  return useMemo(() => aggregateChangeRollups(changes, changeRecords), [changes, changeRecords]);
}
