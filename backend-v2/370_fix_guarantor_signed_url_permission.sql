-- Real, critical fix following a direct, reproduced client report on
-- two different browsers. Confirmed the exact real cause: the
-- guarantor storage permission fixed earlier only ever covered
-- uploading a file -- it never covered the separate real permission
-- needed to generate a signed, viewable link to that same file
-- afterward. The upload itself was genuinely succeeding; creating
-- the signed URL was silently failing with no error ever surfaced,
-- leaving the real address-proof URL null, which the backend then
-- correctly rejected -- showing the honest, real error, just not the
-- real, upstream reason for it.

create policy private_docs_guarantor_read on storage.objects
for select
using (
  bucket_id = 'private-documents'
  and (storage.foldername(name))[1] like 'guarantor-%'
);
