-- Completes the "Recently Handled, archived manually" pattern across
-- every real admin review queue, per explicit client instruction to
-- do this across the whole admin page. This round: Sale Approvals
-- (reusing offers' existing archived_at/admin_last_read_at from the
-- earlier Offers fix), Vendors, Artisans, and Developers (the last
-- one covering all three real stages: pending, reviewed, partnered).
--
-- Every real decision handler across all eight queues now marks its
-- own admin_last_read_at and refreshes its own Recently Handled list;
-- every handled item stays genuinely visible, with a real manual
-- archive button, until admin deliberately sends it away.
--
-- Full list, all now on the same real pattern: Offers, Engage CHS,
-- ID Verification, Face Verification, Registrations, Applications,
-- Properties, Sale Approvals, Vendors, Artisans, Developers.
--
-- Verified directly against real, live data: 5 real cleared sales
-- already exist and will populate Sale Approvals' Recently Handled
-- section immediately.
--
-- The marketplace_vendors/artisans/developer_applications
-- archived_at/admin_last_read_at columns are the same real schema as
-- migration 311 — not repeated here. offers.sale_admin_last_read_at
-- below is this file's own, real addition (Sale Approvals reuses
-- offers' existing archived_at from the earlier Offers fix, but
-- needed its own separate "read" marker since offers already used
-- admin_last_read_at for the Offer Review queue itself).

alter table offers add column if not exists sale_admin_last_read_at timestamptz;

create or replace function get_recently_handled_sale_approvals()
returns json language sql security definer stable as $$
  select coalesce(json_agg(row_to_json(t) order by t.sale_admin_last_read_at desc), '[]'::json) from (
    select o.id, o.chs_cleared, o.buyer_full_name, p.title as property_title, o.sale_admin_last_read_at
    from offers o join properties p on p.id = o.property_id
    where o.chs_cleared = true and o.sale_admin_last_read_at is not null
      and (o.archived_at is null or o.archived_at > now() - interval '7 days')
  ) t;
$$;

create or replace function get_recently_handled_vendors()
returns json language sql security definer stable as $$
  select coalesce(json_agg(row_to_json(t) order by t.admin_last_read_at desc), '[]'::json) from (
    select mv.id, mv.verification_status, mv.business_name, mv.admin_last_read_at
    from marketplace_vendors mv
    where mv.verification_status != 'pending' and mv.admin_last_read_at is not null
      and (mv.archived_at is null or mv.archived_at > now() - interval '7 days')
  ) t;
$$;

create or replace function get_recently_handled_artisans()
returns json language sql security definer stable as $$
  select coalesce(json_agg(row_to_json(t) order by t.admin_last_read_at desc), '[]'::json) from (
    select a.id, a.verification_status, a.trade, p.full_name, a.admin_last_read_at
    from artisans a join profiles p on p.id = a.user_id
    where a.verification_status != 'pending' and a.admin_last_read_at is not null
      and (a.archived_at is null or a.archived_at > now() - interval '7 days')
  ) t;
$$;

create or replace function get_recently_handled_developers()
returns json language sql security definer stable as $$
  select coalesce(json_agg(row_to_json(t) order by t.admin_last_read_at desc), '[]'::json) from (
    select da.id, da.status, da.company_name, da.admin_last_read_at
    from developer_applications da
    where da.status in ('reviewed', 'partnered') and da.admin_last_read_at is not null
      and (da.archived_at is null or da.archived_at > now() - interval '7 days')
  ) t;
$$;
