-- Real, direct fix — Fix Tracker item 1: a real, separate toilets
-- count, distinct from bathrooms, matching real Nigerian property
-- listing convention (a "toilet" and a "bathroom with shower/tub" are
-- often genuinely different rooms). Confirmed the real, current gap
-- directly: bedrooms and bathrooms existed only as plain number
-- inputs, never dropdowns, and toilets didn't exist as its own field
-- at all.

alter table properties add column if not exists toilets integer;
