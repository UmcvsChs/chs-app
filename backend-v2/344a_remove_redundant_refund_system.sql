-- Real, direct correction: request_sale_refund already existed as a
-- complete, working, deadline-gated refund mechanism, with a real,
-- visible "Request refund & cancel this deal" button already in the
-- UI -- found only after building a second, redundant system on the
-- false premise that nothing existed. Rather than leave two competing
-- refund paths in the codebase, the newly-built, redundant functions
-- are removed here, and the real, existing mechanism is what gets
-- verified and explained to the client instead.
--
-- NOTE: this migration number (344) was independently reused by a
-- later, unrelated feature (user reference numbers) in the same
-- session. Kept as 344a; see 344b for the other.
--
-- This is the honest end of the 340a-344a refund thread: everything
-- built in 340a/341a/342a is removed again here. The only lasting
-- effect of this whole thread is the two real constraint widenings in
-- 342a and 343 (payment_status and status now both accept
-- 'refunded'), which remain genuinely useful and are not reverted.

drop function if exists request_offer_refund(uuid, text);
drop function if exists process_offer_refund(uuid, boolean, text);
