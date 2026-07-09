export interface RocStep {
  id: string;
  weight: number;
}

/**
 * Computes Rule-of-Credit percent complete (0–100) for a single progress item.
 * percent = sum(stepProgress[step.id] * step.weight / 100)
 */
export function rocPercentComplete(
  steps: RocStep[],
  progress: Record<string, number>,
): number {
  return steps.reduce((sum, step) => {
    const stepProgress = progress[step.id] || 0;
    return sum + (stepProgress * step.weight / 100);
  }, 0);
}

/** Earned quantity = (rocPercent / 100) × totalQty */
export function earnedQty(rocPercent: number, totalQty: number): number {
  return (rocPercent / 100) * totalQty;
}

/** Overall % complete across a set of items = (totalEarned / totalQty) × 100 */
export function overallPercentComplete(totalEarned: number, totalQty: number): number {
  return totalQty > 0 ? (totalEarned / totalQty) * 100 : 0;
}
