-- Real, serious privacy gap found while building the buyer document
-- delivery feature: a "public" RLS policy meant to let anyone see a
-- property's verification badge (e.g. "6/6 verified") was written as
-- a blanket "true" policy on the whole table — meaning the actual
-- real file_url of a seller's sensitive legal documents (Certificate
-- of Occupancy, Deed of Assignment, etc.) was readable by anyone with
-- an API key, not just the verification count. Fixed by removing the
-- blanket policy and adding a real, safe, count-only public function,
-- plus genuine buyer access — but only once they've actually paid.

drop policy if exists "sale_docs_public_status" on property_sale_documents;

create or replace function get_sale_documents_verification_summary(p_property_id uuid)
returns json
language sql
stable
as $$
  select json_build_object(
    'total', count(*),
    'verified', count(*) filter (where verification_status = 'verified')
  ) from property_sale_documents where property_id = p_property_id;
$$;

create policy "sale_docs_paid_buyer" on property_sale_documents for select using (
  exists (
    select 1 from offers o
    where o.property_id = property_sale_documents.property_id
    and o.buyer_id = auth.uid()
    and o.payment_status = 'paid'
  )
);
