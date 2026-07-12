// Postgres columns are snake_case; domain types are camelCase. These
// converters handle the mechanical part of that translation. Fields that
// were deliberately renamed during the schema migration (risk_code vs
// riskId, etc. -- see migration 0012's naming-collision fix) or that are
// database-GENERATED columns (never writable) are handled per-adapter via
// an explicit rename/omit map layered on top of this, not here.

function snakeToCamel(key: string): string {
  return key.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
}

function camelToSnake(key: string): string {
  return key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

export function rowToCamel<T>(row: Record<string, unknown>): T {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    out[snakeToCamel(key)] = value;
  }
  return out as T;
}

export function camelToRow(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    out[camelToSnake(key)] = value;
  }
  return out;
}

/**
 * Applies camelToRow, then renames specific keys and drops any GENERATED
 * columns before a write. `renames` maps the post-camelToSnake column name
 * to its actual DB column name (e.g. { risk_id: 'risk_code' }). Generic
 * over the target Insert/Update row type, following the same boundary-
 * assertion pattern as the existing firestore/converters.ts::fromDoc<T> --
 * a case-conversion utility can't be statically typed against every one of
 * the 35 generated table shapes, so the assertion happens once here
 * instead of `any` scattered across every adapter call site.
 */
export function toRow<T>(
  obj: Record<string, unknown>,
  renames: Record<string, string> = {},
  omit: string[] = []
): T {
  const row = camelToRow(obj);
  for (const [from, to] of Object.entries(renames)) {
    if (from in row) {
      row[to] = row[from];
      delete row[from];
    }
  }
  for (const key of omit) delete row[key];
  return row as T;
}

/**
 * Applies rowToCamel, then renames specific keys back to their domain
 * field names (the inverse of `toRow`'s renames map).
 */
export function fromRow<T>(row: Record<string, unknown>, renames: Record<string, string> = {}): T {
  const withRenames: Record<string, unknown> = { ...row };
  for (const [dbCol, domainSnakeEquivalent] of Object.entries(renames)) {
    if (dbCol in withRenames) {
      withRenames[domainSnakeEquivalent] = withRenames[dbCol];
      delete withRenames[dbCol];
    }
  }
  return rowToCamel<T>(withRenames);
}
