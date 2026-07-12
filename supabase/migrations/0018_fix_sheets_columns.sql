-- Caught right after the etc_details gap: migration 0002 guessed a generic
-- (name, data jsonb) shape for sheets that doesn't match the real Sheet
-- domain type at all (sheetName, forecastMethod, version, lockedStatus,
-- createdBy, users[]).
alter table sheets rename column name to sheet_name;
alter table sheets drop column data;
alter table sheets add column forecast_method text not null default 'Manual';
alter table sheets add column version text not null default '1';
alter table sheets add column locked_status boolean not null default false;
alter table sheets add column created_by uuid references auth.users (id);
alter table sheets add column users uuid[] not null default '{}';
