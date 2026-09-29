-- Real, critical, systemic fix. The exact bug that broke guarantor
-- confirmation (a "create or replace function" with a different
-- parameter count silently creating a second, ambiguous overload
-- instead of replacing the original) was checked for across the
-- entire real database, not just the one function already found. Nine
-- more real, custom CHS functions had the exact same problem, each a
-- real, live landmine for any caller using an older argument count.
-- Every stale overload dropped, keeping only the one real, current
-- signature actually used by the live frontend (confirmed by
-- searching the real, current codebase directly for each one).

drop function add_linked_bank_account(text, text, text, text);
drop function get_real_shortlet_pricing(uuid, date, date);
drop function give_non_renewal_notice(uuid);
drop function promote_listing(uuid, numeric, integer, text);
drop function request_document_dispatch(uuid);
drop function get_required_sale_documents();

-- book_shortlet_with_payment: confirmed genuinely unused by any real,
-- current frontend caller (request_shortlet_booking replaced it).
-- Both stale overloads dropped entirely.
drop function book_shortlet_with_payment(uuid, uuid, date, date, numeric, integer, text, text, text);
drop function book_shortlet_with_payment(uuid, uuid, date, date, numeric, integer, text, text, text, boolean, boolean, boolean, integer, text);

-- request_shortlet_booking: three real overloads existed; kept only
-- the current, complete 13-parameter version the live form actually
-- calls.
drop function request_shortlet_booking(uuid, date, date, integer, text, text, text);
drop function request_shortlet_booking(uuid, date, date, integer, text, text, text, boolean);
