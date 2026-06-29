import { Timestamp } from 'firebase/firestore';

function convertValue(val: unknown): unknown {
  if (val instanceof Timestamp) return val.toDate().toISOString();
  if (Array.isArray(val)) return val.map(convertValue);
  if (val !== null && typeof val === 'object') {
    return convertFields(val as Record<string, unknown>);
  }
  return val;
}

function convertFields(data: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(data)) {
    result[key] = convertValue(val);
  }
  return result;
}

export function fromDoc<T>(id: string, data: Record<string, unknown>): T {
  return { id, ...convertFields(data) } as T;
}
