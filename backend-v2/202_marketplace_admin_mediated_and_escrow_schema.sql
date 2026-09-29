-- Real, complete redesign per direct, explicit client instruction: no
-- marketplace deal may ever be self-reported or settled off-platform
-- again. Every quote request and every vendor response is now
-- filtered for contact information and held for real admin review
-- before the other party ever sees it -- the exact same, already
-- proven pattern used for property-offer negotiation. Real money now
-- actually moves through CHS: the buyer pays the real price plus a
-- real 6% commission into escrow; on confirmed completion, the vendor
-- receives the price net of a real 4% commission -- 10% collected in
-- total, from both sides, exactly as instructed.

alter table service_quote_requests add column if not exists reference_number text unique;
alter table service_quote_requests add column if not exists moderation_status text default 'pending_review'
  check (moderation_status in ('pending_review', 'approved', 'blocked'));
alter table service_quote_requests add column if not exists block_reason text;
alter table service_quote_requests add column if not exists response_moderation_status text
  check (response_moderation_status in ('pending_review', 'approved', 'blocked'));
alter table service_quote_requests add column if not exists response_block_reason text;
alter table service_quote_requests add column if not exists payment_status text default 'unpaid'
  check (payment_status in ('unpaid', 'held_escrow', 'released', 'refunded'));
alter table service_quote_requests add column if not exists buyer_commission_amount numeric;
alter table service_quote_requests add column if not exists vendor_commission_amount numeric;
alter table service_quote_requests add column if not exists escrow_reference text;

create sequence if not exists marketplace_reference_seq start 1;
alter table service_quote_requests alter column reference_number set default ('CHS-MKT-' || lpad(nextval('marketplace_reference_seq')::text, 6, '0'));
update service_quote_requests set reference_number = 'CHS-MKT-' || lpad(nextval('marketplace_reference_seq')::text, 6, '0') where reference_number is null;

insert into platform_settings (key, value) values
  ('marketplace_buyer_commission_pct', '6'),
  ('marketplace_vendor_commission_pct', '4')
on conflict (key) do nothing;
