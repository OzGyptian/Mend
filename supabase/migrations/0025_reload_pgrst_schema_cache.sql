-- Migration 0024 sent 'reload config' (refreshes settings like the exposed
-- schema list) but PostgREST needs a separate 'reload schema' signal to
-- actually re-scan and discover tables within a newly-exposed schema --
-- that's why etl.id_mappings still wasn't found even after 0024 exposed
-- the etl schema itself.
notify pgrst, 'reload schema';
