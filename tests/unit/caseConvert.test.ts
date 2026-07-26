import { describe, it, expect } from 'vitest';
import { toRow, fromRow } from '../../src/platform/supabase/caseConvert';

describe('caseConvert renames', () => {
  // Regression test for the bug behind the Change Management "Change ID"
  // not displaying: fromRow's renames loop was applying the map backwards,
  // so a human-facing code column (e.g. change_code) never made it back to
  // its domain field name (changeId) after a read.
  const CHANGE_RENAMES = { change_id: 'change_code' };

  it('round-trips a renamed column through toRow then fromRow', () => {
    const row = toRow<Record<string, unknown>>({ changeId: 'CHG-001', description: 'x' }, CHANGE_RENAMES);
    expect(row).toEqual({ change_code: 'CHG-001', description: 'x' });

    const domain = fromRow<{ changeId: string; description: string }>(row, CHANGE_RENAMES);
    expect(domain.changeId).toBe('CHG-001');
    expect(domain.description).toBe('x');
  });

  it('maps the real DB column straight to its domain field on read, independent of toRow', () => {
    const dbRow = { change_code: 'CHG-002', project_id: 'p1' };
    const domain = fromRow<{ changeId: string; projectId: string }>(dbRow, CHANGE_RENAMES);
    expect(domain.changeId).toBe('CHG-002');
    expect(domain.projectId).toBe('p1');
  });
});
