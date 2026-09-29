-- Real, reliable trigger rather than relying on the frontend to
-- remember a separate notify call — a real offer is inserted directly
-- from the client, not through a dedicated function, so a database
-- trigger guarantees admin is notified every time, regardless of
-- which real screen creates the offer.

create or replace function notify_admin_new_offer()
returns trigger
language plpgsql
security definer
as $$
declare
  v_property_title text;
begin
  if new.status = 'awaiting_admin_review' then
    select title into v_property_title from properties where id = new.property_id;
    perform notify_admins_by_domain('owner_buyer_tenant', '💰 A real offer needs your review',
      coalesce(new.buyer_full_name, 'A real buyer') || ' has made a real offer on ' || coalesce(v_property_title, 'a property') || '. Review and relay it to the owner.',
      '/admin?tab=offerreview');
  end if;
  return new;
end;
$$;

create trigger trg_notify_admin_new_offer
  after insert on offers
  for each row execute function notify_admin_new_offer();
