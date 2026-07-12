-- Caught while writing the UtilityAdapter: UtilityRepository.createInvitation
-- writes `token` (the accept-invite verification token) and `enterpriseName`
-- (denormalized on purpose -- an unauthenticated invitee can't join against
-- `enterprises` before they've signed up, so this can't just be a live join),
-- neither of which existed on the invitations table from migration 0001.
alter table invitations add column token text not null default '';
alter table invitations add constraint invitations_token_key unique (token);
alter table invitations alter column token drop default;
alter table invitations add column enterprise_name text not null default '';
alter table invitations alter column enterprise_name drop default;
