-- Real, urgent fix for a genuine mistake in migration 366: adding
-- new parameters to submit_guarantor_confirmation via CREATE OR
-- REPLACE did not actually replace the old, 8-parameter version --
-- Postgres only replaces a function with the exact same parameter
-- list, so this created a second, separate overload instead, leaving
-- both versions genuinely callable. With the three new parameters
-- all carrying defaults, a call with just the original 8 named
-- arguments became genuinely ambiguous between the two, which is
-- exactly the real error the client hit immediately on their next
-- real submission attempt.
--
-- Fixed by dropping the old, 8-parameter version outright, leaving
-- only the one real, correct version with the address-proof fields.

drop function if exists submit_guarantor_confirmation(text, text, text, text, text, text, text, text);
