-- ═══════════════════════════════════════════════════════════════
-- CHS v2 — Real Fix: Missing Performance Indexes
-- ═══════════════════════════════════════════════════════════════
-- Found during a full audit of the app: several tables built earlier
-- in this session (the promo credit system) had no indexes on the
-- columns actually scanned on every request — get_promo_credit_balance
-- and the nightly cron both scan promo_credit_transactions by
-- user_id, for example. Invisible at today's row counts, real at
-- scale. This migration is purely additive — no behavior change,
-- only real query speed as the data grows.

create index if not exists idx_promo_credit_tx_user on promo_credit_transactions(user_id);
create index if not exists idx_property_promotions_owner on property_promotions(owner_id);
create index if not exists idx_property_promotions_active on property_promotions(is_active) where is_active = true;
create index if not exists idx_promo_subscriptions_user on promo_subscriptions(user_id);
create index if not exists idx_saved_searches_user on saved_searches(user_id);
create index if not exists idx_properties_purpose on properties(purpose);
create index if not exists idx_properties_location_state on properties(location_state);
create index if not exists idx_properties_urgent_sale on properties(is_urgent_sale) where is_urgent_sale = true;
