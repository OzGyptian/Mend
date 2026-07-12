-- Caught by the ETL script's first real --apply run: PostgREST only
-- exposes public + graphql_public by default. The etl schema (holding
-- id_mappings, deliberately kept out of public so it's never part of the
-- app's own API surface) needs to be explicitly added to the exposed list
-- for the ETL script itself to reach it via the same REST client.
alter role authenticator set pgrst.db_schemas = 'public, graphql_public, etl';
notify pgrst, 'reload config';

-- Also grant the API roles usage on the etl schema and its table -- schema
-- exposure alone isn't enough, PostgREST still needs real Postgres grants.
grant usage on schema etl to anon, authenticated, service_role;
grant all on etl.id_mappings to service_role;
