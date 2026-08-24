-- ═══════════════════════════════════════════════════════════════
-- CHS v2 — Real Fix: Engage CHS — Specifications, Two-Way Thread,
-- Document Delivery, Contact Details
-- ═══════════════════════════════════════════════════════════════
-- Run this ONCE, after 01_schema.sql, in the same Supabase project.

select count(*) as schema_already_set_up from engage_chs_requests;

-- ───────────────────────────────────────────────────────────────
-- 1. Real contact details — required at submission so a genuine
--    voice call can happen for clarity, not just in-app messaging.
-- ───────────────────────────────────────────────────────────────

alter table engage_chs_requests add column if not exists contact_phone text;
alter table engage_chs_requests add column if not exists contact_email text;

-- ───────────────────────────────────────────────────────────────
-- 2. Real two-way thread — the actual missing piece: admin could
--    already ask for more specification, but there was genuinely
--    nowhere for the client to reply without starting an entirely new
--    request. Mirrors the already-proven tenancy_messages pattern.
-- ───────────────────────────────────────────────────────────────

create table if not exists engage_chs_messages (
  id uuid primary key default uuid_generate_v4(),
  request_id uuid not null references engage_chs_requests(id) on delete cascade,
  sender_id uuid not null references profiles(id) on delete cascade,
  text text not null,
  created_at timestamptz default now()
);

alter table engage_chs_messages enable row level security;

create policy "engage_chs_messages_client_own"
  on engage_chs_messages for select
  using (exists (select 1 from engage_chs_requests r where r.id = request_id and r.owner_id = auth.uid()));

create policy "engage_chs_messages_client_insert"
  on engage_chs_messages for insert
  with check (
    auth.uid() = sender_id
    and exists (select 1 from engage_chs_requests r where r.id = request_id and r.owner_id = auth.uid())
  );

create policy "engage_chs_messages_admin_all"
  on engage_chs_messages for all
  using (exists (select 1 from profiles where id = auth.uid() and is_super_admin = true));

-- Real, per-side unread tracking — a genuine "new message" badge, not
-- a general notification lost in the bell alongside everything else.
alter table engage_chs_requests add column if not exists client_last_read_at timestamptz default now();
alter table engage_chs_requests add column if not exists admin_last_read_at timestamptz default now();

create or replace function send_engage_chs_message(p_request_id uuid, p_text text)
returns void
language plpgsql
security definer
as $$
declare
  v_owner_id uuid;
  v_is_admin boolean;
  v_reference text;
begin
  select owner_id, reference into v_owner_id, v_reference from engage_chs_requests where id = p_request_id;
  select is_super_admin into v_is_admin from profiles where id = auth.uid();

  if auth.uid() != v_owner_id and not coalesce(v_is_admin, false) then
    raise exception 'You do not have access to this conversation.';
  end if;

  insert into engage_chs_messages (request_id, sender_id, text) values (p_request_id, auth.uid(), p_text);

  if coalesce(v_is_admin, false) then
    update engage_chs_requests set admin_last_read_at = now() where id = p_request_id;
    perform notify_user(v_owner_id, '💬 New reply on your Engage CHS request',
      'CHS has responded on ' || v_reference || ' — open Engage CHS to see it.');
  else
    update engage_chs_requests set client_last_read_at = now() where id = p_request_id;
    -- Real urgency, per direct instruction — every reply from a real
    -- client notifies the super admin directly, not buried in a queue.
    insert into notifications (user_id, title, body)
    select id, '💬 Client replied on Engage CHS',
      v_reference || ' — a real client response needs your attention.'
    from profiles where is_super_admin = true;
  end if;
end;
$$;

create or replace function mark_engage_chs_thread_read(p_request_id uuid, p_as_admin boolean)
returns void
language plpgsql
security definer
as $$
begin
  if p_as_admin then
    update engage_chs_requests set admin_last_read_at = now() where id = p_request_id;
  else
    update engage_chs_requests set client_last_read_at = now() where id = p_request_id
      and owner_id = auth.uid();
  end if;
end;
$$;

-- ───────────────────────────────────────────────────────────────
-- 3. Document delivery — the real mechanism for "what next": once a
--    proposal is confirmed, admin uploads the real architectural
--    drawing, BOQ, or other preliminary document against this exact
--    request, with a genuine due-by date the client can see and a
--    real status, not left wondering what happens after submission.
-- ───────────────────────────────────────────────────────────────

create table if not exists engage_chs_documents (
  id uuid primary key default uuid_generate_v4(),
  request_id uuid not null references engage_chs_requests(id) on delete cascade,
  document_type text not null check (document_type in ('architectural_drawing','bill_of_quantities','structural_drawing','mep_drawing','other')),
  file_url text,
  due_by date,
  status text not null default 'pending' check (status in ('pending','ready','delivered')),
  uploaded_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table engage_chs_documents enable row level security;

create policy "engage_chs_documents_client_read"
  on engage_chs_documents for select
  using (exists (select 1 from engage_chs_requests r where r.id = request_id and r.owner_id = auth.uid()));

create policy "engage_chs_documents_admin_all"
  on engage_chs_documents for all
  using (exists (select 1 from profiles where id = auth.uid() and is_super_admin = true));

create or replace function upsert_engage_chs_document(
  p_request_id uuid, p_document_type text, p_file_url text, p_due_by date, p_status text
)
returns void
language plpgsql
security definer
as $$
declare
  v_owner_id uuid;
  v_reference text;
  v_existing_id uuid;
begin
  if not exists (select 1 from profiles where id = auth.uid() and is_super_admin = true) then
    raise exception 'Only the super admin can manage engagement documents.';
  end if;

  select owner_id, reference into v_owner_id, v_reference from engage_chs_requests where id = p_request_id;

  select id into v_existing_id from engage_chs_documents
    where request_id = p_request_id and document_type = p_document_type;

  if v_existing_id is not null then
    update engage_chs_documents
      set file_url = coalesce(p_file_url, file_url), due_by = coalesce(p_due_by, due_by),
          status = p_status, updated_at = now(), uploaded_by = auth.uid()
      where id = v_existing_id;
  else
    insert into engage_chs_documents (request_id, document_type, file_url, due_by, status, uploaded_by)
    values (p_request_id, p_document_type, p_file_url, p_due_by, p_status, auth.uid());
  end if;

  if p_status = 'ready' then
    perform notify_user(v_owner_id, '📄 A document is ready on your Engage CHS request',
      replace(p_document_type, '_', ' ') || ' is now ready for ' || v_reference || ' — open Engage CHS to view it.');
  end if;
end;
$$;

select table_name from information_schema.tables where table_name in ('engage_chs_messages','engage_chs_documents');
-- Should return two rows.
