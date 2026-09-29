-- Real fix to a third real constraint mismatch caught by direct
-- testing: offers.status never had a real 'refunded' terminal state
-- either. Added properly, alongside the real existing states.
--
-- No numbering collision on this one -- the parallel Investor-role
-- work (see 340b-344b) skipped straight from 342b to 344b.

alter table offers drop constraint offers_status_check;
alter table offers add constraint offers_status_check
  check (status = any (array['awaiting_admin_review', 'pending', 'owner_decided_pending_relay', 'accepted', 'rejected', 'withdrawn', 'refunded']));
