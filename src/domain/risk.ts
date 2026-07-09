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
