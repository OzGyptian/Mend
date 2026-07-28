import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

// Lazily-initialised Supabase client.
//
// The composition root statically imports every Postgres adapter (which import
// this module) regardless of the selected VITE_ADAPTER. Constructing the client
// at module load therefore ran on EVERY boot — including memory/e2e mode, where
// VITE_SUPABASE_URL is intentionally absent — and `createClient(undefined, …)`
// throws "supabaseUrl is required.", crashing the app before React mounts
// (blank page; all e2e tests time out). Deferring construction to first use lets
// the module be imported harmlessly when the Supabase adapter is never exercised.
// See GitHub issue #14 (lazy-load Postgres adapters).

let client: SupabaseClient<Database> | null = null;

function getClient(): SupabaseClient<Database> {
  if (client) return client;
  const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL as string | undefined;
  const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Supabase is not configured (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are unset). ' +
        'The Supabase adapter is only usable when VITE_ADAPTER=postgres.',
    );
  }
  client = createClient<Database>(supabaseUrl, supabaseAnonKey);
  return client;
}

// A proxy that defers to the real client on first property access, so existing
// `supabase.from(...)` / `supabase.auth` / `supabase.channel(...)` call sites work
// unchanged while nothing is constructed until a call actually happens.
export const supabase: SupabaseClient<Database> = new Proxy({} as SupabaseClient<Database>, {
  get(_target, prop, receiver) {
    const real = getClient() as unknown as Record<string | symbol, unknown>;
    const value = Reflect.get(real, prop, receiver);
    return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(real) : value;
  },
});
