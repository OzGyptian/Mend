export interface Period {
  id: string;
  startDate: string;
  endDate: string;
}

export const dateToISO = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export function calculatePhasing(
  total: number,
  startDate: string | Date,
  endDate: string | Date,
  distribution: string,
  periods: Period[],
  existingPeriodValues?: Record<string, number>
): Record<string, number> {
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end) return {};

  const activePeriods = periods.filter(p => {
    const pStart = new Date(p.startDate);
    const pEnd = new Date(p.endDate);
    return pStart <= end && pEnd >= start;
  });

  if (activePeriods.length === 0) return {};

  const n = activePeriods.length;
  let weights: number[];

  switch (distribution) {
    case 'Even':
      weights = new Array(n).fill(1);
      break;
    case 'Front load':
      weights = activePeriods.map((_, i) => n - i);
      break;
    case 'Back load':
      weights = activePeriods.map((_, i) => i + 1);
      break;
    case 'Bell':
    case 'Bell Curve':
      weights = activePeriods.map((_, i) => {
        const x = (i - (n - 1) / 2) / (n / 4 || 1);
        return Math.exp(-0.5 * x * x);
      });
      break;
    case 'S-Curve':
      weights = activePeriods.map((_, i) => {
        const x = (i / (n - 1 || 1)) * 10 - 5;
        const sigmoid = 1 / (1 + Math.exp(-x));
        const prevX = ((i - 1) / (n - 1 || 1)) * 10 - 5;
        const prevSigmoid = i === 0 ? 0 : 1 / (1 + Math.exp(-prevX));
        return sigmoid - prevSigmoid;
      });
      break;
    case 'Profile':
      if (existingPeriodValues) {
        weights = activePeriods.map(p => existingPeriodValues[p.id] ?? 0);
        const weightSum = weights.reduce((a, b) => a + b, 0);
        if (weightSum === 0) weights = new Array(n).fill(1);
      } else {
        weights = new Array(n).fill(1);
      }
      break;
    default:
      weights = new Array(n).fill(1);
  }

  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const periodValues: Record<string, number> = {};
  activePeriods.forEach((p, i) => {
    periodValues[p.id] = (weights[i] / (totalWeight || 1)) * total;
  });

  return periodValues;
}
