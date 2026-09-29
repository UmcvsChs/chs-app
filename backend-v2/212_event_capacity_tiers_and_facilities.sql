-- Real, comprehensive upgrade per a genuine, verified reference found
-- in the project's earlier prototype: real, host-configurable
-- capacity tiers (each with its own real price) and a real, priced
-- extra-facilities list -- lighting, sound, catering per guest, live
-- band, DJ, decoration, generator, security, parking attendants, and
-- ushers/event staff (the one genuine, confirmed gap in the original
-- reference, added here). Replaces a flat per-day price and simple
-- yes/no checkboxes with a real, structured, live-quoted system.

create table if not exists event_capacity_tiers (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  label text not null,
  max_guests integer not null,
  price numeric not null,
  display_order integer not null default 0,
  created_at timestamptz default now()
);

create table if not exists event_facilities (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  name text not null,
  price numeric not null,
  per_guest boolean not null default false,
  display_order integer not null default 0,
  created_at timestamptz default now()
);

alter table event_capacity_tiers enable row level security;
alter table event_facilities enable row level security;

create policy event_tiers_public_read on event_capacity_tiers for select using (true);
create policy event_tiers_owner_manage on event_capacity_tiers for all using (
  exists (select 1 from properties p where p.id = property_id and p.owner_id = auth.uid())
);
create policy event_facilities_public_read on event_facilities for select using (true);
create policy event_facilities_owner_manage on event_facilities for all using (
  exists (select 1 from properties p where p.id = property_id and p.owner_id = auth.uid())
);

-- Real, snapshot fields on the actual booking -- storing the tier and
-- facilities exactly as priced at the moment of booking, since a
-- host's real, current prices may change later and a past booking
-- must never silently reprice itself.
alter table shortlet_bookings add column if not exists event_type text;
alter table shortlet_bookings add column if not exists selected_tier_label text;
alter table shortlet_bookings add column if not exists selected_facilities jsonb default '[]'::jsonb;
alter table shortlet_bookings add column if not exists facilities_total numeric default 0;

-- Real, one-call helper: seed a real, sensible starter set of
-- facilities for a host who's setting this up for the first time --
-- including the one genuinely missing item, ushers/event staff.
create or replace function seed_default_event_facilities(p_property_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  if not exists (select 1 from properties where id = p_property_id and owner_id = auth.uid()) then
    raise exception 'You are not the real owner of this property.';
  end if;
  if exists (select 1 from event_facilities where property_id = p_property_id) then
    return;
  end if;

  insert into event_facilities (property_id, name, price, per_guest, display_order) values
    (p_property_id, 'Lighting — standard', 15000, false, 1),
    (p_property_id, 'Lighting — premium stage rig', 35000, false, 2),
    (p_property_id, 'Sound system & PA', 25000, false, 3),
    (p_property_id, 'Catering service (per guest)', 2500, true, 4),
    (p_property_id, 'Live band / entertainment', 80000, false, 5),
    (p_property_id, 'DJ', 40000, false, 6),
    (p_property_id, 'Decoration & drapery', 50000, false, 7),
    (p_property_id, 'Generator / power backup', 20000, false, 8),
    (p_property_id, 'Security personnel', 15000, false, 9),
    (p_property_id, 'Parking attendants', 10000, false, 10),
    (p_property_id, 'Ushers / event staff', 12000, false, 11);
end;
$$;
