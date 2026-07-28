import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Adapter boot contract (RCA 2026-07-28, remediation #3).
 *
 * F1: the app blank-paged for 10 days because `src/platform/supabase/client.ts` built
 * its client at module scope, and the composition root imports every Postgres adapter
 * statically regardless of VITE_ADAPTER. In memory mode (no VITE_SUPABASE_URL) that
 * threw `supabaseUrl is required.` at import time, before React could mount.
 *
 * The rule this encodes: **importing a storage adapter module must never require that
 * adapter's environment to be present.** Client construction belongs behind a function
 * call, not at module top level, for as long as the composition root imports eagerly.
 *
 * This is a static check on purpose — it needs no browser and no database, so it runs in
 * the same CI job as the unit tests. The e2e suite would also catch a regression here,
 * but only after a 5-minute run and (before remediation #2) with an illegible message.
 */

const SUPABASE_CLIENT = join(process.cwd(), 'src', 'platform', 'supabase', 'client.ts');

describe('storage adapter modules are import-safe without their environment', () => {
  const source = readFileSync(SUPABASE_CLIENT, 'utf8');

  it('does not call createClient at module scope', () => {
    // A top-level `export const supabase = createClient(...)` is the exact F1 regression.
    const topLevelConstruction = /^\s*(?:export\s+)?const\s+\w+\s*(?::[^=]+)?=\s*createClient\s*</m;
    expect(
      topLevelConstruction.test(source),
      'src/platform/supabase/client.ts constructs the Supabase client at module scope. ' +
        'Because the composition root imports all Postgres adapters regardless of VITE_ADAPTER, ' +
        'this throws "supabaseUrl is required." in memory/e2e mode and blank-pages the app ' +
        '(the 10-day CI outage of 2026-07-18). Construct it lazily inside a function instead.',
    ).toBe(false);
  });

  it('defers construction behind a function and validates configuration explicitly', () => {
    expect(
      /function\s+getClient|const\s+getClient\s*=/.test(source),
      'Expected a lazy accessor (getClient) in src/platform/supabase/client.ts.',
    ).toBe(true);

    expect(
      /VITE_SUPABASE_URL/.test(source) && /throw new Error/.test(source),
      'Expected the lazy accessor to validate its env and throw a clear, actionable error ' +
        'when the Supabase adapter is used without configuration.',
    ).toBe(true);
  });
});
