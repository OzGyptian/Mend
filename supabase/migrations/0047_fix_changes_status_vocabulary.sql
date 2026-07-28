-- Fix a second live breakage introduced by 0038 -- same class as the projects.status
-- bug fixed in 0046, found by the new vocabulary contract test
-- (tests/unit/vocabulary-contract.test.ts).
--
-- 0038 added changes_status_check allowing
--   ('Open','Pending','Under Review','Approved','Rejected','Cancelled')
-- but the application writes a different vocabulary:
--   domain/types.ts:465          status: 'Approved' | 'Pending' | 'Rejected' | 'Withdrawn'
--   schemas/change.ts:10         z.enum(['Approved','Pending','Rejected','Withdrawn'])
--   ChangeManagement.tsx:608-611 dropdown offers Approved/Pending/Rejected/Withdrawn
--   change-management/columns.tsx:105 grid editor offers the same four
--
-- 'Withdrawn' is absent from the CHECK, so setting a change to Withdrawn fails.
-- Verified live before this migration:
--   update changes set status='Withdrawn' -> ERROR: violates check constraint
--                                                    "changes_status_check"
--
-- 'Open', 'Under Review' and 'Cancelled' are written by nothing in the codebase; they
-- are retained anyway because existing rows could hold them and widening is harmless --
-- the invariant this project now enforces is code-vocabulary SUBSET OF db-vocabulary,
-- not equality.

alter table changes drop constraint if exists changes_status_check;

alter table changes
  add constraint changes_status_check
  check (status is null or status in (
    -- written by the app
    'Approved', 'Pending', 'Rejected', 'Withdrawn',
    -- retained from 0038 for backwards compatibility with any existing rows
    'Open', 'Under Review', 'Cancelled'
  ));
