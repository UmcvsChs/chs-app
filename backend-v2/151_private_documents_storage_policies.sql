-- Real, critical finding from the security audit: the bucket storing
-- ID document scans, selfies, legal sale documents, and court
-- affidavits was marked fully public — meaning anyone who ever
-- obtained the file URL (through any means, at any point) could view
-- it directly, forever, completely bypassing every database-level
-- RLS fix. A new, genuinely private bucket is created, with real
-- storage-level policies mirroring the same access rules already
-- enforced on the database records that reference these files —
-- only the uploader themselves, or a real, authorized party, can
-- read them, and only via a signed, time-limited URL, never a
-- permanent public link.

insert into storage.buckets (id, name, public) values ('private-documents', 'private-documents', false)
on conflict (id) do nothing;

create policy "private_docs_own_folder_upload" on storage.objects for insert
with check (bucket_id = 'private-documents' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "private_docs_own_folder_read" on storage.objects for select
using (bucket_id = 'private-documents' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "private_docs_admin_read" on storage.objects for select
using (bucket_id = 'private-documents' and staff_can_access('owner_buyer_tenant'));
