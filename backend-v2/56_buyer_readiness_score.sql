-- ═══════════════════════════════════════════════════════════════
-- CHS v2 — Real Fix: Buyer/Tenant Readiness Score
-- ═══════════════════════════════════════════════════════════════
-- Run this ONCE, after 01_schema.sql, in the same Supabase project.
--
-- Deliberately NOT a fee or deposit gate — nothing here blocks anyone
-- or charges anyone. It scores real, observable signals and surfaces
-- that score to the owner/agent deciding where to spend their time.
-- Three real inputs: a short structured questionnaire at the moment
-- someone escalates (requests an inspection, applies, or makes an
-- offer), real ID/liveness verification already built into the app,
-- and real inspection show-up history — the strongest single signal,
-- since a window-shopper rarely books and keeps a real appointment.

select count(*) as schema_already_set_up from inspections;
-- If this errors, run 01_schema.sql first.

-- ───────────────────────────────────────────────────────────────
-- 1. The structured intent questionnaire — one shared table for all
--    three escalation points, not duplicated columns across three
--    different tables.
-- ───────────────────────────────────────────────────────────────

create table if not exists readiness_responses (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  request_type text not null check (request_type in ('inspection','application','offer')),
  request_id uuid not null,
  timeline text not null check (timeline in ('ready_now','one_to_three_months','three_to_six_months','just_exploring')),
  funds_ready boolean not null,
  decision_maker boolean not null,
  notes text,
  created_at timestamptz default now(),
  unique (request_type, request_id)
);

alter table readiness_responses enable row level security;

create policy "readiness_responses_own_insert"
  on readiness_responses for insert
  with check (auth.uid() = user_id);

create policy "readiness_responses_own_read"
  on readiness_responses for select
  using (auth.uid() = user_id);

-- A property's real owner (or its delegated manager, or an admin)
-- needs to see the readiness answers behind a request made on their
-- own property — this is exactly the information the owner/agent
-- uses to prioritize their own time, the actual point of this system.
create policy "readiness_responses_property_party_read"
  on readiness_responses for select
  using (
    (request_type = 'inspection' and exists (
      select 1 from inspections i join properties p on p.id = i.property_id
      where i.id = readiness_responses.request_id
        and (p.owner_id = auth.uid() or is_admin())
    ))
    or (request_type = 'application' and exists (
      select 1 from rental_applications a join properties p on p.id = a.property_id
      where a.id = readiness_responses.request_id
        and (p.owner_id = auth.uid() or is_admin())
    ))
    or (request_type = 'offer' and exists (
      select 1 from offers o join properties p on p.id = o.property_id
      where o.id = readiness_responses.request_id
        and (p.owner_id = auth.uid() or is_admin())
    ))
  );

create or replace function submit_readiness_response(
  p_request_type text, p_request_id uuid, p_timeline text, p_funds_ready boolean, p_decision_maker boolean, p_notes text default null
)
returns void
language plpgsql
security definer
as $$
begin
  insert into readiness_responses (user_id, request_type, request_id, timeline, funds_ready, decision_maker, notes)
  values (auth.uid(), p_request_type, p_request_id, p_timeline, p_funds_ready, p_decision_maker, p_notes)
  on conflict (request_type, request_id) do nothing;
end;
$$;

-- ───────────────────────────────────────────────────────────────
-- 2. Real inspection show-up tracking — the strongest single signal.
--    A genuine 'no_show' status, distinct from 'completed', plus a
--    real function for the property's owner/manager/admin to mark it
--    after the scheduled time passes.
-- ───────────────────────────────────────────────────────────────

alter table inspections drop constraint if exists inspections_status_check;
alter table inspections add constraint inspections_status_check
  check (status in ('pending','confirmed','completed','cancelled','no_show'));

create or replace function mark_inspection_attendance(p_inspection_id uuid, p_attended boolean)
returns void
language plpgsql
security definer
as $$
declare
  v_owner_id uuid;
begin
  select p.owner_id into v_owner_id
    from inspections i join properties p on p.id = i.property_id
    where i.id = p_inspection_id;

  if v_owner_id != auth.uid() and not is_admin() then
    raise exception 'Only the property owner or an admin can record inspection attendance.';
  end if;

  update inspections
    set status = case when p_attended then 'completed' else 'no_show' end
    where id = p_inspection_id;
end;
$$;

-- ───────────────────────────────────────────────────────────────
-- 3. The real, live-computed score — never stored/cached, always
--    reflects the person's actual current standing.
-- ───────────────────────────────────────────────────────────────

create or replace function get_readiness_score(p_user_id uuid)
returns integer
language plpgsql
stable
security definer
as $$
declare
  v_score integer := 0;
  v_id_verified boolean;
  v_liveness_verified boolean;
  v_latest_timeline text;
  v_latest_funds_ready boolean;
  v_attended integer;
  v_no_show integer;
begin
  select valid_id_verified, liveness_verified into v_id_verified, v_liveness_verified
    from profiles where id = p_user_id;

  if coalesce(v_id_verified, false) then v_score := v_score + 20; end if;
  if coalesce(v_liveness_verified, false) then v_score := v_score + 10; end if;

  select timeline, funds_ready into v_latest_timeline, v_latest_funds_ready
    from readiness_responses where user_id = p_user_id
    order by created_at desc limit 1;

  v_score := v_score + case v_latest_timeline
    when 'ready_now' then 15
    when 'one_to_three_months' then 8
    when 'three_to_six_months' then 3
    else 0
  end;
  if coalesce(v_latest_funds_ready, false) then v_score := v_score + 15; end if;

  select count(*) filter (where status = 'completed'), count(*) filter (where status = 'no_show')
    into v_attended, v_no_show
    from inspections where requester_id = p_user_id;

  if (v_attended + v_no_show) > 0 then
    v_score := v_score + round(30.0 * v_attended / (v_attended + v_no_show));
  end if;
  v_score := v_score - least(v_no_show * 15, 30);

  return greatest(0, least(100, v_score));
end;
$$;

select column_name from information_schema.columns where table_name = 'readiness_responses' limit 1;
-- Should return one row.
