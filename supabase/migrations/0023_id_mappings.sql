-- ETL bookkeeping: one row per migrated Firestore document, recording the
-- new UUID it was assigned. Keyed by (collection_name, firestore_id) since
-- the same Firestore doc id could theoretically collide across different
-- collections. Makes re-running the ETL idempotent -- a doc already
-- migrated gets its existing UUID back instead of a fresh one, so foreign
-- keys stay consistent across incremental/resumed runs. Lives in its own
-- schema, not "public", so it never appears in the app's REST API surface.
create schema if not exists etl;

create table etl.id_mappings (
  collection_name text not null,
  firestore_id text not null,
  new_id uuid not null default gen_random_uuid(),
  migrated_at timestamptz not null default now(),
  primary key (collection_name, firestore_id)
);

create index on etl.id_mappings (new_id);
