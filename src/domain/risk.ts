/** Beta-PERT weighted average: (min + 4×mostLikely + max) / 6 */
export function betaPertImpact(min: number, mostLikely: number, max: number): number {
  return (min + 4 * mostLikely + max) / 6;
}

/** Risk exposure = betaPertImpact × probability */
export function betaPertExposure(
  min: number,
  mostLikely: number,
  max: number,
  probability: number,
): number {
  return betaPertImpact(min, mostLikely, max) * probability;
}

export interface RiskImpactLeaf {
  minImpactAmount: number;
  mostLikelyImpactAmount: number;
  maxImpactAmount: number;
  probability: number;
}

/**
 * Roll up a Risk's exposure and impact totals from its RiskRecord leaves.
 * Canonical replacement for the duplicated updateParentTotals in
 * RiskManagement.tsx and BulkRiskRecords.tsx.
 */
export function computeRiskRollup(records: RiskImpactLeaf[]): {
  exposure: number;
  minImpactTotal: number;
  mostLikelyImpactTotal: number;
  maxImpactTotal: number;
} {
  return records.reduce(
    (totals, r) => {
      const min = Number(r.minImpactAmount) || 0;
      const mostLikely = Number(r.mostLikelyImpactAmount) || 0;
      const max = Number(r.maxImpactAmount) || 0;
      const probability = Number(r.probability) || 0;
      return {
        exposure: totals.exposure + betaPertExposure(min, mostLikely, max, probability),
        minImpactTotal: totals.minImpactTotal + min,
        mostLikelyImpactTotal: totals.mostLikelyImpactTotal + mostLikely,
        maxImpactTotal: totals.maxImpactTotal + max,
      };
    },
    { exposure: 0, minImpactTotal: 0, mostLikelyImpactTotal: 0, maxImpactTotal: 0 },
  );
}
