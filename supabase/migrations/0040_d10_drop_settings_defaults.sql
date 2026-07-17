-- Drop the empty-array/object defaults from the 14 inheritable settings columns
-- so that new projects omitting these fields get NULL (inherit) not '{}'/'[]'.
-- Migration 0039 already dropped NOT NULL; this drops the DEFAULT clause.
alter table projects
  alter column categories              drop default,
  alter column control_accounts        drop default,
  alter column order_numbers           drop default,
  alter column cost_elements           drop default,
  alter column cost_code_attributes    drop default,
  alter column subcontract_attributes  drop default,
  alter column change_attributes       drop default,
  alter column risk_attributes         drop default,
  alter column procurement_attributes  drop default,
  alter column progress_attributes     drop default,
  alter column change_types            drop default,
  alter column risk_types              drop default,
  alter column line_item_attributes    drop default,
  alter column resource_rates          drop default;
