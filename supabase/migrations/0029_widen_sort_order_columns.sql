-- Proactive fix for the same fractional-sort-order pattern found in
-- procurement_step_definitions.order -- checked every other integer
-- "order"/"sort" column in the schema rather than waiting to hit each one
-- individually as the ETL run progresses further into other collections.
alter table cost_codes alter column sort_order type numeric(10, 2) using sort_order::numeric;
alter table etc_details alter column sort_order type numeric(10, 2) using sort_order::numeric;
alter table progress_items alter column sort_order type numeric(10, 2) using sort_order::numeric;
notify pgrst, 'reload schema';
