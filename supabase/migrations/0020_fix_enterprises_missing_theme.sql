-- Caught writing EnterpriseAdapter: Enterprise.theme ('light' | 'dark') was
-- never added to the enterprises table in migration 0001.
alter table enterprises add column theme text check (theme in ('light', 'dark'));
