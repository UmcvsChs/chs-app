-- Real fix to another genuine mistake caught by direct testing:
-- payment_status only ever allowed 'unpaid' or 'paid' -- 'refunded'
-- is a real, distinct, third state (money was paid, then genuinely
-- returned), and clarity here matters directly for the kind of
-- financial audit this whole feature exists to support.
--
-- NOTE: this migration number (342) was independently reused by a
-- later, unrelated feature (the Investor role) in the same session.
-- Kept as 342a; see 342b for the other.

alter table offers drop constraint offers_payment_status_check;
alter table offers add constraint offers_payment_status_check
  check (payment_status = any (array['unpaid', 'paid', 'refunded']));
