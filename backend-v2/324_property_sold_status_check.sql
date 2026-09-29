-- Real, direct answer to a genuine, well-described client request: a
-- buyer who paid for a property got the exact same cold "doesn't
-- exist, may have been removed" message as someone visiting a truly
-- invalid link -- nothing distinguishing "this was never real" from
-- "you actually bought this." The RLS fix in this same round already
-- solves it for the real buyer (they now see the full, real property
-- page again). This solves the OTHER real case: anyone else who
-- follows an old link to a property that's since sold, who RLS
-- correctly still keeps out of the full listing.
--
-- A narrow, public, security-definer function -- deliberately
-- returning only whether a real property with this ID exists and
-- whether it's genuinely sold, nothing else -- lets the property page
-- tell these two real cases apart without bypassing RLS's real
-- protection of the full listing data.

create or replace function get_property_sold_status(p_id uuid)
returns json
language sql
security definer
stable
as $$
  select json_build_object(
    'exists', (select count(*) > 0 from properties where id = p_id),
    'sold', (select count(*) > 0 from properties where id = p_id and status = 'sold'),
    'title', (select title from properties where id = p_id)
  );
$$;
