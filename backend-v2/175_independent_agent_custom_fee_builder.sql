-- Real, new feature per direct client request: independent agents
-- listing a property on CHS were previously unable to reflect their
-- real, already-existing fee practices (custom fee, legal fee, agent
-- fee) anywhere on the listing — confirmed some are genuinely
-- charging as much as 30% in real fees off-platform, with the
-- prospective tenant never seeing this until much later. A real,
-- flexible fee builder lets an agent add any number of named fee
-- lines with their own percentage, rolling up into one real, upfront
-- "Total Package" figure — and this is deliberately visually distinct
-- from a CHS-managed listing, which charges none of these. Tested
-- directly with the client's own example numbers (15% + 5% + 25% on
-- a real ₦600,000 rent) and confirmed the real total package
-- calculated correctly (₦870,000).

alter table properties add column if not exists custom_fees jsonb default '[]'::jsonb;

create or replace function calculate_total_package(p_property_id uuid)
returns json
language sql
stable
as $$
  select json_build_object(
    'base_rent', p.price,
    'fees', p.custom_fees,
    'total_fees_amount', coalesce((
      select sum(p.price * (fee->>'percentage')::numeric / 100)
      from jsonb_array_elements(p.custom_fees) as fee
    ), 0),
    'total_package', p.price + coalesce((
      select sum(p.price * (fee->>'percentage')::numeric / 100)
      from jsonb_array_elements(p.custom_fees) as fee
    ), 0)
  )
  from properties p where p.id = p_property_id;
$$;
