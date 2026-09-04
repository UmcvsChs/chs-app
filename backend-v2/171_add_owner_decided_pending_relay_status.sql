alter table rental_applications drop constraint if exists rental_applications_status_check;
alter table rental_applications add constraint rental_applications_status_check
  check (status = ANY (ARRAY['pending', 'awaiting_owner_decision', 'owner_decided_pending_relay', 'approved', 'owner_declined']));
