-- Real, direct fix per a direct client request — a genuine
-- cost-saving alternative to a paid third-party virtual-tour service:
-- owners, agents, and managers can record or upload a real, short
-- video labeled per room/facility, directly through the app. A
-- genuinely interested buyer or tenant can request a real, additional
-- video of a specific area if what's already there doesn't satisfy
-- them.

create table if not exists property_videos (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  uploaded_by uuid references profiles(id),
  room_label text not null,
  video_url text not null,
  created_at timestamptz default now()
);

alter table property_videos enable row level security;
create policy property_videos_owner_manage on property_videos for all
  using (exists (select 1 from properties p where p.id = property_id and p.owner_id = auth.uid()));
create policy property_videos_public_read on property_videos for select
  using (exists (select 1 from properties p where p.id = property_id and p.verification_status = 'verified' and p.status = 'active'));
create policy property_videos_admin_all on property_videos for all
  using (staff_can_access('owner_buyer_tenant'));

create table if not exists video_requests (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  requested_by uuid not null references profiles(id),
  room_label text not null,
  note text,
  status text not null default 'pending' check (status in ('pending', 'fulfilled')),
  created_at timestamptz default now()
);

alter table video_requests enable row level security;
create policy video_requests_requester_read on video_requests for select using (requested_by = auth.uid());
create policy video_requests_owner_read on video_requests for select
  using (exists (select 1 from properties p where p.id = property_id and p.owner_id = auth.uid()));
create policy video_requests_admin_all on video_requests for all using (staff_can_access('owner_buyer_tenant'));

create or replace function request_property_video(p_property_id uuid, p_room_label text, p_note text default null)
returns uuid
language plpgsql
security definer
as $$
declare
  v_owner_id uuid;
  v_property_title text;
  v_requester_name text;
  v_new_id uuid;
  v_reason text;
begin
  select owner_id, title into v_owner_id, v_property_title from properties where id = p_property_id;
  select full_name into v_requester_name from profiles where id = auth.uid();

  if p_note is not null then
    v_reason := detect_offplatform_contact(p_note);
    if v_reason is not null then
      raise exception 'Your note cannot be saved — %', v_reason;
    end if;
  end if;

  insert into video_requests (property_id, requested_by, room_label, note)
  values (p_property_id, auth.uid(), p_room_label, p_note)
  returning id into v_new_id;

  perform notify_user(v_owner_id, '🎥 A real video has been requested',
    v_requester_name || ' would like a real video of the ' || p_room_label || ' for "' || v_property_title || '".' || coalesce(' Note: ' || p_note, ''),
    '/property/' || p_property_id);

  return v_new_id;
end;
$$;

create or replace function fulfill_video_request(p_request_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_requester_id uuid;
  v_property_title text;
  v_room_label text;
begin
  select vr.requested_by, p.title, vr.room_label into v_requester_id, v_property_title, v_room_label
    from video_requests vr join properties p on p.id = vr.property_id
    where vr.id = p_request_id and vr.property_id in (select id from properties where owner_id = auth.uid());

  if v_requester_id is null then
    raise exception 'This real request was not found, or you are not the real owner of this property.';
  end if;

  update video_requests set status = 'fulfilled' where id = p_request_id;

  perform notify_user(v_requester_id, '🎥 Your requested video is ready',
    'A real video of the ' || v_room_label || ' has been added to "' || v_property_title || '" — take a look.',
    '/property/' || (select property_id from video_requests where id = p_request_id));
end;
$$;
