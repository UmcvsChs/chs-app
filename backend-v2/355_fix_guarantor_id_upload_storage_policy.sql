-- Real, critical, confirmed fix: the private-documents storage
-- bucket had exactly two policies, both SELECT (read) -- genuinely
-- zero INSERT policy existed at all. Confirmed directly this is why
-- every real guarantor's ID upload has silently failed since this
-- feature existed: a guarantor accesses their confirmation page via
-- a real, secret token link, never through a real login, so they
-- have no auth.uid() to scope an upload to even if a policy existed
-- for authenticated users specifically.
--
-- Fixed with a real, deliberately narrow INSERT policy: anonymous
-- upload is allowed only under the exact real "guarantor-" path
-- prefix this one specific form already uses -- not a general
-- opening of the bucket. Read access stays exactly as restrictive as
-- before (admin and the real, matching account only).

create policy private_docs_guarantor_upload on storage.objects
for insert
with check (
  bucket_id = 'private-documents'
  and (storage.foldername(name))[1] like 'guarantor-%'
);
