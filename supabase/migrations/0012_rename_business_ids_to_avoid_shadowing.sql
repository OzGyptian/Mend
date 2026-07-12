-- Renames every human-facing business-identifier column from <entity>_id to
-- <entity>_code. These aren't FKs -- they're short user-facing codes
-- (risk_id, change_id, etc.) that happened to share a name with a real FK
-- column on a child table (e.g. risk_records.risk_id references risks(id)),
-- causing exactly the scope-shadowing bug already fixed once for
-- invoices.invoice_id / invoice_items.invoice_id (see 0007's comment on
-- invoice_items' policies).
--
-- That fix qualified every reference explicitly, which works but relies on
-- every future query remembering to do the same. Requested explicitly by
-- Bernard after asking to root-cause the naming-collision bug class rather
-- than treat the invoice_id fix as a one-off: audited all 11 migration
-- files for the same <parent business-id> / <child FK> name collision and
-- found 3 more dormant instances (risks/risk_records, changes/change_records,
-- progress_packages/progress_items+rules_of_credit) that hadn't triggered a
-- visible bug yet only because no policy or query had happened to reference
-- them in a colliding way -- structurally identical landmines, not fixed
-- versions of the same problem.
--
-- Renaming the parent's business-id column (not the child's FK, which
-- follows normal, correct FK-naming convention) removes the whole bug class
-- at the schema level instead of leaving it to query-writing discipline.
-- order_id, rule_id, and item_id didn't have an active collision (no other
-- table happens to FK to them under that exact name yet) but followed the
-- identical risky naming pattern, so renamed those too rather than leaving
-- a latent landmine for a future table to step on.

alter table risks rename column risk_id to risk_code;
alter table risks rename constraint risks_project_id_risk_id_key to risks_project_id_risk_code_key;

alter table changes rename column change_id to change_code;
alter table changes rename constraint changes_project_id_change_id_key to changes_project_id_change_code_key;

alter table progress_packages rename column package_id to package_code;
alter table progress_packages rename constraint progress_packages_project_id_package_id_key to progress_packages_project_id_package_code_key;

alter table invoices rename column invoice_id to invoice_code;
alter table invoices rename constraint invoices_subcontract_id_invoice_id_key to invoices_subcontract_id_invoice_code_key;

alter table subcontracts rename column order_id to order_code;
alter table subcontracts rename constraint subcontracts_project_id_order_id_key to subcontracts_project_id_order_code_key;

alter table rules_of_credit rename column rule_id to rule_code;
alter table rules_of_credit rename constraint rules_of_credit_project_id_rule_id_key to rules_of_credit_project_id_rule_code_key;

alter table progress_items rename column item_id to item_code;
alter table progress_items rename constraint progress_items_package_id_item_id_key to progress_items_package_id_item_code_key;
