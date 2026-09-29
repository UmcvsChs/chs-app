-- Real, direct fix found while reviewing the video system's real
-- notification links: the owner's "a video has been requested"
-- notification linked to the public /property/ page -- the same
-- page a buyer would see, with no real way to actually add a video
-- from there. Fixed to link straight to the real edit page instead,
-- matching the direct link already added to the dashboard view.

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
    '/edit-listing/' || p_property_id);

  return v_new_id;
end;
$$;
