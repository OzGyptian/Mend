-- D10: Project settings inheritance (null = inherit from enterprise)
--
-- Previously these columns were NOT NULL DEFAULT '{}' / '[]', meaning every
-- project was born with empty arrays regardless of what the enterprise had set.
-- Components then scattered ad-hoc COALESCE logic across the codebase.
--
-- After this migration:
--   NULL   → "I inherit from enterprise (or department when that exists)"
--   []     → "I have explicitly overridden this to be empty"
--   [{…}]  → "I have my own values"
--
-- The read path in ProjectAdapter will COALESCE(project.value, enterprise.value).

-- 1. Drop NOT NULL constraints on the 14 inheritable settings columns
alter table projects
  alter column categories        drop not null,
  alter column control_accounts  drop not null,
  alter column order_numbers     drop not null,
  alter column cost_elements     drop not null,
  alter column cost_code_attributes    drop not null,
  alter column subcontract_attributes  drop not null,
  alter column change_attributes       drop not null,
  alter column risk_attributes         drop not null,
  alter column procurement_attributes  drop not null,
  alter column progress_attributes     drop not null,
  alter column change_types      drop not null,
  alter column risk_types        drop not null,
  alter column line_item_attributes    drop not null,
  alter column resource_rates    drop not null;

-- 2. Null out the empty-default values so they read as "inherit"
--    Non-empty values are kept — they are genuine project-level overrides.
update projects set categories            = null where categories            = '{}';
update projects set control_accounts      = null where control_accounts      = '{}';
update projects set order_numbers         = null where order_numbers         = '{}';
update projects set cost_elements         = null where cost_elements         = '[]'::jsonb;
update projects set cost_code_attributes  = null where cost_code_attributes  = '[]'::jsonb;
update projects set subcontract_attributes= null where subcontract_attributes= '[]'::jsonb;
update projects set change_attributes     = null where change_attributes     = '[]'::jsonb;
update projects set risk_attributes       = null where risk_attributes       = '[]'::jsonb;
update projects set procurement_attributes= null where procurement_attributes= '[]'::jsonb;
update projects set progress_attributes   = null where progress_attributes   = '[]'::jsonb;
update projects set change_types          = null where change_types          = '{}';
update projects set risk_types            = null where risk_types            = '{}';
update projects set line_item_attributes  = null where line_item_attributes  = '[]'::jsonb;
update projects set resource_rates        = null where resource_rates        = '[]'::jsonb;
