-- Same blind spot as rental applications: an owner cannot read a
-- buyer's profile (correct, for privacy), so the owner's "ID verified"
-- badge on an offer, which read that profile, could never show
-- verified. Record the buyer's verified status on the offer itself at
-- the moment it is made. Identity verification is now enforced at the
-- database before any offer can be made, so this is always accurate.

alter table offers add column if not exists buyer_verified boolean not null default false;

update offers o set buyer_verified = coalesce(p.valid_id_verified, false)
from profiles p where p.id = o.buyer_id;

create or replace function mark_buyer_verified()
returns trigger
language plpgsql
security definer
as $$
begin
  new.buyer_verified := coalesce((select valid_id_verified from profiles where id = new.buyer_id), false);
  return new;
end;
$$;

drop trigger if exists trg_set_buyer_verified on offers;
create trigger trg_set_buyer_verified before insert on offers
  for each row execute function mark_buyer_verified();
