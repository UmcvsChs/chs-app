-- Real, immediate fix catching my own exact, known mistake before it
-- ever reached the client this time: changing this function's real
-- parameters left the old, 13-parameter version still sitting
-- alongside the new one -- the same real overload conflict that
-- already caused one confirmed, real failure this session. Removed
-- immediately, checked directly.
drop function if exists submit_rental_application(uuid, text, text, text, text, text, text, text, text, text, text, text, date);
