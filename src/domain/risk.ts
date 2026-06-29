export function betaPertImpact(min: number, mostLikely: number, max: number): number {
  return (min + 4 * mostLikely + max) / 6;
}
