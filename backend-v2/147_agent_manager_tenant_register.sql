-- Real, new feature per direct client request: agents/managers with
-- tenants across multiple locations need a genuine, comprehensive
-- register — full biodata, property details, and a real reference
-- number for easy identification — plus real verification (ID, ID
-- number, a selfie or passport photo), since "they don't relate with
-- ghosts." Entered by the agent/manager themselves, since a tenant
-- may have supplied these details on paper or verbally, not through
-- the app directly.

create sequence if not exists tenant_register_seq;

create table tenant_register (
  id uuid primary key default uuid_generate_v4(),
  recorded_by uuid not null references profiles(id),
  reference_number text not null unique default ('TEN-' || lpad(nextval('tenant_register_seq')::text, 6, '0')),
  tenant_id uuid references profiles(id),
  full_name text not null,
  phone text not null,
  location_area text not null,
  street_address text,
  property_type text not null,
  bedrooms int,
  annual_rent numeric not null,
  emergency_contact_name text,
  emergency_contact_phone text,
  occupation text,
  id_type text,
  id_number text,
  id_document_url text,
  selfie_url text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table tenant_register enable row level security;
create policy "tenant_register_recorder" on tenant_register for all using (auth.uid() = recorded_by);
create policy "tenant_register_team_view" on tenant_register for select using (is_team_member_of(recorded_by));
create policy "tenant_register_admin" on tenant_register for all using (staff_can_access('owner_buyer_tenant'));

create or replace function add_tenant_register_entry(
  p_full_name text, p_phone text, p_location_area text, p_street_address text,
  p_property_type text, p_bedrooms int, p_annual_rent numeric,
  p_emergency_contact_name text default null, p_emergency_contact_phone text default null,
  p_occupation text default null, p_id_type text default null, p_id_number text default null,
  p_id_document_url text default null, p_selfie_url text default null, p_notes text default null
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_tenant_id uuid;
  v_new_id uuid;
begin
  select id into v_tenant_id from profiles where phone = p_phone;

  insert into tenant_register (
    recorded_by, tenant_id, full_name, phone, location_area, street_address,
    property_type, bedrooms, annual_rent, emergency_contact_name, emergency_contact_phone,
    occupation, id_type, id_number, id_document_url, selfie_url, notes
  ) values (
    auth.uid(), v_tenant_id, p_full_name, p_phone, p_location_area, p_street_address,
    p_property_type, p_bedrooms, p_annual_rent, p_emergency_contact_name, p_emergency_contact_phone,
    p_occupation, p_id_type, p_id_number, p_id_document_url, p_selfie_url, p_notes
  ) returning id into v_new_id;

  return v_new_id;
end;
$$;
