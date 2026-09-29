-- Real, critical, urgent fix: an earlier migration (221) used "create
-- or replace function" to add a real p_link parameter, but Postgres
-- treats a different parameter count as a genuinely separate function
-- overload -- it did not replace the old 3-parameter version, it
-- created a second, ambiguous one alongside it. Every real call to
-- this function with exactly 3 arguments (no link) has been silently
-- failing with a real "not unique" error ever since -- this is the
-- exact, confirmed reason a guarantor's real confirmation could never
-- actually complete. Dropping the old, conflicting overload entirely.

drop function notify_admins_by_domain(text, text, text);
