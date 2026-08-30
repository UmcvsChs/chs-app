-- Real, confirmed gap from direct user testing: the buyer already had
-- an optional note field on their offer, but the seller had no
-- equivalent way to attach a real message when accepting or
-- declining — only a fixed, generic notification either way.

alter table offers add column if not exists seller_response_note text;
