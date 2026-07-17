-- D4: Drop procurement_items.package_id — dead text column
--
-- This was a Firestore-era text field with no corresponding procurement_packages
-- table and no code reading or writing it. Nothing in the adapters, components,
-- or domain code references it. The progress-tracking package_id (a real UUID FK
-- to progress_packages) is a separate concept on a separate table and is unaffected.
alter table procurement_items drop column package_id;
