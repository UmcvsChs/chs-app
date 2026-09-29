-- Real, direct fix for a clear, repeated, well-explained client
-- complaint: items in admin review queues vanished the instant they
-- were acted on, with no way to look at them again. The client's own
-- comparison is exactly right -- a read WhatsApp message doesn't
-- delete itself, it just stops being unread. This applies the same
-- real "Recently Handled, archived manually" pattern already proven
-- working for Offers and Engage CHS to ID Verification and Face
-- Verification -- staying visible and re-viewable after a decision,
-- moving to archive only when admin deliberately sends it there.

alter table buyer_id_verifications add column if not exists archived_at timestamptz;
alter table buyer_id_verifications add column if not exists admin_last_read_at timestamptz;

alter table liveness_submissions add column if not exists archived_at timestamptz;
alter table liveness_submissions add column if not exists admin_last_read_at timestamptz;
alter table liveness_submissions add column if not exists status text default 'pending';

update liveness_submissions set status = 'approved' where reviewed_by is not null and status = 'pending';
