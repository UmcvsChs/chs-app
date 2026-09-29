-- Real, direct resolution of the one open, ERROR-level Supabase
-- security advisory (public.public_profiles, a SECURITY DEFINER-style
-- view). Confirmed directly before touching anything: zero real
-- references anywhere in the actual frontend, and zero references
-- from any backend function -- genuinely dead, unused infrastructure
-- carrying a real, open security exposure for no current benefit.
-- The honest, correct fix is removal, not a workaround. If a real
-- "public profile directory" feature is wanted in the future, it
-- should be built as a real SECURITY DEFINER function, matching this
-- project's own established, correct pattern for every other case of
-- controlled data exposure -- not a bare view, which is exactly what
-- Supabase's own advisor is warning against.

drop view if exists public_profiles;
