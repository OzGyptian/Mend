import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Vocabulary contract test (RCA 2026-07-28, remediation #1).
 *
 * THE INVARIANT: every value the application code can write must be legal in the
 * database. A CHECK constraint narrower than the code's vocabulary is a live outage —
 * the write simply fails for the user.
 *
 * This has bitten twice, both introduced by migration 0038:
 *   - projects.status  — the UI offers Closed/Archived, the CHECK forbade them (11 days live)
 *   - changes.status   — the UI offers Withdrawn, the CHECK forbids it
 *
 * Neither was caught by any test, because the only enforced functional suite runs
 * against the in-memory adapter, which has no schema and no constraints. This test
 * closes that gap WITHOUT needing a database: it reads the CHECK sets straight out of
 * the migration files and compares them to the vocabularies declared in the code.
 *
 * Direction matters: code ⊆ database. The database may permit values the code never
 * writes (harmless); it must never forbid one the code can produce.
 */

const MIGRATIONS_DIR = join(process.cwd(), 'supabase', 'migrations');

/** Final-state CHECK vocabulary per `table.column`, later migrations winning. */
function parseCheckVocabularies(): Map<string, { values: string[]; file: string }> {
  const out = new Map<string, { values: string[]; file: string }>();
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    // Strip line comments so prose mentioning quoted values cannot be mistaken for SQL.
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8')
      .split('\n')
      .filter((l) => !l.trim().startsWith('--'))
      .join('\n');

    // 1. Inline column CHECKs inside CREATE TABLE.
    const createTable = /create\s+table\s+(?:if\s+not\s+exists\s+)?([a-z_0-9.]+)\s*\(([\s\S]*?)\n\);/gi;
    let m: RegExpExecArray | null;
    while ((m = createTable.exec(sql))) {
      const table = m[1].replace(/^public\./, '');
      const inline = /check\s*\(\s*([a-z_0-9]+)[\s\S]*?in\s*\(([^)]*)\)/gi;
      let c: RegExpExecArray | null;
      while ((c = inline.exec(m[2]))) {
        const values = [...c[2].matchAll(/'([^']*)'/g)].map((x) => x[1]);
        if (values.length) out.set(`${table}.${c[1]}`, { values, file });
      }
    }

    // 2. ALTER TABLE ... ADD COLUMN <col> ... CHECK (col in (...)).
    const alterAddColumn =
      /alter\s+table\s+([a-z_0-9.]+)\s+add\s+column\s+(?:if\s+not\s+exists\s+)?([a-z_0-9]+)\b[^;]*?check\s*\(([^;]*?)\)\s*;/gi;
    while ((m = alterAddColumn.exec(sql))) {
      const table = m[1].replace(/^public\./, '');
      const values = [...m[3].matchAll(/'([^']*)'/g)].map((x) => x[1]);
      if (values.length) out.set(`${table}.${m[2]}`, { values, file });
    }

    // 3. ALTER TABLE ... ADD CONSTRAINT ... CHECK (col [is null or] col in (...)).
    const alterAdd =
      /alter\s+table\s+([a-z_0-9.]+)\s+add\s+constraint\s+[a-z_0-9]+\s+check\s*\(([\s\S]*?)\)\s*;/gi;
    while ((m = alterAdd.exec(sql))) {
      const table = m[1].replace(/^public\./, '');
      const col = /([a-z_0-9]+)\s+in\s*\(/i.exec(m[2]);
      const values = [...m[2].matchAll(/'([^']*)'/g)].map((x) => x[1]);
      if (col && values.length) out.set(`${table}.${col[1]}`, { values, file });
    }
  }
  return out;
}

/**
 * What the CODE can write, per column. Every entry cites the source it was read from —
 * populate these by reading the source, never from memory. `null`/undefined are ignored
 * (nullability is a separate concern from vocabulary).
 */
const CODE_VOCABULARIES: Record<string, { values: string[]; source: string }> = {
  'projects.status': {
    values: ['Active', 'On Hold', 'Closed', 'Archived'],
    source: 'domain/types.ts ProjectStatus; EnterpriseAdmin.tsx + enterprise-admin/columns.tsx dropdowns',
  },
  'changes.status': {
    values: ['Approved', 'Pending', 'Rejected', 'Withdrawn'],
    source: 'domain/types.ts:465; schemas/change.ts:10; ChangeManagement.tsx:608-611; change-management/columns.tsx:105',
  },
  'cost_codes.eac_method': {
    values: ['Manual', 'Change Management', 'ETC Details', 'Sub-Contract Management'],
    source: 'domain/types.ts:374; cost-codes/columns.tsx:931',
  },
  'sheets.forecast_method': {
    values: ['commitment', 'time-based'],
    source: 'domain/types.ts ForecastMethod; ProjectDashboard.tsx:391-392',
  },
  'risks.status': {
    values: ['Open', 'Mitigated', 'Closed', 'Realized'],
    source: 'schemas/risk.ts z.enum',
  },
  'risks.strategy': {
    values: ['Avoid', 'Mitigate', 'Transfer', 'Accept'],
    source: 'schemas/risk.ts z.enum',
  },
  'subcontracts.status': {
    values: ['Active', 'Complete', 'On Hold'],
    source: 'schemas/subcontract.ts z.enum',
  },
  'subcontracts.payment_type': {
    values: ['LumpSum', 'Schedule of Rates', 'Re-measurable'],
    source: 'schemas/subcontract.ts z.enum',
  },
  'subcontract_line_items.status': {
    values: ['Approved', 'Pending', 'Forecast', 'Rejected'],
    source: 'schemas/subcontract.ts z.enum',
  },
  'subcontract_line_items.type': {
    values: ['Original', 'ChangeOrder'],
    source: 'schemas/subcontract.ts z.enum',
  },
  'invoices.status': {
    values: ['Draft', 'Submitted', 'Certified', 'Rejected', 'Paid'],
    source: 'schemas/invoice.ts z.enum',
  },
  'invoice_items.type': {
    values: ['Original', 'ChangeOrder'],
    source: 'schemas/invoice.ts z.enum',
  },
  'progress_attributes.type': {
    values: ['text', 'dropdown', 'date', 'number'],
    source: 'schemas/progress.ts z.enum',
  },
  'progress_reporting_periods.status': {
    values: ['Open', 'Closed'],
    source: 'schemas/progress.ts z.enum',
  },
  'progress_items.phasing_curve': {
    values: ['Scurve', 'Bell', 'front load', 'back load', 'even'],
    source: 'schemas/progress.ts PhasingCurveSchema; progress-tracking/columns.tsx:1075',
  },
  'progress_items.current_phasing_curve': {
    values: ['Scurve', 'Bell', 'front load', 'back load', 'even'],
    source: 'schemas/progress.ts PhasingCurveSchema',
  },
  'progress_items.phasing_method': {
    values: ['Auto', 'Manual'],
    source: 'domain/types.ts:521; ProgressItemsPanel.tsx:449',
  },
  'progress_items.current_phasing_method': {
    values: ['Auto', 'Manual'],
    source: 'domain/types.ts:531',
  },
  'progress_packages.default_phasing_curve': {
    values: ['Scurve', 'Bell', 'front load', 'back load', 'even'],
    source: 'schemas/progress.ts PhasingCurveSchema',
  },
  'progress_packages.default_phasing_method': {
    values: ['Auto', 'Manual'],
    source: 'schemas/progress.ts z.enum',
  },
  'etc_details.phasing_method': {
    values: ['Manual', 'Auto-Phase'],
    source: 'domain/types.ts:432',
  },
  'etc_details.phasing_unit': {
    values: ['Daily', 'Weekly', 'Monthly', 'Total', 'Profile'],
    source: 'schemas/cost.ts z.enum',
  },
  'enterprises.theme': {
    values: ['light', 'dark'],
    source: 'schemas/enterprise.ts z.enum',
  },
};

/**
 * Columns with a DB CHECK that are deliberately not registered above, each with a reason.
 * Anything not in CODE_VOCABULARIES and not here fails the completeness test, so a new
 * constraint forces a conscious decision rather than silently going unverified.
 */
const UNREGISTERED_WITH_REASON: Record<string, string> = {
  'cost_phasing.distribution_method':
    'Written by the phasing engine (domain/phasing.ts switch cases), not a declared union. ' +
    'NOTE: domain/types.ts DistributionMethod ("manual"|"even"|"front"|"back"|"bell") does NOT ' +
    'match the stored title-case values and appears to be dead/incorrect — tracked separately.',
  'forecast_rows.distribution_method': 'Same engine vocabulary as cost_phasing.distribution_method.',
  'subcontracts.default_distribution': 'Phasing-engine vocabulary; see cost_phasing note.',
  'subcontract_line_items.distribution': 'Phasing-engine vocabulary; see cost_phasing note.',
  'subcontracts.default_phasing_source': 'Phasing-source vocabulary, written by grid editors; not a declared union.',
  'subcontract_line_items.phasing_source': 'Phasing-source vocabulary; see above.',
};

describe('database CHECK vocabularies vs application code', () => {
  const dbVocabularies = parseCheckVocabularies();

  it('parses CHECK constraints out of the migration files', () => {
    // Guards the parser itself: if a refactor breaks parsing, every other assertion
    // below would vacuously pass.
    expect(dbVocabularies.size).toBeGreaterThan(15);
    expect(dbVocabularies.get('projects.status')?.values).toContain('Active');
  });

  for (const [column, { values, source }] of Object.entries(CODE_VOCABULARIES)) {
    it(`${column}: every value the code can write is permitted by the database`, () => {
      const db = dbVocabularies.get(column);
      expect(db, `no CHECK found for ${column} — update the test or the migration`).toBeDefined();

      const rejected = values.filter((v) => !db!.values.includes(v));
      expect(
        rejected,
        `The database would REJECT ${JSON.stringify(rejected)} for ${column}.\n` +
          `  code can write: ${JSON.stringify(values)}\n` +
          `  db permits:     ${JSON.stringify(db!.values)}  (${db!.file})\n` +
          `  code source:    ${source}\n` +
          `  This is a live outage for users who pick that option. Fix the CHECK ` +
          `(preferred) or narrow the code — do not just edit this test.`,
      ).toEqual([]);
    });
  }

  it('every CHECK-constrained column is either registered or explicitly waived', () => {
    const unaccounted = [...dbVocabularies.keys()].filter(
      (col) => !(col in CODE_VOCABULARIES) && !(col in UNREGISTERED_WITH_REASON),
    );
    expect(
      unaccounted,
      `These columns gained a CHECK constraint but no code vocabulary was registered:\n` +
        unaccounted.map((c) => `  - ${c}: ${JSON.stringify(dbVocabularies.get(c)?.values)}`).join('\n') +
        `\nAdd them to CODE_VOCABULARIES (with the source you read) or to ` +
        `UNREGISTERED_WITH_REASON (with a reason).`,
    ).toEqual([]);
  });
});
