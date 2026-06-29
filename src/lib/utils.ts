import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { dateToISO, calculatePhasing, type Period } from '../domain/phasing';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const formatCurrency = (val: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val || 0);

export const formatNumber = (val: number, decimals: number = 2) =>
  new Intl.NumberFormat('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(val || 0);

// Tech debt: the Firestore Timestamp branch (typeof dateVal.toDate === 'function') leaks
// a storage concern into this utility. Remove it once all Firestore types are behind platform adapters.
export const formatDate = (dateVal: unknown) => {
  if (!dateVal) return '';
  let dateStr = '';
  if (dateVal instanceof Date) {
    dateStr = dateToISO(dateVal);
  } else if (dateVal && typeof (dateVal as Record<string, unknown>).toDate === 'function') {
    dateStr = dateToISO((dateVal as { toDate: () => Date }).toDate());
  } else if (typeof dateVal === 'string') {
    dateStr = dateVal;
  } else {
    return String(dateVal);
  }
  const datePart = dateStr.split('T')[0];
  const parts = datePart.split('-');
  if (parts.length !== 3) return dateStr;
  const [y, m, d] = parts;
  return `${d}/${m}/${y}`;
};

export { dateToISO, calculatePhasing, type Period };
