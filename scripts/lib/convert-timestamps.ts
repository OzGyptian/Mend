import { Timestamp } from 'firebase-admin/firestore';

// Some real Firestore documents still hold raw Timestamp objects (older
// write paths, before a field was consistently written as an ISO string by
// the app) -- surfaces as literal {"_seconds":...,"_nanoseconds":...}
// objects hitting `date` columns otherwise. Shared between the ETL script
// (reading live) and the dump script (reading once to local JSON), so a
// dump is byte-for-byte what the ETL would have seen reading live.
export function convertTimestamps(value: unknown): unknown {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(convertTimestamps);
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = convertTimestamps(v);
    return out;
  }
  return value;
}
